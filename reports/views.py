from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.excel import export_rows
from core.pdf import build_pdf
from ledger.services import get_customer_balance
from customers.models import Customer

from .services import (
    chart_data,
    credit_note_report,
    daily_sales_report,
    dashboard_summary,
    profit_report,
    purchase_report,
    refund_report,
    returns_by_customer_report,
    returns_by_party_report,
    returns_by_product_report,
    sales_returns_report,
    stock_report,
)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({**dashboard_summary(), "charts": chart_data()})


class DailySalesReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date = request.query_params.get("date")
        d = timezone.datetime.strptime(date, "%Y-%m-%d").date() if date else None
        return Response(daily_sales_report(d))


class CustomerDueReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = []
        for c in Customer.objects.filter(is_active=True, is_wholesale=True):
            due = get_customer_balance(c)
            if due != 0:
                rows.append(
                    {
                        "code": c.code,
                        "shop_name": c.shop_name,
                        "phone": c.phone,
                        "due_amount": due,
                    }
                )
        rows.sort(key=lambda x: x["due_amount"], reverse=True)
        return Response(rows)


class ProfitReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            profit_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class StockReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(stock_report())


class CollectionReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from payments.models import Payment
        from django.db.models import Sum
        from django.db.models.functions import Coalesce, TruncDate

        qs = Payment.objects.annotate(day=TruncDate("created_at")).values("day", "mode").annotate(
            total=Sum("amount")
        )
        return Response(list(qs.order_by("-day")[:60]))


class PurchaseReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            purchase_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class SalesReturnsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            sales_returns_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class ReturnsByProductReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            returns_by_product_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class ReturnsByCustomerReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            returns_by_customer_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class ReturnsByPartyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            returns_by_party_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class RefundReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            refund_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class CreditNoteReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            credit_note_report(
                request.query_params.get("date_from"),
                request.query_params.get("date_to"),
            )
        )


class ReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get("type", "stock")
        if report_type == "stock":
            data = stock_report()
            rows = [[d["code"], d["name"], d["stock"], d["min_stock"], str(d["stock_value"])] for d in data]
            headers = ["Code", "Name", "Stock", "Min", "Value"]
        elif report_type == "dues":
            data = []
            for c in Customer.objects.filter(is_active=True, is_wholesale=True):
                due = get_customer_balance(c)
                if due > 0:
                    data.append([c.code, c.shop_name, c.phone, str(due)])
            rows = data
            headers = ["Code", "Shop", "Phone", "Due"]
        else:
            return Response({"detail": "Unknown report type"}, status=400)

        buffer = export_rows(report_type.title(), headers, rows)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{report_type}_report.xlsx"'
        return response
