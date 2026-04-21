from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import DailyPrice


class ApiRouteStockTechnicalsBulkTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def _seed_daily_prices(self, symbol, sessions=60):
        today = timezone.now().date()
        for index in range(sessions):
            day = today - timedelta(days=(sessions - index))
            close_value = 100 + index
            DailyPrice.objects.create(
                symbol=symbol,
                date=day,
                open_price=close_value - 1,
                high_price=close_value + 2,
                low_price=close_value - 2,
                close_price=close_value,
                volume=1_000_000 + (index * 1000),
            )

    def test_bulk_technicals_requires_non_empty_symbols(self):
        self.authenticate()

        response = self.client.post('/api/stock-management/technicals/bulk/', {'symbols': []}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_bulk_technicals_rejects_over_limit_symbols(self):
        self.authenticate()
        symbols = [f'TK{i:03d}' for i in range(101)]

        response = self.client.post('/api/stock-management/technicals/bulk/', {'symbols': symbols}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_bulk_technicals_returns_normalized_deduped_results(self):
        self.authenticate()
        self._seed_daily_prices('FPT')
        self._seed_daily_prices('VCB')

        response = self.client.post(
            '/api/stock-management/technicals/bulk/',
            {'symbols': ['fpt', 'FPT', '  vcb  ', 'NO_DATA']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('requested_count'), 3)

        technicals = response.data.get('technicals', [])
        symbols = [item.get('symbol') for item in technicals]
        self.assertEqual(symbols, ['FPT', 'VCB'])

        first_item = technicals[0]
        self.assertIn('rsi_14', first_item)
        self.assertIn('sma20', first_item)
        self.assertIn('sma50', first_item)
        self.assertIn('momentum_20d_pct', first_item)
