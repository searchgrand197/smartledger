from rest_framework import serializers

from .models import BusinessSettings


class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSettings
        fields = [
            "id",
            "owner_name",
            "business_name",
            "logo",
            "address",
            "phone",
            "factory_details",
            "email",
            "gst_number",
            "invoice_prefix",
            "invoice_footer",
            "gst_enabled",
            "default_gst_rate",
            "dark_mode",
            "auto_backup",
            "home_title",
            "home_subtitle",
            "wholesale_option_title",
            "wholesale_option_desc",
            "customer_option_title",
            "customer_option_desc",
            "setup_completed",
            "updated_at",
        ]
        read_only_fields = ["setup_completed"]
