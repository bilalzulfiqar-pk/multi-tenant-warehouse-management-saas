from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Product, UnitOfMeasure
from inventory.models import StockLevel, StockMovement, StockMovementType
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


def create_product(workspace, unit, sku="SKU-001"):
    return Product.objects.create(
        workspace=workspace,
        unit=unit,
        name=f"Product {sku}",
        sku=sku,
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


def create_inventory_context(owner, subdomain="acme"):
    workspace = create_workspace(owner, subdomain=subdomain)
    unit = create_unit(workspace)
    product = create_product(workspace, unit)
    warehouse = create_warehouse(workspace)
    location = create_location(workspace, warehouse)
    return workspace, product, warehouse, location


def stock_payload(product, warehouse, location, quantity="10.000"):
    return {
        "product": str(product.id),
        "warehouse": str(warehouse.id),
        "location": str(location.id),
        "quantity": quantity,
        "reason": "Inventory core test",
    }


def test_stock_level_and_movement_apis_are_read_only(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)
    stock_level = StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
        quantity=Decimal("5.000"),
    )

    create_level_response = api_client(owner).post(
        "/api/stock-levels/",
        stock_payload(product, warehouse, location),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    update_level_response = api_client(owner).patch(
        f"/api/stock-levels/{stock_level.id}/",
        {"quantity": "99.000"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    create_movement_response = api_client(owner).post(
        "/api/stock-movements/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert create_level_response.status_code == 405
    assert update_level_response.status_code == 405
    assert create_movement_response.status_code == 405
    stock_level.refresh_from_db()
    assert stock_level.quantity == Decimal("5.000")


def test_stock_in_increases_stock_level_and_creates_movement(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)

    response = api_client(staff).post(
        "/api/inventory/stock-in/",
        stock_payload(product, warehouse, location, quantity="10.500"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["message"] == "Stock operation completed."
    assert response.data["movements"][0]["movement_type"] == StockMovementType.STOCK_IN
    stock_level = StockLevel.objects.get(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
    )
    assert stock_level.quantity == Decimal("10.500")
    assert StockMovement.objects.filter(
        workspace=workspace,
        movement_type=StockMovementType.STOCK_IN,
        performed_by=staff,
    ).count() == 1


def test_stock_out_decreases_stock_level_and_creates_movement(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)
    StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
        quantity=Decimal("10.000"),
    )

    response = api_client(staff).post(
        "/api/inventory/stock-out/",
        stock_payload(product, warehouse, location, quantity="3.250"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["movements"][0]["movement_type"] == StockMovementType.STOCK_OUT
    stock_level = StockLevel.objects.get(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
    )
    assert stock_level.quantity == Decimal("6.750")


def test_adjust_stock_sets_quantity_to_counted_quantity(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    manager = create_user(django_user_model, "manager@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)
    add_member(workspace, manager, role=WorkspaceRole.MANAGER)
    StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
        quantity=Decimal("10.000"),
    )

    response = api_client(manager).post(
        "/api/inventory/adjust/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(location.id),
            "counted_quantity": "8.000",
            "reason": "Physical count correction",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["movements"][0]["movement_type"] == StockMovementType.ADJUSTMENT
    assert response.data["movements"][0]["metadata"]["previous_quantity"] == "10.000"
    assert response.data["movements"][0]["metadata"]["new_quantity"] == "8.000"
    stock_level = StockLevel.objects.get(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
    )
    assert stock_level.quantity == Decimal("8.000")


def test_transfer_stock_updates_levels_and_creates_transfer_movements(
    django_user_model,
):
    owner = create_user(django_user_model, "owner@example.com")
    manager = create_user(django_user_model, "manager@example.com")
    workspace, product, warehouse, source_location = create_inventory_context(owner)
    destination_location = create_location(workspace, warehouse, code="B1")
    add_member(workspace, manager, role=WorkspaceRole.MANAGER)
    StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=source_location,
        quantity=Decimal("10.000"),
    )

    response = api_client(manager).post(
        "/api/inventory/transfer/",
        {
            "product": str(product.id),
            "source_warehouse": str(warehouse.id),
            "source_location": str(source_location.id),
            "destination_warehouse": str(warehouse.id),
            "destination_location": str(destination_location.id),
            "quantity": "4.000",
            "reason": "Move to second aisle",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    movement_types = {item["movement_type"] for item in response.data["movements"]}
    assert movement_types == {
        StockMovementType.TRANSFER_OUT,
        StockMovementType.TRANSFER_IN,
    }
    transfer_batch_ids = {
        item["transfer_batch_id"] for item in response.data["movements"]
    }
    assert len(transfer_batch_ids) == 1
    assert StockLevel.objects.get(location=source_location).quantity == Decimal("6.000")
    assert StockLevel.objects.get(location=destination_location).quantity == Decimal(
        "4.000"
    )


def test_staff_cannot_adjust_or_transfer_stock(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace, product, warehouse, source_location = create_inventory_context(owner)
    destination_location = create_location(workspace, warehouse, code="B1")
    add_member(workspace, staff, role=WorkspaceRole.STAFF)

    adjust_response = api_client(staff).post(
        "/api/inventory/adjust/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(source_location.id),
            "counted_quantity": "8.000",
            "reason": "Blocked adjustment",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    transfer_response = api_client(staff).post(
        "/api/inventory/transfer/",
        {
            "product": str(product.id),
            "source_warehouse": str(warehouse.id),
            "source_location": str(source_location.id),
            "destination_warehouse": str(warehouse.id),
            "destination_location": str(destination_location.id),
            "quantity": "1.000",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert adjust_response.status_code == 403
    assert transfer_response.status_code == 403
