from django.urls import path

from .views import (
    ProductCategoryListView,
    ProductDetailView,
    ProductExportView,
    ProductImportView,
    ProductListCreateView,
    ProductPurchaseHistoryView,
    StockAdjustView,
    StockMovementListView,
)

urlpatterns = [
    path("categories/", ProductCategoryListView.as_view(), name="categories"),
    path("stock-movements/", StockMovementListView.as_view(), name="stock_movements"),
    path("", ProductListCreateView.as_view(), name="product_list"),
    path("export/", ProductExportView.as_view(), name="product_export"),
    path("import/", ProductImportView.as_view(), name="product_import"),
    path("<int:pk>/stock-movements/", StockMovementListView.as_view(), name="product_stock_movements"),
    path("<int:pk>/stock-adjust/", StockAdjustView.as_view(), name="product_stock_adjust"),
    path("<int:pk>/", ProductDetailView.as_view(), name="product_detail"),
    path("<int:pk>/purchase-history/", ProductPurchaseHistoryView.as_view(), name="purchase_history"),
]
