"""Tenant quota enforcement middleware for core-api.

Counts authenticated tenant API requests in Redis and blocks with 429 when
the tenant exceeds the active quota limit for the current billing period.
"""
from __future__ import annotations

from datetime import date

from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone


class TenantQuotaMiddleware:
    """Per-request quota metering for authenticated tenant traffic."""

    QUOTA_EXEMPT_PATH_PREFIXES = (
        '/health',
        '/api/core/v1/auth/',
        '/core/v1/auth/',
        '/api/public/',
        '/admin/',
        '/static/',
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

        tenant_id, api_calls_limit = self._resolve_tenant_quota(user)
        if tenant_id is None:
            return self.get_response(request)

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
