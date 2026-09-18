from rest_framework import serializers

from .models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    pending_payment = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            "id",
            "code",
            "name",
            "phone",
            "address",
            "gst",
            "opening_balance",
            "is_active",
            "pending_payment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["code", "created_at", "updated_at"]

    def validate_phone(self, value):
        import re
        clean_phone = re.sub(r'\D', '', value)
        if len(clean_phone) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        return clean_phone

    def get_pending_payment(self, obj):
        from .services import supplier_pending

        return supplier_pending(obj)
