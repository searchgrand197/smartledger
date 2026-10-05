from decimal import Decimal

from django.db import models
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.renderers import PDFRenderer
from customers.models import Customer
from ledger.services import get_customer_balance
from payments.models import Payment
from products.models import Product

from .models import Bill, BillItem
from .serializers import BillCreateSerializer, BillListSerializer, BillSerializer
from customers.rate_services import resolve_sale_rate, sync_party_rates_from_bill

from .services import billing_context


class BillListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BillListSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["customer", "payment_mode", "is_cancelled", "bill_type"]
    search_fields = ["bill_number", "customer__shop_name", "customer__code", "customer__phone"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Bill.objects.filter(is_cancelled=False).select_related("customer")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["for_return"] = self.request.query_params.get("for_return") in ("1", "true", "yes")
        return ctx


class BillCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = BillCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        from core.tenant import require_organization

        org = require_organization(request)
        customer = Customer.objects.get(pk=data["customer"], organization=org, is_active=True, is_wholesale=True)

        # Bypassed stock check for bill creation as per user request

        bill_at = data.get("bill_at")
        create_kwargs = dict(
            organization=org,
            customer=customer,
            bill_type="party",
            discount_amount=data.get("discount_amount", 0),
            discount_percent=data.get("discount_percent", 0),
            gst_rate=Decimal("0"),
            round_off=data.get("round_off", 0),
            paid_amount=data.get("paid_amount", 0),
            payment_mode=data["payment_mode"],
            notes=data.get("notes", ""),
        )
        if bill_at is not None:
            create_kwargs["created_at"] = bill_at
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
            pay_mode = requested_mode if requested_mode in ("cash", "upi", "bank", "cheque") else "cash"
            payment = Payment.objects.create(
                organization=org,
                customer=customer,
                bill=bill,
                amount=paid,
                mode=pay_mode,
                notes=f"Payment on {bill.bill_number}",
            )
            if bill_at is not None:
                Payment.objects.filter(pk=payment.pk).update(created_at=bill_at)

        sync_party_rates_from_bill(bill)

        try:
            from core.whatsapp import send_bill_pdf_to_whatsapp
            wa_result = send_bill_pdf_to_whatsapp(bill, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        res_data = BillSerializer(bill).data
        res_data["whatsapp"] = wa_result
        return Response(res_data, status=201)


class SimpleBillCreateView(APIView):
    """Quick bill + print for walk-in simple customers (no party ledger)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .serializers import SimpleBillCreateSerializer
        from customers.portal_retail import resolve_portal_retail_customer

        ser = SimpleBillCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if not data["items"]:
            return Response({"detail": "Add at least one product."}, status=400)

        from core.tenant import require_organization

        org = require_organization(request)
        name = (data.get("customer_name") or "").strip()
        phone = (data.get("customer_phone") or "").strip()
        notes = f"Simple customer: {name}" if name else "Simple cash sale"
        bill_customer = resolve_portal_retail_customer(org, name, phone)

        bill_at = data.get("bill_at")
        create_kwargs = dict(
            organization=org,
            customer=bill_customer,
            bill_type="simple",
            discount_amount=data.get("discount_amount", 0),
            gst_rate=Decimal("0"),
            round_off=data.get("round_off", 0),
            paid_amount=0,
            payment_mode=data.get("payment_mode", "cash"),
            notes=notes,
        )
        if data.get("bill_number"):
            create_kwargs["bill_number"] = data["bill_number"]
        if bill_at is not None:
            create_kwargs["created_at"] = bill_at

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

        requested_mode = data.get("payment_mode") or "cash"
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
                organization=org,
                customer=bill_customer,
                bill=bill,
                amount=paid,
                mode=pay_mode,
                notes=f"Cash sale {bill.bill_number}",
            )

        try:
            from core.whatsapp import send_bill_pdf_to_whatsapp
            wa_result = send_bill_pdf_to_whatsapp(bill, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        res_data = BillSerializer(bill).data
        res_data["whatsapp"] = wa_result
        return Response(res_data, status=201)


class BillDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BillSerializer

    def get_queryset(self):
        return Bill.objects.prefetch_related("items__product", "payments").select_related("customer")


class BillCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .services import cancel_bill

        bill = Bill.objects.get(pk=pk)
        if bill.is_cancelled:
            return Response({"detail": "Already cancelled."}, status=400)
        cancel_bill(bill, user=request.user)
        return Response({"detail": "Bill cancelled."})


class BillingContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customer_id = request.query_params.get("customer_id")
        product_id = request.query_params.get("product_id")
        if not customer_id:
            return Response({"detail": "customer_id required."}, status=400)
        try:
            Customer.objects.get(pk=int(customer_id), is_active=True, is_wholesale=True)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)
        if product_id:
            from products.models import Product

            try:
                Product.objects.get(pk=int(product_id))
            except Product.DoesNotExist:
                return Response({"detail": "Product not found."}, status=404)
        return Response(billing_context(int(customer_id), int(product_id) if product_id else None))


class BillingRateHintView(APIView):
    """Quick rate lookup when adding a product to a party sale."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        customer_id = request.query_params.get("customer_id")
        product_id = request.query_params.get("product_id")
        if not customer_id or not product_id:
            return Response({"detail": "customer_id and product_id required."}, status=400)
        from customers.models import Customer

        try:
            customer = Customer.objects.get(pk=int(customer_id), is_active=True, is_wholesale=True)
            from products.models import Product

            Product.objects.get(pk=int(product_id))
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=404)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=404)
        return Response(resolve_sale_rate(customer, int(product_id)))


