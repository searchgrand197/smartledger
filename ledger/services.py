from decimal import Decimal

from django.db.models import Q

from billing.models import Bill
from payments.models import Payment

try:
    from returns.models import SalesReturn
except ImportError:
    SalesReturn = None


def _decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or 0))


def _opening_row(customer, balance: Decimal | None = None, *, brought_forward: bool = False) -> dict:
    bal = customer.opening_balance if balance is None else balance
    return {
        "seq": 1,
        "date": "",
        "description": "Balance brought forward" if brought_forward else "Opening Balance",
        "bill_number": "",
        "debit": bal if bal > 0 else Decimal("0"),
        "credit": abs(bal) if bal < 0 else Decimal("0"),
        "balance": bal,
        "is_opening": True,
    }


def _collect_events(customer) -> list[dict]:
    events = []
    for bill in Bill.objects.filter(customer=customer, is_cancelled=False):
        events.append(
            {
                "date": bill.created_at.date(),
                "datetime": bill.created_at,
                "description": f"Sale — {bill.bill_number}",
                "bill_number": bill.bill_number,
                "bill_id": bill.id,
                "debit": _decimal(bill.total),
                "credit": Decimal("0"),
                "entry_type": "sale",
                "payment_mode": bill.payment_mode,
            }
        )
    payments = Payment.objects.filter(customer=customer).filter(
        Q(bill__isnull=True) | Q(bill__is_cancelled=False)
    )
    for payment in payments:
        bill_no = payment.bill.bill_number if payment.bill else ""
        discount = _decimal(payment.discount_amount)
        if payment.amount > 0:
            events.append(
                {
                    "date": payment.created_at.date(),
                    "datetime": payment.created_at,
                    "description": f"Payment received ({payment.get_mode_display()})",
                    "bill_number": bill_no,
                    "bill_id": payment.bill_id,
                    "payment_id": payment.id,
                    "debit": Decimal("0"),
                    "credit": _decimal(payment.amount),
                    "entry_type": "payment",
                }
            )
        if discount > 0:
            events.append(
                {
                    "date": payment.created_at.date(),
                    "datetime": payment.created_at,
                    "description": "Discount allowed (₹)",
                    "bill_number": bill_no,
                    "bill_id": payment.bill_id,
                    "payment_id": payment.id,
                    "debit": Decimal("0"),
                    "credit": discount,
                    "entry_type": "discount",
                }
            )
    if SalesReturn is not None:
        returns = SalesReturn.objects.filter(
            customer=customer, is_deleted=False, is_cancelled=False
        ).select_related("original_bill")
        for sr in returns:
            events.append(
                {
                    "date": sr.return_date.date(),
                    "datetime": sr.return_date,
                    "description": f"Sales Return — {sr.return_number} ({sr.original_bill.bill_number})",
                    "bill_number": sr.original_bill.bill_number,
                    "bill_id": sr.original_bill_id,
                    "return_id": sr.id,
                    "return_number": sr.return_number,
                    "debit": Decimal("0"),
                    "credit": _decimal(sr.total),
                    "entry_type": "return",
                }
            )
            if sr.refund_paid and sr.refund_paid > 0:
                events.append(
                    {
                        "date": sr.return_date.date(),
                        "datetime": sr.return_date,
                        "description": f"Refund paid ({sr.get_refund_mode_display()}) — {sr.return_number}",
                        "bill_number": sr.return_number,
                        "bill_id": None,
                        "return_id": sr.id,
                        "return_number": sr.return_number,
                        "debit": _decimal(sr.refund_paid),
                        "credit": Decimal("0"),
                        "entry_type": "refund",
                    }
                )
    events.sort(key=lambda x: x["datetime"])
    return events


def get_ledger_entries(customer, date_from=None, date_to=None) -> list[dict]:
    """
    Running balance: previous balance + debit − credit.
    Debits increase what the party owes; credits reduce it.
    """
    events = _collect_events(customer)
    balance = _decimal(customer.opening_balance)

    if date_from:
        for e in events:
            d = e["date"]
            if d and d < date_from:
                balance = balance + e["debit"] - e["credit"]
        rows = [_opening_row(customer, balance, brought_forward=True)]
    else:
        rows = [_opening_row(customer)]

    seq = 1
    for e in events:
        d = e["date"]
        if date_from and d and d < date_from:
            continue
        if date_to and d and d > date_to:
            continue
        balance = balance + e["debit"] - e["credit"]
        seq += 1
        rows.append(
            {
                "seq": seq,
                "date": d.isoformat() if d else "",
                "description": e["description"],
                "bill_number": e["bill_number"],
                "bill_id": e.get("bill_id"),
                "payment_id": e.get("payment_id"),
                "return_id": e.get("return_id"),
                "return_number": e.get("return_number", ""),
                "entry_type": e.get("entry_type", ""),
                "payment_mode": e.get("payment_mode", ""),
                "debit": e["debit"],
                "credit": e["credit"],
                "balance": balance,
                "is_opening": False,
            }
        )
    return rows


def get_ledger_summary(customer, entries: list[dict] | None = None) -> dict:
    entries = entries if entries is not None else get_ledger_entries(customer)
    txn_rows = [e for e in entries if not e.get("is_opening")]
    total_debit = sum((e["debit"] for e in txn_rows), Decimal("0"))
    total_credit = sum((e["credit"] for e in txn_rows), Decimal("0"))
    closing = entries[-1]["balance"] if entries else _decimal(customer.opening_balance)
    return {
        "opening_balance": _decimal(customer.opening_balance),
        "total_debit": total_debit,
        "total_credit": total_credit,
        "closing_balance": closing,
    }


def get_customer_balance(customer) -> Decimal:
    entries = get_ledger_entries(customer)
    if entries:
        return _decimal(entries[-1]["balance"])
    return _decimal(customer.opening_balance)


def render_ledger_pdf(customer, title: str = "Bill Ledger"):
    from business.models import BusinessSettings
    from core.pdf import build_ledger_pdf

    entries = get_ledger_entries(customer)
    summary = get_ledger_summary(customer, entries)
    settings = BusinessSettings.load()
    party_lines = [
        f"Code: {customer.code}",
        f"Owner: {customer.owner_name}",
        f"Phone: {customer.phone}",
    ]
    if customer.address:
        party_lines.append(customer.address)
    return build_ledger_pdf(
        title,
        customer.shop_name,
        party_lines,
        summary,
        entries,
        footer=settings.invoice_footer or "All amounts are inclusive.",
    )
