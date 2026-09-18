from django.contrib import admin
from django.utils.html import format_html

from .models import Customer, PartyProductRate


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "shop_name",
        "owner_name",
        "phone",
        "area",
        "credit_limit",
        "is_wholesale",
        "is_active",
        "created_at",
    )
    list_display_links = ("code", "shop_name")
    list_filter = ("is_active", "is_wholesale", "organization", "area")
    search_fields = ("code", "shop_name", "owner_name", "phone", "gst")
    date_hierarchy = "created_at"
    ordering = ("shop_name",)
    fieldsets = (
        ("Basic Info", {
            "fields": ("organization", "code", "shop_name", "owner_name"),
        }),
        ("Contact", {
            "fields": ("phone", "address", "area", "gst"),
        }),
        ("Account", {
            "fields": ("opening_balance", "credit_limit", "portal_username"),
        }),
        ("Settings", {
            "fields": ("is_wholesale", "is_active", "notes"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


@admin.register(PartyProductRate)
class PartyProductRateAdmin(admin.ModelAdmin):
    list_display = ("customer", "product", "rate", "updated_at")
    list_filter = ("customer__organization",)
    search_fields = (
        "customer__shop_name",
        "customer__code",
        "product__name",
        "product__code",
    )
    autocomplete_fields = ("customer", "product")
    ordering = ("customer__shop_name", "product__name")
