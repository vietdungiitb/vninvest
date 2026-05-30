"""
Permissions module for user_workspace domain.

TenantScopePermission ensures request.user has active tenant and attaches
request.tenant for use in views.
"""
import logging
from typing import Optional
from rest_framework.permissions import BasePermission

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
