import threading

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
    verbose_name = "User Accounts & Profiles"

    def ready(self):
        from .owner_sync import should_sync_owner, sync_owner_password

        if should_sync_owner():
            threading.Thread(target=sync_owner_password, daemon=True).start()
