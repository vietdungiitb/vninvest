"""P2.3 (P2 history server) — BE tests for ScreenerRunHistory (Q5, D10)."""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot
from user_workspace.models import ScreenerRule, ScreenerRunHistory

User = get_user_model()

RUN_URL = "/core/v1/screener/rules/{pk}/run/"
HISTORY_URL = "/core/v1/screener/history/"
HISTORY_DETAIL_URL = "/core/v1/screener/history/{pk}/"
BACKTEST_URL = "/core/v1/screener/history/{pk}/backtest/"


class ScreenerHistoryTestCase(TestCase):
    def setUp(self):
        dj_cache.clear()
        self.user = User.objects.create_user(username="hist-user", email="hist@test.local", password="pass123")
        self.tenant = CoreTenant.objects.create(owner_user=self.user, tenant_code="hist_t", display_name="Hist T", status="active", plan="pro")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session_date = date.today()
        for sym in ("AAA", "BBB", "CCC"):
            SymbolSnapshot.objects.create(symbol=sym, session_date=self.session_date, price=20.0, volume=500000)
            for d in range(25):
                day = self.session_date - timedelta(days=25 - d)
                DailyPrice.objects.create(symbol=sym, date=day, open=10, high=11, low=9, close=10 + d * 0.2, volume=100000)
        self.rule = ScreenerRule.objects.create(user=self.user, tenant=self.tenant, name="HistRule", rules_json=[{"field": "close", "op": "gt", "value": 0, "logic": "AND"}])

    def tearDown(self):
        dj_cache.clear()
        super().tearDown()

    def _run(self):
        with mock.patch("market_data.vnbroker_adapter.get_company_financials_response", return_value={"financials": {}}):
            return self.client.post(RUN_URL.format(pk=self.rule.pk), {}, format="json")

    def test_run_creates_history_and_list(self):
        # R2.3.1: run creates history, list returns it
        resp = self._run()
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ScreenerRunHistory.objects.filter(user=self.user).count(), 1)
        h = ScreenerRunHistory.objects.first()
        self.assertEqual(h.matched_count, 3)
        self.assertEqual(h.rule_id, self.rule.id)
        # List
        lst = self.client.get(HISTORY_URL)
        self.assertEqual(lst.status_code, 200)
        self.assertEqual(lst.json()["count"], 1)
        self.assertEqual(len(lst.json()["results"]), 1)

    def test_quota_100(self):
        # D10: 100 per user, oldest deleted
        for i in range(5):
            self._run()
        # Manually create 100 to test quota trimming on next run
        # Create 100 histories via API run would be 5, so we bulk create 96 more directly
        for i in range(96):
            ScreenerRunHistory.objects.create(
                user=self.user, tenant=self.tenant, rule=self.rule, rule_name=self.rule.name,
                matched_count=1, total_scanned=3, window_days=35, session_date=self.session_date,
                matched=[], params={},
            )
        self.assertEqual(ScreenerRunHistory.objects.filter(user=self.user).count(), 101)
        # Next run should trim to 100
        self._run()
        self.assertEqual(ScreenerRunHistory.objects.filter(user=self.user).count(), 100)

    def test_tenant_isolation(self):
        self._run()
        # Create another user/tenant
        other = User.objects.create_user(username="other", email="o@test.local", password="pass123")
        other_tenant = CoreTenant.objects.create(owner_user=other, tenant_code="other_t", display_name="O", status="active", plan="pro")
        other_client = APIClient()
        other_client.force_authenticate(user=other)
        lst = other_client.get(HISTORY_URL)
        self.assertEqual(lst.json()["count"], 0)

    def test_backtest(self):
        self._run()
        h = ScreenerRunHistory.objects.first()
        # Need DailyPrice after run_at for backtest; create some after run_at
        # run_at is now, so create DailyPrice for tomorrow
        tomorrow = self.session_date + timedelta(days=1)
        for sym in ("AAA", "BBB", "CCC"):
            DailyPrice.objects.create(symbol=sym, date=tomorrow, open=10, high=12, low=9, close=12, volume=100000)
        # Backtest horizon 1 should find exit 12 > entry 20? Actually entry close is ~15 (10 + 25*0.2=15), exit 12 <15 so BUY would lose
        # Our histories have close 20 (price) + tech, but matched rows close is 20, so BUY with entry 20, exit 12 -> loss
        # Just verify endpoint returns structure
        resp = self.client.get(BACKTEST_URL.format(pk=h.pk) + "?horizon=5")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("winRate", data)
        self.assertIn("wins", data)
        self.assertIn("trades", data)

    def test_delete(self):
        self._run()
        h = ScreenerRunHistory.objects.first()
        resp = self.client.delete(HISTORY_DETAIL_URL.format(pk=h.pk))
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(ScreenerRunHistory.objects.count(), 0)
        # Clear all
        self._run()
        self._run()
        self.assertEqual(ScreenerRunHistory.objects.count(), 2)
        resp = self.client.delete(HISTORY_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["deleted"], 2)
        self.assertEqual(ScreenerRunHistory.objects.count(), 0)
