import pandas as pd
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from unittest.mock import patch

from portfolio.models import TrackedSymbol
from portfolio.tasks import prefetch_ticker_price_board


class PrefetchTickerPriceBoardNormalizationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='prefetch-user', password='Test@123456')
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

    @patch('portfolio.tasks.fetch_price_board_dataframe')
    def test_prefetch_normalizes_vci_prices_to_vnd_before_caching(self, mock_fetch_price_board_dataframe):
        columns = pd.MultiIndex.from_tuples([
            ('listing', 'symbol'),
            ('listing', 'ref_price'),
            ('match', 'match_price'),
            ('match', 'highest'),
            ('match', 'lowest'),
            ('match', 'open_price'),
            ('match', 'accumulated_volume'),
        ])
        mock_fetch_price_board_dataframe.return_value = pd.DataFrame([
            ['FPT', 78.0, 79.0, 79.5, 77.5, 78.1, 123456],
        ], columns=columns)

        result = prefetch_ticker_price_board.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['cached'], 1)

        cached_ticker = cache.get('ticker:FPT')
        self.assertIsNotNone(cached_ticker)
        self.assertEqual(cached_ticker['current_price'], 79.0)
        self.assertEqual(cached_ticker['prev_price'], 78.0)
        self.assertEqual(cached_ticker['high_price'], 79.5)
        self.assertEqual(cached_ticker['low_price'], 77.5)
        self.assertEqual(cached_ticker['open_price'], 78.1)
