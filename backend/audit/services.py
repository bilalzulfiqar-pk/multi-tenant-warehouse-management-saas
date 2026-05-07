from .models import AuditLog


SENSITIVE_METADATA_KEYS = {
    "access_token",
    "api_key",
    "credential",
    "credentials",
    "jwt",
    "password",
    "refresh_token",
    "secret",
    "token",
}


def _is_sensitive_key(key):
    normalized = str(key).lower()
    return normalized in SENSITIVE_METADATA_KEYS or normalized.endswith("_token")


def _sanitize_metadata(value):
    if isinstance(value, dict):
        return {
            str(key): (
                "[redacted]"
                if _is_sensitive_key(key)
                else _sanitize_metadata(child_value)
            )
            for key, child_value in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_sanitize_metadata(item) for item in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


class AuditLogService:
    @staticmethod
    def record(
        *,
        action,
        resource_type,
        workspace=None,
        actor=None,
        resource_id=None,
        message="",
        metadata=None,
    ):
        return AuditLog.objects.create(
            workspace=workspace,
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else "",
            message=message or "",
            metadata=_sanitize_metadata(metadata or {}),
        )
