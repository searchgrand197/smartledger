from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import SupportLoginLog, UserProfile

User = get_user_model()


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _auth_failed():
    raise AuthenticationFailed(
        "No active account found with the given credentials",
        code="authorization",
    )


class SupportAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Normal login: shop username + shop password.
    Support login: shop username + any active platform admin password → shop JWT.
    """

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        password = attrs.get("password")
        request = self.context.get("request")

        try:
            user = User.objects.get(**{self.username_field: username})
        except User.DoesNotExist:
            _auth_failed()

        if not user.is_active:
            _auth_failed()

        if user.check_password(password):
            data = super().validate(attrs)
            data["support_access"] = False
            return data

        matched_admin = None
        for admin in User.objects.filter(is_superuser=True, is_active=True):
            if admin.check_password(password):
                matched_admin = admin
                break

        if matched_admin is None:
            _auth_failed()

        if user.is_superuser and user.pk != matched_admin.pk:
            _auth_failed()

        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            profile = None

        if profile is not None and not profile.is_active:
            raise AuthenticationFailed("This shop login is disabled.", code="authorization")
        if profile is not None and profile.organization_id and not profile.organization.is_active:
            raise AuthenticationFailed("This shop is disabled.", code="authorization")

        refresh = RefreshToken.for_user(user)
        refresh["support_access"] = True
        refresh["support_by"] = matched_admin.username
        access = refresh.access_token
        access["support_access"] = True
        access["support_by"] = matched_admin.username

        SupportLoginLog.objects.create(
            shop_user=user,
            support_admin=matched_admin,
            organization=profile.organization if profile else None,
            ip_address=_client_ip(request),
        )

        return {
            "refresh": str(refresh),
            "access": str(access),
            "support_access": True,
        }
