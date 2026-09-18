from business.models import BusinessSettings
from core.utils import money


def _fmt_rs(amount) -> str:
    return f"₹{money(amount):,.2f}"


def build_return_print_data(sales_return):
    settings = BusinessSettings.load()
    items = []
    bill_numbers = set()
    for item in sales_return.items.select_related("product", "bill_item__bill"):
        source_bill = item.bill_item.bill.bill_number
        bill_numbers.add(source_bill)
        items.append(
            {
                "product_name": item.product.name,
                "product_code": item.product.code,
                "quantity": item.quantity,
                "rate": item.original_rate,
                "amount": item.amount,
                "reason": item.reason,
                "source_bill_number": source_bill,
            }
        )

    if len(bill_numbers) > 1:
        original_invoice_number = ", ".join(sorted(bill_numbers))
    else:
        original_invoice_number = sales_return.original_bill.bill_number

    total_fmt = _fmt_rs(sales_return.total)
    if sales_return.return_type == "exchange":
        net = sales_return.exchange_net_amount
        if net > 0:
            refund_detail = f"Customer paid {_fmt_rs(net)} for exchange difference"
        elif net < 0:
            refund_detail = f"Store credit / balance: {_fmt_rs(abs(net))}"
        else:
            refund_detail = "Even exchange — no payment due"
    elif sales_return.refund_mode == "ledger_credit":
        refund_detail = f"Credit Note applied to ledger — {total_fmt}"
    elif sales_return.refund_mode == "store_credit":
        refund_detail = f"Store credit issued — {total_fmt}"
    elif sales_return.refund_paid > 0:
        refund_detail = f"{sales_return.get_refund_mode_display()} — {_fmt_rs(sales_return.refund_paid)}"
    else:
        refund_detail = sales_return.get_return_type_display()

    created_by = ""
    if sales_return.created_by:
        raw = sales_return.created_by.get_full_name() or sales_return.created_by.username
        created_by = raw.strip().title()

    return_footer = (
        "Returned goods verified as per above. Settlement recorded in accounts. "
        "Subject to local jurisdiction only."
    )

    return {
        "business_name": settings.business_name or "Business",
        "business_address": settings.address or "",
        "business_phone": settings.phone or "",
        "business_gst": settings.gst_number or "",
        "return_number": sales_return.return_number,
        "return_date": sales_return.return_date.isoformat(),
        "original_invoice_number": original_invoice_number,
        "multi_bill": len(bill_numbers) > 1,
        "customer_name": sales_return.customer.shop_name,
        "customer_code": sales_return.customer.code,
        "return_type": sales_return.return_type,
        "return_type_label": sales_return.get_return_type_display(),
        "refund_mode": sales_return.refund_mode,
        "refund_mode_label": sales_return.get_refund_mode_display(),
        "refund_detail": refund_detail,
        "subtotal": sales_return.subtotal,
        "total": sales_return.total,
        "refund_paid": sales_return.refund_paid,
        "exchange_bill_number": sales_return.exchange_bill.bill_number if sales_return.exchange_bill else "",
        "exchange_new_value": sales_return.exchange_new_value,
        "exchange_net_amount": sales_return.exchange_net_amount,
        "notes": sales_return.notes,
        "created_by": created_by,
        "items": items,
        "footer": return_footer,
        "is_cancelled": sales_return.is_cancelled,
    }
