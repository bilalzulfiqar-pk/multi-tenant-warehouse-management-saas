from rest_framework import permissions

from common.exceptions import (
    MembershipRequired,
    WorkspacePermissionDenied,
    WorkspaceRequired,
)

from .models import MembershipStatus, WorkspaceMembership, WorkspaceRole


class HasWorkspace(permissions.BasePermission):
    message = "A tenant workspace is required for this endpoint."

    def has_permission(self, request, view):
        if getattr(request, "workspace", None) is None:
            raise WorkspaceRequired()
        return True


class IsWorkspaceMember(permissions.BasePermission):
    message = "Active workspace membership is required."

    def has_permission(self, request, view):
        workspace = getattr(request, "workspace", None)
        if workspace is None:
            raise WorkspaceRequired()

        if not request.user or not request.user.is_authenticated:
            return False

        membership = (
            WorkspaceMembership.objects.filter(
                workspace=workspace,
                user=request.user,
                status=MembershipStatus.ACTIVE,
            )
            .select_related("workspace", "user")
            .first()
        )
        if membership is None:
            raise MembershipRequired()

        request.workspace_membership = membership
        return True


class HasWorkspaceRole(permissions.BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        membership = getattr(request, "workspace_membership", None)
        if membership is None:
            IsWorkspaceMember().has_permission(request, view)
            membership = request.workspace_membership

        if membership.role not in self.allowed_roles:
            raise WorkspacePermissionDenied()

        return True


class IsViewerReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        membership = getattr(request, "workspace_membership", None)
        if membership is None:
            IsWorkspaceMember().has_permission(request, view)
            membership = request.workspace_membership

        if request.method in permissions.SAFE_METHODS:
            return True

        if membership.role == WorkspaceRole.VIEWER:
            raise WorkspacePermissionDenied()

        return True


class CanManageMembers(HasWorkspaceRole):
    allowed_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


class IsWorkspaceOwner(HasWorkspaceRole):
    allowed_roles = (WorkspaceRole.OWNER,)


class CanManageInventory(HasWorkspaceRole):
    allowed_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)


class CanStockInOut(HasWorkspaceRole):
    allowed_roles = (
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
        WorkspaceRole.MANAGER,
        WorkspaceRole.STAFF,
    )


class CanAdjustStock(HasWorkspaceRole):
    allowed_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)


class CanTransferStock(HasWorkspaceRole):
    allowed_roles = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)
