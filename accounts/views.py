from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from billing.walkin import get_walkin_customer
from customers.portal import make_portal_token
from core.tenant import get_organization_for_request, get_user_organization

from .models import UserProfile

User = get_user_model()


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            profile = None
        org = get_user_organization(user)
        setup_completed = False
        if org:
            from business.models import BusinessSettings

            setup_completed = BusinessSettings.load(org).setup_completed
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_owner": profile.role == UserProfile.ROLE_OWNER if profile else user.is_superuser,
                "role": profile.role if profile else "owner",
                "organization_id": org.id if org else None,
                "organization_name": org.name if org else None,
                "organization_slug": org.slug if org else None,
                "setup_completed": setup_completed,
            }
        )


class PortalTokenView(APIView):
    """Issue quick-sale portal token for an already signed-in wholesale user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = get_organization_for_request(request)
        if org is None:
            return Response(
                {"detail": "This account is not linked to a ledger."},
                status=status.HTTP_403_FORBIDDEN,
            )
        walkin = get_walkin_customer(org)
        return Response(
            {
                "token": make_portal_token(walkin.id),
                "mode": "quick_sale",
                "label": "Walk-in / Quick Sale",
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old = request.data.get("old_password")
        new = request.data.get("new_password")
        if not request.user.check_password(old):
            return Response({"detail": "Current password is incorrect."}, status=400)
        if not new or len(new) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=400)
        request.user.set_password(new)
        request.user.save()
        return Response({"detail": "Password updated."})
