from unittest.mock import MagicMock, patch
from decimal import Decimal

from django.contrib.auth.models import User
import pandas as pd
from portfolio.models import DailyPrice, IntradayTick, SecuritiesGroup, SecuritiesItem, StockProfile, TrackedSymbol, UserConfig, WatchlistGroup, WatchlistItem, WhaleAdvisory
from portfolio.email_verification import generate_email_verification_token
from datetime import date, datetime, timedelta
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
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True},
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

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_register_endpoint_creates_unverified_user_and_sends_verification_email(self, mock_send_verification_email):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new_register_user',
                'email': 'new-register@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'new_register_user')
        self.assertEqual(response.data['plan'], 'free')
        self.assertTrue(response.data['verification_required'])
        created_user = User.objects.get(username='new_register_user')
        self.assertEqual(created_user.email, 'new-register@example.com')
        self.assertTrue(UserConfig.objects.filter(user=created_user, email_verified=False).exists())
        self.assertIsNotNone(created_user.user_config.email_verification_sent_at)
        mock_send_verification_email.assert_called_once_with(created_user)

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_login_is_blocked_for_unverified_user(self, _mock_send_verification_email):
        self.client.post(
            '/api/auth/register/',
            {
                'username': 'pending_verify_user',
                'email': 'pending@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        response = self.client.post(
            '/api/auth/token/',
            {'username': 'pending_verify_user', 'password': 'Test@123456'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('xac thuc email', str(response.data['detail']).lower())

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_verify_email_endpoint_marks_user_as_verified(self, _mock_send_verification_email):
        register_response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'verify_me_user',
                'email': 'verify-me@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username='verify_me_user')
        token = generate_email_verification_token(created_user)

        response = self.client.post('/api/auth/verify-email/', {'token': token}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        created_user.user_config.refresh_from_db()
        self.assertTrue(created_user.user_config.email_verified)
        self.assertIsNotNone(created_user.user_config.email_verified_at)

        login_response = self.client.post(
            '/api/auth/token/',
            {'username': 'verify_me_user', 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_response.data)

    def test_verify_email_endpoint_rejects_invalid_token(self):
        response = self.client.post('/api/auth/verify-email/', {'token': 'bad-token'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', response.data)

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_resend_verification_endpoint_uses_username_identifier(self, mock_send_verification_email):
        created_user = User.objects.create_user(
            username='resend_me_user',
            email='resend@example.com',
            password='Test@123456',
        )
        UserConfig.objects.update_or_create(user=created_user, defaults={'email_verified': False})

        response = self.client.post(
            '/api/auth/resend-verification/',
            {'identifier': 'resend_me_user'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send_verification_email.assert_called_once_with(created_user)

    def test_register_endpoint_requires_email(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'missing_email_user',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_register_endpoint_rejects_invalid_email(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'invalid_email_user',
                'email': 'not-an-email',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_register_endpoint_rejects_duplicate_username(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': self.username,
                'email': 'duplicate-user@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_register_endpoint_rejects_duplicate_email_case_insensitive(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'another_user',
                'email': 'ROUTE-SMOKE@EXAMPLE.COM',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_register_endpoint_normalizes_email_to_lowercase(self, _mock_send_verification_email):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'normalize_email_user',
                'email': 'MixedCase@Example.COM',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username='normalize_email_user')
        self.assertEqual(created_user.email, 'mixedcase@example.com')

    def test_register_endpoint_rejects_password_mismatch(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'password_mismatch_user',
                'email': 'password-mismatch@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Mismatch@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_portfolio_userconfig_endpoint(self):
        self.authenticate()

        response = self.client.get('/api/portfolio/userconfig/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('whale_alert_threshold', response.data)

    def test_auth_me_endpoint_returns_plan_and_abilities(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'whale_alert_threshold': 750, 'email_verified': True})
        self.authenticate()

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.username)
        self.assertEqual(response.data['plan'], 'premium')
        self.assertEqual(response.data['whale_alert_threshold'], 750.0)
        self.assertIn({'action': 'read', 'subject': 'WhaleAdvisory'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'WhaleAdvisoryDetail'}, response.data['abilities'])
        self.assertEqual(response.data['entitlements']['plan'], 'premium')
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory_detail'])

    def test_whale_advisory_endpoint_requires_pro(self):
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat ngan',
            ai_detail='Phan tich chi tiet',
        )

        response = self.client.get('/api/portfolio/whale-advisory/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_whale_advisory_endpoint_masks_detail_for_pro(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='VCB',
            matched_value=9_200_000_000,
            side='SELL',
            threshold=5_000_000_000,
            ai_summary='Tom tat pro',
            ai_detail='Chi tiet premium',
        )

        response = self.client.get('/api/portfolio/whale-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ai_summary'], 'Tom tat pro')
        self.assertEqual(response.data[0]['ai_detail'], '')

    def test_whale_advisory_endpoint_returns_detail_for_premium(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='HPG',
            matched_value=7_100_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat premium',
            ai_detail='Chi tiet premium day du',
        )

        response = self.client.get('/api/portfolio/whale-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['ai_detail'], 'Chi tiet premium day du')

    @patch('portfolio.views._cache_set')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_cache_key_scopes_by_user_and_threshold(self, mock_vnstock, _mock_cache_get, mock_cache_set):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 750},
        )
        self.authenticate()

        intraday_df = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
            {'time': '2026-04-03T09:31:00+07:00', 'price': 99500, 'volume': 4000, 'match_type': 'sell'},
        ])
        mock_vnstock.return_value.stock.return_value.quote.intraday.return_value = intraday_df

        response = self.client.get('/api/realtime/whale-feed/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['threshold'], 750_000_000)
        cache_key = mock_cache_set.call_args.args[0]
        self.assertEqual(cache_key, f'whale_feed:{self.user.id}:FPT:750000000')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_response_contains_scoring_contract(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []

        intraday_df = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
            {'time': '2026-04-03T09:31:00+07:00', 'price': 99500, 'volume': 4000, 'match_type': 'sell'},
        ])
        mock_vnstock.return_value.stock.return_value.quote.intraday.return_value = intraday_df

        response = self.client.get('/api/realtime/whale-feed/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['weights_version'], 'weights-v1')
        self.assertEqual(len(response.data['whale_orders']), 1)
        order = response.data['whale_orders'][0]
        self.assertIn('event_score', order)
        self.assertIn('display_score', order)
        self.assertIn('severity', order)
        self.assertIn('score_breakdown', order)
        self.assertEqual(order['weights_version'], response.data['weights_version'])
        self.assertLessEqual(order['display_score'], order['event_score'])

    def test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='hpg-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')
        self.assertEqual(response.data['results'][0]['event_id'], f"tick:{response.data['results'][0]['id']}")
        self.assertIn('event_score', response.data['results'][0])
        self.assertIn('display_score', response.data['results'][0])
        self.assertIn('severity', response.data['results'][0])
        self.assertIn('score_breakdown', response.data['results'][0])
        self.assertEqual(response.data['results'][0]['weights_version'], response.data['weights_version'])
        self.assertLessEqual(response.data['results'][0]['display_score'], response.data['results'][0]['event_score'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])

    def test_whale_feed_aggregate_supports_watchlist_filter(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Theo doi sat')
        WatchlistItem.objects.create(group=watchlist_group, symbol='HPG')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='hpg-1',
        )
        self.authenticate()

        response = self.client.get(f'/api/realtime/whale-feed/aggregate/?watchlist_group_ids={watchlist_group.id}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'watchlist')
        self.assertEqual(response.data['filters']['symbols'], ['HPG'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'HPG')

    def test_whale_feed_aggregate_cursor_is_stable_for_matched_value_sort(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='fpt-2',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:17:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-3',
        )
        self.authenticate()

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?sort=matched_value&limit=2')

        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_one.data['results']), 2)
        self.assertTrue(page_one.data['has_more'])
        page_one_ids = [item['id'] for item in page_one.data['results']]

        page_two = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?sort=matched_value&limit=2&cursor={page_one.data['next_cursor']}"
        )

        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_two.data['results']), 1)
        self.assertFalse(page_two.data['has_more'])
        self.assertNotIn(page_two.data['results'][0]['id'], page_one_ids)

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

    @patch('vnstock.Vnstock')
    def test_stock_workspace_overview_and_chart_endpoints(self, mock_vnstock):
        self.authenticate()
        stock_client = MagicMock()
        stock_client.trading.price_board.return_value = None
        stock_client.quote.history.return_value = None
        stock_client.listing.all_symbols.return_value = None
        mock_vnstock.return_value.stock.return_value = stock_client

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