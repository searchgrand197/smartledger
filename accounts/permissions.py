from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """Only Django superusers (platform operators) may manage shops."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser and user.is_active)
