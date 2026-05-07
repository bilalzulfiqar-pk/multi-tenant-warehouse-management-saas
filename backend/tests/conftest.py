from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Product, ProductCategory, UnitOfMeasure
from inventory.models import StockLevel
from warehouse.models import LocationType, Warehouse, WarehouseLocation, WarehouseStatus
from workspaces.models import (
    MembershipStatus,
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client):
    def factory(user):
        api_client.force_authenticate(user=user)
        return api_client

    return factory


@pytest.fixture
def user_factory(django_user_model):
    def factory(email="user@example.com", full_name=None, password="strong-password-123"):
        return django_user_model.objects.create_user(
            email=email,
            password=password,
            full_name=full_name or email.split("@")[0].title(),
        )

    return factory


@pytest.fixture
def owner_user(user_factory):
    return user_factory("owner@example.com")


@pytest.fixture
def staff_user(user_factory):
    return user_factory("staff@example.com")


@pytest.fixture
def viewer_user(user_factory):
    return user_factory("viewer@example.com")


@pytest.fixture
def workspace_factory():
    counter = {"value": 0}

    def factory(owner, subdomain=None, status=WorkspaceStatus.ACTIVE):
        counter["value"] += 1
        subdomain = subdomain or f"tenant{counter['value']}"
        workspace = Workspace.objects.create(
            name=f"{subdomain.title()} Logistics",
            slug=subdomain,
            subdomain=subdomain,
            status=status,
            created_by=owner,
        )
        WorkspaceMembership.objects.create(
            workspace=workspace,
            user=owner,
            role=WorkspaceRole.OWNER,
            status=MembershipStatus.ACTIVE,
            joined_at=timezone.now(),
        )
        return workspace

    return factory


@pytest.fixture
def workspace(workspace_factory, owner_user):
    return workspace_factory(owner_user, subdomain="acme")


@pytest.fixture
def member_factory():
    def factory(
        workspace,
        user,
        role=WorkspaceRole.STAFF,
        status=MembershipStatus.ACTIVE,
    ):
        return WorkspaceMembership.objects.create(
            workspace=workspace,
            user=user,
            role=role,
            status=status,
            joined_at=timezone.now() if status == MembershipStatus.ACTIVE else None,
        )

    return factory


@pytest.fixture
def tenant_host():
    def factory(workspace):
        return f"{workspace.subdomain}.localhost:8000"

    return factory


@pytest.fixture
def category_factory():
    def factory(workspace, name="General"):
        return ProductCategory.objects.create(workspace=workspace, name=name)

    return factory


@pytest.fixture
def unit_factory():
    def factory(workspace, name="Pieces", abbreviation="pcs"):
        return UnitOfMeasure.objects.create(
            workspace=workspace,
            name=name,
            abbreviation=abbreviation,
        )

    return factory


@pytest.fixture
def product_factory(unit_factory):
    def factory(
        workspace,
        unit=None,
        category=None,
        sku="SKU-001",
        name=None,
        is_active=True,
        low_stock_threshold=None,
    ):
        unit = unit or unit_factory(workspace)
        return Product.objects.create(
            workspace=workspace,
            category=category,
            unit=unit,
            sku=sku,
            name=name or f"Product {sku}",
            is_active=is_active,
            low_stock_threshold=low_stock_threshold,
        )

    return factory


@pytest.fixture
def warehouse_factory():
    def factory(workspace, code="MAIN", status=WarehouseStatus.ACTIVE):
        return Warehouse.objects.create(
            workspace=workspace,
            name=f"{code} Warehouse",
            code=code,
            status=status,
        )

    return factory


@pytest.fixture
def location_factory():
    def factory(
        workspace,
        warehouse,
        code="A1",
        location_type=LocationType.STORAGE,
        status=WarehouseStatus.ACTIVE,
    ):
        return WarehouseLocation.objects.create(
            workspace=workspace,
            warehouse=warehouse,
            name=f"Location {code}",
            code=code,
            location_type=location_type,
            status=status,
        )

    return factory


@pytest.fixture
def stock_level_factory():
    def factory(workspace, product, warehouse, location, quantity="0.000"):
        return StockLevel.objects.create(
            workspace=workspace,
            product=product,
            warehouse=warehouse,
            location=location,
            quantity=Decimal(quantity),
        )

    return factory


@pytest.fixture
def inventory_context(
    workspace,
    product_factory,
    warehouse_factory,
    location_factory,
):
    product = product_factory(workspace)
    warehouse = warehouse_factory(workspace)
    location = location_factory(workspace, warehouse)
    return {
        "workspace": workspace,
        "product": product,
        "warehouse": warehouse,
        "location": location,
    }
