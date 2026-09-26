"""
SFI-B6: Custom DRF permissions for core-api.

IsCoreOperator: Only allow staff/superuser (operator-level access).
                Used for admin-ops, signal admin, runtime-kpi, ops_audit views.
"""
import logging

from identity_access.models import CorePATCredential, CoreTenant

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

logger = logging.getLogger(__name__)


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

    # Defense-in-depth: validate machine PAT tenant context
    _assert_pat_tenant_match(request, auth)

    granted = set(_normalize_scope_codes(auth.scopes))
    missing_scopes = [scope for scope in required_scopes if scope not in granted]
    if missing_scopes:
        raise PermissionDenied(
            'PAT thiếu scope bắt buộc: ' + ', '.join(missing_scopes) + '.'
        )


def _assert_pat_tenant_match(request, credential: CorePATCredential) -> None:
    """Raise PermissionDenied nếu machine PAT tenant không khớp request.tenant.

    Defense-in-depth: primary check là TenantResolutionMiddleware.
    Check này bảo vệ thêm cho:
    - Test suites mock hoặc skip TenantResolutionMiddleware
    - Future refactors thay đổi middleware ordering
    - Middleware error conditions không set request.tenant

    Note: Celery tasks và management commands không đi qua HTTP view layer,
    nên check này không áp dụng cho các context đó.
    """
    request_tenant = getattr(request, 'tenant', None)
    if request_tenant is None:
        logger.warning(
            'pat_tenant_check_no_context: request.tenant=None khi validate '
            'machine PAT prefix=%s. Denying (fail-closed).',
            getattr(credential, 'token_prefix', '?'),
        )
        raise PermissionDenied('Không thể xác định tenant context cho request này.')
    pat_tenant = credential.service_account.tenant
    if str(pat_tenant.public_id) != str(request_tenant.public_id):
        raise PermissionDenied('Token không được phép truy cập tenant này.')


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

        # B6: was `user.core_tenant` first. core_tenant is the REVERSE side of
        # the CoreTenant.owner_user OneToOne, so it is the tenant the user
        # *owns* - not necessarily the tenant the request is operating on. For a
        # user who owns a SUSPENDED tenant A and is an active viewer in B, the
        # middleware correctly resolved B and let the request through, and this
        # permission then inspected A and denied. Authorization and quota were
        # decided against a tenant the request was not even about.
        # request.tenant is the tenant the rest of the stack is using, so it
        # wins. core_tenant / owner / profile stay as fallbacks for contexts
        # where the middleware did not run (exempt paths, direct DRF calls).
        tenant = getattr(request, 'tenant', None)
        if tenant is None:
            tenant = getattr(user, 'core_tenant', None)
        if tenant is None:
            # Try to fetch from database (for force_authenticate in tests)
            try:
                tenant = CoreTenant.objects.get(owner_user=user)
            except CoreTenant.DoesNotExist:
                pass

        if tenant is None:
            tenant = getattr(getattr(user, 'core_profile', None), 'tenant', None)

        if tenant is None:
            # Fail-OPEN, deliberately and explicitly (unchanged from the
            # previous behaviour at the equivalent line, so this introduces no
            # new hole).
            #
            # Rationale: this class is a *status* gate, not an *authorization*
            # gate. "No tenant resolved" means there is no tenant whose status
            # could be blocked, and denying here would break every
            # non-tenant-scoped endpoint (auth, billing, public, admin-ops) that
            # legitimately has no tenant. The authorization gate is separate and
            # untouched: TenantResolutionMiddleware answers 403
            # `tenant_not_found` for an authenticated tenant-less user on any
            # non-exempt path, IsCoreOperator guards operator endpoints, and
            # _assert_pat_tenant_match fails closed for machine PATs.
            return True

        return tenant.status not in self.BLOCKED_STATUSES
