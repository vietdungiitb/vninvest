"""R2.8 - AIBudget: 4 tang, 3 chieu, soft 80% / hard 100%.

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:965-977` (R2.8).

Ghi chu (bat buoc doc truoc khi sua):
- `AIUsageRecord` **khong co FK tenant** (R0.7 da tu choi doan tenant thanh toan).
  => chi so dung cua 1 tang = hop cac user thuoc tenant (owner + TenantMember).
  User thuoc nhieu tenant se bi tinh o **moi** tang -> thieu nghiem (gioi han hon),
  khong bao gio lo. AC6 kiem ro rang 2 user o 2 tenant khong lan nhau.
- 1 dong `AIBudget` = **mot han muc tren mot chieu** (cost | tokens | requests).
  So sanh "muc chặt nhat" giua USD va token khong co nghia => tach chieu.
- Plan §4.2 gan `test_ai_budget.py` cho R2.5, do la so hieu Rev.1 (R2.5 = openclaw).
  Giu ten file, gan dung slice R2.8.
"""
import os
import sys
from calendar import monthrange
from decimal import Decimal
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.budget import BUDGET_SOURCE_MODEL, BUDGET_SOURCE_SYSTEM, resolve_budget
from advisory.models import AdvisorySession, AIBudget
from advisory.tests.envelope import unwrapped
from ai_analytics.models import AIUsageRecord
from commercial.models import QuotaRecord
from identity_access.models import CoreTenant


def _usage(user, *, tokens=0, cost='0', provider='openai', model='gpt-4o-mini'):
    return AIUsageRecord.objects.create(
        action=AIUsageRecord.ActionChoices.ADVISORY,
        user=user,
        provider=provider,
        model=model,
        tokens_in=tokens,
        tokens_out=0,
        cost=Decimal(cost),
        status='success',
    )


def _budget(**kwargs):
    kwargs.setdefault('dimension', AIBudget.DimensionChoices.TOKENS)
    kwargs.setdefault('limit_value', Decimal('100'))
    kwargs.setdefault('period', AIBudget.PeriodChoices.DAILY)
    return AIBudget.objects.create(**kwargs)


class BudgetTierMatrixTests(TestCase):
    """AC1: 4 tang, lay muc chat nhat - ma tran 2x2x2."""

    def setUp(self):
        self.user = User.objects.create_user(username='b-tier', password='p')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user, tenant_code='b-tier', display_name='B',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_ac1_matrix_2x2x2_picks_most_restrictive(self):
        # 8 to hop (model, user, tenant) co/khong; system luon co.
        # Moi hang: (co_model, co_user, co_tenant, limit thang nh, limit thang hai,
        #           pct thang nh, pct thang hai, source ky vong)
        system = _budget(limit_value=Decimal('1000'))  # 1000 tokens, 0 da dung
        cases = [
            (False, False, False, None, None, 0.0, 0.0, BUDGET_SOURCE_SYSTEM),
            (True, False, False, 50, None, 20.0, 0.0, BUDGET_SOURCE_MODEL),
            (False, True, False, 50, None, 20.0, 0.0, 'user'),
            (False, False, True, 50, None, 20.0, 0.0, 'tenant'),
            # model rong hon user -> user chat hon
            (True, True, False, 900, 50, 0.1, 20.0, 'user'),
            # user rong hon tenant -> tenant chat hon
            (False, True, True, 900, 50, 0.1, 20.0, 'tenant'),
            # model chat nhat
            (True, True, True, 10, 50, 80.0, 20.0, BUDGET_SOURCE_MODEL),
            # ca 3 cung pct -> phai theo scope hep nhat (model) khong phai thu tu DB
            (True, True, True, 10, 100, 80.0, 8.0, BUDGET_SOURCE_MODEL),
        ]
        for (has_model, has_user, has_tenant, model_limit, other_limit,
             model_pct, other_pct, expected_source) in cases:
            with self.subTest(model=has_model, user=has_user, tenant=has_tenant):
                AIBudget.objects.exclude(pk=system.pk).delete()
                _usage(self.user, tokens=80)
                if has_model:
                    _budget(model='gpt-4o-mini', limit_value=Decimal(model_limit))
                    self.assertAlmostEqual(model_pct, 80.0 / float(model_limit) * 100, 1)
                if has_user:
                    _budget(user=self.user, limit_value=Decimal(other_limit))
                    self.assertAlmostEqual(other_pct, 80.0 / float(other_limit) * 100, 1)
                if has_tenant:
                    _budget(tenant=self.tenant, limit_value=Decimal(other_limit))
                state = resolve_budget(
                    user=self.user, tenant=self.tenant, model='gpt-4o-mini',
                )
                self.assertTrue(state['matched'])
                self.assertEqual(state['source'], expected_source)
                _usage(self.user, tokens=0).delete()
                AIUsageRecord.objects.all().delete()

    def test_ac1_ties_prefer_narrower_scope_over_wider(self):
        _budget(user=self.user, limit_value=Decimal('100'))      # 80%
        _budget(tenant=self.tenant, limit_value=Decimal('100'))   # 80%
        state = resolve_budget(user=self.user, tenant=self.tenant, model='gpt-4o-mini')
        self.assertEqual(state['source'], 'user')


