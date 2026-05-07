from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.mixins import TenantScopedQuerysetMixin
from workspaces.models import WorkspaceRole
from workspaces.permissions import HasWorkspace, IsWorkspaceMember

from .models import Warehouse, WarehouseLocation, WarehouseStatus
from .permissions import CanReadOrManageWarehouseSetup
from .serializers import WarehouseLocationSerializer, WarehouseSerializer


class ActiveListMixin:
    manager_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)

    def can_view_inactive(self):
        membership = getattr(self.request, "workspace_membership", None)
        return bool(membership and membership.role in self.manager_roles)

    def filter_active_for_list(self, queryset):
        if self.action != "list":
            return queryset

        requested_status = self.request.query_params.get("status", WarehouseStatus.ACTIVE)

        if requested_status == "all":
            return queryset if self.can_view_inactive() else queryset.filter(status=WarehouseStatus.ACTIVE)

        if requested_status == WarehouseStatus.INACTIVE:
            return queryset.filter(status=WarehouseStatus.INACTIVE) if self.can_view_inactive() else queryset.none()

        return queryset.filter(status=WarehouseStatus.ACTIVE)


class WarehouseViewSet(ActiveListMixin, TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
        CanReadOrManageWarehouseSetup,
    ]
    queryset = Warehouse.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "city", "country"]
    ordering_fields = ["name", "code", "city", "country", "status", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_active_for_list(queryset)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        warehouse = self.get_object()
        warehouse.status = WarehouseStatus.INACTIVE
        warehouse.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(warehouse).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        warehouse = self.get_object()
        warehouse.status = WarehouseStatus.ACTIVE
        warehouse.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(warehouse).data)


class WarehouseLocationViewSet(
    ActiveListMixin,
    TenantScopedQuerysetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = WarehouseLocationSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
        CanReadOrManageWarehouseSetup,
    ]
    queryset = WarehouseLocation.objects.select_related("warehouse")
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "warehouse__name", "warehouse__code"]
    ordering_fields = ["name", "code", "location_type", "status", "created_at"]
    ordering = ["warehouse__name", "code"]

    def get_queryset(self):
        queryset = super().get_queryset()
        warehouse_id = self.request.query_params.get("warehouse")
        location_type = self.request.query_params.get("location_type")
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if location_type:
            queryset = queryset.filter(location_type=location_type)
        return self.filter_active_for_list(queryset)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        location = self.get_object()
        location.status = WarehouseStatus.INACTIVE
        location.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(location).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        location = self.get_object()
        location.status = WarehouseStatus.ACTIVE
        location.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(location).data)
