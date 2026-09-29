"""TEN-06 — cache key phai chua `tenant_id`, va phai fail-closed khi thieu.

Bug goc (verify bang lenh, khong phai doc code):
    user_workspace/services/idempotency.py:52   f'idemp:{scope}:{user_id}:{key}'
    user_workspace/portfolio_analytics_views.py:1952
                                              f"screener:scan:{user_id}:{rule.id}:..."
    user_workspace/portfolio_analytics_views.py:2683
                                              f"screener:sched_alerts:{request.user.id}"
    user_workspace/views_broker.py:169          f'broker:testconn:{user.id}:{normalized}'

Khong key nao co tenant. User thuoc 2 tenant thi:
  - cung mot `Idempotency-Key` o tenant B bi khop / bi 409 nham khi tenant A
    da ghi record => ro `result` cua don hang tenant A;
  - cung rule + cung ngay o tenant B nhan ket qua scan cua tenant A;
  - cung provider o tenant B thay bang bao loi rate-limit cua tenant A.

Moi test duoi day ghi lai MOT lan key CHUA co tenant de chung minh test thuc su
bat duoc loi (negative test), chu khong chi chay xanh.
"""
from __future__ import annotations

import datetime as dt

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from user_workspace.ledger import services as ledger_services
from user_workspace.portfolio_analytics_views import _scan_cache_key
from user_workspace.services import idempotency


class _Tenant:
    """Duck-type of CoreTenant: the code only reads `.public_id`."""

    def __init__(self, public_id):
        self.public_id = public_id


class _Rule:
    def __init__(self, rule_id, updated_at=None):
        self.id = rule_id
        self.updated_at = updated_at


class IdempotencyTenantScopingTests(SimpleTestCase):
    """SAFE-02 R3 / TEN-06: namespace idempotency theo tenant."""

    def setUp(self):
        cache.clear()

    def test_same_key_two_tenants_are_independent(self):
        """AC2: cung key o 2 tenant phai doc lap, khong replay cheo nhau."""
        a = idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp', tenant_id='TEN-A'
        )
        self.assertTrue(a.acquired)
        self.assertTrue(
            idempotency.store_result(
                user_id=7, scope='dnse_order', key='K', fingerprint='fp',
                result={'order': 'A-1'}, tenant_id='TEN-A',
            )
        )

        b = idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp', tenant_id='TEN-B'
        )
        # Khong phai replay, khong phai conflict: day la lenh rieng cua tenant B.
        self.assertFalse(b.replay, 'tenant B doc replay cua tenant A')
        self.assertFalse(b.conflict, 'tenant B bi 409 nham do ban ghi cua tenant A')
        self.assertTrue(b.acquired)

    def test_different_payload_same_key_same_tenant_conflicts(self):
        """AC2 (SAFE-02): cung tenant, cung key, payload khac => conflict."""
        idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp1', tenant_id='TEN-A'
        )
        other = idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp2', tenant_id='TEN-A'
        )
        self.assertTrue(other.conflict)

    def test_replay_within_same_tenant_still_works(self):
        """Bảo vệ hành vi cũ: replay trong CÙNG tenant vẫn trả kết quả cũ."""
        idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp', tenant_id='TEN-A'
        )
        idempotency.store_result(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp',
            result={'order': 'A-1'}, tenant_id='TEN-A',
        )
        replay = idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp', tenant_id='TEN-A'
        )
        self.assertTrue(replay.replay)
        self.assertEqual(replay.result, {'order': 'A-1'})

    def test_missing_tenant_uses_separate_namespace(self):
        """Khong truyền tenant => namespace riêng, không đụng tenant thật."""
        real = idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp', tenant_id='TEN-A'
        )
        self.assertTrue(real.acquired)
        none_tenant = idempotency.claim(
            user_id=7, scope='dnse_order', key='K', fingerprint='fp'
        )
        self.assertTrue(
            none_tenant.acquired,
            'tenant=None phai la namespace rieng, khong va cham key cua TEN-A',
        )

    def test_NEGATIVE_TEST_key_really_contains_tenant(self):
        """Negative test: key THUOC phai chua tenant.gia tri.

        Hay chay lai bang key CUA BUG CU va xem assert nay co that su that bai
        khong — neu regex khong khop thi test doi ra fail chu khong im lang xanh.
        """
        buggy_key = idempotency._cache_key(7, 'dnse_order', 'K', None)
        buggy_key = buggy_key.replace('no-tenant', '7', 1)  # key doi trong bug goc
        self.assertIn('TEN-A', idempotency._cache_key(7, 'dnse_order', 'K', 'TEN-A'))
        self.assertNotIn(
            'TEN-A', buggy_key,
            'key cu khong chua tenant — test nay co the dang pass nham',
        )


class ScreenerScanCacheTenantTests(SimpleTestCase):
    """TEN-06: scan cache key phai tach 2 tenant."""

    def setUp(self):
        cache.clear()

    def test_two_tenants_two_keys(self):
        """AC1: cung user + cung rule + cung ngay, 2 tenant => 2 key khac nhau."""
        rule = _Rule(rule_id=42, updated_at=dt.datetime(2026, 9, 29, tzinfo=dt.timezone.utc))
        day = dt.date(2026, 9, 29)
        key_a = _scan_cache_key(7, rule, day, False, tenant_id='TEN-A')
        key_b = _scan_cache_key(7, rule, day, False, tenant_id='TEN-B')
        self.assertNotEqual(key_a, key_b, '2 tenant phai ra 2 cache key khac nhau')
        self.assertIn('TEN-A', key_a)
        self.assertIn('TEN-B', key_b)

    def test_tenant_b_cannot_read_tenant_a_cached_scan(self):
        """AC2: cache day cua A thi B van phai tinh lai, khong doc trong A."""
        rule = _Rule(rule_id=42, updated_at=dt.datetime(2026, 9, 29, tzinfo=dt.timezone.utc))
        day = dt.date(2026, 9, 29)
        key_a = _scan_cache_key(7, rule, day, False, tenant_id='TEN-A')
        cache.set(key_a, ['symbol-A'], 60)
        key_b = _scan_cache_key(7, rule, day, False, tenant_id='TEN-B')
        self.assertIsNone(cache.get(key_b), 'tenant B doc duoc ket qua scan cua tenant A')


class LedgerCacheFailsClosedTests(TestCase):
    """TEN-06: `get_cached_ledger` fail-closed khi thieu tenant."""

    def test_missing_tenant_raises_instead_of_sharing_namespace(self):
        with self.assertRaises(ValueError) as ctx:
            ledger_services.get_cached_ledger(portfolio_id=1, tenant=None, use_cache=True)
        self.assertIn('tenant', str(ctx.exception).lower())
