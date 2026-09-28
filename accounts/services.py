from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.models import Organization, UserProfile
from business.models import BusinessSettings

User = get_user_model()


class LedgerProvisioningError(Exception):
    """Raised when a new shop/ledger cannot be created."""


@transaction.atomic
def create_ledger_shop(
    *,
    shop_name: str,
    username: str,
    password: str,
    slug: str = "",
    email: str = "",
) -> tuple[Organization, User]:
    shop_name = (shop_name or "").strip()
    username = (username or "").strip()
    slug = (slug or "").strip()
    email = (email or "").strip()

    if not shop_name:
        raise LedgerProvisioningError("Shop name is required.")
    if not username:
        raise LedgerProvisioningError("Username is required.")
    if not password or len(password) < 8:
        raise LedgerProvisioningError("Password must be at least 8 characters.")
    if User.objects.filter(username=username).exists():
        raise LedgerProvisioningError(f"Username '{username}' already exists.")

    org = Organization(name=shop_name, slug=slug) if slug else Organization(name=shop_name)
    org.save()

    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        is_staff=True,
    )
    UserProfile.objects.create(user=user, organization=org, role=UserProfile.ROLE_OWNER)

    settings = BusinessSettings.load(org)
    settings.business_name = shop_name
    settings.owner_name = ""
    settings.phone = ""
    settings.address = ""
    settings.factory_details = ""
    settings.setup_completed = False
    settings.save()

    return org, user
