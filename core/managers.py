from django.db import models

from core.tenant import get_current_organization


class TenantQuerySet(models.QuerySet):
    def for_organization(self, organization):
        if organization is None:
            return self.none()
        return self.filter(organization=organization)


class TenantManager(models.Manager):
    def get_queryset(self):
        qs = TenantQuerySet(self.model, using=self._db)
        if not hasattr(self.model, "organization_id"):
            return qs
        org = get_current_organization()
        if org is not None:
            return qs.filter(organization=org)
        return qs.none()

    def for_organization(self, organization):
        return TenantQuerySet(self.model, using=self._db).for_organization(organization)
