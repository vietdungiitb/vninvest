"""P1.1 (P1.6 U1): server-side sort/paging contract tests.

Covers R1.1 (sort+meta), R1.2 (400s), R1.3 (legacy no-params shape).
"""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot
from user_workspace.models import ScreenerRule

User = get_user_model()

RUN_URL = "/core/v1/screener/rules/{pk}/run/"


class ScreenerScanParamsTestCase(TestCase):
    def setUp(self):
        dj_cache.clear()
        self.user = User.objects.create_user(
            username="screener-p1-user", email="p1@test.local", password="pass123"
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code="screener_p1_t",
            display_name="Screener P1 T",
            status="active",
            plan="pro",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session_date = date.today()
        # 12 symbols, distinct closes (10..21) and distinct momentum (step varies).
        for i in range(12):
            sym = f"P{i:02d}"
            price = 10.0 + i
            SymbolSnapshot.objects.create(
                symbol=sym, session_date=self.session_date, price=price, volume=500000
            )
            step = 0.5 + i * 0.1
            for d in range(25):
                day = self.session_date - timedelta(days=25 - d)
                close = price - 5.0 + d * step * 0.2
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
            name="All",
            rules_json=[{"field": "close", "op": "gt", "value": 0, "logic": "AND"}],
        )

    def _run(self, **params):
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        ):
            return self.client.post(RUN_URL.format(pk=self.rule.pk), params, format="json")

    def test_sort_close_asc_with_meta(self):
        resp = self._run(sort="close", order="asc", page=1, limit=10)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        self.assertEqual(data["matched_count"], 12)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["limit"], 10)
        self.assertEqual(data["pages"], 2)
        self.assertEqual(data["sort"], "close")
        self.assertEqual(data["order"], "asc")
        closes = [r["close"] for r in data["matched"]]
        self.assertEqual(len(closes), 10)
        self.assertEqual(closes, sorted(closes))
        self.assertEqual(data["matched"][0]["symbol"], "P00")

    def test_page_two_and_momentum_desc(self):
        resp = self._run(sort="momentum_20d_pct", order="desc", page=2, limit=10)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        self.assertEqual(len(data["matched"]), 2)  # 12 total, page 2 of 10
        vals = [r["momentum_20d_pct"] for r in data["matched"]]
        self.assertTrue(all(v is not None for v in vals))

    def test_invalid_params_400(self):
        for bad in (
            {"sort": "foo"},
            {"order": "sideways"},
            {"page": 0},
            {"page": "abc"},
            {"limit": 7},
            {"limit": 2001},
            {"include_ai": "maybe"},
            {"include_ai": 0, "sort": "ai_score"},
        ):
            resp = self._run(**bad)
            self.assertEqual(resp.status_code, 400, f"params={bad}: {resp.content[:300]}")

    def test_include_ai_zero_skips_advisory(self):
        resp = self._run(sort="close", order="asc", include_ai=0)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        self.assertEqual(data["matched_count"], 12)
        self.assertTrue(all(r["ai_advisory"] is None for r in data["matched"]))

    def test_legacy_no_params_shape(self):
        # R1.3: no params -> exact P0 shape (close desc, full list, no P1 meta).
        resp = self._run()
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        for k in ("page", "limit", "pages", "sort", "order"):
            self.assertNotIn(k, data)
        closes = [r["close"] for r in data["matched"]]
        self.assertEqual(len(closes), 12)
        self.assertEqual(closes, sorted(closes, reverse=True))
        # P0 keys still present
        for k in ("session_date", "is_stale", "days_old", "missing_fields", "missing_counts"):
            self.assertIn(k, data)
