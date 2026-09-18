from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

from payments.models import Payment

from .models import Bill, BillItem


def _quantize_money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class MoneyRateField(serializers.Field):
    """Accepts rates with extra precision from UI math; stores 2 decimal places."""

    default_error_messages = {"invalid": "A valid rate is required."}

    def to_internal_value(self, data):
        if data is None or data == "":
            raise serializers.ValidationError(self.error_messages["invalid"])
        try:
            dec = Decimal(str(data))
        except Exception:
            raise serializers.ValidationError(self.error_messages["invalid"])
        if dec < 0:
            raise serializers.ValidationError("Rate cannot be negative.")
        quantized = _quantize_money(dec)
        if quantized > Decimal("9999999999.99"):
            raise serializers.ValidationError("Rate is too large.")
        return quantized

    def to_representation(self, value):
        return str(_quantize_money(value))


class BillPaymentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "amount", "mode", "reference", "notes", "created_at"]


class BillItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)

    class Meta:
        model = BillItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_code",
            "quantity",
            "rate",
            "purchase_rate",
            "amount",
            "cost_amount",
            "profit",
        ]


class BillItemWriteSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    rate = MoneyRateField()

    def validate_quantity(self, value):
        return int(value)


class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True, read_only=True)
    payments = BillPaymentSummarySerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.shop_name", read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    due_amount = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            "id",
            "bill_number",
            "customer",
            "customer_name",
            "customer_code",
            "subtotal",
            "discount_amount",
            "discount_percent",
            "gst_amount",
            "gst_rate",
            "round_off",
            "total",
            "paid_amount",
            "due_amount",
            "payment_mode",
            "total_cost",
            "total_profit",
            "notes",
            "is_cancelled",
            "items",
            "payments",
            "bill_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["bill_number", "total_cost", "total_profit", "created_at"]

    def get_due_amount(self, obj):
        return obj.total - obj.paid_amount


class BillListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.shop_name", read_only=True)
    due_amount = serializers.SerializerMethodField()
    has_returnable_items = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            "id",
            "bill_number",
            "customer",
            "customer_name",
            "total",
            "paid_amount",
            "due_amount",
            "payment_mode",
            "is_cancelled",
            "total_profit",
            "bill_type",
            "created_at",
            "has_returnable_items",
        ]

    def get_due_amount(self, obj):
        return obj.total - obj.paid_amount

    def get_has_returnable_items(self, obj):
        if not self.context.get("for_return"):
            return None
        from returns.services import bill_has_returnable_items

        return bill_has_returnable_items(obj)


class SimpleBillCreateSerializer(serializers.Serializer):
    """Quick cash bill for walk-in / simple customers (not parties)."""
    items = BillItemWriteSerializer(many=True)
    customer_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    customer_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    round_off = serializers.DecimalField(max_digits=8, decimal_places=2, default=0)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0, min_value=0)
    payment_mode = serializers.ChoiceField(choices=["cash", "upi", "credit", "partial"], default="cash")
    bill_number = serializers.CharField(required=False, allow_blank=True, max_length=30)
    bill_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one product.")
        return value


class BillCreateSerializer(serializers.Serializer):
    customer = serializers.IntegerField()
    items = BillItemWriteSerializer(many=True)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    round_off = serializers.DecimalField(max_digits=8, decimal_places=2, default=0)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0, min_value=0)
    payment_mode = serializers.ChoiceField(choices=["cash", "upi", "credit", "partial", "mixed"])
    notes = serializers.CharField(required=False, allow_blank=True)
    bill_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one product.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        paid = attrs.get("paid_amount", 0)
        if paid < 0:
            raise serializers.ValidationError({"paid_amount": "Paid amount cannot be negative."})
        bill_at = attrs.get("bill_at")
        if bill_at is not None:
            from django.utils import timezone

            if timezone.is_naive(bill_at):
                bill_at = timezone.make_aware(bill_at, timezone.get_current_timezone())
                attrs["bill_at"] = bill_at
            if bill_at > timezone.now():
                raise serializers.ValidationError({"bill_at": "Bill date/time cannot be in the future."})
        return attrs
