from contextvars import ContextVar

from django.contrib.auth.models import User

_current_organization: ContextVar = ContextVar("current_organization", default=None)


def set_current_organization(organization) -> None:
    _current_organization.set(organization)


def get_current_organization():
    return _current_organization.get()


def get_user_organization(user: User):
    if not user or not user.is_authenticated:
        return None
    try:
        from accounts.models import UserProfile

        profile = UserProfile.objects.select_related("organization").get(user=user)
    except Exception:
        return None
    if profile.is_active:
        return profile.organization
    return None


def get_organization_for_request(request):
    """Resolve the ledger for the signed-in user. Never falls back to another shop."""
    from rest_framework.exceptions import PermissionDenied

    org = get_request_organization(request)
    if org is not None:
        set_current_organization(org)
        return org
    raise PermissionDenied("This account is not linked to a ledger. Ask your admin to create a user profile.")


def get_request_organization(request):
    org = get_current_organization()
    if org is not None:
        return org
    user = getattr(request, "user", None)
    return get_user_organization(user)


def require_organization(request):
    from accounts.models import Organization

    org = get_request_organization(request)
    if org is not None:
        return org
    org, _ = Organization.objects.get_or_create(
        slug="default",
        defaults={"name": "Default Shop"},
    )
    return org
