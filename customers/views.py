from django.db.models import Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.models import Bill
from billing.serializers import BillListSerializer
from core.excel import export_rows, parse_upload
from core.renderers import PDFRenderer
from ledger.services import get_customer_balance, get_ledger_entries, get_ledger_summary
from payments.models import Payment
from payments.serializers import PaymentSerializer

from .models import Customer, PartyProductRate
from .rate_services import upsert_party_rate
from .serializers import (
    CustomerListSerializer,
    CustomerSerializer,
    PartyProductRateSerializer,
    PartyProductRateWriteSerializer,
)
from .services import customer_profile_stats


class CustomerListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["shop_name", "owner_name", "phone", "code", "area"]
    ordering_fields = ["shop_name", "created_at", "code"]
    filterset_fields = ["is_active", "area"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return CustomerListSerializer
        return CustomerSerializer

    def get_queryset(self):
        qs = Customer.objects.filter(is_active=True)
        is_wholesale = self.request.query_params.get("is_wholesale")
        if is_wholesale is not None:
            qs = qs.filter(is_wholesale=(is_wholesale.lower() == "true"))
        else:
            qs = qs.filter(is_wholesale=True)
        return qs

    def perform_create(self, serializer):
        from core.tenant import require_organization

        is_wholesale = self.request.data.get("is_wholesale", True)
        if isinstance(is_wholesale, str):
            is_wholesale = is_wholesale.lower() == "true"
        serializer.save(
            organization=require_organization(self.request),
            is_wholesale=is_wholesale
        )


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return Customer.objects.all()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class CustomerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk)
        except Customer.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        stats = customer_profile_stats(customer)
        bills = Bill.objects.filter(customer=customer, is_cancelled=False).order_by("-created_at")[:20]
        payments = (
            Payment.objects.filter(customer=customer)
            .filter(Q(bill__isnull=True) | Q(bill__is_cancelled=False))
            .order_by("-created_at")[:20]
        )
        ledger = get_ledger_entries(customer)
        ledger_summary = get_ledger_summary(customer, ledger)

        from returns.models import SalesReturn
        from returns.serializers import SalesReturnListSerializer

        returns = SalesReturn.objects.filter(
            customer=customer, is_deleted=False
        ).select_related("original_bill", "created_by").order_by("-return_date")[:50]

        return Response(
            {
                "customer": CustomerSerializer(customer).data,
                "current_due": get_customer_balance(customer),
                "credit_available": max(
                    customer.credit_limit - get_customer_balance(customer), 0
                ),
                **stats,
                "bills": BillListSerializer(bills, many=True).data,
                "payments": PaymentSerializer(payments, many=True).data,
                "returns": SalesReturnListSerializer(returns, many=True).data,
                "ledger": ledger[-100:],
                "ledger_summary": ledger_summary,
            }
        )


class CustomerExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customers = Customer.objects.filter(is_active=True, is_wholesale=True)
        rows = [
            [
                c.code,
                c.shop_name,
                c.owner_name,
                c.phone,
                c.area,
                str(c.opening_balance),
                str(c.credit_limit),
            ]
            for c in customers
        ]
        buffer = export_rows(
            "Customers",
            ["Code", "Shop", "Owner", "Phone", "Area", "Opening Balance", "Credit Limit"],
            rows,
        )
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="customers.xlsx"'
        return response


class CustomerImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file uploaded."}, status=400)
        try:
            data = parse_upload(
                file,
                ["shop name", "owner name", "phone"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        from core.tenant import require_organization

        org = require_organization(request)
        created = 0
        for row in data:
            shop = row.get("shop name") or row.get("shop_name")
            owner = row.get("owner name") or row.get("owner_name")
            phone = str(row.get("phone", ""))
            if not shop or not owner:
                continue
            import re
            clean_phone = re.sub(r'\D', '', phone)
            if len(clean_phone) != 10:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(f"Invalid phone number for {shop}: '{phone}'. Must be exactly 10 digits.")
            Customer.objects.create(
                organization=org,
                shop_name=str(shop),
                owner_name=str(owner),
                phone=clean_phone,
                gst=str(row.get("gst", "")),
                area=str(row.get("area", "")),
                address=str(row.get("address", "")),
                opening_balance=row.get("opening balance") or 0,
                credit_limit=row.get("credit limit") or 0,
                is_wholesale=True,
            )
            created += 1
        return Response({"created": created})


class CustomerPartyRatesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        customer = Customer.objects.get(pk=pk)
        rates = PartyProductRate.objects.filter(customer=customer).select_related("product")
        return Response(PartyProductRateSerializer(rates, many=True).data)

    def post(self, request, pk):
        customer = Customer.objects.get(pk=pk)
        ser = PartyProductRateWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from products.models import Product

        product = Product.objects.get(pk=ser.validated_data["product"])
        row = upsert_party_rate(customer, product, ser.validated_data["rate"])
        return Response(PartyProductRateSerializer(row).data, status=201)


class CustomerLedgerPDFView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [PDFRenderer]

    def get(self, request, pk):
        try:
            from ledger.services import render_ledger_pdf

            customer = Customer.objects.get(pk=pk)
            pdf = render_ledger_pdf(customer, "Bill Ledger")
            response = HttpResponse(pdf.getvalue(), content_type="application/pdf")
            response["Content-Disposition"] = f'inline; filename="ledger_{customer.code}.pdf"'
            return response
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)
        except Exception as exc:
            return Response({"detail": f"PDF failed: {exc}"}, status=500)
