"""Tenant resolution and quota enforcement middleware for core-api.

This module contains:
1. TenantResolutionMiddleware - Resolves tenant from X-Tenant-ID header or user membership
2. TenantQuotaMiddleware - Per-request quota metering for authenticated tenant traffic
"""
from __future__ import annotations

from datetime import date

from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone


class TenantResolutionMiddleware:
    """Resolves tenant context per request via X-Tenant-ID header or user membership.

    Runs after AuthenticationMiddleware. Sets:
    - request.tenant: CoreTenant instance
    - request.tenant_role: TenantMember.RoleChoices value (or 'owner' for tenant owner)
    """

    EXEMPT_PATH_PREFIXES = (
        '/health',
        '/api/core/v1/auth/',
        '/core/v1/auth/',
        '/api/public/',
        '/admin/',
        '/static/',
        '/core/v1/schema/',
        '/core/v1/schema/swagger-ui/',
        '/core/v1/schema/redoc/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = str(getattr(request, 'path', '') or '')
        if self._is_exempt_path(path):
            return self.get_response(request)

        # Try to get user from PAT authentication first
        user = self._get_user_from_pat(request)
        if user is None:
            # Fallback to session user
            user = getattr(request, 'user', None)
        
        if not user or not getattr(user, 'is_authenticated', False):
            # print(f"[TenantResolutionMiddleware] Unauthenticated user")
            return self.get_response(request)

        if getattr(user, 'is_superuser', False):
            # Superusers bypass tenant resolution but we still try to set context
            self._resolve_superuser_tenant(request, user)
            return self.get_response(request)

        tenant, role = self._resolve_tenant(request, user)
        if tenant is None:
            return JsonResponse(
                {
                    'error': 'tenant_not_found',
                    'detail': 'Không tìm thấy tenant cho người dùng hiện tại.',
                },
                status=403,
            )

        if tenant.status in {tenant.StatusChoices.SUSPENDED, tenant.StatusChoices.DEPROVISIONED}:
            return JsonResponse(
                {
                    'error': 'tenant_suspended',
                    'detail': f'Tenant đang ở trạng thái {tenant.status}. Liên hệ hỗ trợ.',
                },
                status=403,
            )

        request.tenant = tenant
        request.tenant_role = role
        return self.get_response(request)

    def _is_exempt_path(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self.EXEMPT_PATH_PREFIXES)

    def _get_user_from_pat(self, request):
        """Extract user from PAT token in Authorization header."""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '').strip()
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        raw_secret = auth_header[7:].strip()  # Remove 'Bearer '
        if not raw_secret:
            return None
        
        try:
            from identity_access.models import CorePATCredential
            credential = CorePATCredential.resolve_from_raw_secret(raw_secret)
            if credential is None:
                return None
            
            if credential.effective_status not in {
                CorePATCredential.StatusChoices.ACTIVE,
                CorePATCredential.StatusChoices.ROTATING,
            }:
                return None
            
            if credential.service_account.status != credential.service_account.StatusChoices.ACTIVE:
                return None
            
            # Return the tenant owner as the user (same as CorePATAuthentication)
            owner = credential.service_account.tenant.owner_user
            if not credential.is_human_session:
                owner.is_staff = False
                owner.is_superuser = False
            return owner
        except Exception:
            return None

    def _resolve_tenant(self, request, user) -> tuple:
        """Resolve tenant from X-Tenant-ID header or fallback to owner/member."""
        from identity_access.models import CoreTenant, TenantMember

        # 1. Try X-Tenant-ID header
        header_tenant_id = request.META.get('HTTP_X_TENANT_ID', '').strip()
        if header_tenant_id:
            tenant, role = self._resolve_by_header(header_tenant_id, user)
            if tenant:
                return tenant, role
            # Header provided but invalid - return 403
            return None, None

        # 2. Fallback: User is tenant owner
        try:
            tenant = CoreTenant.objects.select_related('owner_user').get(owner_user=user)
            return tenant, TenantMember.RoleChoices.OWNER
        except CoreTenant.DoesNotExist:
            pass

        # 3. Fallback: First tenant where user is a member
        member = TenantMember.objects.select_related('tenant').filter(user=user).first()
        if member:
            return member.tenant, member.role

        return None, None

    def _resolve_by_header(self, tenant_id: str, user) -> tuple:
        """Validate X-Tenant-ID header against user's membership."""
        from identity_access.models import CoreTenant, TenantMember

        try:
            tenant = CoreTenant.objects.get(public_id=tenant_id)
        except CoreTenant.DoesNotExist:
            return None, None

        # Check if user is owner
        if tenant.owner_user_id == user.id:
            return tenant, TenantMember.RoleChoices.OWNER

        # Check if user is member
        member = TenantMember.objects.filter(tenant=tenant, user=user).first()
        if member:
            return tenant, member.role

        return None, None

    def _resolve_superuser_tenant(self, request, user):
        """Best-effort tenant resolution for superusers."""
        from identity_access.models import CoreTenant, TenantMember

        header_tenant_id = request.META.get('HTTP_X_TENANT_ID', '').strip()
        if header_tenant_id:
            try:
                tenant = CoreTenant.objects.get(public_id=header_tenant_id)
                request.tenant = tenant
                request.tenant_role = TenantMember.RoleChoices.OWNER
                return
            except CoreTenant.DoesNotExist:
                pass

        # Fallback to first owned tenant
        tenant = CoreTenant.objects.filter(owner_user=user).first()
        if tenant:
            request.tenant = tenant
            request.tenant_role = TenantMember.RoleChoices.OWNER
        else:
            # Fallback to first member tenant
            member = TenantMember.objects.select_related('tenant').filter(user=user).first()
            if member:
                request.tenant = member.tenant
                request.tenant_role = member.role


