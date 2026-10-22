"""W0.6 — DATA HONESTY: 5 endpoint khong duoc "noi doi" nguoi dung.

RED chen 2026-10-22 (agent `w0-6-data-honesty`).
Ke hoach: docs/IMPLEMENTATION_PLAN_W0_6_DATA_HONESTY_20261022.md

Muc tieu: mot retail tra tien cho "du lieu ma cho khac khong co" — neu mot endpoint
tra ve thu gia ma khong noi ro, thi khong co brand name nao xay duoc tren nen do.
"""
from unittest.mock import patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory

from commercial.tasks import send_quota_warning
from identity_access.models import CoreTenant
from signal_intelligence.outbound_notification_service import OutboundNotificationService

User = get_user_model()

WHALE_TEST_URL = "/api/soc/signals/whale/test/"
DEPTH_CHART_URL = "/core/v1/realtime/depth-chart/{symbol}/"
USAGE_METERS_URL = "/core/v1/partner/usage/meters/"


def _payload(response):
    """Unwrap envelope `{data, meta}` — fallback về body thô nếu shape khác."""
    body = response.json()
    return body.get("data", body)


# ── A) Push: chua cau hinh thi KHONG duoc bao "da gui" ─────────────────────
class PushHonestyTests(TestCase):
    """A — `send_fcm_push` / `send_webpush` hien tra True khi chua co key."""

    @override_settings(FCM_SERVER_KEY="MOCK_FCM_KEY", DEBUG=True)
    def test_fcm_without_key_is_not_reported_as_delivered(self):
        self.assertFalse(OutboundNotificationService.push_configured()["fcm"])
        self.assertFalse(OutboundNotificationService.send_fcm_push("token-abc", "t", "b"))

    @override_settings(VAPID_PRIVATE_KEY="MOCK_VAPID_KEY", DEBUG=True)
    def test_webpush_without_key_is_not_reported_as_delivered(self):
        self.assertFalse(OutboundNotificationService.push_configured()["webpush"])
        self.assertFalse(OutboundNotificationService.send_webpush({"endpoint": "x"}, "t", "b"))

    @override_settings(FCM_SERVER_KEY="real-fcm-key-123")
    def test_push_configured_reflects_real_key(self):
        self.assertTrue(OutboundNotificationService.push_configured()["fcm"])


# ── B) Whale test: phai chay engine THAT, khong hardcode "success" ─────────
class WhaleTestEndpointHonestyTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="socstaff", password="pw")
        self.staff.is_staff = True
        self.staff.is_superuser = True
        self.staff.save()
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    @patch("signal_intelligence.order_flow_engine.detect_dark_flow_windows")
    @patch("signal_intelligence.order_flow_engine.load_session_ticks_df")
    def test_without_tick_data_does_not_claim_success(self, mock_load, mock_dark):
        mock_load.return_value = pd.DataFrame()
        mock_dark.return_value = []

        response = self.client.post(
            WHALE_TEST_URL, {"symbol": "VNM"}, content_type="application/json"
        )

        self.assertEqual(response.status_code, 200)
        data = _payload(response)
        self.assertNotEqual(data["test_result"], "success")
        self.assertFalse(data["detection_possible"])

    @patch("signal_intelligence.order_flow_engine.detect_whale_ticks")
    @patch("signal_intelligence.order_flow_engine.detect_dark_flow_windows")
    @patch("signal_intelligence.order_flow_engine.load_session_ticks_df")
    def test_reports_real_counts_when_engine_runs(self, mock_load, mock_dark, mock_whale):
        mock_load.return_value = pd.DataFrame([{"value": 6_000_000_000}])
        mock_whale.return_value = pd.DataFrame([{"value": 6_000_000_000}])
        mock_dark.return_value = []

        response = self.client.post(
            WHALE_TEST_URL, {"symbol": "VNM"}, content_type="application/json"
        )

        self.assertEqual(response.status_code, 200)
        data = _payload(response)
        self.assertEqual(data["test_result"], "completed")
        self.assertTrue(data["detection_possible"])
        self.assertEqual(data["whale_ticks_detected"], 1)


