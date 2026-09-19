import logging
import os
import platform
import shutil
import socket
import subprocess
import sys
import time

from typing import Optional

from django.conf import settings

logger = logging.getLogger("messaging")

# A spawn claim older than this is treated as orphaned by a crashed process.
GATEWAY_SPAWN_LOCK_TTL_SEC = 120

# Last spawn/probe error, shown on the WhatsApp page when the Node process is down.
last_start_error = None


def whatsapp_internal_port() -> int:
    return int(getattr(settings, "WHATSAPP_INTERNAL_PORT", 8787))


def whatsapp_internal_host() -> str:
    return getattr(settings, "WHATSAPP_INTERNAL_HOST", "127.0.0.1")


def message_sender_dir() -> Optional[str]:
    candidates = [
        os.path.join(settings.BASE_DIR, "message-sender"),
        os.path.join(settings.BASE_DIR.parent, "message-sender"),
    ]
    for path in candidates:
        if os.path.isdir(path) and os.path.isfile(os.path.join(path, "server.js")):
            return path
    return None


def is_whatsapp_port_open() -> bool:
    host = whatsapp_internal_host()
    # 0.0.0.0 is a bind address, not a connect address.
    probe_host = "127.0.0.1" if host in ("0.0.0.0", "::") else host
    port = whatsapp_internal_port()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    try:
        sock.connect((probe_host, port))
        return True
    except (OSError, socket.timeout):
        return False
    finally:
        sock.close()


def _set_error(message: str) -> None:
    global last_start_error
    last_start_error = message
    logger.error(message)


def _node_executable() -> Optional[str]:
    return shutil.which("node") or shutil.which("nodejs")


def _npm_executable() -> Optional[str]:
    return shutil.which("npm")


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


def _ensure_node_modules(msg_sender_dir: str) -> bool:
    baileys = os.path.join(msg_sender_dir, "node_modules", "@whiskeysockets", "baileys")
    if os.path.isdir(baileys):
        return True
    npm = _npm_executable()
    if not npm:
        _set_error(
            "Node is installed but npm is missing. On the server run: apt install npm  "
            "then: cd message-sender && npm install"
        )
        return False
    logger.info("Installing WhatsApp sender dependencies in %s", msg_sender_dir)
    try:
        result = subprocess.run(
            [npm, "install", "--omit=dev"],
            cwd=msg_sender_dir,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except Exception as exc:
        _set_error(f"npm install failed: {exc}")
        return False
    if result.returncode != 0:
        _set_error(f"npm install failed: {(result.stderr or result.stdout or '')[-400:]}")
        return False
    return True


def start_whatsapp_sender() -> None:
    global last_start_error

    if not getattr(settings, "WHATSAPP_AUTO_START", True):
        return

    if is_whatsapp_port_open():
        last_start_error = None
        logger.info("WhatsApp sender already running on %s:%s", whatsapp_internal_host(), whatsapp_internal_port())
        return

    msg_sender_dir = message_sender_dir()
    if not msg_sender_dir:
        _set_error("WhatsApp sender folder (message-sender/server.js) was not found on this server.")
        return

    node = _node_executable()
    if not node:
        _set_error(
            "Node.js is not installed on this server, so WhatsApp cannot start. "
            "SSH in and install Node 20+, then run: cd message-sender && npm install && node server.js"
        )
        return

    if not _ensure_node_modules(msg_sender_dir):
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
            kwargs = {
                "cwd": msg_sender_dir,
                "env": env,
                "stdout": log_file,
                "stderr": log_file,
            }
            if platform.system() == "Windows":
                kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
            else:
                kwargs["start_new_session"] = True
            proc = subprocess.Popen([node, "server.js"], **kwargs)
        lock_file.write(str(proc.pid))
        last_start_error = None
    except Exception as exc:
        _set_error(f"Failed to start WhatsApp sender: {exc}")
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
    # Passenger, gunicorn, uwsgi, and other WSGI hosts should start the sender.
    return True


def ensure_whatsapp_sender_running(wait_seconds: float = 3.0) -> bool:
    """Start the sender if needed and wait briefly for the port to open."""
    if is_whatsapp_port_open():
        return True
    start_whatsapp_sender()
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        if is_whatsapp_port_open():
            return True
        time.sleep(0.4)
    return is_whatsapp_port_open()
