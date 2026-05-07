from django.db import IntegrityError, transaction
from django.utils import timezone

from common.exceptions import (
    InvalidInvite,
    InviteExpired,
    ValidationError,
    WorkspacePermissionDenied,
)

from .models import (
    InviteStatus,
    MembershipStatus,
    Workspace,
    WorkspaceInvite,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceStatus,
)


class WorkspaceService:
    @staticmethod
    @transaction.atomic
    def create_workspace(owner_user, name, subdomain):
        try:
            workspace = Workspace.objects.create(
                name=name,
                slug=subdomain,
                subdomain=subdomain,
                status=WorkspaceStatus.ACTIVE,
                created_by=owner_user,
            )
            WorkspaceMembership.objects.create(
                workspace=workspace,
                user=owner_user,
                role=WorkspaceRole.OWNER,
                status=MembershipStatus.ACTIVE,
                joined_at=timezone.now(),
            )
        except IntegrityError as exc:
            raise ValidationError(
                "Workspace subdomain is already in use.",
                details={"subdomain": subdomain},
            ) from exc

        return workspace


class WorkspaceMembershipService:
    @staticmethod
    def active_owner_count(workspace):
        return WorkspaceMembership.objects.filter(
            workspace=workspace,
            role=WorkspaceRole.OWNER,
            status=MembershipStatus.ACTIVE,
        ).count()

    @classmethod
    def _ensure_actor_can_change_member(cls, actor_membership, target_membership):
        if actor_membership.role == WorkspaceRole.ADMIN:
            if target_membership.role == WorkspaceRole.OWNER:
                raise WorkspacePermissionDenied(
                    "Admins cannot modify workspace owners."
                )

    @classmethod
    def _ensure_owner_not_orphaned(cls, target_membership, new_role, new_status):
        was_active_owner = (
            target_membership.role == WorkspaceRole.OWNER
            and target_membership.status == MembershipStatus.ACTIVE
        )
        remains_active_owner = (
            new_role == WorkspaceRole.OWNER
            and new_status == MembershipStatus.ACTIVE
        )
        if (
            was_active_owner
            and not remains_active_owner
            and cls.active_owner_count(target_membership.workspace) <= 1
        ):
            raise ValidationError(
                "A workspace must always have at least one active owner."
            )

    @classmethod
    @transaction.atomic
    def update_membership(cls, actor_membership, target_membership, **changes):
        target_membership = WorkspaceMembership.objects.select_for_update().get(
            pk=target_membership.pk,
            workspace=actor_membership.workspace,
        )
        cls._ensure_actor_can_change_member(actor_membership, target_membership)

        new_role = changes.get("role", target_membership.role)
        new_status = changes.get("status", target_membership.status)

        if actor_membership.role == WorkspaceRole.ADMIN and new_role == WorkspaceRole.OWNER:
            raise WorkspacePermissionDenied("Admins cannot assign the owner role.")

        cls._ensure_owner_not_orphaned(target_membership, new_role, new_status)

        for field, value in changes.items():
            setattr(target_membership, field, value)
        target_membership.save(update_fields=[*changes.keys(), "updated_at"])
        return target_membership

    @classmethod
    def disable_membership(cls, actor_membership, target_membership):
        return cls.update_membership(
            actor_membership,
            target_membership,
            status=MembershipStatus.DISABLED,
        )


class WorkspaceInviteService:
    @staticmethod
    def create_invite(workspace, invited_by, email, role):
        return WorkspaceInvite.objects.create(
            workspace=workspace,
            invited_by=invited_by,
            email=email,
            role=role,
        )

    @staticmethod
    def accept_invite(workspace, token, user):
        expired = False
        with transaction.atomic():
            try:
                invite = WorkspaceInvite.objects.select_for_update().get(token=token)
            except WorkspaceInvite.DoesNotExist as exc:
                raise InvalidInvite("Invite token is invalid.") from exc

            if invite.workspace_id != workspace.id:
                raise InvalidInvite("Invite token is invalid for this workspace.")

            if invite.status != InviteStatus.PENDING:
                raise InvalidInvite("Invite cannot be accepted.")

            if invite.expires_at <= timezone.now():
                invite.status = InviteStatus.EXPIRED
                invite.save(update_fields=["status", "updated_at"])
                expired = True
                membership = None
            else:
                if invite.email.lower() != user.email.lower():
                    raise InvalidInvite(
                        "Invite email must match the authenticated user email."
                    )

                if WorkspaceMembership.objects.filter(
                    workspace=workspace,
                    user=user,
                ).exists():
                    raise InvalidInvite("User is already a workspace member.")

                membership = WorkspaceMembership.objects.create(
                    workspace=workspace,
                    user=user,
                    role=invite.role,
                    status=MembershipStatus.ACTIVE,
                    invited_by=invite.invited_by,
                    joined_at=timezone.now(),
                )
                invite.status = InviteStatus.ACCEPTED
                invite.accepted_by = user
                invite.accepted_at = timezone.now()
                invite.save(
                    update_fields=[
                        "status",
                        "accepted_by",
                        "accepted_at",
                        "updated_at",
                    ]
                )

        if expired:
            raise InviteExpired()

        return membership

    @staticmethod
    def cancel_invite(invite):
        if invite.status != InviteStatus.PENDING:
            raise InvalidInvite("Only pending invites can be cancelled.")
        invite.status = InviteStatus.CANCELLED
        invite.save(update_fields=["status", "updated_at"])
        return invite
