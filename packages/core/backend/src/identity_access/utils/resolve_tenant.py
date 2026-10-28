"""
Unified tenant resolution utilities.

Single source of truth for resolve_tenant(), get_tenant_role(), get_tenant_permissions(),
require_tenant_permission(), require_tenant_role().
Previously duplicated across 9+ view files — consolidated 2026-07-18.
"""
import logging
import re

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from identity_access.models import CoreServiceAccount, CoreTenant, TenantMember

logger = logging.getLogger(__name__)
User = get_user_model()


# ---------------------------------------------------------------------------
# Permission token catalog
# ---------------------------------------------------------------------------

# System role → permission mapping (authoritative, §4.0 AUDIT_PLAN_SPRINT4).
# Owner gets wildcard. Admin explicit list (not wildcard) for future exclusion.
SYSTEM_ROLE_PERMISSIONS: dict[str, list[str]] = {
    'owner': ['*'],
    'admin': [
        'member:read', 'member:write',
        'sa:read', 'sa:write',
        'pat:read', 'pat:write',
        'usage:read', 'dashboard:read', 'security:read', 'security:write',
        'alert:read', 'alert:write',
        'forecast:read', 'forecast:write',
        'webhook:read', 'webhook:write',
        'sso:read', 'sso:write',
        'billing:read', 'billing:write',
        'settings:read', 'settings:write',
        'tenant:write',
    ],
    'editor': [
        'member:read',
        'sa:read', 'sa:write',
        'pat:read', 'pat:write',
        'usage:read', 'dashboard:read', 'security:read',
        'alert:read', 'alert:write',
        'forecast:read', 'forecast:write',
        'settings:read',
    ],
    'viewer': [
        'sa:read', 'pat:read',
        'usage:read', 'dashboard:read', 'security:read',
        'alert:read', 'forecast:read',
        'settings:read',
    ],
}

