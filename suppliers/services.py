from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce

from purchases.models import Purchase, SupplierPayment


def supplier_pending(supplier) -> Decimal:
    purchases = Purchase.objects.filter(supplier=supplier).aggregate(
        total=Coalesce(Sum("total"), Decimal("0"))
    )["total"]
    paid = SupplierPayment.objects.filter(supplier=supplier).aggregate(
        total=Coalesce(Sum("amount"), Decimal("0"))
    )["total"]
    return supplier.opening_balance + purchases - paid


def supplier_ledger(supplier):
    entries = [{"date": "", "description": "Opening Balance", "debit": supplier.opening_balance, "credit": Decimal("0")}]
    balance = supplier.opening_balance

    events = []
    for p in Purchase.objects.filter(supplier=supplier).order_by("purchase_date"):
        events.append(
            {
                "date": p.purchase_date,
                "sort_key": p.purchase_date,
                "description": f"Purchase {p.invoice_number or p.id}",
                "debit": p.total,
                "credit": Decimal("0"),
                "ref": p.invoice_number,
            }
        )
    for pay in SupplierPayment.objects.filter(supplier=supplier).order_by("created_at"):
        events.append(
            {
                "date": pay.created_at.date(),
                "sort_key": pay.created_at,
                "description": f"Payment ({pay.mode})",
                "debit": Decimal("0"),
                "credit": pay.amount,
                "ref": "",
            }
        )
    events.sort(key=lambda x: x["sort_key"])
    ledger = []
    for e in events:
        balance += e["debit"] - e["credit"]
        ledger.append({**e, "balance": balance})
    return ledger
