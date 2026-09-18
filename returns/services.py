from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from billing.models import Bill, BillItem
from core.utils import money, update_product_stock
from payments.models import Payment
from products.models import Product

from .models import SalesReturn, SalesReturnItem, StoreCreditBalance, StoreCreditTransaction


class ReturnValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _active_returns_filter(bill=None, customer=None):
    qs = SalesReturn.objects.filter(is_deleted=False, is_cancelled=False)
    if bill:
        qs = qs.filter(original_bill=bill)
    if customer:
        qs = qs.filter(customer=customer)
    return qs


def get_returned_quantities(bill: Bill) -> dict[int, int]:
    """Sum returned qty per bill line — uses bill_item.bill so multi-bill returns count correctly."""
    rows = (
        SalesReturnItem.objects.filter(
            bill_item__bill=bill,
            sales_return__is_deleted=False,
            sales_return__is_cancelled=False,
        )
        .values("bill_item_id")
        .annotate(total=Sum("quantity"))
    )
    return {row["bill_item_id"]: row["total"] for row in rows}


def bill_has_returnable_items(bill: Bill) -> bool:
    return any(item["returnable_quantity"] > 0 for item in get_returnable_items(bill))


def get_returnable_items(bill: Bill) -> list[dict]:
    if bill.is_cancelled:
        return []
    returned = get_returned_quantities(bill)
    items = []
    # Avoid duplicate database queries if items are already prefetched
    if hasattr(bill, "_prefetched_objects_cache") and "items" in bill._prefetched_objects_cache:
        bill_items = bill.items.all()
    else:
        bill_items = bill.items.select_related("product")
    for bi in bill_items:
        already = returned.get(bi.id, 0)
        returnable = max(0, bi.quantity - already)
        items.append(
            {
                "bill_item_id": bi.id,
                "product_id": bi.product_id,
                "product_name": bi.product.name,
                "product_code": bi.product.code,
                "sold_quantity": bi.quantity,
                "returned_quantity": already,
                "returnable_quantity": returnable,
                "rate": bi.rate,
            }
        )
    return items


def _default_refund_mode(bill: Bill, return_type: str, requested: str | None) -> str:
    if requested and requested in dict(SalesReturn.REFUND_MODES):
        return requested
    if bill.bill_type == "party":
        return "ledger_credit"
    if return_type == "exchange":
        return "store_credit"
    return "cash"


def _add_store_credit(customer, amount: Decimal, *, sales_return=None, bill=None, notes="", user=None):
    amount = money(amount)
    if amount <= 0:
        return
    bal, _ = StoreCreditBalance.objects.get_or_create(customer=customer, defaults={"balance": Decimal("0")})
    bal.balance = money(bal.balance + amount)
    bal.save(update_fields=["balance", "updated_at"])
    StoreCreditTransaction.objects.create(
        customer=customer,
        amount=amount,
        balance_after=bal.balance,
        sales_return=sales_return,
        bill=bill,
        notes=notes,
        created_by=user,
    )


def _create_exchange_bill(
    *,
    original_bill: Bill,
    exchange_items: list[dict],
    net_amount: Decimal,
    refund_mode: str,
    user,
) -> Bill:
    customer = original_bill.customer
    # Bypassed stock check for exchange items as per user request

    exchange_bill = Bill.objects.create(
        organization=original_bill.organization,
        customer=customer,
        bill_type=original_bill.bill_type,
        notes=f"Exchange against {original_bill.bill_number}",
    )
    for row in exchange_items:
        product = Product.objects.get(pk=row["product"])
        BillItem.objects.create(
            bill=exchange_bill,
            product=product,
            quantity=row["quantity"],
            rate=row["rate"],
        )
    exchange_bill.refresh_from_db()
    total = exchange_bill.total

    if net_amount > 0:
        pay_mode = refund_mode if refund_mode in ("cash", "upi") else "cash"
        exchange_bill.paid_amount = min(net_amount, total)
        exchange_bill.payment_mode = pay_mode if exchange_bill.paid_amount >= total else "partial"
        exchange_bill.save(update_fields=["paid_amount", "payment_mode", "updated_at"])
        if exchange_bill.paid_amount > 0:
            Payment.objects.create(
                organization=original_bill.organization,
                customer=customer,
                bill=exchange_bill,
                amount=exchange_bill.paid_amount,
                mode=pay_mode,
                notes=f"Exchange payment on {exchange_bill.bill_number}",
            )
    elif original_bill.bill_type == "simple" and net_amount < 0:
        exchange_bill.paid_amount = total
        exchange_bill.payment_mode = "store_credit"
        exchange_bill.save(update_fields=["paid_amount", "payment_mode", "updated_at"])
        Payment.objects.create(
            organization=original_bill.organization,
            customer=customer,
            bill=exchange_bill,
            amount=total,
            mode="cash",
            notes=f"Exchange covered by return credit on {exchange_bill.bill_number}",
        )
    return exchange_bill


