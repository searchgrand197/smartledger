from rest_framework import serializers

from .models import Customer, PartyProductRate


class CustomerSerializer(serializers.ModelSerializer):
    current_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "code",
            "shop_name",
            "owner_name",
            "phone",
            "gst",
            "address",
            "area",
            "notes",
            "portal_username",
            "opening_balance",
            "credit_limit",
            "is_active",
            "is_wholesale",
            "current_due",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["code", "current_due", "created_at", "updated_at"]
        extra_kwargs = {"portal_username": {"required": False}}

    def validate_phone(self, value):
        import re
        clean_phone = re.sub(r'\D', '', value)
        if len(clean_phone) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        return clean_phone


class CustomerListSerializer(serializers.ModelSerializer):
    current_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "code",
            "shop_name",
            "owner_name",
            "phone",
            "area",
            "opening_balance",
            "credit_limit",
            "current_due",
            "is_active",
            "is_wholesale",
        ]


class PartyProductRateSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    global_rate = serializers.DecimalField(
        source="product.sale_price", max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = PartyProductRate
        fields = ["id", "product", "product_name", "product_code", "global_rate", "rate", "updated_at"]
        read_only_fields = ["id", "product_name", "product_code", "global_rate", "updated_at"]


class PartyProductRateWriteSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    rate = serializers.DecimalField(max_digits=10, decimal_places=2)
