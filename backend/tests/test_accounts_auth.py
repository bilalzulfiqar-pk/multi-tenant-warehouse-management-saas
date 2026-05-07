import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


pytestmark = pytest.mark.django_db


def test_user_can_register_with_email_and_password(client):
    response = client.post(
        "/api/auth/register/",
        {
            "email": "user@example.com",
            "full_name": "User Name",
            "password": "strong-password-123",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "email": "user@example.com",
        "full_name": "User Name",
    }
    user = get_user_model().objects.get(email="user@example.com")
    assert user.check_password("strong-password-123")


def test_user_can_login_and_receive_tokens(client):
    get_user_model().objects.create_user(
        email="user@example.com",
        password="strong-password-123",
        full_name="User Name",
    )

    response = client.post(
        "/api/auth/login/",
        {"email": "user@example.com", "password": "strong-password-123"},
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access"]
    assert payload["refresh"]
    assert payload["user"]["email"] == "user@example.com"
    assert payload["user"]["full_name"] == "User Name"


def test_access_token_can_call_me_endpoint(client):
    user = get_user_model().objects.create_user(
        email="user@example.com",
        password="strong-password-123",
        full_name="User Name",
    )
    login_response = client.post(
        "/api/auth/login/",
        {"email": "user@example.com", "password": "strong-password-123"},
        content_type="application/json",
    )
    access_token = login_response.json()["access"]

    api_client = APIClient()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    response = api_client.get("/api/auth/me/")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": "user@example.com",
        "full_name": "User Name",
    }


def test_me_endpoint_requires_authentication(client):
    response = client.get("/api/auth/me/")

    assert response.status_code == 401


def test_user_can_update_profile_full_name(client):
    get_user_model().objects.create_user(
        email="user@example.com",
        password="strong-password-123",
        full_name="Old Name",
    )
    login_response = client.post(
        "/api/auth/login/",
        {"email": "user@example.com", "password": "strong-password-123"},
        content_type="application/json",
    )
    access_token = login_response.json()["access"]

    api_client = APIClient()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    response = api_client.patch(
        "/api/auth/me/",
        {"full_name": "New Name"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "New Name"


def test_refresh_token_returns_new_access_token(client):
    get_user_model().objects.create_user(
        email="user@example.com",
        password="strong-password-123",
    )
    login_response = client.post(
        "/api/auth/login/",
        {"email": "user@example.com", "password": "strong-password-123"},
        content_type="application/json",
    )
    refresh_token = login_response.json()["refresh"]

    response = client.post(
        "/api/auth/token/refresh/",
        {"refresh": refresh_token},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["access"]
    assert "refresh" not in response.json()
