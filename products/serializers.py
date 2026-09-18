from rest_framework import serializers

from core.utils import update_product_stock

from .models import Product, ProductCategory, StockMovement

MOVEMENT_LABELS = {
    "opening": "Opening stock",
    "sale": "Sale",
    "return": "Sales return",
    "return_cancel": "Return cancelled",
    "cancel": "Bill cancelled",
    "purchase": "Purchase",
    "adjustment": "Adjustment",
}

REFERENCE_TYPES = {
    "opening": None,
    "sale": "bill",
    "cancel": "bill",
    "return": "return",
    "return_cancel": "return",
    "purchase": "purchase",
    "adjustment": None,
}


def party_names_for_movements(movements) -> dict[tuple[str, int], str]:
    """Bulk-resolve customer/supplier names for stock movement rows."""
    from billing.models import Bill
    from purchases.models import Purchase
    from returns.models import SalesReturn

    names: dict[tuple[str, int], str] = {}
    bill_ids = {m.reference_id for m in movements if m.movement_type in ("sale", "cancel") and m.reference_id}
    return_ids = {m.reference_id for m in movements if m.movement_type in ("return", "return_cancel") and m.reference_id}
    purchase_ids = {m.reference_id for m in movements if m.movement_type == "purchase" and m.reference_id}

    for bill in Bill.objects.filter(pk__in=bill_ids).select_related("customer"):
        if bill.customer_id:
            names[("bill", bill.pk)] = bill.customer.shop_name or bill.customer.owner_name

    for sales_return in SalesReturn.objects.filter(pk__in=return_ids).select_related("customer"):
        if sales_return.customer_id:
            names[("return", sales_return.pk)] = sales_return.customer.shop_name or sales_return.customer.owner_name

    for purchase in Purchase.objects.filter(pk__in=purchase_ids).select_related("supplier"):
        if purchase.supplier_id:
            names[("purchase", purchase.pk)] = purchase.supplier.name

    return names


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "name"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    profit_margin = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "category",
            "category_name",
            "brand",
            "image",
            "unit",
            "pieces_per_pack",
            "packs_per_box",
            "allow_length_sale",
            "length_per_piece_m",
            "purchase_price",
            "sale_price",
            "retail_price",
            "current_stock",
            "minimum_stock",
            "expiry",
            "is_low_stock",
            "profit_margin",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["code", "created_at", "updated_at", "is_active"]

    def get_profit_margin(self, obj):
        return float(obj.sale_price - obj.purchase_price)

    def create(self, validated_data):
        instance = super().create(validated_data)
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        StockMovement.objects.create(
            product=instance,
            quantity_delta=instance.current_stock,
            quantity_after=instance.current_stock,
            movement_type="opening",
            reference_label="Item added",
            notes="Opening stock when item was first added",
            created_by=user,
        )
        return instance

    def update(self, instance, validated_data):
        new_stock = validated_data.pop("current_stock", None)
        instance = super().update(instance, validated_data)
        if new_stock is not None and new_stock != instance.current_stock:
            delta = int(new_stock) - int(instance.current_stock)
            request = self.context.get("request")
            update_product_stock(
                instance,
                delta,
                movement_type="adjustment",
                notes="Manual stock update from inventory",
                user=request.user if request and request.user.is_authenticated else None,
            )
            instance.refresh_from_db()
        return instance


class StockMovementSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)
    movement_label = serializers.SerializerMethodField()
    reference_type = serializers.SerializerMethodField()
    party_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product_id",
            "product_code",
            "product_name",
            "product_unit",
            "quantity_delta",
            "quantity_after",
            "movement_type",
            "movement_label",
            "reference_type",
            "reference_id",
            "reference_label",
            "party_name",
            "notes",
            "created_by_name",
            "created_at",
        ]

    def get_movement_label(self, obj):
        if obj.movement_type == "adjustment" and obj.notes == "Opening stock":
            return MOVEMENT_LABELS["opening"]
        return MOVEMENT_LABELS.get(obj.movement_type, obj.movement_type.replace("_", " ").title())

    def get_reference_type(self, obj):
        return REFERENCE_TYPES.get(obj.movement_type)

    def get_party_name(self, obj):
        names = self.context.get("party_names") or {}
        if obj.movement_type in ("sale", "cancel") and obj.reference_id:
            return names.get(("bill", obj.reference_id), "")
        if obj.movement_type in ("return", "return_cancel") and obj.reference_id:
            return names.get(("return", obj.reference_id), "")
        if obj.movement_type == "purchase" and obj.reference_id:
            return names.get(("purchase", obj.reference_id), "")
        return ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_username()
        return ""


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_alert_at = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "category_name",
            "brand",
            "image",
            "unit",
            "pieces_per_pack",
            "packs_per_box",
            "allow_length_sale",
            "length_per_piece_m",
            "purchase_price",
            "sale_price",
            "retail_price",
            "current_stock",
            "minimum_stock",
            "expiry",
            "stock_alert_at",
            "is_low_stock",
        ]

    def get_stock_alert_at(self, obj):
        return obj.minimum_stock if obj.minimum_stock > 0 else None
