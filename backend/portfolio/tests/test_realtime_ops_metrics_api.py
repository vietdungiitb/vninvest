from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from portfolio.services_realtime_metrics import increment_realtime_metric, reset_realtime_metrics_for_test


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

    def test_realtime_ops_metrics_returns_prometheus_text_for_staff(self):
        increment_realtime_metric('cache_hits_total', amount=5)
        increment_realtime_metric('realtime_upstream_errors_total', suffix='intraday', amount=1)

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/api/realtime/ops/metrics/?output=prometheus')
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        self.assertIn('vninvest_realtime_cache_hits_total 5', content)
        self.assertIn('vninvest_realtime_upstream_errors_total{endpoint="intraday"} 1', content)
