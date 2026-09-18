"""Shared helpers for invoice print JSON endpoints."""

from decimal import Decimal

from django.db import models
from django.utils import timezone

from billing.models import Bill
from ledger.services import get_customer_balance
from payments.models import Payment

from .invoice_data import build_invoice_print_data


def invoice_print_payload(bill: Bill) -> dict:
    from business.models import BusinessSettings

    settings = BusinessSettings.load(bill.organization)
    balance_info = None
    if bill.customer.code != "CUS-WALK":
        today = timezone.localdate()
        today_bills = (
            Bill.objects.filter(customer=bill.customer, is_cancelled=False, created_at__date=today)
            .aggregate(total=models.Sum("total"))
            .get("total")
            or Decimal("0")
        )
        today_payments = (
            Payment.objects.filter(customer=bill.customer, created_at__date=today)
            .filter(models.Q(bill__isnull=True) | models.Q(bill__is_cancelled=False))
            .aggregate(total=models.Sum("amount"))
            .get("total")
            or Decimal("0")
        )
        balance_info = {
            "today_balance": today_bills - today_payments,
            "total_balance": get_customer_balance(bill.customer),
        }
    return build_invoice_print_data(bill, settings, balance_info=balance_info)
