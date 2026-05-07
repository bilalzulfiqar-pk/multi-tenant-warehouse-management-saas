from rest_framework import permissions, viewsets
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from common.mixins import TenantScopedQuerysetMixin
from workspaces.permissions import (
    CanAdjustStock,
    CanStockInOut,
    CanTransferStock,
    HasWorkspace,
    IsWorkspaceMember,
)

from .filters import StockLevelFilter, StockMovementFilter
from .models import StockLevel, StockMovement
from .serializers import (
    AdjustStockSerializer,
    InventoryOperationResponseSerializer,
    StockInSerializer,
    StockLevelSerializer,
    StockMovementSerializer,
    StockOutSerializer,
    TransferStockSerializer,
)
from .services import InventoryService


class StockLevelViewSet(TenantScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = StockLevelSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
    ]
    queryset = StockLevel.objects.select_related(
        "product",
        "warehouse",
        "location",
    )
    filterset_class = StockLevelFilter
    search_fields = [
        "product__sku",
        "product__name",
        "warehouse__code",
        "warehouse__name",
        "location__code",
        "location__name",
    ]
    ordering_fields = [
        "product__sku",
        "warehouse__code",
        "location__code",
        "quantity",
        "updated_at",
    ]
    ordering = ["product__sku", "warehouse__code", "location__code"]


class StockMovementViewSet(TenantScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
    ]
    queryset = StockMovement.objects.select_related(
        "product",
        "source_warehouse",
        "source_location",
        "destination_warehouse",
        "destination_location",
        "performed_by",
    )
    filterset_class = StockMovementFilter
    search_fields = [
        "product__sku",
        "product__name",
        "reason",
        "notes",
        "reference_type",
    ]
    ordering_fields = ["created_at", "movement_type", "quantity", "product__sku"]
    ordering = ["-created_at"]


class InventoryActionView(GenericAPIView):
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
    ]

    def build_response(self, result):
        serializer = InventoryOperationResponseSerializer(
            {
                "message": "Stock operation completed.",
                "movements": result.movements,
            },
            context={"request": self.request},
        )
        return Response(serializer.data)


class StockInView(InventoryActionView):
    serializer_class = StockInSerializer
    permission_classes = [
        *InventoryActionView.permission_classes,
        CanStockInOut,
    ]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = InventoryService.stock_in(
            workspace=request.workspace,
            actor=request.user,
            **serializer.validated_data,
        )
        return self.build_response(result)


class StockOutView(InventoryActionView):
    serializer_class = StockOutSerializer
    permission_classes = [
        *InventoryActionView.permission_classes,
        CanStockInOut,
    ]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = InventoryService.stock_out(
            workspace=request.workspace,
            actor=request.user,
            **serializer.validated_data,
        )
        return self.build_response(result)


class AdjustStockView(InventoryActionView):
    serializer_class = AdjustStockSerializer
    permission_classes = [
        *InventoryActionView.permission_classes,
        CanAdjustStock,
    ]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = InventoryService.adjust_stock(
            workspace=request.workspace,
            actor=request.user,
            **serializer.validated_data,
        )
        return self.build_response(result)


class TransferStockView(InventoryActionView):
    serializer_class = TransferStockSerializer
    permission_classes = [
        *InventoryActionView.permission_classes,
        CanTransferStock,
    ]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = InventoryService.transfer_stock(
            workspace=request.workspace,
            actor=request.user,
            **serializer.validated_data,
        )
        return self.build_response(result)
