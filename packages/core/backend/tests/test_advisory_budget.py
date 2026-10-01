"""
F3 budget soft/hard tests — AI Command Center Slice F.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from datetime import timedelta
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from calendar import monthrange

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisorySession, UserAICredential
from advisory.tests.envelope import unwrapped
from advisory.views import _advisory_budget_state, _resolve_advisory_token_budget
from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent


class AdvisoryBudgetResolveTests(TestCase):
    """Unit: _resolve_advisory_token_budget / _advisory_budget_state."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='budget-user',
            email='budget-user@example.com',
            password='testpass123',
        )

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_system_fallback_when_no_user_credential(self):
        budget, source = _resolve_advisory_token_budget(self.user)
        self.assertEqual(budget, 2000)
        self.assertEqual(source, 'system')

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_user_override_preferred(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            max_tokens_per_day=500,
        )
        budget, source = _resolve_advisory_token_budget(self.user)
        self.assertEqual(budget, 500)
        self.assertEqual(source, 'user')

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_null_user_override_falls_back_to_system(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            max_tokens_per_day=None,
        )
        budget, source = _resolve_advisory_token_budget(self.user)
        self.assertEqual(budget, 2000)
        self.assertEqual(source, 'system')

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_zero_user_override_falls_back_to_system(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            max_tokens_per_day=0,
        )
        budget, source = _resolve_advisory_token_budget(self.user)
        self.assertEqual(budget, 2000)
        self.assertEqual(source, 'system')

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_state_hard_exceeded(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            max_tokens_per_day=100,
        )
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=100,
            token_budget=100,
        )
        state = _advisory_budget_state(self.user, today)
        self.assertTrue(state['hard_exceeded'])
        self.assertFalse(state['soft_warning'])
        self.assertEqual(state['token_budget'], 100)
        self.assertEqual(state['tokens_used'], 100)
        self.assertEqual(state['budget_source'], 'user')

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_state_soft_warning_at_80pct(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            max_tokens_per_day=100,
        )
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=80,
            token_budget=100,
        )
        state = _advisory_budget_state(self.user, today)
        self.assertFalse(state['hard_exceeded'])
        self.assertTrue(state['soft_warning'])
        self.assertEqual(state['pct_used'], 80.0)
        self.assertEqual(state['remaining'], 20)

    @override_settings(ADVISORY_TOKEN_BUDGET=2000)
    def test_state_below_soft_no_warning(self):
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=500,
            token_budget=2000,
        )
        state = _advisory_budget_state(self.user, today)
        self.assertFalse(state['hard_exceeded'])
        self.assertFalse(state['soft_warning'])
        self.assertEqual(state['budget_source'], 'system')


class AdvisoryBudgetHardBlockApiTests(TestCase):
    """Integration: POST /advisory/refresh blocks at 100% of effective budget."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='budget-hard',
            email='budget-hard@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='budget-hard-tenant',
            display_name='Budget Hard Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            max_tokens_per_day=100,
        )
        self._create_quota_record(used=0, limit=10)

    def _create_quota_record(self, *, used: int, limit: int):
        today = timezone.localdate()
        return QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
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
    def test_hard_block_429_when_user_budget_exceeded(self, mock_delay):
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=100,
            token_budget=100,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertTrue(response.data.get('budget_hard_exceeded'))
        self.assertEqual(response.data['tokens_used'], 100)
        self.assertEqual(response.data['token_budget'], 100)
        self.assertEqual(response.data['budget_source'], 'user')
        self.assertEqual(AdvisorySession.objects.filter(user=self.user).count(), 1)
        self.assertFalse(mock_delay.called)
        audit = AuditEvent.objects.get(resource_type='manual_trigger')
        self.assertEqual(audit.metadata['decision'], 'blocked')
        self.assertEqual(audit.metadata['reason'], 'token_budget')

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_soft_warning_201_when_at_80pct(self, mock_delay):
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=80,
            token_budget=100,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = unwrapped(response)
        self.assertTrue(body.get('budget_soft_warning'))
        budget = body.get('budget') or {}
        self.assertEqual(budget.get('token_budget'), 100)
        self.assertEqual(budget.get('tokens_used'), 80)
        self.assertEqual(budget.get('budget_source'), 'user')
        self.assertEqual(budget.get('remaining'), 20)
        self.assertTrue(mock_delay.called)
        audit = AuditEvent.objects.get(resource_type='manual_trigger', action='create')
        self.assertEqual(audit.metadata['budget_soft_warning'], True)
        self.assertEqual(audit.metadata['budget_token_budget'], 100)

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_no_soft_warning_when_below_threshold(self, mock_delay):
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = unwrapped(response)
        self.assertFalse(body.get('budget_soft_warning'))
        budget = body.get('budget') or {}
        self.assertEqual(budget.get('tokens_used'), 0)
        self.assertTrue(mock_delay.called)


class AdvisoryBudgetSystemFallbackApiTests(TestCase):
    """Integration: no UserAICredential → system ADVISORY_TOKEN_BUDGET used for hard block."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='budget-sys',
            email='budget-sys@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='budget-sys-tenant',
            display_name='Budget Sys Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)
        today = timezone.localdate()
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
            api_calls_used=0,
            api_calls_limit=10,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )

    @override_settings(ADVISORY_TOKEN_BUDGET=100)
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_hard_block_uses_system_budget(self, mock_delay):
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=100,
            token_budget=100,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data['token_budget'], 100)
        self.assertEqual(response.data['budget_source'], 'system')
        self.assertFalse(mock_delay.called)

    @override_settings(ADVISORY_TOKEN_BUDGET=1000)
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_soft_warning_system_budget(self, mock_delay):
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=today,
            tokens_used=800,
            token_budget=1000,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(unwrapped(response).get('budget_soft_warning'))
        self.assertEqual(unwrapped(response)['budget']['budget_source'], 'system')
        self.assertTrue(mock_delay.called)
