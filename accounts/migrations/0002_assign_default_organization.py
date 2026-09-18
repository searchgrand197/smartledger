from django.conf import settings
from django.db import migrations


def assign_default_org(apps, schema_editor):
    Organization = apps.get_model("accounts", "Organization")
    UserProfile = apps.get_model("accounts", "UserProfile")
    User = apps.get_model("auth", "User")
    BusinessSettings = apps.get_model("business", "BusinessSettings")

    org, _ = Organization.objects.get_or_create(
        slug="default",
        defaults={"name": "Default Shop"},
    )

    for model_name, app_label in [
        ("Customer", "customers"),
        ("Product", "products"),
        ("Bill", "billing"),
        ("Supplier", "suppliers"),
        ("Payment", "payments"),
        ("Purchase", "purchases"),
        ("SalesReturn", "returns"),
    ]:
        Model = apps.get_model(app_label, model_name)
        Model.objects.filter(organization__isnull=True).update(organization=org)

    for row in BusinessSettings.objects.filter(organization__isnull=True):
        row.organization = org
        row.save(update_fields=["organization"])

    owner_username = getattr(settings, "OWNER_USERNAME", "owner")
    for user in User.objects.filter(is_active=True):
        if UserProfile.objects.filter(user=user).exists():
            continue
        if user.username == owner_username or user.is_superuser:
            UserProfile.objects.get_or_create(
                user=user,
                defaults={"organization": org, "role": "owner", "is_active": True},
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_organization_tenant"),
        ("business", "0005_organization_tenant"),
        ("customers", "0004_organization_tenant"),
        ("products", "0006_organization_tenant"),
        ("billing", "0003_organization_tenant"),
        ("suppliers", "0002_organization_tenant"),
        ("payments", "0002_organization_tenant"),
        ("purchases", "0002_organization_tenant"),
        ("returns", "0002_organization_tenant"),
    ]

    operations = [
        migrations.RunPython(assign_default_org, noop),
    ]
