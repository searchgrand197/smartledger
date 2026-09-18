from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.models import Bill
from customers.models import Customer
from ledger.services import get_customer_balance

from .models import Payment
from .print_data import build_payment_print_data
from .serializers import PaymentCreateSerializer, PaymentSerializer, PaymentUpdateSerializer


class PaymentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        payment = Payment.objects.select_related("customer", "bill").get(pk=pk)
        return Response(PaymentSerializer(payment).data)

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        payment = Payment.objects.select_related("customer", "bill").get(pk=pk)
        ser = PaymentUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if "customer" in data:
            from core.tenant import require_organization
            org = require_organization(request)
            customer = Customer.objects.get(pk=data["customer"], organization=org)
            payment.customer = customer
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

    def delete(self, request, pk):
        payment = Payment.objects.get(pk=pk)
        payment.delete()
        return Response({"detail": "Payment deleted."}, status=204)


class PaymentPrintDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        payment = Payment.objects.select_related("customer", "bill").get(pk=pk)
        return Response(build_payment_print_data(payment))


class PaymentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Payment.objects.select_related("customer", "bill").order_by("-created_at")
        customer_id = request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return Response(PaymentSerializer(qs[:100], many=True).data)

    def post(self, request):
        ser = PaymentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        from core.tenant import require_organization

        org = require_organization(request)
        customer = Customer.objects.get(pk=data["customer"], organization=org, is_active=True, is_wholesale=True)
        discount = data.get("discount_amount") or Decimal("0")
        balance = get_customer_balance(customer)
        if discount > balance and data["amount"] == 0:
            return Response({"detail": "Discount cannot exceed current balance."}, status=400)
        bill = None
        if data.get("bill"):
            bill = Bill.objects.get(pk=data["bill"], organization=org)
            bill.paid_amount += data["amount"]
            if bill.paid_amount >= bill.total:
                bill.payment_mode = "cash"
            else:
                bill.payment_mode = "partial"
            bill.save(update_fields=["paid_amount", "payment_mode", "updated_at"])

        create_kwargs = dict(
            organization=org,
            customer=customer,
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


class PaymentDueListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customers = Customer.objects.filter(is_active=True, is_wholesale=True)
        dues = []
        for c in customers:
            balance = get_customer_balance(c)
            if balance > 0:
                dues.append(
                    {
                        "customer_id": c.id,
                        "customer_code": c.code,
                        "shop_name": c.shop_name,
                        "phone": c.phone,
                        "due_amount": balance,
                        "credit_limit": c.credit_limit,
                    }
                )
        dues.sort(key=lambda x: x["due_amount"], reverse=True)
        return Response(dues)


class PaymentReminderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        customer = Customer.objects.get(pk=pk)
        due = get_customer_balance(customer)

        from core.whatsapp import send_ledger_pdf_to_whatsapp
        try:
            wa_result = send_ledger_pdf_to_whatsapp(customer, request)
        except Exception as e:
            wa_result = {"status": "error", "detail": str(e)}

        from business.models import BusinessSettings
        shop = BusinessSettings.load().business_name
        message = (
            f"Dear {customer.owner_name}, your outstanding balance at {shop} is "
            f"Rs. {due:.2f}. Please find attached your statement. Thank you."
        )
        whatsapp_url = wa_result.get("whatsapp_url", "")
        return Response({
            "message": message,
            "whatsapp_url": whatsapp_url,
            "due_amount": due,
            "whatsapp": wa_result
        })
