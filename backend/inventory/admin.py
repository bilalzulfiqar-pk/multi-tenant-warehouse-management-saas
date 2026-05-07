from django.contrib import admin

from .models import StockLevel, StockMovement


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse", "location", "workspace", "quantity")
    list_filter = ("warehouse",)
    search_fields = (
        "product__sku",
        "product__name",
        "warehouse__code",
        "location__code",
        "workspace__name",
    )
    autocomplete_fields = ("workspace", "product", "warehouse", "location")
    ordering = ("workspace__name", "product__sku", "warehouse__code", "location__code")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "movement_type",
        "product",
        "quantity",
        "workspace",
        "performed_by",
        "created_at",
    )
    list_filter = ("movement_type", "created_at")
    search_fields = (
        "product__sku",
        "product__name",
        "reason",
        "reference_type",
        "workspace__name",
    )
    autocomplete_fields = (
        "workspace",
        "product",
        "source_warehouse",
        "source_location",
        "destination_warehouse",
        "destination_location",
        "performed_by",
    )
    ordering = ("-created_at",)
