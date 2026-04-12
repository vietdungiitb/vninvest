from unittest.mock import patch
from decimal import Decimal
from datetime import date, datetime

from django.contrib.auth.models import User
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import IntradayTick, StockProfile, SubAccount, TrackedSymbol, UserConfig, WhaleAdvisory


class ApiRouteTradingAndP113Tests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_whale_advisory_severity_tag_returned_in_list(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='VIC',
            matched_value=25_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='High value advisory',
            ai_detail='',
            ai_model='gpt-4o',
            severity=WhaleAdvisory.SeverityChoices.URGENT,
        )
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='MSN',
            matched_value=3_000_000_000,
            side='SELL',
            threshold=2_000_000_000,
            ai_summary='Warning advisory',
            ai_detail='',
            ai_model='gpt-4o',
            severity=WhaleAdvisory.SeverityChoices.WARNING,
        )

        response = self.client.get('/api/portfolio/whale-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        symbols_by_severity = {item['symbol']: item['severity'] for item in response.data}
        self.assertEqual(symbols_by_severity.get('VIC'), 'urgent')
        self.assertEqual(symbols_by_severity.get('MSN'), 'warning')

    def test_whale_advisory_watchlist_only_filter(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=5_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='FPT advisory',
            ai_detail='',
            ai_model='gpt-4o',
        )
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='VNM',
            matched_value=4_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='VNM advisory',
            ai_detail='',
            ai_model='gpt-4o',
        )

        response_all = self.client.get('/api/portfolio/whale-advisory/')
        response_wl = self.client.get('/api/portfolio/whale-advisory/?watchlist_only=true')

        self.assertEqual(response_all.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_all.data), 2)
        self.assertEqual(response_wl.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_wl.data), 1)
        self.assertEqual(response_wl.data[0]['symbol'], 'FPT')

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    @patch('portfolio.trading_service.TradingService.portfolio_queryset_for_user')
    def test_portfolio_endpoint_uses_refactored_trading_view_when_flag_enabled(self, mock_queryset):
        self.authenticate()
        portfolio = self.user.portfolios.create(name='Main Portfolio', description='test')
        mock_queryset.return_value = self.user.portfolios.all()

        response = self.client.get('/api/portfolio/portfolios/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['id'], portfolio.id)
        mock_queryset.assert_called_once_with(self.user)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_create_returns_400_when_user_has_no_portfolio(self):
        self.authenticate()
        other_user = User.objects.create_user(
            username='subaccount-other-user',
            email='subaccount-other@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Other Portfolio', description='test')

        response = self.client.post(
            '/api/portfolio/subaccounts/',
            {
                'name': 'No Portfolio Account',
                'type': '1',
                'margin_ratio': '1.000',
                'portfolio': other_portfolio.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('at least one Portfolio', str(response.data))

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_create_uses_requested_owned_portfolio(self):
        self.authenticate()
        first_portfolio = self.user.portfolios.create(name='First Portfolio', description='first')
        selected_portfolio = self.user.portfolios.create(name='Selected Portfolio', description='selected')

        response = self.client.post(
            '/api/portfolio/subaccounts/',
            {
                'name': 'Margin Account',
                'type': '6',
                'margin_ratio': '0.500',
                'portfolio': selected_portfolio.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['portfolio'], selected_portfolio.id)
        self.assertEqual(response.data['type'], '6')
        self.assertNotEqual(response.data['portfolio'], first_portfolio.id)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_create_rejects_foreign_portfolio(self):
        self.authenticate()
        self.user.portfolios.create(name='Owner Portfolio', description='owner')

        other_user = User.objects.create_user(
            username='subaccount-foreign-portfolio-user',
            email='subaccount-foreign-portfolio@example.com',
            password='Test@123456',
        )
        foreign_portfolio = other_user.portfolios.create(name='Foreign Portfolio', description='foreign')

        response = self.client.post(
            '/api/portfolio/subaccounts/',
            {
                'name': 'Invalid Portfolio Account',
                'type': '1',
                'margin_ratio': '1.000',
                'portfolio': foreign_portfolio.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('khong thuoc nguoi dung hien tai', str(response.data).lower())

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_create_without_portfolio_falls_back_to_first_portfolio(self):
        self.authenticate()
        self.user.portfolios.create(name='Fallback First', description='first')
        self.user.portfolios.create(name='Fallback Second', description='second')
        expected_fallback_portfolio = self.user.portfolios.first()

        response = self.client.post(
            '/api/portfolio/subaccounts/',
            {
                'name': 'Fallback Account',
                'type': '1',
                'margin_ratio': '1.000',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['portfolio'], expected_fallback_portfolio.id)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_update_rejects_foreign_subaccount(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Own Portfolio', description='own')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='Own Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        other_user = User.objects.create_user(
            username='subaccount-update-foreign-user',
            email='subaccount-update-foreign@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Other Portfolio', description='other')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Foreign Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        own_response = self.client.patch(
            f'/api/portfolio/subaccounts/{own_sub_account.id}/',
            {'name': 'Own Account Updated', 'margin_ratio': '0.800'},
            format='json',
        )
        foreign_response = self.client.patch(
            f'/api/portfolio/subaccounts/{foreign_sub_account.id}/',
            {'name': 'Should Fail'},
            format='json',
        )

        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(own_response.data['name'], 'Own Account Updated')
        self.assertEqual(foreign_response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_delete_rejects_foreign_subaccount(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Own Delete Portfolio', description='own')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='Own Delete Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        other_user = User.objects.create_user(
            username='subaccount-delete-foreign-user',
            email='subaccount-delete-foreign@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Other Delete Portfolio', description='other')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Foreign Delete Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        own_response = self.client.delete(f'/api/portfolio/subaccounts/{own_sub_account.id}/')
        foreign_response = self.client.delete(f'/api/portfolio/subaccounts/{foreign_sub_account.id}/')

        self.assertEqual(own_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(foreign_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(SubAccount.objects.filter(id=own_sub_account.id).exists())
        self.assertTrue(SubAccount.objects.filter(id=foreign_sub_account.id).exists())

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_detail_allows_owner(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Own Detail Portfolio', description='own')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='Own Detail Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        response = self.client.get(f'/api/portfolio/subaccounts/{own_sub_account.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], own_sub_account.id)
        self.assertEqual(response.data['name'], 'Own Detail Account')

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_detail_rejects_foreign_subaccount(self):
        self.authenticate()
        other_user = User.objects.create_user(
            username='subaccount-detail-foreign-user',
            email='subaccount-detail-foreign@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Other Detail Portfolio', description='other')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Foreign Detail Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        response = self.client.get(f'/api/portfolio/subaccounts/{foreign_sub_account.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_delete_cascades_subaccounts_and_transactions(self):
        self.authenticate()
        portfolio = self.user.portfolios.create(name='Cascade Portfolio', description='cascade')
        sub_account = SubAccount.objects.create(
            portfolio=portfolio,
            name='Cascade Account',
            type='1',
            margin_ratio=Decimal('1.000'),
        )
        StockProfile.objects.update_or_create(
            symbol='VCB',
            defaults={
                'company_name': 'NgÃ¢n hÃ ng TMCP Ngoáº¡i thÆ°Æ¡ng Viá»‡t Nam',
                'industry': 'Banking',
                'exchange': 'HOSE',
                'is_active': True,
            },
        )
        transaction = sub_account.transactions.create(
            symbol='VCB',
            transaction_type='BUY',
            date=date.today(),
            price=Decimal('100000'),
            quantity=Decimal('10'),
            fee=Decimal('1000'),
        )

        response = self.client.delete(f'/api/portfolio/portfolios/{portfolio.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(self.user.portfolios.filter(id=portfolio.id).exists())
        self.assertFalse(SubAccount.objects.filter(id=sub_account.id).exists())
        self.assertFalse(type(transaction).objects.filter(id=transaction.id).exists())

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_delete_rejects_foreign_portfolio(self):
        self.authenticate()
        other_user = User.objects.create_user(
            username='portfolio-delete-foreign-user',
            email='portfolio-delete-foreign@example.com',
            password='Test@123456',
        )
        foreign_portfolio = other_user.portfolios.create(name='Foreign Portfolio', description='foreign')

        response = self.client.delete(f'/api/portfolio/portfolios/{foreign_portfolio.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(type(foreign_portfolio).objects.filter(id=foreign_portfolio.id).exists())

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_update_allows_owner(self):
        self.authenticate()
        portfolio = self.user.portfolios.create(name='Owner Portfolio', description='initial')

        response = self.client.patch(
            f'/api/portfolio/portfolios/{portfolio.id}/',
            {'name': 'Owner Portfolio Updated', 'description': 'updated'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Owner Portfolio Updated')
        self.assertEqual(response.data['description'], 'updated')

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_update_rejects_foreign_portfolio(self):
        self.authenticate()
        other_user = User.objects.create_user(
            username='portfolio-update-foreign-user',
            email='portfolio-update-foreign@example.com',
            password='Test@123456',
        )
        foreign_portfolio = other_user.portfolios.create(name='Foreign Update Portfolio', description='foreign')

        response = self.client.patch(
            f'/api/portfolio/portfolios/{foreign_portfolio.id}/',
            {'name': 'Should Not Update'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        foreign_portfolio.refresh_from_db()
        self.assertEqual(foreign_portfolio.name, 'Foreign Update Portfolio')

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_detail_allows_owner(self):
        self.authenticate()
        portfolio = self.user.portfolios.create(name='Owner Detail Portfolio', description='detail')

        response = self.client.get(f'/api/portfolio/portfolios/{portfolio.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], portfolio.id)
        self.assertEqual(response.data['name'], 'Owner Detail Portfolio')

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_detail_rejects_foreign_portfolio(self):
        self.authenticate()
        other_user = User.objects.create_user(
            username='portfolio-detail-foreign-user',
            email='portfolio-detail-foreign@example.com',
            password='Test@123456',
        )
        foreign_portfolio = other_user.portfolios.create(name='Foreign Detail Portfolio', description='foreign')

        response = self.client.get(f'/api/portfolio/portfolios/{foreign_portfolio.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_portfolio_list_returns_only_owner_portfolios(self):
        self.authenticate()
        own_portfolio_1 = self.user.portfolios.create(name='Owner List 1', description='owner')
        own_portfolio_2 = self.user.portfolios.create(name='Owner List 2', description='owner')

        other_user = User.objects.create_user(
            username='portfolio-list-foreign-user',
            email='portfolio-list-foreign@example.com',
            password='Test@123456',
        )
        foreign_portfolio = other_user.portfolios.create(name='Foreign List', description='foreign')

        response = self.client.get('/api/portfolio/portfolios/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item['id'] for item in response.data}
        self.assertIn(own_portfolio_1.id, returned_ids)
        self.assertIn(own_portfolio_2.id, returned_ids)
        self.assertNotIn(foreign_portfolio.id, returned_ids)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_subaccount_list_returns_only_owner_subaccounts(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Owner SubAccount List', description='owner')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='Owner SA List',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        other_user = User.objects.create_user(
            username='subaccount-list-foreign-user',
            email='subaccount-list-foreign@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Foreign SubAccount List', description='foreign')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Foreign SA List',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        response = self.client.get('/api/portfolio/subaccounts/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item['id'] for item in response.data}
        self.assertIn(own_sub_account.id, returned_ids)
        self.assertNotIn(foreign_sub_account.id, returned_ids)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_transaction_create_rejects_foreign_sub_account(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Own Portfolio', description='test')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='TK own',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        other_user = User.objects.create_user(
            username='other-trading-user',
            email='other-trading@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Other Portfolio', description='test')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='TK foreign',
            type='1',
            margin_ratio=Decimal('1.000'),
        )
        StockProfile.objects.update_or_create(
            symbol='FPT',
            defaults={
                'company_name': 'CTCP FPT',
                'industry': 'Technology',
                'exchange': 'HOSE',
                'is_active': True,
            },
        )

        allowed_response = self.client.post(
            f'/api/portfolio/subaccounts/{own_sub_account.id}/transactions/',
            {
                'symbol': 'FPT',
                'transaction_type': 'BUY',
                'date': str(date.today()),
                'price': '100000',
                'quantity': '10',
                'fee': '1000',
            },
            format='json',
        )
        self.assertEqual(allowed_response.status_code, status.HTTP_201_CREATED)

        forbidden_response = self.client.post(
            f'/api/portfolio/subaccounts/{foreign_sub_account.id}/transactions/',
            {
                'symbol': 'FPT',
                'transaction_type': 'BUY',
                'date': str(date.today()),
                'price': '100000',
                'quantity': '10',
                'fee': '1000',
            },
            format='json',
        )

        self.assertEqual(forbidden_response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_transaction_update_rejects_foreign_transaction(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Own Tx Update', description='owner')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='Own Tx Update SA',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        other_user = User.objects.create_user(
            username='transaction-update-foreign-user',
            email='transaction-update-foreign@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Foreign Tx Update', description='foreign')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Foreign Tx Update SA',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        StockProfile.objects.update_or_create(
            symbol='HPG',
            defaults={
                'company_name': 'CTCP Táº­p Ä‘oÃ n HÃ²a PhÃ¡t',
                'industry': 'Steel',
                'exchange': 'HOSE',
                'is_active': True,
            },
        )

        own_tx = own_sub_account.transactions.create(
            symbol='HPG',
            transaction_type='BUY',
            date=date.today(),
            price=Decimal('26000'),
            quantity=Decimal('100'),
            fee=Decimal('1000'),
        )
        foreign_tx = foreign_sub_account.transactions.create(
            symbol='HPG',
            transaction_type='BUY',
            date=date.today(),
            price=Decimal('25000'),
            quantity=Decimal('100'),
            fee=Decimal('1000'),
        )

        own_response = self.client.patch(
            f'/api/portfolio/transactions/{own_tx.id}/',
            {'notes': 'owner-update'},
            format='json',
        )
        foreign_response = self.client.patch(
            f'/api/portfolio/transactions/{foreign_tx.id}/',
            {'notes': 'should-fail'},
            format='json',
        )

        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(own_response.data['notes'], 'owner-update')
        self.assertEqual(foreign_response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(ENABLE_NEW_TRADING_VIEWS=True)
    def test_refactored_transaction_delete_rejects_foreign_transaction(self):
        self.authenticate()
        own_portfolio = self.user.portfolios.create(name='Own Tx Delete', description='owner')
        own_sub_account = SubAccount.objects.create(
            portfolio=own_portfolio,
            name='Own Tx Delete SA',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        other_user = User.objects.create_user(
            username='transaction-delete-foreign-user',
            email='transaction-delete-foreign@example.com',
            password='Test@123456',
        )
        other_portfolio = other_user.portfolios.create(name='Foreign Tx Delete', description='foreign')
        foreign_sub_account = SubAccount.objects.create(
            portfolio=other_portfolio,
            name='Foreign Tx Delete SA',
            type='1',
            margin_ratio=Decimal('1.000'),
        )

        StockProfile.objects.update_or_create(
            symbol='MBB',
            defaults={
                'company_name': 'NgÃ¢n hÃ ng TMCP QuÃ¢n Ä‘á»™i',
                'industry': 'Banking',
                'exchange': 'HOSE',
                'is_active': True,
            },
        )

        own_tx = own_sub_account.transactions.create(
            symbol='MBB',
            transaction_type='BUY',
            date=date.today(),
            price=Decimal('23000'),
            quantity=Decimal('100'),
            fee=Decimal('1000'),
        )
        foreign_tx = foreign_sub_account.transactions.create(
            symbol='MBB',
            transaction_type='BUY',
            date=date.today(),
            price=Decimal('22000'),
            quantity=Decimal('100'),
            fee=Decimal('1000'),
        )

        own_response = self.client.delete(f'/api/portfolio/transactions/{own_tx.id}/')
        foreign_response = self.client.delete(f'/api/portfolio/transactions/{foreign_tx.id}/')

        self.assertEqual(own_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(foreign_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(type(own_tx).objects.filter(id=own_tx.id).exists())
        self.assertTrue(type(foreign_tx).objects.filter(id=foreign_tx.id).exists())

    # -------------------------------------------------------------------------
    # P1-13: E2E smoke tests â€” campaign board, investigation modal, window filter
    # -------------------------------------------------------------------------

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_p1_13_campaign_board_returns_valid_structure(self):
        """Campaign board endpoint returns paginated payload with required fields."""
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='VNM')
        for i in range(5):
            IntradayTick.objects.create(
                symbol='VNM',
                trade_date=date.today(),
                trade_time=datetime.strptime(f'{9+i:02d}:00:00', '%H:%M:%S').time(),
                price=Decimal('80000'),
                volume=8000,
                side='BUY',
                stream_id=f'p1-13-vnm-{i}',
            )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-campaigns/?window=session&campaign_limit=10&campaign_sort=strength')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('filters', response.data)
        if response.data['results']:
            first = response.data['results'][0]
            self.assertIn('campaign_id', first)
            self.assertIn('campaign_strength', first)
            self.assertIn('events', first)
            self.assertIn('symbol', first)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_p1_13_symbol_investigation_modal_has_sprint31_fields(self):
        """Symbol investigation modal returns all Sprint31 P1-11 payload fields."""
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='HPG')
        self.authenticate()
        from unittest.mock import patch, MagicMock

        mock_result = {
            'symbol': 'HPG',
            'window': '5d',
            'whale_campaigns': [],
            'dark_flow_signals': [],
            'correlated_campaigns': [],
            'correlated_signals': [],
            'grouped_timeline': [{'bucket_start': '2026-04-11T09:00:00+00:00', 'whale_count': 1, 'signal_count': 0, 'has_co_observation': False}],
            'timeline': [],
            'co_observation_summary': {'co_observation_count': 0},
        }
        with patch('portfolio.coobservation_service.CoObservationService.get_symbol_investigation', return_value=mock_result):
            response = self.client.get('/api/realtime/symbol-investigation/HPG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('correlated_campaigns', response.data)
        self.assertIn('correlated_signals', response.data)
        self.assertIn('grouped_timeline', response.data)
        self.assertIsInstance(response.data['grouped_timeline'], list)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_p1_13_window_filter_backward_compat(self):
        """Whale aggregate feed accepts all documented window values without error."""
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='SSI')
        self.authenticate()

        for window in ('session', '1h', '5d'):
            response = self.client.get(f'/api/realtime/whale-feed/aggregate/?window={window}&sort=ts')
            self.assertIn(response.status_code, (200, 403), msg=f'window={window} returned unexpected status {response.status_code}')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_p1_13_search_symbol_investigation_rejects_unauthenticated(self):
        """Symbol investigation endpoint requires auth â€” no regression on security gate."""
        response = self.client.get('/api/realtime/symbol-investigation/VCB/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
