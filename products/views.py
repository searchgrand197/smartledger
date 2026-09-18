from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.excel import export_rows, parse_upload
from core.tenant import get_request_organization
from core.utils import stock_alert_level, update_product_stock
from purchases.models import PurchaseItem

from .models import Product, ProductCategory, StockMovement
from .serializers import (
    ProductCategorySerializer,
    ProductListSerializer,
    ProductSerializer,
    StockMovementSerializer,
    party_names_for_movements,
)


class ProductCategoryListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProductCategorySerializer
    queryset = ProductCategory.objects.all()


class ProductListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "brand"]
    filterset_fields = ["category", "is_active"]
    ordering_fields = ["name", "current_stock", "sale_price"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return ProductListSerializer
        return ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True).select_related("category")
        low_stock = self.request.query_params.get("low_stock")
        if low_stock == "true":
            from django.db.models import F

            qs = qs.filter(current_stock__lte=F("minimum_stock"))

        search = self.request.query_params.get("search")
        if not search:
            from django.db.models import Sum, Q
            from django.db.models.functions import Coalesce
            qs = qs.annotate(
                total_sold=Coalesce(
                    Sum("billitem__quantity", filter=Q(billitem__bill__is_cancelled=False)),
                    0
                )
            ).order_by("-total_sold", "name")
        return qs

    def perform_create(self, serializer):
        from core.tenant import require_organization

        serializer.save(organization=require_organization(self.request))


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class StockMovementListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StockMovementSerializer
    pagination_class = None

    def get_queryset(self):
        org = get_request_organization(self.request)
        if org is None:
            return StockMovement.objects.none()
        qs = (
            StockMovement.objects.filter(product__organization=org, product__is_active=True)
            .select_related("product", "created_by")
            .order_by("-created_at", "-id")
        )
        product_id = self.kwargs.get("pk") or self.request.query_params.get("product_id")
        if product_id:
            qs = qs.filter(product_id=product_id)
        movement_type = self.request.query_params.get("movement_type")
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def list(self, request, *args, **kwargs):
        movements = list(self.filter_queryset(self.get_queryset()))
        context = self.get_serializer_context()
        context["party_names"] = party_names_for_movements(movements)
        serializer = self.get_serializer(movements, many=True, context=context)
        return Response(serializer.data)


class StockAdjustView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=404)
        try:
            quantity_delta = int(request.data.get("quantity_delta", 0))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid quantity."}, status=400)
        if quantity_delta == 0:
            return Response({"detail": "Enter a non-zero adjustment."}, status=400)
        notes = (request.data.get("notes") or "").strip() or "Stock adjustment"
        update_product_stock(
            product,
            quantity_delta,
            movement_type="adjustment",
            notes=notes,
            user=request.user,
        )
        movement = product.stock_movements.order_by("-created_at", "-id").first()
        return Response(StockMovementSerializer(movement).data, status=201)


class ProductPurchaseHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        items = (
            PurchaseItem.objects.filter(product_id=pk)
            .select_related("purchase", "purchase__supplier")
            .order_by("-purchase__purchase_date")[:50]
        )
        history = [
            {
                "date": i.purchase.purchase_date.isoformat(),
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "supplier": i.purchase.supplier.name,
                "invoice": i.purchase.invoice_number,
            }
            for i in items
        ]
        return Response({"purchase_history": history})


class ProductExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = Product.objects.filter(is_active=True).select_related("category")
        rows = [
            [
                p.code,
                p.name,
                p.category.name if p.category else "",
                p.brand,
                p.unit,
                str(p.purchase_price),
                str(p.sale_price),
                p.current_stock,
                p.minimum_stock,
            ]
            for p in products
        ]
        buffer = export_rows(
            "Products",
            ["Code", "Name", "Category", "Brand", "Unit", "Purchase", "Sale", "Stock", "Min Stock"],
            rows,
        )
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="products.xlsx"'
        return response


class ProductImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file."}, status=400)
        try:
            data = parse_upload(file, ["name"])
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        from core.tenant import require_organization

        org = require_organization(request)
        created = 0
        for row in data:
            name = row.get("name")
            if not name:
                continue
            cat_name = row.get("category")
            category = None
            if cat_name:
                category, _ = ProductCategory.objects.get_or_create(name=str(cat_name))
            stock = int(row.get("stock") or 0)
            min_stock = int(row.get("min stock") or row.get("minimum_stock") or 0)
            if not min_stock and stock > 0:
                min_stock = stock_alert_level(stock)
            product = Product.objects.create(
                organization=org,
                name=str(name),
                category=category,
                brand=str(row.get("brand", "")),
                unit=str(row.get("unit", "Pc")),
                purchase_price=row.get("purchase price") or row.get("purchase_price") or 0,
                sale_price=row.get("sale price") or row.get("sale_price") or 0,
                current_stock=stock,
                minimum_stock=min_stock,
            )
            StockMovement.objects.create(
                product=product,
                quantity_delta=stock,
                quantity_after=stock,
                movement_type="opening",
                reference_label="Item imported",
                notes="Opening stock when item was first added",
                created_by=request.user if request.user.is_authenticated else None,
            )
            created += 1
        return Response({"created": created})
