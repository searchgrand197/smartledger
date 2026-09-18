import os
import logging
import requests
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db import models

from billing.models import Bill
from payments.models import Payment
from core.invoice_pdf import build_invoice_pdf
from business.models import BusinessSettings
from ledger.services import get_customer_balance, render_ledger_pdf

logger = logging.getLogger(__name__)


def _print_date_for_caption(dt) -> str:
    if not dt:
        return "—"
    from django.utils import timezone as tz

    local = tz.localtime(dt) if tz.is_aware(dt) else dt
    return local.strftime("%d-%m-%y")


def _send_pdf_document(phone_normalized: str, media_path: str, file_url: str, filename: str, caption: str, request=None, customer=None, bill=None, organization=None) -> dict:
    """
    Internal helper to deliver a PDF document to WhatsApp via the database Message Queue.
    """
    try:
        from messaging.services import enqueue_message
        message = enqueue_message(
            recipient=phone_normalized,
            caption=caption,
            file_path=media_path,
            message_type="whatsapp",
            organization=organization,
            customer=customer,
            bill=bill
        )
        return {
            "status": "success",
            "sent_via": "local-gateway",
            "phone": phone_normalized,
            "pdf_url": file_url,
            "detail": "Document queued for background delivery.",
            "message_id": message.id
        }
    except Exception as e:
        err_msg = f"Queueing error: {str(e)}"
        logger.error(err_msg)
        return {
            "status": "error",
            "phone": phone_normalized,
            "pdf_url": file_url,
            "detail": err_msg,
        }



def send_bill_pdf_to_whatsapp(bill: Bill, request=None) -> dict:
    """
    Generates the bill PDF, saves it locally under media/whatsapp_invoices/,
    and delivers it via Local Gateway, UltraMsg, or Meta API, falling back to a deep link.
    """
    customer = bill.customer
    if not customer or not customer.phone:
        return {
            "status": "skipped",
            "reason": "No customer or customer phone number available",
            "bill_number": bill.bill_number,
        }

    phone = customer.phone.strip()
    phone_digits = "".join(filter(str.isdigit, phone))

    if len(phone_digits) == 10:
        phone_normalized = "91" + phone_digits
    else:
        phone_normalized = phone_digits

    if not phone_normalized:
        return {
            "status": "skipped",
            "reason": "Invalid phone number format (no digits)",
            "bill_number": bill.bill_number,
        }

    try:
        # 1. Resolve balance details for party bill invoice
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
                .aggregate(
                    total=models.Sum("amount"),
                    discount=models.Sum("discount_amount"),
                )
            )
            pay_total = (today_payments.get("total") or Decimal("0")) + (
                today_payments.get("discount") or Decimal("0")
            )
            balance_info = {
                "today_balance": today_bills - pay_total,
                "total_balance": get_customer_balance(bill.customer),
            }

        # 2. Build PDF Document
        biz_settings = BusinessSettings.load(bill.organization)
        pdf_io = build_invoice_pdf(bill, biz_settings, balance_info=balance_info)
        pdf_bytes = pdf_io.getvalue()

        # 3. Store PDF locally under media/whatsapp_invoices/
        invoice_filename = f"{bill.bill_number.replace('/', '_')}.pdf"
        relative_path = os.path.join("whatsapp_invoices", invoice_filename).replace(os.sep, "/")
        media_path = os.path.join(settings.MEDIA_ROOT, relative_path)

        os.makedirs(os.path.dirname(media_path), exist_ok=True)
        with open(media_path, "wb") as f:
            f.write(pdf_bytes)

        file_url = f"/{settings.MEDIA_URL.lstrip('/')}{relative_path}"

        # Determine balances
        closing_balance = Decimal("0")
        prev_balance = Decimal("0")
        show_balances = bill.bill_type == "party" or (bill.customer and bill.customer.code != "CUS-WALK")
        if show_balances:
            closing_balance = get_customer_balance(bill.customer)
            prev_balance = closing_balance - bill.total + bill.paid_amount

        due_amount = bill.total - bill.paid_amount
        local_date_str = timezone.localtime(bill.created_at).strftime('%d-%m-%y %H:%M')

        caption = (
            f"Dear *{bill.customer.shop_name}*,\n\n"
            f"Please find attached your *Estimate Bill* from *{biz_settings.business_name}*.\n\n"
            f"*INVOICE DETAILS:*\n"
            f"----------------------------------------\n"
            f"• *Invoice No:* {bill.bill_number}\n"
            f"• *Date:* {local_date_str}\n"
            f"----------------------------------------\n"
            f"• *Sub Total:* Rs. {bill.subtotal:.2f}\n"
            f"• *Discount:* Rs. {bill.discount_amount:.2f}\n"
            f"• *Grand Total:* Rs. {bill.total:.2f}\n"
            f"• *Paid Amount:* Rs. {bill.paid_amount:.2f}\n"
            f"• *Due Amount:* Rs. {due_amount:.2f}\n"
            f"----------------------------------------\n"
            f"• *Prev. Balance:* Rs. {prev_balance:.2f}\n"
            f"• *Closing Balance:* Rs. {closing_balance:.2f}\n"
            f"----------------------------------------\n\n"
            f"Thank you for doing business with us!"
        )

        res = _send_pdf_document(
            phone_normalized=phone_normalized,
            media_path=media_path,
            file_url=file_url,
            filename=invoice_filename,
            caption=caption,
            request=request,
            customer=customer,
            bill=bill,
            organization=bill.organization
        )
        res["bill_number"] = bill.bill_number
        return res

    except Exception as e:
        logger.exception("Error during WhatsApp billing delivery process")
        return {
            "status": "error",
            "phone": phone,
            "bill_number": bill.bill_number,
            "detail": f"Internal error: {str(e)}",
        }


