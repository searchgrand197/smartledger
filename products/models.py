from django.db import models
from django.utils import timezone

from accounts.models import Organization
from core.managers import TenantManager
from core.utils import next_sequence, stock_alert_level


class ProductCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Product Category"
        verbose_name_plural = "Product Categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="products", null=True, blank=True
    )
    code = models.CharField(max_length=20, editable=True)
    name = models.CharField(max_length=200, db_index=True)
    category = models.ForeignKey(
        ProductCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    brand = models.CharField(max_length=100, blank=True)
    image = models.ImageField(upload_to="products/", null=True, blank=True)
    unit = models.CharField(max_length=20, default="Pc")
    pieces_per_pack = models.PositiveIntegerField(default=1)
    packs_per_box = models.PositiveIntegerField(default=1)
    allow_length_sale = models.BooleanField(default=False)
    length_per_piece_m = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sale_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Wholesale / party price (inclusive)",
    )
    retail_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Walk-in / quick sale price (inclusive). If 0, uses wholesale price.",
    )
    current_stock = models.IntegerField(default=0)
    minimum_stock = models.IntegerField(
        default=0,
        help_text="Auto-set to 20% of stock when stock is added or increased.",
    )
    expiry = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["name"]
        unique_together = [["organization", "code"]]
        verbose_name = "Product"
        verbose_name_plural = "Products"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = next_sequence("PRD", Product, organization=self.organization)
        update_fields = kwargs.get("update_fields")
        if update_fields is None or "current_stock" in update_fields:
            if not self.minimum_stock:
                previous_stock = None
                if self.pk:
                    previous_stock = (
                        Product.objects.filter(pk=self.pk).values_list("current_stock", flat=True).first()
                    )
                if previous_stock is None or self.current_stock > previous_stock:
                    self.minimum_stock = stock_alert_level(self.current_stock)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def is_low_stock(self):
        return self.current_stock <= self.minimum_stock

    def get_retail_price(self):
        """Price for customer / walk-in quick sale."""
        if self.retail_price and self.retail_price > 0:
            return self.retail_price
        return self.sale_price

    @property
    def pieces_per_box(self):
        return max(1, self.pieces_per_pack) * max(1, self.packs_per_box)


class StockMovement(models.Model):
    MOVEMENT_TYPES = [
        ("opening", "Opening stock"),
        ("sale", "Sale"),
        ("return", "Return"),
        ("return_cancel", "Return Cancelled"),
        ("cancel", "Bill Cancel"),
        ("purchase", "Purchase"),
        ("adjustment", "Adjustment"),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    quantity_delta = models.IntegerField()
    quantity_after = models.IntegerField()
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    reference_id = models.IntegerField(null=True, blank=True)
    reference_label = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_movements"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Stock Movement"
        verbose_name_plural = "Stock Movements"
