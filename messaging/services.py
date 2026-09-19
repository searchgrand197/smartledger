import os
import logging
import tempfile
import requests
import threading
from django.conf import settings
from django.utils import timezone
from django.db import models
from .models import MessageQueue

logger = logging.getLogger("messaging")

# Temp PDFs live under gettempdir()/sl-wa-*/filename.pdf so WhatsApp still
# shows a real invoice name, then the folder is removed after delivery.
_TEMP_PREFIX = "sl-wa-"


def write_queued_pdf(filename, pdf_bytes):
    """Write PDF bytes to a unique temp folder. Returns the absolute file path."""
    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in str(filename or "invoice"))
    if not safe.lower().endswith(".pdf"):
        safe += ".pdf"
    tmp_dir = tempfile.mkdtemp(prefix=_TEMP_PREFIX)
    path = os.path.join(tmp_dir, safe)
    with open(path, "wb") as handle:
        handle.write(pdf_bytes)
    return path


def discard_queued_pdf(path):
    """Delete a temp WhatsApp PDF and its folder. Ignores paths outside the temp dir."""
    if not path:
        return
    try:
        path = os.path.abspath(path)
        tmp_root = os.path.abspath(tempfile.gettempdir())
        parent = os.path.dirname(path)
        if not path.startswith(tmp_root + os.sep):
            return
        if not os.path.basename(parent).startswith(_TEMP_PREFIX):
            return
        if os.path.isfile(path):
            os.remove(path)
        if os.path.isdir(parent) and not os.listdir(parent):
            os.rmdir(parent)
    except OSError as err:
        logger.warning("Could not remove temp WhatsApp PDF %s: %s", path, err)

def enqueue_message(recipient, caption, file_path=None, message_type="whatsapp", 
                    organization=None, customer=None, bill=None):
    """
    Creates a new message queue item in 'pending' status and schedules an async send.
    """
    message = MessageQueue.all_objects.create(
        organization=organization,
        customer=customer,
        bill=bill,
        message_type=message_type,
        recipient=recipient,
        caption=caption,
        file_path=file_path,
        status="pending"
    )
    
    logger.info(f"[Queue] Message enqueued: ID {message.id} to {recipient}")
    send_message_async(message.id)
    return message


def send_message_async(message_id):
    """
    Triggers asynchronous message delivery by spawning a background thread.
    This releases the HTTP client request thread immediately.
    """
    thread = threading.Thread(target=process_single_message_from_queue, args=(message_id,))
    thread.daemon = True
    thread.start()


def process_single_message_from_queue(message_id):
    """
    Retrieves, locks, and attempts to send a specific enqueued message.
    """
    try:
        # Querying globally to bypass tenant ContextVar issues in backend thread
        message = MessageQueue.all_objects.get(pk=message_id)
    except Exception as e:
        logger.error(f"[Queue] Message ID {message_id} fetch failed: {str(e)}")
        return

    if message.status not in ["pending", "failed"]:
        return

    try:
        # Lock message by setting to processing
        message.status = "processing"
        message.save(update_fields=["status"])
    except Exception as e:
        logger.error(f"[Queue] Message ID {message_id} lock save failed: {str(e)}")
        return

    logger.debug(f"[Queue] Processing Message ID {message.id} to {message.recipient}")
    
    success, error_detail = deliver_message_to_gateway(message)

    try:
        if success:
            message.status = "sent"
            message.error_message = None
            discard_queued_pdf(message.file_path)
            message.file_path = ""
            message.save(update_fields=["status", "error_message", "file_path"])
            logger.info(f"[Queue] Message ID {message.id} delivered successfully.")
        else:
            message.status = "failed"
            message.retry_count += 1
            message.error_message = error_detail
            update_fields = ["status", "retry_count", "error_message"]
            if message.retry_count >= message.max_retries:
                discard_queued_pdf(message.file_path)
                message.file_path = ""
                update_fields.append("file_path")
            message.save(update_fields=update_fields)
            logger.warning(f"[Queue] Message ID {message.id} delivery failed: {error_detail}")
    except Exception as e:
        logger.error(f"[Queue] Message ID {message.id} final status save failed: {str(e)}")


def deliver_message_to_gateway(message):
    """
    Integrates with the Node.js message-sender microservice.
    Handles connection errors, timeouts, and gateway response parsing.
    """
    local_gateway_url = getattr(
        settings,
        "WHATSAPP_LOCAL_GATEWAY_URL",
        f"{getattr(settings, 'WHATSAPP_INTERNAL_BASE_URL', 'http://127.0.0.1:8787')}/api/send-pdf",
    )
    
    if message.message_type != "whatsapp":
        return False, f"Unsupported message channel: {message.message_type}"

    # Verify media file if path is specified
    if message.file_path:
        if not os.path.exists(message.file_path):
            return False, f"Attachment file not found at path: {message.file_path}"
        
        # Use send-pdf endpoint
        payload = {
            "phone": message.recipient,
            "pdfPath": message.file_path,
            "caption": message.caption or ""
        }
        url = local_gateway_url
    else:
        return False, "No PDF attached — ledger delivery requires a file_path"

    try:
        # PDF upload + WhatsApp ack can exceed 15s on slow sessions.
        response = requests.post(url, json=payload, timeout=90)
        
        if response.status_code == 200:
            return True, None
        else:
            return False, f"Gateway returned error code {response.status_code}: {response.text}"
            
    except requests.exceptions.Timeout:
        return False, "Gateway timeout (90 seconds reached)"
    except requests.exceptions.ConnectionError:
        return False, "Gateway connection failed — Service may be offline"
    except Exception as e:
        return False, f"Unexpected delivery error: {str(e)}"


def process_failed_retries():
    """
    Selects eligible failed messages and schedules their retries based on backoff logic.
    """
    now = timezone.now()
    
    # Query failed messages that haven't exceeded retry limits
    failed_messages = MessageQueue.all_objects.filter(
        status="failed",
        retry_count__lt=models.F("max_retries")
    )
    
    for msg in failed_messages:
        # Backoff: wait 2^(retry_count) minutes after the last failure (updated_at)
        backoff_delay = timezone.timedelta(minutes=2 ** msg.retry_count)
        if now >= msg.updated_at + backoff_delay:
            logger.info(f"[Queue] Scheduling retry for message ID {msg.id} (Attempt {msg.retry_count + 1})")
            send_message_async(msg.id)
