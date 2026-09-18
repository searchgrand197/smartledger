from decimal import Decimal

from django.db.models import Q
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.models import Bill, BillItem
from billing.serializers import BillListSerializer, BillSerializer
from core.renderers import PDFRenderer
from payments.models import Payment
from products.models import Product
from ledger.services import get_customer_balance, get_ledger_entries, get_ledger_summary
from payments.serializers import PaymentSerializer

from .models import Customer
from .portal import make_portal_token, verify_portal_token
from .serializers import CustomerSerializer
from .portal_retail import (
    get_portal_retail_customer,
    portal_retail_customers_queryset,
    resolve_portal_retail_customer,
    sync_portal_retail_customers_from_bills,
)
from .services import customer_profile_stats


class CustomerPortalMixin:
    def get_customer_from_request(self, request):
        from core.tenant import set_current_organization

        token = request.headers.get("X-Customer-Token") or request.query_params.get("token")
        if not token:
            return None
        customer_id = verify_portal_token(token)
        if not customer_id:
            return None
        try:
            customer = Customer.all_objects.select_related("organization").get(pk=customer_id, is_active=True)
            set_current_organization(customer.organization)
            return customer
        except Customer.DoesNotExist:
            return None


class CustomerPortalLoginView(APIView):
    """
    Staff login for the walk-in quick-sale counter (same shop credentials as wholesale).
    Not for registered party customers — bills go to the walk-in account.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate

        from billing.walkin import get_walkin_customer

        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=400,
            )

        from core.tenant import get_user_organization, set_current_organization

        user = authenticate(username=username, password=password)
        if not user or not user.is_active:
            return Response(
                {"detail": "Invalid username or password."},
                status=401,
            )

        org = get_user_organization(user)
        if org is None:
            return Response(
                {"detail": "This account is not linked to a ledger. Ask your admin to create a user profile."},
                status=403,
            )

        set_current_organization(org)
        walkin = get_walkin_customer(org)
        token = make_portal_token(walkin.id)
        return Response(
            {
                "token": token,
                "mode": "quick_sale",
                "label": "Walk-in / Quick Sale",
            }
        )


class CustomerPortalDashboardView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer:
            return Response({"detail": "Invalid or expired session. Please login again."}, status=401)

        stats = customer_profile_stats(customer)
        from billing.models import Bill
        from payments.models import Payment

        bills = Bill.objects.filter(customer=customer, is_cancelled=False).order_by("-created_at")[:15]
        payments = (
            Payment.objects.filter(customer=customer)
            .filter(Q(bill__isnull=True) | Q(bill__is_cancelled=False))
            .order_by("-created_at")[:15]
        )
        ledger = get_ledger_entries(customer)
        ledger_summary = get_ledger_summary(customer, ledger)

        return Response(
            {
                "customer": CustomerSerializer(customer).data,
                "current_due": get_customer_balance(customer),
                "credit_available": max(customer.credit_limit - get_customer_balance(customer), 0),
                "total_sales": stats["total_sales"],
                "last_purchase_date": stats["last_purchase_date"],
                "bills": BillListSerializer(bills, many=True).data,
                "payments": PaymentSerializer(payments, many=True).data,
                "ledger": ledger[-50:],
                "ledger_summary": ledger_summary,
                "previous_item_rates": stats["previous_item_rates"][:8],
            }
        )


class CustomerPortalProductsView(CustomerPortalMixin, APIView):
    """Read-only and write product list with party rates for logged-in customer."""

    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer:
            return Response({"detail": "Unauthorized."}, status=401)

        from products.models import Product

        if customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        qs = Product.objects.filter(is_active=True)
        search = (request.query_params.get("search") or "").strip()
        all_products = request.query_params.get("all") == "true"
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search)).order_by("name")
        elif all_products:
            qs = qs.order_by("name")
        else:
            from django.db.models import Sum
            from django.db.models.functions import Coalesce
            qs = qs.annotate(
                total_sold=Coalesce(
                    Sum("billitem__quantity", filter=Q(billitem__bill__is_cancelled=False)),
                    0
                )
            ).order_by("-total_sold", "name")[:20]

        rows = []
        for p in qs:
            retail = p.get_retail_price()
            rows.append(
                {
                    "id": p.id,
                    "code": p.code,
                    "name": p.name,
                    "image": p.image.url if p.image else None,
                    "unit": p.unit,
                    "pieces_per_pack": p.pieces_per_pack,
                    "packs_per_box": p.packs_per_box,
                    "allow_length_sale": p.allow_length_sale,
                    "length_per_piece_m": p.length_per_piece_m,
                    "current_stock": p.current_stock,
                    "minimum_stock": p.minimum_stock,
                    "is_low_stock": p.is_low_stock,
                    "wholesale_rate": p.sale_price,
                    "retail_rate": retail,
                    "your_rate": retail,
                }
            )
        return Response(rows)

    def post(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from products.serializers import ProductSerializer
        serializer = ProductSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=customer.organization)
        return Response(serializer.data, status=201)

    def patch(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from products.models import Product
        try:
            product = Product.objects.get(pk=pk, organization=customer.organization, is_active=True)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=404)

        from products.serializers import ProductSerializer
        serializer = ProductSerializer(product, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from products.models import Product
        try:
            product = Product.objects.get(pk=pk, organization=customer.organization, is_active=True)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=404)

        product.is_active = False
        product.save()
        return Response(status=204)


class CustomerPortalLedgerPDFView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]
    renderer_classes = [PDFRenderer]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer:
            return Response({"detail": "Unauthorized."}, status=401)

        from ledger.services import render_ledger_pdf

        pdf = render_ledger_pdf(customer, "My Ledger Statement")
        response = HttpResponse(pdf.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="my_ledger_{customer.code}.pdf"'
        return response


class CustomerPortalSimpleBillCreateView(CustomerPortalMixin, APIView):
    """Walk-in quick sale — optional name on bill, stored on CUS-WALK account."""

    permission_classes = [AllowAny]

    def post(self, request):
        from billing.serializers import SimpleBillCreateSerializer

        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        ser = SimpleBillCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if not data["items"]:
            return Response({"detail": "Add at least one product."}, status=400)

        # Bypassed stock check for portal quick sale as per user request

        name = (data.get("customer_name") or "").strip()
        phone = (data.get("customer_phone") or "").strip()
        notes = f"Simple customer: {name}" if name else "Simple cash sale"

        bill_customer = resolve_portal_retail_customer(customer.organization, name, phone)

        bill_at = data.get("bill_at")
        if bill_at is not None:
            from django.utils import timezone
            if timezone.is_naive(bill_at):
                bill_at = timezone.make_aware(bill_at, timezone.get_current_timezone())

        create_kwargs = dict(
            organization=customer.organization,
            customer=bill_customer,
            bill_type="simple",
            discount_amount=data.get("discount_amount", 0),
            gst_rate=Decimal("0"),
            round_off=data.get("round_off", 0),
            paid_amount=data.get("paid_amount", 0),
            payment_mode=data.get("payment_mode", "cash"),
            notes=notes,
        )
        if data.get("bill_number"):
            create_kwargs["bill_number"] = data["bill_number"]

        bill = Bill.objects.create(**create_kwargs)
        for item in data["items"]:
            product = Product.objects.get(pk=item["product"])
            BillItem.objects.create(
                bill=bill,
                product=product,
                quantity=item["quantity"],
                rate=item["rate"],
            )
        bill.refresh_from_db()

        total = bill.total
        paid = Decimal(str(data.get("paid_amount", 0) or 0))
        if paid < 0:
            paid = Decimal("0")
        if paid > total:
            paid = total
        bill.paid_amount = paid

        requested_mode = data.get("payment_mode") or "credit"
        if paid <= 0:
            bill.payment_mode = "credit"
        elif paid >= total:
            bill.payment_mode = requested_mode if requested_mode in ("cash", "upi") else "cash"
        else:
            bill.payment_mode = "partial"
        bill.save(update_fields=["paid_amount", "payment_mode", "updated_at"])

        if paid > 0:
            pay_mode = requested_mode if requested_mode in ("cash", "upi") else "cash"
            Payment.objects.create(
                organization=customer.organization,
                customer=bill_customer,
                bill=bill,
                amount=paid,
                mode=pay_mode,
                notes=f"Cash sale {bill.bill_number}",
            )

        if bill_at is not None:
            Bill.objects.filter(pk=bill.pk).update(created_at=bill_at)
            if bill.payment_mode != "credit":
                Payment.objects.filter(bill=bill).update(created_at=bill_at)
            bill.refresh_from_db()

        res_data = BillSerializer(bill).data
        if bill_customer and bill_customer.phone and bill_customer.phone.strip() and bill_customer.phone != "0000000000":
            from core.whatsapp import send_bill_pdf_to_whatsapp
            wa_result = send_bill_pdf_to_whatsapp(bill, request)
            res_data["whatsapp"] = wa_result
        return Response(res_data, status=201)


class CustomerPortalBillPDFView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]
    renderer_classes = [PDFRenderer]

    def get(self, request, pk):
        from business.models import BusinessSettings
        from core.invoice_pdf import build_invoice_pdf
        from django.utils import timezone
        from django.db import models
        from ledger.services import get_customer_balance

        customer = self.get_customer_from_request(request)
        if not customer:
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            if customer.code == "CUS-WALK":
                bill = Bill.objects.prefetch_related("items__product").select_related("customer").get(
                    pk=pk, organization=customer.organization
                )
            else:
                bill = Bill.objects.prefetch_related("items__product").select_related("customer").get(
                    pk=pk, organization=customer.organization, customer=customer
                )
        except Bill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=404)

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

        pdf = build_invoice_pdf(bill, settings, balance_info=balance_info)
        response = HttpResponse(pdf.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{bill.bill_number}.pdf"'
        return response


class CustomerPortalBillCancelView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request, pk):
        from billing.services import cancel_bill

        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            bill = Bill.objects.get(
                pk=pk,
                organization=customer.organization,
                bill_type="simple",
            )
        except Bill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=404)

        if bill.is_cancelled:
            return Response({"detail": "Already cancelled."}, status=400)

        cancel_bill(bill, user=None)
        return Response({"detail": "Bill cancelled."})


class CustomerPortalBillPrintDataView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from core.invoice_print_views import invoice_print_payload

        customer = self.get_customer_from_request(request)
        if not customer:
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            if customer.code == "CUS-WALK":
                bill = Bill.objects.prefetch_related("items__product").select_related("customer").get(
                    pk=pk, organization=customer.organization
                )
            else:
                bill = Bill.objects.prefetch_related("items__product").select_related("customer").get(
                    pk=pk, organization=customer.organization, customer=customer
                )
        except Bill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=404)

        return Response(invoice_print_payload(bill))


class CustomerPortalQuickSaleHistoryView(CustomerPortalMixin, APIView):
    """Recent walk-in quick sales (search by optional customer name on bill)."""

    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        qs = Bill.objects.filter(
            organization=customer.organization, bill_type="simple", is_cancelled=False
        ).select_related("customer").order_by("-created_at")

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(notes__icontains=search) | 
                Q(bill_number__icontains=search) | 
                Q(customer__shop_name__icontains=search)
            )

        limit = min(int(request.query_params.get("limit") or 100), 200)
        from billing.walkin import simple_bill_walk_in_name
        rows = []
        for bill in qs[:limit]:
            rows.append(
                {
                    "id": bill.id,
                    "bill_number": bill.bill_number,
                    "walk_in_name": (
                        simple_bill_walk_in_name(bill.notes)
                        if bill.customer.code == "CUS-WALK"
                        else bill.customer.shop_name
                    ),
                    "total": bill.total,
                    "payment_mode": bill.payment_mode,
                    "notes": bill.notes,
                    "created_at": bill.created_at,
                }
            )
        return Response(rows)


class CustomerPortalCategoriesView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)
        from products.models import ProductCategory
        from products.serializers import ProductCategorySerializer
        cats = ProductCategory.objects.all()
        return Response(ProductCategorySerializer(cats, many=True).data)

    def post(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)
        from products.serializers import ProductCategorySerializer
        serializer = ProductCategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class CustomerPortalBillReturnEligibilityView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request, bill_id):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            bill = Bill.objects.select_related("customer").prefetch_related("items__product").get(
                pk=bill_id, organization=customer.organization
            )
        except Bill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=404)

        from billing.walkin import simple_bill_walk_in_name
        from returns.services import get_returnable_items
        data = {
            "bill_id": bill.id,
            "bill_number": bill.bill_number,
            "customer_name": (
                simple_bill_walk_in_name(bill.notes)
                if bill.customer.code == "CUS-WALK"
                else bill.customer.shop_name
            ),
            "customer_due": get_customer_balance(bill.customer),
            "bill_type": bill.bill_type,
            "is_cancelled": bill.is_cancelled,
            "items": get_returnable_items(bill),
        }
        return Response(data)


class CustomerPortalSalesReturnCreateView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from returns.serializers import SalesReturnCreateSerializer, SalesReturnSerializer
        from returns.services import create_combined_sales_return, create_sales_return, ReturnValidationError

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
                    user=None,
                )
            else:
                bill = Bill.objects.get(pk=data["bill_id"], organization=customer.organization)
                sales_return = create_sales_return(
                    bill=bill,
                    return_type=data["return_type"],
                    refund_mode=data.get("refund_mode") or None,
                    items=data["items"],
                    notes=data.get("notes", ""),
                    exchange_items=data.get("exchange_items"),
                    user=None,
                )
        except ReturnValidationError as exc:
            return Response({"detail": exc.message}, status=400)

        try:
            from core.whatsapp import send_return_pdf_to_whatsapp
            wa_result = send_return_pdf_to_whatsapp(sales_return, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        payload = SalesReturnSerializer(sales_return).data
        payload["whatsapp"] = wa_result
        return Response(payload, status=201)


class CustomerPortalSalesReturnPrintDataView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)
        from returns.models import SalesReturn
        try:
            sales_return = SalesReturn.objects.filter(
                is_deleted=False, organization=customer.organization
            ).prefetch_related(
                "items__product"
            ).select_related("customer", "original_bill", "exchange_bill", "created_by").get(pk=pk)
        except SalesReturn.DoesNotExist:
            return Response({"detail": "Return not found."}, status=404)

        from returns.print_data import build_return_print_data
        return Response(build_return_print_data(sales_return))


class CustomerPortalSalesReturnWhatsAppView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)
        from returns.models import SalesReturn
        from core.whatsapp import send_return_pdf_to_whatsapp

        try:
            sales_return = SalesReturn.objects.filter(
                is_deleted=False, organization=customer.organization
            ).select_related("customer", "original_bill", "organization").get(pk=pk)
        except SalesReturn.DoesNotExist:
            return Response({"detail": "Return not found."}, status=404)

        wa_result = send_return_pdf_to_whatsapp(sales_return, request)
        return Response({"whatsapp": wa_result, "return_number": sales_return.return_number})


class CustomerPortalSalesReturnListView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from returns.models import SalesReturn
        from django.db.models import Q
        from billing.walkin import simple_bill_walk_in_name

        qs = SalesReturn.objects.filter(
            is_deleted=False,
            organization=customer.organization,
            customer__is_wholesale=False
        ).select_related("customer", "original_bill", "created_by").order_by("-return_date", "-id")

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(return_number__icontains=search) |
                Q(customer__shop_name__icontains=search) |
                Q(original_bill__bill_number__icontains=search)
            )

        page = max(int(request.query_params.get("page") or 1), 1)
        page_size = min(max(int(request.query_params.get("page_size") or 25), 1), 100)
        total = qs.count()
        start = (page - 1) * page_size
        page_qs = qs[start : start + page_size]

        rows = []
        for r in page_qs:
            rows.append({
                "id": r.id,
                "return_number": r.return_number,
                "return_date": r.return_date.isoformat() if r.return_date else "",
                "customer": r.customer_id,
                "customer_name": (
                    simple_bill_walk_in_name(r.original_bill.notes)
                    if r.customer.code == "CUS-WALK" and r.original_bill
                    else r.customer.shop_name
                ),
                "original_bill": r.original_bill_id,
                "original_bill_number": r.original_bill.bill_number if r.original_bill else "",
                "return_type": r.return_type,
                "refund_mode": r.refund_mode,
                "total": r.total,
                "is_cancelled": r.is_cancelled,
            })
        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": rows,
        })


class CustomerPortalSalesReturnDetailView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer:
            return Response({"detail": "Unauthorized."}, status=401)

        from returns.models import SalesReturn
        from returns.serializers import SalesReturnSerializer

        try:
            if customer.code == "CUS-WALK":
                sales_return = SalesReturn.objects.filter(
                    is_deleted=False, organization=customer.organization
                ).prefetch_related(
                    "items__product"
                ).select_related("customer", "original_bill", "exchange_bill", "created_by").get(pk=pk)
            else:
                sales_return = SalesReturn.objects.filter(
                    is_deleted=False, organization=customer.organization, customer=customer
                ).prefetch_related(
                    "items__product"
                ).select_related("customer", "original_bill", "exchange_bill", "created_by").get(pk=pk)
        except SalesReturn.DoesNotExist:
            return Response({"detail": "Return not found."}, status=404)

        return Response(SalesReturnSerializer(sales_return).data)


class CustomerPortalCustomersView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        sync_portal_retail_customers_from_bills(customer.organization)

        qs = portal_retail_customers_queryset(customer.organization)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(shop_name__icontains=search)
                | Q(owner_name__icontains=search)
                | Q(phone__icontains=search)
            )

        limit = min(int(request.query_params.get("limit") or 200), 500)
        rows = []
        for c in qs[:limit]:
            rows.append({
                "id": c.id,
                "code": c.code,
                "shop_name": c.shop_name,
                "owner_name": c.owner_name,
                "phone": c.phone,
                "current_due": get_customer_balance(c),
            })
        return Response(rows)

    def post(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from .serializers import CustomerSerializer
        serializer = CustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            organization=customer.organization,
            is_wholesale=False
        )
        return Response(serializer.data, status=201)


class CustomerPortalCustomerDetailView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            target_customer = get_portal_retail_customer(customer.organization, pk)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)

        stats = customer_profile_stats(target_customer)
        bills = Bill.objects.filter(customer=target_customer, is_cancelled=False).order_by("-created_at")[:20]
        payments = (
            Payment.objects.filter(customer=target_customer)
            .filter(Q(bill__isnull=True) | Q(bill__is_cancelled=False))
            .order_by("-created_at")[:20]
        )
        ledger = get_ledger_entries(target_customer)
        ledger_summary = get_ledger_summary(target_customer, ledger)

        # Also get returns if any
        from returns.models import SalesReturn
        from returns.serializers import SalesReturnListSerializer

        returns = SalesReturn.objects.filter(
            customer=target_customer, is_deleted=False
        ).select_related("original_bill", "created_by").order_by("-return_date")[:50]

        from billing.serializers import BillListSerializer
        from payments.serializers import PaymentSerializer

        return Response(
            {
                "customer": CustomerSerializer(target_customer).data,
                "current_due": get_customer_balance(target_customer),
                "credit_available": max(
                    target_customer.credit_limit - get_customer_balance(target_customer), 0
                ),
                **stats,
                "bills": BillListSerializer(bills, many=True).data,
                "payments": PaymentSerializer(payments, many=True).data,
                "returns": SalesReturnListSerializer(returns, many=True).data,
                "ledger": ledger[-100:],
                "ledger_summary": ledger_summary,
            }
        )

    def patch(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            target_customer = get_portal_retail_customer(customer.organization, pk)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)

        from .serializers import CustomerSerializer
        serializer = CustomerSerializer(target_customer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            target_customer = get_portal_retail_customer(customer.organization, pk)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)

        target_customer.is_active = False
        target_customer.save()
        return Response(status=204)


class CustomerPortalCustomerPaymentsView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        from payments.serializers import PaymentCreateSerializer, PaymentSerializer
        ser = PaymentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        target_customer = Customer.objects.get(
            pk=data["customer"],
            organization=customer.organization,
            is_active=True,
            is_wholesale=False
        )

        discount = data.get("discount_amount") or Decimal("0")
        balance = get_customer_balance(target_customer)
        if discount > balance and data["amount"] == 0:
            return Response({"detail": "Discount cannot exceed current balance."}, status=400)

        bill = None
        if data.get("bill"):
            bill = Bill.objects.get(pk=data["bill"], organization=customer.organization)
            bill.paid_amount += data["amount"]
            if bill.paid_amount >= bill.total:
                bill.payment_mode = "cash"
            else:
                bill.payment_mode = "partial"
            bill.save(update_fields=["paid_amount", "payment_mode", "updated_at"])

        create_kwargs = dict(
            organization=customer.organization,
            customer=target_customer,
            bill=bill,
            amount=data["amount"],
            discount_amount=data.get("discount_amount") or Decimal("0"),
            mode=data["mode"],
            reference=data.get("reference", ""),
            notes=data.get("notes", ""),
        )
        if data.get("created_at"):
            create_kwargs["created_at"] = data["created_at"]

        payment = Payment.objects.create(**create_kwargs)
        return Response(PaymentSerializer(payment).data, status=201)

    def put(self, request, pk=None):
        return self.patch(request, pk)

    def patch(self, request, pk=None):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            payment = Payment.objects.get(pk=pk, organization=customer.organization)
        except Payment.DoesNotExist:
            return Response({"detail": "Payment not found."}, status=404)

        from payments.serializers import PaymentSerializer, PaymentUpdateSerializer
        ser = PaymentUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if "customer" in data:
            target_customer = Customer.objects.get(pk=data["customer"], organization=customer.organization)
            payment.customer = target_customer
        if "amount" in data:
            payment.amount = data["amount"]
        if "discount_amount" in data:
            payment.discount_amount = data["discount_amount"]
        if "mode" in data:
            payment.mode = data["mode"]
        if "reference" in data:
            payment.reference = data["reference"]
        if "notes" in data:
            payment.notes = data["notes"]
        if "created_at" in data and data["created_at"] is not None:
            payment.created_at = data["created_at"]

        payment.save()
        return Response(PaymentSerializer(payment).data)

    def delete(self, request, pk=None):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            payment = Payment.objects.get(pk=pk, organization=customer.organization)
        except Payment.DoesNotExist:
            return Response({"detail": "Payment not found."}, status=404)

        payment.delete()
        return Response({"detail": "Payment deleted."}, status=204)


class CustomerPortalCustomerLedgerPDFView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]
    renderer_classes = [PDFRenderer]

    def get(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            target_customer = get_portal_retail_customer(customer.organization, pk)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)

        from ledger.services import render_ledger_pdf

        pdf = render_ledger_pdf(target_customer, "Bill Ledger")
        response = HttpResponse(pdf.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="ledger_{target_customer.code}.pdf"'
        return response


class CustomerPortalCustomerReminderView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request, pk):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            target_customer = get_portal_retail_customer(customer.organization, pk)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)

        due = get_customer_balance(target_customer)

        from core.whatsapp import send_ledger_pdf_to_whatsapp
        try:
            wa_result = send_ledger_pdf_to_whatsapp(target_customer, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        from business.models import BusinessSettings
        shop = BusinessSettings.load(customer.organization).business_name or "OUR STORE"
        message = (
            f"Dear {target_customer.owner_name or target_customer.shop_name}, your outstanding balance at {shop} is "
            f"Rs. {due:.2f}. Please find attached your statement. Thank you."
        )
        whatsapp_url = wa_result.get("whatsapp_url", "")
        return Response({
            "message": message,
            "whatsapp_url": whatsapp_url,
            "due_amount": due,
            "whatsapp": wa_result
        })


class CustomerPortalBillUpdateView(CustomerPortalMixin, APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from billing.serializers import BillSerializer

        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            bill = Bill.objects.prefetch_related("items__product").get(
                pk=pk, organization=customer.organization, bill_type="simple"
            )
        except Bill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=404)

        return Response(BillSerializer(bill).data)

    def put(self, request, pk):
        from billing.serializers import SimpleBillCreateSerializer
        from products.models import Product
        from core.utils import update_product_stock
        from django.db import transaction

        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        try:
            bill = Bill.objects.get(pk=pk, organization=customer.organization, bill_type="simple")
        except Bill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=404)

        if bill.is_cancelled:
            return Response({"detail": "Cannot edit a cancelled bill."}, status=400)

        # Check for active returns
        if bill.sales_returns.filter(is_cancelled=False).exists():
            return Response(
                {"detail": "Cannot edit a bill that has active sales returns. Cancel the returns first."},
                status=400
            )

        ser = SimpleBillCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if not data["items"]:
            return Response({"detail": "Add at least one product."}, status=400)

        name = (data.get("customer_name") or "").strip()
        phone = (data.get("customer_phone") or "").strip()
        notes = f"Simple customer: {name}" if name else "Simple cash sale"

        bill_customer = resolve_portal_retail_customer(customer.organization, name, phone)

        with transaction.atomic():
            # 1. Revert stock of existing bill items
            for item in bill.items.all():
                update_product_stock(
                    item.product,
                    item.quantity,
                    movement_type="adjustment",
                    reference_id=bill.id,
                    reference_label=bill.bill_number,
                    notes=f"Reverted for Bill Edit — {bill.bill_number}",
                    user=None,
                )

            # 2. Delete existing bill items
            bill.items.all().delete()

            # 3. Create new bill items
            for item in data["items"]:
                product = Product.objects.get(pk=item["product"])
                BillItem.objects.create(
                    bill=bill,
                    product=product,
                    quantity=item["quantity"],
                    rate=item["rate"],
                )

            # 4. Update bill details
            bill.customer = bill_customer
            bill.discount_amount = data.get("discount_amount", 0)
            bill.round_off = data.get("round_off", 0)
            bill.notes = notes
            if data.get("bill_number"):
                bill.bill_number = data["bill_number"]

            bill.save(update_fields=["customer", "discount_amount", "round_off", "notes", "bill_number", "updated_at"])
            bill.recalculate()

            # 5. Handle payment
            total = bill.total
            paid = Decimal(str(data.get("paid_amount", 0) or 0))
            if paid < 0:
                paid = Decimal("0")
            if paid > total:
                paid = total
            bill.paid_amount = paid

            requested_mode = data.get("payment_mode") or "cash"
            if paid <= 0:
                bill.payment_mode = "credit"
            elif paid >= total:
                bill.payment_mode = requested_mode if requested_mode in ("cash", "upi") else "cash"
            else:
                bill.payment_mode = "partial"
            bill.save(update_fields=["customer", "discount_amount", "round_off", "notes", "bill_number", "paid_amount", "payment_mode", "updated_at"])

            # Delete old payments linked to this bill
            Payment.objects.filter(bill=bill).delete()

            if paid > 0:
                pay_mode = requested_mode if requested_mode in ("cash", "upi") else "cash"
                Payment.objects.create(
                    organization=customer.organization,
                    customer=bill_customer,
                    bill=bill,
                    amount=paid,
                    mode=pay_mode,
                    notes=f"Cash sale {bill.bill_number} (edited)",
                )

            # Handle datetime update if provided
            bill_at = data.get("bill_at")
            if bill_at is not None:
                from django.utils import timezone
                if timezone.is_naive(bill_at):
                    bill_at = timezone.make_aware(bill_at, timezone.get_current_timezone())
                Bill.objects.filter(pk=bill.pk).update(created_at=bill_at)
                if bill.payment_mode != "credit":
                    Payment.objects.filter(bill=bill).update(created_at=bill_at)

        bill.refresh_from_db()
        res_data = BillSerializer(bill).data
        if bill_customer and bill_customer.phone and bill_customer.phone.strip() and bill_customer.phone != "0000000000":
            from core.whatsapp import send_bill_pdf_to_whatsapp
            try:
                wa_result = send_bill_pdf_to_whatsapp(bill, request)
                res_data["whatsapp"] = wa_result
            except Exception as e:
                res_data["whatsapp"] = {"status": "error", "detail": str(e)}

        return Response(res_data)


class CustomerPortalWhatsAppStatusView(CustomerPortalMixin, APIView):
    """Same WhatsApp connection status used by wholesale — for bill-send warning popup."""

    permission_classes = [AllowAny]

    def get(self, request):
        customer = self.get_customer_from_request(request)
        if not customer or customer.code != "CUS-WALK":
            return Response({"detail": "Unauthorized."}, status=401)

        import requests
        from django.conf import settings

        base_url = getattr(settings, "WHATSAPP_INTERNAL_BASE_URL", "").rstrip("/")
        if not base_url:
            return Response(
                {"connected": False, "message": "WhatsApp internal URL not configured"},
                status=200,
            )

        try:
            res = requests.get(f"{base_url}/api/status", timeout=5)
            data = res.json() if res.content else {"connected": False}
            if not isinstance(data, dict):
                data = {"connected": False}
            return Response(data, status=200)
        except Exception:
            return Response(
                {
                    "connected": False,
                    "message": "WhatsApp sender is not running. Restart the backend — it starts automatically with Django.",
                },
                status=200,
            )

