from django.urls import path

from .views import SupplierDetailView, SupplierListCreateView, SupplierProfileView

urlpatterns = [
    path("", SupplierListCreateView.as_view(), name="supplier_list"),
    path("<int:pk>/", SupplierDetailView.as_view(), name="supplier_detail"),
    path("<int:pk>/profile/", SupplierProfileView.as_view(), name="supplier_profile"),
]
