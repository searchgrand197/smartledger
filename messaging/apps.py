import threading

from django.apps import AppConfig

from .whatsapp_runtime import should_autostart_whatsapp, start_whatsapp_sender


class MessagingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "messaging"
    verbose_name = "WhatsApp Messaging"

    def ready(self):
        if should_autostart_whatsapp():
            thread = threading.Thread(target=start_whatsapp_sender, daemon=True)
            thread.start()
