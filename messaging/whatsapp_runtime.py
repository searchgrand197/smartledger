import logging
import os
import platform
import socket
import subprocess
import sys

from django.conf import settings

logger = logging.getLogger("messaging")


def whatsapp_internal_port() -> int:
    return int(getattr(settings, "WHATSAPP_INTERNAL_PORT", 8787))


def whatsapp_internal_host() -> str:
    return getattr(settings, "WHATSAPP_INTERNAL_HOST", "127.0.0.1")


def is_whatsapp_port_open() -> bool:
    host = whatsapp_internal_host()
    port = whatsapp_internal_port()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    try:
        sock.connect((host, port))
        return True
    except (OSError, socket.timeout):
        return False
    finally:
        sock.close()


def start_whatsapp_sender() -> None:
    if not getattr(settings, "WHATSAPP_AUTO_START", True):
        return

    if is_whatsapp_port_open():
        logger.info("WhatsApp sender already running on %s:%s", whatsapp_internal_host(), whatsapp_internal_port())
        return

    msg_sender_dir = os.path.join(settings.BASE_DIR, "message-sender")
    if not os.path.exists(msg_sender_dir):
        msg_sender_dir = os.path.join(settings.BASE_DIR.parent, "message-sender")
    if not os.path.exists(msg_sender_dir):
        logger.warning("WhatsApp sender directory not found at %s", msg_sender_dir)
        return

    env = os.environ.copy()
    env["WHATSAPP_INTERNAL_HOST"] = whatsapp_internal_host()
    env["WHATSAPP_INTERNAL_PORT"] = str(whatsapp_internal_port())

    logger.info(
        "Starting WhatsApp sender on %s:%s",
        whatsapp_internal_host(),
        whatsapp_internal_port(),
    )
    log_path = os.path.join(msg_sender_dir, "whatsapp-sender.log")
    try:
        log_file = open(log_path, "a", encoding="utf-8")
        subprocess.Popen(
            ["node", "server.js"],
            cwd=msg_sender_dir,
            env=env,
            stdout=log_file,
            stderr=log_file,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if platform.system() == "Windows" else 0,
        )
        log_file.close()
    except Exception as exc:
        logger.error("Failed to start WhatsApp sender: %s", exc)


def should_autostart_whatsapp() -> bool:
    if not getattr(settings, "WHATSAPP_AUTO_START", True):
        return False
    if "runserver" in sys.argv or "dev" in sys.argv:
        run_main = os.environ.get("RUN_MAIN")
        return run_main == "true" or run_main is None
    if os.environ.get("GUNICORN_CMD_ARGS") or os.environ.get("SERVER_SOFTWARE", "").startswith("gunicorn"):
        return True
    return os.environ.get("WHATSAPP_AUTO_START", "").lower() == "true"
