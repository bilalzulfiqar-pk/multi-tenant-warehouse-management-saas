from rest_framework.exceptions import APIException


class BusinessAPIException(APIException):
    status_code = 400
    error_code = "error"
    message = "A business rule was violated."
    details = None

    def __init__(self, message=None, details=None):
        message = message or self.message
        details = details if details is not None else self.details or {}
        self.detail = {
            "error": {
                "code": self.error_code,
                "message": message,
                "details": details,
            }
        }


class WorkspaceRequired(BusinessAPIException):
    status_code = 400
    error_code = "workspace_required"
    message = "A tenant workspace is required for this endpoint."


class MembershipRequired(BusinessAPIException):
    status_code = 403
    error_code = "membership_required"
    message = "Active workspace membership is required."


class WorkspacePermissionDenied(BusinessAPIException):
    status_code = 403
    error_code = "permission_denied"
    message = "You do not have permission to perform this action."
