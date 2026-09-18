from django.contrib import admin
from django.utils.html import format_html

from .models import Bill, BillItem


class BillItemInline(admin.TabularInline):
    model = BillItem
    extra = 0
    fields = ("product", "quantity", "rate", "purchase_rate", "amount", "cost_amount", "profit")


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = (
        "bill_number",
        "customer",
        "bill_type",
        "payment_mode",
        "subtotal",
        "discount_amount",
        "total",
        "paid_amount",
        "due_amount",
        "is_cancelled",
        "created_at",
    )
    list_display_links = ("bill_number",)
    list_filter = ("bill_type", "payment_mode", "is_cancelled", "organization", "created_at")
    search_fields = ("bill_number", "customer__shop_name", "customer__code", "customer__phone")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    inlines = [BillItemInline]
    fieldsets = (
        ("Bill Info", {
            "fields": ("organization", "bill_number", "customer", "bill_type", "notes"),
        }),
        ("Amounts", {
            "fields": (
                "subtotal",
                "discount_amount",
                "discount_percent",
                "gst_rate",
                "gst_amount",
                "round_off",
                "total",
                "total_cost",
                "total_profit",
            ),
        }),
        ("Payment", {
            "fields": ("payment_mode", "paid_amount"),
        }),
        ("Status", {
            "fields": ("is_cancelled", "created_at", "updated_at"),
        }),
    )

    @admin.display(description="Due Amount")
    def due_amount(self, obj):
        due = obj.total - obj.paid_amount
        color = "red" if due > 0 else "green"
        return format_html('<span style="color:{}">{}</span>', color, f"₹{due:,.2f}")


@admin.register(BillItem)
class BillItemAdmin(admin.ModelAdmin):
    list_display = (
        "bill",
        "product",
        "quantity",
        "rate",
        "purchase_rate",
        "amount",
        "cost_amount",
        "profit",
    )
    list_filter = ("bill__bill_type", "bill__is_cancelled")
    search_fields = ("bill__bill_number", "product__name", "product__code")
    autocomplete_fields = ("product",)
