"""
SFI-B6: Custom DRF permissions for core-api.

IsCoreOperator: Only allow staff/superuser (operator-level access).
                Used for admin-ops, signal admin, runtime-kpi, ops_audit views.
"""
from identity_access.models import CoreTenant

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


class IsTenantActive(BasePermission):
    """
    Grants access only when the authenticated user's tenant is active.

    Suspended and deprovisioned tenants are blocked immediately. Superusers
    bypass the tenant-status check so operator flows remain available.
    """

    message = 'Tài khoản tenant đang bị tạm dừng hoặc đã bị thu hồi. Liên hệ hỗ trợ.'
    BLOCKED_STATUSES = frozenset(
        {
            CoreTenant.StatusChoices.SUSPENDED,
            CoreTenant.StatusChoices.DEPROVISIONED,
        }
    )

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return True

        if user.is_superuser:
            return True

        try:
            tenant = CoreTenant.objects.only('status').get(owner_user=user)
        except CoreTenant.DoesNotExist:
            return True

        return tenant.status not in self.BLOCKED_STATUSES