# ── C) Usage meters: so that, hoac 501 — KHONG phai 200 + [] ───────────────
class UsageMetersHonestyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="meteruser", password="pw")
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user, tenant_code="W06M", display_name="W06M"
        )

    def test_helper_without_tenant_is_unavailable_not_empty_list(self):
        from commercial.tasks import build_usage_meters

        out = build_usage_meters(None)

        self.assertFalse(out["available"])
        self.assertTrue(out["reason"])
        self.assertEqual(out["meters"], [])

    def test_endpoint_returns_501_when_meter_backend_unavailable(self):
        from identity_access.views_tenant import PartnerUsageMetersView

        factory = APIRequestFactory()
        request = factory.get(USAGE_METERS_URL)
        request.user = self.user

        with patch(
            "identity_access.views_tenant._get_request_tenant", return_value=self.tenant
        ), patch(
            "commercial.tasks.build_usage_meters",
            return_value={
                "available": False,
                "reason": "quota_source_unavailable",
                "meters": [],
            },
        ):
            response = PartnerUsageMetersView.as_view()(request)

        self.assertEqual(response.status_code, 501)
        self.assertIn("meter", str(response.data).lower())

    def test_endpoint_returns_real_meters(self):
        from identity_access.views_tenant import PartnerUsageMetersView

        factory = APIRequestFactory()
        request = factory.get(USAGE_METERS_URL)
        request.user = self.user

        with patch(
            "identity_access.views_tenant._get_request_tenant", return_value=self.tenant
        ), patch(
            "commercial.tasks.build_usage_meters",
            return_value={
                "available": True,
                "reason": None,
                "meters": [{"meter": "api_calls", "used": 0, "limit": 1000, "counted": True}],
            },
        ):
            response = PartnerUsageMetersView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(_payload(response)), 1)


# ── D) Quota warning: phai GUI email that ─────────────────────────────────
class QuotaWarningEmailTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="quotaowner", email="owner@example.com", password="pw"
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user, tenant_code="W06A", display_name="W06A"
        )

    @patch("commercial.tasks.cache")
    def test_missing_owner_email_is_skipped_with_reason(self, mock_cache):
        mock_cache.add.return_value = True
        self.user.email = ""
        self.user.save()

        out = send_quota_warning.run(self.tenant.public_id, 80)

        self.assertEqual(out["status"], "skipped")
        self.assertEqual(out["reason"], "tenant_email_missing")

    @patch("commercial.tasks.OutboundNotificationService.send_email")
    @patch("commercial.tasks.cache")
    def test_sends_real_email_when_owner_email_present(self, mock_cache, mock_send):
        mock_cache.add.return_value = True
        mock_send.return_value = True

        out = send_quota_warning.run(self.tenant.public_id, 80)

        self.assertEqual(out["status"], "sent")
        self.assertTrue(mock_send.called)

    @patch("commercial.tasks.OutboundNotificationService.send_email")
    @patch("commercial.tasks.cache")
    def test_email_failure_is_reported_as_failed(self, mock_cache, mock_send):
        mock_cache.add.return_value = True
        mock_send.return_value = False

        out = send_quota_warning.run(self.tenant.public_id, 80)

        self.assertEqual(out["status"], "failed")

    @patch("commercial.tasks.cache")
    def test_duplicate_warning_is_skipped(self, mock_cache):
        mock_cache.add.return_value = False

        out = send_quota_warning.run(self.tenant.public_id, 80)

        self.assertEqual(out["status"], "skipped")
        self.assertEqual(out["reason"], "duplicate_warning")


# ── E) Depth chart: phai noi ro "uoc tinh" ────────────────────────────────
class DepthChartQualityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="depthuser", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_response_declares_estimated_data_quality(self):
        response = self.client.get(DEPTH_CHART_URL.format(symbol="VNM"))

        self.assertEqual(response.status_code, 200)
        data = _payload(response)
        self.assertTrue(data["is_mock"])
        self.assertEqual(data["data_quality"], "estimated")
        self.assertTrue(data["note"])
