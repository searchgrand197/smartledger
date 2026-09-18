from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce, TruncDate, TruncMonth
from django.utils import timezone

from billing.models import Bill, BillItem
from customers.models import Customer
from ledger.services import get_customer_balance
from payments.models import Payment
from products.models import Product
from purchases.models import Purchase
from returns.models import SalesReturn, SalesReturnItem
from suppliers.models import Supplier


def dashboard_summary():
    today = timezone.now().date()
    month_start = today.replace(day=1)

    today_sales = Bill.objects.filter(created_at__date=today, is_cancelled=False).aggregate(
        total=Coalesce(Sum("total"), Decimal("0"))
    )["total"]
    today_collection = Payment.objects.filter(created_at__date=today).aggregate(
        total=Coalesce(Sum("amount"), Decimal("0"))
    )["total"]

    pending_dues = Decimal("0")
    for c in Customer.objects.filter(is_active=True, is_wholesale=True):
        bal = get_customer_balance(c)
        if bal > 0:
            pending_dues += bal

    monthly_sales = Bill.objects.filter(
        created_at__date__gte=month_start, is_cancelled=False
    ).aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"]

    from django.db.models import F

    low_stock = Product.objects.filter(
        is_active=True, current_stock__lte=F("minimum_stock")
    ).count()

    recent_bills = Bill.objects.filter(is_cancelled=False).select_related("customer").order_by(
        "-created_at"
    )[:10]
    recent_payments = Payment.objects.select_related("customer").order_by("-created_at")[:10]

    today_returns = SalesReturn.objects.filter(
        return_date__date=today, is_deleted=False, is_cancelled=False, customer__is_wholesale=True
    )
    month_returns = SalesReturn.objects.filter(
        return_date__date__gte=month_start, is_deleted=False, is_cancelled=False, customer__is_wholesale=True
    )
    today_return_total = today_returns.aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"]
    month_return_total = month_returns.aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"]
    today_refund_paid = today_returns.aggregate(total=Coalesce(Sum("refund_paid"), Decimal("0")))["total"]
    month_refund_paid = month_returns.aggregate(total=Coalesce(Sum("refund_paid"), Decimal("0")))["total"]

    return {
        "today_sale": today_sales,
        "today_collection": today_collection,
        "pending_dues": pending_dues,
        "customer_count": Customer.objects.filter(is_active=True, is_wholesale=True).count(),
        "supplier_count": Supplier.objects.filter(is_active=True).count(),
        "monthly_sales": monthly_sales,
        "low_stock_count": low_stock,
        "today_returns_count": today_returns.count(),
        "today_returns_amount": today_return_total,
        "month_returns_count": month_returns.count(),
        "month_returns_amount": month_return_total,
        "today_refund_paid": today_refund_paid,
        "month_refund_paid": month_refund_paid,
        "recent_bills": [
            {
                "bill_number": b.bill_number,
                "customer": b.customer.shop_name,
                "total": b.total,
                "date": b.created_at.isoformat(),
            }
            for b in recent_bills
        ],
        "recent_payments": [
            {
                "customer": p.customer.shop_name,
                "amount": p.amount,
                "mode": p.mode,
                "date": p.created_at.isoformat(),
            }
            for p in recent_payments
        ],
    }


def chart_data():
    today = timezone.now().date()
    six_months_ago = today.replace(day=1) - timezone.timedelta(days=180)

    monthly_sales = (
        Bill.objects.filter(created_at__date__gte=six_months_ago, is_cancelled=False)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Sum("total"))
        .order_by("month")
    )

    monthly_collections = (
        Payment.objects.filter(created_at__date__gte=six_months_ago)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
    )

    top_products = (
        BillItem.objects.filter(bill__is_cancelled=False)
        .values("product__name")
        .annotate(qty=Sum("quantity"), revenue=Sum("amount"))
        .order_by("-qty")[:10]
    )

    top_customers = (
        Bill.objects.filter(is_cancelled=False)
        .values("customer__shop_name")
        .annotate(total=Sum("total"), bills=Count("id"))
        .order_by("-total")[:10]
    )

    return {
        "monthly_sales": [
            {"month": r["month"].strftime("%Y-%m") if r["month"] else "", "total": r["total"]}
            for r in monthly_sales
        ],
        "monthly_collections": [
            {"month": r["month"].strftime("%Y-%m") if r["month"] else "", "total": r["total"]}
            for r in monthly_collections
        ],
        "top_products": [
            {"name": r["product__name"], "quantity": r["qty"], "revenue": r["revenue"]}
            for r in top_products
        ],
        "top_customers": [
            {"name": r["customer__shop_name"], "total": r["total"], "bills": r["bills"]}
            for r in top_customers
        ],
    }


def daily_sales_report(date=None):
    date = date or timezone.now().date()
    bills = Bill.objects.filter(created_at__date=date, is_cancelled=False)
    return {
        "date": date.isoformat(),
        "bill_count": bills.count(),
        "total_sales": bills.aggregate(t=Coalesce(Sum("total"), Decimal("0")))["t"],
        "total_profit": bills.aggregate(t=Coalesce(Sum("total_profit"), Decimal("0")))["t"],
        "total_collected": Payment.objects.filter(created_at__date=date).aggregate(
            t=Coalesce(Sum("amount"), Decimal("0"))
        )["t"],
        "bills": list(
            bills.values("bill_number", "customer__shop_name", "total", "paid_amount", "total_profit")
        ),
    }


def profit_report(date_from=None, date_to=None):
    qs = Bill.objects.filter(is_cancelled=False)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    return {
        "total_sales": qs.aggregate(t=Coalesce(Sum("total"), Decimal("0")))["t"],
        "total_cost": qs.aggregate(t=Coalesce(Sum("total_cost"), Decimal("0")))["t"],
        "total_profit": qs.aggregate(t=Coalesce(Sum("total_profit"), Decimal("0")))["t"],
    }


