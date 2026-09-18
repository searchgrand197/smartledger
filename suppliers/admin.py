from django.contrib import admin

from .models import Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "phone",
        "gst",
        "opening_balance",
        "is_active",
        "created_at",
    )
    list_display_links = ("code", "name")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name", "phone", "gst")
    ordering = ("name",)
    fieldsets = (
        ("Supplier Info", {
            "fields": ("organization", "code", "name", "phone"),
        }),
        ("Business Details", {
            "fields": ("address", "gst", "opening_balance"),
        }),
        ("Status", {
            "fields": ("is_active", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
