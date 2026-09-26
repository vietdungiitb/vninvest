"""Tenant resolution and quota enforcement middleware for core-api.

This module contains:
1. TenantResolutionMiddleware - Resolves tenant from X-Tenant-ID header or user membership
2. TenantQuotaMiddleware - Per-request quota metering for authenticated tenant traffic
"""
from __future__ import annotations

import json
import logging
from datetime import date

from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from vninvest_core.client_ip import UNKNOWN_IP, get_client_ip

from identity_access.utils.resolve_tenant import (
    first_eligible_tenant_for_user,
    owner_tenant_for_user,
)

logger = logging.getLogger(__name__)


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

        # R5 staff-switch (kể cả superuser): header X-Staff-Switch được xử lý
        # TRƯỚC mọi bypass — phiên xem hộ luôn ép viewer + strip đặc quyền,
        # token hỏng/hết hạn → 403 cứng (không rơi qua bypass).
        switch_token = request.META.get('HTTP_X_STAFF_SWITCH', '').strip()
        if switch_token:
            if self._resolve_staff_switch(request, user, switch_token):
                return self.get_response(request)
            return JsonResponse(
                {
                    'error': 'staff_switch_invalid',
                    'detail': 'Phiên xem hộ không hợp lệ hoặc đã hết hạn.',
                },
                status=403,
            )

        if getattr(user, 'is_superuser', False):
            # Superusers bypass tenant resolution but we still try to set context
            self._resolve_superuser_tenant(request, user)
            return self.get_response(request)

        # Machine PATs are bound to their issuing tenant; reject cross-tenant
        # header attempts with a dedicated error code (human session PATs may switch).
        credential = getattr(request, 'auth', None)
        header_tenant_id = request.META.get('HTTP_X_TENANT_ID', '').strip()
        if (
            credential is not None
            and not credential.is_human_session
            and header_tenant_id
            and str(credential.service_account.tenant.public_id) != header_tenant_id
        ):
            return JsonResponse(
                {
                    'error': 'pat_tenant_mismatch',
                    'detail': 'Machine PAT không được phép truy cập tenant khác với tenant phát hành.',
                },
                status=403,
            )

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
        import re
        if any(path.startswith(prefix) for prefix in self.EXEMPT_PATH_PREFIXES):
            return True
        # Invite accept/cancel: invitee is not yet a tenant member, so
        # tenant resolution must be skipped; the view resolves tenant from
        # the invite token itself.
        if re.search(r'/invites/[^/]+/(accept|cancel)/?$', path):
            return True
        return False

    def _resolve_staff_switch(self, request, user, switch_token: str) -> bool:
        """R5: validate X-Staff-Switch → gán tenant target + role viewer.

        Trả True nếu áp dụng thành công, False nếu token hỏng/hết hạn/không
        đủ điều kiện (caller trả 403 staff_switch_invalid).
        """
        try:
            from service_ops.views.staff import verify_staff_switch
            staff_id, tenant_public_id = verify_staff_switch(switch_token)
        except Exception:
            return False
        if int(staff_id) != int(user.id):
            return False
        if not (getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)):
            return False
        # Machine PAT không được dùng phiên xem hộ (staff-only human flow).
        credential = getattr(request, 'auth', None)
        if credential is not None:
            try:
                from identity_access.models import CorePATCredential
                if isinstance(credential, CorePATCredential) and not credential.is_human_session:
                    return False
            except Exception:
                return False
        try:
            from identity_access.models import CoreTenant
            tenant = CoreTenant.objects.get(public_id=tenant_public_id)
        except Exception:
            return False
        if tenant.status != CoreTenant.StatusChoices.ACTIVE:
            return False
        request.tenant = tenant
        request.tenant_role = 'viewer'
        request.staff_switch = True
        # H0.1: strip đặc quyền staff trên request — phiên xem hộ là viewer
        # thuần túy, không được qua lớp guard IsAdminUser ở SOC/operator
        # (mirror apply_pat_user_privileges). Request-scoped, không persist DB.
        user.is_staff = False
        user.is_superuser = False
        return True

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
            
            # Resolve the request user. A human-session PAT issued for a specific
            # TenantMember carries the real member role (Sprint 4 prerequisite fix);
            # machine PATs and owner-equivalent PATs collapse to the tenant owner.
            from identity_access.utils.resolve_tenant import apply_pat_user_privileges
            member = credential.issued_for_member
            if member is not None:
                user = member.user
                request.tenant_role = member.role
            else:
                user = credential.service_account.tenant.owner_user
            user = apply_pat_user_privileges(user, credential)
            # Expose the resolved credential on the request so downstream middleware
            # (e.g. TenantQuotaMiddleware) can attribute the request to a PAT without
            # re-resolving it. DRF re-sets request.auth later with the same credential.
            request.auth = credential
            # B9: also expose the resolved *user*. DRF authentication happens
            # inside the view, so at quota-middleware time request.user is still
            # Django's lazy session user (AnonymousUser for a PAT request) and
            # TenantQuotaMiddleware used to skip PAT traffic entirely - no
            # counter, no 429, no _enqueue_pat_audit. Stashing the already
            # resolved user here means the quota middleware never has to
            # re-parse the secret or re-query the DB.
            #
            # Set on `request`, deliberately NOT on `request.user`: assigning to
            # request.user would force evaluation of the SimpleLazyObject and
            # could interfere with session auth. This is a plain attribute
            # write on a per-request object, so it is request-scoped and
            # idempotent (written once per request).
            request._pat_user = user
            return user
        except Exception:
            return None

    def _resolve_tenant(self, request, user) -> tuple:
        """Resolve tenant from X-Tenant-ID header or fallback to owner/member."""
        from identity_access.models import TenantMember

        # 1. Try X-Tenant-ID header
        header_tenant_id = request.META.get('HTTP_X_TENANT_ID', '').strip()
        if header_tenant_id:
            # Delegates to the shared owner-or-member membership check so this
            # file and utils/resolve_tenant.py cannot drift apart again.
            tenant, role = self._resolve_by_header(header_tenant_id, user)
            if tenant:
                return tenant, role
            # Header provided but invalid - return 403
            return None, None

        # 2. Fallback: User is tenant owner (OneToOne -> unambiguous)
        tenant = owner_tenant_for_user(user)
        if tenant is not None:
            return tenant, TenantMember.RoleChoices.OWNER

        # 3. Fallback: first *eligible* tenant where user is a member.
        # Was: TenantMember.objects.select_related('tenant').filter(user=user)
        # .first()  -- no ordering, no status filter, so a user in 2+ tenants
        # got a nondeterministic tenant that could be suspended.
        return first_eligible_tenant_for_user(user)

    def _resolve_by_header(self, tenant_id: str, user) -> tuple:
        """Validate X-Tenant-ID header against user's membership.

        Thin wrapper over the single shared membership check so that there is
        exactly one owner-or-member rule in the codebase.
        """
        from identity_access.utils.resolve_tenant import resolve_tenant_for_user

        return resolve_tenant_for_user(user, tenant_id)

    def _resolve_superuser_tenant(self, request, user):
        """Best-effort tenant context for superusers.

        NOTE (audit tenantreg-b, not changed): this performs **no** status
        check and assigns ``RoleChoices.OWNER`` unconditionally, for any
        ``public_id`` supplied via the header. That is consistent with the
        documented intent that superusers are not blocked by tenant status
        ("Superusers bypass tenant resolution"), and ``IsTenantActive``
        separately lets superusers through. Left as-is on purpose: narrowing it
        would change operator behaviour, which is out of this slice's scope.
        Reported for the owner to decide.
        """
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
        tenant = owner_tenant_for_user(user)
        if tenant is not None:
            request.tenant = tenant
            request.tenant_role = TenantMember.RoleChoices.OWNER
        else:
            # Fallback to first *eligible* member tenant (was: unordered,
            # unfiltered `.first()`).
            tenant, role = first_eligible_tenant_for_user(user)
            if tenant is not None:
                request.tenant = tenant
                request.tenant_role = role


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
            # B9: PAT-authenticated requests reach this middleware with no
            # usable request.user -- DRF authenticates later, inside the view,
            # so request.user is still Django's lazy session user
            # (AnonymousUser) here. The old code returned immediately, which
            # made the daily counter, the 429 enforcement AND the
            # `if is_pat:` audit branch unreachable for essentially all
            # programmatic traffic. TenantResolutionMiddleware (one layer up)
            # already resolved and stashed that user on request._pat_user, so
            # reuse it. No secret re-parse, no extra query, no mutation of
            # request.user, and the getattr default keeps behaviour identical
            # when the attribute is absent (non-PAT, or an invalid PAT).
            user = getattr(request, '_pat_user', None)
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
        # Update PAT last_used_at when the request was authenticated via a PAT.
        # request.auth is set to the CorePATCredential instance by
        # TenantResolutionMiddleware for PAT-authenticated requests.
        auth = getattr(request, 'auth', None)
        is_pat = auth is not None and auth.__class__.__name__ == 'CorePATCredential'
        if is_pat:
            try:
                from identity_access.models import CorePATCredential
                CorePATCredential.objects.filter(pk=auth.pk).update(last_used_at=timezone.now())
            except Exception:
                logger.warning('TenantQuotaMiddleware: failed to update PAT last_used_at')

        if api_calls_limit >= 0 and used_calls > api_calls_limit:
            # Enterprise soft limit: log warning + header, don't block
            # Local import: identity_access.models is deliberately not imported at
            # module scope in this file (every resolver below imports it lazily),
            # so referencing CoreTenant here without it raised NameError and turned
            # the whole quota-exceeded branch into a 500.
            from identity_access.models import CoreTenant

            is_enterprise = getattr(tenant, 'plan', '') == CoreTenant.PlanChoices.ENTERPRISE
            if is_enterprise:
                response = self.get_response(request)
                response['X-Quota-Warning'] = 'exceeded'
                logger.warning(
                    'Enterprise tenant %s exceeded API quota (%d/%d) — request allowed',
                    tenant.public_id, used_calls, api_calls_limit
                )
                if is_pat:
                    self._enqueue_pat_audit(request, auth, 200)
                return response
            
            response = JsonResponse(
                {
                    'error': 'quota_exceeded',
                    'detail': 'Vượt quá giới hạn API trong ngày. Nâng cấp plan để tiếp tục.',
                    'limit': api_calls_limit,
                    'used': used_calls,
                },
                status=429,
            )
            if is_pat:
                self._enqueue_pat_audit(request, auth, response.status_code)
            return response

        start_ts = timezone.now()
        response = self.get_response(request)
        if is_pat:
            duration_ms = int((timezone.now() - start_ts).total_seconds() * 1000)
            self._enqueue_pat_audit(request, auth, response.status_code, duration_ms)
        return response

    def _enqueue_pat_audit(self, request, credential, status_code: int, duration_ms: int = 0):
        """Non-blocking enqueue of a PATAuditLog entry into the batch Redis list.

        The flush_pat_audit_log Celery task pops these and bulk_create them, so
        this never performs a DB write in the request hot path.
        """
        try:
            # Was: left-most X-Forwarded-For or REMOTE_ADDR - client-forgeable.
            # get_client_ip() honours the header only for a TRUSTED_PROXY_IPS
            # peer. UNKNOWN_IP is mapped back to '' so that
            # tasks.flush_pat_audit_log's `entry.get('ip_address') or None`
            # keeps writing NULL into the GenericIPAddressField; passing the
            # literal "unknown" through would fail bulk_create and re-queue the
            # whole batch forever (poison message).
            client_ip = get_client_ip(request)
            if client_ip == UNKNOWN_IP:
                client_ip = ''
            entry = {
                'pat_pk': credential.pk,
                'tenant_pk': getattr(credential.service_account, 'tenant_id', None),
                'ip_address': client_ip,
                'endpoint': str(getattr(request, 'path', '') or '')[:256],
                'method': str(getattr(request, 'method', '') or '')[:8],
                'status_code': int(status_code),
                'user_agent': str(request.META.get('HTTP_USER_AGENT', '') or '')[:2000],
                'auth_source': 'pat',
                'duration_ms': int(duration_ms or 0),
            }
            try:
                redis_client = cache._cache.get_client(write=True)
                redis_client.rpush('pat_audit_queue', json.dumps(entry, default=str))
            except Exception:
                # Fallback for LocMemCache in tests (no redis)
                try:
                    cache_client = getattr(cache, '_cache', None)
                    if cache_client is not None and hasattr(cache_client, 'rpush'):
                        cache_client.rpush('pat_audit_queue', json.dumps(entry, default=str))
                except Exception:
                    pass
        except Exception:
            logger.warning('TenantQuotaMiddleware: failed to enqueue PAT audit entry')

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


class RateLimitHeadersMiddleware:
    """
    Adds X-RateLimit-* headers to PAT-authenticated responses.
    
    Reads remaining quota from request._pat_rate_remaining (set by PATRateThrottle)
    and computes reset timestamp from the sorted set window.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only add headers for PAT-authenticated requests
        remaining = getattr(request, '_pat_rate_remaining', None)
        if remaining is None:
            return response

        limit = getattr(request, '_pat_rate_limit', None)
        if limit is None or limit < 0:
            return response

        # Compute reset time (next hour boundary)
        import time
        now = time.time()
        reset_ts = int(now - (now % 3600) + 3600)

        response['X-RateLimit-Limit'] = str(limit)
        response['X-RateLimit-Remaining'] = str(max(0, remaining))
        response['X-RateLimit-Reset'] = str(reset_ts)
        response['X-RateLimit-Resource'] = f'pat:{getattr(request.auth, "public_id", "unknown")}'

        return response