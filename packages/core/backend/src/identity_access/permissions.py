"""
SFI-B6: Custom DRF permissions for core-api.

IsCoreOperator: Only allow staff/superuser (operator-level access).
                Used for admin-ops, signal admin, runtime-kpi, ops_audit views.
"""
from rest_framework.permissions import BasePermission


class IsCoreOperator(BasePermission):
    """
    Grants access only to users with is_staff=True or is_superuser=True.
    Used to guard admin-ops and operator-level endpoints.
    """
    message = 'Chỉ operator/admin mới có quyền truy cập endpoint này.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )
