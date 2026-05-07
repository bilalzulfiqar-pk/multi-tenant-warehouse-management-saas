from rest_framework import filters, permissions, viewsets

from common.mixins import TenantScopedQuerysetMixin
from workspaces.permissions import HasWorkspace, IsWorkspaceMember

from .models import AuditLog
from .permissions import CanViewAuditLogs
from .serializers import AuditLogSerializer


class AuditLogViewSet(TenantScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasWorkspace,
        IsWorkspaceMember,
        CanViewAuditLogs,
    ]
    queryset = AuditLog.objects.select_related("workspace", "actor")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = (
        "action",
        "resource_type",
        "resource_id",
        "message",
        "actor__email",
    )
    ordering_fields = ("created_at", "action", "resource_type")
    ordering = ("-created_at",)

    def get_queryset(self):
        queryset = super().get_queryset()
        action = self.request.query_params.get("action")
        resource_type = self.request.query_params.get("resource_type")
        resource_id = self.request.query_params.get("resource_id")
        actor_id = self.request.query_params.get("actor")
        if action:
            queryset = queryset.filter(action=action)
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        if resource_id:
            queryset = queryset.filter(resource_id=resource_id)
        if actor_id:
            queryset = queryset.filter(actor_id=actor_id)
        return queryset
