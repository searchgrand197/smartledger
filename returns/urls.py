from django.urls import path

from .views import (
    BillReturnEligibilityView,
    SalesReturnCancelView,
    SalesReturnCreateView,
    SalesReturnDetailView,
    SalesReturnListView,
    SalesReturnPrintDataView,
    SalesReturnWhatsAppView,
)

urlpatterns = [
    path("", SalesReturnListView.as_view(), name="sales_return_list"),
    path("create/", SalesReturnCreateView.as_view(), name="sales_return_create"),
    path("bill/<int:bill_id>/eligibility/", BillReturnEligibilityView.as_view(), name="bill_return_eligibility"),
    path("<int:pk>/", SalesReturnDetailView.as_view(), name="sales_return_detail"),
    path("<int:pk>/cancel/", SalesReturnCancelView.as_view(), name="sales_return_cancel"),
    path("<int:pk>/print-data/", SalesReturnPrintDataView.as_view(), name="sales_return_print_data"),
    path("<int:pk>/whatsapp/", SalesReturnWhatsAppView.as_view(), name="sales_return_whatsapp"),
]
