from django.db import transaction
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from audit.services import AuditLogService
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


def audit_setup_change(request, action, resource_type, resource, message, metadata=None):
    AuditLogService.record(
        workspace=request.workspace,
        actor=request.user,
        action=action,
        resource_type=resource_type,
        resource_id=resource.id,
        message=message,
        metadata=metadata or {},
    )


def changed_field_metadata(instance, validated_data):
    before = {}
    after = {}
    for field in validated_data:
        before[field] = getattr(instance, field)
        after[field] = validated_data[field]
    return {"before": before, "after": after}


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

    def perform_create(self, serializer):
        with transaction.atomic():
            warehouse = serializer.save(workspace=self.request.workspace)
            audit_setup_change(
                self.request,
                "warehouse.created",
                "warehouse",
                warehouse,
                "Warehouse created.",
                metadata={"code": warehouse.code, "name": warehouse.name},
            )

    def perform_update(self, serializer):
        metadata = changed_field_metadata(serializer.instance, serializer.validated_data)
        with transaction.atomic():
            warehouse = serializer.save()
            audit_setup_change(
                self.request,
                "warehouse.updated",
                "warehouse",
                warehouse,
                "Warehouse updated.",
                metadata=metadata,
            )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        with transaction.atomic():
            warehouse = self.get_object()
            previous_status = warehouse.status
            warehouse.status = WarehouseStatus.INACTIVE
            warehouse.save(update_fields=["status", "updated_at"])
            audit_setup_change(
                request,
                "warehouse.deactivated",
                "warehouse",
                warehouse,
                "Warehouse deactivated.",
                metadata={
                    "before": {"status": previous_status},
                    "after": {"status": warehouse.status},
                },
            )
        return Response(self.get_serializer(warehouse).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        with transaction.atomic():
            warehouse = self.get_object()
            previous_status = warehouse.status
            warehouse.status = WarehouseStatus.ACTIVE
            warehouse.save(update_fields=["status", "updated_at"])
            audit_setup_change(
                request,
                "warehouse.activated",
                "warehouse",
                warehouse,
                "Warehouse activated.",
                metadata={
                    "before": {"status": previous_status},
                    "after": {"status": warehouse.status},
                },
            )
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

    def perform_create(self, serializer):
        with transaction.atomic():
            location = serializer.save(workspace=self.request.workspace)
            audit_setup_change(
                self.request,
                "location.created",
                "warehouse_location",
                location,
                "Warehouse location created.",
                metadata={
                    "code": location.code,
                    "name": location.name,
                    "warehouse_id": str(location.warehouse_id),
                },
            )

    def perform_update(self, serializer):
        metadata = changed_field_metadata(serializer.instance, serializer.validated_data)
        with transaction.atomic():
            location = serializer.save()
            audit_setup_change(
                self.request,
                "location.updated",
                "warehouse_location",
                location,
                "Warehouse location updated.",
                metadata=metadata,
            )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        with transaction.atomic():
            location = self.get_object()
            previous_status = location.status
            location.status = WarehouseStatus.INACTIVE
            location.save(update_fields=["status", "updated_at"])
            audit_setup_change(
                request,
                "location.deactivated",
                "warehouse_location",
                location,
                "Warehouse location deactivated.",
                metadata={
                    "before": {"status": previous_status},
                    "after": {"status": location.status},
                },
            )
        return Response(self.get_serializer(location).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        with transaction.atomic():
            location = self.get_object()
            previous_status = location.status
            location.status = WarehouseStatus.ACTIVE
            location.save(update_fields=["status", "updated_at"])
            audit_setup_change(
                request,
                "location.activated",
                "warehouse_location",
                location,
                "Warehouse location activated.",
                metadata={
                    "before": {"status": previous_status},
                    "after": {"status": location.status},
                },
            )
        return Response(self.get_serializer(location).data)
