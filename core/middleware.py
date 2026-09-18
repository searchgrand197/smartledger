from core.tenant import get_user_organization, set_current_organization


def _authenticate_jwt_user(request):
    """DRF JWT runs in views only; resolve user here so tenant scope works in middleware."""
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        return user
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        result = JWTAuthentication().authenticate(request)
        if result:
            jwt_user, _token = result
            request.user = jwt_user
            return jwt_user
    except Exception:
        pass
    return None


class TenantMiddleware:
    """Attach the signed-in user's organization for automatic queryset scoping."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_organization(None)
        user = _authenticate_jwt_user(request)
        if user and user.is_authenticated:
            set_current_organization(get_user_organization(user))
        try:
            return self.get_response(request)
        finally:
            set_current_organization(None)
