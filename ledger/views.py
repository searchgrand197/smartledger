from datetime import datetime

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.renderers import PDFRenderer
from customers.models import Customer

from .services import get_customer_balance, get_ledger_entries, get_ledger_summary, render_ledger_pdf


class CustomerLedgerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        customer = Customer.objects.get(pk=customer_id, is_active=True, is_wholesale=True)
        period = request.query_params.get("period", "all")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if period == "today":
            today = timezone.now().date()
            date_from = date_to = today.isoformat()
        elif period == "month":
            today = timezone.now().date()
            date_from = today.replace(day=1).isoformat()
            date_to = today.isoformat()

        df = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        dt = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None

        entries = get_ledger_entries(customer, df, dt)
        summary = get_ledger_summary(customer, entries)
        return Response(
            {
                "customer": {"id": customer.id, "code": customer.code, "shop_name": customer.shop_name},
                "ledger_summary": summary,
                "closing_balance": get_customer_balance(customer),
                "entries": entries,
            }
        )


class LedgerPDFView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [PDFRenderer]

    def get(self, request, customer_id):
        customer = Customer.objects.get(pk=customer_id, is_active=True, is_wholesale=True)
        pdf = render_ledger_pdf(customer, "Bill Ledger")
        response = HttpResponse(pdf.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="ledger_{customer.code}.pdf"'
        return response


class LedgerWhatsAppView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        customer = Customer.objects.get(pk=customer_id, is_active=True, is_wholesale=True)
        balance = get_customer_balance(customer)

        from core.whatsapp import send_ledger_pdf_to_whatsapp
        try:
            wa_result = send_ledger_pdf_to_whatsapp(customer, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        whatsapp_url = wa_result.get("whatsapp_url", "")
        return Response({
            "whatsapp_url": whatsapp_url,
            "balance": balance,
            "whatsapp": wa_result
        })
