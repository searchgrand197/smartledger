from decimal import Decimal

from django.db import models
from django.utils import timezone

from accounts.models import Organization
from core.managers import TenantManager
from core.utils import next_sequence


class Customer(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="customers", null=True, blank=True
    )
    code = models.CharField(max_length=20, editable=True)
    shop_name = models.CharField(max_length=200)
    owner_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    gst = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    area = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    portal_username = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        unique=True,
        help_text="Optional login username for customer portal (same style as shop owner).",
    )
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    is_wholesale = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["shop_name"]
        unique_together = [["organization", "code"]]
        verbose_name = "Customer"
        verbose_name_plural = "Customers"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = next_sequence("CUS", Customer, organization=self.organization)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.shop_name}"

    @property
    def current_due(self) -> Decimal:
        from ledger.services import get_customer_balance

        return get_customer_balance(self)


class PartyProductRate(models.Model):
    """Fixed rate for a product for one party (overrides global sale price when set)."""

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="product_rates")
    product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="party_rates")
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [("customer", "product")]
        ordering = ["product__name"]
        verbose_name = "Party Product Rate"
        verbose_name_plural = "Party Product Rates"

    def __str__(self):
        return f"{self.customer.code} / {self.product.name} @ {self.rate}"
