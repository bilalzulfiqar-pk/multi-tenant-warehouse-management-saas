from rest_framework import serializers

from catalog.models import Product
from warehouse.models import Warehouse, WarehouseLocation

from .models import StockLevel, StockMovement


class StockLevelSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)

    class Meta:
        model = StockLevel
        fields = (
            "id",
            "product",
            "product_sku",
            "product_name",
            "warehouse",
            "warehouse_code",
            "warehouse_name",
            "location",
            "location_code",
            "location_name",
            "quantity",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    source_warehouse_code = serializers.CharField(
        source="source_warehouse.code",
        read_only=True,
    )
    source_location_code = serializers.CharField(
        source="source_location.code",
        read_only=True,
    )
    destination_warehouse_code = serializers.CharField(
        source="destination_warehouse.code",
        read_only=True,
    )
    destination_location_code = serializers.CharField(
        source="destination_location.code",
        read_only=True,
    )
    performed_by_email = serializers.EmailField(source="performed_by.email", read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "product",
            "product_sku",
            "product_name",
            "movement_type",
            "quantity",
            "source_warehouse",
            "source_warehouse_code",
            "source_location",
            "source_location_code",
            "destination_warehouse",
            "destination_warehouse_code",
            "destination_location",
            "destination_location_code",
            "reference_type",
            "reference_id",
            "transfer_batch_id",
            "reason",
            "notes",
            "metadata",
            "performed_by",
            "performed_by_email",
            "created_at",
        )
        read_only_fields = fields


class InventoryActionMixin:
    def _workspace(self):
        request = self.context.get("request")
        return getattr(request, "workspace", None)

    def _scope_field(self, field_name, model):
        workspace = self._workspace()
        if workspace is not None:
            self.fields[field_name].queryset = model.objects.filter(workspace=workspace)

    def _validate_location(self, warehouse, location, field_name="location"):
        if warehouse and location and location.warehouse_id != warehouse.id:
            raise serializers.ValidationError(
                {field_name: "Location does not belong to the selected warehouse."}
            )


class StockInSerializer(InventoryActionMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    location = serializers.PrimaryKeyRelatedField(queryset=WarehouseLocation.objects.all())
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference_type = serializers.CharField(max_length=100, required=False, allow_blank=True)
    reference_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._scope_field("product", Product)
        self._scope_field("warehouse", Warehouse)
        self._scope_field("location", WarehouseLocation)

    def validate(self, attrs):
        self._validate_location(attrs.get("warehouse"), attrs.get("location"))
        return attrs


class StockOutSerializer(StockInSerializer):
    pass


class AdjustStockSerializer(InventoryActionMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    location = serializers.PrimaryKeyRelatedField(queryset=WarehouseLocation.objects.all())
    counted_quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    reason = serializers.CharField(max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._scope_field("product", Product)
        self._scope_field("warehouse", Warehouse)
        self._scope_field("location", WarehouseLocation)

    def validate(self, attrs):
        self._validate_location(attrs.get("warehouse"), attrs.get("location"))
        return attrs


class TransferStockSerializer(InventoryActionMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    source_warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    source_location = serializers.PrimaryKeyRelatedField(
        queryset=WarehouseLocation.objects.all()
    )
    destination_warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all()
    )
    destination_location = serializers.PrimaryKeyRelatedField(
        queryset=WarehouseLocation.objects.all()
    )
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference_type = serializers.CharField(max_length=100, required=False, allow_blank=True)
    reference_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._scope_field("product", Product)
        self._scope_field("source_warehouse", Warehouse)
        self._scope_field("source_location", WarehouseLocation)
        self._scope_field("destination_warehouse", Warehouse)
        self._scope_field("destination_location", WarehouseLocation)

    def validate(self, attrs):
        self._validate_location(
            attrs.get("source_warehouse"),
            attrs.get("source_location"),
            field_name="source_location",
        )
        self._validate_location(
            attrs.get("destination_warehouse"),
            attrs.get("destination_location"),
            field_name="destination_location",
        )
        return attrs


class InventoryOperationResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    movements = StockMovementSerializer(many=True)
