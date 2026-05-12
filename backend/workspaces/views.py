from django.db import transaction
from django.db.models import F
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import AuditLogService

from .models import (
    MembershipStatus,
    Workspace,
    WorkspaceInvite,
    WorkspaceMembership,
)
from .permissions import CanManageMembers, HasWorkspace, IsWorkspaceMember, IsWorkspaceOwner
from .serializers import (
    CurrentWorkspaceSerializer,
    InviteAcceptSerializer,
    WorkspaceCreateSerializer,
    WorkspaceInviteSerializer,
    WorkspaceListSerializer,
    WorkspaceMembershipSerializer,
)
from .services import WorkspaceInviteService, WorkspaceMembershipService


class WorkspaceCreateView(generics.GenericAPIView):
    serializer_class = WorkspaceCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = serializer.save()
        return Response(serializer.to_representation(workspace), status=status.HTTP_201_CREATED)


class WorkspaceListView(generics.ListAPIView):
    serializer_class = WorkspaceListSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Workspace.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Workspace.objects.none()

        return (
            Workspace.objects.filter(
                memberships__user=self.request.user,
                memberships__status=MembershipStatus.ACTIVE,
            )
            .annotate(membership_role=F("memberships__role"))
            .order_by("name")
        )


class CurrentWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasWorkspace, IsWorkspaceMember]

    @extend_schema(responses=CurrentWorkspaceSerializer)
    def get(self, request):
        workspace = request.workspace
        workspace.current_user_role = request.workspace_membership.role
        return Response(CurrentWorkspaceSerializer(workspace).data)

    @extend_schema(request=CurrentWorkspaceSerializer, responses=CurrentWorkspaceSerializer)
    def patch(self, request):
        IsWorkspaceOwner().has_permission(request, self)
        tracked_fields = ("name", "default_timezone", "low_stock_dashboard_enabled")
        before = {field: getattr(request.workspace, field) for field in tracked_fields}
        serializer = CurrentWorkspaceSerializer(
            request.workspace,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            workspace = serializer.save()
            after = {field: getattr(workspace, field) for field in tracked_fields}
            changed_fields = [
                field for field in tracked_fields if before[field] != after[field]
            ]
            if changed_fields:
                AuditLogService.record(
                    workspace=workspace,
                    actor=request.user,
                    action="workspace.updated",
                    resource_type="workspace",
                    resource_id=workspace.id,
                    message="Workspace settings updated.",
                    metadata={
                        "before": {field: before[field] for field in changed_fields},
                        "after": {field: after[field] for field in changed_fields},
                    },
                )
        workspace.current_user_role = request.workspace_membership.role
        return Response(CurrentWorkspaceSerializer(workspace).data)


class WorkspaceMemberViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkspaceMembershipSerializer
    permission_classes = [permissions.IsAuthenticated, HasWorkspace, CanManageMembers]
    queryset = WorkspaceMembership.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WorkspaceMembership.objects.none()

        return (
            WorkspaceMembership.objects.filter(workspace=self.request.workspace)
            .select_related("user", "invited_by", "workspace")
            .order_by("user__email")
        )

    def partial_update(self, request, *args, **kwargs):
        membership = self.get_object()
        serializer = self.get_serializer(membership, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = WorkspaceMembershipService.update_membership(
            actor_membership=request.workspace_membership,
            target_membership=membership,
            **serializer.validated_data,
        )
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        membership = WorkspaceMembershipService.disable_membership(
            actor_membership=request.workspace_membership,
            target_membership=self.get_object(),
        )
        return Response(self.get_serializer(membership).data)


class WorkspaceInviteViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceInviteSerializer
    queryset = WorkspaceInvite.objects.none()
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action == "accept":
            return [permissions.IsAuthenticated(), HasWorkspace()]
        return [permissions.IsAuthenticated(), HasWorkspace(), CanManageMembers()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WorkspaceInvite.objects.none()

        return (
            WorkspaceInvite.objects.filter(workspace=self.request.workspace)
            .select_related("invited_by", "accepted_by", "workspace")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invite = WorkspaceInviteService.cancel_invite(self.get_object())
        return Response(self.get_serializer(invite).data)

    @action(detail=False, methods=["post"])
    def accept(self, request):
        serializer = InviteAcceptSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(
            WorkspaceMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )
