from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import ChangePasswordView, LoginView, MeView, PortalTokenView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("portal-token/", PortalTokenView.as_view(), name="portal_token"),
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
]
