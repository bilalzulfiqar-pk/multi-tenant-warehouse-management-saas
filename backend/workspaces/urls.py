from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    CurrentWorkspaceView,
    WorkspaceCreateView,
    WorkspaceInviteViewSet,
    WorkspaceListView,
    WorkspaceMemberViewSet,
)

router = SimpleRouter()
router.register("members", WorkspaceMemberViewSet, basename="member")
router.register("invites", WorkspaceInviteViewSet, basename="invite")

urlpatterns = [
    path("workspaces/create/", WorkspaceCreateView.as_view(), name="workspace-create"),
    path("workspaces/", WorkspaceListView.as_view(), name="workspace-list"),
    path("workspace/", CurrentWorkspaceView.as_view(), name="current-workspace"),
    *router.urls,
]