class BillInvoicePDFView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [PDFRenderer]

    def get(self, request, pk):
        from business.models import BusinessSettings
        from core.invoice_pdf import build_invoice_pdf

        bill = Bill.objects.prefetch_related("items__product").select_related("customer").get(pk=pk)
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


class BillInvoicePrintDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from core.invoice_print_views import invoice_print_payload

        bill = Bill.objects.prefetch_related("items__product").select_related("customer").get(pk=pk)
        return Response(invoice_print_payload(bill))


class WhatsAppStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import requests
        from django.conf import settings
        base_url = getattr(settings, "WHATSAPP_INTERNAL_BASE_URL", "").rstrip("/")
        if not base_url:
            return Response({"connected": False, "message": "WhatsApp internal URL not configured"}, status=400)

        from messaging import whatsapp_runtime

        try:
            whatsapp_runtime.ensure_whatsapp_sender_running()
            res = requests.get(f"{base_url}/api/status", timeout=8)
            return Response(res.json(), status=res.status_code)
        except Exception:
            detail = whatsapp_runtime.last_start_error or (
                "WhatsApp sender is not running on this server. "
                "Install Node.js 20+, then from the app folder run: "
                "cd message-sender && npm install && node server.js"
            )
            return Response({
                "connected": False,
                "message": detail,
            }, status=502)


class WhatsAppDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import requests
        from django.conf import settings
        base_url = getattr(settings, "WHATSAPP_INTERNAL_BASE_URL", "").rstrip("/")
        if not base_url:
            return Response({"error": "WhatsApp internal URL not configured"}, status=400)

        try:
            res = requests.post(f"{base_url}/api/disconnect", timeout=30)
            return Response(res.json(), status=res.status_code)
        except Exception as e:
            return Response({"error": f"Failed to disconnect: {str(e)}"}, status=502)


class WhatsAppRestartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import requests
        from django.conf import settings
        base_url = getattr(settings, "WHATSAPP_INTERNAL_BASE_URL", "").rstrip("/")
        if not base_url:
            return Response({"error": "WhatsApp internal URL not configured"}, status=400)

        try:
            res = requests.post(f"{base_url}/api/restart", timeout=60)
            return Response(res.json(), status=res.status_code)
        except Exception as e:
            return Response({"error": f"Failed to restart WhatsApp sender: {str(e)}"}, status=502)


