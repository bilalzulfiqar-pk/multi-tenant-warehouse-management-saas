from rest_framework import permissions, viewsets

from common.mixins import TenantScopedQuerysetMixin
from workspaces.permissions import HasWorkspace, IsWorkspaceMember

from .filters import AuditLogFilter
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
    filterset_class = AuditLogFilter
    search_fields = (
        "action",
        "resource_type",
        "resource_id",
        "message",
        "actor__email",
    )
    ordering_fields = ("created_at", "action", "resource_type")
    ordering = ("-created_at",)
