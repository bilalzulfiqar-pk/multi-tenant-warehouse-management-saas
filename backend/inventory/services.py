import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from django.db import transaction

from audit.services import AuditLogService
from common.exceptions import ValidationError as BusinessValidationError
from warehouse.models import WarehouseStatus

from .models import StockLevel, StockMovement, StockMovementType


QUANTITY_STEP = Decimal("0.001")
ZERO_QUANTITY = Decimal("0.000")


@dataclass(frozen=True)
class InventoryOperationResult:
    movements: list[StockMovement]
    stock_levels: list[StockLevel]


class InventoryService:
    @staticmethod
    def _normalize_quantity(value, field_name="quantity"):
        try:
            if not isinstance(value, Decimal):
                value = Decimal(str(value))
            if not value.is_finite():
                raise InvalidOperation
            return value.quantize(QUANTITY_STEP)
        except (InvalidOperation, ValueError) as exc:
            raise BusinessValidationError(
                f"{field_name.replace('_', ' ').title()} must be a valid decimal.",
                details={field_name: str(value)},
            ) from exc

    @classmethod
    def _positive_quantity(cls, value, field_name="quantity"):
        quantity = cls._normalize_quantity(value, field_name=field_name)
        if quantity <= ZERO_QUANTITY:
            raise BusinessValidationError(
                f"{field_name.replace('_', ' ').title()} must be greater than zero.",
                details={field_name: str(quantity)},
            )
        return quantity

    @classmethod
    def _non_negative_quantity(cls, value, field_name="quantity"):
        quantity = cls._normalize_quantity(value, field_name=field_name)
        if quantity < ZERO_QUANTITY:
            raise BusinessValidationError(
                f"{field_name.replace('_', ' ').title()} cannot be negative.",
                details={field_name: str(quantity)},
            )
        return quantity

    @staticmethod
    def _decimal_string(value):
        return format(value.quantize(QUANTITY_STEP), "f")

    @staticmethod
    def _ensure_workspace_match(workspace, *objects):
        for obj in objects:
            if obj is not None and obj.workspace_id != workspace.id:
                raise BusinessValidationError(
                    "Inventory object does not belong to this workspace."
                )

    @staticmethod
    def _ensure_location_matches_warehouse(warehouse, location, label="location"):
        if location.warehouse_id != warehouse.id:
            raise BusinessValidationError(
                f"{label.replace('_', ' ').title()} does not belong to the warehouse."
            )

    @classmethod
    def _ensure_inventory_context(cls, workspace, product, warehouse, location):
        cls._ensure_workspace_match(workspace, product, warehouse, location)
        cls._ensure_location_matches_warehouse(warehouse, location)
        cls._ensure_active_product(product)
        cls._ensure_active_warehouse(warehouse)
        cls._ensure_active_location(location)

    @staticmethod
    def _ensure_active_product(product):
        if not product.is_active:
            raise BusinessValidationError("Inactive product cannot be used.")

    @staticmethod
    def _ensure_active_warehouse(warehouse):
        if warehouse.status != WarehouseStatus.ACTIVE:
            raise BusinessValidationError("Inactive warehouse cannot be used.")

    @staticmethod
    def _ensure_active_location(location):
        if location.status != WarehouseStatus.ACTIVE:
            raise BusinessValidationError("Inactive location cannot be used.")

    @classmethod
    def _ensure_active_transfer_context(
        cls,
        product,
        source_warehouse,
        source_location,
        destination_warehouse,
        destination_location,
    ):
        cls._ensure_active_product(product)
        cls._ensure_active_warehouse(source_warehouse)
        cls._ensure_active_location(source_location)
        cls._ensure_active_warehouse(destination_warehouse)
        cls._ensure_active_location(destination_location)

    @staticmethod
    def _locked_stock_level(workspace, product, warehouse, location):
        stock_level, _ = StockLevel.objects.select_for_update().get_or_create(
            workspace=workspace,
            product=product,
            warehouse=warehouse,
            location=location,
            defaults={"quantity": ZERO_QUANTITY},
        )
        return stock_level

    @staticmethod
    def _get_existing_locked_stock_level(workspace, product, warehouse, location):
        try:
            return StockLevel.objects.select_for_update().get(
                workspace=workspace,
                product=product,
                warehouse=warehouse,
                location=location,
            )
        except StockLevel.DoesNotExist as exc:
            raise BusinessValidationError("Insufficient stock for this operation.") from exc

    @classmethod
    def _create_movement(
        cls,
        *,
        workspace,
        product,
        movement_type,
        quantity,
        actor,
        source_warehouse=None,
        source_location=None,
        destination_warehouse=None,
        destination_location=None,
        reference_type="",
        reference_id=None,
        transfer_batch_id=None,
        reason="",
        notes="",
        metadata=None,
    ):
        movement = StockMovement.objects.create(
            workspace=workspace,
            product=product,
            movement_type=movement_type,
            quantity=quantity,
            source_warehouse=source_warehouse,
            source_location=source_location,
            destination_warehouse=destination_warehouse,
            destination_location=destination_location,
            reference_type=reference_type or "",
            reference_id=reference_id,
            transfer_batch_id=transfer_batch_id,
            reason=reason or "",
            notes=notes or "",
            metadata=metadata or {},
            performed_by=actor,
        )
        cls._record_stock_audit(movement)
        return movement

    @staticmethod
    def _record_stock_audit(movement):
        AuditLogService.record(
            workspace=movement.workspace,
            actor=movement.performed_by,
            action=movement.movement_type,
            resource_type="stock_movement",
            resource_id=movement.id,
            message=f"{movement.movement_type} movement recorded.",
            metadata={
                "movement_id": str(movement.id),
                "product_id": str(movement.product_id),
                "quantity": format(movement.quantity, "f"),
                "source_warehouse_id": (
                    str(movement.source_warehouse_id)
                    if movement.source_warehouse_id
                    else ""
                ),
                "source_location_id": (
                    str(movement.source_location_id)
                    if movement.source_location_id
                    else ""
                ),
                "destination_warehouse_id": (
                    str(movement.destination_warehouse_id)
                    if movement.destination_warehouse_id
                    else ""
                ),
                "destination_location_id": (
                    str(movement.destination_location_id)
                    if movement.destination_location_id
                    else ""
                ),
                "transfer_batch_id": (
                    str(movement.transfer_batch_id)
                    if movement.transfer_batch_id
                    else ""
                ),
                "movement_metadata": movement.metadata,
            },
        )

    @classmethod
    @transaction.atomic
    def stock_in(
        cls,
        *,
        workspace,
        product,
        warehouse,
        location,
        quantity,
        actor,
        reason="",
        reference_type="",
        reference_id=None,
        notes="",
    ):
        quantity = cls._positive_quantity(quantity)
        cls._ensure_inventory_context(workspace, product, warehouse, location)

        stock_level = cls._locked_stock_level(workspace, product, warehouse, location)
        stock_level.quantity = cls._normalize_quantity(stock_level.quantity + quantity)
        stock_level.save(update_fields=["quantity", "updated_at"])

        movement = cls._create_movement(
            workspace=workspace,
            product=product,
            movement_type=StockMovementType.STOCK_IN,
            quantity=quantity,
            destination_warehouse=warehouse,
            destination_location=location,
            reference_type=reference_type,
            reference_id=reference_id,
            reason=reason,
            notes=notes,
            actor=actor,
        )
        return InventoryOperationResult(movements=[movement], stock_levels=[stock_level])

    @classmethod
    @transaction.atomic
    def stock_out(
        cls,
        *,
        workspace,
        product,
        warehouse,
        location,
        quantity,
        actor,
        reason="",
        reference_type="",
        reference_id=None,
        notes="",
    ):
        quantity = cls._positive_quantity(quantity)
        cls._ensure_inventory_context(workspace, product, warehouse, location)

        stock_level = cls._get_existing_locked_stock_level(
            workspace,
            product,
            warehouse,
            location,
        )
        if stock_level.quantity < quantity:
            raise BusinessValidationError("Insufficient stock for this operation.")

        stock_level.quantity = cls._normalize_quantity(stock_level.quantity - quantity)
        stock_level.save(update_fields=["quantity", "updated_at"])

        movement = cls._create_movement(
            workspace=workspace,
            product=product,
            movement_type=StockMovementType.STOCK_OUT,
            quantity=quantity,
            source_warehouse=warehouse,
            source_location=location,
            reference_type=reference_type,
            reference_id=reference_id,
            reason=reason,
            notes=notes,
            actor=actor,
        )
        return InventoryOperationResult(movements=[movement], stock_levels=[stock_level])

    @classmethod
    @transaction.atomic
    def adjust_stock(
        cls,
        *,
        workspace,
        product,
        warehouse,
        location,
        counted_quantity,
        actor,
        reason,
        notes="",
    ):
        counted_quantity = cls._non_negative_quantity(
            counted_quantity,
            field_name="counted_quantity",
        )
        cls._ensure_inventory_context(workspace, product, warehouse, location)

        stock_level = cls._locked_stock_level(workspace, product, warehouse, location)
        previous_quantity = cls._normalize_quantity(stock_level.quantity)
        difference = cls._normalize_quantity(counted_quantity - previous_quantity)

        stock_level.quantity = counted_quantity
        stock_level.save(update_fields=["quantity", "updated_at"])

        movements = []
        if difference != ZERO_QUANTITY:
            movements.append(
                cls._create_movement(
                    workspace=workspace,
                    product=product,
                    movement_type=StockMovementType.ADJUSTMENT,
                    quantity=abs(difference),
                    source_warehouse=warehouse if difference < ZERO_QUANTITY else None,
                    source_location=location if difference < ZERO_QUANTITY else None,
                    destination_warehouse=warehouse if difference > ZERO_QUANTITY else None,
                    destination_location=location if difference > ZERO_QUANTITY else None,
                    reason=reason,
                    notes=notes,
                    metadata={
                        "previous_quantity": cls._decimal_string(previous_quantity),
                        "new_quantity": cls._decimal_string(counted_quantity),
                        "difference": cls._decimal_string(difference),
                        "reason": reason,
                    },
                    actor=actor,
                )
            )

        return InventoryOperationResult(movements=movements, stock_levels=[stock_level])

    @classmethod
    @transaction.atomic
    def transfer_stock(
        cls,
        *,
        workspace,
        product,
        source_warehouse,
        source_location,
        destination_warehouse,
        destination_location,
        quantity,
        actor,
        reason="",
        reference_type="",
        reference_id=None,
        notes="",
    ):
        quantity = cls._positive_quantity(quantity)
        cls._ensure_workspace_match(
            workspace,
            product,
            source_warehouse,
            source_location,
            destination_warehouse,
            destination_location,
        )
        cls._ensure_location_matches_warehouse(
            source_warehouse,
            source_location,
            label="source_location",
        )
        cls._ensure_location_matches_warehouse(
            destination_warehouse,
            destination_location,
            label="destination_location",
        )
        cls._ensure_active_transfer_context(
            product,
            source_warehouse,
            source_location,
            destination_warehouse,
            destination_location,
        )

        if (
            source_warehouse.id == destination_warehouse.id
            and source_location.id == destination_location.id
        ):
            raise BusinessValidationError(
                "Source and destination locations must be different."
            )

        source_stock_level = cls._get_existing_locked_stock_level(
            workspace,
            product,
            source_warehouse,
            source_location,
        )
        if source_stock_level.quantity < quantity:
            raise BusinessValidationError("Insufficient stock for this operation.")

        destination_stock_level = cls._locked_stock_level(
            workspace,
            product,
            destination_warehouse,
            destination_location,
        )

        source_stock_level.quantity = cls._normalize_quantity(
            source_stock_level.quantity - quantity
        )
        destination_stock_level.quantity = cls._normalize_quantity(
            destination_stock_level.quantity + quantity
        )
        source_stock_level.save(update_fields=["quantity", "updated_at"])
        destination_stock_level.save(update_fields=["quantity", "updated_at"])

        transfer_batch_id = uuid.uuid4()
        transfer_out = cls._create_movement(
            workspace=workspace,
            product=product,
            movement_type=StockMovementType.TRANSFER_OUT,
            quantity=quantity,
            source_warehouse=source_warehouse,
            source_location=source_location,
            reference_type=reference_type,
            reference_id=reference_id,
            transfer_batch_id=transfer_batch_id,
            reason=reason,
            notes=notes,
            actor=actor,
        )
        transfer_in = cls._create_movement(
            workspace=workspace,
            product=product,
            movement_type=StockMovementType.TRANSFER_IN,
            quantity=quantity,
            destination_warehouse=destination_warehouse,
            destination_location=destination_location,
            reference_type=reference_type,
            reference_id=reference_id,
            transfer_batch_id=transfer_batch_id,
            reason=reason,
            notes=notes,
            actor=actor,
        )
        return InventoryOperationResult(
            movements=[transfer_out, transfer_in],
            stock_levels=[source_stock_level, destination_stock_level],
        )
