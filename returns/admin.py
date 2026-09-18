from django.contrib import admin
from django.utils.html import format_html

from .models import SalesReturn, SalesReturnItem, StoreCreditBalance, StoreCreditTransaction


class SalesReturnItemInline(admin.TabularInline):
    model = SalesReturnItem
    extra = 0
    fields = ("product", "bill_item", "quantity", "original_rate", "amount", "reason")


@admin.register(SalesReturn)
class SalesReturnAdmin(admin.ModelAdmin):
    list_display = (
        "return_number",
        "customer",
        "original_bill",
        "return_type",
        "refund_mode",
        "total",
        "refund_paid",
        "is_cancelled",
        "return_date",
    )
    list_display_links = ("return_number",)
    list_filter = ("return_type", "refund_mode", "is_cancelled", "organization", "return_date")
    search_fields = (
        "return_number",
        "customer__shop_name",
        "customer__code",
        "original_bill__bill_number",
    )
    date_hierarchy = "return_date"
    ordering = ("-return_date",)
    inlines = [SalesReturnItemInline]
    fieldsets = (
        ("Return Info", {
            "fields": ("organization", "return_number", "return_date", "customer", "original_bill", "created_by"),
        }),
        ("Type & Settlement", {
            "fields": ("return_type", "refund_mode", "refund_paid"),
        }),
        ("Amounts", {
            "fields": ("subtotal", "total", "exchange_bill", "exchange_new_value", "exchange_net_amount"),
        }),
        ("Status", {
            "fields": ("notes", "is_cancelled", "is_deleted", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


@admin.register(SalesReturnItem)
class SalesReturnItemAdmin(admin.ModelAdmin):
    list_display = (
        "sales_return",
        "product",
        "quantity",
        "original_rate",
        "amount",
        "reason",
    )
    list_filter = ("sales_return__return_type",)
    search_fields = (
        "sales_return__return_number",
        "product__name",
        "product__code",
        "reason",
    )


@admin.register(StoreCreditBalance)
class StoreCreditBalanceAdmin(admin.ModelAdmin):
    list_display = ("customer", "balance", "updated_at")
    search_fields = ("customer__shop_name", "customer__code")
    ordering = ("-balance",)


@admin.register(StoreCreditTransaction)
class StoreCreditTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "customer",
        "amount",
        "balance_after",
        "sales_return",
        "bill",
        "created_by",
        "created_at",
    )
    list_filter = ("created_at",)
    search_fields = (
        "customer__shop_name",
        "customer__code",
        "sales_return__return_number",
        "bill__bill_number",
        "notes",
    )
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False  # System-generated only

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
