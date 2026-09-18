from django.urls import path

from .portal_views import (
    CustomerPortalBillCancelView,
    CustomerPortalBillPDFView,
    CustomerPortalBillPrintDataView,
    CustomerPortalDashboardView,
    CustomerPortalLedgerPDFView,
    CustomerPortalLoginView,
    CustomerPortalProductsView,
    CustomerPortalQuickSaleHistoryView,
    CustomerPortalSimpleBillCreateView,
    CustomerPortalCategoriesView,
    CustomerPortalBillReturnEligibilityView,
    CustomerPortalSalesReturnCreateView,
    CustomerPortalSalesReturnPrintDataView,
    CustomerPortalSalesReturnWhatsAppView,
    CustomerPortalSalesReturnDetailView,
    CustomerPortalSalesReturnListView,
    CustomerPortalCustomersView,
    CustomerPortalCustomerDetailView,
    CustomerPortalCustomerPaymentsView,
    CustomerPortalCustomerLedgerPDFView,
    CustomerPortalBillUpdateView,
    CustomerPortalCustomerReminderView,
    CustomerPortalWhatsAppStatusView,
)
from .views import (
    CustomerDetailView,
    CustomerExportView,
    CustomerImportView,
    CustomerLedgerPDFView,
    CustomerListCreateView,
    CustomerPartyRatesView,
    CustomerProfileView,
)

urlpatterns = [
    path("portal/login/", CustomerPortalLoginView.as_view(), name="portal_login"),
    path("portal/dashboard/", CustomerPortalDashboardView.as_view(), name="portal_dashboard"),
    path("portal/products/", CustomerPortalProductsView.as_view(), name="portal_products"),
    path(
        "portal/products/categories/",
        CustomerPortalCategoriesView.as_view(),
        name="portal_products_categories",
    ),
    path(
        "portal/products/<int:pk>/",
        CustomerPortalProductsView.as_view(),
        name="portal_products_detail",
    ),
    path("portal/ledger/pdf/", CustomerPortalLedgerPDFView.as_view(), name="portal_ledger_pdf"),
    path(
        "portal/whatsapp/status/",
        CustomerPortalWhatsAppStatusView.as_view(),
        name="portal_whatsapp_status",
    ),
    path(
        "portal/quick-sales/",
        CustomerPortalQuickSaleHistoryView.as_view(),
        name="portal_quick_sales",
    ),
    path(
        "portal/billing/simple/create/",
        CustomerPortalSimpleBillCreateView.as_view(),
        name="portal_simple_bill_create",
    ),
    path(
        "portal/billing/<int:pk>/print-data/",
        CustomerPortalBillPrintDataView.as_view(),
        name="portal_bill_print_data",
    ),
    path(
        "portal/billing/<int:pk>/update/",
        CustomerPortalBillUpdateView.as_view(),
        name="portal_bill_update",
    ),
    path(
        "portal/billing/<int:pk>/cancel/",
        CustomerPortalBillCancelView.as_view(),
        name="portal_bill_cancel",
    ),
    path(
        "portal/billing/<int:pk>/pdf/",
        CustomerPortalBillPDFView.as_view(),
        name="portal_bill_pdf",
    ),
    path(
        "portal/billing/<int:bill_id>/return-eligibility/",
        CustomerPortalBillReturnEligibilityView.as_view(),
        name="portal_bill_return_eligibility",

    ),
    path(
        "portal/returns/create/",
        CustomerPortalSalesReturnCreateView.as_view(),
        name="portal_sales_return_create",
    ),
    path(
        "portal/returns/",
        CustomerPortalSalesReturnListView.as_view(),
        name="portal_sales_returns_list",
    ),
    path(
        "portal/returns/<int:pk>/print-data/",
        CustomerPortalSalesReturnPrintDataView.as_view(),
        name="portal_sales_return_print_data",
    ),
    path(
        "portal/returns/<int:pk>/whatsapp/",
        CustomerPortalSalesReturnWhatsAppView.as_view(),
        name="portal_sales_return_whatsapp",
    ),
    path(
        "portal/returns/<int:pk>/",
        CustomerPortalSalesReturnDetailView.as_view(),
        name="portal_sales_return_detail",
    ),
    path(
        "portal/customers/",
        CustomerPortalCustomersView.as_view(),
        name="portal_customers_list",
    ),
    path(
        "portal/customers/<int:pk>/",
        CustomerPortalCustomerDetailView.as_view(),
        name="portal_customer_detail",
    ),
    path(
        "portal/customers/<int:pk>/profile/",
        CustomerPortalCustomerDetailView.as_view(),
        name="portal_customer_profile",
    ),
    path(
        "portal/customers/payments/",
        CustomerPortalCustomerPaymentsView.as_view(),
        name="portal_customer_payments",
    ),
    path(
        "portal/customers/payments/<int:pk>/",
        CustomerPortalCustomerPaymentsView.as_view(),
        name="portal_customer_payments_detail",
    ),
    path(
        "portal/customers/<int:pk>/ledger/pdf/",
        CustomerPortalCustomerLedgerPDFView.as_view(),
        name="portal_customer_ledger_pdf",
    ),
    path(
        "portal/customers/<int:pk>/reminder/",
        CustomerPortalCustomerReminderView.as_view(),
        name="portal_customer_reminder",
    ),
    path("", CustomerListCreateView.as_view(), name="customer_list"),
    path("export/", CustomerExportView.as_view(), name="customer_export"),
    path("import/", CustomerImportView.as_view(), name="customer_import"),
    path("<int:pk>/", CustomerDetailView.as_view(), name="customer_detail"),
    path("<int:pk>/profile/", CustomerProfileView.as_view(), name="customer_profile"),
    path("<int:pk>/rates/", CustomerPartyRatesView.as_view(), name="customer_party_rates"),
    path("<int:pk>/ledger/pdf/", CustomerLedgerPDFView.as_view(), name="customer_ledger_pdf"),
]
