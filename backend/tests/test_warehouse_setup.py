import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from warehouse.models import LocationType, Warehouse, WarehouseLocation, WarehouseStatus
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


def create_warehouse(workspace, code="MAIN", name="Main Warehouse"):
    return Warehouse.objects.create(
        workspace=workspace,
        name=name,
        code=code,
        city="Karachi",
        country="Pakistan",
    )


def create_location(workspace, warehouse, code="A1", name="Aisle 1"):
    return WarehouseLocation.objects.create(
        workspace=workspace,
        warehouse=warehouse,
        name=name,
        code=code,
        location_type=LocationType.STORAGE,
    )


def test_warehouses_are_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    create_warehouse(acme, code="ACME", name="Acme Main")
    create_warehouse(beta, code="BETA", name="Beta Main")

    response = api_client(acme_owner).get(
        "/api/warehouses/",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert [item["code"] for item in response.data] == ["ACME"]


def test_warehouse_code_is_unique_per_workspace(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")

    first_response = api_client(acme_owner).post(
        "/api/warehouses/",
        {"name": "Main Warehouse", "code": "main"},
        format="json",
        HTTP_HOST=tenant_host(acme),
    )
    duplicate_response = api_client(acme_owner).post(
        "/api/warehouses/",
        {"name": "Duplicate Main", "code": "MAIN"},
        format="json",
        HTTP_HOST=tenant_host(acme),
    )
    other_workspace_response = api_client(beta_owner).post(
        "/api/warehouses/",
        {"name": "Beta Main", "code": "MAIN"},
        format="json",
        HTTP_HOST=tenant_host(beta),
    )

    assert first_response.status_code == 201
    assert first_response.data["code"] == "MAIN"
    assert duplicate_response.status_code == 400
    assert other_workspace_response.status_code == 201


def test_location_code_is_unique_per_workspace_and_warehouse(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    first_warehouse = create_warehouse(workspace, code="MAIN")
    second_warehouse = create_warehouse(workspace, code="BULK", name="Bulk Warehouse")

    first_response = api_client(owner).post(
        "/api/locations/",
        {
            "warehouse": first_warehouse.id,
            "name": "Aisle 1",
            "code": "a1",
            "location_type": LocationType.STORAGE,
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    duplicate_response = api_client(owner).post(
        "/api/locations/",
        {
            "warehouse": first_warehouse.id,
            "name": "Duplicate Aisle",
            "code": "A1",
            "location_type": LocationType.STORAGE,
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    other_warehouse_response = api_client(owner).post(
        "/api/locations/",
        {
            "warehouse": second_warehouse.id,
            "name": "Aisle 1",
            "code": "A1",
            "location_type": LocationType.STORAGE,
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert first_response.status_code == 201
    assert first_response.data["code"] == "A1"
    assert duplicate_response.status_code == 400
    assert other_warehouse_response.status_code == 201


def test_location_cannot_use_warehouse_from_another_workspace(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    beta_warehouse = create_warehouse(beta, code="BETA", name="Beta Main")

    response = api_client(acme_owner).post(
        "/api/locations/",
        {
            "warehouse": beta_warehouse.id,
            "name": "Wrong Tenant Location",
            "code": "X1",
            "location_type": LocationType.STORAGE,
        },
        format="json",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 400
    assert not WarehouseLocation.objects.filter(workspace=acme).exists()


def test_staff_cannot_create_or_update_warehouses_or_locations(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)
    warehouse = create_warehouse(workspace)
    location = create_location(workspace, warehouse)

    create_warehouse_response = api_client(staff).post(
        "/api/warehouses/",
        {"name": "Staff Warehouse", "code": "STAFF"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    update_warehouse_response = api_client(staff).patch(
        f"/api/warehouses/{warehouse.id}/",
        {"name": "Staff Edit"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    create_location_response = api_client(staff).post(
        "/api/locations/",
        {"warehouse": warehouse.id, "name": "Staff Location", "code": "S1"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    update_location_response = api_client(staff).patch(
        f"/api/locations/{location.id}/",
        {"name": "Staff Location Edit"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    list_response = api_client(staff).get(
        "/api/warehouses/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert create_warehouse_response.status_code == 403
    assert update_warehouse_response.status_code == 403
    assert create_location_response.status_code == 403
    assert update_location_response.status_code == 403
    assert list_response.status_code == 200


def test_manager_can_create_and_update_warehouses_and_locations(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    manager = create_user(django_user_model, "manager@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, manager, role=WorkspaceRole.MANAGER)

    warehouse_response = api_client(manager).post(
        "/api/warehouses/",
        {"name": "Overflow Warehouse", "code": "ovf", "city": "Lahore"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    warehouse_id = warehouse_response.data["id"]
    warehouse_update_response = api_client(manager).patch(
        f"/api/warehouses/{warehouse_id}/",
        {"city": "Islamabad"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    location_response = api_client(manager).post(
        "/api/locations/",
        {
            "warehouse": warehouse_id,
            "name": "Overflow Rack",
            "code": "r1",
            "location_type": LocationType.OTHER,
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    location_id = location_response.data["id"]
    location_update_response = api_client(manager).patch(
        f"/api/locations/{location_id}/",
        {"name": "Overflow Rack Updated"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert warehouse_response.status_code == 201
    assert warehouse_response.data["code"] == "OVF"
    assert warehouse_update_response.status_code == 200
    assert warehouse_update_response.data["city"] == "Islamabad"
    assert location_response.status_code == 201
    assert location_response.data["code"] == "R1"
    assert location_update_response.status_code == 200
    assert location_update_response.data["name"] == "Overflow Rack Updated"


def test_deactivated_locations_do_not_appear_in_default_active_lists(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)
    warehouse = create_warehouse(workspace)
    active_location = create_location(workspace, warehouse, code="A1", name="Aisle 1")
    inactive_location = create_location(workspace, warehouse, code="B1", name="Aisle 2")

    deactivate_response = api_client(owner).post(
        f"/api/locations/{inactive_location.id}/deactivate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    default_response = api_client(owner).get(
        "/api/locations/",
        HTTP_HOST=tenant_host(workspace),
    )
    inactive_response = api_client(owner).get(
        "/api/locations/?status=inactive",
        HTTP_HOST=tenant_host(workspace),
    )
    staff_inactive_response = api_client(staff).get(
        "/api/locations/?status=inactive",
        HTTP_HOST=tenant_host(workspace),
    )

    assert deactivate_response.status_code == 200
    assert deactivate_response.data["status"] == WarehouseStatus.INACTIVE
    assert [item["id"] for item in default_response.data] == [str(active_location.id)]
    assert [item["id"] for item in inactive_response.data] == [str(inactive_location.id)]
    assert staff_inactive_response.data == []


def test_warehouse_activate_and_deactivate_actions(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    warehouse = create_warehouse(workspace)

    deactivate_response = api_client(owner).post(
        f"/api/warehouses/{warehouse.id}/deactivate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    activate_response = api_client(owner).post(
        f"/api/warehouses/{warehouse.id}/activate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert deactivate_response.status_code == 200
    assert deactivate_response.data["status"] == WarehouseStatus.INACTIVE
    assert activate_response.status_code == 200
    assert activate_response.data["status"] == WarehouseStatus.ACTIVE
