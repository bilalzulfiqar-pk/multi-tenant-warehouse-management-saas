import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Product, ProductCategory, UnitOfMeasure
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


def list_results(response):
    return response.data["results"]


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


def create_category(workspace, name="Raw Materials"):
    return ProductCategory.objects.create(workspace=workspace, name=name)


def create_unit(workspace, name="Pieces", abbreviation="pcs"):
    return UnitOfMeasure.objects.create(
        workspace=workspace,
        name=name,
        abbreviation=abbreviation,
    )


def create_product(workspace, unit, category=None, sku="SKU-001", name="Sample Product"):
    return Product.objects.create(
        workspace=workspace,
        category=category,
        unit=unit,
        name=name,
        sku=sku,
    )


def test_workspace_creation_seeds_default_units(django_user_model):
    user = create_user(django_user_model, "owner@example.com")

    response = api_client(user).post(
        "/api/workspaces/create/",
        {"name": "Acme Logistics", "subdomain": "acme"},
        format="json",
        HTTP_HOST="localhost:8000",
    )

    assert response.status_code == 201
    workspace = Workspace.objects.get(subdomain="acme")
    abbreviations = set(
        UnitOfMeasure.objects.filter(workspace=workspace).values_list(
            "abbreviation",
            flat=True,
        )
    )
    assert abbreviations == {"pcs", "kg", "box", "liter"}


def test_products_are_tenant_scoped(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)
    create_product(acme, unit=acme_unit, sku="ACME-001", name="Acme Product")
    create_product(beta, unit=beta_unit, sku="BETA-001", name="Beta Product")

    response = api_client(acme_owner).get(
        "/api/products/",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert [item["sku"] for item in list_results(response)] == ["ACME-001"]


def test_sku_is_unique_inside_one_workspace_and_reusable_across_workspaces(
    django_user_model,
):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)

    first_response = api_client(acme_owner).post(
        "/api/products/",
        {
            "unit": str(acme_unit.id),
            "name": "Main Product",
            "sku": "main-001",
        },
        format="json",
        HTTP_HOST=tenant_host(acme),
    )
    duplicate_response = api_client(acme_owner).post(
        "/api/products/",
        {
            "unit": str(acme_unit.id),
            "name": "Duplicate Product",
            "sku": "MAIN-001",
        },
        format="json",
        HTTP_HOST=tenant_host(acme),
    )
    other_workspace_response = api_client(beta_owner).post(
        "/api/products/",
        {
            "unit": str(beta_unit.id),
            "name": "Beta Product",
            "sku": "MAIN-001",
        },
        format="json",
        HTTP_HOST=tenant_host(beta),
    )

    assert first_response.status_code == 201
    assert first_response.data["sku"] == "MAIN-001"
    assert duplicate_response.status_code == 400
    assert other_workspace_response.status_code == 201


def test_product_rejects_category_or_unit_from_another_workspace(django_user_model):
    acme_owner = create_user(django_user_model, "acme-owner@example.com")
    beta_owner = create_user(django_user_model, "beta-owner@example.com")
    acme = create_workspace(acme_owner, subdomain="acme")
    beta = create_workspace(beta_owner, subdomain="beta")
    acme_unit = create_unit(acme)
    beta_unit = create_unit(beta)
    beta_category = create_category(beta)

    wrong_unit_response = api_client(acme_owner).post(
        "/api/products/",
        {
            "unit": str(beta_unit.id),
            "name": "Wrong Unit Product",
            "sku": "WRONG-UNIT",
        },
        format="json",
        HTTP_HOST=tenant_host(acme),
    )
    wrong_category_response = api_client(acme_owner).post(
        "/api/products/",
        {
            "category": str(beta_category.id),
            "unit": str(acme_unit.id),
            "name": "Wrong Category Product",
            "sku": "WRONG-CAT",
        },
        format="json",
        HTTP_HOST=tenant_host(acme),
    )

    assert wrong_unit_response.status_code == 400
    assert wrong_category_response.status_code == 400
    assert not Product.objects.filter(workspace=acme).exists()


