from django.http import JsonResponse

from .models import Workspace, WorkspaceStatus


LOCAL_TENANT_ROOTS = ("localhost", "lvh.me", "localtest.me")
NON_TENANT_HOSTS = {"localhost", "127.0.0.1", "www"}


def tenant_not_found_response():
    return JsonResponse(
        {
            "error": {
                "code": "tenant_not_found",
                "message": "Tenant workspace was not found.",
                "details": {},
            }
        },
        status=404,
    )


def host_without_port(host):
    host = host.split(",")[0].strip().lower().rstrip(".")
    if host.startswith("["):
        return host
    return host.split(":", 1)[0]


def extract_subdomain(host):
    host = host_without_port(host)

    if host in NON_TENANT_HOSTS:
        return None

    labels = host.split(".")
    if not labels or labels[0] in NON_TENANT_HOSTS:
        return None

    if len(labels) == 2 and labels[1] == "localhost":
        return labels[0]

    if len(labels) >= 3 and ".".join(labels[-2:]) in LOCAL_TENANT_ROOTS:
        return labels[0]

    if len(labels) >= 3:
        return labels[0]

    return None


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.workspace = None
        subdomain = extract_subdomain(request.get_host())

        if subdomain is not None:
            workspace = (
                Workspace.objects.filter(
                    subdomain=subdomain,
                    status=WorkspaceStatus.ACTIVE,
                )
                .select_related("created_by")
                .first()
            )
            if workspace is None:
                return tenant_not_found_response()
            request.workspace = workspace

        return self.get_response(request)