def _parse_bill_return_items(bill: Bill, items: list[dict]) -> tuple[list[dict], Decimal]:
    if bill.is_cancelled:
        raise ReturnValidationError("Cannot return items from a cancelled bill.")

    returnable_map = {i["bill_item_id"]: i["returnable_quantity"] for i in get_returnable_items(bill)}
    bill_items = {bi.id: bi for bi in bill.items.select_related("product")}

    parsed_items = []
    subtotal = Decimal("0")
    for row in items:
        qty = int(row.get("quantity") or 0)
        if qty <= 0:
            continue
        bill_item_id = row.get("bill_item_id")
        if bill_item_id not in bill_items:
            raise ReturnValidationError(f"Invalid bill line {bill_item_id}.")
        max_qty = returnable_map.get(bill_item_id, 0)
        if qty > max_qty:
            bi = bill_items[bill_item_id]
            raise ReturnValidationError(
                f"Cannot return {qty} of {bi.product.name}. Only {max_qty} returnable."
            )
        bi = bill_items[bill_item_id]
        amount = money(Decimal(qty) * bi.rate)
        subtotal += amount
        parsed_items.append(
            {
                "bill": bill,
                "bill_item": bi,
                "quantity": qty,
                "rate": bi.rate,
                "amount": amount,
                "reason": (row.get("reason") or "").strip(),
            }
        )
    return parsed_items, subtotal


def _finalize_sales_return(
    *,
    sales_return: SalesReturn,
    primary_bill: Bill,
    total: Decimal,
    return_type: str,
    mode: str,
    exchange_items: list[dict] | None,
    user,
) -> SalesReturn:
    exchange_bill = None
    exchange_new_value = Decimal("0")
    exchange_net = Decimal("0")
    refund_paid = Decimal("0")

    if return_type == "exchange":
        exchange_items = exchange_items or []
        if not exchange_items:
            raise ReturnValidationError("Add exchange items for an exchange return.")
        for row in exchange_items:
            exchange_new_value += money(Decimal(row["quantity"]) * Decimal(str(row["rate"])))
        exchange_new_value = money(exchange_new_value)
        exchange_net = money(exchange_new_value - total)

    if return_type == "exchange":
        exchange_bill = _create_exchange_bill(
            original_bill=primary_bill,
            exchange_items=exchange_items or [],
            net_amount=exchange_net,
            refund_mode=mode,
            user=user,
        )
        sales_return.exchange_bill = exchange_bill
        sales_return.exchange_new_value = exchange_new_value
        sales_return.exchange_net_amount = exchange_net

        if exchange_net < 0:
            credit = money(abs(exchange_net))
            if mode == "store_credit" or primary_bill.bill_type == "simple":
                _add_store_credit(
                    primary_bill.customer,
                    credit,
                    sales_return=sales_return,
                    notes=f"Exchange credit from {sales_return.return_number}",
                    user=user,
                )
        elif exchange_net > 0 and mode in ("cash", "upi"):
            refund_paid = money(exchange_net)
    else:
        if mode in ("cash", "upi"):
            refund_paid = total
        elif mode == "store_credit":
            _add_store_credit(
                primary_bill.customer,
                total,
                sales_return=sales_return,
                notes=f"Store credit from {sales_return.return_number}",
                user=user,
            )

    sales_return.refund_paid = refund_paid
    sales_return.save(
        update_fields=[
            "exchange_bill",
            "exchange_new_value",
            "exchange_net_amount",
            "refund_paid",
            "updated_at",
        ]
    )
    return sales_return


def _persist_return_items(sales_return: SalesReturn, parsed_items: list[dict], *, user) -> None:
    for row in parsed_items:
        bi = row["bill_item"]
        bill = row["bill"]
        SalesReturnItem.objects.create(
            sales_return=sales_return,
            bill_item=bi,
            product=bi.product,
            quantity=row["quantity"],
            original_rate=row["rate"],
            amount=row["amount"],
            reason=row["reason"],
        )
        update_product_stock(
            bi.product,
            row["quantity"],
            movement_type="return",
            reference_id=sales_return.id,
            reference_label=sales_return.return_number,
            notes=f"Return from {bill.bill_number}",
            user=user,
        )


