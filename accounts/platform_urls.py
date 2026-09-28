from django.urls import path

from .platform_views import (
    PlatformShopDetailView,
    PlatformShopListCreateView,
    PlatformShopResetPasswordView,
    PlatformShopSupportLoginView,
)

urlpatterns = [
    path("shops/", PlatformShopListCreateView.as_view(), name="platform-shops"),
    path("shops/<int:pk>/", PlatformShopDetailView.as_view(), name="platform-shop-detail"),
    path(
        "shops/<int:pk>/reset-password/",
        PlatformShopResetPasswordView.as_view(),
        name="platform-shop-reset-password",
    ),
    path(
        "shops/<int:pk>/support-login/",
        PlatformShopSupportLoginView.as_view(),
        name="platform-shop-support-login",
    ),
]