class BudgetBoundaryTests(TestCase):
    """AC2: bien 79/80/99/100/101%."""

    def setUp(self):
        self.user = User.objects.create_user(username='b-edge', password='p')

    def test_ac2_five_boundaries(self):
        _budget(user=self.user, limit_value=Decimal('100'))
        for pct, soft, hard in [(79, False, False), (80, True, False), (99, True, False),
                                (100, False, True), (101, False, True)]:
            with self.subTest(pct=pct):
                AIUsageRecord.objects.all().delete()
                _usage(self.user, tokens=pct)
                state = resolve_budget(user=self.user, model='gpt-4o-mini')
                self.assertEqual(state['pct'], float(pct), msg='pct')
                self.assertEqual(state['soft_warning'], soft, msg='soft')
                self.assertEqual(state['hard_exceeded'], hard, msg='hard')


class BudgetDimensionTests(TestCase):
    """3 chieu: cost / tokens / requests."""

    def setUp(self):
        self.user = User.objects.create_user(username='b-dim', password='p')

    def test_cost_dimension_uses_cost_sum(self):
        _budget(user=self.user, dimension=AIBudget.DimensionChoices.COST,
                limit_value=Decimal('1.000000'))
        _usage(self.user, tokens=9999, cost='0.600000')
        _usage(self.user, tokens=9999, cost='0.400000')
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertEqual(state['dimension'], 'cost')
        self.assertTrue(state['hard_exceeded'])
        self.assertEqual(state['pct'], 100.0)

    def test_requests_dimension_counts_rows(self):
        _budget(user=self.user, dimension=AIBudget.DimensionChoices.REQUESTS,
                limit_value=Decimal('3'))
        for _ in range(3):
            _usage(self.user, tokens=0)
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertEqual(state['dimension'], 'requests')
        self.assertTrue(state['hard_exceeded'])

    def test_most_restrictive_across_dimensions_wins(self):
        _budget(user=self.user, dimension=AIBudget.DimensionChoices.TOKENS,
                limit_value=Decimal('1000'))
        _budget(user=self.user, dimension=AIBudget.DimensionChoices.COST,
                limit_value=Decimal('1.000000'))
        _usage(self.user, tokens=10, cost='0.900000')
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertEqual(state['dimension'], 'cost')
        self.assertTrue(state['soft_warning'])
        self.assertFalse(state['hard_exceeded'])

    def test_ac8_copilot_uses_requests_not_cost(self):
        # Copilot tinh theo han muc, cost luôn 0 => ngan sach cost khong duoc binding.
        _budget(user=self.user, provider='copilot', dimension=AIBudget.DimensionChoices.COST,
                limit_value=Decimal('0.010000'))
        for _ in range(5):
            _usage(self.user, tokens=1000, provider='copilot', model='gpt-5')
        state = resolve_budget(user=self.user, provider='copilot', model='gpt-5')
        self.assertFalse(state['hard_exceeded'], 'cost budget khong duoc ap cho copilot')
        self.assertEqual(state['dimension'], 'cost')
        self.assertEqual(state['pct'], 0.0)

    def test_ac8_copilot_requests_budget_does_bind(self):
        _budget(user=self.user, provider='copilot', dimension=AIBudget.DimensionChoices.REQUESTS,
                limit_value=Decimal('5'))
        for _ in range(5):
            _usage(self.user, provider='copilot', model='gpt-5')
        state = resolve_budget(user=self.user, provider='copilot', model='gpt-5')
        self.assertEqual(state['dimension'], 'requests')
        self.assertTrue(state['hard_exceeded'])


