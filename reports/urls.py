from django.urls import path

from .views import (
    CollectionReportView,
    CreditNoteReportView,
    CustomerDueReportView,
    DailySalesReportView,
    ProfitReportView,
    PurchaseReportView,
    RefundReportView,
    ReportExportView,
    ReturnsByCustomerReportView,
    ReturnsByPartyReportView,
    ReturnsByProductReportView,
    SalesReturnsReportView,
    StockReportView,
)

urlpatterns = [
    path("daily-sales/", DailySalesReportView.as_view(), name="daily_sales"),
    path("customer-dues/", CustomerDueReportView.as_view(), name="customer_dues"),
    path("profit/", ProfitReportView.as_view(), name="profit"),
    path("stock/", StockReportView.as_view(), name="stock"),
    path("collections/", CollectionReportView.as_view(), name="collections"),
    path("purchases/", PurchaseReportView.as_view(), name="purchases"),
    path("sales-returns/", SalesReturnsReportView.as_view(), name="sales_returns"),
    path("returns-by-product/", ReturnsByProductReportView.as_view(), name="returns_by_product"),
    path("returns-by-customer/", ReturnsByCustomerReportView.as_view(), name="returns_by_customer"),
    path("returns-by-party/", ReturnsByPartyReportView.as_view(), name="returns_by_party"),
    path("refunds/", RefundReportView.as_view(), name="refunds"),
    path("credit-notes/", CreditNoteReportView.as_view(), name="credit_notes"),
    path("export/", ReportExportView.as_view(), name="report_export"),
]
