from django.urls import path

from .views import PaymentDetailView, PaymentDueListView, PaymentListCreateView, PaymentPrintDataView, PaymentReminderView

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payment_list"),
    path("<int:pk>/", PaymentDetailView.as_view(), name="payment_detail"),
    path("<int:pk>/print-data/", PaymentPrintDataView.as_view(), name="payment_print_data"),
    path("dues/", PaymentDueListView.as_view(), name="payment_dues"),
    path("reminder/<int:pk>/", PaymentReminderView.as_view(), name="payment_reminder"),
]