@transaction.atomic
def create_sales_return(
    *,
    bill: Bill,
    return_type: str,
    refund_mode: str | None,
    items: list[dict],
    notes: str = "",
    exchange_items: list[dict] | None = None,
    user=None,
) -> SalesReturn:
    if return_type not in dict(SalesReturn.RETURN_TYPES):
        raise ReturnValidationError("Invalid return type.")
    if not items:
        raise ReturnValidationError("Add at least one item to return.")

    parsed_items, subtotal = _parse_bill_return_items(bill, items)
    if not parsed_items:
        raise ReturnValidationError("Enter return quantity for at least one item.")

    total = money(subtotal)
    mode = _default_refund_mode(bill, return_type, refund_mode)

    sales_return = SalesReturn.objects.create(
        organization=bill.organization,
        original_bill=bill,
        customer=bill.customer,
        return_type=return_type,
        refund_mode=mode,
        subtotal=subtotal,
        total=total,
        notes=notes,
        created_by=user,
    )

    _persist_return_items(sales_return, parsed_items, user=user)
    return _finalize_sales_return(
        sales_return=sales_return,
        primary_bill=bill,
        total=total,
        return_type=return_type,
        mode=mode,
        exchange_items=exchange_items,
        user=user,
    )


@transaction.atomic
def create_combined_sales_return(
    *,
    bill_entries: list[dict],
    return_type: str,
    refund_mode: str | None,
    notes: str = "",
    exchange_items: list[dict] | None = None,
    user=None,
) -> SalesReturn:
    """One sales return receipt for items returned from multiple bills (same customer)."""
    if return_type not in dict(SalesReturn.RETURN_TYPES):
        raise ReturnValidationError("Invalid return type.")
    if not bill_entries:
        raise ReturnValidationError("Add at least one bill to return.")
    if exchange_items:
        raise ReturnValidationError("Exchange returns are not supported across multiple bills.")

    all_parsed: list[dict] = []
    subtotal = Decimal("0")
    primary_bill: Bill | None = None
    customer = None

    for entry in bill_entries:
        bill_id = entry.get("bill_id")
        items = entry.get("items") or []
        if not items:
            continue
        try:
            bill = Bill.objects.select_related("customer", "organization").get(pk=bill_id)
        except Bill.DoesNotExist:
            raise ReturnValidationError(f"Bill {bill_id} not found.")

        if customer is None:
            customer = bill.customer
            primary_bill = bill
        elif bill.customer_id != customer.id:
            raise ReturnValidationError("All bills must belong to the same customer.")

        parsed, bill_sub = _parse_bill_return_items(bill, items)
        all_parsed.extend(parsed)
        subtotal += bill_sub

    if not all_parsed or primary_bill is None:
        raise ReturnValidationError("Enter return quantity for at least one item.")

    total = money(subtotal)
    mode = _default_refund_mode(primary_bill, return_type, refund_mode)

    bill_numbers = sorted({row["bill"].bill_number for row in all_parsed})
    combined_note = notes.strip()
    if len(bill_numbers) > 1:
        invoices_line = "Original invoices: " + ", ".join(bill_numbers)
        combined_note = f"{combined_note}\n{invoices_line}".strip() if combined_note else invoices_line

    sales_return = SalesReturn.objects.create(
        organization=primary_bill.organization,
        original_bill=primary_bill,
        customer=customer,
        return_type=return_type,
        refund_mode=mode,
        subtotal=subtotal,
        total=total,
        notes=combined_note,
        created_by=user,
    )

    _persist_return_items(sales_return, all_parsed, user=user)
    return _finalize_sales_return(
        sales_return=sales_return,
        primary_bill=primary_bill,
        total=total,
        return_type=return_type,
        mode=mode,
        exchange_items=None,
        user=user,
    )


@transaction.atomic
def cancel_sales_return(sales_return: SalesReturn, *, user=None) -> SalesReturn:
    if sales_return.is_cancelled:
        raise ReturnValidationError("Return is already cancelled.")
    if sales_return.is_deleted:
        raise ReturnValidationError("Return is deleted.")

    for item in sales_return.items.select_related("product"):
        update_product_stock(
            item.product,
            -item.quantity,
            movement_type="return_cancel",
            reference_id=sales_return.id,
            reference_label=sales_return.return_number,
            notes="Return cancelled — stock reversed",
            user=user,
        )

    for txn in sales_return.store_credit_txns.all():
        bal = txn.customer.store_credit
        bal.balance = money(bal.balance - txn.amount)
        bal.save(update_fields=["balance", "updated_at"])
        StoreCreditTransaction.objects.create(
            customer=txn.customer,
            amount=-txn.amount,
            balance_after=bal.balance,
            sales_return=sales_return,
            notes=f"Reversal — {sales_return.return_number} cancelled",
            created_by=user,
        )

    sales_return.is_cancelled = True
    sales_return.save(update_fields=["is_cancelled", "updated_at"])
    return sales_return


def get_customer_returns(customer, limit: int = 50):
    return (
        _active_returns_filter(customer=customer)
        .select_related("original_bill", "created_by")
        .prefetch_related("items__product")[:limit]
    )
