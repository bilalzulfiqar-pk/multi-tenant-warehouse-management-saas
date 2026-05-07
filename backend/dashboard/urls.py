from django.urls import path

from .views import (
    DashboardSummaryView,
    InventoryByWarehouseView,
    LowStockProductsView,
    RecentMovementsView,
)

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("dashboard/low-stock/", LowStockProductsView.as_view(), name="dashboard-low-stock"),
    path(
        "dashboard/inventory-by-warehouse/",
        InventoryByWarehouseView.as_view(),
        name="dashboard-inventory-by-warehouse",
    ),
    path(
        "dashboard/recent-movements/",
        RecentMovementsView.as_view(),
        name="dashboard-recent-movements",
    ),
]
