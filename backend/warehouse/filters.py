import django_filters

from .models import LocationType, Warehouse, WarehouseLocation, WarehouseStatus


class WarehouseStatusTextFilter(django_filters.CharFilter):
    def filter(self, queryset, value):
        if value in django_filters.constants.EMPTY_VALUES:
            return queryset

        normalized = str(value).lower()
        if normalized == "all":
            return queryset
        if normalized in (WarehouseStatus.ACTIVE, WarehouseStatus.INACTIVE):
            return queryset.filter(**{self.field_name: normalized})
        return queryset


class WarehouseFilter(django_filters.FilterSet):
    status = WarehouseStatusTextFilter(field_name="status")

    class Meta:
        model = Warehouse
        fields = ("status",)


class WarehouseLocationFilter(django_filters.FilterSet):
    warehouse = django_filters.UUIDFilter(field_name="warehouse_id")
    status = WarehouseStatusTextFilter(field_name="status")
    location_type = django_filters.ChoiceFilter(choices=LocationType.choices)

    class Meta:
        model = WarehouseLocation
        fields = ("warehouse", "status", "location_type")
