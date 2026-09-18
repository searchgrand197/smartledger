from django.db import models
from django.utils import timezone
from accounts.models import Organization
from core.managers import TenantManager


class MessageQueue(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    MESSAGE_CHANNELS = [
        ("whatsapp", "WhatsApp"),
        ("sms", "SMS"),
    ]

    # Tenancy Support
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE, 
        related_name="message_queue", 
        null=True, 
        blank=True
    )
    
    # Audit Links
    customer = models.ForeignKey(
        "customers.Customer", 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="messages"
    )
    bill = models.ForeignKey(
        "billing.Bill", 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="messages"
    )

    # Core message payload
    message_type = models.CharField(max_length=20, choices=MESSAGE_CHANNELS, default="whatsapp")
    recipient = models.CharField(max_length=30)
    caption = models.TextField(blank=True)
    file_path = models.CharField(max_length=500, blank=True, null=True)

    # Lifecycle state
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    # Managers
    objects = TenantManager()         # Tenant-scoped (for HTTP views)
    all_objects = models.Manager()      # Global-scoped (for background tasks/commands)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "retry_count"]),
            models.Index(fields=["created_at"]),
        ]
        verbose_name = "Queued Message"
        verbose_name_plural = "Queued Messages"

    def __str__(self):
        return f"{self.message_type} to {self.recipient} ({self.status})"
