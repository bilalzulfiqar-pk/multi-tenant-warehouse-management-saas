from common.exceptions import WorkspaceRequired


class TenantScopedQuerysetMixin:
    """
    Scope tenant-owned viewset querysets and creates to request.workspace.
    """

    workspace_field = "workspace"

    def get_workspace(self):
        workspace = getattr(self.request, "workspace", None)
        if workspace is None:
            raise WorkspaceRequired()
        return workspace

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(**{self.workspace_field: self.get_workspace()})

    def perform_create(self, serializer):
        serializer.save(**{self.workspace_field: self.get_workspace()})
