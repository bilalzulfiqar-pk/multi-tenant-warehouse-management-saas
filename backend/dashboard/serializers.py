from rest_framework import serializers

from inventory.serializers import StockMovementSerializer


class DashboardSummarySerializer(serializers.Serializer):
    total_products = serializers.IntegerField()
    active_products = serializers.IntegerField()
    total_warehouses = serializers.IntegerField()
    active_warehouses = serializers.IntegerField()
    low_stock_products = serializers.IntegerField()
    total_stock_quantity = serializers.CharField()
    recent_movements_count = serializers.IntegerField()


class LowStockProductSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sku = serializers.CharField()
    name = serializers.CharField()
    low_stock_threshold = serializers.CharField()
    total_stock = serializers.CharField()


class InventoryByWarehouseSerializer(serializers.Serializer):
    warehouse = serializers.UUIDField()
    warehouse_code = serializers.CharField()
    warehouse_name = serializers.CharField()
    status = serializers.CharField()
    total_stock_quantity = serializers.CharField()
    product_count = serializers.IntegerField()
    location_count = serializers.IntegerField()


class RecentMovementsSerializer(StockMovementSerializer):
    pass
