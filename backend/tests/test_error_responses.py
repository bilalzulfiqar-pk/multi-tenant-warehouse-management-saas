import pytest

from inventory.models import StockMovement


pytestmark = [pytest.mark.django_db, pytest.mark.inventory]


def test_insufficient_stock_uses_consistent_business_error_shape(
    api_client,
    owner_user,
    workspace,
    product_factory,
    warehouse_factory,
    location_factory,
    stock_level_factory,
    tenant_host,
):
    product = product_factory(workspace)
    warehouse = warehouse_factory(workspace)
    location = location_factory(workspace, warehouse)
    stock_level_factory(workspace, product, warehouse, location, "1.000")
    api_client.force_authenticate(user=owner_user)

    response = api_client.post(
        "/api/inventory/stock-out/",
        {
            "product": str(product.id),
            "warehouse": str(warehouse.id),
            "location": str(location.id),
            "quantity": "5.000",
            "reason": "Too much stock",
        },
        format="json",
        HTTP_HOST=tenant_host(workspace),
    )

    assert response.status_code == 400
    assert set(response.data) == {"error"}
    assert set(response.data["error"]) == {"code", "message", "details"}
    assert response.data["error"]["code"] == "validation_error"
    assert str(response.data["error"]["message"]) == (
        "Insufficient stock for this operation."
    )
    assert response.data["error"]["details"] == {}
    assert not StockMovement.objects.exists()
