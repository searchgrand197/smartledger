from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Organization
from billing.models import Bill, BillItem
from core.managers import TenantManager
from customers.models import Customer
from products.models import Product


class SalesReturn(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="sales_returns", null=True, blank=True
    )
    RETURN_TYPES = [
        ("refund", "Refund"),
        ("credit_note", "Credit Note"),
        ("exchange", "Exchange"),
    ]
    REFUND_MODES = [
        ("ledger_credit", "Ledger Credit"),
        ("cash", "Cash Refund"),
        ("upi", "UPI Refund"),
        ("store_credit", "Store Credit"),
    ]

    return_number = models.CharField(max_length=30, editable=True)
    return_date = models.DateTimeField(default=timezone.now)
    original_bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name="sales_returns")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="sales_returns")
    return_type = models.CharField(max_length=20, choices=RETURN_TYPES, default="refund")
    refund_mode = models.CharField(max_length=20, choices=REFUND_MODES, default="ledger_credit")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Cash/UPI actually refunded to customer",
    )
    exchange_bill = models.ForeignKey(
        Bill,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exchange_returns",
    )
    exchange_new_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    exchange_net_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Positive = customer pays; negative = credit to customer",
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_returns_created",
    )
    is_deleted = models.BooleanField(default=False)
    is_cancelled = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-return_date", "-id"]
        unique_together = [["organization", "return_number"]]
        verbose_name = "Sales Return"
        verbose_name_plural = "Sales Returns"

    def save(self, *args, **kwargs):
        if not self.return_number:
            prefix = "SR"
            last = (
                SalesReturn.all_objects.filter(
                    organization=self.organization, return_number__startswith=prefix
                )
                .order_by("-id")
                .first()
            )
            if last:
                try:
                    num = int(last.return_number.split("-")[-1])
                except ValueError:
                    num = 0
            else:
                num = 0
            self.return_number = f"{prefix}-{num + 1:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.return_number


class SalesReturnItem(models.Model):
    sales_return = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name="items")
    bill_item = models.ForeignKey(BillItem, on_delete=models.PROTECT, related_name="return_items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    original_rate = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "Sales Return Item"
        verbose_name_plural = "Sales Return Items"

    def save(self, *args, **kwargs):
        self.amount = Decimal(self.quantity) * self.original_rate
        super().save(*args, **kwargs)


class StoreCreditBalance(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="store_credit")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.customer.code}: {self.balance}"

    class Meta:
        verbose_name = "Store Credit Balance"
        verbose_name_plural = "Store Credit Balances"


class StoreCreditTransaction(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="store_credit_txns")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    sales_return = models.ForeignKey(
        SalesReturn, on_delete=models.SET_NULL, null=True, blank=True, related_name="store_credit_txns"
    )
    bill = models.ForeignKey(Bill, on_delete=models.SET_NULL, null=True, blank=True, related_name="store_credit_txns")
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Store Credit Transaction"
        verbose_name_plural = "Store Credit Transactions"
