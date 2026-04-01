from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

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
    def test_sync_watchlist_prices_collects_union_of_all_watch_sources(self, mock_fetch):
        mock_fetch.side_effect = lambda symbol, start_date=None: {'symbol': symbol, 'created': 1, 'updated': 0, 'errors': 0}

        results = sync_watchlist_prices(self.user.id, days=5)

        self.assertEqual(sorted(item['symbol'] for item in results), ['FPT', 'HPG', 'VCB'])
        self.assertEqual(mock_fetch.call_count, 3)