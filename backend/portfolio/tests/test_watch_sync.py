from datetime import date
from unittest.mock import patch

from django.core.cache import cache
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import SecuritiesGroup, SecuritiesItem, TrackedSymbol, WatchlistGroup, WatchlistItem
from portfolio.services import sync_watchlist_prices


class WatchAssetSyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='watch-sync-user', password='Test@123456')
        self.group = SecuritiesGroup.objects.create(name='VN30', group_type='MARKET_CAP')
        SecuritiesItem.objects.create(group=self.group, symbol='FPT')
        TrackedSymbol.objects.create(user=self.user, symbol='VCB')
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Canh bao ngan han')
        WatchlistItem.objects.create(group=watchlist_group, symbol='HPG')

    @patch('portfolio.services.fetch_and_save_daily_prices')
    def test_sync_watchlist_prices_collects_union_of_all_watch_sources_for_admin_scope(self, mock_fetch):
        mock_fetch.side_effect = lambda symbol, start_date=None: {'symbol': symbol, 'created': 1, 'updated': 0, 'errors': 0}

        results = sync_watchlist_prices(self.user.id, days=5, include_global_groups=True)

        self.assertEqual(sorted(item['symbol'] for item in results), ['FPT', 'HPG', 'VCB'])
        self.assertEqual(mock_fetch.call_count, 3)

    @patch('portfolio.services.fetch_and_save_daily_prices')
    def test_sync_watchlist_prices_defaults_to_user_symbols_only(self, mock_fetch):
        mock_fetch.side_effect = lambda symbol, start_date=None: {'symbol': symbol, 'created': 1, 'updated': 0, 'errors': 0}

        results = sync_watchlist_prices(self.user.id, days=5)

        self.assertEqual(sorted(item['symbol'] for item in results), ['HPG', 'VCB'])
        self.assertEqual(mock_fetch.call_count, 2)


class WatchSyncApiCooldownTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='watch-sync-api-user', password='Test@123456')
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Canh bao')
        WatchlistItem.objects.create(group=watchlist_group, symbol='HPG')
        TrackedSymbol.objects.create(user=self.user, symbol='VCB')

    @patch('portfolio.views_portfolio_watchlist.sync_watchlist_prices')
    @patch.dict('os.environ', {'SYNC_PRICE_COOLDOWN_SECONDS': '60', 'SYNC_PRICE_COOLDOWN_SECONDS_STAFF': '5'}, clear=False)
    def test_watchlist_sync_endpoint_enforces_user_cooldown(self, mock_sync_watchlist_prices):
        mock_sync_watchlist_prices.return_value = [{'symbol': 'HPG'}, {'symbol': 'VCB'}]
        self.client.force_authenticate(user=self.user)

        first = self.client.post('/api/portfolio/watchlist/sync/', {'days': 5}, format='json')
        second = self.client.post('/api/portfolio/watchlist/sync/', {'days': 5}, format='json')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('retry_after_seconds', second.data)
        self.assertEqual(mock_sync_watchlist_prices.call_count, 1)
