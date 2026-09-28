from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Organization, SupportLoginLog, UserProfile
from accounts.permissions import IsPlatformAdmin
from accounts.services import LedgerProvisioningError, create_ledger_shop

User = get_user_model()


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _serialize_shop(org: Organization) -> dict:
    members = list(org.members.all())
    owner = next((m for m in members if m.role == UserProfile.ROLE_OWNER), members[0] if members else None)
    owner_user = owner.user if owner else None
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "is_active": org.is_active,
        "created_at": org.created_at.isoformat() if org.created_at else None,
        "owner": (
            {
                "id": owner_user.id,
                "username": owner_user.username,
                "email": owner_user.email,
                "is_active": owner_user.is_active and (owner.is_active if owner else True),
                "last_login": owner_user.last_login.isoformat() if owner_user.last_login else None,
            }
            if owner_user
            else None
        ),
        "member_count": len(members),
    }


class PlatformShopListCreateView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        orgs = (
            Organization.objects.all()
            .prefetch_related(
                Prefetch(
                    "members",
                    queryset=UserProfile.objects.select_related("user").order_by("id"),
                )
            )
            .order_by("-created_at")
        )
        return Response([_serialize_shop(org) for org in orgs])

    def post(self, request):
        data = request.data or {}
        try:
            org, _user = create_ledger_shop(
                shop_name=data.get("shop_name") or data.get("name") or "",
                username=data.get("username") or "",
                password=data.get("password") or "",
                slug=data.get("slug") or "",
                email=data.get("email") or "",
            )
        except LedgerProvisioningError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        org = (
            Organization.objects.prefetch_related(
                Prefetch("members", queryset=UserProfile.objects.select_related("user"))
            ).get(pk=org.pk)
        )
        return Response(_serialize_shop(org), status=status.HTTP_201_CREATED)


class PlatformShopDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def patch(self, request, pk):
        try:
            org = Organization.objects.prefetch_related(
                Prefetch("members", queryset=UserProfile.objects.select_related("user"))
            ).get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data or {}
        if "is_active" in data:
            org.is_active = bool(data["is_active"])
            org.save(update_fields=["is_active"])
            for member in org.members.all():
                member.is_active = org.is_active
                member.save(update_fields=["is_active"])
                if not member.user.is_superuser:
                    member.user.is_active = org.is_active
                    member.user.save(update_fields=["is_active"])

        if "name" in data and str(data["name"]).strip():
            org.name = str(data["name"]).strip()
            org.save(update_fields=["name"])

        org = (
            Organization.objects.prefetch_related(
                Prefetch("members", queryset=UserProfile.objects.select_related("user"))
            ).get(pk=org.pk)
        )
        return Response(_serialize_shop(org))


class PlatformShopResetPasswordView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=status.HTTP_404_NOT_FOUND)

        password = (request.data or {}).get("password") or ""
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=400)

        owner = (
            UserProfile.objects.select_related("user")
            .filter(organization=org, role=UserProfile.ROLE_OWNER)
            .first()
        )
        if owner is None:
            return Response({"detail": "Shop has no owner login."}, status=400)

        owner.user.set_password(password)
        owner.user.save(update_fields=["password"])
        return Response({"detail": "Password updated.", "username": owner.user.username})


class PlatformShopSupportLoginView(APIView):
    """Issue shop JWT for the platform admin (support / open ledger)."""

    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=status.HTTP_404_NOT_FOUND)

        if not org.is_active:
            return Response({"detail": "This shop is disabled."}, status=400)

        owner = (
            UserProfile.objects.select_related("user")
            .filter(organization=org, role=UserProfile.ROLE_OWNER, is_active=True)
            .first()
        )
        if owner is None or not owner.user.is_active:
            return Response({"detail": "Shop has no active owner login."}, status=400)

        user = owner.user
        refresh = RefreshToken.for_user(user)
        refresh["support_access"] = True
        refresh["support_by"] = request.user.username
        access = refresh.access_token
        access["support_access"] = True
        access["support_by"] = request.user.username

        SupportLoginLog.objects.create(
            shop_user=user,
            support_admin=request.user,
            organization=org,
            ip_address=_client_ip(request),
        )

        return Response(
            {
                "access": str(access),
                "refresh": str(refresh),
                "support_access": True,
                "username": user.username,
                "organization_id": org.id,
                "organization_name": org.name,
            }
        )
