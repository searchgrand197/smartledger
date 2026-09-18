from django.contrib import admin

from .models import BusinessSettings


@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "business_name",
        "organization",
        "phone",
        "gst_number",
        "invoice_prefix",
        "gst_enabled",
        "setup_completed",
        "updated_at",
    )
    list_filter = ("gst_enabled", "setup_completed", "dark_mode", "auto_backup")
    search_fields = ("business_name", "owner_name", "gst_number", "phone")
    fieldsets = (
        ("Business Identity", {
            "fields": ("organization", "business_name", "owner_name", "logo"),
        }),
        ("Contact & GST", {
            "fields": ("phone", "email", "address", "gst_number", "factory_details"),
        }),
        ("Invoice Settings", {
            "fields": ("invoice_prefix", "invoice_footer", "gst_enabled", "default_gst_rate"),
        }),
        ("Customer Portal Labels", {
            "fields": (
                "home_title",
                "home_subtitle",
                "wholesale_option_title",
                "wholesale_option_desc",
                "customer_option_title",
                "customer_option_desc",
            ),
        }),
        ("Preferences", {
            "fields": ("dark_mode", "auto_backup", "setup_completed", "updated_at"),
        }),
    )
