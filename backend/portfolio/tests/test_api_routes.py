from unittest.mock import patch

from django.contrib.auth.models import User
from portfolio.models import DailyPrice, SecuritiesGroup, SecuritiesItem, StockProfile, TrackedSymbol, WatchlistGroup, WatchlistItem
from datetime import date, timedelta
from rest_framework import status
from rest_framework.test import APITestCase


class ApiRouteSmokeTests(APITestCase):
    def setUp(self):
        self.username = 'route-smoke-user'
        self.password = 'Test@123456'
        self.user = User.objects.create_user(
            username=self.username,
            email='route-smoke@example.com',
            password=self.password,
        )

    def authenticate(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_jwt_token_obtain_endpoint(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_portfolio_userconfig_endpoint(self):
        self.authenticate()

        response = self.client.get('/api/portfolio/userconfig/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('whale_alert_threshold', response.data)

    def test_stock_management_groups_endpoint(self):
        self.authenticate()

        response = self.client.get('/api/stock-management/groups/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    @patch('portfolio.views.sync_stock_profiles')
    def test_admin_sync_stockprofile_endpoint(self, mock_sync_stock_profiles):
        self.authenticate()
        mock_sync_stock_profiles.return_value = {
            'success': True,
            'message': 'Đã đồng bộ mã chứng khoán từ thị trường.',
            'warning': None,
            'source': 'vnstock',
            'total_symbols': 10,
            'created_symbols': 3,
            'updated_symbols': 7,
        }

        response = self.client.post('/api/admin-sync/stockprofile/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])
        mock_sync_stock_profiles.assert_called_once()

    def test_realtime_ticker_fallback_endpoint(self):
        self.authenticate()
        DailyPrice.objects.create(symbol='VNM', date=date.today(), close_price=100000)

        response = self.client.get('/api/realtime/ticker/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertIn('current_price', response.data)
        self.assertIn('freshness_seconds', response.data)
        self.assertIn('stale', response.data)

    def test_price_alert_rule_crud_and_trigger_endpoint(self):
        self.authenticate()
        DailyPrice.objects.create(symbol='FPT', date=date.today(), close_price=120000)

        create_response = self.client.post(
            '/api/stock-management/price-alerts/',
            {
                'symbol': 'FPT',
                'condition': 'ABOVE',
                'target_price': '118000',
                'cooldown_seconds': 300,
                'is_active': True,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['symbol'], 'FPT')
        self.assertTrue(create_response.data['is_triggered'])

        list_response = self.client.get('/api/stock-management/price-alerts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        rule_id = create_response.data['id']
        trigger_response = self.client.post(f'/api/stock-management/price-alerts/{rule_id}/mark-triggered/', {}, format='json')
        self.assertEqual(trigger_response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(trigger_response.data['last_triggered_at'])

        delete_response = self.client.delete(f'/api/stock-management/price-alerts/{rule_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_stock_workspace_overview_and_chart_endpoints(self):
        self.authenticate()
        latest_date = date.today()
        for offset in range(60, -1, -1):
            current_date = latest_date - timedelta(days=offset)
            close_price = 100000 + ((60 - offset) * 500)
            DailyPrice.objects.create(
                symbol='VNM',
                date=current_date,
                open_price=close_price - 800,
                high_price=close_price + 1200,
                low_price=close_price - 1500,
                close_price=close_price,
                volume=1000000 + ((60 - offset) * 10000),
            )
        StockProfile.objects.create(
            symbol='VNM',
            company_name='CTCP Sua Viet Nam',
            industry='Thuc pham',
            exchange='HOSE',
            is_active=True,
        )
        group = SecuritiesGroup.objects.create(
            name='Bluechips',
            group_type='CUSTOM',
            description='Nhom lon',
            color='#22c55e',
            order=1,
        )
        SecuritiesItem.objects.create(group=group, symbol='VNM')
        TrackedSymbol.objects.create(user=self.user, symbol='VNM', source_group=group)
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Theo doi sat')
        WatchlistItem.objects.create(group=watchlist_group, symbol='VNM')

        overview_response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(overview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(overview_response.data['symbol'], 'VNM')
        self.assertEqual(overview_response.data['current_price'], 130000.0)
        self.assertTrue(overview_response.data['is_tracked'])
        self.assertIsNotNone(overview_response.data['tracked_symbol_id'])
        self.assertIn('Bluechips', overview_response.data['market_groups'])
        self.assertIn('Theo doi sat', overview_response.data['watchlist_groups'])
        self.assertEqual(len(overview_response.data['watchlist_memberships']), 1)

        chart_response = self.client.get('/api/stock-management/stocks/VNM/chart/?days=90')

        self.assertEqual(chart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(chart_response.data['symbol'], 'VNM')
        self.assertEqual(chart_response.data['days'], 90)
        self.assertEqual(len(chart_response.data['points']), 61)
        self.assertIn('open', chart_response.data['points'][0])
        self.assertIn('high', chart_response.data['points'][0])
        self.assertIn('low', chart_response.data['points'][0])
        self.assertIn('volume', chart_response.data['points'][0])
        self.assertEqual(chart_response.data['points'][0]['open'], 99200.0)
        self.assertEqual(chart_response.data['points'][0]['high'], 101200.0)
        self.assertEqual(chart_response.data['points'][0]['low'], 98500.0)
        self.assertEqual(chart_response.data['points'][0]['volume'], 1000000.0)
        self.assertIn('technical', chart_response.data)
        self.assertEqual(chart_response.data['technical']['bias'], 'BULLISH')
        self.assertEqual(chart_response.data['technical']['bias_label'], 'Tăng')
        self.assertIn('động lượng', chart_response.data['technical']['bias_description'])
        self.assertIsNotNone(chart_response.data['technical']['sma20'])
        self.assertIsNotNone(chart_response.data['technical']['sma50'])
        self.assertIsNotNone(chart_response.data['technical']['rsi14'])

    def test_market_group_write_endpoints_are_read_only(self):
        self.authenticate()
        group = SecuritiesGroup.objects.create(name='Shared VN30', group_type='MARKET_CAP')
        item = SecuritiesItem.objects.create(group=group, symbol='FPT')

        create_response = self.client.post('/api/stock-management/groups/', {'name': 'New shared group'}, format='json')
        patch_response = self.client.patch(f'/api/stock-management/groups/{group.id}/', {'name': 'Renamed'}, format='json')
        delete_response = self.client.delete(f'/api/stock-management/groups/{group.id}/')
        add_item_response = self.client.post(f'/api/stock-management/groups/{group.id}/items/', {'symbol': 'VCB'}, format='json')
        delete_item_response = self.client.delete(f'/api/stock-management/items/{item.id}/')

        self.assertEqual(create_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(patch_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(delete_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(add_item_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(delete_item_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)