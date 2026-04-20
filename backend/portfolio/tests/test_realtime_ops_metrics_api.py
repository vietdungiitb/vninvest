from django.contrib.auth.models import User
from django.test import TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from portfolio.services_realtime_metrics import (
    get_realtime_metric,
    increment_realtime_metric,
    reset_realtime_metrics_for_test,
    set_realtime_metric,
)
from portfolio.throttles import RealtimeOpsMetricsRateThrottle


class RealtimeOpsMetricsApiTests(TestCase):
    def setUp(self):
        reset_realtime_metrics_for_test()
        self.client = APIClient()
        self.staff_user = User.objects.create_user(username='ops_staff', password='Test@123456', is_staff=True)
        self.normal_user = User.objects.create_user(username='ops_user', password='Test@123456', is_staff=False)

    def test_realtime_ops_metrics_requires_staff(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get('/api/realtime/ops/metrics/')
        self.assertEqual(response.status_code, 403)

    def test_realtime_ops_metrics_returns_json_snapshot_for_staff(self):
        increment_realtime_metric('cache_hits_total', amount=3)
        increment_realtime_metric('cache_misses_total', amount=1)
        increment_realtime_metric('realtime_upstream_calls_total', suffix='price_board', amount=2)
        increment_realtime_metric('realtime_stream_reclaim_total', suffix='ws-broadcaster', amount=4)
        set_realtime_metric('realtime_stream_pending_depth', 7, suffix='ws-broadcaster')

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/api/realtime/ops/metrics/?output=json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get('ok'))

        metrics = response.data.get('metrics', {})
        cache_data = metrics.get('cache', {})
        self.assertEqual(cache_data.get('hits_total'), 3)
        self.assertEqual(cache_data.get('misses_total'), 1)
        self.assertEqual(cache_data.get('reads_total'), 4)
        self.assertAlmostEqual(float(cache_data.get('hit_ratio')), 0.75, places=6)

        stream_data = metrics.get('stream_reclaim', {})
        ws_pending = int((stream_data.get('pending_depth') or {}).get('ws-broadcaster') or 0)
        ws_reclaim = int((stream_data.get('reclaim_total') or {}).get('ws-broadcaster') or 0)
        self.assertGreaterEqual(ws_pending, 0)
        self.assertGreaterEqual(ws_reclaim, 4)

    def test_realtime_ops_metrics_returns_prometheus_text_for_staff(self):
        increment_realtime_metric('cache_hits_total', amount=5)
        increment_realtime_metric('realtime_upstream_errors_total', suffix='intraday', amount=1)
        increment_realtime_metric('realtime_stream_reclaim_total', suffix='alert-engine', amount=2)
        set_realtime_metric('realtime_stream_pending_depth', 3, suffix='alert-engine')
        increment_realtime_metric('realtime_channel_over_capacity_total', suffix='ws-broadcaster', amount=2)
        increment_realtime_metric('realtime_broadcast_degrade_activations_total', suffix='ws-broadcaster', amount=4)

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/api/realtime/ops/metrics/?output=prometheus')
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        self.assertIn('vninvest_realtime_cache_hits_total 5', content)
        self.assertIn('vninvest_realtime_upstream_errors_total{endpoint="intraday"} 1', content)
        self.assertIn('vninvest_realtime_stream_pending_depth{group="alert-engine"}', content)
        self.assertIn('vninvest_realtime_stream_reclaim_total{group="alert-engine"}', content)
        self.assertIn('vninvest_realtime_channel_over_capacity_total{group="ws-broadcaster"} 2', content)
        self.assertIn('vninvest_realtime_broadcast_degrade_activations_total{group="ws-broadcaster"} 4', content)

    def test_realtime_ops_metrics_throttle_enforced(self):
        self.client.force_authenticate(user=self.staff_user)
        with patch.object(RealtimeOpsMetricsRateThrottle, 'THROTTLE_RATES', {'realtime_ops_metrics': '2/minute'}):
            first = self.client.get('/api/realtime/ops/metrics/?output=json')
            second = self.client.get('/api/realtime/ops/metrics/?output=json')
            third = self.client.get('/api/realtime/ops/metrics/?output=json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 429)

    def test_increment_realtime_metric_fallback_path_updates_value(self):
        increment_realtime_metric('cache_hits_total', amount=1)

        with patch('portfolio.services_realtime_metrics.cache.incr', side_effect=Exception('incr_failed')):
            updated = increment_realtime_metric('cache_hits_total', amount=2)

        self.assertGreaterEqual(updated, 3)
        self.assertGreaterEqual(get_realtime_metric('cache_hits_total'), 3)
