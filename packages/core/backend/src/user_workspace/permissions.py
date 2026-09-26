"""
Permissions module for user_workspace domain.

TenantScopePermission ensures request.user has active tenant and attaches
request.tenant for use in views.
"""
import logging
from typing import Optional
from rest_framework.permissions import BasePermission

from identity_access.utils.resolve_tenant import (
    RESOLVABLE_TENANT_STATUSES,
    is_plausible_tenant_public_id,
    resolve_tenant_for_user,
)

logger = logging.getLogger(__name__)


class TenantScopePermission(BasePermission):
    """
    Ensure authenticated user has active tenant.
    Attaches request.tenant for downstream views.

    Use in view.permission_classes:
        permission_classes = [IsAuthenticated, TenantScopePermission]

    After check, request.tenant will be set (or None if single-tenant mode).
    """

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # ------------------------------------------------------------------
        # The middleware is authoritative. Do NOT overwrite its decision.
        # ------------------------------------------------------------------
        # TenantResolutionMiddleware (MIDDLEWARE index 8) already reads
        # X-Tenant-ID, applies the shared owner-or-member check, and sets
        # BOTH request.tenant and request.tenant_role. The previous version of
        # this class unconditionally re-resolved and overwrote request.tenant
        # from user.core_profile.tenant, which is a *different* tenant than the
        # one the middleware picked. That is the B5 bug: for a user who owns
        # tenant A and is a viewer in tenant B, TenantQuotaMiddleware (index 9,
        # earlier in the chain) metered and incremented Redis against A while
        # user_workspace views then read B - and get_tenant_role() returned A's
        # role, so a mere viewer in B passed `tenant:write`-style checks
        # measured against A's owner role.
        current = getattr(request, 'tenant', None)
        if current is not None:
            # Keep the middleware's tenant. Only apply this class's status gate,
            # which is what distinguishes PENDING_ACTIVATION (not resolvable)
            # from SUSPENDED/DEPROVISIONED (already 403'd by the middleware).
            return current.status in RESOLVABLE_TENANT_STATUSES

        # ------------------------------------------------------------------
        # No middleware resolution (exempt paths, or middleware bypassed):
        # resolve here, through the SAME shared membership check.
        # ------------------------------------------------------------------
        # X-Tenant-ID is the header the frontend actually sends, carrying
        # CoreTenant.public_id. The legacy names below are kept working.
        public_id_hint = (request.headers.get('X-Tenant-ID') or '').strip()
        if public_id_hint:
            # Bounded shape check before touching the DB. NOT a strict UUID
            # parse on purpose: public_id is a CharField(max_length=36) that
            # only *auto-fills* with str(uuid.uuid4()) (models.py:128-132), and
            # the existing test-suite uses non-UUID values such as
            # 'rbac_tenant' / 'test_tenant_123'. A strict UUID check would 403
            # legitimate requests. Garbage is rejected by the shape check and by
            # the membership check, never by a ValidationError 500.
            if not is_plausible_tenant_public_id(public_id_hint):
                logger.warning(
                    'TenantScopePermission: malformed X-Tenant-ID rejected '
                    '(user=%s).', getattr(request.user, 'username', '?'),
                )
                return False
            tenant, _role = resolve_tenant_for_user(request.user, public_id_hint)
            if tenant is None:
                return False
            request.tenant = tenant
            return True

        tenant_code_hint = (
            request.headers.get('X-Tenant-Code')
            or request.query_params.get('tenant_code')
            or request.query_params.get('tenant')
        )

        # Resolve tenant from user
        tenant = _resolve_tenant(request.user, tenant_code_hint=tenant_code_hint)
        if not tenant:
            return False
        request.tenant = tenant  # Attach to request for view use

        return True


def _resolve_tenant(user, tenant_code_hint: Optional[str] = None) -> Optional['CoreTenant']:
    """
    Resolve primary tenant for user.
    
    Strategy:
      1. Check user.core_profile.tenant (via UserProfile)
      2. Fall back to user's first active TenantMember (where tenant status is active/trial)
      3. Return None if no tenant (backward compat with single-tenant mode)
    
    Args:
        user: Django User instance (must be authenticated)
    
    Returns:
        CoreTenant instance or None
    """
    normalized_hint = (tenant_code_hint or '').strip().lower()

    # Try UserProfile first (only when no explicit tenant hint is provided)
    profile = getattr(user, 'core_profile', None)
    if not normalized_hint and profile and profile.tenant_id:
        tenant = profile.tenant
        if tenant and tenant.status in ['active', 'trial']:
            return tenant
    
    # Fall back to TenantMember
    try:
        from identity_access.models import TenantMember
        member_qs = TenantMember.objects.filter(
            user=user,
            tenant__status__in=['active', 'trial']
        ).select_related('tenant')

        if normalized_hint:
            member_qs = member_qs.filter(tenant__tenant_code__iexact=normalized_hint)

        member = member_qs.order_by('tenant_id').first()
        
        if member:
            return member.tenant

        # Tenant owner is not required to have TenantMember row.
        from identity_access.models import CoreTenant
        owner_qs = CoreTenant.objects.filter(
            owner_user=user,
            status__in=['active', 'trial'],
        )
        if normalized_hint:
            owner_qs = owner_qs.filter(tenant_code__iexact=normalized_hint)

        owner_tenant = owner_qs.order_by('id').first()
        if owner_tenant:
            return owner_tenant

        # Explicit tenant hint requested but not accessible by this user.
        if normalized_hint:
            return None
    except ImportError:
        # identity_access not installed in this environment
        pass
    except Exception as e:
        logger.warning('_resolve_tenant failed for user=%s: %s', getattr(user, 'id', None), e)
    
    return None
