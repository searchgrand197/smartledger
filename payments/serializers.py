from decimal import Decimal

from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.shop_name", read_only=True)
    bill_number = serializers.CharField(source="bill.bill_number", read_only=True, allow_null=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "customer",
            "customer_name",
            "bill",
            "bill_number",
            "amount",
            "discount_amount",
            "mode",
            "reference",
            "notes",
            "reminder_sent",
            "created_at",
        ]


class PaymentCreateSerializer(serializers.Serializer):
    customer = serializers.IntegerField()
    bill = serializers.IntegerField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    discount_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, default=Decimal("0")
    )
    mode = serializers.ChoiceField(choices=["cash", "upi", "bank", "cheque"])
    reference = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        amount = attrs.get("amount") or Decimal("0")
        discount = attrs.get("discount_amount") or Decimal("0")
        if amount + discount <= 0:
            raise serializers.ValidationError(
                "Enter amount received and/or discount — at least one must be greater than zero."
            )
        return attrs


class PaymentUpdateSerializer(serializers.Serializer):
    customer = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False)
    discount_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False
    )
    mode = serializers.ChoiceField(choices=["cash", "upi", "bank", "cheque"], required=False)
    reference = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField(required=False, allow_null=True)
