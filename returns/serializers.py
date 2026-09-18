from rest_framework import serializers

from .models import SalesReturn, SalesReturnItem


class SalesReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)

    class Meta:
        model = SalesReturnItem
        fields = [
            "id",
            "bill_item",
            "product",
            "product_name",
            "product_code",
            "quantity",
            "original_rate",
            "amount",
            "reason",
        ]


class SalesReturnItemCreateSerializer(serializers.Serializer):
    bill_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ExchangeItemSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    rate = serializers.DecimalField(max_digits=10, decimal_places=2)


class BillReturnBatchEntrySerializer(serializers.Serializer):
    bill_id = serializers.IntegerField()
    items = SalesReturnItemCreateSerializer(many=True)


class SalesReturnCreateSerializer(serializers.Serializer):
    bill_id = serializers.IntegerField(required=False)
    return_type = serializers.ChoiceField(choices=SalesReturn.RETURN_TYPES)
    refund_mode = serializers.ChoiceField(choices=SalesReturn.REFUND_MODES, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = SalesReturnItemCreateSerializer(many=True, required=False)
    bills = BillReturnBatchEntrySerializer(many=True, required=False)
    exchange_items = ExchangeItemSerializer(many=True, required=False)

    def validate(self, data):
        bills = data.get("bills")
        bill_id = data.get("bill_id")
        items = data.get("items")
        if bills:
            if bill_id is not None:
                raise serializers.ValidationError("Use either bill_id or bills, not both.")
            if not bills:
                raise serializers.ValidationError("Add at least one bill.")
            has_items = any(entry.get("items") for entry in bills)
            if not has_items:
                raise serializers.ValidationError("Each bill must include return items.")
        elif bill_id is None or not items:
            raise serializers.ValidationError("bill_id and items are required when bills is omitted.")
        return data


class SalesReturnListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.shop_name", read_only=True)
    original_bill_number = serializers.CharField(source="original_bill.bill_number", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesReturn
        fields = [
            "id",
            "return_number",
            "return_date",
            "original_bill",
            "original_bill_number",
            "customer",
            "customer_name",
            "return_type",
            "refund_mode",
            "total",
            "refund_paid",
            "exchange_net_amount",
            "is_cancelled",
            "created_by_name",
            "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ""


class SalesReturnSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.shop_name", read_only=True)
    original_bill_number = serializers.CharField(source="original_bill.bill_number", read_only=True)
    exchange_bill_number = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    return_type_label = serializers.CharField(source="get_return_type_display", read_only=True)
    refund_mode_label = serializers.CharField(source="get_refund_mode_display", read_only=True)
    items = SalesReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = SalesReturn
        fields = [
            "id",
            "return_number",
            "return_date",
            "original_bill",
            "original_bill_number",
            "customer",
            "customer_name",
            "return_type",
            "return_type_label",
            "refund_mode",
            "refund_mode_label",
            "subtotal",
            "total",
            "refund_paid",
            "exchange_bill",
            "exchange_bill_number",
            "exchange_new_value",
            "exchange_net_amount",
            "notes",
            "is_cancelled",
            "created_by_name",
            "created_at",
            "items",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ""

    def get_exchange_bill_number(self, obj):
        if obj.exchange_bill:
            return obj.exchange_bill.bill_number
        return ""


class BillReturnEligibilitySerializer(serializers.Serializer):
    bill_id = serializers.IntegerField()
    bill_number = serializers.CharField()
    customer_name = serializers.CharField()
    bill_type = serializers.CharField()
    items = serializers.ListField()
