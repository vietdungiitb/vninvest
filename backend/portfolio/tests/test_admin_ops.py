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