class TenantQuotaMiddleware:
    """Per-request quota metering for authenticated tenant traffic."""

    QUOTA_EXEMPT_PATH_PREFIXES = (
        '/health',
        '/api/core/v1/auth/',
        '/core/v1/auth/',
        '/api/public/',
        '/admin/',
        '/static/',
        '/core/v1/schema/',
        '/core/v1/schema/swagger-ui/',
        '/core/v1/schema/redoc/',
    )
    REDIS_KEY_TTL_SECONDS = 86400 * 2

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = str(getattr(request, 'path', '') or '')
        if self._is_exempt_path(path):
            return self.get_response(request)

        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.get_response(request)

        if getattr(user, 'is_superuser', False):
            return self.get_response(request)

        # Use request.tenant if already resolved by TenantResolutionMiddleware
        tenant = getattr(request, 'tenant', None)
        if tenant is None:
            # Fallback for backward compatibility
            tenant_id, api_calls_limit = self._resolve_tenant_quota(user)
            if tenant_id is None:
                return self.get_response(request)
        else:
            tenant_id = str(tenant.public_id)
            api_calls_limit = self._get_tenant_quota_limit(tenant)

        used_calls = self._increment_daily_counter(tenant_id)
        if api_calls_limit >= 0 and used_calls > api_calls_limit:
            return JsonResponse(
                {
                    'error': 'quota_exceeded',
                    'detail': 'Vượt quá giới hạn API trong ngày. Nâng cấp plan để tiếp tục.',
                    'limit': api_calls_limit,
                    'used': used_calls,
                },
                status=429,
            )

        return self.get_response(request)

    def _is_exempt_path(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self.QUOTA_EXEMPT_PATH_PREFIXES)

    def _resolve_tenant_quota(self, user) -> tuple[str | None, int]:
        """Return the tenant public id and active api_calls_limit, if any."""
        try:
            from commercial.models import QuotaRecord
            from identity_access.models import CoreTenant

            tenant = CoreTenant.objects.only(
                'public_id',
                'plan',
                'billing_period_start',
                'billing_period_end',
            ).get(owner_user=user)
        except CoreTenant.DoesNotExist:
            return None, -1

        today = timezone.now().date()
        quota_record = (
            QuotaRecord.objects.filter(
                tenant=tenant,
                period_start__lte=today,
                period_end__gte=today,
            )
            .order_by('-period_start', '-period_end')
            .first()
        )
        if quota_record is not None:
            return str(tenant.public_id), int(quota_record.api_calls_limit)

        return str(tenant.public_id), -1

    def _get_tenant_quota_limit(self, tenant) -> int:
        """Get quota limit for a resolved tenant."""
        try:
            from commercial.models import QuotaRecord

            today = timezone.now().date()
            quota_record = (
                QuotaRecord.objects.filter(
                    tenant=tenant,
                    period_start__lte=today,
                    period_end__gte=today,
                )
                .order_by('-period_start', '-period_end')
                .first()
            )
            if quota_record is not None:
                return int(quota_record.api_calls_limit)
        except Exception:
            pass
        return -1

    def _increment_daily_counter(self, tenant_id: str) -> int:
        key = self._build_counter_key(tenant_id, timezone.now().date())
        if cache.add(key, 1, timeout=self.REDIS_KEY_TTL_SECONDS):
            return 1

        try:
            return cache.incr(key)
        except ValueError:
            if cache.add(key, 1, timeout=self.REDIS_KEY_TTL_SECONDS):
                return 1
            return cache.incr(key)

    @staticmethod
    def _build_counter_key(tenant_id: str, day: date) -> str:
        return f'quota:api_calls:{tenant_id}:{day.isoformat()}'