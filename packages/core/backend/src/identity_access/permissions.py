"""
SFI-B6: Custom DRF permissions for core-api.

IsCoreOperator: Only allow staff/superuser (operator-level access).
                Used for admin-ops, signal admin, runtime-kpi, ops_audit views.
"""
from identity_access.models import CorePATCredential, CoreTenant

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def _normalize_scope_codes(scope_codes) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_scope in scope_codes or []:
        scope = str(raw_scope or '').strip()
        if not scope or scope in seen:
            continue
        seen.add(scope)
        normalized.append(scope)
    return normalized


def is_machine_pat_request(request) -> bool:
    auth = getattr(request, 'auth', None)
    return bool(isinstance(auth, CorePATCredential) and not auth.is_human_session)


def require_human_session(request, message='Machine PAT không được phép truy cập endpoint này.') -> None:
    if is_machine_pat_request(request):
        raise PermissionDenied(message)


def require_pat_scopes_or_human_session(request, *required_scopes: str) -> None:
    auth = getattr(request, 'auth', None)
    if not isinstance(auth, CorePATCredential) or auth.is_human_session:
        return

    granted = set(_normalize_scope_codes(auth.scopes))
    missing_scopes = [scope for scope in required_scopes if scope not in granted]
    if missing_scopes:
        raise PermissionDenied(
            'PAT thiếu scope bắt buộc: ' + ', '.join(missing_scopes) + '.'
        )


class IsCoreOperator(BasePermission):
    """
    Grants access only to users with is_staff=True or is_superuser=True.
    Used to guard admin-ops and operator-level endpoints.
    """
    message = 'Chỉ operator/admin mới có quyền truy cập endpoint này.'

    def has_permission(self, request, view):
        if is_machine_pat_request(request):
            return False
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

        tenant = getattr(user, 'core_tenant', None)
        if tenant is None:
            profile = getattr(user, 'core_profile', None)
            tenant = getattr(profile, 'tenant', None)
        if tenant is None:
            return True

        return tenant.status not in self.BLOCKED_STATUSES
