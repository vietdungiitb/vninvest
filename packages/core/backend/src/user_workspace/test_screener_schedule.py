"""P2.4 (screener schedules) — BE tests for ScreenerSchedule CRUD + run-now + beat (Q6, D11)."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.tests.envelope import unwrapped_json
from user_workspace.models import ScreenerRule, ScreenerSchedule

User = get_user_model()

SCHED_URL = "/core/v1/screener/schedules/"
SCHED_DETAIL_URL = "/core/v1/screener/schedules/{pk}/"
RUN_NOW_URL = "/core/v1/screener/schedules/{pk}/run-now/"
ALERTS_URL = "/core/v1/screener/schedules/alerts/"


class ScreenerScheduleTestCase(TestCase):
    def setUp(self):
        dj_cache.clear()
        self.user = User.objects.create_user(username="sched-user", email="sched@test.local", password="pass123")
        self.tenant = CoreTenant.objects.create(owner_user=self.user, tenant_code="sched_t", display_name="Sched T", status="active", plan="pro")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.rule = ScreenerRule.objects.create(user=self.user, tenant=self.tenant, name="SchedRule", rules_json=[{"field": "close", "op": "gt", "value": 0, "logic": "AND"}])

    def tearDown(self):
        dj_cache.clear()
        super().tearDown()

    def _payload(self, **kw):
        d = {"name": "Evening", "rule_ids": [self.rule.id], "run_time": "18:00", "weekdays": [0, 1, 2, 3, 4], "notify_channels": ["in_app"]}
        d.update(kw)
        return d

    def test_crud(self):
        # Create
        resp = self.client.post(SCHED_URL, self._payload(), format="json")
        self.assertEqual(resp.status_code, 201, resp.content[:500])
        sid = unwrapped_json(resp)["id"]
        self.assertIsNotNone(unwrapped_json(resp)["next_run_at"])
        # List
        lst = self.client.get(SCHED_URL)
        self.assertEqual(lst.status_code, 200)
        items = unwrapped_json(lst)
        if not isinstance(items, list):
            items = items["results"]
        self.assertEqual(items[0]["id"], sid)
        # Detail
        det = self.client.get(SCHED_DETAIL_URL.format(pk=sid))
        self.assertEqual(det.status_code, 200)
        self.assertEqual(unwrapped_json(det)["name"], "Evening")
        # Update (toggle off)
        upd = self.client.put(SCHED_DETAIL_URL.format(pk=sid), {"is_active": False}, format="json")
        self.assertEqual(upd.status_code, 200)
        self.assertFalse(unwrapped_json(upd)["is_active"])
        # Delete
        dele = self.client.delete(SCHED_DETAIL_URL.format(pk=sid))
        self.assertEqual(dele.status_code, 204)
        self.assertEqual(ScreenerSchedule.objects.count(), 0)

    def test_create_invalid(self):
        # Unknown rule
        resp = self.client.post(SCHED_URL, self._payload(rule_ids=[999999]), format="json")
        self.assertEqual(resp.status_code, 400)
        # Bad time
        resp = self.client.post(SCHED_URL, self._payload(run_time="99:99"), format="json")
        self.assertEqual(resp.status_code, 400)
        # Bad weekdays
        resp = self.client.post(SCHED_URL, self._payload(weekdays=[7]), format="json")
        self.assertEqual(resp.status_code, 400)

    def test_run_now_enqueues(self):
        resp = self.client.post(SCHED_URL, self._payload(), format="json")
        sid = unwrapped_json(resp)["id"]
        with mock.patch("market_data.vnbroker_adapter.get_company_financials_response", return_value={"financials": {}}):
            run = self.client.post(RUN_NOW_URL.format(pk=sid), {}, format="json")
        self.assertEqual(run.status_code, 200, run.content[:500])
        self.assertEqual(len(unwrapped_json(run)["jobs"]), 1)
        self.assertEqual(unwrapped_json(run)["jobs"][0]["rule_id"], self.rule.id)

    def test_email_channel_sends_on_new_symbols(self):
        from datetime import date, timedelta

        from django.core import mail
        from django.test import override_settings
        from market_data.models import DailyPrice
        from market_serving.models import SymbolSnapshot

        session_date = date.today()
        for sym in ("AAA", "BBB", "CCC"):
            SymbolSnapshot.objects.create(symbol=sym, session_date=session_date, price=20.0, volume=500000)
            for d in range(25):
                day = session_date - timedelta(days=25 - d)
                DailyPrice.objects.create(symbol=sym, date=day, open=10, high=11, low=9, close=10 + d * 0.2, volume=100000)

        # Seed previous history with only AAA so BBB/CCC are "new"
        from user_workspace.models import ScreenerRunHistory

        ScreenerRunHistory.objects.create(
            user=self.user, tenant=self.tenant, rule=self.rule, rule_name=self.rule.name,
            matched_count=1, total_scanned=3, window_days=35, session_date=session_date,
            matched=[{"symbol": "AAA", "close": 20, "action": None, "score": None}], params={},
        )
        sched = ScreenerSchedule.objects.create(
            user=self.user, tenant=self.tenant, name="Mail", rule_ids=[self.rule.id],
            run_time="18:00", weekdays=[0, 1, 2, 3, 4], notify_channels=["in_app", "email"],
        )
        from user_workspace.screener_tasks import run_screener_scan_task

        with mock.patch("market_data.vnbroker_adapter.get_company_financials_response", return_value={"financials": {}}):
            with override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"):
                run_screener_scan_task(
                    self.user.id, self.tenant.id, self.rule.id,
                    {"rules_json": self.rule.rules_json, "updated_at_ts": 0},
                    session_date.isoformat(), 1, "e" * 32, sched.id,
                )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("BBB", mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, [self.user.email])

    def test_beat_due_and_alerts(self):
        from datetime import timedelta

        from django.utils import timezone

        from user_workspace.screener_tasks import screener_scheduled_run

        # Due schedule (next_run_at past)
        s = ScreenerSchedule.objects.create(
            user=self.user, tenant=self.tenant, name="Due", rule_ids=[self.rule.id],
            run_time="18:00", weekdays=[0, 1, 2, 3, 4], notify_channels=["in_app"],
            next_run_at=timezone.now() - timedelta(minutes=1),
        )
        with mock.patch("market_data.vnbroker_adapter.get_company_financials_response", return_value={"financials": {}}):
            out = screener_scheduled_run()
        self.assertEqual(out["schedules_due"], 1)
        self.assertEqual(out["jobs_enqueued"], 1)
        s.refresh_from_db()
        self.assertIsNotNone(s.last_run_at)
        self.assertGreater(s.next_run_at, timezone.now())
        # Alerts endpoint reachable (may be empty on first run — no previous history)
        resp = self.client.get(ALERTS_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("results", unwrapped_json(resp))
