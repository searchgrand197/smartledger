"""Retail customer helpers for the walk-in / quick-sale portal."""

from __future__ import annotations

from accounts.models import Organization
from billing.models import Bill
from billing.walkin import get_walkin_customer, simple_bill_walk_in_name
from payments.models import Payment

from .models import Customer


def resolve_portal_retail_customer(
    organization: Organization,
    name: str,
    phone: str = "",
) -> Customer:
    """
    Find or create a retail (counter) customer for a quick-sale bill.

    When *both* name and phone are given, prefer the customer whose phone
    matches — so two customers with the same name but different phones
    (e.g. two "Ankit") are kept separate and WhatsApp goes to the right one.
    """
    clean_name = (name or "").strip()
    if not clean_name:
        return get_walkin_customer(organization)

    clean_phone = (phone or "").strip()
    has_phone = bool(clean_phone and clean_phone != "0000000000")

    base_qs = (
        Customer.objects.filter(organization=organization, is_active=True)
        .exclude(code="CUS-WALK")
        .filter(shop_name__iexact=clean_name)
        .order_by("id")
    )

    existing = None
    if has_phone:
        # Exact name + phone match first (avoids sending to the wrong "Ankit")
        existing = base_qs.filter(phone=clean_phone).first()

    if existing is None:
        # Fall back to name-only when no phone provided or no phone match
        if has_phone:
            # Only reuse a name-only match if that record has no real phone yet
            existing = base_qs.filter(
                phone__in=("", "0000000000"),
            ).first()
        else:
            existing = base_qs.first()

    if existing:
        update_fields: list[str] = []
        if existing.is_wholesale:
            existing.is_wholesale = False
            update_fields.append("is_wholesale")
        if (
            has_phone
            and existing.phone in ("", "0000000000")
        ):
            existing.phone = clean_phone
            update_fields.append("phone")
        if update_fields:
            update_fields.append("updated_at")
            existing.save(update_fields=update_fields)
        return existing

    return Customer.objects.create(
        organization=organization,
        shop_name=clean_name,
        owner_name=clean_name,
        phone=clean_phone or "0000000000",
        is_wholesale=False,
    )


def portal_retail_customers_queryset(organization: Organization):
    """Customers shown under portal → Customers (retail + anyone with simple bills)."""
    from django.db.models import Q

    walkin = get_walkin_customer(organization)
    simple_customer_ids = (
        Bill.objects.filter(
            organization=organization,
            bill_type="simple",
            is_cancelled=False,
        )
        .exclude(customer_id=walkin.id)
        .values_list("customer_id", flat=True)
        .distinct()
    )

    return (
        Customer.objects.filter(organization=organization, is_active=True)
        .exclude(code="CUS-WALK")
        .filter(Q(is_wholesale=False) | Q(pk__in=simple_customer_ids))
        .distinct()
        .order_by("shop_name")
    )


def get_portal_retail_customer(organization: Organization, pk: int) -> Customer:
    return portal_retail_customers_queryset(organization).get(pk=pk)


def sync_portal_retail_customers_from_bills(organization: Organization) -> dict:
    """
    Backfill retail customers from walk-in bills that only stored the name on CUS-WALK,
    relink those bills, and mark simple-bill parties as retail (is_wholesale=False).
    Safe to run repeatedly (idempotent).
    """
    walkin = get_walkin_customer(organization)
    stats = {
        "bills_relinked": 0,
        "wholesale_flags_cleared": 0,
    }

    simple_customer_ids = (
        Bill.objects.filter(
            organization=organization,
            bill_type="simple",
            is_cancelled=False,
        )
        .exclude(customer_id=walkin.id)
        .values_list("customer_id", flat=True)
        .distinct()
    )
    stats["wholesale_flags_cleared"] = Customer.objects.filter(
        pk__in=simple_customer_ids,
        is_wholesale=True,
    ).update(is_wholesale=False)

    walkin_bills = Bill.objects.filter(
        organization=organization,
        customer=walkin,
        bill_type="simple",
        is_cancelled=False,
    )

    for bill in walkin_bills:
        name = simple_bill_walk_in_name(bill.notes or "")
        if not name or name == "Walk-in":
            continue

        retail = resolve_portal_retail_customer(organization, name)

        if bill.customer_id != retail.id:
            bill.customer = retail
            bill.save(update_fields=["customer", "updated_at"])
            Payment.objects.filter(bill=bill).update(customer=retail)
            stats["bills_relinked"] += 1

    return stats
