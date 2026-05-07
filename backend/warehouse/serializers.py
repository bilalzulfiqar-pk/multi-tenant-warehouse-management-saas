from django.db import IntegrityError
from rest_framework import serializers

from .models import LocationType, Warehouse, WarehouseLocation, WarehouseStatus


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = (
            "id",
            "name",
            "code",
            "address_line1",
            "address_line2",
            "city",
            "country",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def validate_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        request = self.context["request"]
        workspace = request.workspace
        code = attrs.get("code", getattr(self.instance, "code", None))
        if code is not None:
            queryset = Warehouse.objects.filter(workspace=workspace, code=code)
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"code": "Warehouse code must be unique in this workspace."}
                )
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"code": "Warehouse code must be unique in this workspace."}
            ) from exc


class WarehouseLocationSerializer(serializers.ModelSerializer):
    warehouse_detail = WarehouseSerializer(source="warehouse", read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        workspace = getattr(request, "workspace", None)
        if workspace is not None:
            self.fields["warehouse"].queryset = Warehouse.objects.filter(
                workspace=workspace
            )

    class Meta:
        model = WarehouseLocation
        fields = (
            "id",
            "warehouse",
            "warehouse_detail",
            "name",
            "code",
            "location_type",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "warehouse_detail", "status", "created_at", "updated_at")

    def validate_code(self, value):
        return value.strip().upper()

    def validate_location_type(self, value):
        if value not in LocationType.values:
            raise serializers.ValidationError("Invalid location type.")
        return value

    def validate_warehouse(self, value):
        if value.workspace_id != self.context["request"].workspace.id:
            raise serializers.ValidationError("Warehouse does not belong to this workspace.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        workspace = request.workspace
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        code = attrs.get("code", getattr(self.instance, "code", None))
        if warehouse is not None and code is not None:
            queryset = WarehouseLocation.objects.filter(
                workspace=workspace,
                warehouse=warehouse,
                code=code,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"code": "Location code must be unique in this warehouse."}
                )
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"code": "Location code must be unique in this warehouse."}
            ) from exc
