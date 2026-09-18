from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer",
        "bill",
        "amount",
        "mode",
        "reference",
        "reminder_sent",
        "created_at",
    )
    list_display_links = ("id", "customer")
    list_filter = ("mode", "reminder_sent", "organization", "created_at")
    search_fields = (
        "customer__shop_name",
        "customer__code",
        "customer__phone",
        "bill__bill_number",
        "reference",
    )
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    autocomplete_fields = ("customer",)
    fieldsets = (
        ("Payment Info", {
            "fields": ("organization", "customer", "bill", "amount", "mode", "reference"),
        }),
        ("Notes & Status", {
            "fields": ("notes", "reminder_sent", "created_at"),
        }),
    )
