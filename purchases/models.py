from decimal import Decimal

from django.db import models
from django.utils import timezone

from accounts.models import Organization
from core.managers import TenantManager
from core.utils import update_product_stock
from products.models import Product
from suppliers.models import Supplier


class Purchase(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="purchases", null=True, blank=True
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchases")
    invoice_number = models.CharField(max_length=50, blank=True)
    purchase_date = models.DateField(default=timezone.now)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-purchase_date"]
        verbose_name = "Purchase"
        verbose_name_plural = "Purchases"

    def recalculate(self):
        items = PurchaseItem.objects.filter(purchase=self)
        self.subtotal = sum(i.amount for i in items)
        self.total = self.subtotal - self.discount
        self.save(update_fields=["subtotal", "total"])


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "Purchase Item"
        verbose_name_plural = "Purchase Items"

    def save(self, *args, **kwargs):
        self.amount = Decimal(self.quantity) * self.unit_price
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            update_product_stock(
                self.product,
                self.quantity,
                movement_type="purchase",
                reference_id=self.purchase_id,
                reference_label=self.purchase.invoice_number or f"PO-{self.purchase_id}",
                notes=f"Purchase — {self.purchase.supplier.name}",
            )
            self.product.purchase_price = self.unit_price
            self.product.save(update_fields=["purchase_price", "updated_at"])
        self.purchase.recalculate()


class SupplierPayment(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="payments")
    purchase = models.ForeignKey(
        Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(
        max_length=20,
        choices=[("cash", "Cash"), ("upi", "UPI"), ("bank", "Bank"), ("cheque", "Cheque")],
        default="cash",
    )
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Supplier Payment"
        verbose_name_plural = "Supplier Payments"
