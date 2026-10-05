from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce

from billing.models import Bill
from core.utils import money

from .models import Payment


def sync_bill_paid_from_payments(bill: Bill | None) -> None:
    """Set bill.paid_amount from linked payments (amount + discount), capped at total."""
    if bill is None:
        return
    agg = Payment.objects.filter(bill=bill).aggregate(
        amounts=Coalesce(Sum("amount"), Decimal("0")),
        discounts=Coalesce(Sum("discount_amount"), Decimal("0")),
    )
    applied = money(agg["amounts"] + agg["discounts"])
    if applied < 0:
        applied = Decimal("0")
    if applied > bill.total:
        applied = bill.total
    bill.paid_amount = applied
    modes = list(Payment.objects.filter(bill=bill).values_list("mode", flat=True).distinct())
    if bill.paid_amount <= 0:
        bill.payment_mode = "credit"
    elif bill.paid_amount >= bill.total:
        if len(modes) == 1 and modes[0] in ("cash", "upi"):
            bill.payment_mode = modes[0]
        elif bill.payment_mode not in ("cash", "upi"):
            bill.payment_mode = "cash"
    else:
        bill.payment_mode = "partial"
    bill.save(update_fields=["paid_amount", "payment_mode", "updated_at"])


def _is_sale_payment(payment: Payment, bill: Bill) -> bool:
    notes = payment.notes or ""
    markers = (
        f"Payment on {bill.bill_number}",
        f"Cash sale {bill.bill_number}",
        f"Exchange payment on {bill.bill_number}",
        f"Exchange covered by return credit on {bill.bill_number}",
    )
    return any(marker in notes for marker in markers)


def replace_bill_sale_payments(
    bill: Bill,
    *,
    paid,
    mode: str,
    organization,
    customer,
    notes: str,
    created_at=None,
) -> None:
    """
    Recreate the on-bill sale payment without deleting later receipts
    posted against the same bill.
    """
    paid = money(paid)
    if paid < 0:
        paid = Decimal("0")
    if paid > bill.total:
        paid = bill.total

    linked = list(Payment.objects.filter(bill=bill).order_by("id"))
    sale_pays = [p for p in linked if _is_sale_payment(p, bill)]
    other = [p for p in linked if p not in sale_pays]
    if not sale_pays and len(linked) == 1:
        sale_pays = linked
        other = []

    extra_sum = sum((p.amount for p in other), Decimal("0"))
    extra_disc = sum((p.discount_amount for p in other), Decimal("0"))
    sale_amount = money(paid - extra_sum - extra_disc)
    if sale_amount < 0:
        sale_amount = Decimal("0")

    pay_mode = mode if mode in ("cash", "upi", "bank", "cheque") else "cash"

    for payment in sale_pays:
        payment.delete()

    if sale_amount > 0:
        payment = Payment.objects.create(
            organization=organization,
            customer=customer,
            bill=bill,
            amount=sale_amount,
            mode=pay_mode,
            notes=notes,
        )
        if created_at is not None:
            Payment.objects.filter(pk=payment.pk).update(created_at=created_at)

    sync_bill_paid_from_payments(bill)
