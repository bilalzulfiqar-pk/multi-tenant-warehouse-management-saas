from rest_framework import permissions

from common.exceptions import WorkspacePermissionDenied
from workspaces.models import WorkspaceRole


class CanReadOrManageWarehouseSetup(permissions.BasePermission):
    """
    Active workspace members can read; Owner/Admin/Manager can mutate setup data.
    """

    manager_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        membership = getattr(request, "workspace_membership", None)
        if membership and membership.role in self.manager_roles:
            return True

        raise WorkspacePermissionDenied()
