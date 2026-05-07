from decimal import Decimal

import pytest

from audit.models import AuditLog
from audit.services import AuditLogService
from inventory.models import StockMovement
from inventory.services import InventoryService


pytestmark = [pytest.mark.django_db, pytest.mark.inventory, pytest.mark.transactions]


def test_transfer_rolls_back_when_second_audit_log_creation_fails(
    monkeypatch,
    owner_user,
    workspace,
    product_factory,
    warehouse_factory,
    location_factory,
    stock_level_factory,
):
    product = product_factory(workspace)
    warehouse = warehouse_factory(workspace)
    source_location = location_factory(workspace, warehouse, code="A1")
    destination_location = location_factory(workspace, warehouse, code="B1")
    source_stock = stock_level_factory(
        workspace,
        product,
        warehouse,
        source_location,
        "10.000",
    )
    destination_stock = stock_level_factory(
        workspace,
        product,
        warehouse,
        destination_location,
        "2.000",
    )
    original_record = AuditLogService.record
    call_count = {"value": 0}

    def fail_on_second_audit(*args, **kwargs):
        call_count["value"] += 1
        if call_count["value"] == 2:
            raise RuntimeError("audit failed")
        return original_record(*args, **kwargs)

    monkeypatch.setattr(
        "inventory.services.AuditLogService.record",
        fail_on_second_audit,
    )

    with pytest.raises(RuntimeError):
        InventoryService.transfer_stock(
            workspace=workspace,
            product=product,
            source_warehouse=warehouse,
            source_location=source_location,
            destination_warehouse=warehouse,
            destination_location=destination_location,
            quantity=Decimal("3.000"),
            actor=owner_user,
            reason="Rollback transfer",
        )

    source_stock.refresh_from_db()
    destination_stock.refresh_from_db()
    assert source_stock.quantity == Decimal("10.000")
    assert destination_stock.quantity == Decimal("2.000")
    assert not StockMovement.objects.exists()
    assert not AuditLog.objects.exists()