def test_staff_cannot_create_or_update_catalog_setup_data(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)
    category = create_category(workspace)
    unit = create_unit(workspace)
    product = create_product(workspace, category=category, unit=unit)

    category_response = api_client(staff).post(
        "/api/categories/",
        {"name": "Blocked Category"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    unit_response = api_client(staff).post(
        "/api/units/",
        {"name": "Blocked Unit", "abbreviation": "blk"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    product_create_response = api_client(staff).post(
        "/api/products/",
        {"unit": str(unit.id), "name": "Blocked Product", "sku": "BLOCKED"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    product_update_response = api_client(staff).patch(
        f"/api/products/{product.id}/",
        {"name": "Blocked Edit"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    list_response = api_client(staff).get(
        "/api/products/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert category_response.status_code == 403
    assert unit_response.status_code == 403
    assert product_create_response.status_code == 403
    assert product_update_response.status_code == 403
    assert list_response.status_code == 200


def test_manager_can_create_and_update_products(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    manager = create_user(django_user_model, "manager@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, manager, role=WorkspaceRole.MANAGER)

    category_response = api_client(manager).post(
        "/api/categories/",
        {"name": "Finished Goods", "description": "Sellable items"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    unit_response = api_client(manager).post(
        "/api/units/",
        {"name": "Cases", "abbreviation": "CASE"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    product_response = api_client(manager).post(
        "/api/products/",
        {
            "category": category_response.data["id"],
            "unit": unit_response.data["id"],
            "name": "Widget Pack",
            "sku": "widget-pack",
            "low_stock_threshold": "10.500",
            "default_cost": "15.25",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    update_response = api_client(manager).patch(
        f"/api/products/{product_response.data['id']}/",
        {"name": "Widget Pack Updated"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert category_response.status_code == 201
    assert unit_response.status_code == 201
    assert unit_response.data["abbreviation"] == "case"
    assert product_response.status_code == 201
    assert product_response.data["sku"] == "WIDGET-PACK"
    assert product_response.data["low_stock_threshold"] == "10.500"
    assert product_response.data["default_cost"] == "15.25"
    assert update_response.status_code == 200
    assert update_response.data["name"] == "Widget Pack Updated"


def test_inactive_products_are_excluded_from_default_active_lists(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    staff = create_user(django_user_model, "staff@example.com")
    workspace = create_workspace(owner)
    add_member(workspace, staff, role=WorkspaceRole.STAFF)
    unit = create_unit(workspace)
    active_product = create_product(
        workspace,
        unit=unit,
        sku="ACTIVE",
        name="Active Product",
    )
    inactive_product = create_product(
        workspace,
        unit=unit,
        sku="INACTIVE",
        name="Inactive Product",
    )

    deactivate_response = api_client(owner).post(
        f"/api/products/{inactive_product.id}/deactivate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    default_response = api_client(owner).get(
        "/api/products/",
        HTTP_HOST=tenant_host(workspace),
    )
    inactive_response = api_client(owner).get(
        "/api/products/?is_active=false",
        HTTP_HOST=tenant_host(workspace),
    )
    staff_inactive_response = api_client(staff).get(
        "/api/products/?is_active=false",
        HTTP_HOST=tenant_host(workspace),
    )

    assert deactivate_response.status_code == 200
    assert deactivate_response.data["is_active"] is False
    assert [item["id"] for item in list_results(default_response)] == [
        str(active_product.id)
    ]
    assert [item["id"] for item in list_results(inactive_response)] == [
        str(inactive_product.id)
    ]
    assert list_results(staff_inactive_response) == []


def test_category_and_unit_lifecycle_actions(django_user_model):
    owner = create_user(django_user_model, "owner@example.com")
    workspace = create_workspace(owner)
    category = create_category(workspace)
    unit = create_unit(workspace)

    category_deactivate = api_client(owner).post(
        f"/api/categories/{category.id}/deactivate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    category_activate = api_client(owner).post(
        f"/api/categories/{category.id}/activate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    unit_deactivate = api_client(owner).post(
        f"/api/units/{unit.id}/deactivate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    unit_activate = api_client(owner).post(
        f"/api/units/{unit.id}/activate/",
        {},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert category_deactivate.status_code == 200
    assert category_deactivate.data["is_active"] is False
    assert category_activate.status_code == 200
    assert category_activate.data["is_active"] is True
    assert unit_deactivate.status_code == 200
    assert unit_deactivate.data["is_active"] is False
    assert unit_activate.status_code == 200
    assert unit_activate.data["is_active"] is True
