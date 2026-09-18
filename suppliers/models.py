from django.db import models
from django.utils import timezone

from accounts.models import Organization
from core.managers import TenantManager
from core.utils import next_sequence


class Supplier(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="suppliers", null=True, blank=True
    )
    code = models.CharField(max_length=20, editable=True)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    address = models.TextField(blank=True)
    gst = models.CharField(max_length=20, blank=True)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["name"]
        unique_together = [["organization", "code"]]
        verbose_name = "Supplier"
        verbose_name_plural = "Suppliers"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = next_sequence("SUP", Supplier, organization=self.organization)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"
