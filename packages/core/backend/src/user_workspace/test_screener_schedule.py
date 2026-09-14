"""P2.4 (screener schedules) — BE tests for ScreenerSchedule CRUD + run-now + beat (Q6, D11)."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache as dj_cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
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
        sid = resp.json()["id"]
        self.assertIsNotNone(resp.json()["next_run_at"])
        # List
        lst = self.client.get(SCHED_URL)
        self.assertEqual(lst.status_code, 200)
        items = lst.json() if isinstance(lst.json(), list) else lst.json().get("results", [])
        self.assertEqual(items[0]["id"], sid)
        # Detail
        det = self.client.get(SCHED_DETAIL_URL.format(pk=sid))
        self.assertEqual(det.status_code, 200)
        self.assertEqual(det.json()["name"], "Evening")
        # Update (toggle off)
        upd = self.client.put(SCHED_DETAIL_URL.format(pk=sid), {"is_active": False}, format="json")
        self.assertEqual(upd.status_code, 200)
        self.assertFalse(upd.json()["is_active"])
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
        sid = resp.json()["id"]
        with mock.patch("market_data.vnbroker_adapter.get_company_financials_response", return_value={"financials": {}}):
            run = self.client.post(RUN_NOW_URL.format(pk=sid), {}, format="json")
        self.assertEqual(run.status_code, 200, run.content[:500])
        self.assertEqual(len(run.json()["jobs"]), 1)
        self.assertEqual(run.json()["jobs"][0]["rule_id"], self.rule.id)

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
        self.assertIn("results", resp.json())
