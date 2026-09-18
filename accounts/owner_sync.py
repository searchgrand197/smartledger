import logging
import os
import sys

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection

logger = logging.getLogger("accounts")


def should_sync_owner() -> bool:
    if "migrate" in sys.argv or "makemigrations" in sys.argv:
        return False
    if "runserver" in sys.argv or "dev" in sys.argv:
        run_main = os.environ.get("RUN_MAIN")
        return run_main == "true" or run_main is None
    if os.environ.get("GUNICORN_CMD_ARGS") or os.environ.get("SERVER_SOFTWARE", "").startswith("gunicorn"):
        return True
    return os.environ.get("SYNC_OWNER_PASSWORD", "").lower() == "true"


def sync_owner_password() -> None:
    """Keep the default owner password aligned with OWNER_PASSWORD in .env."""
    if not should_sync_owner():
        return

    username = getattr(settings, "OWNER_USERNAME", "owner")
    password = getattr(settings, "OWNER_PASSWORD", "")
    if not password:
        return

    try:
        if "accounts_user" not in connection.introspection.table_names():
            return
    except Exception:
        return

    User = get_user_model()
    try:
        user = User.objects.filter(username=username).first()
        if user is None:
            return
        if user.check_password(password):
            return
        user.set_password(password)
        user.save()
        logger.info("Synced owner password for user '%s' from OWNER_PASSWORD setting.", username)
    except Exception as exc:
        logger.warning("Could not sync owner password: %s", exc)
