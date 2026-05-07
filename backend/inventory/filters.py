import django_filters
from django.db.models import Q

from .models import StockLevel, StockMovement, StockMovementType


class StockLevelFilter(django_filters.FilterSet):
    product = django_filters.UUIDFilter(field_name="product_id")
    warehouse = django_filters.UUIDFilter(field_name="warehouse_id")
    location = django_filters.UUIDFilter(field_name="location_id")

    class Meta:
        model = StockLevel
        fields = ("product", "warehouse", "location")


class StockMovementFilter(django_filters.FilterSet):
    product = django_filters.UUIDFilter(field_name="product_id")
    movement_type = django_filters.ChoiceFilter(choices=StockMovementType.choices)
    warehouse = django_filters.UUIDFilter(method="filter_warehouse")
    location = django_filters.UUIDFilter(method="filter_location")
    created_at = django_filters.IsoDateTimeFromToRangeFilter()

    class Meta:
        model = StockMovement
        fields = ("movement_type", "product", "warehouse", "location", "created_at")

    def filter_warehouse(self, queryset, name, value):
        return queryset.filter(
            Q(source_warehouse_id=value) | Q(destination_warehouse_id=value)
        )

    def filter_location(self, queryset, name, value):
        return queryset.filter(
            Q(source_location_id=value) | Q(destination_location_id=value)
        )
