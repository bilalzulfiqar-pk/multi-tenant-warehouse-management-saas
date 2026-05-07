from .models import AuditLog


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
            metadata=metadata or {},
        )
