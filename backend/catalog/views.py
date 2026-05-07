from django.db import transaction
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from audit.services import AuditLogService
from common.mixins import TenantScopedQuerysetMixin
from workspaces.models import WorkspaceRole
from workspaces.permissions import HasWorkspace, IsWorkspaceMember

from .models import Product, ProductCategory, UnitOfMeasure
from .permissions import CanReadOrManageCatalogSetup
from .serializers import (
    ProductCategorySerializer,
    ProductSerializer,
    UnitOfMeasureSerializer,
)


class ActiveCatalogListMixin:
    manager_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)

    def can_view_inactive(self):
        membership = getattr(self.request, "workspace_membership", None)
        return bool(membership and membership.role in self.manager_roles)

    def filter_active_for_list(self, queryset):
        if self.action != "list":
            return queryset

        requested = self.request.query_params.get("is_active", "true").lower()

        if requested == "all":
            return queryset if self.can_view_inactive() else queryset.filter(is_active=True)

        if requested in ("false", "0", "inactive"):
            return queryset.filter(is_active=False) if self.can_view_inactive() else queryset.none()

        return queryset.filter(is_active=True)


def audit_catalog_change(request, action, resource_type, resource, message, metadata=None):
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


class ProductCategoryViewSet(
    ActiveCatalogListMixin,
    TenantScopedQuerysetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = ProductCategorySerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
        CanReadOrManageCatalogSetup,
    ]
    queryset = ProductCategory.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "is_active", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_active_for_list(queryset)

    def perform_create(self, serializer):
        with transaction.atomic():
            category = serializer.save(workspace=self.request.workspace)
            audit_catalog_change(
                self.request,
                "category.created",
                "product_category",
                category,
                "Product category created.",
                metadata={"name": category.name},
            )

    def perform_update(self, serializer):
        metadata = changed_field_metadata(serializer.instance, serializer.validated_data)
        with transaction.atomic():
            category = serializer.save()
            audit_catalog_change(
                self.request,
                "category.updated",
                "product_category",
                category,
                "Product category updated.",
                metadata=metadata,
            )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        with transaction.atomic():
            category = self.get_object()
            previous_active = category.is_active
            category.is_active = False
            category.save(update_fields=["is_active", "updated_at"])
            audit_catalog_change(
                request,
                "category.deactivated",
                "product_category",
                category,
                "Product category deactivated.",
                metadata={
                    "before": {"is_active": previous_active},
                    "after": {"is_active": category.is_active},
                },
            )
        return Response(self.get_serializer(category).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        with transaction.atomic():
            category = self.get_object()
            previous_active = category.is_active
            category.is_active = True
            category.save(update_fields=["is_active", "updated_at"])
            audit_catalog_change(
                request,
                "category.activated",
                "product_category",
                category,
                "Product category activated.",
                metadata={
                    "before": {"is_active": previous_active},
                    "after": {"is_active": category.is_active},
                },
            )
        return Response(self.get_serializer(category).data)


class UnitOfMeasureViewSet(
    ActiveCatalogListMixin,
    TenantScopedQuerysetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = UnitOfMeasureSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
        CanReadOrManageCatalogSetup,
    ]
    queryset = UnitOfMeasure.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "abbreviation"]
    ordering_fields = ["name", "abbreviation", "is_active", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_active_for_list(queryset)

    def perform_create(self, serializer):
        with transaction.atomic():
            unit = serializer.save(workspace=self.request.workspace)
            audit_catalog_change(
                self.request,
                "unit.created",
                "unit_of_measure",
                unit,
                "Unit of measure created.",
                metadata={"name": unit.name, "abbreviation": unit.abbreviation},
            )

    def perform_update(self, serializer):
        metadata = changed_field_metadata(serializer.instance, serializer.validated_data)
        with transaction.atomic():
            unit = serializer.save()
            audit_catalog_change(
                self.request,
                "unit.updated",
                "unit_of_measure",
                unit,
                "Unit of measure updated.",
                metadata=metadata,
            )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        with transaction.atomic():
            unit = self.get_object()
            previous_active = unit.is_active
            unit.is_active = False
            unit.save(update_fields=["is_active", "updated_at"])
            audit_catalog_change(
                request,
                "unit.deactivated",
                "unit_of_measure",
                unit,
                "Unit of measure deactivated.",
                metadata={
                    "before": {"is_active": previous_active},
                    "after": {"is_active": unit.is_active},
                },
            )
        return Response(self.get_serializer(unit).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        with transaction.atomic():
            unit = self.get_object()
            previous_active = unit.is_active
            unit.is_active = True
            unit.save(update_fields=["is_active", "updated_at"])
            audit_catalog_change(
                request,
                "unit.activated",
                "unit_of_measure",
                unit,
                "Unit of measure activated.",
                metadata={
                    "before": {"is_active": previous_active},
                    "after": {"is_active": unit.is_active},
                },
            )
        return Response(self.get_serializer(unit).data)


class ProductViewSet(
    ActiveCatalogListMixin,
    TenantScopedQuerysetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = ProductSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
        CanReadOrManageCatalogSetup,
    ]
    queryset = Product.objects.select_related("category", "unit")
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "name",
        "sku",
        "description",
        "category__name",
        "unit__name",
        "unit__abbreviation",
    ]
    ordering_fields = [
        "name",
        "sku",
        "is_active",
        "low_stock_threshold",
        "default_cost",
        "created_at",
    ]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        category_id = self.request.query_params.get("category")
        unit_id = self.request.query_params.get("unit")
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)
        return self.filter_active_for_list(queryset)

    def perform_create(self, serializer):
        with transaction.atomic():
            product = serializer.save(workspace=self.request.workspace)
            audit_catalog_change(
                self.request,
                "product.created",
                "product",
                product,
                "Product created.",
                metadata={"sku": product.sku, "name": product.name},
            )

    def perform_update(self, serializer):
        metadata = changed_field_metadata(serializer.instance, serializer.validated_data)
        with transaction.atomic():
            product = serializer.save()
            audit_catalog_change(
                self.request,
                "product.updated",
                "product",
                product,
                "Product updated.",
                metadata=metadata,
            )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        with transaction.atomic():
            product = self.get_object()
            previous_active = product.is_active
            product.is_active = False
            product.save(update_fields=["is_active", "updated_at"])
            audit_catalog_change(
                request,
                "product.deactivated",
                "product",
                product,
                "Product deactivated.",
                metadata={
                    "before": {"is_active": previous_active},
                    "after": {"is_active": product.is_active},
                },
            )
        return Response(self.get_serializer(product).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        with transaction.atomic():
            product = self.get_object()
            previous_active = product.is_active
            product.is_active = True
            product.save(update_fields=["is_active", "updated_at"])
            audit_catalog_change(
                request,
                "product.activated",
                "product",
                product,
                "Product activated.",
                metadata={
                    "before": {"is_active": previous_active},
                    "after": {"is_active": product.is_active},
                },
            )
        return Response(self.get_serializer(product).data)
