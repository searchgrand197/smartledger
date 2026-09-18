from django.contrib import admin

from .models import Purchase, PurchaseItem, SupplierPayment


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0
    fields = ("product", "quantity", "unit_price", "amount")


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "supplier",
        "invoice_number",
        "purchase_date",
        "subtotal",
        "discount",
        "total",
        "paid_amount",
        "created_at",
    )
    list_display_links = ("id", "invoice_number")
    list_filter = ("supplier", "organization", "purchase_date")
    search_fields = ("invoice_number", "supplier__name", "supplier__code", "notes")
    date_hierarchy = "purchase_date"
    ordering = ("-purchase_date",)
    inlines = [PurchaseItemInline]
    fieldsets = (
        ("Purchase Info", {
            "fields": ("organization", "supplier", "invoice_number", "purchase_date"),
        }),
        ("Amounts", {
            "fields": ("subtotal", "discount", "total", "paid_amount"),
        }),
        ("Notes", {
            "fields": ("notes", "created_at"),
        }),
    )


@admin.register(PurchaseItem)
class PurchaseItemAdmin(admin.ModelAdmin):
    list_display = ("purchase", "product", "quantity", "unit_price", "amount")
    list_filter = ("purchase__supplier",)
    search_fields = ("purchase__invoice_number", "product__name", "product__code")


@admin.register(SupplierPayment)
class SupplierPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "supplier",
        "purchase",
        "amount",
        "mode",
        "reference",
        "created_at",
    )
    list_display_links = ("id", "supplier")
    list_filter = ("mode", "supplier", "created_at")
    search_fields = ("supplier__name", "supplier__code", "purchase__invoice_number", "reference")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
