"""R1.5 (plan Rev.2): filter model/status nhat quan records + summary + aggregate.

AC1: ?model=X => aggregate.total_requests == so dong records da loc cung model=X.
AC2: ?status=error => summary chi co row error (can cot status o summary).
AC3: ?action=advisory loc ca 3 view (aggregate truoc fix bo qua).
AC4: 2 user: A khong thay so lieu B tren ca 3 endpoint.
AC5: summary co phan trang (?limit).

TDD fail-before: AC1/AC2/AC3-aggregate/AC5 do (bo qua param); AC4 xanh san.
"""
import os
import sys

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
from rest_framework.test import APIClient  # noqa: E402

from ai_analytics.models import AIUsageRecord, AIUsageSummary  # noqa: E402
from ai_analytics.tasks import rollup_usage_daily  # noqa: E402

RECORDS_URL = '/core/v1/ai/usage/'
SUMMARY_URL = '/core/v1/ai/usage/summary/'
AGGREGATE_URL = '/core/v1/ai/usage/aggregate/'


def _rec(user, action='advisory', model='gpt-4o-mini', status='success'):
    return AIUsageRecord.objects.create(
        user=user, action=action, provider='openai', model=model,
        tokens_in=10, tokens_out=5, latency_ms=100, status=status,
    )


class UsageFilterTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='r15-a', password='x')
        self.b = User.objects.create_user(username='r15-b', password='x')
        self.staff = User.objects.create_user(username='r15-staff', password='x', is_staff=True)
        _rec(self.a, 'advisory', 'gpt-4o-mini', 'success')
        _rec(self.a, 'advisory', 'gpt-4o-mini', 'success')
        _rec(self.a, 'advisory', 'gpt-4o-mini', 'success')
        _rec(self.a, 'chat', 'gpt-4o-mini', 'error')
        _rec(self.a, 'advisory', 'gemini-2.5-flash', 'success')
        _rec(self.b, 'advisory', 'gpt-4o-mini', 'success')
        _rec(self.b, 'advisory', 'gpt-4o-mini', 'success')
        rollup_usage_daily(timezone.localdate())

    def _get(self, user, url, params=None):
        client = APIClient()
        client.force_authenticate(user)
        return client.get(url, data=params or {})

    def test_ac1_model_filter_aggregate_matches_records(self):
        agg = self._get(self.a, AGGREGATE_URL, {'model': 'gpt-4o-mini'}).data
        rec = self._get(self.a, RECORDS_URL, {'model': 'gpt-4o-mini'}).data
        self.assertEqual(rec['total'], 4)
        self.assertEqual(agg['total_requests'], rec['total'])

    def test_ac2_status_filter_summary_only_error(self):
        data = self._get(self.a, SUMMARY_URL, {'status': 'error'}).data
        rows = data['results']
        self.assertGreater(len(rows), 0)
        for row in rows:
            self.assertEqual(row['status'], 'error')

    def test_ac3_action_filter_all_three_views(self):
        rec = self._get(self.a, RECORDS_URL, {'action': 'advisory'}).data
        self.assertEqual(rec['total'], 4)
        agg = self._get(self.a, AGGREGATE_URL, {'action': 'advisory'}).data
        self.assertEqual(agg['total_requests'], 4)
        summary = self._get(self.a, SUMMARY_URL, {'action': 'advisory'}).data
        for row in summary['results']:
            self.assertEqual(row['action'], 'advisory')

    def test_ac4_isolation_all_three_views(self):
        rec = self._get(self.a, RECORDS_URL).data
        self.assertEqual(rec['total'], 5)
        agg = self._get(self.a, AGGREGATE_URL).data
        self.assertEqual(agg['total_requests'], 5)
        rec_b = self._get(self.b, RECORDS_URL).data
        self.assertEqual(rec_b['total'], 2)
        rec_staff = self._get(self.staff, RECORDS_URL).data
        self.assertEqual(rec_staff['total'], 7)

    def test_ac5_summary_pagination(self):
        data = self._get(self.staff, SUMMARY_URL, {'limit': '1'}).data
        self.assertEqual(len(data['results']), 1)
