from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Product
from suppliers.models import Supplier

from .models import Purchase, PurchaseItem, SupplierPayment
from .serializers import (
    PurchaseCreateSerializer,
    PurchaseListSerializer,
    PurchaseSerializer,
    SupplierPaymentSerializer,
)


class PurchaseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Purchase.objects.select_related("supplier").order_by("-purchase_date")
        supplier_id = request.query_params.get("supplier")
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return Response(PurchaseListSerializer(qs[:100], many=True).data)

    def post(self, request):
        ser = PurchaseCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        from core.tenant import require_organization

        org = require_organization(request)
        supplier = Supplier.objects.get(pk=data["supplier"], organization=org)
        purchase = Purchase.objects.create(
            organization=org,
            supplier=supplier,
            invoice_number=data.get("invoice_number", ""),
            purchase_date=data.get("purchase_date") or timezone.now().date(),
            discount=data.get("discount", 0),
            paid_amount=data.get("paid_amount", 0),
            notes=data.get("notes", ""),
        )
        for item in data["items"]:
            product = Product.objects.get(pk=item["product"])
            PurchaseItem.objects.create(
                purchase=purchase,
                product=product,
                quantity=item["quantity"],
                unit_price=item["unit_price"],
            )
        purchase.refresh_from_db()
        if purchase.paid_amount > 0:
            SupplierPayment.objects.create(
                supplier=supplier,
                purchase=purchase,
                amount=purchase.paid_amount,
                mode="cash",
                notes="Paid with purchase",
            )
        return Response(PurchaseSerializer(purchase).data, status=201)


class PurchaseDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseSerializer
    queryset = Purchase.objects.prefetch_related("items__product")


class SupplierPaymentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierPaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["supplier", "mode"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return SupplierPayment.objects.select_related("supplier")
