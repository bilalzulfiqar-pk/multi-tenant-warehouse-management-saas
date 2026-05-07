import pytest

from workspaces.models import WorkspaceRole


pytestmark = [pytest.mark.django_db, pytest.mark.tenant]


def test_foreign_key_filters_cannot_expose_other_workspace_products(
    api_client,
    user_factory,
    workspace_factory,
    category_factory,
    unit_factory,
    product_factory,
    tenant_host,
):
    acme_owner = user_factory("acme-owner@example.com")
    beta_owner = user_factory("beta-owner@example.com")
    acme = workspace_factory(acme_owner, subdomain="acme")
    beta = workspace_factory(beta_owner, subdomain="beta")
    acme_unit = unit_factory(acme)
    beta_unit = unit_factory(beta)
    beta_category = category_factory(beta, name="Hidden Category")
    product_factory(acme, unit=acme_unit, sku="ACME-001", name="Visible Product")
    product_factory(
        beta,
        unit=beta_unit,
        category=beta_category,
        sku="BETA-001",
        name="Hidden Product",
    )
    api_client.force_authenticate(user=acme_owner)

    response = api_client.get(
        f"/api/products/?category={beta_category.id}&search=hidden",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []


def test_stock_level_filters_cannot_expose_other_workspace_stock(
    api_client,
    user_factory,
    workspace_factory,
    product_factory,
    warehouse_factory,
    location_factory,
    stock_level_factory,
    tenant_host,
):
    acme_owner = user_factory("acme-owner@example.com")
    beta_owner = user_factory("beta-owner@example.com")
    acme = workspace_factory(acme_owner, subdomain="acme")
    beta = workspace_factory(beta_owner, subdomain="beta")
    acme_product = product_factory(acme, sku="ACME-001")
    beta_product = product_factory(beta, sku="BETA-001")
    acme_warehouse = warehouse_factory(acme, code="ACME")
    beta_warehouse = warehouse_factory(beta, code="BETA")
    acme_location = location_factory(acme, acme_warehouse, code="A1")
    beta_location = location_factory(beta, beta_warehouse, code="B1")
    stock_level_factory(acme, acme_product, acme_warehouse, acme_location, "5.000")
    stock_level_factory(beta, beta_product, beta_warehouse, beta_location, "99.000")
    api_client.force_authenticate(user=acme_owner)

    response = api_client.get(
        f"/api/stock-levels/?warehouse={beta_warehouse.id}&search=BETA",
        HTTP_HOST=tenant_host(acme),
    )

    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []


def test_disabled_member_cannot_access_real_tenant_api(
    api_client,
    workspace,
    staff_user,
    member_factory,
    tenant_host,
):
    member_factory(workspace, staff_user, role=WorkspaceRole.STAFF, status="disabled")
    api_client.force_authenticate(user=staff_user)

    response = api_client.get(
        "/api/products/",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "membership_required"
