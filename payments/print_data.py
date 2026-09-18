from business.models import BusinessSettings


def build_payment_print_data(payment):
    settings = BusinessSettings.load()
    return {
        "business_name": settings.business_name or "Business",
        "business_address": settings.address or "",
        "business_phone": settings.phone or "",
        "receipt_number": f"RCP-{payment.id:05d}",
        "payment_date": payment.created_at.isoformat(),
        "customer_name": payment.customer.shop_name,
        "customer_code": payment.customer.code,
        "amount": payment.amount,
        "mode": payment.mode,
        "mode_label": payment.get_mode_display(),
        "reference": payment.reference,
        "notes": payment.notes,
        "bill_number": payment.bill.bill_number if payment.bill else "",
        "footer": settings.invoice_footer or "",
    }
