"""P0.7 T5: tests for the user screener run/list/detail endpoints.

Covers R1.2-R1.4 (missing-facts metadata + staleness), R6.3 (inactive hidden
from list/detail but still runnable for template previews) and rule validation.
"""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.models import DailyPrice
from market_serving.models import SessionFacts, SymbolSnapshot
from user_workspace.models import ScreenerRule

User = get_user_model()

RUN_URL = "/core/v1/screener/rules/{pk}/run/"
LIST_URL = "/core/v1/screener/rules/"
DETAIL_URL = "/core/v1/screener/rules/{pk}/"

MOCK_FINANCIALS = {"financials": {}}


def make_history(symbol, session_date, base=10.0, days=25, step=0.5):
    for i in range(days):
        d = session_date - timedelta(days=days - i)
        close = base + i * step
        DailyPrice.objects.create(
            symbol=symbol,
            date=d,
            open=close - 0.2,
            high=close + 0.3,
            low=close - 0.4,
            close=close,
            volume=100000 + i * 1000,
        )


class ScreenerRuleRunTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="screener-run-user", email="run@test.local", password="pass123"
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code="screener_run_t",
            display_name="Screener Run T",
            status="active",
            plan="pro",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session_date = date.today()
        for sym in ("AAA", "BBB"):
            SymbolSnapshot.objects.create(symbol=sym, session_date=self.session_date, price=20.0, volume=500000)
            make_history(sym, self.session_date)
        # Facts only for AAA — BBB exercises the P0.1 else-branch.
        SessionFacts.objects.create(
            symbol="AAA",
            session_date=self.session_date,
            buy_strength=0.8,
            institutional_strength=0.7,
            whale_net_flow=1000000,
            total_buy_volume=8000,
            total_sell_volume=2000,
        )

    def _make_rule(self, **kw):
        params = {
            "user": self.user,
            "tenant": self.tenant,
            "name": "R",
            "rules_json": [{"field": "close", "op": "gt", "value": 5, "logic": "AND"}],
            "is_active": True,
        }
        params.update(kw)
        return ScreenerRule.objects.create(**params)

    def _post_run(self, rule):
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value=MOCK_FINANCIALS,
        ):
            return self.client.post(RUN_URL.format(pk=rule.pk), {}, format="json")

    def test_run_matches_and_metadata_fresh(self):
        rule = self._make_rule()
        resp = self._post_run(rule)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        # R1.4: legacy keys intact
        self.assertEqual(data["rule_id"], rule.pk)
        self.assertEqual(data["total_scanned"], 2)
        self.assertEqual(data["matched_count"], 2)
        # R1.3: fresh session metadata
        self.assertEqual(data["session_date"], self.session_date.isoformat())
        self.assertFalse(data["is_stale"])
        self.assertEqual(data["days_old"], 0)
        # R1.2: `close` present on every row -> nothing missing
        self.assertEqual(data["missing_fields"], [])
        self.assertEqual(data["missing_counts"], {})

    def test_run_no_source_field_reported_missing(self):
        rule = self._make_rule(
            rules_json=[{"field": "whale_trade_count", "op": "gt", "value": 0, "logic": "AND"}]
        )
        resp = self._post_run(rule)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        # never populated anywhere -> no match, but reported (R1.2)
        self.assertEqual(data["matched_count"], 0)
        self.assertEqual(data["missing_fields"], ["whale_trade_count"])
        self.assertEqual(data["missing_counts"], {"whale_trade_count": 2})

    def test_run_else_branch_zeros_match_normally(self):
        # BBB has no facts -> P0.1 zeros; whale_buy_pct 0 > -1 matches both.
        rule = self._make_rule(
            rules_json=[{"field": "whale_buy_pct", "op": "gt", "value": -1, "logic": "AND"}]
        )
        resp = self._post_run(rule)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        self.assertEqual(resp.json()["matched_count"], 2)

    def test_run_stale_session_flagged(self):
        old = self.session_date - timedelta(days=5)
        SymbolSnapshot.objects.all().delete()
        SessionFacts.objects.all().delete()
        DailyPrice.objects.all().delete()
        SymbolSnapshot.objects.create(symbol="AAA", session_date=old, price=20.0, volume=500000)
        make_history("AAA", old)
        rule = self._make_rule()
        resp = self._post_run(rule)
        self.assertEqual(resp.status_code, 200, resp.content[:500])
        data = resp.json()
        self.assertTrue(data["is_stale"])
        self.assertEqual(data["days_old"], 5)
        self.assertEqual(data["session_date"], old.isoformat())

    def test_list_hides_inactive_but_run_and_delete_allow_it(self):
        active = self._make_rule(name="Active")
        inactive = self._make_rule(name="Preview", is_active=False)
        listed = self.client.get(LIST_URL).json()
        names = [r["name"] for r in (listed if isinstance(listed, list) else listed.get("results", []))]
        self.assertIn("Active", names)
        self.assertNotIn("Preview", names)
        # R6.3: detail hides inactive...
        self.assertEqual(self.client.get(DETAIL_URL.format(pk=inactive.pk)).status_code, 404)
        self.assertEqual(self.client.get(DETAIL_URL.format(pk=active.pk)).status_code, 200)
        # ...but run still executes it (template preview flow, P0.4/P0.6 deviation)
        self.assertEqual(self._post_run(inactive).status_code, 200)
        # ...and cleanup path works
        self.assertEqual(
            self.client.delete(DETAIL_URL.format(pk=inactive.pk)).status_code, 204
        )

    def test_create_rule_validation_400(self):
        bad_field = self.client.post(
            LIST_URL,
            {"name": "Bad", "rules_json": [{"field": "nope", "op": "gt", "value": 1}]},
            format="json",
        )
        self.assertEqual(bad_field.status_code, 400)
        bad_value = self.client.post(
            LIST_URL,
            {"name": "Bad", "rules_json": [{"field": "close", "op": "gt", "value": "abc"}]},
            format="json",
        )
        self.assertEqual(bad_value.status_code, 400)
