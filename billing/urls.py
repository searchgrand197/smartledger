from django.urls import path

from .views import (
    BillCancelView,
    BillCreateView,
    BillDetailView,
    BillInvoicePDFView,
    BillInvoicePrintDataView,
    BillListView,
    BillingContextView,
    BillingRateHintView,
    SimpleBillCreateView,
    WhatsAppStatusView,
    WhatsAppDisconnectView,
    WhatsAppRestartView,
    BillUpdateView,
    BillSendWhatsAppView,
)

urlpatterns = [
    path("", BillListView.as_view(), name="bill_list"),
    path("create/", BillCreateView.as_view(), name="bill_create"),
    path("simple/create/", SimpleBillCreateView.as_view(), name="simple_bill_create"),
    path("context/", BillingContextView.as_view(), name="billing_context"),
    path("rate-hint/", BillingRateHintView.as_view(), name="billing_rate_hint"),
    path("<int:pk>/", BillDetailView.as_view(), name="bill_detail"),
    path("<int:pk>/update/", BillUpdateView.as_view(), name="bill_update"),
    path("<int:pk>/cancel/", BillCancelView.as_view(), name="bill_cancel"),
    path("<int:pk>/pdf/", BillInvoicePDFView.as_view(), name="bill_pdf"),
    path("<int:pk>/print-data/", BillInvoicePrintDataView.as_view(), name="bill_print_data"),
    path("<int:pk>/send-whatsapp/", BillSendWhatsAppView.as_view(), name="bill_send_whatsapp"),
    path("whatsapp/status/", WhatsAppStatusView.as_view(), name="whatsapp_status"),
    path("whatsapp/disconnect/", WhatsAppDisconnectView.as_view(), name="whatsapp_disconnect"),
    path("whatsapp/restart/", WhatsAppRestartView.as_view(), name="whatsapp_restart"),
]

