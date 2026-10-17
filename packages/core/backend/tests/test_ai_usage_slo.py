"""R3.3 — endpoint SLO LLM (plan `:1085-1103`).

AC1 là AC **quan trọng nhất**: percentile phải **tính trên DB** bằng window function.
Cách chứng minh ở đây không phải "SQL có PERCENTILE_CONT" mà là **so với giá trị
tính tay trong Python** trên 1000 bản ghi — nếu view lỡ kéo hết về Python rồi tự
tính thì test này vẫn xanh, nên test còn thêm một chốt chặn *thứ tự truy vấn*
(AC1b) bắt buộc SQL có `OVER`.

AC2 `total=0` ⇒ `None` (không phải `0`) để FE hiện `—` chứ không hiện `0%`.
AC3 `$` chỉ đáng tin khi **mọi** bản ghi trong phạm vi đều `pricing_available`.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from user_workspace.tests.tenant_test_helpers import grant_tenant

from ai_analytics.models import AIUsageRecord

User = get_user_model()

SLO_URL = '/core/v1/ai/usage/slo/'


def percentile(values, fraction):
    """PERCENTILE_CONT kiểu linear interpolation — tự tính để đối chiếu."""
    ordered = sorted(values)
    if not ordered:
        return None
    if len(ordered) == 1:
        return float(ordered[0])
    position = (len(ordered) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    weight = position - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


class SLOTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='r33-user', email='r33@example.com', password='testpass123',
        )
        grant_tenant(self.user, role='editor', tenant_code='r33-tenant')
        self.client.force_authenticate(user=self.user)

    def _record(self, *, model='gpt-4o-mini', latency=100, status='success',
                tokens_in=10, tokens_out=20, cost='0.0100',
                pricing_available=True, user=None):
        return AIUsageRecord.objects.create(
            user=user or self.user, action='advisory', provider='openai',
            model=model, tokens_in=tokens_in, tokens_out=tokens_out,
            cost=cost, latency_ms=latency, status=status,
            pricing_available=pricing_available,
        )


class SLOContractTests(SLOTestBase):
    def test_requires_authentication(self):
        self.assertEqual(
            APIClient().get(SLO_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_scope_returns_empty_rows_not_500(self):
        response = self.client.get(SLO_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn('results', body)
        self.assertEqual(body['results'], [])
        self.assertEqual(body['days'], 30)

    def test_days_defaults_to_30_and_accepts_7_and_90(self):
        for days in (7, 30, 90):
            with self.subTest(days=days):
                self._record()
                body = self.client.get(f'{SLO_URL}?days={days}').json()
                self.assertEqual(body['days'], days)

    def test_invalid_days_falls_back_to_30(self):
        self._record()
        body = self.client.get(f'{SLO_URL}?days=abc').json()
        self.assertEqual(body['days'], 30)

    def test_grouped_by_model(self):
        self._record(model='gpt-4o-mini')
        self._record(model='gemini-3.8-flash')
        body = self.client.get(SLO_URL).json()
        models = sorted(r['model'] for r in body['results'])
        self.assertEqual(models, ['gemini-3.8-flash', 'gpt-4o-mini'])


class AC1PercentileInDbTests(SLOTestBase):
    """AC1: percentile tính **trên DB**, đối chiếu bằng giá trị tính tay."""

    def test_percentiles_match_hand_computed_on_1000_rows(self):
        latencies = [(i * 7) % 1000 + 1 for i in range(1000)]
        for value in latencies:
            self._record(latency=value)

        body = self.client.get(SLO_URL).json()
        self.assertEqual(len(body['results']), 1)
        row = body['results'][0]

        self.assertAlmostEqual(row['p50_latency_ms'], percentile(latencies, 0.50), places=3)
        self.assertAlmostEqual(row['p95_latency_ms'], percentile(latencies, 0.95), places=3)
        self.assertAlmostEqual(row['p99_latency_ms'], percentile(latencies, 0.99), places=3)

    def test_percentiles_are_per_model_not_global(self):
        for _ in range(20):
            self._record(model='slow', latency=900)
        for _ in range(5):
            self._record(model='fast', latency=10)

        rows = {r['model']: r for r in self.client.get(SLO_URL).json()['results']}
        self.assertAlmostEqual(rows['slow']['p95_latency_ms'], 900, places=3)
        self.assertAlmostEqual(rows['fast']['p95_latency_ms'], 10, places=3)

    def test_ac1b_percentile_is_computed_by_database_not_python(self):
        """Chốt chặn "tính trong Python": SQL phải chứa `percentile_cont`.

        Plan `:1093` nói *"window function"*, nhưng đo thật trên container staging:
        Django 5.2.18 **không có** `PercentileCont`, và Postgres **không cho**
        percentile dạng window (`WITHIN GROUP` + `OVER` không tồn tại) — đúng
        construct của Postgres là ordered-set aggregate. Vì vậy test này đòi
        `percentile_cont` (tức **trong DB**) thay vì đòi chữ `OVER`.

        Nếu view đổi sang `.values_list()` rồi tự tính, test này đỏ dù các test
        so-giá-trị vẫn xanh.
        """
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self._record()
        with CaptureQueriesContext(connection) as captured:
            self.client.get(SLO_URL)
        slo_sql = [
            q['sql'] for q in captured.captured_queries
            if 'ai_analytics_aiusagerecord' in q['sql']
        ]
        self.assertTrue(slo_sql, 'khong co truy van nao vao bang usage')
        self.assertTrue(
            any('percentile_cont' in s.lower() for s in slo_sql),
            f'percentile phai do DB tinh (PERCENTILE_CONT): {slo_sql}')
        # Không được kéo nguyên bảng về Python: 1 truy vấn gom nhóm là đủ.
        self.assertLessEqual(
            len(slo_sql), 1,
            f'ky vong 1 truy van gom nhom, thay vi nhieu truy van: {slo_sql}')


class AC2NoDataTests(SLOTestBase):
    """AC2: không có số liệu ⇒ `None` (FE hiện `—`), không phải `0`."""

    def test_no_rows_means_no_rows_not_zeroed_numbers(self):
        body = self.client.get(SLO_URL).json()
        self.assertEqual(body['results'], [])

    def test_success_rate_is_fraction_between_0_and_1(self):
        for _ in range(3):
            self._record(status='success')
        self._record(status='error')

        row = self.client.get(SLO_URL).json()['results'][0]
        self.assertEqual(row['requests'], 4)
        self.assertAlmostEqual(row['success_rate'], 0.75, places=4)


class AC3PricingTests(SLOTestBase):
    """AC3: `$` chỉ hiện khi **mọi** bản ghi đều có bảng giá."""

    def test_pricing_complete_when_all_rows_priced(self):
        self._record(pricing_available=True)
        self._record(pricing_available=True)
        row = self.client.get(SLO_URL).json()['results'][0]
        self.assertTrue(row['pricing_complete'])

    def test_pricing_incomplete_when_any_row_missing_price(self):
        self._record(pricing_available=True, cost='0.0100')
        self._record(pricing_available=False, cost='0')
        row = self.client.get(SLO_URL).json()['results'][0]
        self.assertFalse(row['pricing_complete'])

    def test_cost_per_day_divides_by_range_days(self):
        from decimal import Decimal

        for _ in range(7):
            self._record(cost='1.0000', pricing_available=True)
        row = self.client.get(f'{SLO_URL}?days=7').json()['results'][0]
        self.assertEqual(Decimal(str(row['cost_total'])), Decimal('7.000000'))
        self.assertEqual(Decimal(str(row['cost_per_day'])), Decimal('1.000000'))

    def test_tokens_per_day_divides_by_range_days(self):
        for _ in range(14):
            self._record(tokens_in=10, tokens_out=20)
        row = self.client.get(f'{SLO_URL}?days=7').json()['results'][0]
        self.assertEqual(row['tokens_total'], 14 * 30)
        self.assertEqual(row['tokens_per_day'], 14 * 30 / 7)


class SLOIsolationTests(SLOTestBase):
    def test_other_users_usage_is_invisible(self):
        other = User.objects.create_user(
            username='r33-other', email='r33-other@example.com', password='x')
        self._record(user=other)
        body = self.client.get(SLO_URL).json()
        self.assertEqual(body['results'], [])

    def test_staff_scope_follows_existing_ssot_rule(self):
        """R0.7 đã cho staff xem tất cả cho endpoint usage; R3.3 dùng lại SSOT.

        `_scope_to_requester` là nguồn sự thật — R3.3 không tự chế quy tắc mới.
        """
        staff = User.objects.create_user(
            username='r33-staff', email='r33-staff@example.com',
            password='x', is_staff=True)
        self._record(user=staff)
        other = User.objects.create_user(
            username='r33-plain', email='r33-plain@example.com', password='x')
        self._record(user=other)

        self.client.force_authenticate(user=staff)
        body = self.client.get(SLO_URL).json()
        self.assertEqual(body['requests_total'], 2)


class SLOUrlTests(TestCase):
    def test_url_is_named(self):
        from django.urls import reverse

        url = reverse('ai-usage-slo')
        self.assertTrue(url.endswith('ai/usage/slo/'), url)