"""R0.7 (plan Rev.2): instrument AIUsageRecord + nightly rollup + helpers.

AC6: 1 lan chay generate_advisory_task (mock orchestrator) => AIUsageRecord
     >= 1 voi provider/model/tokens_in/tokens_out/latency_ms/status != 0/null.
     Truoc fix: 0 ban ghi (khong code nao ghi).
AC7: loi provider (mock raise) => record status='error' (luc can quan sat nhat).
AC8: rollup nightly chay 2 lan khong nhan doi (unique date/user/action).
AC9: usage lay tu prompt_tokens/completion_tokens that; thieu => 0 +
     usage_unavailable=True, KHONG bia.
AC10: cost tu bang gia neu co, nguoc lai 0 + pricing_available=False
     (hien chua co bang gia => nhanh 2).

TDD fail-before: AC6/AC7 ERROR 0 record; AC8 ERROR (task chua ton tai);
AC9/AC10 ERROR (helper chua ton tai).
"""
import os
import sys
from datetime import date
from unittest import mock

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django  # noqa: E402

django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.test import TestCase  # noqa: E402
from django.utils import timezone  # noqa: E402

from advisory.models import AdvisoryRecord  # noqa: E402
from advisory.tasks import generate_advisory_task  # noqa: E402
from ai_analytics.models import AIUsageRecord, AIUsageSummary  # noqa: E402
from ai_analytics.tasks import rollup_usage_daily  # noqa: E402
from advisory.orchestrator import _extract_usage, _resolve_cost  # noqa: E402


def _mock_ok(*args, **kwargs):
    return {
        'advisory_text': 'r07 mock advisory',
        'ai_model': 'gpt-4o-mini',
        'tokens_used': 150,
        'usage': {
            'prompt_tokens': 100,
            'completion_tokens': 50,
            'usage_unavailable': False,
        },
    }


class UsageInstrumentationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='r07-usage', password='x')
        self.record = AdvisoryRecord.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=timezone.localdate(),
            ai_model='gpt-4o-mini',
        )
        self.ctx = {'ai_provider': 'openai', 'ai_model': 'gpt-4o-mini'}

    def test_ac6_task_run_writes_usage_record(self):
        with mock.patch(
            'advisory.orchestrator.AdvisoryOrchestrator.run',
            side_effect=_mock_ok,
        ):
            generate_advisory_task(str(self.record.advisory_id), dict(self.ctx), 'FPT')
        rec = AIUsageRecord.objects.filter(
            user=self.user, action='advisory'
        ).first()
        self.assertIsNotNone(rec, 'task chay xong phai co >= 1 AIUsageRecord')
        self.assertEqual(rec.provider, 'openai')
        self.assertEqual(rec.model, 'gpt-4o-mini')
        self.assertTrue(rec.tokens_in > 0, rec.tokens_in)
        self.assertTrue(rec.tokens_out > 0, rec.tokens_out)
        self.assertTrue(rec.latency_ms > 0, rec.latency_ms)
        self.assertEqual(rec.status, 'success')

    def test_ac7_provider_error_still_writes_error_record(self):
        with mock.patch(
            'advisory.orchestrator.AdvisoryOrchestrator.run',
            side_effect=RuntimeError('provider down'),
        ):
            generate_advisory_task(str(self.record.advisory_id), dict(self.ctx), 'FPT')
        rec = AIUsageRecord.objects.filter(
            user=self.user, action='advisory'
        ).first()
        self.assertIsNotNone(rec, 'loi provider van phai ghi record')
        self.assertEqual(rec.status, 'error')


class NightlyRollupTests(TestCase):
    def test_ac8_rollup_twice_no_duplicates(self):
        user = User.objects.create_user(username='r07-rollup', password='x')
        today = date.today()
        AIUsageRecord.objects.create(
            user=user, action='advisory', provider='openai', model='m',
            tokens_in=100, tokens_out=50, latency_ms=10, status='success',
        )
        AIUsageRecord.objects.create(
            user=user, action='advisory', provider='openai', model='m',
            tokens_in=200, tokens_out=100, latency_ms=20, status='success',
        )
        rollup_usage_daily(today)
        rollup_usage_daily(today)
        rows = AIUsageSummary.objects.filter(
            date=today, user=user, action='advisory'
        )
        self.assertEqual(rows.count(), 1, 'chay 2 lan khong duoc nhan doi')
        row = rows.first()
        self.assertEqual(row.total_requests, 2)
        self.assertEqual(row.total_tokens_in, 300)
        self.assertEqual(row.total_tokens_out, 150)


class UsageHelperTests(TestCase):
    def test_ac9_usage_from_provider_tokens(self):
        tokens_in, tokens_out, unavailable = _extract_usage(
            {'prompt_tokens': 100, 'completion_tokens': 50}
        )
        self.assertEqual((tokens_in, tokens_out, unavailable), (100, 50, False))

    def test_ac9_missing_usage_flagged_not_fabricated(self):
        tokens_in, tokens_out, unavailable = _extract_usage({})
        self.assertEqual((tokens_in, tokens_out, unavailable), (0, 0, True))
        tokens_in, tokens_out, unavailable = _extract_usage(None)
        self.assertEqual((tokens_in, tokens_out, unavailable), (0, 0, True))

    def test_ac10_no_rate_table_returns_zero_cost(self):
        cost, pricing_available = _resolve_cost('openai', 'gpt-4o-mini', 150)
        self.assertEqual(cost, 0)
        self.assertFalse(pricing_available)
