import pytest

from workspaces.models import WorkspaceRole


pytestmark = [pytest.mark.django_db, pytest.mark.permissions]


def test_viewer_can_read_setup_data_but_cannot_modify_or_create_stock_movements(
    api_client,
    workspace,
    viewer_user,
    member_factory,
    product_factory,
    warehouse_factory,
    location_factory,
    tenant_host,
):
    member_factory(workspace, viewer_user, role=WorkspaceRole.VIEWER)
    product = product_factory(workspace, sku="READ-ONLY")
    warehouse = warehouse_factory(workspace)
    location = location_factory(workspace, warehouse)
    api_client.force_authenticate(user=viewer_user)

    list_response = api_client.get(
        "/api/products/",
        HTTP_HOST=tenant_host(workspace),
    )
    update_response = api_client.patch(
        f"/api/products/{product.id}/",
        {"name": "Viewer Edit"},
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    stock_in_response = api_client.post(
        "/api/inventory/stock-in/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(location.id),
            "quantity": "1.000",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert list_response.status_code == 200
    assert [item["sku"] for item in list_response.data["results"]] == ["READ-ONLY"]
    assert update_response.status_code == 403
    assert update_response.data["error"]["code"] == "permission_denied"
    assert stock_in_response.status_code == 403
    assert stock_in_response.data["error"]["code"] == "permission_denied"


def test_staff_can_stock_in_and_stock_out_but_cannot_manage_setup_data(
    api_client,
    workspace,
    staff_user,
    member_factory,
    product_factory,
    warehouse_factory,
    location_factory,
    tenant_host,
):
    member_factory(workspace, staff_user, role=WorkspaceRole.STAFF)
    product = product_factory(workspace)
    warehouse = warehouse_factory(workspace)
    location = location_factory(workspace, warehouse)
    api_client.force_authenticate(user=staff_user)

    create_product_response = api_client.post(
        "/api/products/",
        {
            "unit": str(product.unit_id),
            "name": "Blocked Product",
            "sku": "BLOCKED",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    stock_in_response = api_client.post(
        "/api/inventory/stock-in/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(location.id),
            "quantity": "5.000",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )
    stock_out_response = api_client.post(
        "/api/inventory/stock-out/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(location.id),
            "quantity": "2.000",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert create_product_response.status_code == 403
    assert create_product_response.data["error"]["code"] == "permission_denied"
    assert stock_in_response.status_code == 200
    assert stock_out_response.status_code == 200
