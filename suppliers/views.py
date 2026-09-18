from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from purchases.models import Purchase
from purchases.serializers import PurchaseListSerializer

from .models import Supplier
from .serializers import SupplierSerializer
from .services import supplier_ledger, supplier_pending


class SupplierListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ["name", "phone", "code"]

    def get_queryset(self):
        return Supplier.objects.filter(is_active=True)

    def perform_create(self, serializer):
        from core.tenant import require_organization

        serializer.save(organization=require_organization(self.request))


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierSerializer

    def get_queryset(self):
        return Supplier.objects.all()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class SupplierProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        supplier = Supplier.objects.get(pk=pk)
        purchases = Purchase.objects.filter(supplier=supplier).order_by("-purchase_date")[:20]
        return Response(
            {
                "supplier": SupplierSerializer(supplier).data,
                "pending_payment": supplier_pending(supplier),
                "ledger": supplier_ledger(supplier),
                "purchases": PurchaseListSerializer(purchases, many=True).data,
            }
        )
