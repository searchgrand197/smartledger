from collections import defaultdict
from decimal import Decimal

from django.db.models import Avg, Count, Max, Min, Sum
from django.db.models.functions import Coalesce

from billing.models import Bill, BillItem


def customer_profile_stats(customer):
    bills = Bill.objects.filter(customer=customer, is_cancelled=False)
    total_sales = bills.aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"]
    last_bill = bills.order_by("-created_at").first()

    items = BillItem.objects.filter(bill__customer=customer, bill__is_cancelled=False)
    frequent = (
        items.values("product_id", "product__name", "product__code")
        .annotate(qty=Sum("quantity"), times=Count("id"))
        .order_by("-qty")[:10]
    )

    rate_history = defaultdict(list)
    for item in items.select_related("product", "bill").order_by("-bill__created_at")[:500]:
        rate_history[item.product_id].append(
            {
                "product_id": item.product_id,
                "product_name": item.product.name,
                "product_code": item.product.code,
                "rate": item.rate,
                "quantity": item.quantity,
                "date": item.bill.created_at.date().isoformat(),
                "bill_number": item.bill.bill_number,
            }
        )

    previous_rates = []
    for product_id, entries in rate_history.items():
        seen_rates = []
        unique = []
        for e in entries:
            if e["rate"] not in seen_rates:
                seen_rates.append(e["rate"])
                unique.append(e)
            if len(unique) >= 5:
                break
        rates = [e["rate"] for e in entries]
        previous_rates.append(
            {
                "product_id": product_id,
                "product_name": entries[0]["product_name"],
                "product_code": entries[0]["product_code"],
                "rates": unique,
                "average_rate": items.filter(product_id=product_id).aggregate(
                    avg=Avg("rate")
                )["avg"],
                "highest_rate": items.filter(product_id=product_id).aggregate(
                    max=Max("rate")
                )["max"],
                "lowest_rate": items.filter(product_id=product_id).aggregate(
                    min=Min("rate")
                )["min"],
            }
        )

    return {
        "total_sales": total_sales,
        "bill_count": bills.count(),
        "last_purchase_date": last_bill.created_at if last_bill else None,
        "last_bill_number": last_bill.bill_number if last_bill else None,
        "frequent_items": list(frequent),
        "previous_item_rates": previous_rates,
    }
