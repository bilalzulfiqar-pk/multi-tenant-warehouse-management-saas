import django_filters

from .models import Product, ProductCategory, UnitOfMeasure


class ActiveBooleanTextFilter(django_filters.CharFilter):
    def filter(self, queryset, value):
        if value in django_filters.constants.EMPTY_VALUES:
            return queryset

        normalized = str(value).lower()
        if normalized == "all":
            return queryset
        if normalized in ("true", "1", "active"):
            return queryset.filter(**{self.field_name: True})
        if normalized in ("false", "0", "inactive"):
            return queryset.filter(**{self.field_name: False})
        return queryset


class ProductCategoryFilter(django_filters.FilterSet):
    is_active = ActiveBooleanTextFilter(field_name="is_active")

    class Meta:
        model = ProductCategory
        fields = ("is_active",)


class UnitOfMeasureFilter(django_filters.FilterSet):
    is_active = ActiveBooleanTextFilter(field_name="is_active")

    class Meta:
        model = UnitOfMeasure
        fields = ("is_active",)


class ProductFilter(django_filters.FilterSet):
    category = django_filters.UUIDFilter(field_name="category_id")
    unit = django_filters.UUIDFilter(field_name="unit_id")
    is_active = ActiveBooleanTextFilter(field_name="is_active")

    class Meta:
        model = Product
        fields = ("category", "unit", "is_active")
