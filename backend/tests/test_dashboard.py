from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Product, UnitOfMeasure
from inventory.models import StockLevel, StockMovement, StockMovementType
from warehouse.models import Warehouse, WarehouseLocation, WarehouseStatus
from workspaces.models import (
    MembershipStatus,
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceStatus,
)


pytestmark = pytest.mark.django_db


def api_client(user=None):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


def create_user(django_user_model, email):
    return django_user_model.objects.create_user(
        email=email,
        password="strong-password-123",
        full_name=email.split("@")[0].title(),
    )


def create_workspace(owner, subdomain="acme"):
    workspace = Workspace.objects.create(
        name=f"{subdomain.title()} Logistics",
        slug=subdomain,
        subdomain=subdomain,
        status=WorkspaceStatus.ACTIVE,
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


def add_member(workspace, user, role=WorkspaceRole.STAFF):
    return WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=role,
        status=MembershipStatus.ACTIVE,
        joined_at=timezone.now(),
    )


def tenant_host(workspace):
    return f"{workspace.subdomain}.localhost:8000"


def create_unit(workspace):
    return UnitOfMeasure.objects.create(
        workspace=workspace,
        name="Pieces",
        abbreviation="pcs",
    )


def create_product(workspace, unit, sku, threshold=None, is_active=True):
    return Product.objects.create(
        workspace=workspace,
        unit=unit,
        name=f"Product {sku}",
        sku=sku,
        low_stock_threshold=threshold,
        is_active=is_active,
    )


def create_warehouse(workspace, code, status=WarehouseStatus.ACTIVE):
    return Warehouse.objects.create(
        workspace=workspace,
        name=f"{code} Warehouse",
        code=code,
        status=status,
    )


def create_location(workspace, warehouse, code):
    return WarehouseLocation.objects.create(
        workspace=workspace,
        warehouse=warehouse,
        name=f"Location {code}",
        code=code,
    )


def create_stock_level(workspace, product, warehouse, location, quantity):
    return StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
        quantity=Decimal(quantity),
    )


def create_movement(workspace, product, actor, quantity="1.000"):
    return StockMovement.objects.create(
        workspace=workspace,
        product=product,
        movement_type=StockMovementType.STOCK_IN,
        quantity=Decimal(quantity),
        performed_by=actor,
    )


def test_dashboard_summary_only_includes_request_workspace(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)
    acme_product = create_product(acme, acme_unit, "ACME-001", threshold="10.000")
    create_product(acme, acme_unit, "ACME-INACTIVE", is_active=False)
    beta_product = create_product(beta, beta_unit, "BETA-001", threshold="100.000")
    acme_warehouse = create_warehouse(acme, "MAIN")
    create_warehouse(acme, "OLD", status=WarehouseStatus.INACTIVE)
    beta_warehouse = create_warehouse(beta, "BETA")
    acme_location = create_location(acme, acme_warehouse, "A1")
    beta_location = create_location(beta, beta_warehouse, "B1")
    create_stock_level(acme, acme_product, acme_warehouse, acme_location, "6.000")
    create_stock_level(beta, beta_product, beta_warehouse, beta_location, "500.000")
    create_movement(acme, acme_product, acme_owner)
    create_movement(beta, beta_product, beta_owner)

    response = api_client(acme_owner).get(
        "/api/dashboard/summary/",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert response.data == {
        "total_products": 2,
        "active_products": 1,
        "total_warehouses": 2,
        "active_warehouses": 1,
        "low_stock_products": 1,
        "total_stock_quantity": "6.000",
        "recent_movements_count": 1,
    }


def test_low_stock_calculation_sums_all_locations_and_skips_null_or_zero_thresholds(
    django_user_model,
):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    unit = create_unit(workspace)
    warehouse = create_warehouse(workspace, "MAIN")
    first_location = create_location(workspace, warehouse, "A1")
    second_location = create_location(workspace, warehouse, "A2")
    low_product = create_product(workspace, unit, "LOW", threshold="10.000")
    healthy_product = create_product(workspace, unit, "HEALTHY", threshold="5.000")
    null_threshold_product = create_product(workspace, unit, "NO-THRESHOLD")
    zero_threshold_product = create_product(workspace, unit, "ZERO", threshold="0.000")
    inactive_low_product = create_product(
        workspace,
        unit,
        "INACTIVE-LOW",
        threshold="10.000",
        is_active=False,
    )
    create_stock_level(workspace, low_product, warehouse, first_location, "4.000")
    create_stock_level(workspace, low_product, warehouse, second_location, "5.000")
    create_stock_level(workspace, healthy_product, warehouse, first_location, "8.000")
    create_stock_level(workspace, null_threshold_product, warehouse, first_location, "0.000")
    create_stock_level(workspace, zero_threshold_product, warehouse, first_location, "0.000")
    create_stock_level(workspace, inactive_low_product, warehouse, first_location, "1.000")

    response = api_client(owner).get(
        "/api/dashboard/low-stock/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert [item["sku"] for item in response.data] == ["LOW"]
    assert response.data[0]["total_stock"] == "9.000"
    assert response.data[0]["low_stock_threshold"] == "10.000"


def test_inventory_by_warehouse_is_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)
    acme_product = create_product(acme, acme_unit, "ACME-001")
    beta_product = create_product(beta, beta_unit, "BETA-001")
    main = create_warehouse(acme, "MAIN")
    overflow = create_warehouse(acme, "OVF")
    beta_warehouse = create_warehouse(beta, "BETA")
    main_location = create_location(acme, main, "A1")
    overflow_location = create_location(acme, overflow, "B1")
    beta_location = create_location(beta, beta_warehouse, "C1")
    create_stock_level(acme, acme_product, main, main_location, "12.500")
    create_stock_level(acme, acme_product, overflow, overflow_location, "2.000")
    create_stock_level(beta, beta_product, beta_warehouse, beta_location, "99.000")

    response = api_client(acme_owner).get(
        "/api/dashboard/inventory-by-warehouse/",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    totals = {item["warehouse_code"]: item["total_stock_quantity"] for item in response.data}
    assert totals == {"MAIN": "12.500", "OVF": "2.000"}


def test_recent_movements_are_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_product = create_product(acme, create_unit(acme), "ACME-001")
    beta_product = create_product(beta, create_unit(beta), "BETA-001")
    create_movement(acme, acme_product, acme_owner, quantity="1.000")
    create_movement(beta, beta_product, beta_owner, quantity="2.000")

    response = api_client(acme_owner).get(
        "/api/dashboard/recent-movements/",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["product_sku"] == "ACME-001"


def test_viewer_can_access_dashboard_and_anonymous_user_cannot(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    viewer = create_user(django_user_model, "viewer@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, viewer, role=WorkspaceRole.VIEWER)

    viewer_response = api_client(viewer).get(
        "/api/dashboard/summary/",
        HTTP_HOST=tenant_host(workspace),
    )
    anonymous_response = api_client().get(
        "/api/dashboard/summary/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert viewer_response.status_code == 200
    assert anonymous_response.status_code in (401, 403)


def test_dashboard_endpoints_are_get_only(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)

    response = api_client(owner).post(
        "/api/dashboard/summary/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 405
