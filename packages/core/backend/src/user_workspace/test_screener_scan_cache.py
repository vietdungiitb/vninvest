"""P1.2 (P1.6 U2): scan result cache (Option B Entry 76).

Covers R2.1 (hit→0 adapter calls), R2.2 (rule edit→new key), R2.3 (new session→recompute),
plus Option B (different sort hits same cache) and include_ai separation.
"""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot
from user_workspace.models import ScreenerRule
from user_workspace.screener_helpers import build_scan_cache_value

User = get_user_model()

RUN_URL = "/core/v1/screener/rules/{pk}/run/"


class ScreenerScanCacheTestCase(TestCase):
    def setUp(self):
        dj_cache.clear()
        self.user = User.objects.create_user(
            username="screener-cache-user", email="cache@test.local", password="pass123"
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code="screener_cache_t",
            display_name="Screener Cache T",
            status="active",
            plan="pro",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session_date = date.today()
        for sym in ("AAA", "BBB", "CCC"):
            SymbolSnapshot.objects.create(
                symbol=sym, session_date=self.session_date, price=20.0, volume=500000
            )
            for d in range(25):
                day = self.session_date - timedelta(days=25 - d)
                close = 10.0 + d * 0.5
                DailyPrice.objects.create(
                    symbol=sym,
                    date=day,
                    open=close - 0.2,
                    high=close + 0.3,
                    low=close - 0.4,
                    close=close,
                    volume=100000,
                )
        self.rule = ScreenerRule.objects.create(
            user=self.user,
            tenant=self.tenant,
            name="CacheRule",
            rules_json=[{"field": "close", "op": "gt", "value": 0, "logic": "AND"}],
        )

    def tearDown(self):
        dj_cache.clear()
        super().tearDown()

    def _post(self, rule, params=None):
        params = params or {}
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        ) as m:
            resp = self.client.post(RUN_URL.format(pk=rule.pk), params, format="json")
            return resp, m

    def test_miss_then_hit_zero_adapter_calls(self):
        # R2.1: first run miss → adapter calls per symbol, second hit → 0 calls
        dj_cache.clear()
        resp1, m1 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(resp1.status_code, 200, resp1.content[:500])
        self.assertEqual(m1.call_count, 3)  # AAA,BBB,CCC
        data1 = resp1.json()
        self.assertEqual(data1["matched_count"], 3)

        # Hit: same params → 0 adapter calls, same matched_count
        resp2, m2 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(m2.call_count, 0)
        self.assertEqual(resp2.json()["matched_count"], data1["matched_count"])
        self.assertEqual(
            [r["symbol"] for r in resp2.json()["matched"]],
            [r["symbol"] for r in data1["matched"]],
        )

    def test_different_sort_hits_same_cache_option_b(self):
        # Option B Entry 76: sort/order NOT in cache key → different sort reuses cache
        dj_cache.clear()
        resp1, m1 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(m1.call_count, 3)
        # Different sort, same rule/session/include_ai → should be cache hit (0 calls)
        resp2, m2 = self._post(self.rule, {"sort": "close", "order": "desc", "page": 1, "limit": 10})
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(m2.call_count, 0, "Option B: different sort should hit same cache entry")
        # But order differs (sorted post-cache)
        asc_syms = [r["symbol"] for r in resp1.json()["matched"]]
        desc_syms = [r["symbol"] for r in resp2.json()["matched"]]
        # With distinct closes? Our fixture AAA/BBB/CCC have same price 20, so close equal → order stable but we test meta sort field
        self.assertEqual(resp2.json()["sort"], "close")
        self.assertEqual(resp2.json()["order"], "desc")
        # If prices equal, asc==desc is ok; verify at least cache was used (0 calls)

    def test_include_ai_separates_cache(self):
        dj_cache.clear()
        resp1, m1 = self._post(self.rule, {"sort": "close", "order": "asc", "include_ai": 1, "page": 1, "limit": 10})
        self.assertEqual(m1.call_count, 3)
        # include_ai=0 → different cache entry → miss (calls again)
        resp2, m2 = self._post(self.rule, {"sort": "close", "order": "asc", "include_ai": 0, "page": 1, "limit": 10})
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(m2.call_count, 3)
        self.assertTrue(all(r["ai_advisory"] is None for r in resp2.json()["matched"]))
        # include_ai=0 again → hit
        resp3, m3 = self._post(self.rule, {"sort": "close", "order": "asc", "include_ai": 0, "page": 1, "limit": 10})
        self.assertEqual(m3.call_count, 0)

    def test_rule_edit_invalidates_cache(self):
        dj_cache.clear()
        resp1, m1 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(m1.call_count, 3)
        # Edit rule → updated_at changes → new cache key → miss
        # Force updated_at far future to avoid same-second collision
        future = timezone.now() + timedelta(seconds=10)
        ScreenerRule.objects.filter(pk=self.rule.pk).update(
            rules_json=[{"field": "close", "op": "gt", "value": 999999, "logic": "AND"}],
            updated_at=future,
        )
        self.rule.refresh_from_db()
        resp2, m2 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(m2.call_count, 3, "rule edit should miss cache")
        # New rule filters out all → matched_count 0, proving not stale cache
        self.assertEqual(resp2.json()["matched_count"], 0)

    def test_new_session_recomputes(self):
        dj_cache.clear()
        resp1, m1 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(m1.call_count, 3)
        self.assertEqual(resp1.json()["matched_count"], 3)
        # New session_date → cache key includes session_date → miss
        new_date = self.session_date + timedelta(days=1)
        for sym in ("AAA", "BBB", "CCC"):
            SymbolSnapshot.objects.create(
                symbol=sym, session_date=new_date, price=25.0, volume=600000
            )
        resp2, m2 = self._post(self.rule, {"sort": "close", "order": "asc", "page": 1, "limit": 10})
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(m2.call_count, 3)
        self.assertEqual(resp2.json()["session_date"], new_date.isoformat())


class ScanCacheGuardTestCase(TestCase):
    """F-BE-06: oversized scan payloads truncate to top-N with explicit flags."""

    def test_small_result_not_truncated(self):
        rows = [{"symbol": "AAA", "close": 20.0, "ai_advisory": {"ai_score_0_100": 80}}]
        value = build_scan_cache_value(rows, 1, {})
        self.assertFalse(value["truncated"])
        self.assertNotIn("total_matched", value)
        self.assertEqual(value["matched"], rows)

    def test_oversized_result_truncates_to_top_n_by_ai_score(self):
        rows = [
            {
                "symbol": f"S{i:04d}",
                "close": float(i),
                "note": "x" * 2000,  # inflate payload past the byte cap
                "ai_advisory": {"ai_score_0_100": i},
            }
            for i in range(30)
        ]
        value = build_scan_cache_value(rows, 30, {}, max_bytes=10_000, max_rows=5)
        self.assertTrue(value["truncated"])
        self.assertEqual(value["total_matched"], 30)
        self.assertEqual(len(value["matched"]), 5)
        # Top-5 by ai_score desc
        self.assertEqual(
            [r["symbol"] for r in value["matched"]],
            ["S0029", "S0028", "S0027", "S0026", "S0025"],
        )
