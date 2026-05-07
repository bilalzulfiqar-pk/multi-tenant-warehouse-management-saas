import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditLog
from audit.services import AuditLogService
from catalog.models import UnitOfMeasure
from warehouse.models import LocationType, WarehouseLocation
from workspaces.models import (
    MembershipStatus,
    Workspace,
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


def create_user(django_user_model, email):
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


def add_member(workspace, user, role=WorkspaceRole.STAFF):
    return WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=role,
        status=MembershipStatus.ACTIVE,
        joined_at=timezone.now(),
    )


def tenant_host(workspace):
    return f"{workspace.subdomain}.localhost:8000"


def test_important_actions_create_audit_logs(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    invited_user = create_user(django_user_model, "invited@example.com")

    workspace_response = api_client(owner).post(
        "/api/workspaces/create/",
        {"name": "Acme Logistics", "subdomain": "acme"},
        format="json",
        HTTP_HOST="localhost:8000",
    )
    workspace = Workspace.objects.get(subdomain="acme")

    invite_response = api_client(owner).post(
        "/api/invites/",
        {"email": invited_user.email, "role": WorkspaceRole.STAFF},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    accept_response = api_client(invited_user).post(
        "/api/invites/accept/",
        {"token": workspace.invites.get().token},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    membership = WorkspaceMembership.objects.get(workspace=workspace, user=invited_user)
    member_update_response = api_client(owner).patch(
        f"/api/members/{membership.id}/",
        {"role": WorkspaceRole.MANAGER},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    warehouse_response = api_client(owner).post(
        "/api/warehouses/",
        {"name": "Main Warehouse", "code": "MAIN"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    warehouse_id = warehouse_response.data["id"]
    location_response = api_client(owner).post(
        "/api/locations/",
        {
            "warehouse": warehouse_id,
            "name": "Aisle 1",
            "code": "A1",
            "location_type": LocationType.STORAGE,
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    unit = UnitOfMeasure.objects.get(workspace=workspace, abbreviation="pcs")
    product_response = api_client(owner).post(
        "/api/products/",
        {"unit": str(unit.id), "name": "Rice Bag", "sku": "RICE-25KG"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    stock_response = api_client(owner).post(
        "/api/inventory/stock-in/",
        {
            "product": product_response.data["id"],
            "warehouse": warehouse_id,
            "location": location_response.data["id"],
            "quantity": "10.000",
            "reason": "Initial stock",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert workspace_response.status_code == 201
    assert invite_response.status_code == 201
    assert accept_response.status_code == 201
    assert member_update_response.status_code == 200
    assert warehouse_response.status_code == 201
    assert location_response.status_code == 201
    assert product_response.status_code == 201
    assert stock_response.status_code == 200

    actions = set(AuditLog.objects.filter(workspace=workspace).values_list("action", flat=True))
    assert {
        "workspace.created",
        "member.invited",
        "member.invite_accepted",
        "member.role_changed",
        "warehouse.created",
        "location.created",
        "product.created",
        "stock.stock_in",
    }.issubset(actions)


def test_audit_log_api_is_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    AuditLogService.record(
        workspace=acme,
        actor=acme_owner,
        action="warehouse.created",
        resource_type="warehouse",
        resource_id="acme-resource",
    )
    AuditLogService.record(
        workspace=beta,
        actor=beta_owner,
        action="warehouse.created",
        resource_type="warehouse",
        resource_id="beta-resource",
    )

    response = api_client(acme_owner).get(
        "/api/audit-logs/",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert [item["resource_id"] for item in response.data] == ["acme-resource"]


def test_staff_and_viewer_cannot_access_audit_logs(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    viewer = create_user(django_user_model, "viewer@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)
    add_member(workspace, viewer, role=WorkspaceRole.VIEWER)
    AuditLogService.record(
        workspace=workspace,
        actor=owner,
        action="workspace.updated",
        resource_type="workspace",
        resource_id=workspace.id,
    )

    staff_response = api_client(staff).get(
        "/api/audit-logs/",
        HTTP_HOST=tenant_host(workspace),
    )
    viewer_response = api_client(viewer).get(
        "/api/audit-logs/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert staff_response.status_code == 403
    assert viewer_response.status_code == 403


def test_audit_log_api_is_read_only(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    audit_log = AuditLogService.record(
        workspace=workspace,
        actor=owner,
        action="workspace.updated",
        resource_type="workspace",
        resource_id=workspace.id,
    )

    create_response = api_client(owner).post(
        "/api/audit-logs/",
        {"action": "manual"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    update_response = api_client(owner).patch(
        f"/api/audit-logs/{audit_log.id}/",
        {"message": "tampered"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    delete_response = api_client(owner).delete(
        f"/api/audit-logs/{audit_log.id}/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert create_response.status_code == 405
    assert update_response.status_code == 405
    assert delete_response.status_code == 405


def test_audit_metadata_redacts_sensitive_values(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)

    audit_log = AuditLogService.record(
        workspace=workspace,
        actor=owner,
        action="workspace.updated",
        resource_type="workspace",
        resource_id=workspace.id,
        metadata={
            "password": "plain-text",
            "refresh_token": "secret-refresh",
            "nested": {"api_key": "secret-key", "safe": "value"},
        },
    )

    assert audit_log.metadata["password"] == "[redacted]"
    assert audit_log.metadata["refresh_token"] == "[redacted]"
    assert audit_log.metadata["nested"]["api_key"] == "[redacted]"
    assert audit_log.metadata["nested"]["safe"] == "value"
