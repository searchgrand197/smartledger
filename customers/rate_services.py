from decimal import Decimal

from billing.models import BillItem

from .models import PartyProductRate


def get_party_rate(customer, product) -> Decimal | None:
    row = PartyProductRate.objects.filter(customer=customer, product=product).first()
    return row.rate if row else None


def get_last_sale_rate(customer, product) -> Decimal | None:
    item = (
        BillItem.objects.filter(
            bill__customer=customer,
            product=product,
            bill__is_cancelled=False,
        )
        .select_related("bill")
        .order_by("-bill__created_at")
        .first()
    )
    return item.rate if item else None


def resolve_sale_rate(customer, product) -> dict:
    """Party rate > last sale to party > global (product sale_price)."""
    from products.models import Product

    if isinstance(product, int):
        product = Product.objects.get(pk=product)

    global_rate = product.sale_price
    party_rate = get_party_rate(customer, product)
    last_rate = get_last_sale_rate(customer, product)

    if party_rate is not None:
        suggested = party_rate
    elif last_rate is not None:
        suggested = last_rate
    else:
        suggested = global_rate

    return {
        "product_id": product.id,
        "product_name": product.name,
        "product_code": product.code,
        "global_rate": global_rate,
        "party_rate": party_rate,
        "last_sale_rate": last_rate,
        "suggested_rate": suggested,
    }


def upsert_party_rate(customer, product, rate) -> PartyProductRate:
    from products.models import Product

    if isinstance(product, int):
        product = Product.objects.get(pk=product)
    row, _ = PartyProductRate.objects.update_or_create(
        customer=customer,
        product=product,
        defaults={"rate": Decimal(str(rate))},
    )
    return row


def sync_party_rates_from_bill(bill):
    """Remember rates used on this bill as party rates for next time."""
    for item in bill.items.select_related("product"):
        upsert_party_rate(bill.customer, item.product, item.rate)
