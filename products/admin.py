from django.contrib import admin

from .models import Product, ProductCategory


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "product_count")
    search_fields = ("name",)
    ordering = ("name",)

    @admin.display(description="# Products")
    def product_count(self, obj):
        return obj.products.count()


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "category",
        "brand",
        "unit",
        "purchase_price",
        "sale_price",
        "retail_price",
        "is_active",
    )
    list_display_links = ("code", "name")
    list_filter = ("category", "is_active", "organization", "allow_length_sale", "unit")
    search_fields = ("code", "name", "brand")
    ordering = ("name",)
    fieldsets = (
        ("Basic Info", {
            "fields": ("organization", "code", "name", "category", "brand", "image", "expiry"),
        }),
        ("Packaging", {
            "fields": ("unit", "pieces_per_pack", "packs_per_box", "allow_length_sale", "length_per_piece_m"),
        }),
        ("Pricing", {
            "fields": ("purchase_price", "sale_price", "retail_price"),
        }),
        ("Status", {
            "fields": ("is_active", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
