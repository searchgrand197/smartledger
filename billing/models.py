from decimal import Decimal

from django.db import models
from django.utils import timezone

from accounts.models import Organization
from core.managers import TenantManager
from core.utils import update_product_stock
from customers.models import Customer
from products.models import Product


class Bill(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="bills", null=True, blank=True
    )
    PAYMENT_MODES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("credit", "Credit"),
        ("partial", "Partial"),
        ("mixed", "Mixed"),
    ]

    bill_number = models.CharField(max_length=30, editable=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="bills")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODES, default="cash")
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    bill_type = models.CharField(
        max_length=10,
        choices=[("party", "Party / Ledger"), ("simple", "Simple Customer")],
        default="party",
    )
    is_cancelled = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["organization", "bill_number"]]
        verbose_name = "Customer Bill"
        verbose_name_plural = "Customer Bills"

    def save(self, *args, **kwargs):
        if not self.bill_number:
            from business.models import BusinessSettings

            prefix = BusinessSettings.load(self.organization).invoice_prefix or "BILL"
            last = (
                Bill.all_objects.filter(organization=self.organization, bill_number__startswith=prefix)
                .order_by("-id")
                .first()
            )
            if last:
                try:
                    num = int(last.bill_number.split("-")[-1])
                except ValueError:
                    num = 0
            else:
                num = 0
            self.bill_number = f"{prefix}-{num + 1:04d}"
        super().save(*args, **kwargs)

    def recalculate(self):
        items = BillItem.objects.filter(bill=self).select_related("product")
        self.subtotal = sum(i.amount for i in items)
        self.total_cost = sum(i.cost_amount for i in items)
        if self.discount_percent and self.discount_percent > 0:
            after_discount = self.subtotal * (Decimal("1") - self.discount_percent / Decimal("100"))
        else:
            after_discount = self.subtotal - self.discount_amount
        if after_discount < 0:
            after_discount = Decimal("0")
        # Prices are tax-inclusive; no separate GST line on bills
        self.gst_rate = Decimal("0")
        self.gst_amount = Decimal("0")
        self.total = after_discount + self.round_off
        self.total_profit = self.total - self.total_cost
        self.save(
            update_fields=[
                "subtotal",
                "total_cost",
                "total_profit",
                "gst_amount",
                "total",
                "updated_at",
            ]
        )


class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    cost_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Bill Item"
        verbose_name_plural = "Bill Items"

    def save(self, *args, **kwargs):
        self.amount = Decimal(self.quantity) * self.rate
        self.purchase_rate = self.product.purchase_price
        self.cost_amount = Decimal(self.quantity) * self.purchase_rate
        self.profit = self.amount - self.cost_amount
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            update_product_stock(
                self.product,
                -self.quantity,
                movement_type="sale",
                reference_id=self.bill_id,
                reference_label=self.bill.bill_number,
                notes=f"Sale — {self.bill.bill_number}",
            )
        self.bill.recalculate()
