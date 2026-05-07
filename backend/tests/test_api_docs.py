def test_openapi_schema_available(client):
    response = client.get("/api/schema/")

    assert response.status_code == 200
    assert b"openapi" in response.content


def test_swagger_ui_available(client):
    response = client.get("/api/docs/")

    assert response.status_code == 200
