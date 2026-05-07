import uuid

from django.db import models

from workspaces.models import Workspace


class ProductCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="product_categories",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name"],
                name="unique_product_category_name_per_workspace",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "name"]),
            models.Index(fields=["workspace", "is_active"]),
        ]

    def __str__(self):
        return self.name


class UnitOfMeasure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="units_of_measure",
    )
    name = models.CharField(max_length=255)
    abbreviation = models.CharField(max_length=32)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "abbreviation"],
                name="unique_unit_abbreviation_per_workspace",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "abbreviation"]),
            models.Index(fields=["workspace", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.abbreviation})"


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="products",
    )
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    unit = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    low_stock_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    default_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "sku"],
                name="unique_product_sku_per_workspace",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "sku"]),
            models.Index(fields=["workspace", "is_active"]),
            models.Index(fields=["workspace", "category"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"
