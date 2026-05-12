"""SAAS-14: TenantQuotaMiddleware request metering tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import json
import os
import sys
from calendar import monthrange
from datetime import date
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpResponse
from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework import status

from commercial.models import QuotaRecord
from identity_access.middleware import TenantQuotaMiddleware
from identity_access.models import CoreTenant
from vninvest_core import settings


class _InMemoryQuotaCache:
    def __init__(self):
        self.store = {}

    def add(self, key, value, timeout=None):
        if key in self.store:
            return False
        self.store[key] = value
        return True

    def incr(self, key, delta=1):
        if key not in self.store:
            raise ValueError(key)
        self.store[key] = int(self.store[key]) + delta
        return self.store[key]


class TenantQuotaMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.cache_stub = _InMemoryQuotaCache()

        today = timezone.now().date()
        self.period_start = date(today.year, today.month, 1)
        self.period_end = date(today.year, today.month, monthrange(today.year, today.month)[1])

        self.user = User.objects.create_user(
            username='quota-tenant-user',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='quota-tenant-1',
            display_name='Quota Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.quota_record = QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=self.period_start,
            period_end=self.period_end,
            api_calls_used=0,
            api_calls_limit=100,
        )

        self.unlimited_user = User.objects.create_user(
            username='quota-unlimited-user',
            password='testpass123',
        )
        self.unlimited_tenant = CoreTenant.objects.create(
            owner_user=self.unlimited_user,
            tenant_code='quota-tenant-2',
            display_name='Unlimited Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.unlimited_quota_record = QuotaRecord.objects.create(
            tenant=self.unlimited_tenant,
            period_start=self.period_start,
            period_end=self.period_end,
            api_calls_used=0,
            api_calls_limit=-1,
        )

        self.superuser = User.objects.create_superuser(
            username='quota-superuser',
            email='quota-superuser@example.com',
            password='testpass123',
        )

    def _request(self, path, user=None):
        request = self.factory.get(path)
        if user is not None:
            request.user = user
        return request

    def _middleware(self):
        return TenantQuotaMiddleware(lambda request: HttpResponse('ok'))

    def _run_with_cache(self, request, quota_tuple=None):
        middleware = self._middleware()
        with patch('identity_access.middleware.cache', self.cache_stub):
            if quota_tuple is not None:
                with patch.object(
                    TenantQuotaMiddleware,
                    '_resolve_tenant_quota',
                    return_value=quota_tuple,
                ):
                    return middleware(request)
            return middleware(request)

    def test_settings_register_middleware_after_authentication(self):
        middleware = list(settings.MIDDLEWARE)
        quota_index = middleware.index('identity_access.middleware.TenantQuotaMiddleware')
        auth_index = middleware.index('django.contrib.auth.middleware.AuthenticationMiddleware')

        self.assertGreater(quota_index, auth_index)

    def test_resolve_tenant_quota_uses_active_quota_record(self):
        middleware = self._middleware()

        tenant_id, api_calls_limit = middleware._resolve_tenant_quota(self.user)

        self.assertEqual(tenant_id, self.tenant.public_id)
        self.assertEqual(api_calls_limit, 100)

    def test_exceeded_limit_returns_429(self):
        request = self._request('/api/core/v1/identity/profile/', self.user)

        for _ in range(100):
            response = self._run_with_cache(request, quota_tuple=(self.tenant.public_id, 100))
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self._run_with_cache(request, quota_tuple=(self.tenant.public_id, 100))

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['error'], 'quota_exceeded')
        self.assertEqual(payload['limit'], 100)
        self.assertEqual(payload['used'], 101)
        self.assertEqual(
            self.cache_stub.store[
                TenantQuotaMiddleware._build_counter_key(self.tenant.public_id, timezone.now().date())
            ],
            101,
        )

    def test_unlimited_quota_counts_but_never_blocks(self):
        request = self._request('/api/core/v1/identity/profile/', self.unlimited_user)

        for _ in range(1000):
            response = self._run_with_cache(request, quota_tuple=(self.unlimited_tenant.public_id, -1))
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(
            self.cache_stub.store[
                TenantQuotaMiddleware._build_counter_key(self.unlimited_tenant.public_id, timezone.now().date())
            ],
            1000,
        )

    def test_auth_path_is_exempt(self):
        request = self._request('/api/core/v1/auth/login', self.user)

        response = self._run_with_cache(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.cache_stub.store, {})

    def test_health_path_is_exempt(self):
        request = self._request('/health', self.user)

        response = self._run_with_cache(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.cache_stub.store, {})

    def test_public_path_is_exempt_even_for_authenticated_user(self):
        request = self._request('/api/public/legal-pages/', self.user)

        response = self._run_with_cache(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.cache_stub.store, {})

    def test_unauthenticated_request_is_not_counted(self):
        request = self._request('/api/core/v1/identity/profile/')
        request.user = AnonymousUser()

        response = self._run_with_cache(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.cache_stub.store, {})

    def test_superuser_request_is_not_counted(self):
        request = self._request('/api/core/v1/identity/profile/', self.superuser)

        response = self._run_with_cache(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.cache_stub.store, {})
