"""
Tests for GET /api/admin-ops/stats/ (AdminOpsStatsView).

Coverage:
  1. Unauthenticated → 401
  2. Authenticated non-staff → 403
  3. Staff user → 200 với đầy đủ keys
  4. Staff user → user_count chính xác
  5. Staff user → portfolio_count chính xác
  6. Staff user → tracked_symbol_count chính xác
  7. Staff user → watchlist_item_count chính xác
  8. Staff user → Redis health trong response (redis_ok field)
  9. Staff user → channel_layer_type field có mặt
  10. Staff user → last_market_group_sync = None khi không có log
  11. Staff user → last_stock_profile_sync = None khi không có log
  12. Staff user → last_market_group_sync khi có log
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import (
    Portfolio,
    RuntimeVnstockConfig,
    TrackedSymbol,
    WatchlistGroup,
    WatchlistItem,
    MarketGroupSyncLog,
    StockProfileSyncLog,
    UserConfig,
    WhaleAdvisory,
    WhaleConfigRollout,
    WhaleConfigVersion,
    WhaleConfigWorkerAck,
)

URL = '/api/admin-ops/stats/'
WARM_URL = '/api/admin-ops/prefetch/warm/'
OFFPEAK_INGEST_URL = '/api/admin-ops/prefetch/offpeak-ingest/'
OFFPEAK_INGEST_HISTORY_URL = '/api/admin-ops/prefetch/offpeak-ingest/history/'
VNSTOCK_CURRENT_URL = '/api/admin-ops/vnstock-config/current/'
VNSTOCK_UPDATE_URL = '/api/admin-ops/vnstock-config/update-config/'
VNSTOCK_RESET_URL = '/api/admin-ops/vnstock-config/reset-to-defaults/'
VNSTOCK_CHANGELOG_URL = '/api/admin-ops/vnstock-config/changelog/'
VNSTOCK_BENCHMARK_LATEST_URL = '/api/admin-ops/vnstock-config/benchmark-price-board/latest/'
VNSTOCK_BENCHMARK_RUN_URL = '/api/admin-ops/vnstock-config/benchmark-price-board/run/'


class AdminOpsStatsPermissionTests(APITestCase):
    """Tests 1-2: quyền truy cập."""

    def setUp(self):
        self.regular_user = User.objects.create_user(
            username='regular', password='Test@123456'
        )
        self.staff_user = User.objects.create_user(
            username='staffuser', password='Test@123456', is_staff=True
        )

    def _login(self, username):
        user = User.objects.get(username=username)
        cfg, _ = UserConfig.objects.get_or_create(user=user)
        if not cfg.email_verified:
            cfg.email_verified = True
            cfg.save(update_fields=['email_verified', 'updated_at'])
        resp = self.client.post(
            '/api/auth/token/',
            {'username': username, 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_unauthenticated_returns_401(self):
        resp = self.client.get(URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_regular_user_returns_403(self):
        self._login('regular')
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_user_returns_200(self):
        self._login('staffuser')
        with patch('portfolio.views.redis_lib') as _mock_redis:
            _mock_redis.from_url.return_value.ping.return_value = True
            resp = self.client.get(URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class AdminOpsStatsDataTests(APITestCase):
    """Tests 3-12: nội dung response."""

    def setUp(self):
        # Tạo staff user
        self.staff = User.objects.create_user(
            username='admin_ops_staff', password='Test@123456', is_staff=True
        )
        # Tạo thêm một user thường
        self.user2 = User.objects.create_user(
            username='user2', password='Test@123456'
        )
        # Portfolio cho staff
        self.portfolio = Portfolio.objects.create(
            user=self.staff, name='Test Portfolio'
        )
        # TrackedSymbol
        TrackedSymbol.objects.create(user=self.staff, symbol='VNM')
        TrackedSymbol.objects.create(user=self.staff, symbol='HPG')
        # WatchlistGroup + items
        group = WatchlistGroup.objects.create(user=self.staff, name='G1')
        WatchlistItem.objects.create(group=group, symbol='FPT')
        WatchlistItem.objects.create(group=group, symbol='MWG')

        # Đăng nhập
        cfg, _ = UserConfig.objects.get_or_create(user=self.staff)
        if not cfg.email_verified:
            cfg.email_verified = True
            cfg.save(update_fields=['email_verified', 'updated_at'])
        resp = self.client.post(
            '/api/auth/token/',
            {'username': 'admin_ops_staff', 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def _get_stats(self):
        with patch('portfolio.views.redis_lib') as mock_r:
            mock_r.from_url.return_value.ping.return_value = True
            resp = self.client.get(URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp.data

    def test_response_has_all_required_keys(self):
        data = self._get_stats()
        required_keys = [
            'user_count', 'portfolio_count', 'tracked_symbol_count',
            'watchlist_item_count', 'last_market_group_sync', 'last_stock_profile_sync',
            'channel_layer_type', 'realtime_enabled', 'redis_ok',
            'ticker_prefetch',
            'whale_config_propagation', 'whale_config_anomaly', 'whale_config_dashboard',
        ]
        for key in required_keys:
            self.assertIn(key, data, f"Missing key: {key}")

    @patch('config.health.build_prefetch_health_snapshot')
    def test_ticker_prefetch_payload_present(self, mock_prefetch_snapshot):
        mock_prefetch_snapshot.return_value = {
            'healthy': True,
            'meta_present': True,
            'freshness_seconds': 5,
            'sample_cache_hits': 3,
            'sample_cache_total': 3,
            'prefetch': {'status': 'ok'},
        }
        data = self._get_stats()
        self.assertIn('ticker_prefetch', data)
        self.assertTrue(data['ticker_prefetch']['healthy'])


class AdminOpsWarmPrefetchTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='warm_staff', password='Test@123456', is_staff=True
        )
        self.user2 = User.objects.create_user(
            username='warm_user2', password='Test@123456'
        )
        self.portfolio = Portfolio.objects.create(
            user=self.staff, name='Warm Test Portfolio'
        )
        TrackedSymbol.objects.create(user=self.staff, symbol='VNM')
        TrackedSymbol.objects.create(user=self.staff, symbol='HPG')
        group = WatchlistGroup.objects.create(user=self.staff, name='WarmG1')
        WatchlistItem.objects.create(group=group, symbol='FPT')
        WatchlistItem.objects.create(group=group, symbol='MWG')
        cfg, _ = UserConfig.objects.get_or_create(user=self.staff)
        if not cfg.email_verified:
            cfg.email_verified = True
            cfg.save(update_fields=['email_verified', 'updated_at'])
        resp = self.client.post(
            '/api/auth/token/',
            {'username': 'warm_staff', 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def _get_stats(self):
        with patch('portfolio.views.redis_lib') as mock_r:
            mock_r.from_url.return_value.ping.return_value = True
            resp = self.client.get(URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp.data

    def test_warm_prefetch_requires_auth(self):
        self.client.credentials()
        resp = self.client.post(WARM_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_offpeak_ingest_requires_auth(self):
        self.client.credentials()
        resp = self.client.post(OFFPEAK_INGEST_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_offpeak_ingest_history_requires_auth(self):
        self.client.credentials()
        resp = self.client.get(OFFPEAK_INGEST_HISTORY_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    @patch('config.health.build_prefetch_health_snapshot')
    @patch('portfolio.tasks.schedule_realtime_prefetch_shards.apply_async')
    def test_staff_can_queue_async_prefetch_warm(self, mock_apply_async, mock_prefetch_snapshot):
        class _Task:
            id = 'task-123'

        mock_apply_async.return_value = _Task()
        mock_prefetch_snapshot.return_value = {'healthy': False, 'meta_present': True}

        resp = self.client.post(WARM_URL)
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(resp.data['queued'])
        self.assertEqual(resp.data['task_id'], 'task-123')

    @patch('config.health.build_prefetch_health_snapshot')
    @patch('portfolio.tasks.schedule_realtime_prefetch_shards.run')
    @patch('portfolio.tasks.build_realtime_symbol_universe_snapshot.run')
    def test_sync_warm_prefetch_returns_payload_without_http_503_on_non_ok(
        self,
        mock_universe_run,
        mock_schedule_run,
        mock_prefetch_snapshot,
    ):
        mock_universe_run.return_value = {
            'status': 'ok',
            'all_symbols': 4,
            'hot_symbols': 4,
        }
        mock_schedule_run.return_value = {
            'status': 'parse_zero_cached',
            'reason': 'no_rows_parsed_from_provider_payload',
            'cached': 0,
        }
        mock_prefetch_snapshot.return_value = {
            'healthy': False,
            'status': 'parse_zero_cached',
            'reason': 'parse_zero_cached',
        }

        resp = self.client.post(f'{WARM_URL}?mode=sync')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['ok'])
        self.assertFalse(resp.data['queued'])
        self.assertEqual(resp.data['result']['scheduler']['status'], 'parse_zero_cached')

    @patch('config.health.build_prefetch_health_snapshot')
    @patch('portfolio.tasks.offpeak_vnstock_ingest.apply_async')
    def test_staff_can_queue_async_offpeak_ingest(self, mock_apply_async, mock_prefetch_snapshot):
        class _Task:
            id = 'offpeak-task-123'

        mock_apply_async.return_value = _Task()
        mock_prefetch_snapshot.return_value = {'healthy': True}

        resp = self.client.post(f'{OFFPEAK_INGEST_URL}?days=3&max_symbols=120')

        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(resp.data['queued'])
        self.assertEqual(resp.data['task_id'], 'offpeak-task-123')
        self.assertEqual(resp.data['kwargs']['days'], 3)
        self.assertEqual(resp.data['kwargs']['max_symbols'], 120)

    @patch('config.health.build_prefetch_health_snapshot')
    @patch('portfolio.tasks.offpeak_vnstock_ingest.run')
    def test_sync_offpeak_ingest_returns_payload(self, mock_offpeak_run, mock_prefetch_snapshot):
        mock_offpeak_run.return_value = {
            'status': 'ok',
            'symbols_total': 5,
            'symbols_ingested': 5,
            'db_created': 10,
            'db_updated': 2,
            'cache_refreshed': 5,
        }
        mock_prefetch_snapshot.return_value = {'healthy': True}

        resp = self.client.post(f'{OFFPEAK_INGEST_URL}?mode=sync&days=2')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['queued'])
        self.assertTrue(resp.data['ok'])
        self.assertEqual(resp.data['result']['status'], 'ok')
        self.assertEqual(resp.data['result']['symbols_ingested'], 5)

    @patch('portfolio.views_admin_runtime._read_offpeak_ingest_history')
    def test_offpeak_ingest_history_returns_latest_and_list(self, mock_history):
        mock_history.return_value = {
            'latest': {'status': 'ok', 'generated_at': '2026-04-16T00:00:00+07:00'},
            'history': [
                {'status': 'ok', 'generated_at': '2026-04-16T00:00:00+07:00'},
                {'status': 'partial', 'generated_at': '2026-04-15T18:10:00+07:00'},
            ],
            'total_entries': 2,
            'limit': 10,
        }

        resp = self.client.get(f'{OFFPEAK_INGEST_HISTORY_URL}?limit=10')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['ok'])
        self.assertEqual(resp.data['total_entries'], 2)
        self.assertEqual(len(resp.data['history']), 2)
        self.assertEqual(resp.data['latest']['status'], 'ok')

    def test_user_count_includes_all_users(self):
        data = self._get_stats()
        expected = User.objects.count()
        self.assertEqual(data['user_count'], expected)

    def test_portfolio_count_is_correct(self):
        data = self._get_stats()
        expected = Portfolio.objects.count()
        self.assertEqual(data['portfolio_count'], expected)

    def test_tracked_symbol_count_is_correct(self):
        data = self._get_stats()
        expected = TrackedSymbol.objects.count()
        self.assertEqual(data['tracked_symbol_count'], expected)

    def test_watchlist_item_count_is_correct(self):
        data = self._get_stats()
        expected = WatchlistItem.objects.count()
        self.assertEqual(data['watchlist_item_count'], expected)

    def test_redis_ok_field_present_in_response(self):
        data = self._get_stats()
        self.assertIn('redis_ok', data)

    def test_channel_layer_type_field_is_string(self):
        data = self._get_stats()
        self.assertIsInstance(data['channel_layer_type'], str)

    def test_last_market_group_sync_none_when_no_log(self):
        MarketGroupSyncLog.objects.all().delete()
        data = self._get_stats()
        self.assertIsNone(data['last_market_group_sync'])

    def test_last_stock_profile_sync_none_when_no_log(self):
        StockProfileSyncLog.objects.all().delete()
        data = self._get_stats()
        self.assertIsNone(data['last_stock_profile_sync'])

    def test_last_market_group_sync_populated_when_log_exists(self):
        MarketGroupSyncLog.objects.create(
            scope='GLOBAL',
            requested_by=self.staff,
            mode='all',
            success=True,
            message='sync ok',
        )
        data = self._get_stats()
        log_data = data['last_market_group_sync']
        self.assertIsNotNone(log_data)
        self.assertIn('started_at', log_data)
        self.assertIn('success', log_data)
        self.assertTrue(log_data['success'])

    @patch('portfolio.services.get_live_celery_worker_summary')
    def test_whale_dashboard_includes_rollout_postcheck_summary(self, mock_worker_summary):
        mock_worker_summary.return_value = {
            'ok': True,
            'source': 'test',
            'detail': 'workers=1',
            'live_count': 1,
            'reporting_stats_count': 1,
            'ack_expected_count': 1,
            'acknowledged_count': 1,
            'pending_ack_count': 0,
            'stale_ack_count': 0,
            'pool_process_count': 1,
            'total_cpu_seconds': 3.5,
            'total_maxrss_mb': 128.0,
            'avg_maxrss_mb': 128.0,
            'workers': [
                {
                    'worker_name': 'mission-control@win',
                    'live': True,
                    'ack_state': 'acked',
                    'acked': True,
                    'acked_at': None,
                    'worker_version': 'v2026.04.03-active',
                    'stats_available': True,
                    'cpu_user_seconds': 2.5,
                    'cpu_system_seconds': 1.0,
                    'maxrss_mb': 128.0,
                    'pool_processes': ['4321'],
                    'pool_process_count': 1,
                    'max_concurrency': 1,
                    'details': 'loaded_ok',
                }
            ],
        }

        active_version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-active',
            config_json={'whale_threshold': 700},
            created_by=self.staff,
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
        )
        active_rollout = WhaleConfigRollout.objects.create(
            version=active_version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            initiated_by=self.staff,
        )
        WhaleConfigWorkerAck.objects.create(
            rollout=active_rollout,
            worker_name='mission-control@win',
            worker_version=active_version.version_code,
            acked=True,
        )

        pending_version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-pending',
            config_json={'whale_threshold': 900},
            created_by=self.staff,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        pending_rollout = WhaleConfigRollout.objects.create(
            version=pending_version,
            mode=WhaleConfigRollout.ModeChoices.SCHEDULED,
            status=WhaleConfigRollout.StatusChoices.PENDING,
            initiated_by=self.staff,
        )

        advisory_5m = WhaleAdvisory.objects.create(
            symbol='FPT',
            matched_value=1_200_000_000,
            side='BUY',
            threshold=700_000_000,
            ai_summary='recent advisory',
            ai_detail='recent advisory detail',
        )
        WhaleAdvisory.objects.filter(pk=advisory_5m.pk).update(created_at=advisory_5m.created_at - timedelta(minutes=3))
        advisory_10m = WhaleAdvisory.objects.create(
            symbol='HPG',
            matched_value=900_000_000,
            side='SELL',
            threshold=700_000_000,
            ai_summary='older advisory',
            ai_detail='older advisory detail',
        )
        WhaleAdvisory.objects.filter(pk=advisory_10m.pk).update(created_at=advisory_10m.created_at - timedelta(minutes=8))

        data = self._get_stats()

        dashboard = data['whale_config_dashboard']
        self.assertEqual(dashboard['active_version']['version_code'], active_version.version_code)
        self.assertEqual(dashboard['active_rollout']['rollout_id'], active_rollout.id)
        self.assertEqual(dashboard['pending_rollout']['rollout_id'], pending_rollout.id)
        self.assertEqual(dashboard['alerts']['last_5m_count'], 1)
        self.assertEqual(dashboard['alerts']['last_10m_count'], 2)
        self.assertEqual(dashboard['worker_summary']['live_count'], 1)
        self.assertEqual(dashboard['propagation']['signal'], 'green')


class AdminOpsVnstockRuntimeConfigTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='vnstock_staff', password='Test@123456', is_staff=True)
        self.user = User.objects.create_user(username='vnstock_user', password='Test@123456')

        for account in (self.staff, self.user):
            cfg, _ = UserConfig.objects.get_or_create(user=account)
            if not cfg.email_verified:
                cfg.email_verified = True
                cfg.save(update_fields=['email_verified', 'updated_at'])

    def _login(self, username, password='Test@123456'):
        resp = self.client.post('/api/auth/token/', {'username': username, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_non_staff_forbidden(self):
        self._login('vnstock_user')
        resp = self.client.get(VNSTOCK_CURRENT_URL)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_get_update_and_read_changelog(self):
        self._login('vnstock_staff')

        current_resp = self.client.get(VNSTOCK_CURRENT_URL)
        self.assertEqual(current_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(current_resp.data['ok'])

        update_payload = {
            'max_concurrency': 9,
            'retry_attempts': 2,
            'retry_backoff_seconds': 0.5,
            'price_board_source': 'VCI',
            'fallback_sources': ['KBS', 'VCI'],
            'timeout_config': {
                'price_board': 9,
                'intraday': 9,
                'financial_ratio': 11,
                'history': 13,
                'listing': 13,
                'general': 9,
            },
        }
        update_resp = self.client.patch(VNSTOCK_UPDATE_URL, update_payload, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['settings']['max_concurrency'], 9)
        self.assertEqual(update_resp.data['settings']['retry_attempts'], 2)

        changelog_resp = self.client.get(VNSTOCK_CHANGELOG_URL)
        self.assertEqual(changelog_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(changelog_resp.data['ok'])
        self.assertGreaterEqual(changelog_resp.data['count'], 1)

    def test_staff_can_reset_defaults(self):
        self._login('vnstock_staff')
        RuntimeVnstockConfig.get_or_create_singleton()

        self.client.patch(VNSTOCK_UPDATE_URL, {'max_concurrency': 7}, format='json')
        reset_resp = self.client.post(VNSTOCK_RESET_URL, {}, format='json')
        self.assertEqual(reset_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(reset_resp.data['settings']['max_concurrency'], 12)


class AdminOpsVnstockBenchmarkTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='vn_bench_staff', password='Test@123456', is_staff=True)
        self.user = User.objects.create_user(username='vn_bench_user', password='Test@123456')

        for account in (self.staff, self.user):
            cfg, _ = UserConfig.objects.get_or_create(user=account)
            if not cfg.email_verified:
                cfg.email_verified = True
                cfg.save(update_fields=['email_verified', 'updated_at'])

    def _login(self, username, password='Test@123456'):
        resp = self.client.post('/api/auth/token/', {'username': username, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_non_staff_cannot_run_benchmark(self):
        self._login('vn_bench_user')
        resp = self.client.post(VNSTOCK_BENCHMARK_RUN_URL, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    @patch('portfolio.views_admin_vnstock_benchmark.set_latest_price_board_benchmark_report')
    @patch('portfolio.tasks_maintenance.run_vnstock_price_board_benchmark.apply_async')
    @patch('config.celery.app.control.inspect')
    def test_staff_can_run_benchmark(self, mock_inspect, mock_apply_async, mock_set_latest):
        self._login('vn_bench_staff')

        class _Task:
            id = 'bench-task-123'

        inspect_obj = mock_inspect.return_value
        inspect_obj.ping.return_value = {'worker@local': {'ok': 'pong'}}
        inspect_obj.active.return_value = {'worker@local': []}
        inspect_obj.reserved.return_value = {'worker@local': []}
        mock_apply_async.return_value = _Task()

        resp = self.client.post(VNSTOCK_BENCHMARK_RUN_URL, {'symbol': 'VNM'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(resp.data['ok'])
        self.assertEqual(resp.data['status'], 'started')
        self.assertEqual(resp.data['mode'], 'celery')
        self.assertEqual(resp.data['task_id'], 'bench-task-123')
        self.assertTrue(mock_set_latest.called)

    @patch('portfolio.views_admin_vnstock_benchmark.get_latest_price_board_benchmark_report')
    def test_staff_can_get_latest_benchmark_report(self, mock_latest):
        self._login('vn_bench_staff')
        mock_latest.return_value = {
            'symbol': 'VNM',
            'results': [{'provider': 'KBS', 'concurrency': 8, 'requests_per_minute': 450.0}],
            'recommendation': {'primary_provider': 'KBS', 'fallback_provider': 'VCI'},
        }

        resp = self.client.get(VNSTOCK_BENCHMARK_LATEST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['ok'])
        self.assertTrue(resp.data['has_report'])
        self.assertEqual(resp.data['report']['symbol'], 'VNM')

    @patch('portfolio.views_admin_vnstock_benchmark.get_latest_price_board_benchmark_report')
    def test_latest_benchmark_fail_soft_when_loader_errors(self, mock_latest):
        self._login('vn_bench_staff')
        mock_latest.side_effect = RuntimeError('cache backend unavailable')

        resp = self.client.get(VNSTOCK_BENCHMARK_LATEST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['ok'])
        self.assertFalse(resp.data['has_report'])
        self.assertEqual(resp.data['status'], 'temporarily_unavailable')
