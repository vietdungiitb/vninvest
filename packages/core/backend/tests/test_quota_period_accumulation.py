"""Quota phai TICH LUY theo THANG, khong phai so bo dem ngay voi han muc thang.

Loi goc (3 tang, cung mot nguyen nhan: nham don vi):
1. `middleware` so `used_calls` (bo dem **ngay**) voi `api_calls_limit` —
   field do gan `verbose_name='API calls monthly limit'`. Effective ~30x len.
2. `flush_quota_counters` doc khoa bo dem **ngay** roi ghi vao `QuotaRecord`
   co `period_start/period_end` la **thang** => `api_calls_used` chi luu gia
   tri cua mot ngay, va la `=` (ghi de) chu khong phai `+=`.
3. `REDIS_KEY_TTL_SECONDS = 86400 * 2` (48h) => KHONG the cong don 30 ngay tu
   Redis. Bat buoc bo dem thang rieng.

Dotted path: `tests.test_quota_period_accumulation`
"""

from datetime import date

from django.core.cache import cache
from django.test import TestCase

from commercial.quota_period import (
    current_billing_period,
    month_counter_key,
    month_counter_ttl,
    period_slug,
)
from identity_access.middleware import TenantQuotaMiddleware


class QuotaPeriodSSOTTests(TestCase):
    def test_period_is_the_whole_calendar_month(self):
        start, end = current_billing_period(date(2026, 9, 27))
        self.assertEqual(start, date(2026, 9, 1))
        self.assertEqual(end, date(2026, 9, 30))

    def test_period_handles_31_day_and_february(self):
        for day, want_end in [
            (date(2026, 1, 15), date(2026, 1, 31)),
            (date(2026, 2, 10), date(2026, 2, 28)),
            (date(2028, 2, 10), date(2028, 2, 29)),  # nam nhuan
            (date(2026, 12, 31), date(2026, 12, 31)),
        ]:
            self.assertEqual(current_billing_period(day)[1], want_end, f'ngay {day}')

    def test_period_covers_every_day_of_the_month(self):
        for day in (1, 15, 28, 30):
            d = date(2026, 9, day)  # thang 9 co 30 ngay
            start, end = current_billing_period(d)
            self.assertLessEqual(start, d)
            self.assertGreaterEqual(end, d)

    def test_slug_and_key_shape(self):
        self.assertEqual(period_slug(date(2026, 9, 27)), '2026-09')
        self.assertEqual(
            month_counter_key('tnt_abc', date(2026, 9, 27)),
            'quota:api_calls:month:tnt_abc:2026-09',
        )

    def test_monthly_ttl_outlives_the_daily_counter(self):
        """TTL 48h khong du cho ca thang — bo dem thang phai song dai hon."""
        from commercial.quota_period import PERIOD_TTL_BUFFER_DAYS

        daily = TenantQuotaMiddleware.REDIS_KEY_TTL_SECONDS
        monthly = month_counter_ttl(date(2026, 9, 1))
        self.assertGreater(monthly, daily, 'TTL thang phai > 48h')
        # Ngay 1/9: con 29 ngay den 30/9, + buffer.
        _, period_end = current_billing_period(date(2026, 9, 1))
        self.assertEqual(
            monthly // 86400,
            (period_end - date(2026, 9, 1)).days + PERIOD_TTL_BUFFER_DAYS,
        )
        # Ngay 30/9 (ngay cuoi): chi con buffer, van > 0 de flush doc duoc.
        self.assertEqual(
            month_counter_ttl(date(2026, 9, 30)) // 86400, PERIOD_TTL_BUFFER_DAYS
        )


