from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from .models import Organization, SupportLoginLog, UserProfile

admin.site.unregister(User)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "is_staff", "is_superuser", "ledger_name"]
    inlines = [UserProfileInline]

    @admin.display(description="Ledger")
    def ledger_name(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.organization.name if profile else "—"


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active", "created_at"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "is_active"]
    list_filter = ["role", "organization", "is_active"]


@admin.register(SupportLoginLog)
class SupportLoginLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "support_admin", "shop_user", "organization", "ip_address"]
    list_filter = ["created_at"]
    readonly_fields = ["shop_user", "support_admin", "organization", "created_at", "ip_address"]
