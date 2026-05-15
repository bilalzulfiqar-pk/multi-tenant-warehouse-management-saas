from django.db import IntegrityError, transaction
from django.utils import timezone

from audit.services import AuditLogService
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
            from catalog.services import CatalogSeedService

            CatalogSeedService.seed_default_units(workspace)
            AuditLogService.record(
                workspace=workspace,
                actor=owner_user,
                action="workspace.created",
                resource_type="workspace",
                resource_id=workspace.id,
                message="Workspace created.",
                metadata={
                    "name": workspace.name,
                    "subdomain": workspace.subdomain,
                },
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
        previous_role = target_membership.role
        previous_status = target_membership.status

        new_role = changes.get("role", target_membership.role)
        new_status = changes.get("status", target_membership.status)

        if actor_membership.role == WorkspaceRole.ADMIN and new_role == WorkspaceRole.OWNER:
            raise WorkspacePermissionDenied("Admins cannot assign the owner role.")

        cls._ensure_owner_not_orphaned(target_membership, new_role, new_status)

        for field, value in changes.items():
            setattr(target_membership, field, value)
        target_membership.save(update_fields=[*changes.keys(), "updated_at"])

        if previous_role != target_membership.role:
            AuditLogService.record(
                workspace=target_membership.workspace,
                actor=actor_membership.user,
                action="member.role_changed",
                resource_type="workspace_membership",
                resource_id=target_membership.id,
                message="Workspace member role changed.",
                metadata={
                    "user_id": str(target_membership.user_id),
                    "before": {"role": previous_role},
                    "after": {"role": target_membership.role},
                },
            )
        if (
            previous_status != MembershipStatus.DISABLED
            and target_membership.status == MembershipStatus.DISABLED
        ):
            AuditLogService.record(
                workspace=target_membership.workspace,
                actor=actor_membership.user,
                action="member.disabled",
                resource_type="workspace_membership",
                resource_id=target_membership.id,
                message="Workspace member disabled.",
                metadata={
                    "user_id": str(target_membership.user_id),
                    "before": {"status": previous_status},
                    "after": {"status": target_membership.status},
                },
            )
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
    @transaction.atomic
    def create_invite(workspace, invited_by, email, role):
        invite = WorkspaceInvite.objects.create(
            workspace=workspace,
            invited_by=invited_by,
            email=email,
            role=role,
        )
        AuditLogService.record(
            workspace=workspace,
            actor=invited_by,
            action="member.invited",
            resource_type="workspace_invite",
            resource_id=invite.id,
            message="Workspace member invited.",
            metadata={"email": email, "role": role},
        )
        return invite

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
                AuditLogService.record(
                    workspace=workspace,
                    actor=user,
                    action="member.invite_accepted",
                    resource_type="workspace_membership",
                    resource_id=membership.id,
                    message="Workspace invite accepted.",
                    metadata={
                        "invite_id": str(invite.id),
                        "email": invite.email,
                        "role": membership.role,
                    },
                )

        if expired:
            raise InviteExpired()

        return membership

    @staticmethod
    def get_invite_acceptance_status(workspace, token, user):
        try:
            invite = WorkspaceInvite.objects.get(token=token)
        except WorkspaceInvite.DoesNotExist:
            return {
                "status": "invalid",
                "can_accept": False,
                "message": "Invite token is invalid.",
            }

        if invite.workspace_id != workspace.id:
            return {
                "status": "invalid",
                "can_accept": False,
                "message": "Invite token is invalid for this workspace.",
            }

        if invite.status == InviteStatus.CANCELLED:
            return {
                "status": InviteStatus.CANCELLED,
                "can_accept": False,
                "message": "This invite has been cancelled.",
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at,
            }

        if invite.status == InviteStatus.ACCEPTED:
            return {
                "status": InviteStatus.ACCEPTED,
                "can_accept": False,
                "message": "This invite has already been accepted.",
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at,
            }

        if invite.expires_at <= timezone.now():
            if invite.status != InviteStatus.EXPIRED:
                invite.status = InviteStatus.EXPIRED
                invite.save(update_fields=["status", "updated_at"])
            return {
                "status": InviteStatus.EXPIRED,
                "can_accept": False,
                "message": "This invite has expired.",
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at,
            }

        if invite.email.lower() != user.email.lower():
            return {
                "status": "wrong_email",
                "can_accept": False,
                "message": "Sign in with the invited email address to accept this invite.",
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at,
            }

        if WorkspaceMembership.objects.filter(workspace=workspace, user=user).exists():
            return {
                "status": "already_member",
                "can_accept": False,
                "message": "You are already a member of this workspace.",
                "email": invite.email,
                "role": invite.role,
                "expires_at": invite.expires_at,
            }

        return {
            "status": InviteStatus.PENDING,
            "can_accept": True,
            "message": "This invite is ready to be accepted.",
            "email": invite.email,
            "role": invite.role,
            "expires_at": invite.expires_at,
        }

    @staticmethod
    @transaction.atomic
    def cancel_invite(invite):
        if invite.status != InviteStatus.PENDING:
            raise InvalidInvite("Only pending invites can be cancelled.")
        invite.status = InviteStatus.CANCELLED
        invite.save(update_fields=["status", "updated_at"])
        AuditLogService.record(
            workspace=invite.workspace,
            actor=invite.invited_by,
            action="member.invite_cancelled",
            resource_type="workspace_invite",
            resource_id=invite.id,
            message="Workspace invite cancelled.",
            metadata={"email": invite.email, "role": invite.role},
        )
        return invite
