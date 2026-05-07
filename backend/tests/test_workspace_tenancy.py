import json

import pytest
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from workspaces.middleware import TenantMiddleware, extract_subdomain
from workspaces.models import (
    MembershipStatus,
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceStatus,
)
from workspaces.permissions import HasWorkspace, IsWorkspaceMember


pytestmark = pytest.mark.django_db


class TenantProtectedProbeView(APIView):
    permission_classes = [HasWorkspace, IsWorkspaceMember]

    def get(self, request):
        return Response({"workspace": request.workspace.subdomain})


def create_workspace(user, subdomain="acme", status=WorkspaceStatus.ACTIVE):
    return Workspace.objects.create(
        name=f"{subdomain.title()} Logistics",
        slug=subdomain,
        subdomain=subdomain,
        status=status,
        created_by=user,
    )


def response_json(response):
    return json.loads(response.content.decode())


def test_extract_subdomain_handles_local_and_root_hosts():
    assert extract_subdomain("acme.localhost:8000") == "acme"
    assert extract_subdomain("tenant1.lvh.me:8000") == "tenant1"
    assert extract_subdomain("tenant2.localtest.me:8000") == "tenant2"
    assert extract_subdomain("acme.example.com") == "acme"
    assert extract_subdomain("localhost:8000") is None
    assert extract_subdomain("127.0.0.1:8000") is None
    assert extract_subdomain("example.com") is None


def test_tenant_middleware_resolves_active_workspace(rf, django_user_model):
    user = django_user_model.objects.create_user(
        email="owner@example.com",
        password="strong-password-123",
    )
    create_workspace(user, subdomain="acme")
    request = rf.get("/", HTTP_HOST="acme.localhost:8000")

    response = TenantMiddleware(
        lambda req: JsonResponse({"workspace": req.workspace.subdomain})
    )(request)

    assert response.status_code == 200
    assert response_json(response) == {"workspace": "acme"}


def test_tenant_middleware_returns_tenant_not_found_for_unknown_subdomain(rf):
    request = rf.get("/", HTTP_HOST="unknown.localhost:8000")

    response = TenantMiddleware(lambda req: JsonResponse({}))(request)

    assert response.status_code == 404
    assert response_json(response)["error"]["code"] == "tenant_not_found"


def test_tenant_middleware_treats_root_host_as_non_tenant_context(rf):
    request = rf.get("/", HTTP_HOST="localhost:8000")

    response = TenantMiddleware(
        lambda req: JsonResponse({"workspace": req.workspace})
    )(request)

    assert response.status_code == 200
    assert response_json(response) == {"workspace": None}


def test_tenant_middleware_hides_suspended_workspace(rf, django_user_model):
    user = django_user_model.objects.create_user(
        email="owner@example.com",
        password="strong-password-123",
    )
    create_workspace(user, subdomain="acme", status=WorkspaceStatus.SUSPENDED)
    request = rf.get("/", HTTP_HOST="acme.localhost:8000")

    response = TenantMiddleware(lambda req: JsonResponse({}))(request)

    assert response.status_code == 404
    assert response_json(response)["error"]["code"] == "tenant_not_found"


def test_active_member_can_access_tenant_protected_view(django_user_model):
    user = django_user_model.objects.create_user(
        email="owner@example.com",
        password="strong-password-123",
    )
    workspace = create_workspace(user, subdomain="acme")
    WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=WorkspaceRole.OWNER,
        status=MembershipStatus.ACTIVE,
        joined_at=timezone.now(),
    )
    request = APIRequestFactory().get("/")
    request.workspace = workspace
    force_authenticate(request, user=user)

    response = TenantProtectedProbeView.as_view()(request)

    assert response.status_code == 200
    assert response.data == {"workspace": "acme"}


def test_authenticated_non_member_cannot_access_tenant_protected_view(
    django_user_model,
):
    owner = django_user_model.objects.create_user(
        email="owner@example.com",
        password="strong-password-123",
    )
    outsider = django_user_model.objects.create_user(
        email="outsider@example.com",
        password="strong-password-123",
    )
    workspace = create_workspace(owner, subdomain="acme")
    request = APIRequestFactory().get("/")
    request.workspace = workspace
    force_authenticate(request, user=outsider)

    response = TenantProtectedProbeView.as_view()(request)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "membership_required"


def test_disabled_member_cannot_access_tenant_protected_view(django_user_model):
    user = django_user_model.objects.create_user(
        email="member@example.com",
        password="strong-password-123",
    )
    workspace = create_workspace(user, subdomain="acme")
    WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=WorkspaceRole.STAFF,
        status=MembershipStatus.DISABLED,
    )
    request = APIRequestFactory().get("/")
    request.workspace = workspace
    force_authenticate(request, user=user)

    response = TenantProtectedProbeView.as_view()(request)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "membership_required"


def test_root_domain_tenant_protected_view_requires_workspace(django_user_model):
    user = django_user_model.objects.create_user(
        email="member@example.com",
        password="strong-password-123",
    )
    request = APIRequestFactory().get("/")
    request.workspace = None
    force_authenticate(request, user=user)

    response = TenantProtectedProbeView.as_view()(request)

    assert response.status_code == 400
    assert response.data["error"]["code"] == "workspace_required"
