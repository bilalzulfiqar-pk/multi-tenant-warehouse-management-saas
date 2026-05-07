from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    AdjustStockView,
    StockInView,
    StockLevelViewSet,
    StockMovementViewSet,
    StockOutView,
    TransferStockView,
)

router = SimpleRouter()
router.register("stock-levels", StockLevelViewSet, basename="stock-level")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = [
    *router.urls,
    path("inventory/stock-in/", StockInView.as_view(), name="inventory-stock-in"),
    path("inventory/stock-out/", StockOutView.as_view(), name="inventory-stock-out"),
    path("inventory/adjust/", AdjustStockView.as_view(), name="inventory-adjust"),
    path("inventory/transfer/", TransferStockView.as_view(), name="inventory-transfer"),
]
