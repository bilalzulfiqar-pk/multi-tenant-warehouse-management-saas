from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

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

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        category = self.get_object()
        category.is_active = False
        category.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(category).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        category = self.get_object()
        category.is_active = True
        category.save(update_fields=["is_active", "updated_at"])
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

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        unit = self.get_object()
        unit.is_active = False
        unit.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(unit).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        unit = self.get_object()
        unit.is_active = True
        unit.save(update_fields=["is_active", "updated_at"])
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

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        product = self.get_object()
        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(product).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        product = self.get_object()
        product.is_active = True
        product.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(product).data)
