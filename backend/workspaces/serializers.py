from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from .models import (
    InviteStatus,
    MembershipStatus,
    Workspace,
    WorkspaceInvite,
    WorkspaceMembership,
    WorkspaceRole,
)
from .services import WorkspaceInviteService, WorkspaceService


class WorkspaceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    subdomain = serializers.SlugField(max_length=100)

    def validate_subdomain(self, value):
        if Workspace.objects.filter(subdomain=value).exists():
            raise serializers.ValidationError("Workspace subdomain is already in use.")
        return value

    def create(self, validated_data):
        return WorkspaceService.create_workspace(
            owner_user=self.context["request"].user,
            name=validated_data["name"],
            subdomain=validated_data["subdomain"],
        )

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "name": instance.name,
            "subdomain": instance.subdomain,
            "role": WorkspaceRole.OWNER,
        }


class WorkspaceListSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="membership_role")

    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "subdomain", "status", "role")


class CurrentWorkspaceSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="current_user_role", read_only=True)

    class Meta:
        model = Workspace
        fields = (
            "id",
            "name",
            "slug",
            "subdomain",
            "status",
            "default_timezone",
            "low_stock_dashboard_enabled",
            "role",
        )
        read_only_fields = ("id", "slug", "subdomain", "status", "role")


class UserReferenceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    invited_by = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceMembership
        fields = (
            "id",
            "user",
            "role",
            "status",
            "invited_by",
            "joined_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user",
            "invited_by",
            "joined_at",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(UserReferenceSerializer)
    def get_user(self, obj):
        return {
            "id": str(obj.user_id),
            "email": obj.user.email,
            "full_name": obj.user.full_name,
        }

    @extend_schema_field(UserReferenceSerializer(allow_null=True))
    def get_invited_by(self, obj):
        if obj.invited_by_id is None:
            return None
        return {
            "id": str(obj.invited_by_id),
            "email": obj.invited_by.email,
            "full_name": obj.invited_by.full_name,
        }

    def validate_role(self, value):
        if value not in WorkspaceRole.values:
            raise serializers.ValidationError("Invalid workspace role.")
        return value

    def validate_status(self, value):
        if value not in (MembershipStatus.ACTIVE, MembershipStatus.DISABLED):
            raise serializers.ValidationError("Invalid membership status.")
        return value


class WorkspaceInviteSerializer(serializers.ModelSerializer):
    invite_link = serializers.SerializerMethodField()
    invited_by = serializers.SerializerMethodField()
    accepted_by = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceInvite
        fields = (
            "id",
            "email",
            "role",
            "status",
            "expires_at",
            "accepted_at",
            "invited_by",
            "accepted_by",
            "invite_link",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "expires_at",
            "accepted_at",
            "invited_by",
            "accepted_by",
            "invite_link",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(OpenApiTypes.URI)
    def get_invite_link(self, obj):
        request = self.context.get("request")
        path = f"/api/invites/accept/?token={obj.token}"
        if request is None:
            return path
        return request.build_absolute_uri(path)

    @extend_schema_field(UserReferenceSerializer)
    def get_invited_by(self, obj):
        return {
            "id": str(obj.invited_by_id),
            "email": obj.invited_by.email,
            "full_name": obj.invited_by.full_name,
        }

    @extend_schema_field(UserReferenceSerializer(allow_null=True))
    def get_accepted_by(self, obj):
        if obj.accepted_by_id is None:
            return None
        return {
            "id": str(obj.accepted_by_id),
            "email": obj.accepted_by.email,
            "full_name": obj.accepted_by.full_name,
        }

    def validate_role(self, value):
        if value not in (
            WorkspaceRole.ADMIN,
            WorkspaceRole.MANAGER,
            WorkspaceRole.STAFF,
            WorkspaceRole.VIEWER,
        ):
            raise serializers.ValidationError("Invalid invite role.")
        return value

    def validate_email(self, value):
        return value.lower()

    def create(self, validated_data):
        request = self.context["request"]
        return WorkspaceInviteService.create_invite(
            workspace=request.workspace,
            invited_by=request.user,
            email=validated_data["email"],
            role=validated_data["role"],
        )


class InviteAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()

    def create(self, validated_data):
        request = self.context["request"]
        return WorkspaceInviteService.accept_invite(
            workspace=request.workspace,
            token=validated_data["token"],
            user=request.user,
        )

    def to_representation(self, instance):
        return WorkspaceMembershipSerializer(instance).data
