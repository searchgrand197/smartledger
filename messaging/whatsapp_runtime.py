import logging
import os
import platform
import socket
import subprocess
import sys
import time

from django.conf import settings

logger = logging.getLogger("messaging")

# A spawn claim older than this is treated as orphaned by a crashed process.
GATEWAY_SPAWN_LOCK_TTL_SEC = 120


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


def _acquire_spawn_lock(msg_sender_dir: str):
    """
    Claim the exclusive right to spawn the gateway.

    Returns an open file object on success, or None if another process already
    holds the claim. O_CREAT|O_EXCL is atomic, which closes the race where two
    workers both observe a closed port and both spawn a competing gateway.
    """
    lock_path = os.path.join(msg_sender_dir, ".gateway-spawn.lock")
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        # Reclaim the lock if it was orphaned by a process that died without
        # cleaning up, otherwise the gateway could never start again.
        try:
            if is_whatsapp_port_open():
                return None
            if (time.time() - os.path.getmtime(lock_path)) < GATEWAY_SPAWN_LOCK_TTL_SEC:
                return None
            os.unlink(lock_path)
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except OSError:
            return None
    except OSError as exc:
        logger.warning("Could not create gateway spawn lock: %s", exc)
        return None
    return os.fdopen(fd, "w")


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

    lock_file = _acquire_spawn_lock(msg_sender_dir)
    if lock_file is None:
        logger.info("Another process is already starting the WhatsApp sender; skipping.")
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
        with open(log_path, "a", encoding="utf-8") as log_file:
            proc = subprocess.Popen(
                ["node", "server.js"],
                cwd=msg_sender_dir,
                env=env,
                stdout=log_file,
                stderr=log_file,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if platform.system() == "Windows" else 0,
            )
        lock_file.write(str(proc.pid))
    except Exception as exc:
        logger.error("Failed to start WhatsApp sender: %s", exc)
    finally:
        lock_file.close()


def should_autostart_whatsapp() -> bool:
    if not getattr(settings, "WHATSAPP_AUTO_START", True):
        return False
    if "runserver" in sys.argv or "dev" in sys.argv:
        # runserver forks: the autoreloader parent has RUN_MAIN unset while the
        # child that actually serves has RUN_MAIN="true". Starting in both spawns
        # two gateways that then fight over the same WhatsApp session, so only the
        # serving process may start one. With --noreload there is no fork at all.
        if "--noreload" in sys.argv:
            return True
        return os.environ.get("RUN_MAIN") == "true"
    if os.environ.get("GUNICORN_CMD_ARGS") or os.environ.get("SERVER_SOFTWARE", "").startswith("gunicorn"):
        return True
    return os.environ.get("WHATSAPP_AUTO_START", "").lower() == "true"
