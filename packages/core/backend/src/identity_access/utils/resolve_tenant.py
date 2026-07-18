"""
Unified tenant resolution utilities.

Single source of truth for resolve_tenant(), get_tenant_role(), get_tenant_permissions(),
require_tenant_permission(), require_tenant_role().
Previously duplicated across 9+ view files — consolidated 2026-07-18.
"""
import logging

from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied

from identity_access.models import CoreTenant, CoreServiceAccount, TenantMember

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
        'usage:read', 'dashboard:read', 'security:read',
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
    'security:read',
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
    3. X-Tenant-ID header
    4. Owner fallback (user owns a tenant)
    5. Member fallback (user is member of a tenant)

    Raises PermissionDenied if no tenant found.
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

        # Try X-Tenant-ID header
        tenant_id = request.META.get('HTTP_X_TENANT_ID')
        if tenant_id:
            try:
                tenant = CoreTenant.objects.get(public_id=tenant_id)
                request.tenant = tenant
                return tenant
            except CoreTenant.DoesNotExist:
                pass

        # Fallback: tenant where user is owner
        try:
            tenant = CoreTenant.objects.get(owner_user=user)
            request.tenant = tenant
            return tenant
        except CoreTenant.DoesNotExist:
            pass

        # Fallback: first tenant where user is member
        member = TenantMember.objects.filter(user=user).select_related('tenant').first()
        if member:
            request.tenant = member.tenant
            return member.tenant

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
