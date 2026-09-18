from core.tenant import get_organization_for_request, set_current_organization


class TenantViewMixin:
    """Ensure tenant context is set for every DRF view (belt-and-suspenders with middleware)."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated:
            org = get_organization_for_request(request)
            set_current_organization(org)
