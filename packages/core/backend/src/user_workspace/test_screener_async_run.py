"""P1.4 (P1.6 U4): async run + status + pending cap + snapshot.

Covers R4.1 (202 + completed eager), R4.2 (?async=1), R4.3 (429 cap), R4.4 (snapshot).
"""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot
from user_workspace.models import ScreenerRule
from user_workspace.tests.envelope import unwrapped_json

User = get_user_model()

RUN_URL = "/core/v1/screener/rules/{pk}/run/"
STATUS_URL = "/core/v1/screener/rules/{pk}/run/status/"


class ScreenerAsyncRunTestCase(TestCase):
    def setUp(self):
        dj_cache.clear()
        self.user = User.objects.create_user(
            username="screener-async-user", email="async@test.local", password="pass123"
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code="screener_async_t",
            display_name="Screener Async T",
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
            name="AsyncRule",
            rules_json=[{"field": "close", "op": "gt", "value": 0, "logic": "AND"}],
        )

    def tearDown(self):
        dj_cache.clear()
        super().tearDown()

    def _mock_fin(self):
        return mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        )

    @override_settings(SCREENER_SYNC_SYMBOL_LIMIT=1)
    def test_large_universe_returns_202_and_status_completed(self):
        # R4.1: universe 3 > limit 1 → 202 + job_id, GET status → completed (eager)
        with self._mock_fin():
            resp = self.client.post(RUN_URL.format(pk=self.rule.pk), {}, format="json")
        self.assertEqual(resp.status_code, 202, resp.content[:800])
        data = unwrapped_json(resp)
        self.assertEqual(data["status"], "queued")
        job_id = data["job_id"]
        self.assertTrue(job_id)
        self.assertIn("poll_url", data)
        # Eager task already completed
        with self._mock_fin():
            status = self.client.get(STATUS_URL.format(pk=self.rule.pk) + f"?job_id={job_id}")
        self.assertEqual(status.status_code, 200)
        sj = unwrapped_json(status)
        self.assertEqual(sj["status"], "completed")
        self.assertEqual(sj["result_meta"]["matched_count"], 3)
        self.assertEqual(sj["result_meta"]["total_scanned"], 3)
        # Subsequent sync should hit cache (0 adapter calls)
        with mock.patch(
            "market_data.vnbroker_adapter.get_company_financials_response",
            return_value={"financials": {}},
        ) as m:
            resp2 = self.client.post(RUN_URL.format(pk=self.rule.pk), {}, format="json")
            # Now cache hit → sync 200, not 202 (universe still 3 but cache hit forces sync)
            self.assertEqual(resp2.status_code, 200)
            self.assertEqual(m.call_count, 0)

    def test_force_async_via_query_param(self):
        # R4.2: ?async=1 forces 202 even for small universe (default limit 800)
        with self._mock_fin():
            resp = self.client.post(RUN_URL.format(pk=self.rule.pk) + "?async=1", {}, format="json")
        self.assertEqual(resp.status_code, 202, resp.content[:500])
        job_id = unwrapped_json(resp)["job_id"]
        with self._mock_fin():
            status = self.client.get(STATUS_URL.format(pk=self.rule.pk) + f"?job_id={job_id}")
        self.assertEqual(unwrapped_json(status)["status"], "completed")

    def test_pending_cap_returns_429(self):
        # R4.3: 3 pending → 4th → 429
        from user_workspace.portfolio_analytics_views import _screener_jobs_set_key

        dj_cache.set(_screener_jobs_set_key(self.user.id), {"j1", "j2", "j3"}, timeout=3600)
        with self._mock_fin():
            resp = self.client.post(RUN_URL.format(pk=self.rule.pk) + "?async=1", {}, format="json")
        self.assertEqual(resp.status_code, 429, resp.content[:500])
        self.assertIn("retry_after", resp.json())

    def test_snapshot_not_drift_on_rule_edit(self):
        # R4.4: task uses snapshot, not current DB rule
        # Rule initially matches all (close>0 → 3), then edit to close>9999 → 0, but job's result_meta should stay 3
        with self._mock_fin():
            resp = self.client.post(RUN_URL.format(pk=self.rule.pk) + "?async=1", {}, format="json")
        self.assertEqual(resp.status_code, 202)
        job_id = unwrapped_json(resp)["job_id"]
        # Edit rule immediately after queue (in eager mode task already ran with snapshot, but we simulate drift check)
        # Force updated_at far future
        future = timezone.now() + timedelta(seconds=10)
        ScreenerRule.objects.filter(pk=self.rule.pk).update(
            rules_json=[{"field": "close", "op": "gt", "value": 999999, "logic": "AND"}],
            updated_at=future,
        )
        # Status should still reflect snapshot's matched_count 3, not 0
        with self._mock_fin():
            status = self.client.get(STATUS_URL.format(pk=self.rule.pk) + f"?job_id={job_id}")
        self.assertEqual(status.status_code, 200)
        sj = unwrapped_json(status)
        self.assertEqual(sj["status"], "completed")
        self.assertEqual(sj["result_meta"]["matched_count"], 3)
        # New sync run with edited rule should miss cache (new updated_at) and return 0
        with self._mock_fin():
            resp2 = self.client.post(RUN_URL.format(pk=self.rule.pk), {}, format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(unwrapped_json(resp2)["matched_count"], 0)

    def test_status_unknown_for_missing_job(self):
        # F-SEC-11: job_id is now validated as 32-char hex; use a hex that was never queued
        resp = self.client.get(STATUS_URL.format(pk=self.rule.pk) + "?job_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)["status"], "unknown")

    def test_status_invalid_job_id_format(self):
        resp = self.client.get(STATUS_URL.format(pk=self.rule.pk) + "?job_id=not-hex!!!")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("job_id", resp.json()["detail"])

    def test_throttle_rate_limit(self):
        # R5.1: override rate 3/min → 4th request → 429 (F-BE-04: throttle now uses get_rate())
        from django.core.cache import cache as throttle_cache

        from user_workspace.portfolio_analytics_views import ScreenerRunThrottle

        throttle_cache.clear()
        dj_cache.clear()
        # Create fresh rule to avoid cache hit bypassing throttle? Throttle runs before cache check, so still counts.
        # Patch get_rate to 3/min for this test (F-BE-04: rate is now dynamic via settings)
        with mock.patch.object(ScreenerRunThrottle, "get_rate", return_value="3/min"):
            # Need to clear throttle cache between tests — DRF stores in cache with key throttle_*
            # Use same client, 4 rapid posts
            for i in range(3):
                with self._mock_fin():
                    r = self.client.post(RUN_URL.format(pk=self.rule.pk), {}, format="json")
                # First 3 may be 200 or 202 depending on async? With default limit 800, universe 3 <800 → 200
                self.assertIn(r.status_code, (200, 202), f"iter {i}: {r.content[:300]}")
            with self._mock_fin():
                r4 = self.client.post(RUN_URL.format(pk=self.rule.pk), {}, format="json")
            self.assertEqual(r4.status_code, 429, r4.content[:500])
        throttle_cache.clear()
        dj_cache.clear()
