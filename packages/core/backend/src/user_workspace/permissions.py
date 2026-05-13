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
        
        # Resolve tenant from user
        tenant = _resolve_tenant(request.user)
        request.tenant = tenant  # Attach to request for view use
        
        return True


def _resolve_tenant(user) -> Optional['CoreTenant']:
    """
    Resolve primary tenant for user.
    
    Strategy:
      1. Check user.core_profile.tenant (via UserProfile)
      2. Fall back to user's first active TenantMember
      3. Return None if no tenant (backward compat with single-tenant mode)
    
    Args:
        user: Django User instance (must be authenticated)
    
    Returns:
        CoreTenant instance or None
    """
    # Try UserProfile first
    profile = getattr(user, 'core_profile', None)
    if profile and profile.tenant_id:
        return profile.tenant
    
    # Fall back to TenantMember
    try:
        from identity_access.models import TenantMember
        member = TenantMember.objects.filter(
            user=user,
            is_active=True
        ).select_related('tenant').first()
        
        if member:
            return member.tenant
    except ImportError:
        # identity_access not installed in this environment
        pass
    except Exception as e:
        logger.warning('_resolve_tenant failed for user=%s: %s', getattr(user, 'id', None), e)
    
    return None