class MonthlyCounterAccumulationTests(TestCase):
    """`api_calls_used` phai TANG DAN trong thang, khong ghi de."""

    def setUp(self):
        cache.clear()
        self.mw = TenantQuotaMiddleware(lambda request: None)
        self.tenant_id = 'tnt_quota_test'
        self.today = date(2026, 9, 27)
        self.key = month_counter_key(self.tenant_id, self.today)

    def tearDown(self):
        cache.clear()

    def test_counter_increments_across_separate_invocations(self):
        seen = [self.mw._increment_monthly_counter(self.tenant_id) for _ in range(5)]
        self.assertEqual(seen, [1, 2, 3, 4, 5], 'phai tich luy, khong phai luon tra 1')
        self.assertEqual(cache.get(self.key), 5)

    def test_separate_tenants_do_not_share_a_counter(self):
        self.mw._increment_monthly_counter('tnt_a')
        self.mw._increment_monthly_counter('tnt_b')
        self.assertEqual(cache.get(month_counter_key('tnt_a', self.today)), 1)
        self.assertEqual(cache.get(month_counter_key('tnt_b', self.today)), 1)

    def test_new_month_starts_a_fresh_counter(self):
        old_key = month_counter_key(self.tenant_id, date(2026, 8, 31))
        new_key = month_counter_key(self.tenant_id, date(2026, 9, 1))
        self.assertNotEqual(old_key, new_key, 'khac ky phai khac khoa')

    def test_daily_and_monthly_counters_are_independent_keys(self):
        """Bo dem ngay phai con nguyen cho analytics, va KHONG trung khoa thang."""
        day_key = TenantQuotaMiddleware._build_counter_key(self.tenant_id, self.today)
        self.mw._increment_daily_counter(self.tenant_id)
        self.mw._increment_monthly_counter(self.tenant_id)
        self.assertNotEqual(day_key, self.key)
        self.assertEqual(cache.get(day_key), 1)
        self.assertEqual(cache.get(self.key), 1)

    def test_counter_recovers_if_key_vanishes(self):
        self.mw._increment_monthly_counter(self.tenant_id)
        cache.delete(self.key)
        # Redis flush / het TTL giua chung: phai khoi tao lai duoc, khong nem.
        self.assertEqual(self.mw._increment_monthly_counter(self.tenant_id), 1)


class QuotaTenantIdExtractionTests(TestCase):
    """Mot extractor duoc dung cho ca khoa ngay va khoa thang — bang chung da verify."""

    def test_extracts_tenant_id_from_daily_key(self):
        from commercial.tasks import _extract_tenant_id_from_key
        self.assertEqual(
            _extract_tenant_id_from_key('quota:api_calls:tnt_abc:2026-09-27'),
            'tnt_abc',
        )

    def test_extracts_tenant_id_from_month_key(self):
        """`parts[-2]` cua khoa 5 phan roi dung vao tenant (index 3)."""
        from commercial.tasks import _extract_tenant_id_from_key
        self.assertEqual(
            _extract_tenant_id_from_key('quota:api_calls:month:tnt_abc:2026-09'),
            'tnt_abc',
        )

    def test_rejects_too_short_and_empty_keys(self):
        from commercial.tasks import _extract_tenant_id_from_key
        self.assertIsNone(_extract_tenant_id_from_key('quota:api_calls'))
        self.assertIsNone(_extract_tenant_id_from_key(''))


class QuotaScanPatternTests(TestCase):
    """Glob quet phai khop khoa THANG va khong khop khoa NGAY."""

    def test_pattern_matches_month_keys_only(self):
        from fnmatch import fnmatch

        from commercial.quota_period import month_counter_scan_pattern

        day = date(2026, 9, 27)
        pattern = month_counter_scan_pattern(day)
        self.assertTrue(fnmatch('quota:api_calls:month:tnt_abc:2026-09', pattern))
        self.assertFalse(fnmatch('quota:api_calls:tnt_abc:2026-09-27', pattern))
        self.assertFalse(fnmatch('quota:api_calls:month:tnt_abc:2026-08', pattern))
        self.assertFalse(fnmatch('quota:api_calls:month:tnt_abc:2026-09-27', pattern))

    def test_pattern_for_single_tenant(self):
        from fnmatch import fnmatch

        from commercial.quota_period import month_counter_scan_pattern_for

        day = date(2026, 9, 27)
        pattern = month_counter_scan_pattern_for('tnt_abc', day)
        self.assertTrue(fnmatch('quota:api_calls:month:tnt_abc:2026-09', pattern))
        self.assertFalse(fnmatch('quota:api_calls:month:tnt_xyz:2026-09', pattern))


class QuotaUnitConsistencyTests(TestCase):
    """Khong duoc con noi nao noi 'ngay' khi field la thang."""

    def test_limit_field_is_declared_monthly(self):
        from identity_access.models import CoreTenant
        self.assertIn('monthly', CoreTenant._meta.get_field('api_calls_limit').verbose_name.lower())

    def test_429_message_says_month_not_day(self):
        import inspect
        from identity_access import middleware as mw
        src = inspect.getsource(mw.TenantQuotaMiddleware.__call__)
        self.assertIn('trong tháng', src)
        self.assertNotIn('trong ngày', src)

    def test_quota_record_period_columns_exist(self):
        from commercial.models import QuotaRecord
        names = {f.name for f in QuotaRecord._meta.get_fields()}
        self.assertIn('period_start', names)
        self.assertIn('period_end', names)