# All known permission tokens (for validation in CRUD API)
KNOWN_PERMISSION_TOKENS: set[str] = {
    'member:read', 'member:write',
    'sa:read', 'sa:write',
    'pat:read', 'pat:write',
    'usage:read',
    'dashboard:read',
    'security:read', 'security:write',
    'alert:read', 'alert:write',
    'forecast:read', 'forecast:write',
    'webhook:read', 'webhook:write',
    'sso:read', 'sso:write',
    'billing:read', 'billing:write',
    'settings:read', 'settings:write',
    'tenant:write',
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Tenant resolution primitives (SSOT for the owner-or-member membership check)
# ---------------------------------------------------------------------------

#: Tenant statuses eligible for *implicit* resolution (no ``X-Tenant-ID`` header).
#:
#: ``PENDING_ACTIVATION`` is deliberately excluded: it is a registration
#: intermediate state and nothing in the resolution chain gates it, so including
#: it would let a not-yet-activated tenant be auto-selected as a user's tenant.
#: The *explicit* header path intentionally does not filter on status, because
#: ``TenantResolutionMiddleware`` already emits a precise ``tenant_suspended``
#: 403 for SUSPENDED/DEPROVISIONED and that signal must survive.
RESOLVABLE_TENANT_STATUSES = frozenset({'active', 'trial'})

#: ``CoreTenant.public_id`` column width (identity_access/models.py:59).
#: Bounded so a garbage header can never produce an unbounded DB query.
_TENANT_PUBLIC_ID_MAX_LEN = 36

#: Characters a ``public_id`` may contain. Keeps obviously hostile input
#: (quotes, spaces, control chars, SQL metacharacters) out of the query layer
#: without requiring a strict UUID: the column is a free-form CharField that
#: only *auto-fills* with ``str(uuid.uuid4())`` (models.py:128-132), and the
#: existing test-suite legitimately uses non-UUID values such as ``'rbac_tenant'``.
_TENANT_PUBLIC_ID_RE = re.compile(r'^[A-Za-z0-9._~-]{1,%d}$' % _TENANT_PUBLIC_ID_MAX_LEN)


def is_plausible_tenant_public_id(value) -> bool:
    """Cheap, DB-free shape check for a tenant hint.

    Guards against unbounded / hostile header values reaching the ORM. This is
    a sanity filter, NOT an authorization decision: a well-formed value that the
    user is not a member of still has to be rejected by
    :func:`resolve_tenant_for_user`.
    """
    if not value or not isinstance(value, str):
        return False
    candidate = value.strip()
    if not candidate:
        return False
    return bool(_TENANT_PUBLIC_ID_RE.match(candidate))


def resolve_tenant_for_user(user, tenant_public_id: str):
    """THE owner-or-member membership check. Single source of truth.

    Every tenant resolver in the codebase must route its ``X-Tenant-ID`` /
    ``?tenant=`` handling through this function so there is exactly one
    membership check and one privilege-escalation surface.

    Semantics:
      1. Look the tenant up by ``public_id``.
      2. Owner (reverse OneToOne) -> ``RoleChoices.OWNER``.
      3. Otherwise a ``TenantMember`` row -> that member's role.
      4. Otherwise ``(None, None)`` - the caller decides, do not guess.

    No status filter is applied: SUSPENDED/DEPROVISIONED must still resolve
    here so the caller can answer with a precise ``tenant_suspended`` error
    instead of a misleading ``tenant_not_found``.

    Returns:
        tuple: ``(CoreTenant | None, role | None)``.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return None, None
    if not tenant_public_id:
        return None, None

    try:
        tenant = CoreTenant.objects.get(public_id=str(tenant_public_id).strip())
    except CoreTenant.DoesNotExist:
        return None, None
    except (ValueError, TypeError, ValidationError):
        # Malformed hint must not surface as a 500.
        return None, None

    # 1. Owner.
    if tenant.owner_user_id == user.id:
        return tenant, TenantMember.RoleChoices.OWNER

    # 2. Member.
    member = TenantMember.objects.filter(tenant=tenant, user=user).first()
    if member is not None:
        return tenant, member.role

    # 3. No relationship.
    return None, None


def owner_tenant_for_user(user):
    """Return the tenant *owned* by ``user``, or ``None``.

    ``CoreTenant.owner_user`` is a OneToOneField (models.py:65-70) so ``.get()``
    is unambiguous - at most one row - and no ordering is required.

    Deliberately NOT status-filtered. The caller needs the row in order to report
    WHY access is refused: filtering suspended/deprovisioned out here turned the
    middleware's precise ``tenant_suspended`` 403 into a misleading
    ``tenant_not_found``, which the existing middleware tests pin. Status gating
    belongs at the call site, where the distinction is still available.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    try:
        return CoreTenant.objects.get(owner_user=user)
    except (CoreTenant.DoesNotExist, ValueError, TypeError, ValidationError):
        return None


def first_eligible_tenant_for_user(user):
    """Deterministic, status-filtered membership fallback.

    Fixes the former ``TenantMember.objects...filter(user=user).first()`` which
    had neither an ``order_by`` nor a status filter: for a user in 2+ tenants
    Postgres returned an arbitrary row, which could be a suspended tenant.
    Ordering by ``tenant_id`` makes the pick stable, and
    :data:`RESOLVABLE_TENANT_STATUSES` keeps an unusable tenant from being
    auto-selected.

    Returns:
        tuple: ``(tenant, role)`` or ``(None, None)``.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return None, None
    member = (
        TenantMember.objects
        .select_related('tenant')
        .filter(user=user, tenant__status__in=RESOLVABLE_TENANT_STATUSES)
        .order_by('tenant_id')
        .first()
    )
    if member is None:
        return None, None
    return member.tenant, member.role


def apply_pat_user_privileges(user, credential):
    """Strip staff/superuser flags for machine PATs (shared by auth layers).

    Single source of truth for the privilege-stripping logic that was previously
    duplicated in middleware._get_user_from_pat and authentication.authenticate.
    Human-session PATs keep their user's real privilege level.
    """
    if not credential.is_human_session:
        user.is_staff = False
        user.is_superuser = False
    return user


def resolve_tenant(request) -> CoreTenant:
    """
    Get tenant from request (set by TenantResolutionMiddleware).

    Resolution order:
    1. request.tenant (already resolved by middleware)
    2. Staff cross-tenant via service_account_id in request.data
    3. X-Tenant-ID header, via the shared owner-or-member check
       (resolve_tenant_for_user) — denied outright if the user has no
       relationship with the named tenant
    4. Owner fallback (user owns a tenant)
    5. First *eligible* member fallback (deterministic + status-filtered)

    Raises PermissionDenied if no tenant found, or if an explicit X-Tenant-ID
    names a tenant the user is not owner/member of.
    """
    tenant = getattr(request, 'tenant', None)
    if tenant is not None:
        return tenant

    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        # Staff users can access any tenant via service_account_id in request data
        if user.is_staff:
            service_account_id = request.data.get('service_account_id') if hasattr(request, 'data') else None
            if service_account_id:
                try:
                    sa = CoreServiceAccount.objects.select_related('tenant').get(public_id=service_account_id)
                    tenant = sa.tenant
                    request.tenant = tenant
                    logger.info(
                        'Staff %s resolved tenant %s via service_account_id %s (cross-tenant access)',
                        user.username, tenant.public_id, service_account_id,
                    )
                    return tenant
                except CoreServiceAccount.DoesNotExist:
                    pass

        # X-Tenant-ID header — resolved through the ONE shared owner-or-member
        # check. This used to be a bare CoreTenant.objects.get(public_id=...)
        # with no owner and no TenantMember verification, which made an
        # attacker-controlled header a full cross-tenant read/write primitive on
        # every path where the middleware had not already set request.tenant
        # (i.e. every EXEMPT_PATH_PREFIXES entry whose handler calls this).
        # Now a header the user has no relationship with is a hard denial
        # instead of a silent hand-out of someone else's tenant.
        tenant_id = request.META.get('HTTP_X_TENANT_ID', '').strip()
        if tenant_id:
            tenant, _role = resolve_tenant_for_user(user, tenant_id)
            if tenant is not None:
                request.tenant = tenant
                return tenant
            logger.warning(
                'tenant_header_denied: user=%s is neither owner nor member of '
                'the tenant named by X-Tenant-ID. Denying (fail-closed).',
                getattr(user, 'username', '?'),
            )
            raise PermissionDenied(
                'Header X-Tenant-ID không thuộc tenant của bạn hoặc không tồn tại.'
            )

        # Fallback: tenant where user is owner (OneToOne, unambiguous).
        tenant = owner_tenant_for_user(user)
        if tenant is not None:
            request.tenant = tenant
            return tenant

        # Fallback: first *eligible* tenant where user is a member
        # (deterministic order + status filter).
        tenant, _role = first_eligible_tenant_for_user(user)
        if tenant is not None:
            request.tenant = tenant
            return tenant

    raise PermissionDenied('Không tìm thấy tenant trong request. Middleware chưa chạy hoặc tenant không hợp lệ.')


def get_tenant_role(request) -> str:
    """
    Get tenant role from request (set by TenantResolutionMiddleware).

    Resolution order:
    1. request.tenant_role (already resolved by middleware)
    2. Owner check (user == tenant.owner_user)
    3. Staff users act as admin
    4. TenantMember.role lookup (with custom_role FK cached on request.tenant_member)

    Raises PermissionDenied if role not found.
    """
    role = getattr(request, 'tenant_role', None)
    if role is not None:
        return role

    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        tenant = resolve_tenant(request)

    user = getattr(request, 'user', None)
    if tenant and user and user.is_authenticated:
        if tenant.owner_user == user:
            request.tenant_role = 'owner'
            request.tenant_member = None  # Owner has no TenantMember row
            return 'owner'
        # Resolve by actual TenantMember role first — do NOT let is_staff silently
        # escalate a viewer/editor to admin (the auth layer already strips is_staff
        # for machine PATs; this guards the fallback path for exempt routes).
        member = TenantMember.objects.filter(
            tenant=tenant, user=user,
        ).select_related('custom_role').first()
        if member:
            request.tenant_role = member.role
            request.tenant_member = member  # F2: cache for get_tenant_permissions
            return member.role
        if user.is_staff:
            request.tenant_role = 'admin'
            request.tenant_member = None
            return 'admin'

    raise PermissionDenied('Không tìm thấy vai trò tenant trong request.')


def require_tenant_role(request, *allowed_roles: str) -> None:
    """
    Check if request.user has one of allowed_roles in the tenant.

    Raises PermissionDenied if role not in allowed_roles.
    """
    role = get_tenant_role(request)
    if role not in allowed_roles:
        raise PermissionDenied(f'Vai trò {role} không có quyền thực hiện hành động này.')


def get_tenant_permissions(request) -> set[str]:
    """
    Resolve tenant permissions for the current request.

    Resolution priority:
    1. request._tenant_permissions cache (avoid N+1)
    2. request.tenant_member.custom_role.permissions (if custom_role set)
    3. SYSTEM_ROLE_PERMISSIONS[get_tenant_role(request)] (system role fallback)

    For owner (no TenantMember row): returns {'*'} via SYSTEM_ROLE_PERMISSIONS.
    """
    cached = getattr(request, '_tenant_permissions', None)
    if cached is not None:
        return cached

    member = getattr(request, 'tenant_member', None)

    if member is None and not hasattr(request, '_tenant_member_checked'):
        # Rare fallback: query if get_tenant_role was called externally
        # and didn't set request.tenant_member
        tenant = getattr(request, 'tenant', None)
        user = getattr(request, 'user', None)
        if tenant and user and user.is_authenticated:
            member = TenantMember.objects.filter(
                tenant=tenant, user=user,
            ).select_related('custom_role').first()
        request._tenant_member_checked = True

    if member and member.custom_role_id:
        perms = set(member.custom_role.permissions)
    else:
        role = get_tenant_role(request)
        perms = set(SYSTEM_ROLE_PERMISSIONS.get(role, []))

    request._tenant_permissions = perms
    return perms


def require_tenant_permission(request, *required_perms: str) -> None:
    """
    Check if the current user has ALL required permissions in the tenant.

    Uses get_tenant_permissions() which respects custom_role override.
    Raises PermissionDenied if any required permission is missing.
    """
    granted = get_tenant_permissions(request)
    if '*' in granted:
        return
    missing = [p for p in required_perms if p not in granted]
    if missing:
        raise PermissionDenied(
            f'Thiếu quyền: {", ".join(missing)}. '
            f'Vai trò hiện tại không có quyền thực hiện hành động này.'
        )