def send_ledger_pdf_to_whatsapp(customer, request=None) -> dict:
    """
    Generates the ledger PDF for a customer, saves it locally under media/whatsapp_ledgers/,
    and delivers it via Local Gateway, UltraMsg, or Meta API, falling back to a deep link.
    """
    if not customer or not customer.phone:
        return {
            "status": "skipped",
            "reason": "No customer or customer phone number available",
        }

    phone = customer.phone.strip()
    phone_digits = "".join(filter(str.isdigit, phone))

    if len(phone_digits) == 10:
        phone_normalized = "91" + phone_digits
    else:
        phone_normalized = phone_digits

    if not phone_normalized:
        return {
            "status": "skipped",
            "reason": "Invalid phone number format (no digits)",
        }

    try:
        # 1. Build Ledger PDF
        pdf_io = render_ledger_pdf(customer, "Bill Ledger")
        pdf_bytes = pdf_io.getvalue()

        # 2. Store PDF locally under media/whatsapp_ledgers/
        ledger_filename = f"ledger_{customer.code}.pdf"
        relative_path = os.path.join("whatsapp_ledgers", ledger_filename).replace(os.sep, "/")
        media_path = os.path.join(settings.MEDIA_ROOT, relative_path)

        os.makedirs(os.path.dirname(media_path), exist_ok=True)
        with open(media_path, "wb") as f:
            f.write(pdf_bytes)

        file_url = f"/{settings.MEDIA_URL.lstrip('/')}{relative_path}"

        # 3. Load Business Settings and Customer Balance
        biz_settings = BusinessSettings.load(customer.organization)
        due = get_customer_balance(customer)

        caption = (
            f"Dear {customer.owner_name}, please find attached your ledger statement "
            f"showing an outstanding balance of Rs. {due:.2f} from {biz_settings.business_name}. Thank you."
        )

        res = _send_pdf_document(
            phone_normalized=phone_normalized,
            media_path=media_path,
            file_url=file_url,
            filename=ledger_filename,
            caption=caption,
            request=request,
            customer=customer,
            organization=customer.organization
        )
        return res

    except Exception as e:
        logger.exception("Error during WhatsApp ledger delivery process")
        return {
            "status": "error",
            "phone": phone,
            "detail": f"Internal error: {str(e)}",
        }


def send_return_pdf_to_whatsapp(sales_return, request=None) -> dict:
    """Generate return PDF and queue WhatsApp delivery to the customer."""
    customer = sales_return.customer
    if not customer or not customer.phone:
        return {
            "status": "skipped",
            "reason": "No customer or customer phone number available",
            "return_number": sales_return.return_number,
        }

    phone = customer.phone.strip()
    phone_digits = "".join(filter(str.isdigit, phone))
    phone_normalized = "91" + phone_digits if len(phone_digits) == 10 else phone_digits

    if not phone_normalized:
        return {
            "status": "skipped",
            "reason": "Invalid phone number format (no digits)",
            "return_number": sales_return.return_number,
        }

    try:
        from core.return_pdf import build_return_pdf

        pdf_io = build_return_pdf(sales_return)
        pdf_bytes = pdf_io.getvalue()

        return_filename = f"{sales_return.return_number.replace('/', '_')}.pdf"
        relative_path = os.path.join("whatsapp_returns", return_filename).replace(os.sep, "/")
        media_path = os.path.join(settings.MEDIA_ROOT, relative_path)

        os.makedirs(os.path.dirname(media_path), exist_ok=True)
        with open(media_path, "wb") as f:
            f.write(pdf_bytes)

        file_url = f"/{settings.MEDIA_URL.lstrip('/')}{relative_path}"
        biz_settings = BusinessSettings.load(sales_return.organization)
        from returns.print_data import build_return_print_data

        print_data = build_return_print_data(sales_return)
        closing_balance = get_customer_balance(customer) if customer.code != "CUS-WALK" else Decimal("0")

        caption = (
            f"Dear *{customer.shop_name}*,\n\n"
            f"Please find attached your *Sales Return* receipt from *{biz_settings.business_name}*.\n\n"
            f"*RETURN DETAILS:*\n"
            f"----------------------------------------\n"
            f"• *Return No:* {sales_return.return_number}\n"
            f"• *Date:* {_print_date_for_caption(sales_return.return_date)}\n"
            f"• *Original Invoice:* {print_data['original_invoice_number']}\n"
            f"• *Return Total:* Rs. {sales_return.total:.2f}\n"
            f"• *Settlement:* {print_data['refund_detail']}\n"
        )
        if customer.code != "CUS-WALK":
            caption += f"• *Closing Balance:* Rs. {closing_balance:.2f}\n"
        caption += "----------------------------------------\n\nThank you!"

        res = _send_pdf_document(
            phone_normalized=phone_normalized,
            media_path=media_path,
            file_url=file_url,
            filename=return_filename,
            caption=caption,
            request=request,
            customer=customer,
            organization=sales_return.organization,
        )
        res["return_number"] = sales_return.return_number
        return res

    except Exception as e:
        logger.exception("Error during WhatsApp return delivery process")
        return {
            "status": "error",
            "phone": phone,
            "return_number": sales_return.return_number,
            "detail": f"Internal error: {str(e)}",
        }
