from django.db import IntegrityError
from rest_framework import serializers

from .models import Product, ProductCategory, UnitOfMeasure


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ("id", "name", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "is_active", "created_at", "updated_at")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name is required.")
        return value

    def validate(self, attrs):
        workspace = self.context["request"].workspace
        name = attrs.get("name", getattr(self.instance, "name", None))
        if name is not None:
            queryset = ProductCategory.objects.filter(workspace=workspace, name=name)
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"name": "Category name must be unique in this workspace."}
                )
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"name": "Category name must be unique in this workspace."}
            ) from exc

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"name": "Category name must be unique in this workspace."}
            ) from exc


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = (
            "id",
            "name",
            "abbreviation",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "is_active", "created_at", "updated_at")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Unit name is required.")
        return value

    def validate_abbreviation(self, value):
        value = value.strip().lower()
        if not value:
            raise serializers.ValidationError("Unit abbreviation is required.")
        return value

    def validate(self, attrs):
        workspace = self.context["request"].workspace
        abbreviation = attrs.get("abbreviation", getattr(self.instance, "abbreviation", None))
        if abbreviation is not None:
            queryset = UnitOfMeasure.objects.filter(
                workspace=workspace,
                abbreviation=abbreviation,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "abbreviation": (
                            "Unit abbreviation must be unique in this workspace."
                        )
                    }
                )
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"abbreviation": "Unit abbreviation must be unique in this workspace."}
            ) from exc

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"abbreviation": "Unit abbreviation must be unique in this workspace."}
            ) from exc


class ProductSerializer(serializers.ModelSerializer):
    category_detail = ProductCategorySerializer(source="category", read_only=True)
    unit_detail = UnitOfMeasureSerializer(source="unit", read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        workspace = getattr(request, "workspace", None)
        if workspace is not None:
            self.fields["category"].queryset = ProductCategory.objects.filter(
                workspace=workspace
            )
            self.fields["unit"].queryset = UnitOfMeasure.objects.filter(
                workspace=workspace
            )

    class Meta:
        model = Product
        fields = (
            "id",
            "category",
            "category_detail",
            "unit",
            "unit_detail",
            "name",
            "sku",
            "description",
            "is_active",
            "low_stock_threshold",
            "default_cost",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "category_detail",
            "unit_detail",
            "is_active",
            "created_at",
            "updated_at",
        )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Product name is required.")
        return value

    def validate_sku(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("SKU is required.")
        return value

    def validate_category(self, value):
        if value and value.workspace_id != self.context["request"].workspace.id:
            raise serializers.ValidationError(
                "Category does not belong to this workspace."
            )
        return value

    def validate_unit(self, value):
        if value.workspace_id != self.context["request"].workspace.id:
            raise serializers.ValidationError("Unit does not belong to this workspace.")
        return value

    def validate(self, attrs):
        workspace = self.context["request"].workspace
        sku = attrs.get("sku", getattr(self.instance, "sku", None))
        if sku is not None:
            queryset = Product.objects.filter(workspace=workspace, sku=sku)
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"sku": "SKU must be unique in this workspace."}
                )
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"sku": "SKU must be unique in this workspace."}
            ) from exc

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"sku": "SKU must be unique in this workspace."}
            ) from exc
