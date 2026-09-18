from django.urls import path

from .views import PurchaseDetailView, PurchaseListCreateView, SupplierPaymentListCreateView

urlpatterns = [
    path("", PurchaseListCreateView.as_view(), name="purchase_list"),
    path("<int:pk>/", PurchaseDetailView.as_view(), name="purchase_detail"),
    path("payments/", SupplierPaymentListCreateView.as_view(), name="supplier_payments"),
]
