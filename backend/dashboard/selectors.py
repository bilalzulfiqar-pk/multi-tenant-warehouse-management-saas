from decimal import Decimal

from django.db.models import Count, DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce

from catalog.models import Product
from inventory.models import StockLevel, StockMovement
from warehouse.models import Warehouse, WarehouseStatus


DECIMAL_OUTPUT = DecimalField(max_digits=12, decimal_places=3)
ZERO_DECIMAL = Value(Decimal("0.000"), output_field=DECIMAL_OUTPUT)


def decimal_string(value):
    return format((value or Decimal("0.000")).quantize(Decimal("0.001")), "f")


class DashboardSelectors:
    @classmethod
    def summary(cls, workspace):
        total_stock = StockLevel.objects.filter(workspace=workspace).aggregate(
            total=Coalesce(Sum("quantity"), ZERO_DECIMAL)
        )["total"]
        return {
            "total_products": Product.objects.filter(workspace=workspace).count(),
            "active_products": Product.objects.filter(
                workspace=workspace,
                is_active=True,
            ).count(),
            "total_warehouses": Warehouse.objects.filter(workspace=workspace).count(),
            "active_warehouses": Warehouse.objects.filter(
                workspace=workspace,
                status=WarehouseStatus.ACTIVE,
            ).count(),
            "low_stock_products": len(cls.low_stock_products(workspace)),
            "total_stock_quantity": decimal_string(total_stock),
            "recent_movements_count": StockMovement.objects.filter(
                workspace=workspace
            ).count(),
        }

    @staticmethod
    def low_stock_products(workspace):
        products = (
            Product.objects.filter(
                workspace=workspace,
                is_active=True,
                low_stock_threshold__gt=0,
            )
            .annotate(
                total_stock=Coalesce(
                    Sum("stock_levels__quantity"),
                    ZERO_DECIMAL,
                    output_field=DECIMAL_OUTPUT,
                )
            )
            .filter(total_stock__lte=F("low_stock_threshold"))
            .order_by("sku")
        )
        return [
            {
                "id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "low_stock_threshold": decimal_string(product.low_stock_threshold),
                "total_stock": decimal_string(product.total_stock),
            }
            for product in products
        ]

    @staticmethod
    def inventory_by_warehouse(workspace):
        warehouses = (
            Warehouse.objects.filter(workspace=workspace)
            .annotate(
                total_stock_quantity=Coalesce(
                    Sum("stock_levels__quantity"),
                    ZERO_DECIMAL,
                    output_field=DECIMAL_OUTPUT,
                ),
                product_count=Count("stock_levels__product", distinct=True),
                location_count=Count("stock_levels__location", distinct=True),
            )
            .order_by("name")
        )
        return [
            {
                "warehouse": str(warehouse.id),
                "warehouse_code": warehouse.code,
                "warehouse_name": warehouse.name,
                "status": warehouse.status,
                "total_stock_quantity": decimal_string(warehouse.total_stock_quantity),
                "product_count": warehouse.product_count,
                "location_count": warehouse.location_count,
            }
            for warehouse in warehouses
        ]

    @staticmethod
    def recent_movements(workspace, limit=10):
        return (
            StockMovement.objects.filter(workspace=workspace)
            .select_related(
                "product",
                "source_warehouse",
                "source_location",
                "destination_warehouse",
                "destination_location",
                "performed_by",
            )
            .order_by("-created_at")[:limit]
        )
