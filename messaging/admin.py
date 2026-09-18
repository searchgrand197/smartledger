from django.contrib import admin

from .models import MessageQueue


@admin.register(MessageQueue)
class MessageQueueAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "message_type",
        "recipient",
        "customer",
        "bill",
        "status",
        "retry_count",
        "max_retries",
        "created_at",
        "updated_at",
    )
    list_display_links = ("id", "recipient")
    list_filter = ("message_type", "status", "organization", "created_at")
    search_fields = (
        "recipient",
        "caption",
        "customer__shop_name",
        "customer__phone",
        "bill__bill_number",
    )
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    fieldsets = (
        ("Message Details", {
            "fields": ("organization", "message_type", "recipient", "caption", "file_path"),
        }),
        ("Linked Records", {
            "fields": ("customer", "bill"),
        }),
        ("Status & Retries", {
            "fields": ("status", "retry_count", "max_retries", "error_message"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    actions = ["mark_pending", "mark_failed"]

    @admin.action(description="Reset selected messages to Pending")
    def mark_pending(self, request, queryset):
        updated = queryset.update(status="pending", retry_count=0, error_message=None)
        self.message_user(request, f"{updated} message(s) reset to Pending.")

    @admin.action(description="Mark selected messages as Failed")
    def mark_failed(self, request, queryset):
        updated = queryset.update(status="failed")
        self.message_user(request, f"{updated} message(s) marked as Failed.")
