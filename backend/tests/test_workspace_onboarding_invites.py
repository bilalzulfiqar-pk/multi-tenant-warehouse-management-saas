from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from workspaces.models import (
    InviteStatus,
    MembershipStatus,
    Workspace,
    WorkspaceInvite,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceStatus,
)


pytestmark = pytest.mark.django_db


def api_client(user=None):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


def list_results(response):
    return response.data["results"]


def create_user(django_user_model, email="user@example.com"):
    return django_user_model.objects.create_user(
        email=email,
        password="strong-password-123",
        full_name=email.split("@")[0].title(),
    )


def create_workspace(owner, subdomain="acme"):
    workspace = Workspace.objects.create(
        name=f"{subdomain.title()} Logistics",
        slug=subdomain,
        subdomain=subdomain,
        status=WorkspaceStatus.ACTIVE,
        created_by=owner,
    )
    WorkspaceMembership.objects.create(
        workspace=workspace,
        user=owner,
        role=WorkspaceRole.OWNER,
        status=MembershipStatus.ACTIVE,
        joined_at=timezone.now(),
    )
    return workspace


def add_member(workspace, user, role=WorkspaceRole.STAFF, status=MembershipStatus.ACTIVE):
    return WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=role,
        status=status,
        joined_at=timezone.now() if status == MembershipStatus.ACTIVE else None,
    )


def tenant_host(workspace):
    return f"{workspace.subdomain}.localhost:8000"


def test_workspace_creator_becomes_owner_automatically(django_user_model):
    user = create_user(django_user_model)

    response = api_client(user).post(
        "/api/workspaces/create/",
        {"name": "Acme Logistics", "subdomain": "acme"},
        format="json",
        HTTP_HOST="localhost:8000",
    )

    assert response.status_code == 201
    assert response.data["name"] == "Acme Logistics"
    assert response.data["subdomain"] == "acme"
    assert response.data["role"] == WorkspaceRole.OWNER

    workspace = Workspace.objects.get(subdomain="acme")
    membership = WorkspaceMembership.objects.get(workspace=workspace, user=user)
    assert membership.role == WorkspaceRole.OWNER
    assert membership.status == MembershipStatus.ACTIVE


def test_workspace_create_rejects_duplicate_subdomain_without_extra_membership(
    django_user_model,
):
    first_owner = create_user(django_user_model, "first@example.com")
    second_owner = create_user(django_user_model, "second@example.com")
    create_workspace(first_owner, subdomain="acme")

    response = api_client(second_owner).post(
        "/api/workspaces/create/",
        {"name": "Duplicate Acme", "subdomain": "acme"},
        format="json",
        HTTP_HOST="localhost:8000",
    )

    assert response.status_code == 400
    assert Workspace.objects.filter(subdomain="acme").count() == 1
    assert not WorkspaceMembership.objects.filter(user=second_owner).exists()


def test_workspace_list_returns_current_users_active_workspaces(django_user_model):
    user = create_user(django_user_model)
    other_user = create_user(django_user_model, "other@example.com")
    acme = create_workspace(user, subdomain="acme")
    beta = create_workspace(other_user, subdomain="beta")
    add_member(beta, user, role=WorkspaceRole.MANAGER)
    gamma = create_workspace(other_user, subdomain="gamma")
    add_member(gamma, user, status=MembershipStatus.DISABLED)

    response = api_client(user).get("/api/workspaces/", HTTP_HOST="localhost:8000")

    assert response.status_code == 200
    subdomains = {item["subdomain"] for item in list_results(response)}
    assert subdomains == {"acme", "beta"}
    roles = {item["subdomain"]: item["role"] for item in list_results(response)}
    assert roles[acme.subdomain] == WorkspaceRole.OWNER
    assert roles[beta.subdomain] == WorkspaceRole.MANAGER


