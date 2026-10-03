"""
Native advisory API route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from calendar import monthrange
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord
from advisory.tests.envelope import unwrapped
from advisory.views import AdvisoryRefreshView
from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent


class AdvisoryManualTriggerApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='advisory-owner',
            email='advisory-owner@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='advisory-tenant-1',
            display_name='Advisory Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)

    def _current_period(self):
        today = timezone.localdate()
        return (
            today.replace(day=1),
            today.replace(day=monthrange(today.year, today.month)[1]),
        )

    def _create_quota_record(self, *, used: int, limit: int):
        period_start, period_end = self._current_period()
        return QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=period_start,
            period_end=period_end,
            api_calls_used=used,
            api_calls_limit=limit,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_advisory_refresh_route_triggers_pending_job_and_records_audit(self, mock_delay):
        resolver = resolve('/core/v1/advisory/refresh/FPT/')
        self.assertIs(resolver.func.view_class, AdvisoryRefreshView)
        self._create_quota_record(used=0, limit=1)

        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # `advisory` da boc `{data, meta}` — `unwrapped` mo envelope neu co,
        # giu nguyen neu khong. Cac response loi (402/429/403) o duoi **khong**
        # boc theo RFC 9457 nen dung doc `response.data` cho may.
        body = unwrapped(response)
        self.assertEqual(body['status'], 'pending')
        self.assertEqual(body['symbol'], 'FPT')
        self.assertEqual(body['manual_trigger']['job_key'], 'advisory_refresh')
        self.assertEqual(body['manual_trigger']['priority_tier'], 'pro')
        self.assertEqual(body['manual_trigger']['quota']['used'], 1)
        self.assertEqual(body['task_id'], body['advisory_id'])
        self.assertEqual(AdvisoryRecord.objects.filter(user=self.user, symbol='FPT', status='pending').count(), 1)
        quota_record = QuotaRecord.objects.get(tenant=self.tenant)
        self.assertEqual(quota_record.api_calls_used, 1)
        audit_event = AuditEvent.objects.get(resource_type='manual_trigger')
        self.assertEqual(audit_event.action, AuditEvent.ActionChoices.CREATE)
        self.assertEqual(audit_event.metadata['decision'], 'accepted')
        self.assertEqual(audit_event.metadata['job_key'], 'advisory_refresh')
        self.assertEqual(audit_event.metadata['quota_used_after'], 1)

    def test_advisory_refresh_rejects_when_quota_is_exhausted(self):
        self._create_quota_record(used=1, limit=1)

        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertIn('quota', response.data)
        self.assertEqual(response.data['quota']['used'], 1)
        self.assertEqual(AdvisoryRecord.objects.count(), 0)
        self.assertEqual(AuditEvent.objects.get(resource_type='manual_trigger').metadata['decision'], 'blocked')
        self.assertEqual(AuditEvent.objects.get(resource_type='manual_trigger').metadata['reason'], 'quota_exhausted')

    @override_settings(ADVISORY_MANUAL_TRIGGER_COOLDOWN_SECONDS=300)
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_advisory_refresh_enforces_cooldown_between_manual_triggers(self, mock_delay):
        self._create_quota_record(used=0, limit=5)

        first_response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        second_response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('retry_after_seconds', second_response.data)
        self.assertEqual(AdvisoryRecord.objects.filter(user=self.user, symbol='FPT', status='pending').count(), 1)
        quota_record = QuotaRecord.objects.get(tenant=self.tenant)
        self.assertEqual(quota_record.api_calls_used, 1)
        self.assertGreaterEqual(AuditEvent.objects.filter(resource_type='manual_trigger').count(), 2)

    def test_advisory_refresh_rejects_suspended_tenant(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save(update_fields=['status'])
        self._create_quota_record(used=0, limit=5)

        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Tenant hiện tại chưa đủ điều kiện', response.data['detail'])
        self.assertEqual(AdvisoryRecord.objects.count(), 0)
        self.assertEqual(AuditEvent.objects.get(resource_type='manual_trigger').metadata['reason'], 'tenant_status')


class AdvisoryLatestHistoryUserScopingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(
            username='advisory-a', email='a@example.com', password='testpass123'
        )
        self.user_b = User.objects.create_user(
            username='advisory-b', email='b@example.com', password='testpass123'
        )
        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.user_a, tenant_code='tenant-a', display_name='Tenant A',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.tenant_b = CoreTenant.objects.create(
            owner_user=self.user_b, tenant_code='tenant-b', display_name='Tenant B',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user_a)

    def _create_record(self, user, symbol='FPT', status='generated'):
        return AdvisoryRecord.objects.create(
            symbol=symbol, session_date=str(timezone.localdate()), user=user,
            status=status, ai_model='gpt-4o-mini', advisory_text='test', tokens_used=100,
        )

    def test_latest_does_not_leak_other_users_record(self):
        self._create_record(self.user_a, 'FPT', 'generated')
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/core/v1/advisory/latest/FPT/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_history_does_not_leak_other_users_record(self):
        self._create_record(self.user_a, 'FPT', 'generated')
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/core/v1/advisory/history/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(unwrapped(response).get('results', [])), 0)

    def test_latest_returns_own_record(self):
        self._create_record(self.user_a, 'FPT', 'generated')
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/core/v1/advisory/latest/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('advisory_id', unwrapped(response))

    def test_history_returns_own_record(self):
        self._create_record(self.user_a, 'FPT', 'generated')
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/core/v1/advisory/history/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(unwrapped(response).get('results', [])), 1)
