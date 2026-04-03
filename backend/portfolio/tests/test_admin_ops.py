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
            'whale_config_propagation', 'whale_config_anomaly', 'whale_config_dashboard',
        ]
        for key in required_keys:
            self.assertIn(key, data, f"Missing key: {key}")

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