def stock_report():
    products = Product.objects.filter(is_active=True).select_related("category")
    return [
        {
            "code": p.code,
            "name": p.name,
            "stock": p.current_stock,
            "min_stock": p.minimum_stock,
            "is_low": p.is_low_stock,
            "purchase_price": p.purchase_price,
            "sale_price": p.sale_price,
            "stock_value": p.current_stock * p.purchase_price,
        }
        for p in products
    ]


def purchase_report(date_from=None, date_to=None):
    qs = Purchase.objects.select_related("supplier")
    if date_from:
        qs = qs.filter(purchase_date__gte=date_from)
    if date_to:
        qs = qs.filter(purchase_date__lte=date_to)
    return list(
        qs.values(
            "id",
            "invoice_number",
            "supplier__name",
            "purchase_date",
            "total",
            "paid_amount",
        )[:100]
    )


def _return_base_qs(date_from=None, date_to=None):
    qs = SalesReturn.objects.filter(is_deleted=False, is_cancelled=False, customer__is_wholesale=True).select_related(
        "customer", "original_bill", "created_by"
    )
    if date_from:
        qs = qs.filter(return_date__date__gte=date_from)
    if date_to:
        qs = qs.filter(return_date__date__lte=date_to)
    return qs


def sales_returns_report(date_from=None, date_to=None):
    qs = _return_base_qs(date_from, date_to)
    return {
        "count": qs.count(),
        "total_amount": qs.aggregate(t=Coalesce(Sum("total"), Decimal("0")))["t"],
        "refund_paid": qs.aggregate(t=Coalesce(Sum("refund_paid"), Decimal("0")))["t"],
        "returns": [
            {
                "id": r.id,
                "return_number": r.return_number,
                "return_date": r.return_date.isoformat(),
                "customer": r.customer.shop_name,
                "customer_code": r.customer.code,
                "original_bill": r.original_bill.bill_number,
                "return_type": r.return_type,
                "refund_mode": r.refund_mode,
                "total": r.total,
                "refund_paid": r.refund_paid,
            }
            for r in qs.order_by("-return_date")[:500]
        ],
    }


def returns_by_product_report(date_from=None, date_to=None):
    qs = SalesReturnItem.objects.filter(
        sales_return__is_deleted=False,
        sales_return__is_cancelled=False,
        sales_return__customer__is_wholesale=True,
    ).select_related("product", "sales_return")
    if date_from:
        qs = qs.filter(sales_return__return_date__date__gte=date_from)
    if date_to:
        qs = qs.filter(sales_return__return_date__date__lte=date_to)
    rows = (
        qs.values("product__code", "product__name")
        .annotate(qty=Sum("quantity"), amount=Sum("amount"), returns=Count("sales_return", distinct=True))
        .order_by("-qty")
    )
    return [
        {
            "product_code": r["product__code"],
            "product_name": r["product__name"],
            "quantity_returned": r["qty"],
            "return_amount": r["amount"],
            "return_count": r["returns"],
        }
        for r in rows
    ]


def returns_by_customer_report(date_from=None, date_to=None):
    qs = _return_base_qs(date_from, date_to).filter(original_bill__bill_type="simple")
    rows = (
        qs.values("customer__code", "customer__shop_name")
        .annotate(count=Count("id"), total=Sum("total"), refund_paid=Sum("refund_paid"))
        .order_by("-total")
    )
    return [
        {
            "customer_code": r["customer__code"],
            "customer_name": r["customer__shop_name"],
            "return_count": r["count"],
            "total_amount": r["total"],
            "refund_paid": r["refund_paid"],
        }
        for r in rows
    ]


def returns_by_party_report(date_from=None, date_to=None):
    qs = _return_base_qs(date_from, date_to).filter(original_bill__bill_type="party")
    rows = (
        qs.values("customer__code", "customer__shop_name")
        .annotate(count=Count("id"), total=Sum("total"))
        .order_by("-total")
    )
    return [
        {
            "party_code": r["customer__code"],
            "party_name": r["customer__shop_name"],
            "return_count": r["count"],
            "total_amount": r["total"],
        }
        for r in rows
    ]


def refund_report(date_from=None, date_to=None):
    qs = _return_base_qs(date_from, date_to).filter(return_type="refund")
    return {
        "count": qs.count(),
        "total_amount": qs.aggregate(t=Coalesce(Sum("total"), Decimal("0")))["t"],
        "refund_paid": qs.aggregate(t=Coalesce(Sum("refund_paid"), Decimal("0")))["t"],
        "returns": [
            {
                "id": r.id,
                "return_number": r.return_number,
                "return_date": r.return_date.isoformat(),
                "customer": r.customer.shop_name,
                "refund_mode": r.refund_mode,
                "total": r.total,
                "refund_paid": r.refund_paid,
            }
            for r in qs.order_by("-return_date")[:500]
        ],
    }


def credit_note_report(date_from=None, date_to=None):
    qs = _return_base_qs(date_from, date_to).filter(return_type="credit_note")
    return {
        "count": qs.count(),
        "total_amount": qs.aggregate(t=Coalesce(Sum("total"), Decimal("0")))["t"],
        "returns": [
            {
                "id": r.id,
                "return_number": r.return_number,
                "return_date": r.return_date.isoformat(),
                "party": r.customer.shop_name,
                "party_code": r.customer.code,
                "original_bill": r.original_bill.bill_number,
                "total": r.total,
            }
            for r in qs.order_by("-return_date")[:500]
        ],
    }