class BudgetScopeIsolationTests(TestCase):
    """AC6 + AC7."""

    def setUp(self):
        self.u1 = User.objects.create_user(username='b-a1', password='p')
        self.u2 = User.objects.create_user(username='b-b1', password='p')
        self.t1 = CoreTenant.objects.create(
            owner_user=self.u1, tenant_code='b-t1', display_name='T1',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.t2 = CoreTenant.objects.create(
            owner_user=self.u2, tenant_code='b-t2', display_name='T2',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_ac6_tenant_a_usage_does_not_consume_tenant_b(self):
        _budget(tenant=self.t1, limit_value=Decimal('100'))
        _budget(tenant=self.t2, limit_value=Decimal('100'))
        _usage(self.u1, tokens=100)
        t1 = resolve_budget(user=self.u1, tenant=self.t1, model='gpt-4o-mini')
        t2 = resolve_budget(user=self.u2, tenant=self.t2, model='gpt-4o-mini')
        self.assertTrue(t1['hard_exceeded'])
        self.assertEqual(t2['used'], 0)
        self.assertFalse(t2['hard_exceeded'])
        self.assertEqual(t2['source'], 'tenant')

    def test_ac6_user_of_other_tenant_not_counted(self):
        _budget(tenant=self.t1, limit_value=Decimal('100'))
        _usage(self.u2, tokens=100)
        state = resolve_budget(user=self.u1, tenant=self.t1, model='gpt-4o-mini')
        self.assertEqual(state['used'], 0)
        self.assertFalse(state['hard_exceeded'])

    def test_ac7_model_without_budget_still_bounded_by_parent(self):
        _budget(user=self.u1, limit_value=Decimal('100'))
        _usage(self.u1, tokens=100)
        state = resolve_budget(user=self.u1, model='model-khong-co-budget')
        self.assertTrue(state['matched'])
        self.assertEqual(state['source'], 'user')
        self.assertTrue(state['hard_exceeded'])

    def test_ac7_model_budget_cannot_widen_parent(self):
        # Model budget 10000 token cho phep nhieu hon user budget 100.
        _budget(user=self.u1, limit_value=Decimal('100'))
        _budget(model='gpt-4o-mini', limit_value=Decimal('10000'))
        _usage(self.u1, tokens=150)
        state = resolve_budget(user=self.u1, model='gpt-4o-mini')
        self.assertEqual(state['source'], 'user')
        self.assertTrue(state['hard_exceeded'])


class BudgetPeriodTests(TestCase):
    """Ky: chi dem usage trong chu ky hien hanh."""

    def setUp(self):
        self.user = User.objects.create_user(username='b-per', password='p')

    def test_daily_ignores_yesterday(self):
        from datetime import timedelta

        _budget(user=self.user, period=AIBudget.PeriodChoices.DAILY, limit_value=Decimal('100'))
        old = _usage(self.user, tokens=100)
        AIUsageRecord.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=1),
        )
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertEqual(state['used'], 0)
        self.assertFalse(state['hard_exceeded'])

    def test_monthly_includes_earlier_this_month(self):
        from datetime import timedelta

        _budget(user=self.user, period=AIBudget.PeriodChoices.MONTHLY, limit_value=Decimal('100'))
        old = _usage(self.user, tokens=100)
        AIUsageRecord.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=3),
        )
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertTrue(state['hard_exceeded'])


class BudgetInactiveAndFallbackTests(TestCase):
    """AC9: migration khong backfill - khong co dong nao thi han vi hien tai."""

    def setUp(self):
        self.user = User.objects.create_user(username='b-none', password='p')

    def test_ac9_no_rows_returns_unmatched(self):
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertFalse(state['matched'])
        self.assertEqual(state['used'], 0)
        self.assertFalse(state['hard_exceeded'])
        self.assertFalse(state['soft_warning'])

    def test_inactive_row_ignored(self):
        _budget(user=self.user, limit_value=Decimal('1'), is_active=False)
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertFalse(state['matched'])

    def test_zero_limit_row_blocks_everything(self):
        _budget(user=self.user, limit_value=Decimal('0'))
        state = resolve_budget(user=self.user, model='gpt-4o-mini')
        self.assertTrue(state['hard_exceeded'])


class BudgetApiTests(TestCase):
    """AC3/AC4/AC5 tren POST /core/v1/advisory/refresh/FPT/."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='b-api', password='p')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user, tenant_code='b-api', display_name='API',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)
        today = timezone.localdate()
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
            api_calls_used=0, api_calls_limit=10, symbols_used=0, symbols_limit=-1,
            users_used=0, users_limit=-1, storage_mb_used=0, storage_mb_limit=-1,
        )

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_ac3_hard_returns_429_with_budget_object(self, mock_delay):
        _budget(user=self.user, limit_value=Decimal('100'))
        _usage(self.user, tokens=120)
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data.get('error_code'), 'ai_budget_exhausted')
        budget = response.data['budget']
        self.assertEqual(budget['used'], 120)
        self.assertEqual(budget['limit'], 100)
        self.assertEqual(budget['pct'], 120.0)
        self.assertEqual(budget['source'], 'user')
        self.assertFalse(mock_delay.called)

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_ac4_soft_returns_201_with_warning(self, mock_delay):
        _budget(user=self.user, limit_value=Decimal('100'))
        _usage(self.user, tokens=85)
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = unwrapped(response)
        self.assertTrue(body.get('budget_soft_warning'))
        self.assertEqual(body['budget']['pct'], 85.0)
        self.assertTrue(mock_delay.called)

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_ac5_api_reports_system_tier_when_only_system_row(self, mock_delay):
        _budget(limit_value=Decimal('100'))  # khong user/tenant/model -> system
        _usage(self.user, tokens=50)
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(unwrapped(response)['budget']['source'], 'system')

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_ac9_legacy_token_budget_still_works_without_aibudget_rows(self, mock_delay):
        # Khong co AIBudget nao -> han vi cu (AdvisorySession.tokens_used).
        today = timezone.localdate()
        AdvisorySession.objects.create(
            user=self.user, symbol='FPT', session_date=today,
            tokens_used=99999, token_budget=100,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data['budget_source'], 'system')