def test_current_workspace_detail_and_owner_settings_update(django_user_model):
    owner = create_user(django_user_model)
    workspace = create_workspace(owner)

    detail_response = api_client(owner).get(
        "/api/workspace/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert detail_response.status_code == 200
    assert detail_response.data["subdomain"] == "acme"
    assert detail_response.data["role"] == WorkspaceRole.OWNER

    update_response = api_client(owner).patch(
        "/api/workspace/",
        {"name": "Acme Updated", "low_stock_dashboard_enabled": False},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert update_response.status_code == 200
    assert update_response.data["name"] == "Acme Updated"
    assert update_response.data["low_stock_dashboard_enabled"] is False


def test_non_owner_cannot_update_current_workspace_settings(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    manager = create_user(django_user_model, "manager@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, manager, role=WorkspaceRole.MANAGER)

    response = api_client(manager).patch(
        "/api/workspace/",
        {"name": "Manager Edit"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "permission_denied"


def test_owner_can_list_update_and_disable_members(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace = create_workspace(owner)
    staff_membership = add_member(workspace, staff, role=WorkspaceRole.STAFF)

    list_response = api_client(owner).get(
        "/api/members/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert list_response.status_code == 200
    assert len(list_results(list_response)) == 2

    update_response = api_client(owner).patch(
        f"/api/members/{staff_membership.id}/",
        {"role": WorkspaceRole.MANAGER},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert update_response.status_code == 200
    assert update_response.data["role"] == WorkspaceRole.MANAGER

    disable_response = api_client(owner).post(
        f"/api/members/{staff_membership.id}/disable/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert disable_response.status_code == 200
    assert disable_response.data["status"] == MembershipStatus.DISABLED


def test_admin_cannot_disable_owner(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    admin = create_user(django_user_model, "admin@example.com")
    workspace = create_workspace(owner)
    owner_membership = WorkspaceMembership.objects.get(workspace=workspace, user=owner)
    add_member(workspace, admin, role=WorkspaceRole.ADMIN)

    response = api_client(admin).post(
        f"/api/members/{owner_membership.id}/disable/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "permission_denied"


def test_owner_cannot_disable_last_active_owner(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    owner_membership = WorkspaceMembership.objects.get(workspace=workspace, user=owner)

    response = api_client(owner).post(
        f"/api/members/{owner_membership.id}/disable/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


def test_only_owner_or_admin_can_create_invites(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    manager = create_user(django_user_model, "manager@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, manager, role=WorkspaceRole.MANAGER)

    owner_response = api_client(owner).post(
        "/api/invites/",
        {"email": "newuser@example.com", "role": WorkspaceRole.STAFF},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert owner_response.status_code == 201
    assert owner_response.data["status"] == InviteStatus.PENDING
    assert "invite_link" in owner_response.data

    manager_response = api_client(manager).post(
        "/api/invites/",
        {"email": "blocked@example.com", "role": WorkspaceRole.STAFF},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert manager_response.status_code == 403
    assert manager_response.data["error"]["code"] == "permission_denied"


def test_invite_can_be_accepted_once(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    invited_user = create_user(django_user_model, "invited@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email=invited_user.email,
        role=WorkspaceRole.STAFF,
        invited_by=owner,
    )

    response = api_client(invited_user).post(
        "/api/invites/accept/",
        {"token": invite.token},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 201
    assert response.data["role"] == WorkspaceRole.STAFF
    invite.refresh_from_db()
    assert invite.status == InviteStatus.ACCEPTED
    assert invite.accepted_by == invited_user
    assert WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=invited_user,
        status=MembershipStatus.ACTIVE,
    ).exists()

    second_response = api_client(invited_user).post(
        "/api/invites/accept/",
        {"token": invite.token},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert second_response.status_code == 400
    assert second_response.data["error"]["code"] == "invalid_invite"


def test_expired_invite_cannot_be_accepted(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    invited_user = create_user(django_user_model, "invited@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email=invited_user.email,
        role=WorkspaceRole.STAFF,
        invited_by=owner,
        expires_at=timezone.now() - timedelta(days=1),
    )

    response = api_client(invited_user).post(
        "/api/invites/accept/",
        {"token": invite.token},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "invite_expired"
    invite.refresh_from_db()
    assert invite.status == InviteStatus.EXPIRED


def test_invite_email_must_match_authenticated_user(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    wrong_user = create_user(django_user_model, "wrong@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email="invited@example.com",
        role=WorkspaceRole.STAFF,
        invited_by=owner,
    )

    response = api_client(wrong_user).post(
        "/api/invites/accept/",
        {"token": invite.token},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_invite"
    assert not WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=wrong_user,
    ).exists()


def test_invite_token_must_belong_to_request_workspace(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    invited_user = create_user(django_user_model, "invited@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    invite = WorkspaceInvite.objects.create(
        workspace=acme,
        email=invited_user.email,
        role=WorkspaceRole.STAFF,
        invited_by=acme_owner,
    )

    response = api_client(invited_user).post(
        "/api/invites/accept/",
        {"token": invite.token},
        format="json",
        HTTP_HOST=tenant_host(beta),
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_invite"
    assert not WorkspaceMembership.objects.filter(
        workspace=beta,
        user=invited_user,
    ).exists()


def test_already_member_cannot_accept_invite(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    member = create_user(django_user_model, "member@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, member)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email=member.email,
        role=WorkspaceRole.STAFF,
        invited_by=owner,
    )

    response = api_client(member).post(
        "/api/invites/accept/",
        {"token": invite.token},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_invite"


def test_owner_can_cancel_pending_invite(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email="newuser@example.com",
        role=WorkspaceRole.VIEWER,
        invited_by=owner,
    )

    response = api_client(owner).post(
        f"/api/invites/{invite.id}/cancel/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["status"] == InviteStatus.CANCELLED


def test_invite_accept_status_reports_pending_for_matching_user(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    invited_user = create_user(django_user_model, "invited@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email=invited_user.email,
        role=WorkspaceRole.MANAGER,
        invited_by=owner,
    )

    response = api_client(invited_user).get(
        f"/api/invites/accept/?token={invite.token}",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["status"] == InviteStatus.PENDING
    assert response.data["can_accept"] is True
    assert response.data["email"] == invited_user.email


def test_invite_accept_status_reports_cancelled_invite(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    invited_user = create_user(django_user_model, "invited@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email=invited_user.email,
        role=WorkspaceRole.STAFF,
        invited_by=owner,
        status=InviteStatus.CANCELLED,
    )

    response = api_client(invited_user).get(
        f"/api/invites/accept/?token={invite.token}",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["status"] == InviteStatus.CANCELLED
    assert response.data["can_accept"] is False


def test_invite_accept_status_reports_wrong_email(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    wrong_user = create_user(django_user_model, "wrong@example.com")
    workspace = create_workspace(owner)
    invite = WorkspaceInvite.objects.create(
        workspace=workspace,
        email="invited@example.com",
        role=WorkspaceRole.STAFF,
        invited_by=owner,
    )

    response = api_client(wrong_user).get(
        f"/api/invites/accept/?token={invite.token}",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 200
    assert response.data["status"] == "wrong_email"
    assert response.data["can_accept"] is False
