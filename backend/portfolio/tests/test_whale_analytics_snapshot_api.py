from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIRequestFactory, force_authenticate

from portfolio.models import DailyPrice, IntradayTick, UserConfig
from portfolio.services_whale_analytics_snapshot import _get_or_build_bucket_facts, invalidate_whale_analytics_snapshot_cache, _resolve_whale_analytics_cache_revision
from portfolio.views_whale_analytics import whale_analytics_snapshot_api, _build_snapshot_cache_key


VN_TZ = ZoneInfo('Asia/Ho_Chi_Minh')


class WhaleAnalyticsSnapshotApiTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username='whale-snapshot-user',
            email='whale-snapshot@example.com',
            password='test-pass-123',
        )
        UserConfig.objects.create(user=self.user, plan=UserConfig.PlanChoices.PRO)
        self.trade_date = date.today()
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=self.trade_date,
            trade_time=time(9, 5),
            price=25.1,
            volume=100_000,
            side='BUY',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=self.trade_date,
            trade_time=time(9, 10),
            price=25.3,
            volume=80_000,
            side='SELL',
        )

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_stock_workspace_overview')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    @patch('portfolio.views_whale_analytics.timezone.localtime')
    @patch('portfolio.services_whale_analytics_snapshot._current_vn_now')
    def test_snapshot_endpoint_returns_contract_and_headers(
        self,
        mock_current_vn_now,
        mock_localtime,
        mock_get_whale_feed,
        mock_get_stock_workspace_overview,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        live_now = datetime.combine(self.trade_date, time(9, 20), tzinfo=VN_TZ)
        mock_current_vn_now.return_value = live_now
        mock_localtime.return_value = live_now
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_stock_workspace_overview.return_value = {
            'reference_price': 25.0,
            'high_price': 25.6,
            'low_price': 24.9,
            'ceiling_price': 26.75,
            'floor_price': 23.25,
        }
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [
                {
                    'ts': f'{self.trade_date.isoformat()}T09:05:00+07:00',
                    'side': 'BUY',
                    'price': 25.1,
                    'volume': 100_000,
                    'matched_value': 2_510_000_000,
                    'display_score': 88,
                }
            ],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=15m&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['symbol'], 'HPG')
        self.assertEqual(response.data['timeframe'], '15m')
        self.assertIn('session', response.data)
        self.assertIn('meta', response.data)
        self.assertEqual(
            response.data['session_levels'],
            {
                'reference_price': 25.0,
                'high_price': 25.6,
                'low_price': 24.9,
                'ceiling_price': 26.75,
                'floor_price': 23.25,
            },
        )
        self.assertIn('price_series', response.data)
        self.assertIn('bubble_series', response.data)
        self.assertIn('flow_series', response.data)
        self.assertIn('flow_compare_series', response.data)
        self.assertIn('heatmap_series', response.data)
        self.assertIn('marker_series', response.data)
        self.assertIn('session_context', response.data)
        self.assertIn('session_summary', response.data)
        self.assertIn('quality_flags', response.data)
        self.assertIn('speed', response.data['flow_series'])
        self.assertEqual(response.data['flow_series']['speed'][0]['unit'], 'events_per_second')
        self.assertGreater(response.data['flow_series']['speed'][0]['value'], 0)
        self.assertEqual(response.data['flow_compare_series'][0]['baseline'], 50.0)
        self.assertIn('cvd_normalized_0_100', response.data['flow_compare_series'][0])
        self.assertIn('buy_heat', response.data['heatmap_series'][0])
        self.assertIn('score', response.data['marker_series'][0])
        self.assertEqual(response.data['session_context']['quality_state'], 'READY')
        self.assertEqual(response.data['quality_flags']['contract_version'], 'kline-intelligence-v1')
        self.assertEqual(response.data['quality_flags']['cache_key_version'], 'v5')
        self.assertIsNone(response.data['bubble_series'][0]['matched_value_percentile_10d'])
        self.assertIsNone(response.data['bubble_series'][0]['event_score_percentile_10d'])
        self.assertIsNone(response.data['bubble_series'][0]['baseline_sample_size'])
        self.assertIn('ETag', response)
        self.assertIn('Last-Modified', response)
        self.assertIn('Cache-Control', response)
        self.assertEqual(response['Cache-Control'], 'private, max-age=5, stale-while-revalidate=25')
        self.assertEqual(response.data['materialization']['freshness_state'], 'fresh')
        self.assertEqual(response.data['materialization']['completeness_state'], 'complete')
        self.assertEqual(response.data['materialization']['session_summary_state'], 'complete')
        self.assertEqual(response.data['materialization']['read_path'], 'facts_first')
        self.assertFalse(response.data['materialization']['raw_fallback_used'])
        self.assertEqual(response.data['materialization']['bucket_fact_count'], 1)
        self.assertTrue(response.data['quality_flags']['has_materialized_facts'])
        self.assertTrue(response.data['quality_flags']['has_session_summary'])
        self.assertTrue(response.data['quality_flags']['facts_first_primary_path'])
        self.assertEqual(response.data['session_summary']['quality_state'], 'READY')
        self.assertEqual(response.data['session_summary']['freshness_state'], 'fresh')
        self.assertEqual(response.data['session_summary']['completeness_state'], 'complete')
        self.assertEqual(response.data['session_summary']['resolved_from'], 'live_session')
        self.assertEqual(response.data['session_summary']['bucket_fact_count'], 1)
        self.assertEqual(response.data['session_summary']['advisory_context']['quality_state'], 'READY')

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_stock_workspace_overview')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    @patch('portfolio.views_whale_analytics.timezone.localtime')
    @patch('portfolio.services_whale_analytics_snapshot._current_vn_now')
    def test_snapshot_endpoint_returns_percentile_fields_when_historical_baseline_exists(
        self,
        mock_current_vn_now,
        mock_localtime,
        mock_get_whale_feed,
        mock_get_stock_workspace_overview,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        previous_trade_date_1 = self.trade_date - timedelta(days=1)
        previous_trade_date_2 = self.trade_date - timedelta(days=2)
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=previous_trade_date_1,
            trade_time=time(9, 15),
            price=24.0,
            volume=50_000,
            side='BUY',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=previous_trade_date_2,
            trade_time=time(9, 30),
            price=26.0,
            volume=150_000,
            side='SELL',
        )
        live_now = datetime.combine(self.trade_date, time(9, 20), tzinfo=VN_TZ)
        mock_current_vn_now.return_value = live_now
        mock_localtime.return_value = live_now
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_stock_workspace_overview.return_value = {
            'reference_price': 25.0,
            'high_price': 25.6,
            'low_price': 24.9,
            'ceiling_price': 26.75,
            'floor_price': 23.25,
        }
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=15m&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['bubble_series'][0]['baseline_sample_size'], 2)
        self.assertGreaterEqual(response.data['bubble_series'][0]['matched_value_percentile_10d'], 0)
        self.assertLessEqual(response.data['bubble_series'][0]['matched_value_percentile_10d'], 100)
        self.assertGreaterEqual(response.data['bubble_series'][0]['event_score_percentile_10d'], 0)
        self.assertLessEqual(response.data['bubble_series'][0]['event_score_percentile_10d'], 100)

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    @patch('portfolio.views_whale_analytics.timezone.localtime')
    @patch('portfolio.services_whale_analytics_snapshot._current_vn_now')
    def test_snapshot_endpoint_uses_same_day_snapshot_cache_policy_after_market_close(
        self,
        mock_current_vn_now,
        mock_localtime,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        off_hours_now = datetime.combine(self.trade_date, time(15, 10), tzinfo=VN_TZ)
        mock_current_vn_now.return_value = off_hours_now
        mock_localtime.return_value = off_hours_now
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T15:00:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=session&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['meta']['data_state'], 'snapshot')
        self.assertEqual(response.data['session']['resolved_from'], 'latest_completed_session')
        self.assertEqual(response['Cache-Control'], 'private, max-age=60, stale-while-revalidate=300')

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_supports_conditional_etag(
        self,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        first_request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=15m&compact=1')
        force_authenticate(first_request, user=self.user)
        first_response = whale_analytics_snapshot_api(first_request, 'HPG')
        etag = first_response['ETag']

        second_request = self.factory.get(
            '/api/portfolio/whale/analytics/HPG/?timeframe=15m&compact=1',
            HTTP_IF_NONE_MATCH=etag,
        )
        force_authenticate(second_request, user=self.user)
        second_response = whale_analytics_snapshot_api(second_request, 'HPG')

        self.assertEqual(second_response.status_code, 304)
        self.assertEqual(second_response['ETag'], etag)

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_falls_back_to_latest_completed_session_for_weekend_trade_date(
        self,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        friday_trade_date = date(2026, 4, 17)
        sunday_trade_date = date(2026, 4, 19)
        IntradayTick.objects.create(
            symbol='SSI',
            trade_date=friday_trade_date,
            trade_time=time(9, 15),
            price=24.8,
            volume=120_000,
            side='BUY',
        )
        mock_resolve_reference_price.return_value = 24.5
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{friday_trade_date.isoformat()}T09:20:00+07:00',
            'whale_orders': [
                {
                    'ts': f'{friday_trade_date.isoformat()}T09:15:00+07:00',
                    'side': 'BUY',
                    'price': 24.8,
                    'volume': 120_000,
                    'matched_value': 2_976_000_000,
                    'display_score': 90,
                }
            ],
        }

        request = self.factory.get(
            f'/api/portfolio/whale/analytics/SSI/?timeframe=session&compact=1&trade_date={sunday_trade_date.isoformat()}'
        )
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'SSI')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['trade_date'], friday_trade_date.isoformat())
        self.assertEqual(response.data['session']['resolved_from'], 'latest_completed_session')
        self.assertEqual(response.data['session_context']['quality_state'], 'DEGRADED_SESSION_FALLBACK')
        self.assertEqual(response.data['session_context']['latest_valid_trade_date'], friday_trade_date.isoformat())
        self.assertEqual(response.data['bubble_series'][0]['bucket_ts'][:10], friday_trade_date.isoformat())
        self.assertEqual(response['Cache-Control'], 'private, max-age=900, stale-while-revalidate=3600')

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_falls_back_to_latest_daily_price_session_for_holiday_data_gap(
        self,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        friday_trade_date = date(2026, 4, 17)
        holiday_trade_date = date(2026, 4, 20)
        DailyPrice.objects.create(
            symbol='ACB',
            date=friday_trade_date,
            close_price=26.4,
            volume=2_000_000,
        )
        mock_resolve_reference_price.return_value = 26.4
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{friday_trade_date.isoformat()}T15:00:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get(
            f'/api/portfolio/whale/analytics/ACB/?timeframe=session&compact=1&trade_date={holiday_trade_date.isoformat()}'
        )
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'ACB')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['trade_date'], friday_trade_date.isoformat())
        self.assertEqual(response.data['session']['resolved_from'], 'latest_completed_session')
        self.assertTrue(response.data['meta']['degraded_mode'])
        self.assertEqual(response.data['meta']['stale_reason'], 'missing_intraday_ticks')
        self.assertEqual(response['Cache-Control'], 'private, max-age=900, stale-while-revalidate=3600')

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_stock_workspace_overview')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_sets_degraded_metadata_when_reference_price_missing(
        self,
        mock_get_whale_feed,
        mock_get_stock_workspace_overview,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_resolve_reference_price.return_value = None
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_stock_workspace_overview.return_value = {
            'reference_price': None,
            'high_price': 25.3,
            'low_price': 24.8,
            'ceiling_price': 26.75,
            'floor_price': 23.25,
        }
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=session&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['meta']['degraded_mode'])
        self.assertEqual(response.data['meta']['stale_reason'], 'missing_reference_price')
        self.assertEqual(response.data['meta']['data_state'], 'live' if response.data['session']['resolved_from'] == 'live_session' else 'snapshot')

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_stock_workspace_overview')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_sets_degraded_metadata_when_intraday_ticks_missing(
        self,
        mock_get_whale_feed,
        mock_get_stock_workspace_overview,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_stock_workspace_overview.return_value = {
            'reference_price': 25.0,
            'high_price': 25.3,
            'low_price': 24.8,
            'ceiling_price': 26.75,
            'floor_price': 23.25,
        }
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/VNM/?timeframe=session&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'VNM')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['meta']['degraded_mode'])
        self.assertEqual(response.data['meta']['stale_reason'], 'missing_intraday_ticks')
        self.assertEqual(response.data['price_series'], [])
        self.assertEqual(response.data['flow_series']['cvd'], [])
        self.assertEqual(response.data['session_context']['quality_state'], 'DEGRADED_FLOW_MISSING')
        self.assertFalse(response.data['quality_flags']['has_flow_data'])
        self.assertFalse(response.data['quality_flags']['has_heatmap_data'])

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_stock_workspace_overview')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_marks_missing_session_levels_when_price_context_incomplete(
        self,
        mock_get_whale_feed,
        mock_get_stock_workspace_overview,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_stock_workspace_overview.return_value = {
            'reference_price': 25.0,
            'high_price': None,
            'low_price': 24.8,
            'ceiling_price': None,
            'floor_price': 23.25,
        }
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=session&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['meta']['degraded_mode'])
        self.assertEqual(response.data['meta']['stale_reason'], 'missing_session_levels')
        self.assertEqual(
            response.data['meta']['missing_fields'],
            ['session_levels.high_price', 'session_levels.ceiling_price'],
        )

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_reuses_cached_payload_for_identical_request(
        self,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        first_request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=15m&compact=1')
        force_authenticate(first_request, user=self.user)
        first_response = whale_analytics_snapshot_api(first_request, 'HPG')

        second_request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=15m&compact=1')
        force_authenticate(second_request, user=self.user)
        second_response = whale_analytics_snapshot_api(second_request, 'HPG')

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(first_response.data['symbol'], second_response.data['symbol'])
        self.assertEqual(mock_get_whale_feed.call_count, 1)

    @patch('portfolio.services_whale_analytics_snapshot._build_percentile_baseline_samples')
    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    def test_snapshot_endpoint_skips_percentile_baseline_when_disabled(
        self,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
        mock_build_percentile_baseline_samples,
    ):
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:15:00+07:00',
            'whale_orders': [],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=session&compact=0&include_baseline=0')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['bubble_series'][0]['matched_value_percentile_10d'])
        self.assertIsNone(response.data['bubble_series'][0]['event_score_percentile_10d'])
        self.assertIsNone(response.data['bubble_series'][0]['baseline_sample_size'])
        mock_build_percentile_baseline_samples.assert_not_called()

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    @patch('portfolio.services_whale_analytics_snapshot._current_vn_now')
    def test_snapshot_endpoint_maps_auction_events_to_bucket_start(
        self,
        mock_current_vn_now,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_current_vn_now.return_value = datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ)
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T14:59:00+07:00',
            'whale_orders': [
                {
                    'ts': f'{self.trade_date.isoformat()}T09:00:05+07:00',
                    'side': 'BUY',
                    'price': 25.0,
                    'volume': 100_000,
                    'matched_value': 2_500_000_000,
                },
                {
                    'ts': f'{self.trade_date.isoformat()}T14:59:45+07:00',
                    'side': 'SELL',
                    'price': 24.9,
                    'volume': 150_000,
                    'matched_value': 3_735_000_000,
                },
            ],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=session&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['session']['auction_policy']['ato'], 'bucket_start')
        self.assertEqual(response.data['session']['auction_policy']['atc'], 'bucket_start')
        self.assertEqual(response.data['bubble_series'][0]['bucket_ts'][11:16], '09:00')
        self.assertEqual(response.data['bubble_series'][1]['bucket_ts'][11:16], '14:45')

    @patch('portfolio.services_whale_analytics_snapshot.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.services_whale_analytics_snapshot._resolve_reference_price')
    @patch('portfolio.services_whale_analytics_snapshot.market_data_service.get_whale_feed')
    @patch('portfolio.services_whale_analytics_snapshot._current_vn_now')
    def test_snapshot_endpoint_keeps_all_threshold_ticks_even_if_whale_feed_only_contains_top_subset(
        self,
        mock_current_vn_now,
        mock_get_whale_feed,
        mock_resolve_reference_price,
        mock_resolve_threshold_vnd,
    ):
        mock_current_vn_now.return_value = datetime.combine(self.trade_date, time(9, 20), tzinfo=VN_TZ)
        mock_resolve_reference_price.return_value = 25.0
        mock_resolve_threshold_vnd.return_value = (1_000_000_000, 'user_default')
        mock_get_whale_feed.return_value = {
            'fetched_at': f'{self.trade_date.isoformat()}T09:20:00+07:00',
            'whale_orders': [
                {
                    'ts': f'{self.trade_date.isoformat()}T09:05:00+07:00',
                    'side': 'BUY',
                    'price': 25.1,
                    'volume': 100_000,
                    'matched_value': 2_510_000_000,
                    'display_score': 88,
                }
            ],
        }

        request = self.factory.get('/api/portfolio/whale/analytics/HPG/?timeframe=session&compact=1')
        force_authenticate(request, user=self.user)
        response = whale_analytics_snapshot_api(request, 'HPG')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['bubble_series']), 2)
        self.assertEqual(response.data['bubble_series'][0]['ts'][11:16], '09:05')
        self.assertEqual(response.data['bubble_series'][1]['ts'][11:16], '09:10')
        self.assertEqual(response.data['summary']['whale_order_count'], 2)

    @patch('portfolio.views_whale_analytics._resolve_whale_analytics_cache_revision', return_value='rev-test')
    @patch('portfolio.views_whale_analytics.time.sleep', return_value=None)
    @patch('portfolio.views_whale_analytics.cache.delete')
    @patch('portfolio.views_whale_analytics.cache.set')
    @patch('portfolio.views_whale_analytics.cache.add')
    @patch('portfolio.views_whale_analytics.cache.get')
    @patch('portfolio.views_whale_analytics.build_whale_analytics_snapshot')
    def test_snapshot_endpoint_reuses_payload_published_by_another_request_while_lock_held(
        self,
        mock_build_snapshot,
        mock_cache_get,
        mock_cache_add,
        mock_cache_set,
        mock_cache_delete,
        _mock_sleep,
        _mock_cache_revision,
    ):
        mock_cache_add.return_value = True
        mock_cache_get.side_effect = [
            None,
            None,
            {
                'symbol': 'HPG',
                'trade_date': self.trade_date.isoformat(),
                'timeframe': 'session',
                'bucket_minutes': 15,
                'window_start': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ).isoformat(),
                'window_end': datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ).isoformat(),
                'generated_at': datetime.combine(self.trade_date, time(9, 20), tzinfo=VN_TZ).isoformat(),
                'tick_rows': [
                    {
                        'dt': datetime.combine(self.trade_date, time(9, 5), tzinfo=VN_TZ),
                        'bucket_ts': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
                        'side': 'buy',
                        'price': 25.0,
                        'volume': 1000.0,
                        'matched_value': 25_000_000.0,
                    },
                ],
                'bucket_rows': [
                    {
                        'bucket_ts': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
                        'bucket_index': 0,
                        'bucket_minutes': 15,
                        'buy_value': 25_000_000.0,
                        'sell_value': 0.0,
                        'total_value': 25_000_000.0,
                        'net_value': 25_000_000.0,
                        'cvd_raw': 25_000_000.0,
                        'event_count': 1,
                        'event_density': 0.066667,
                        'buy_share': 1.0,
                        'sell_share': 0.0,
                        'dominant_side': 'buy',
                        'last_price': 25.0,
                        'last_ts': datetime.combine(self.trade_date, time(9, 5), tzinfo=VN_TZ),
                    },
                ],
                'bucket_facts': [
                    {
                        'bucket_ts': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
                        'bucket_index': 0,
                        'bucket_minutes': 15,
                        'buy_value': 25_000_000.0,
                        'sell_value': 0.0,
                        'total_value': 25_000_000.0,
                        'net_value': 25_000_000.0,
                        'cvd_raw': 25_000_000.0,
                        'event_count': 1,
                        'event_density': 0.066667,
                        'buy_share': 1.0,
                        'sell_share': 0.0,
                        'dominant_side': 'buy',
                        'last_price': 25.0,
                        'last_ts': datetime.combine(self.trade_date, time(9, 5), tzinfo=VN_TZ),
                    },
                ],
                'tick_count': 1,
                'bucket_count': 1,
                'bucket_fact_count': 1,
            },
        ]

        mock_query = MagicMock()
        mock_query.values.return_value = mock_query
        mock_query.order_by.return_value = [
            {
                'trade_date': self.trade_date,
                'trade_time': time(9, 5),
                'price': 25.0,
                'volume': 1000,
                'side': 'BUY',
            },
        ]
        mock_intraday_objects.filter.return_value = mock_query

        first_payload = _get_or_build_bucket_facts(
            symbol='HPG',
            trade_date=self.trade_date,
            timeframe='session',
            window_start=datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
            window_end=datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ),
            bucket_minutes=15,
            cache_revision='rev-test',
        )
        second_payload = _get_or_build_bucket_facts(
            symbol='HPG',
            trade_date=self.trade_date,
            timeframe='session',
            window_start=datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
            window_end=datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ),
            bucket_minutes=15,
            cache_revision='rev-test',
        )

        self.assertEqual(first_payload['tick_count'], 1)
        self.assertEqual(second_payload['bucket_count'], 1)
        self.assertEqual(first_payload['bucket_fact_count'], 1)
        self.assertEqual(first_payload['bucket_facts'][0]['net_value'], 25_000_000.0)
        self.assertEqual(first_payload['bucket_facts'][0]['cvd_raw'], 25_000_000.0)
        self.assertEqual(first_payload['bucket_facts'][0]['dominant_side'], 'buy')
        self.assertEqual(mock_intraday_objects.filter.call_count, 1)
        mock_cache_set.assert_called_once()
        mock_cache_delete.assert_called_once_with(
            f'whale:analytics:facts:v1:rev-test:HPG:{self.trade_date.isoformat()}:session:15:lock'
        )

    @patch('portfolio.services_whale_analytics_snapshot.time.sleep', return_value=None)
    @patch('portfolio.services_whale_analytics_snapshot.cache.delete')
    @patch('portfolio.services_whale_analytics_snapshot.cache.set')
    @patch('portfolio.services_whale_analytics_snapshot.cache.add')
    @patch('portfolio.services_whale_analytics_snapshot.cache.get')
    @patch('portfolio.services_whale_analytics_snapshot.IntradayTick.objects')
    def test_shared_bucket_facts_cache_reuses_raw_tick_query_across_calls(
        self,
        mock_intraday_objects,
        mock_cache_get,
        mock_cache_add,
        mock_cache_set,
        mock_cache_delete,
        _mock_sleep,
    ):
        mock_cache_add.return_value = True
        mock_cache_get.side_effect = [
            None,
            None,
            {
                'symbol': 'HPG',
                'trade_date': self.trade_date.isoformat(),
                'timeframe': 'session',
                'bucket_minutes': 15,
                'window_start': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ).isoformat(),
                'window_end': datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ).isoformat(),
                'generated_at': datetime.combine(self.trade_date, time(9, 20), tzinfo=VN_TZ).isoformat(),
                'tick_rows': [
                    {
                        'dt': datetime.combine(self.trade_date, time(9, 5), tzinfo=VN_TZ),
                        'bucket_ts': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
                        'side': 'buy',
                        'price': 25.0,
                        'volume': 1000.0,
                        'matched_value': 25_000_000.0,
                    },
                ],
                'bucket_rows': [
                    {
                        'bucket_ts': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
                        'bucket_index': 0,
                        'bucket_minutes': 15,
                        'buy_value': 25_000_000.0,
                        'sell_value': 0.0,
                        'total_value': 25_000_000.0,
                        'net_value': 25_000_000.0,
                        'cvd_raw': 25_000_000.0,
                        'event_count': 1,
                        'event_density': 0.066667,
                        'buy_share': 1.0,
                        'sell_share': 0.0,
                        'dominant_side': 'buy',
                        'last_price': 25.0,
                        'last_ts': datetime.combine(self.trade_date, time(9, 5), tzinfo=VN_TZ),
                    },
                ],
                'bucket_facts': [
                    {
                        'bucket_ts': datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
                        'bucket_index': 0,
                        'bucket_minutes': 15,
                        'buy_value': 25_000_000.0,
                        'sell_value': 0.0,
                        'total_value': 25_000_000.0,
                        'net_value': 25_000_000.0,
                        'cvd_raw': 25_000_000.0,
                        'event_count': 1,
                        'event_density': 0.066667,
                        'buy_share': 1.0,
                        'sell_share': 0.0,
                        'dominant_side': 'buy',
                        'last_price': 25.0,
                        'last_ts': datetime.combine(self.trade_date, time(9, 5), tzinfo=VN_TZ),
                    },
                ],
                'tick_count': 1,
                'bucket_count': 1,
                'bucket_fact_count': 1,
            },
        ]

        mock_query = MagicMock()
        mock_query.values.return_value = mock_query
        mock_query.order_by.return_value = [
            {
                'trade_date': self.trade_date,
                'trade_time': time(9, 5),
                'price': 25.0,
                'volume': 1000,
                'side': 'BUY',
            },
        ]
        mock_intraday_objects.filter.return_value = mock_query

        first_payload = _get_or_build_bucket_facts(
            symbol='HPG',
            trade_date=self.trade_date,
            timeframe='session',
            window_start=datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
            window_end=datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ),
            bucket_minutes=15,
            cache_revision='rev-test',
        )
        second_payload = _get_or_build_bucket_facts(
            symbol='HPG',
            trade_date=self.trade_date,
            timeframe='session',
            window_start=datetime.combine(self.trade_date, time(9, 0), tzinfo=VN_TZ),
            window_end=datetime.combine(self.trade_date, time(15, 0), tzinfo=VN_TZ),
            bucket_minutes=15,
            cache_revision='rev-test',
        )

        self.assertEqual(first_payload['tick_count'], 1)
        self.assertEqual(second_payload['bucket_count'], 1)
        self.assertEqual(first_payload['bucket_fact_count'], 1)
        self.assertEqual(first_payload['bucket_facts'][0]['net_value'], 25_000_000.0)
        self.assertEqual(first_payload['bucket_facts'][0]['cvd_raw'], 25_000_000.0)
        self.assertEqual(first_payload['bucket_facts'][0]['dominant_side'], 'buy')
        self.assertEqual(mock_intraday_objects.filter.call_count, 1)
        mock_cache_set.assert_called_once()
        mock_cache_delete.assert_called_once_with(
            f'whale:analytics:facts:v1:rev-test:HPG:{self.trade_date.isoformat()}:session:15:lock'
        )

    def test_invalidate_whale_analytics_snapshot_cache_bumps_symbol_revision(self):
        cache.clear()

        original_revision = _resolve_whale_analytics_cache_revision(symbol='HPG')
        invalidated = invalidate_whale_analytics_snapshot_cache(['HPG'])
        bumped_revision = _resolve_whale_analytics_cache_revision(symbol='HPG')

        self.assertEqual(invalidated, ['HPG'])
        self.assertNotEqual(original_revision, bumped_revision)