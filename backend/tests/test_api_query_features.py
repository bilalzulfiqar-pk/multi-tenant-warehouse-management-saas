from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from audit.services import AuditLogService
from catalog.models import Product, ProductCategory, UnitOfMeasure
from inventory.models import StockMovement, StockMovementType
from warehouse.models import LocationType, Warehouse, WarehouseLocation
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


def list_results(response):
    return response.data["results"]


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


def tenant_host(workspace):
    return f"{workspace.subdomain}.localhost:8000"


def create_unit(workspace, abbreviation="pcs"):
    return UnitOfMeasure.objects.create(
        workspace=workspace,
        name=f"Unit {abbreviation}",
        abbreviation=abbreviation,
    )


def create_product(workspace, unit, sku, name, category=None):
    return Product.objects.create(
        workspace=workspace,
        category=category,
        unit=unit,
        sku=sku,
        name=name,
    )


def create_warehouse(workspace, code="MAIN"):
    return Warehouse.objects.create(
        workspace=workspace,
        name=f"{code} Warehouse",
        code=code,
    )


def create_location(workspace, warehouse, code="A1"):
    return WarehouseLocation.objects.create(
        workspace=workspace,
        warehouse=warehouse,
        name=f"Location {code}",
        code=code,
        location_type=LocationType.STORAGE,
    )


def test_page_number_pagination_uses_page_size_and_caps_max(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    unit = create_unit(workspace)
    for index in range(105):
        create_product(
            workspace,
            unit=unit,
            sku=f"SKU-{index:03d}",
            name=f"Product {index:03d}",
        )

    capped_response = api_client(owner).get(
        "/api/products/?page_size=500",
        HTTP_HOST=tenant_host(workspace),
    )
    second_page_response = api_client(owner).get(
        "/api/products/?page=2&page_size=20",
        HTTP_HOST=tenant_host(workspace),
    )

    assert capped_response.status_code == 200
    assert capped_response.data["count"] == 105
    assert len(list_results(capped_response)) == 100
    assert capped_response.data["next"] is not None
    assert second_page_response.status_code == 200
    assert len(list_results(second_page_response)) == 20


def test_product_filter_search_and_ordering_stay_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)
    grocery = ProductCategory.objects.create(workspace=acme, name="Grocery")
    spare_parts = ProductCategory.objects.create(workspace=acme, name="Spare Parts")
    create_product(acme, acme_unit, "RICE-002", "Rice Bag Large", category=grocery)
    create_product(acme, acme_unit, "RICE-001", "Rice Bag Small", category=grocery)
    create_product(acme, acme_unit, "SUGAR-001", "Sugar Bag", category=spare_parts)
    create_product(beta, beta_unit, "BETA-RICE", "Rice Hidden")

    response = api_client(acme_owner).get(
        f"/api/products/?search=rice&category={grocery.id}&ordering=sku&page_size=10",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert response.data["count"] == 2
    assert [item["sku"] for item in list_results(response)] == [
        "RICE-001",
        "RICE-002",
    ]


def test_stock_movement_filters_stay_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)
    acme_product = create_product(acme, acme_unit, "ACME-RICE", "Rice Bag")
    beta_product = create_product(beta, beta_unit, "BETA-RICE", "Rice Bag")
    acme_warehouse = create_warehouse(acme)
    beta_warehouse = create_warehouse(beta)
    acme_location = create_location(acme, acme_warehouse)
    beta_location = create_location(beta, beta_warehouse)
    acme_movement = StockMovement.objects.create(
        workspace=acme,
        product=acme_product,
        movement_type=StockMovementType.STOCK_IN,
        quantity=Decimal("5.000"),
        destination_warehouse=acme_warehouse,
        destination_location=acme_location,
        reference_type="manual",
        reason="Initial stock",
        notes="Initial load",
        performed_by=acme_owner,
    )
    StockMovement.objects.create(
        workspace=acme,
        product=acme_product,
        movement_type=StockMovementType.STOCK_OUT,
        quantity=Decimal("1.000"),
        source_warehouse=acme_warehouse,
        source_location=acme_location,
        reason="Initial stock correction",
        performed_by=acme_owner,
    )
    StockMovement.objects.create(
        workspace=beta,
        product=beta_product,
        movement_type=StockMovementType.STOCK_IN,
        quantity=Decimal("5.000"),
        destination_warehouse=beta_warehouse,
        destination_location=beta_location,
        reason="Initial stock",
        notes="Initial load",
        performed_by=beta_owner,
    )

    response = api_client(acme_owner).get(
        (
            "/api/stock-movements/?"
            f"movement_type={StockMovementType.STOCK_IN}"
            f"&warehouse={acme_warehouse.id}"
            f"&location={acme_location.id}"
            "&search=initial"
            "&page_size=5"
        ),
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert list_results(response)[0]["id"] == str(acme_movement.id)


def test_audit_log_filters_search_and_ordering_stay_tenant_scoped(
    django_user_model,
):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_log = AuditLogService.record(
        workspace=acme,
        actor=acme_owner,
        action="warehouse.created",
        resource_type="warehouse",
        resource_id="acme-warehouse",
        message="Main warehouse created.",
    )
    AuditLogService.record(
        workspace=acme,
        actor=acme_owner,
        action="product.created",
        resource_type="product",
        resource_id="acme-product",
        message="Product created.",
    )
    AuditLogService.record(
        workspace=beta,
        actor=beta_owner,
        action="warehouse.created",
        resource_type="warehouse",
        resource_id="beta-warehouse",
        message="Main warehouse created.",
    )

    response = api_client(acme_owner).get(
        (
            "/api/audit-logs/?"
            "action=warehouse.created"
            "&resource_type=warehouse"
            "&search=main"
            "&ordering=created_at"
            "&page_size=10"
        ),
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert list_results(response)[0]["id"] == str(acme_log.id)
