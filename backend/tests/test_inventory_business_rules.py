from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditLog
from catalog.models import Product, UnitOfMeasure
from inventory.models import StockLevel, StockMovement, StockMovementType
from inventory.services import InventoryService
from warehouse.models import LocationType, Warehouse, WarehouseLocation, WarehouseStatus
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


def create_inventory_context(owner):
    workspace = create_workspace(owner)
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
        "reason": "Business rule test",
    }


def test_stock_operations_reject_zero_or_negative_quantities(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)

    stock_in_response = api_client(owner).post(
        "/api/inventory/stock-in/",
        stock_payload(product, warehouse, location, quantity="0.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    stock_out_response = api_client(owner).post(
        "/api/inventory/stock-out/",
        stock_payload(product, warehouse, location, quantity="-1.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    adjust_response = api_client(owner).post(
        "/api/inventory/adjust/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(location.id),
            "counted_quantity": "-1.000",
            "reason": "Invalid count",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert stock_in_response.status_code == 400
    assert stock_out_response.status_code == 400
    assert adjust_response.status_code == 400
    assert not StockLevel.objects.exists()
    assert not StockMovement.objects.exists()
    assert not AuditLog.objects.exists()


def test_stock_out_cannot_make_stock_negative_and_rolls_back(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)
    stock_level = StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
        quantity=Decimal("5.000"),
    )

    response = api_client(owner).post(
        "/api/inventory/stock-out/",
        stock_payload(product, warehouse, location, quantity="7.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    stock_level.refresh_from_db()
    assert stock_level.quantity == Decimal("5.000")
    assert not StockMovement.objects.exists()
    assert not AuditLog.objects.exists()


def test_failed_transfer_does_not_partially_update_stock(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, source_location = create_inventory_context(owner)
    destination_location = create_location(workspace, warehouse, code="B1")
    source_stock = StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=source_location,
        quantity=Decimal("3.000"),
    )

    response = api_client(owner).post(
        "/api/inventory/transfer/",
        {
            "product": str(product.id),
            "source_warehouse": str(warehouse.id),
            "source_location": str(source_location.id),
            "destination_warehouse": str(warehouse.id),
            "destination_location": str(destination_location.id),
            "quantity": "5.000",
            "reason": "Too much stock",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    source_stock.refresh_from_db()
    assert source_stock.quantity == Decimal("3.000")
    assert not StockLevel.objects.filter(location=destination_location).exists()
    assert not StockMovement.objects.exists()
    assert not AuditLog.objects.exists()


def test_inactive_product_warehouse_and_location_are_rejected(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)

    product.is_active = False
    product.save(update_fields=["is_active", "updated_at"])
    inactive_product_response = api_client(owner).post(
        "/api/inventory/stock-in/",
        stock_payload(product, warehouse, location, quantity="1.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    product.is_active = True
    product.save(update_fields=["is_active", "updated_at"])
    warehouse.status = WarehouseStatus.INACTIVE
    warehouse.save(update_fields=["status", "updated_at"])
    inactive_warehouse_response = api_client(owner).post(
        "/api/inventory/stock-in/",
        stock_payload(product, warehouse, location, quantity="1.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    warehouse.status = WarehouseStatus.ACTIVE
    warehouse.save(update_fields=["status", "updated_at"])
    location.status = WarehouseStatus.INACTIVE
    location.save(update_fields=["status", "updated_at"])
    inactive_location_response = api_client(owner).post(
        "/api/inventory/stock-in/",
        stock_payload(product, warehouse, location, quantity="1.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert inactive_product_response.status_code == 400
    assert inactive_warehouse_response.status_code == 400
    assert inactive_location_response.status_code == 400
    assert not StockLevel.objects.exists()
    assert not StockMovement.objects.exists()
    assert not AuditLog.objects.exists()


def test_every_stock_change_creates_stock_movement_and_audit_log(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, source_location = create_inventory_context(owner)
    destination_location = create_location(workspace, warehouse, code="B1")
    client = api_client(owner)

    stock_in_response = client.post(
        "/api/inventory/stock-in/",
        stock_payload(product, warehouse, source_location, quantity="10.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    stock_out_response = client.post(
        "/api/inventory/stock-out/",
        stock_payload(product, warehouse, source_location, quantity="2.000"),
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    adjust_response = client.post(
        "/api/inventory/adjust/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(source_location.id),
            "counted_quantity": "5.000",
            "reason": "Count correction",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    transfer_response = client.post(
        "/api/inventory/transfer/",
        {
            "product": str(product.id),
            "source_warehouse": str(warehouse.id),
            "source_location": str(source_location.id),
            "destination_warehouse": str(warehouse.id),
            "destination_location": str(destination_location.id),
            "quantity": "1.000",
            "reason": "Move to another location",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert stock_in_response.status_code == 200
    assert stock_out_response.status_code == 200
    assert adjust_response.status_code == 200
    assert transfer_response.status_code == 200
    assert StockMovement.objects.count() == 5
    assert AuditLog.objects.count() == 5
    actions = set(AuditLog.objects.values_list("action", flat=True))
    assert actions == {
        StockMovementType.STOCK_IN,
        StockMovementType.STOCK_OUT,
        StockMovementType.ADJUSTMENT,
        StockMovementType.TRANSFER_OUT,
        StockMovementType.TRANSFER_IN,
    }
    transfer_batch_ids = set(
        StockMovement.objects.filter(
            movement_type__in=[
                StockMovementType.TRANSFER_OUT,
                StockMovementType.TRANSFER_IN,
            ]
        ).values_list("transfer_batch_id", flat=True)
    )
    assert len(transfer_batch_ids) == 1


def test_stock_mutation_rolls_back_when_audit_log_creation_fails(
    django_user_model,
    monkeypatch,
):
    owner = create_user(django_user_model, "owner@example.com")
    workspace, product, warehouse, location = create_inventory_context(owner)
    stock_level = StockLevel.objects.create(
        workspace=workspace,
        product=product,
        warehouse=warehouse,
        location=location,
        quantity=Decimal("5.000"),
    )

    def fail_audit_record(*args, **kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr(
        "inventory.services.AuditLogService.record",
        fail_audit_record,
    )

    with pytest.raises(RuntimeError):
        InventoryService.stock_out(
            workspace=workspace,
            product=product,
            warehouse=warehouse,
            location=location,
            quantity=Decimal("2.000"),
            actor=owner,
            reason="Audit failure rollback",
        )

    stock_level.refresh_from_db()
    assert stock_level.quantity == Decimal("5.000")
    assert not StockMovement.objects.exists()
    assert not AuditLog.objects.exists()
