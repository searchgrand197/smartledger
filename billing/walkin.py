from accounts.models import Organization
from customers.models import Customer


def get_walkin_customer(organization: Organization | None = None) -> Customer:
    from core.tenant import get_current_organization

    org = organization or get_current_organization()
    if org is None:
        org, _ = Organization.objects.get_or_create(
            slug="default",
            defaults={"name": "Default Shop"},
        )
    customer, _ = Customer.all_objects.get_or_create(
        organization=org,
        code="CUS-WALK",
        defaults={
            "shop_name": "Walk-in Customer",
            "owner_name": "Cash Sale",
            "phone": "0000000000",
            "opening_balance": 0,
            "credit_limit": 0,
            "notes": "System account for simple cash bills (not a party)",
        },
    )
    return customer


def simple_bill_walk_in_name(notes: str) -> str:
    """Display name for a quick / walk-in bill from its notes field."""
    if not notes:
        return "Walk-in"
    if notes.startswith("Simple customer:"):
        name = notes.replace("Simple customer:", "", 1).strip()
        return name or "Walk-in"
    if notes.startswith("Portal order:"):
        name = notes.replace("Portal order:", "", 1).strip()
        return name or "Walk-in"
    if notes == "Simple cash sale":
        return "Walk-in"
    return notes
