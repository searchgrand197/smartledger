from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Organization
from core.tenant import get_organization_for_request

from .models import BusinessSettings
from .serializers import BusinessSettingsSerializer


class BusinessSettingsView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BusinessSettingsSerializer

    def get_object(self):
        org = get_organization_for_request(self.request)
        return BusinessSettings.load(org)

    def perform_update(self, serializer):
        instance = serializer.save()
        name = (instance.business_name or "").strip()
        phone = (instance.phone or "").strip()
        if name and phone and not instance.setup_completed:
            instance.setup_completed = True
            instance.save(update_fields=["setup_completed", "updated_at"])


class PublicHomeConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        org = Organization.objects.filter(slug="default").first()
        s = BusinessSettings.load(org) if org else BusinessSettings.objects.first()
        if not s:
            return Response(
                {
                    "software_name": "Smart Ledger",
                    "business_name": "Smart Ledger",
                    "home_subtitle": "Billing & ledger for your shop",
                }
            )
        return Response(
            {
                "software_name": "Smart Ledger",
                "business_name": s.business_name,
                "phone": s.phone,
                "address": s.address,
                "home_title": s.home_title or "Smart Ledger",
                "home_subtitle": s.home_subtitle,
                "wholesale_option_title": s.wholesale_option_title,
                "wholesale_option_desc": s.wholesale_option_desc,
                "customer_option_title": s.customer_option_title,
                "customer_option_desc": s.customer_option_desc,
            }
        )


class BackupStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = get_organization_for_request(self.request)
        settings = BusinessSettings.load(org)
        return Response(
            {
                "auto_backup": settings.auto_backup,
                "last_updated": settings.updated_at,
                "setup_completed": settings.setup_completed,
                "message": "Auto backup enabled. Export reports and ledgers regularly.",
            }
        )


class DismissSetupView(APIView):
    """Hide first-time setup welcome for this ledger."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = get_organization_for_request(request)
        settings = BusinessSettings.load(org)
        settings.setup_completed = True
        settings.save(update_fields=["setup_completed", "updated_at"])
        return Response({"setup_completed": True})
