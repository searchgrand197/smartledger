from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from core.views import serve_spa
from messaging.whatsapp_proxy import WhatsAppProxyView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/customers/", include("customers.urls")),
    path("api/suppliers/", include("suppliers.urls")),
    path("api/products/", include("products.urls")),
    path("api/purchases/", include("purchases.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/returns/", include("returns.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/ledger/", include("ledger.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/business/", include("business.urls")),
    path("api/dashboard/", include("reports.dashboard_urls")),
    path("api/messaging/", include("messaging.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r"^whatsapp/(?P<path>.*)$", WhatsAppProxyView.as_view(), name="whatsapp_proxy"),
    re_path(r"^whatsapp/?$", WhatsAppProxyView.as_view(), name="whatsapp_proxy_root"),
    re_path(r"^(?P<path>.*)$", serve_spa),
]
