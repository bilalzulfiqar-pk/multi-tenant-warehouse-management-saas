import uuid

from django.db import models

from workspaces.models import Workspace


class WarehouseStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class LocationType(models.TextChoices):
    STORAGE = "storage", "Storage"
    RECEIVING = "receiving", "Receiving"
    DISPATCH = "dispatch", "Dispatch"
    ADJUSTMENT = "adjustment", "Adjustment"
    OTHER = "other", "Other"


class Warehouse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="warehouses",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64)
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20,
        choices=WarehouseStatus.choices,
        default=WarehouseStatus.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "code"],
                name="unique_warehouse_code_per_workspace",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "code"]),
            models.Index(fields=["workspace", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class WarehouseLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="warehouse_locations",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64)
    location_type = models.CharField(
        max_length=20,
        choices=LocationType.choices,
        default=LocationType.STORAGE,
    )
    status = models.CharField(
        max_length=20,
        choices=WarehouseStatus.choices,
        default=WarehouseStatus.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["warehouse__name", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "warehouse", "code"],
                name="unique_location_code_per_workspace_warehouse",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "warehouse"]),
            models.Index(fields=["workspace", "warehouse", "code"]),
            models.Index(fields=["workspace", "status"]),
        ]

    def __str__(self):
        return f"{self.warehouse.code} / {self.code}"
