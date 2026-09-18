from django.db import models
from django.utils import timezone

from accounts.models import Organization
from billing.models import Bill
from core.managers import TenantManager
from customers.models import Customer


class Payment(models.Model):
    MODES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("bank", "Bank Transfer"),
        ("cheque", "Cheque"),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="payments", null=True, blank=True
    )
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="payments")
    bill = models.ForeignKey(Bill, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    mode = models.CharField(max_length=20, choices=MODES, default="cash")
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Customer Payment"
        verbose_name_plural = "Customer Payments"
