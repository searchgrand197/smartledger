from rest_framework import serializers

from products.serializers import ProductListSerializer

from .models import Purchase, PurchaseItem, SupplierPayment


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ["id", "product", "product_name", "product_code", "quantity", "unit_price", "amount"]


class PurchaseItemWriteSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "invoice_number",
            "purchase_date",
            "subtotal",
            "discount",
            "total",
            "paid_amount",
            "notes",
            "items",
            "created_at",
        ]


class PurchaseListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "invoice_number",
            "purchase_date",
            "total",
            "paid_amount",
            "created_at",
        ]


class PurchaseCreateSerializer(serializers.Serializer):
    supplier = serializers.IntegerField()
    invoice_number = serializers.CharField(required=False, allow_blank=True)
    purchase_date = serializers.DateField(required=False)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = PurchaseItemWriteSerializer(many=True)


class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = SupplierPayment
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "purchase",
            "amount",
            "mode",
            "reference",
            "notes",
            "created_at",
        ]
