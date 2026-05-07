from rest_framework import permissions

from common.exceptions import WorkspacePermissionDenied
from workspaces.models import WorkspaceRole


class CanViewAuditLogs(permissions.BasePermission):
    allowed_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)

    def has_permission(self, request, view):
        membership = getattr(request, "workspace_membership", None)
        if membership and membership.role in self.allowed_roles:
            return True
        raise WorkspacePermissionDenied()
