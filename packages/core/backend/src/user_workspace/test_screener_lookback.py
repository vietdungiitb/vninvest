"""P1.1 (P1.6 U3): dynamic lookback window tests.

Covers R3.1 (window per rule), R3.2 (matched arithmetic unchanged).
"""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot
from user_workspace.models import ScreenerRule
from user_workspace.screener_helpers import _lookback_calendar_days, _required_lookback_days

User = get_user_model()

RUN_URL = "/core/v1/screener/rules/{pk}/run/"


def cond(field):
    return {"field": field, "op": "gt", "value": -999999, "logic": "AND"}


class LookbackUnitTestCase(TestCase):
    def test_per_field_trading_days(self):
        self.assertEqual(_required_lookback_days([cond("rsi_14")]), 20)
        self.assertEqual(_required_lookback_days([cond("stochastic_k")]), 20)
        self.assertEqual(_required_lookback_days([cond("sma20")]), 25)
        self.assertEqual(_required_lookback_days([cond("mfi_14")]), 25)
        self.assertEqual(_required_lookback_days([cond("momentum_20d_pct")]), 22)
        self.assertEqual(_required_lookback_days([cond("macd_hist")]), 40)
        self.assertEqual(_required_lookback_days([cond("sma50")]), 55)
        self.assertEqual(_required_lookback_days([cond("range_position_pct")]), 55)
        # history-free fields stay small; truly unknown stay conservative
        self.assertEqual(_required_lookback_days([cond("whale_buy_pct")]), 25)
        self.assertEqual(_required_lookback_days([cond("pe_ratio")]), 25)
        self.assertEqual(_required_lookback_days([cond("nope")]), 55)
        # max wins; empty/None fall back
        self.assertEqual(_required_lookback_days([cond("rsi_14"), cond("sma50")]), 55)
        self.assertEqual(_required_lookback_days([]), 75)
        self.assertEqual(_required_lookback_days(None), 75)

    def test_calendar_clamp(self):
        self.assertEqual(_lookback_calendar_days(20), 35)
        self.assertEqual(_lookback_calendar_days(22), 38)
        self.assertEqual(_lookback_calendar_days(25), 43)
        self.assertEqual(_lookback_calendar_days(40), 65)
        self.assertEqual(_lookback_calendar_days(55), 88)
        self.assertEqual(_lookback_calendar_days(75), 90)
        self.assertEqual(_lookback_calendar_days(200), 90)


class LookbackRunTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="screener-p13-user", email="p13@test.local", password="pass123"
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code="screener_p13_t",
            display_name="Screener P13 T",
            status="active",
            plan="pro",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session_date = date.today()
        for sym in ("AAA", "BBB"):
            SymbolSnapshot.objects.create(
                symbol=sym, session_date=self.session_date, price=20.0, volume=500000
            )
            for d in range(30):
                day = self.session_date - timedelta(days=30 - d)
                close = 10.0 + d * 0.4
                DailyPrice.objects.create(
                    symbol=sym,
                    date=day,
                    open=close - 0.2,
                    high=close + 0.3,
                    low=close - 0.4,
                    close=close,
                    volume=100000,
                )

    def _run(self, rule):
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        ):
            return self.client.post(RUN_URL.format(pk=rule.pk), {}, format="json")

    def test_rsi_rule_uses_small_window_and_matches(self):
        rule = ScreenerRule.objects.create(
            user=self.user,
            tenant=self.tenant,
            name="RSI",
            rules_json=[{"field": "rsi_14", "op": "lt", "value": 100, "logic": "AND"}],
        )
        resp = self._run(rule)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        # 20 trading days -> 35 calendar days (D7 clamp floor)
        self.assertEqual(data["window_days"], 35)
        self.assertEqual(data["matched_count"], 2)
        # condition-field values fully populated (window suffices)
        self.assertTrue(all(r["rsi_14"] is not None for r in data["matched"]))
        # deterministic across runs (R3.2 arithmetic stability)
        resp2 = self._run(rule)
        self.assertEqual(
            [(r["symbol"], r["rsi_14"]) for r in resp2.json()["matched"]],
            [(r["symbol"], r["rsi_14"]) for r in data["matched"]],
        )

    def test_financials_batch_uses_cache_hits(self):
        # R3.3 evidence: ONE get_many serves the universe when the adapter
        # cache is warm (prod: adapter self-populates 12h entries on miss).
        # NOTE: the adapter fn is mocked here, so its internal cache.set never
        # runs — the warm entries are seeded explicitly to simulate prod state.
        from django.core.cache import cache as dj_cache

        for sym in ("CCC", "DDD"):
            SymbolSnapshot.objects.create(
                symbol=sym, session_date=self.session_date, price=20.0, volume=500000
            )
        rule = ScreenerRule.objects.create(
            user=self.user,
            tenant=self.tenant,
            name="Close2",
            rules_json=[{"field": "close", "op": "gt", "value": 0, "logic": "AND"}],
        )
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        ) as m:
            cold = self.client.post(RUN_URL.format(pk=rule.pk), {}, format="json")
            self.assertEqual(cold.status_code, 200)
            # cold: one adapter call per scanned symbol (4: AAA,BBB,CCC,DDD)
            self.assertEqual(m.call_count, 4)
        dj_cache.set_many(
            {
                f"stock_financials:{s}": {"symbol": s, "financials": {}, "note": "seeded"}
                for s in ("AAA", "BBB", "CCC", "DDD")
            },
            timeout=60,
        )
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        ) as m2:
            warm = self.client.post(RUN_URL.format(pk=rule.pk), {}, format="json")
            self.assertEqual(warm.status_code, 200)
            self.assertEqual(m2.call_count, 0)  # all 4 served from the batch
            self.assertEqual(
                [r["symbol"] for r in warm.json()["matched"]],
                [r["symbol"] for r in cold.json()["matched"]],
            )
        dj_cache.delete_many([f"stock_financials:{s}" for s in ("AAA", "BBB", "CCC", "DDD")])

    def test_sma50_rule_uses_large_window(self):
        rule = ScreenerRule.objects.create(
            user=self.user,
            tenant=self.tenant,
            name="SMA",
            rules_json=[{"field": "sma50", "op": "gt", "value": 0, "logic": "AND"}],
        )
        resp = self._run(rule)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        # 55 trading days -> 88 calendar days
        self.assertEqual(resp.json()["window_days"], 88)
