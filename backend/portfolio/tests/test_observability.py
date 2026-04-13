from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.exceptions import ExternalSystemException
from portfolio.models import UserConfig
from portfolio.observability import (
    get_whale_pipeline_health_summary,
    get_market_observability_snapshot,
    record_whale_dedup_observation,
    record_whale_event_observation,
    reset_market_observability,
)


@override_settings(ENABLE_NEW_MARKET_VIEWS=True)
class MarketObservabilityTests(APITestCase):
    def setUp(self):
        self.username = 'obs-user'
        self.password = 'Test@123456'
        self.user = User.objects.create_user(
            username=self.username,
            email='obs-user@example.com',
            password=self.password,
        )
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True},
        )
        reset_market_observability()

    def authenticate(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    @patch('portfolio.market_views.market_data_service.get_intraday_matched')
    def test_market_observability_health_reports_http_p95(self, mock_get_intraday_matched):
        self.authenticate()
        mock_get_intraday_matched.return_value = {
            'symbol': 'VCB',
            'trades': [],
            'total': 0,
            'source': 'mock',
        }

        response = self.client.get('/api/realtime/intraday/VCB/?page_size=50')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        health_response = self.client.get('/api/health/market-observability/')
        self.assertEqual(health_response.status_code, status.HTTP_200_OK)
        payload = health_response.json()
        self.assertGreaterEqual(payload['overall']['http_requests'], 1)
        self.assertIn('intraday-matched', payload['endpoints'])
        self.assertIn('p95', payload['endpoints']['intraday-matched']['latency_ms'])

    @patch('portfolio.market_data_service.fetch_intraday_dataframe')
    @patch('portfolio.market_data_service.is_vnstock_rate_limited')
    @patch('portfolio.market_data_service.read_stream_intraday_ticks')
    def test_whale_feed_timeout_records_fallback_and_timeout(
        self,
        mock_read_stream_intraday_ticks,
        mock_is_vnstock_rate_limited,
        mock_fetch_intraday_dataframe,
    ):
        self.authenticate()
        mock_read_stream_intraday_ticks.return_value = []
        mock_is_vnstock_rate_limited.return_value = False
        mock_fetch_intraday_dataframe.side_effect = ExternalSystemException(
            'vnstock timeout sau 8s',
            code='vnstock_timeout',
        )

        response = self.client.get('/api/realtime/whale-feed/VCB/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'timeout')

        snapshot = get_market_observability_snapshot()
        self.assertGreaterEqual(snapshot['overall']['external_timeouts'], 1)
        self.assertGreaterEqual(snapshot['overall']['fallback_hits'], 1)
        self.assertEqual(snapshot['fallback_breakdown']['whale-feed']['timeout'], 1)
        self.assertEqual(snapshot['external_timeout_breakdown']['whale-feed']['vnstock'], 1)

    @patch('portfolio.market_views.market_data_service.get_whale_feed_aggregate')
    def test_whale_aggregate_read_does_not_pollute_whale_pipeline_freshness(self, mock_get_whale_feed_aggregate):
        self.authenticate()
        mock_get_whale_feed_aggregate.return_value = {
            'results': [
                {
                    'event_id': 'tick:1',
                    'symbol': 'FPT',
                    'source': 'intraday_tick_db',
                    'ts': '2026-04-10T09:15:00+07:00',
                    'recovered': False,
                }
            ],
            'next_cursor': None,
            'has_more': False,
            'server_time': '2026-04-10T09:20:00+07:00',
            'source': 'intraday_tick_db',
            'filters': {'window': 'session'},
            'entitlements': {},
            'weights_version': 'weights-v1',
            'scope': 'tracked',
            'scope_source': 'tracked_symbols',
            'symbols': ['FPT'],
            'watchlist_group_ids': [],
            'sort': 'ts',
            'window': 'session',
            'limit': 20,
        }

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=session')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        summary = get_whale_pipeline_health_summary()
        self.assertEqual(summary['freshness']['sample_size'], 0)
        self.assertEqual(summary['snapshot_recovery']['events_total'], 0)


class AdminRuntimeKPITests(APITestCase):
    """Tests for GET /api/admin-ops/runtime-kpi/ (S24-04)."""

    def setUp(self):
        self.password = 'Test@123456'
        self.regular_user = User.objects.create_user(
            username='kpi-regular',
            email='kpi-regular@example.com',
            password=self.password,
        )
        UserConfig.objects.update_or_create(
            user=self.regular_user,
            defaults={'email_verified': True},
        )
        self.admin_user = User.objects.create_user(
            username='kpi-admin',
            email='kpi-admin@example.com',
            password=self.password,
            is_staff=True,
        )
        UserConfig.objects.update_or_create(
            user=self.admin_user,
            defaults={'email_verified': True},
        )
        reset_market_observability()

    def _authenticate(self, user):
        response = self.client.post(
            '/api/auth/token/',
            {'username': user.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_admin_runtime_kpi_requires_staff(self):
        self._authenticate(self.regular_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_runtime_kpi_anonymous_401(self):
        response = self.client.get('/api/admin-ops/runtime-kpi/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_runtime_kpi_returns_snapshot_structure(self):
        record_whale_dedup_observation(hit=False)
        record_whale_dedup_observation(hit=True)
        record_whale_event_observation(source='redis_stream', ts='2026-04-10T09:15:00+07:00', recovered=False)

        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sampled_at', data)
        self.assertIn('market_observability', data)
        self.assertIn('prefetch_health', data)
        self.assertIn('celery', data)
        obs = data['market_observability']
        self.assertIn('overall', obs)
        self.assertIn('http_requests', obs['overall'])
        self.assertIn('ai_chart_context', obs)
        self.assertIn('present', obs['ai_chart_context'])
        self.assertIn('used', obs['ai_chart_context'])
        self.assertIn('whale_pipeline', obs)
        self.assertIn('freshness', obs['whale_pipeline'])
        self.assertIn('dedup', obs['whale_pipeline'])
        self.assertIn('source_mix', obs['whale_pipeline'])
        self.assertIn('alive', data['celery'])

    def test_admin_runtime_kpi_advisory_merge_requires_staff(self):
        self._authenticate(self.regular_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/advisory-merge/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_runtime_kpi_advisory_merge_returns_structure(self):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/advisory-merge/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sampled_at', data)
        self.assertIn('advisory_event_merge', data)
        merge = data['advisory_event_merge']
        self.assertIn('scheduled', merge)
        self.assertIn('merged', merge)
        self.assertIn('flushed', merge)
        self.assertIn('skipped', merge)

    def test_admin_runtime_kpi_whale_pipeline_requires_staff(self):
        self._authenticate(self.regular_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-pipeline/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_runtime_kpi_whale_pipeline_returns_structure(self):
        record_whale_dedup_observation(hit=False)
        record_whale_dedup_observation(hit=True)
        record_whale_event_observation(source='redis_stream', ts='2026-04-10T09:15:00+07:00', recovered=False)
        record_whale_event_observation(source='intraday_tick_db', ts='2026-04-10T09:16:00+07:00', recovered=True)

        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-pipeline/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sampled_at', data)
        self.assertIn('whale_pipeline', data)
        whale = data['whale_pipeline']
        self.assertIn('healthy', whale)
        self.assertIn('freshness', whale)
        self.assertIn('dedup', whale)
        self.assertIn('snapshot_recovery', whale)
        self.assertIn('source_mix', whale)
        self.assertEqual(whale['dedup']['total'], 2)
        self.assertEqual(whale['dedup']['hits'], 1)

    def test_admin_runtime_kpi_whale_preflight_metrics_requires_staff(self):
        self._authenticate(self.regular_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_runtime_kpi_whale_preflight_metrics_returns_structure(self):
        from django.utils import timezone

        day = timezone.localdate().isoformat()
        cache.set(f'whale_preflight:metrics:{day}:existing_advisory_hit', 3, timeout=300)
        cache.set(f'whale_preflight:metrics:{day}:cooldown_hit', 5, timeout=300)

        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn('sampled_at', data)
        self.assertIn('updated_at', data)
        self.assertIn('schema_version', data)
        self.assertIn('compact', data)
        self.assertIn('date', data)
        self.assertIn('window_days', data)
        self.assertIn('whale_preflight_metrics', data)
        self.assertIn('whale_preflight_metrics_trend', data)
        self.assertIn('whale_preflight_metrics_totals', data)
        self.assertIn('whale_preflight_metrics_rates', data)
        self.assertIn('whale_preflight_metrics_summary', data)
        self.assertFalse(data['compact'])

        metrics = data['whale_preflight_metrics']
        self.assertIn('existing_advisory_hit', metrics)
        self.assertIn('existing_advisory_miss', metrics)
        self.assertIn('cooldown_hit', metrics)
        self.assertIn('cooldown_miss', metrics)
        self.assertIn('cooldown_bypass_force_refresh', metrics)
        self.assertEqual(metrics['existing_advisory_hit'], 3)
        self.assertEqual(metrics['cooldown_hit'], 5)
        self.assertEqual(data['schema_version'], '2026-04-13.v1')
        self.assertIn('existing_advisory_hit_rate_pct', data['whale_preflight_metrics_rates'])
        self.assertIn('top_signal_name', data['whale_preflight_metrics_summary'])
        self.assertIn('decision_volume_total', data['whale_preflight_metrics_summary'])

    @patch('portfolio.views_admin_runtime._sum_preflight_metrics_window')
    @patch('portfolio.views_admin_runtime._read_preflight_metrics_window')
    @patch('portfolio.views_admin_runtime._read_preflight_metrics')
    def test_admin_runtime_kpi_whale_preflight_metrics_supports_window_days(
        self,
        mock_read_day,
        mock_read_window,
        mock_sum_window,
    ):
        mock_read_day.return_value = {'existing_advisory_hit': 2, 'cooldown_hit': 1}
        mock_read_window.return_value = [
            {'date': '2026-04-12', 'metrics': {'existing_advisory_hit': 1, 'cooldown_hit': 0}},
            {'date': '2026-04-13', 'metrics': {'existing_advisory_hit': 2, 'cooldown_hit': 1}},
        ]
        mock_sum_window.return_value = {'existing_advisory_hit': 3, 'cooldown_hit': 1}

        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?window_days=2')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['window_days'], 2)
        self.assertEqual(data['schema_version'], '2026-04-13.v1')
        self.assertEqual(len(data['whale_preflight_metrics_trend']), 2)
        self.assertEqual(data['whale_preflight_metrics_totals']['existing_advisory_hit'], 3)
        self.assertIn('cooldown_hit_rate_pct', data['whale_preflight_metrics_rates'])
        self.assertIn('top_signal_count', data['whale_preflight_metrics_summary'])

    def test_admin_runtime_kpi_whale_preflight_metrics_compact_mode_omits_trend(self):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?compact=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertTrue(data['compact'])
        self.assertNotIn('whale_preflight_metrics_trend', data)
        self.assertIn('whale_preflight_metrics_summary', data)
        self.assertIn('whale_preflight_metrics_totals', data)
        self.assertIn('whale_preflight_metrics_rates', data)

    def test_admin_runtime_kpi_whale_preflight_metrics_rejects_invalid_date_format(self):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?date=13-04-2026')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.json())

    def test_admin_runtime_kpi_whale_preflight_metrics_rejects_non_integer_window_days(self):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?window_days=abc')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.json())

    def test_admin_runtime_kpi_whale_preflight_metrics_rejects_window_days_out_of_range(self):
        self._authenticate(self.admin_user)
        response_low = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?window_days=0')
        response_high = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?window_days=31')

        self.assertEqual(response_low.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response_high.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('portfolio.views_admin_runtime._sum_preflight_metrics_window')
    @patch('portfolio.views_admin_runtime._read_preflight_metrics_window')
    @patch('portfolio.views_admin_runtime._read_preflight_metrics')
    def test_admin_runtime_kpi_whale_preflight_metrics_accepts_window_days_min_max(
        self,
        mock_read_day,
        mock_read_window,
        mock_sum_window,
    ):
        mock_read_day.return_value = {'existing_advisory_hit': 1}
        mock_read_window.return_value = [{'date': '2026-04-13', 'metrics': {'existing_advisory_hit': 1}}]
        mock_sum_window.return_value = {'existing_advisory_hit': 1}

        self._authenticate(self.admin_user)
        response_min = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?window_days=1')
        response_max = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/?window_days=30')

        self.assertEqual(response_min.status_code, status.HTTP_200_OK)
        self.assertEqual(response_max.status_code, status.HTTP_200_OK)
        self.assertEqual(response_min.json()['window_days'], 1)
        self.assertEqual(response_max.json()['window_days'], 30)

    @patch('portfolio.views_admin_runtime._read_preflight_metrics', side_effect=RuntimeError('cache down'))
    def test_admin_runtime_kpi_whale_preflight_metrics_handles_metric_reader_error(self, _mock_read):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/whale-preflight-metrics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn('whale_preflight_metrics', data)
        self.assertEqual(data['schema_version'], '2026-04-13.v1')
        self.assertIn('updated_at', data)
        metrics = data['whale_preflight_metrics']
        self.assertEqual(metrics.get('existing_advisory_hit'), 0)
        self.assertEqual(metrics.get('cooldown_hit'), 0)
        self.assertEqual(data.get('window_days'), 1)
        self.assertIn('whale_preflight_metrics_totals', data)
        self.assertIn('whale_preflight_metrics_rates', data)
        self.assertIn('whale_preflight_metrics_summary', data)

