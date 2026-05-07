import django_filters

from .models import AuditLog


class AuditLogFilter(django_filters.FilterSet):
    actor = django_filters.UUIDFilter(field_name="actor_id")
    created_at = django_filters.IsoDateTimeFromToRangeFilter()

    class Meta:
        model = AuditLog
        fields = (
            "action",
            "resource_type",
            "resource_id",
            "actor",
            "created_at",
        )
