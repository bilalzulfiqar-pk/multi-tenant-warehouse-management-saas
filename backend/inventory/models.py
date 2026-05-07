import uuid

from django.conf import settings
from django.db import models

from catalog.models import Product
from warehouse.models import Warehouse, WarehouseLocation
from workspaces.models import Workspace


class StockMovementType(models.TextChoices):
    STOCK_IN = "stock_in", "Stock In"
    STOCK_OUT = "stock_out", "Stock Out"
    ADJUSTMENT = "adjustment", "Adjustment"
    TRANSFER_IN = "transfer_in", "Transfer In"
    TRANSFER_OUT = "transfer_out", "Transfer Out"


class StockLevel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="stock_levels",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_levels",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="stock_levels",
    )
    location = models.ForeignKey(
        WarehouseLocation,
        on_delete=models.PROTECT,
        related_name="stock_levels",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__sku", "warehouse__code", "location__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "product", "warehouse", "location"],
                name="unique_stock_level_per_product_location",
            ),
            models.CheckConstraint(
                check=models.Q(quantity__gte=0),
                name="stock_level_quantity_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "product"]),
            models.Index(fields=["workspace", "warehouse"]),
            models.Index(fields=["workspace", "warehouse", "location"]),
            models.Index(fields=["workspace", "product", "warehouse", "location"]),
        ]

    def __str__(self):
        return f"{self.product.sku} @ {self.warehouse.code}/{self.location.code}"


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="stock_movements",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    movement_type = models.CharField(max_length=20, choices=StockMovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    source_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="source_stock_movements",
    )
    source_location = models.ForeignKey(
        WarehouseLocation,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="source_stock_movements",
    )
    destination_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="destination_stock_movements",
    )
    destination_location = models.ForeignKey(
        WarehouseLocation,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="destination_stock_movements",
    )
    reference_type = models.CharField(max_length=100, blank=True)
    reference_id = models.UUIDField(null=True, blank=True)
    transfer_batch_id = models.UUIDField(null=True, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="performed_stock_movements",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gt=0),
                name="stock_movement_quantity_positive",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "product"]),
            models.Index(fields=["workspace", "movement_type"]),
            models.Index(fields=["workspace", "created_at"]),
            models.Index(fields=["workspace", "source_warehouse"]),
            models.Index(fields=["workspace", "destination_warehouse"]),
        ]

    def __str__(self):
        return f"{self.movement_type} {self.quantity} {self.product.sku}"
