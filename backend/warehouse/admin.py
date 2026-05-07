from django.contrib import admin

from .models import Warehouse, WarehouseLocation


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "workspace", "status", "city", "country")
    list_filter = ("status", "country")
    search_fields = ("name", "code", "workspace__name", "city", "country")
    autocomplete_fields = ("workspace",)
    ordering = ("workspace__name", "name")


@admin.register(WarehouseLocation)
class WarehouseLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "warehouse", "workspace", "location_type", "status")
    list_filter = ("location_type", "status")
    search_fields = ("name", "code", "warehouse__name", "workspace__name")
    autocomplete_fields = ("workspace", "warehouse")
    ordering = ("workspace__name", "warehouse__name", "code")
