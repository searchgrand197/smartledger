from django.urls import path

from .views import CustomerLedgerView, LedgerPDFView, LedgerWhatsAppView

urlpatterns = [
    path("customer/<int:customer_id>/", CustomerLedgerView.as_view(), name="customer_ledger"),
    path("customer/<int:customer_id>/pdf/", LedgerPDFView.as_view(), name="ledger_pdf"),
    path("customer/<int:customer_id>/whatsapp/", LedgerWhatsAppView.as_view(), name="ledger_whatsapp"),
]
