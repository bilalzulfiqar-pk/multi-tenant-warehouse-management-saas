from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from workspaces.permissions import HasWorkspace, IsWorkspaceMember

from .selectors import DashboardSelectors
from .serializers import (
    DashboardSummarySerializer,
    InventoryByWarehouseSerializer,
    LowStockProductSerializer,
    RecentMovementsSerializer,
)


class DashboardBaseView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasWorkspace, IsWorkspaceMember]


class DashboardSummaryView(DashboardBaseView):
    def get(self, request):
        serializer = DashboardSummarySerializer(
            DashboardSelectors.summary(request.workspace)
        )
        return Response(serializer.data)


class LowStockProductsView(DashboardBaseView):
    def get(self, request):
        serializer = LowStockProductSerializer(
            DashboardSelectors.low_stock_products(request.workspace),
            many=True,
        )
        return Response(serializer.data)


class InventoryByWarehouseView(DashboardBaseView):
    def get(self, request):
        serializer = InventoryByWarehouseSerializer(
            DashboardSelectors.inventory_by_warehouse(request.workspace),
            many=True,
        )
        return Response(serializer.data)


class RecentMovementsView(DashboardBaseView):
    def get(self, request):
        serializer = RecentMovementsSerializer(
            DashboardSelectors.recent_movements(request.workspace),
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)
