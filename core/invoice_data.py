"""Invoice print payload for HTML/CSS print layout."""

from decimal import Decimal

from core.amount_words import amount_in_words


def _fmt(value) -> str:
    return f"{Decimal(str(value or 0)):,.2f}"


def _buyer_from_bill(bill) -> dict:
    from billing.walkin import simple_bill_walk_in_name

    c = bill.customer
    if c.code == "CUS-WALK":
        return {
            "name": simple_bill_walk_in_name(bill.notes or ""),
            "phone": "",
            "address": "",
        }
    return {
        "name": c.shop_name or "",
        "phone": c.phone or "",
        "address": (c.address or c.area or "").strip(),
    }


def build_invoice_print_data(bill, settings=None, balance_info: dict | None = None) -> dict:
    from business.models import BusinessSettings

    settings = settings or BusinessSettings.load()
    buyer = _buyer_from_bill(bill)
    items = list(bill.items.select_related("product").all())

    if not bill.bill_number:
        bill.save()
        bill.refresh_from_db()

    line_items = []
    for idx, line in enumerate(items, start=1):
        mrp = getattr(line.product, "sale_price", None) or line.rate
        line_items.append(
            {
                "sn": idx,
                "name": line.product.name,
                "pack": line.product.unit or "Pc",
                "hsn": getattr(line.product, "code", "") or "—",
                "batch": "—",
                "exp": "—",
                "mrp": _fmt(mrp),
                "disc_percent": "0",
                "rate": _fmt(line.rate),
                "qty": str(line.quantity),
                "amount": _fmt(line.amount),
            }
        )

    subtotal = bill.subtotal
    discount = bill.discount_amount or Decimal("0")
    grand = bill.total
    paid = bill.paid_amount or Decimal("0")
    due = grand - paid
    total_qty = sum(int(i.quantity or 0) for i in items)

    closing = None
    previous = None
    show_party_balances = bool(balance_info and bill.customer.code != "CUS-WALK")
    if show_party_balances:
        closing = Decimal(str(balance_info.get("total_balance", 0)))
        previous = closing - due

    footer_text = (settings.invoice_footer or "").strip()
    from core.unicode_text import format_terms_lines

    terms = format_terms_lines(
        footer_text,
        default_lines=["Thank you! Quality materials at best rates."],
    )

    disc_pct = bill.discount_percent or Decimal("0")
    bank_raw = (settings.factory_details or "").strip()

    return {
        "id": bill.id,
        "is_cancelled": bill.is_cancelled,
        "bill_number": bill.bill_number,
        "date": bill.created_at.strftime("%d-%m-%y %H:%M"),
        "payment_mode": bill.get_payment_mode_display(),
        "amount_in_words": amount_in_words(grand),
        "remark": (bill.notes or "").strip(),
        "shop": {
            "name": settings.business_name or "YOUR STORE",
            "address": (settings.address or "").strip(),
            "phone": settings.phone or "",
            "email": settings.email or "",
            "gst": settings.gst_number or "",
            "bank_details": bank_raw or "—",
        },
        "customer": buyer,
        "items": line_items,
        "summary": {
            "total_qty": total_qty,
            "subtotal": _fmt(subtotal),
            "discount": _fmt(discount) if discount else None,
            "discount_percent": f"{disc_pct:.2f}" if disc_pct else None,
            "round_off": _fmt(bill.round_off) if bill.round_off else None,
            "grand_total": _fmt(grand),
            "paid": _fmt(paid),
            "due": _fmt(due),
            "previous_balance": _fmt(previous) if previous is not None else None,
            "closing_balance": _fmt(closing) if closing is not None else None,
            "show_party_balances": show_party_balances,
        },
        "terms": terms,
    }
