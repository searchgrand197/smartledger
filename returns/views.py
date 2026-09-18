from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.models import Bill
from ledger.services import get_customer_balance

from .models import SalesReturn
from .print_data import build_return_print_data
from .serializers import (
    BillReturnEligibilitySerializer,
    SalesReturnCreateSerializer,
    SalesReturnListSerializer,
    SalesReturnSerializer,
)
from .services import (
    ReturnValidationError,
    cancel_sales_return,
    create_combined_sales_return,
    create_sales_return,
    get_returnable_items,
)


class ReturnListPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class BillReturnEligibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, bill_id):
        bill = Bill.objects.select_related("customer").prefetch_related("items__product").get(pk=bill_id)
        data = {
            "bill_id": bill.id,
            "bill_number": bill.bill_number,
            "customer_name": bill.customer.shop_name,
            "customer_due": get_customer_balance(bill.customer),
            "bill_type": bill.bill_type,
            "is_cancelled": bill.is_cancelled,
            "items": get_returnable_items(bill),
        }
        return Response(data)


class SalesReturnListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SalesReturnListSerializer
    pagination_class = ReturnListPagination

    def get_queryset(self):
        qs = SalesReturn.objects.filter(is_deleted=False, customer__is_wholesale=True).select_related(
            "customer", "original_bill", "created_by"
        )
        customer = self.request.query_params.get("customer")
        bill = self.request.query_params.get("bill")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        return_type = self.request.query_params.get("return_type")
        search = (self.request.query_params.get("search") or "").strip()
        if customer:
            qs = qs.filter(customer_id=customer)
        if bill:
            qs = qs.filter(original_bill_id=bill)
        if date_from:
            qs = qs.filter(return_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(return_date__date__lte=date_to)
        if return_type:
            qs = qs.filter(return_type=return_type)
        if search:
            qs = qs.filter(
                Q(return_number__icontains=search)
                | Q(customer__shop_name__icontains=search)
                | Q(original_bill__bill_number__icontains=search)
            )
        return qs.order_by("-return_date", "-id")


class SalesReturnCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = SalesReturnCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            if data.get("bills"):
                sales_return = create_combined_sales_return(
                    bill_entries=data["bills"],
                    return_type=data["return_type"],
                    refund_mode=data.get("refund_mode") or None,
                    notes=data.get("notes", ""),
                    exchange_items=data.get("exchange_items"),
                    user=request.user,
                )
            else:
                bill = Bill.objects.get(pk=data["bill_id"])
                sales_return = create_sales_return(
                    bill=bill,
                    return_type=data["return_type"],
                    refund_mode=data.get("refund_mode") or None,
                    items=data["items"],
                    notes=data.get("notes", ""),
                    exchange_items=data.get("exchange_items"),
                    user=request.user,
                )
        except ReturnValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from core.whatsapp import send_return_pdf_to_whatsapp
            wa_result = send_return_pdf_to_whatsapp(sales_return, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        payload = SalesReturnSerializer(sales_return).data
        payload["whatsapp"] = wa_result
        return Response(payload, status=status.HTTP_201_CREATED)


class SalesReturnDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SalesReturnSerializer

    def get_queryset(self):
        return SalesReturn.objects.filter(is_deleted=False).prefetch_related(
            "items__product"
        ).select_related("customer", "original_bill", "exchange_bill", "created_by")


class SalesReturnCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        sales_return = SalesReturn.objects.get(pk=pk, is_deleted=False)
        try:
            cancel_sales_return(sales_return, user=request.user)
        except ReturnValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Return cancelled.", "id": sales_return.id})


class SalesReturnPrintDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        sales_return = SalesReturn.objects.filter(is_deleted=False).prefetch_related(
            "items__product"
        ).select_related("customer", "original_bill", "exchange_bill", "created_by").get(pk=pk)
        return Response(build_return_print_data(sales_return))


class SalesReturnWhatsAppView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        sales_return = SalesReturn.objects.filter(is_deleted=False).select_related(
            "customer", "original_bill", "organization"
        ).get(pk=pk)
        from core.whatsapp import send_return_pdf_to_whatsapp

        wa_result = send_return_pdf_to_whatsapp(sales_return, request)
        return Response({"whatsapp": wa_result, "return_number": sales_return.return_number})