class BillSendWhatsAppView(APIView):
    """Explicitly (re)send an existing bill's PDF to the customer via WhatsApp."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from core.tenant import require_organization
        org = require_organization(request)
        try:
            bill = Bill.objects.select_related("customer").get(pk=pk, organization=org)
        except Bill.DoesNotExist:
            return Response({"error": "Bill not found"}, status=404)

        if not bill.customer or not bill.customer.phone:
            return Response({
                "status": "skipped",
                "reason": "Customer has no phone number. Add a phone number to the customer first.",
            }, status=400)

        try:
            from core.whatsapp import send_bill_pdf_to_whatsapp
            wa_result = send_bill_pdf_to_whatsapp(bill, request)
            return Response(wa_result, status=200)
        except Exception as e:
            return Response({"status": "error", "detail": str(e)}, status=500)


class BillUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        from .serializers import BillCreateSerializer, SimpleBillCreateSerializer
        from core.tenant import require_organization
        from customers.models import Customer
        from products.models import Product
        from core.utils import update_product_stock
        from django.db import transaction

        org = require_organization(request)
        try:
            bill = Bill.objects.get(pk=pk, organization=org)
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

        if bill.bill_type == "simple":
            ser = SimpleBillCreateSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = ser.validated_data

            name = (data.get("customer_name") or "").strip()
            phone = (data.get("customer_phone") or "").strip()
            notes = f"Simple customer: {name}" if name else "Simple cash sale"

            from customers.portal_retail import resolve_portal_retail_customer

            bill_customer = resolve_portal_retail_customer(org, name, phone)

            with transaction.atomic():
                # Revert stock of existing bill items
                for item in bill.items.all():
                    update_product_stock(
                        item.product,
                        item.quantity,
                        movement_type="adjustment",
                        reference_id=bill.id,
                        reference_label=bill.bill_number,
                        notes=f"Reverted for Bill Edit — {bill.bill_number}",
                        user=request.user,
                    )

                # Delete existing bill items
                bill.items.all().delete()

                # Create new bill items
                for item in data["items"]:
                    product = Product.objects.get(pk=item["product"])
                    BillItem.objects.create(
                        bill=bill,
                        product=product,
                        quantity=item["quantity"],
                        rate=item["rate"],
                    )

                # Update bill details
                bill.customer = bill_customer
                bill.discount_amount = data.get("discount_amount", 0)
                bill.round_off = data.get("round_off", 0)
                bill.notes = notes
                if data.get("bill_number"):
                    bill.bill_number = data["bill_number"]

                bill.save(update_fields=["customer", "discount_amount", "round_off", "notes", "bill_number", "updated_at"])
                bill.recalculate()

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

                # Re-sync Payment
                Payment.objects.filter(bill=bill).delete()
                if paid > 0:
                    pay_mode = requested_mode if requested_mode in ("cash", "upi", "bank", "cheque") else "cash"
                    Payment.objects.create(
                        organization=org,
                        customer=bill_customer,
                        bill=bill,
                        amount=paid,
                        mode=pay_mode,
                        notes=f"Cash sale {bill.bill_number} (edited)",
                    )

                bill_at = data.get("bill_at")
                if bill_at is not None:
                    Bill.objects.filter(pk=bill.pk).update(created_at=bill_at)
                    if bill.payment_mode != "credit":
                        Payment.objects.filter(bill=bill).update(created_at=bill_at)

        else: # party bill
            ser = BillCreateSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = ser.validated_data

            customer = Customer.objects.get(pk=data["customer"], organization=org, is_active=True, is_wholesale=True)

            with transaction.atomic():
                # Revert stock of existing bill items
                for item in bill.items.all():
                    update_product_stock(
                        item.product,
                        item.quantity,
                        movement_type="adjustment",
                        reference_id=bill.id,
                        reference_label=bill.bill_number,
                        notes=f"Reverted for Bill Edit — {bill.bill_number}",
                        user=request.user,
                    )

                # Delete existing bill items
                bill.items.all().delete()

                # Create new bill items
                for item in data["items"]:
                    product = Product.objects.get(pk=item["product"])
                    BillItem.objects.create(
                        bill=bill,
                        product=product,
                        quantity=item["quantity"],
                        rate=item["rate"],
                    )

                # Update bill details
                bill.customer = customer
                bill.discount_amount = data.get("discount_amount", 0)
                bill.discount_percent = data.get("discount_percent", 0)
                bill.round_off = data.get("round_off", 0)
                bill.notes = data.get("notes", "")

                bill.save(update_fields=["customer", "discount_amount", "discount_percent", "round_off", "notes", "updated_at"])
                bill.recalculate()

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
                bill.save(update_fields=["customer", "discount_amount", "discount_percent", "round_off", "notes", "paid_amount", "payment_mode", "updated_at"])

                # Re-sync Payment
                Payment.objects.filter(bill=bill).delete()
                if paid > 0:
                    pay_mode = requested_mode if requested_mode in ("cash", "upi", "bank", "cheque") else "cash"
                    payment = Payment.objects.create(
                        organization=org,
                        customer=customer,
                        bill=bill,
                        amount=paid,
                        mode=pay_mode,
                        notes=f"Payment on {bill.bill_number} (edited)",
                    )
                    # Sync payment created_at to bill created_at
                    if bill.created_at:
                        Payment.objects.filter(pk=payment.pk).update(created_at=bill.created_at)

                bill_at = data.get("bill_at")
                if bill_at is not None:
                    Bill.objects.filter(pk=bill.pk).update(created_at=bill_at)
                    if paid > 0:
                        Payment.objects.filter(bill=bill).update(created_at=bill_at)

                # Sync party rates
                sync_party_rates_from_bill(bill)

        bill.refresh_from_db()
        try:
            from core.whatsapp import send_bill_pdf_to_whatsapp
            wa_result = send_bill_pdf_to_whatsapp(bill, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        res_data = BillSerializer(bill).data
        res_data["whatsapp"] = wa_result
        return Response(res_data)


