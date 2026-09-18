from decimal import Decimal

from django.db.models import Count, Sum

from billing.models import Bill, BillItem
from core.utils import update_product_stock
from customers.rate_services import resolve_sale_rate
from ledger.services import get_customer_balance
from payments.models import Payment


def cancel_bill(bill: Bill, *, user=None) -> None:
    """Reverse stock, remove linked payments, and mark the bill cancelled."""
    if bill.is_cancelled:
        raise ValueError("Already cancelled.")
    for item in bill.items.all():
        update_product_stock(
            item.product,
            item.quantity,
            movement_type="cancel",
            reference_id=bill.id,
            reference_label=bill.bill_number,
            notes=f"Bill cancelled — {bill.bill_number}",
            user=user,
        )
    Payment.objects.filter(bill=bill).delete()
    bill.is_cancelled = True
    bill.save(update_fields=["is_cancelled", "updated_at"])


def billing_context(customer_id, product_id=None):
    from customers.models import Customer
    from products.models import Product

    customer = Customer.objects.get(pk=customer_id)
    outstanding = get_customer_balance(customer)
    credit_available = max(customer.credit_limit - outstanding, 0)

    recent_bills = Bill.objects.filter(customer=customer, is_cancelled=False).order_by(
        "-created_at"
    )[:5]

    last_transactions = []
    for b in recent_bills:
        last_transactions.append(
            {
                "type": "bill",
                "date": b.created_at.isoformat(),
                "bill_number": b.bill_number,
                "amount": b.total,
                "paid": b.paid_amount,
            }
        )
    for p in Payment.objects.filter(customer=customer).order_by("-created_at")[:5]:
        last_transactions.append(
            {
                "type": "payment",
                "date": p.created_at.isoformat(),
                "amount": p.amount,
                "mode": p.mode,
            }
        )
    last_transactions.sort(key=lambda x: x["date"], reverse=True)
    last_transactions = last_transactions[:8]

    frequent_items = (
        BillItem.objects.filter(bill__customer=customer, bill__is_cancelled=False)
        .values(
            "product_id",
            "product__name",
            "product__code",
            "product__sale_price",
            "product__purchase_price",
            "product__current_stock",
        )
        .annotate(total_qty=Sum("quantity"), order_count=Count("id"))
        .order_by("-total_qty")[:10]
    )

    product_context = None
    if product_id:
        product = Product.objects.get(pk=product_id)
        rate_info = resolve_sale_rate(customer, product)

        history = (
            BillItem.objects.filter(bill__customer=customer, product=product, bill__is_cancelled=False)
            .select_related("bill")
            .order_by("-bill__created_at")[:20]
        )
        rates_seen = []
        rate_entries = []
        quantities = []
        for h in history:
            if h.rate not in rates_seen:
                rates_seen.append(h.rate)
                rate_entries.append(
                    {
                        "rate": h.rate,
                        "date": h.bill.created_at.date().isoformat(),
                        "bill_number": h.bill.bill_number,
                    }
                )
            quantities.append({"quantity": h.quantity, "date": h.bill.created_at.date().isoformat()})
            if len(rate_entries) >= 5:
                break

        last_qty = quantities[0] if quantities else None

        product_context = {
            "product_id": product.id,
            "product_name": product.name,
            "global_rate": rate_info["global_rate"],
            "party_rate": rate_info["party_rate"],
            "last_sale_rate": rate_info["last_sale_rate"],
            "suggested_rate": rate_info["suggested_rate"],
            "current_price": product.sale_price,
            "purchase_price": product.purchase_price,
            "profit_margin": product.sale_price - product.purchase_price,
            "current_stock": product.current_stock,
            "last_rates_to_customer": rate_entries,
            "last_quantity": last_qty,
        }

    return {
        "customer_id": customer.id,
        "customer_name": customer.shop_name,
        "customer_code": customer.code,
        "outstanding_balance": outstanding,
        "credit_limit": customer.credit_limit,
        "credit_available": credit_available,
        "last_bills": [
            {
                "bill_number": b.bill_number,
                "date": b.created_at.isoformat(),
                "total": b.total,
                "paid_amount": b.paid_amount,
                "due": b.total - b.paid_amount,
            }
            for b in recent_bills
        ],
        "last_transactions": last_transactions,
        "frequently_ordered": list(frequent_items),
        "product_context": product_context,
    }
