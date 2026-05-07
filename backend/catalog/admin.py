from django.contrib import admin

from .models import Product, ProductCategory, UnitOfMeasure


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description", "workspace__name")
    autocomplete_fields = ("workspace",)
    ordering = ("workspace__name", "name")


@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ("name", "abbreviation", "workspace", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "abbreviation", "workspace__name")
    autocomplete_fields = ("workspace",)
    ordering = ("workspace__name", "name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "workspace", "category", "unit", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "sku", "description", "workspace__name")
    autocomplete_fields = ("workspace", "category", "unit")
    ordering = ("workspace__name", "name")
