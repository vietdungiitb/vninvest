from unittest.mock import MagicMock, patch
from decimal import Decimal

from django.contrib.auth.models import User
from django.test.utils import override_settings
import pandas as pd
from portfolio.exceptions import ExternalSystemException
from portfolio.models import DailyPrice, IntradayTick, SecuritiesGroup, SecuritiesItem, StockProfile, SubAccount, TrackedSymbol, UserConfig, WatchlistGroup, WatchlistItem, WhaleAdvisory, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary
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

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_queues_task_for_pro(self, mock_apply_async, _mock_cache_get):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
        )

        mock_task = MagicMock()
        mock_task.id = 'task-123'
        mock_apply_async.return_value = mock_task

        response = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])
        kwargs = mock_apply_async.call_args.kwargs['kwargs']
        self.assertEqual(kwargs['symbol'], 'FPT')
        self.assertTrue(kwargs['force_refresh'])

    def test_whale_advisory_refresh_endpoint_returns_404_if_no_existing(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()

        response = self.client.post('/api/portfolio/whale-advisory/SSI/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_whale_advisory_refresh_endpoint_returns_429_when_manual_cooldown_active(self, _mock_cache_get):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
        )

        response = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertIn('retry_after_seconds', response.data)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_stock_ai_advisory_session_get_queues_generation_when_missing(self, mock_apply_async, _mock_cache_get):
        self.authenticate()
        mock_task = MagicMock()
        mock_task.id = 'stock-ai-task-1'
        mock_apply_async.return_value = mock_task

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])
        kwargs = mock_apply_async.call_args.kwargs['kwargs']
        self.assertEqual(kwargs['symbol'], 'BCM')
        self.assertFalse(kwargs['force_refresh'])

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async', side_effect=RuntimeError('broker down'))
    def test_stock_ai_advisory_session_get_returns_503_when_queue_unavailable(self, _mock_apply_async, _mock_cache_get):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data['ok'])
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('queue', response.data['message'].lower())

    def test_stock_ai_advisory_session_get_returns_latest_advisory(self):
        self.authenticate()
        advisory = WhaleAdvisory.objects.create(
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
        )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['advisory']['id'], advisory.id)
        self.assertEqual(response.data['advisory']['symbol'], 'BCM')
        self.assertIn('components', response.data)
        self.assertIn('deleted_components', response.data)
        self.assertIn('executive_summary', response.data)
        self.assertIn('executive_summaries', response.data)

    def test_stock_ai_advisory_components_generate_creates_component_records(self):
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['ok'])
        self.assertGreaterEqual(response.data['created_count'], 3)
        self.assertIn('generated_by_ai', response.data)
        self.assertEqual(AIAdvisoryComponentRecord.objects.filter(user=self.user, symbol='BCM', is_deleted=False).count(), response.data['created_count'])

    def test_stock_ai_advisory_component_toggle_include_flips_flag(self):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        component.refresh_from_db()
        self.assertFalse(component.include_in_summary)
        self.assertFalse(response.data['component']['include_in_summary'])

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_ai_advisory_component_refresh_updates_only_target_component(self, mock_generate_with_ai):
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
        )
        target = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='old-target',
            timeframe='30m',
            include_in_summary=True,
        )
        untouched = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='old-untouched',
            timeframe='30m',
            include_in_summary=True,
        )
        mock_generate_with_ai.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI Làm mới',
                'status': 'breakout',
                'confidence_score': 8,
                'suggested_action': 'buy',
                'rationale_text': 'new-target',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{target.id}/refresh/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['component']['id'], target.id)
        self.assertEqual(response.data['component']['indicator_name'], 'RSI Làm mới')
        self.assertEqual(response.data['component']['status'], 'breakout')
        self.assertEqual(response.data['component']['suggested_action'], 'buy')
        target.refresh_from_db()
        untouched.refresh_from_db()
        self.assertEqual(target.rationale_text, 'new-target')
        self.assertEqual(untouched.rationale_text, 'old-untouched')

    def test_stock_ai_advisory_component_refresh_returns_404_when_component_missing(self):
        self.authenticate()

        response = self.client.post('/api/stock-management/ai-advisory-components/999999/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(response.data['ok'])

    def test_stock_ai_advisory_component_delete_soft_deletes_record(self):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.delete(f'/api/stock-management/ai-advisory-components/{component.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        component.refresh_from_db()
        self.assertTrue(component.is_deleted)
        self.assertFalse(component.include_in_summary)

    def test_stock_ai_advisory_component_restore_reactivates_record(self):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        component.refresh_from_db()
        self.assertFalse(component.is_deleted)
        self.assertTrue(component.include_in_summary)
        self.assertEqual(response.data['component']['id'], component.id)

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_summary_regenerate_creates_version(self, _mock_cache_get):
        self.authenticate()
        first = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='accumulation',
            confidence_score=7,
            suggested_action='buy',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )
        second = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [first.id, second.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['ok'])
        summary = AIAdvisoryExecutiveSummary.objects.filter(user=self.user, symbol='BCM').latest('created_at')
        self.assertEqual(summary.summary_version, 1)
        self.assertEqual(set(summary.used_component_ids), {first.id, second.id})

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._sprint17_generate_executive_synthesis_with_ai', return_value='- Dong 1\n- Dong 2\n- Dong 3')
    def test_stock_ai_advisory_summary_regenerate_prefers_ai_detailed_synthesis(self, _mock_ai_synthesis, _mock_cache_get):
        self.authenticate()
        first = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='accumulation',
            confidence_score=7,
            suggested_action='buy',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [first.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        summary = AIAdvisoryExecutiveSummary.objects.filter(user=self.user, symbol='BCM').latest('created_at')
        self.assertIn('- Dong 1', summary.synthesis_text)
        self.assertIn('- Dong 2', summary.synthesis_text)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._sprint17_generate_executive_synthesis_with_ai', return_value='- Chi tiet')
    def test_stock_ai_advisory_summary_regenerate_passes_synthesis_preference(self, mock_ai_synthesis, _mock_cache_get):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {
                'component_ids': [component.id],
                'synthesis_preference': 'risk_management',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_ai_synthesis.called)
        self.assertEqual(mock_ai_synthesis.call_args.kwargs.get('synthesis_preference'), 'risk_management')

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_stock_ai_advisory_summary_regenerate_returns_429_when_cooldown_active(self, _mock_cache_get):
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['ok'])
        self.assertIn('retry_after_seconds', response.data)

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_session_returns_summary_history_desc_by_version(self, _mock_cache_get):
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
        )
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='accumulation',
            confidence_score=7,
            suggested_action='buy',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [component.id]},
            format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        with patch('portfolio.views._cache_get', return_value=None):
            second = self.client.post(
                '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
                {'component_ids': [component.id]},
                format='json',
            )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        session_response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')
        self.assertEqual(session_response.status_code, status.HTTP_200_OK)
        self.assertTrue(session_response.data['executive_summaries'])
        versions = [item['summary_version'] for item in session_response.data['executive_summaries']]
        self.assertEqual(versions[0], 2)
        self.assertIn(1, versions)

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_stock_ai_advisory_session_post_returns_429_when_refresh_cooldown_active(self, _mock_cache_get):
        self.authenticate()

        response = self.client.post('/api/stock-management/stocks/BCM/ai-advisory-session/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('retry_after_seconds', response.data)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async', side_effect=RuntimeError('broker down'))
    def test_stock_ai_advisory_session_post_returns_503_when_queue_unavailable(self, _mock_apply_async, _mock_cache_get):
        self.authenticate()
        WhaleAdvisory.objects.create(
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
        )

        response = self.client.post('/api/stock-management/stocks/BCM/ai-advisory-session/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data['ok'])
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('queue', response.data['message'].lower())

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

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_falls_back_to_intraday_tick_db_when_stream_and_vnstock_unavailable(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []
        mock_vnstock.return_value.stock.return_value.quote.intraday.side_effect = RuntimeError('vnstock unavailable')

        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
            price=Decimal('61800'),
            volume=16000,
            side='BUY',
            stream_id='mwg-db-1',
        )
        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
            price=Decimal('60500'),
            volume=21000,
            side='SELL',
            stream_id='mwg-db-2',
        )

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        self.assertEqual(response.data['whale_orders'][0]['side'], 'sell')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_falls_back_to_intraday_tick_db_when_stream_has_no_threshold_hits(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 750},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = [
            {'price': 61800, 'volume': 60, 'side': 'BUY', 'ts': '2026-04-03T10:31:15+07:00'},
            {'price': 60500, 'volume': 120, 'side': 'SELL', 'ts': '2026-04-03T11:22:33+07:00'},
        ]
        mock_vnstock.return_value.stock.return_value.quote.intraday.side_effect = RuntimeError('vnstock unavailable')

        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
            price=Decimal('61800'),
            volume=16000,
            side='BUY',
            stream_id='mwg-db-threshold-1',
        )
        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
            price=Decimal('60500'),
            volume=21000,
            side='SELL',
            stream_id='mwg-db-threshold-2',
        )

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        self.assertEqual(response.data['whale_orders'][0]['side'], 'sell')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_db_fallback_keeps_older_threshold_hits_beyond_latest_500_ticks(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 750},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = [
            {'price': 79.3, 'volume': 697800, 'side': 'UNKNOWN', 'ts': '2026-04-03T14:45:00+07:00'},
        ]
        mock_vnstock.return_value.stock.return_value.quote.intraday.side_effect = RuntimeError('vnstock unavailable')

        older_hits = [
            IntradayTick(
                symbol='MWG',
                trade_date=date.today(),
                trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
                price=Decimal('61800'),
                volume=16000,
                side='BUY',
                stream_id='mwg-older-hit-1',
            ),
            IntradayTick(
                symbol='MWG',
                trade_date=date.today(),
                trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
                price=Decimal('60500'),
                volume=21000,
                side='SELL',
                stream_id='mwg-older-hit-2',
            ),
        ]
        newer_small_ticks = [
            IntradayTick(
                symbol='MWG',
                trade_date=date.today(),
                trade_time=datetime.strptime('14:45:00', '%H:%M:%S').time(),
                price=Decimal('79.30'),
                volume=697800,
                side='UNKNOWN',
                stream_id=f'mwg-small-{index}',
            )
            for index in range(501)
        ]
        IntradayTick.objects.bulk_create(older_hits + newer_small_ticks)

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        returned_sides = {item['side'] for item in response.data['whale_orders']}
        self.assertIn('buy', returned_sides)
        self.assertIn('sell', returned_sides)

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

    @patch('portfolio.realtime.stream_reader.StreamReader')
    def test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db(self, mock_stream_reader):
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
            stream_id='db-fpt-1',
        )
        mock_stream_reader.return_value.get_intraday_ticks.return_value = [
            {'price': 101000, 'volume': 10000, 'side': 'BUY', 'ts': '2026-04-03T09:20:00+07:00'},
        ]
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'redis_stream')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['source'], 'redis_stream')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('vnstock.Vnstock')
    def test_whale_feed_aggregate_falls_back_to_vnstock_after_stream_and_db_miss(self, mock_vnstock, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []
        mock_vnstock.return_value.stock.return_value.quote.intraday.return_value = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
        ])
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'vnstock')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')

    @patch.dict('os.environ', {'WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS': '2'}, clear=False)
    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('vnstock.Vnstock')
    def test_whale_feed_aggregate_skips_vnstock_fallback_for_large_symbol_sets(self, mock_vnstock, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        for symbol in ['FPT', 'HPG', 'VCB']:
            TrackedSymbol.objects.create(user=self.user, symbol=symbol)
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'intraday_tick_db')
        self.assertEqual(response.data['results'], [])
        mock_vnstock.assert_not_called()

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

    def test_whale_feed_aggregate_rejects_invalid_limit_sort_and_cursor_sort_mismatch(self):
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
            stream_id='fpt-invalid-1',
        )
        self.authenticate()

        invalid_limit_resp = self.client.get('/api/realtime/whale-feed/aggregate/?limit=0')
        self.assertEqual(invalid_limit_resp.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_sort_resp = self.client.get('/api/realtime/whale-feed/aggregate/?sort=bad_sort')
        self.assertEqual(invalid_sort_resp.status_code, status.HTTP_400_BAD_REQUEST)

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?sort=matched_value&limit=1')
        self.assertEqual(page_one.status_code, status.HTTP_200_OK)

        forced_cursor = page_one.data['next_cursor']
        if forced_cursor is None and len(page_one.data.get('results', [])) == 1:
            row = page_one.data['results'][0]
            import base64
            import json
            forced_cursor = base64.urlsafe_b64encode(
                json.dumps(
                    {
                        'sort': 'matched_value',
                        'matched_value': float(row['matched_value']),
                        'id': int(row['id']),
                    },
                    separators=(',', ':'),
                ).encode('utf-8')
            ).decode('ascii')

        self.assertIsNotNone(forced_cursor)

        cursor_mismatch_resp = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?sort=ts&limit=1&cursor={forced_cursor}"
        )
        self.assertEqual(cursor_mismatch_resp.status_code, status.HTTP_400_BAD_REQUEST)

        malformed_cursor_resp = self.client.get('/api/realtime/whale-feed/aggregate/?cursor=@@not_base64@@')
        self.assertEqual(malformed_cursor_resp.status_code, status.HTTP_400_BAD_REQUEST)

        import base64
        import json
        bad_shape_cursor = base64.urlsafe_b64encode(
            json.dumps({'sort': 'matched_value', 'id': 1}, separators=(',', ':')).encode('utf-8')
        ).decode('ascii')
        bad_shape_resp = self.client.get(
            f'/api/realtime/whale-feed/aggregate/?sort=matched_value&cursor={bad_shape_cursor}'
        )
        self.assertEqual(bad_shape_resp.status_code, status.HTTP_400_BAD_REQUEST)

        wrong_field_cursor = base64.urlsafe_b64encode(
            json.dumps(
                {'sort': 'ts', 'trade_date': str(date.today()), 'trade_time': '09:15:00', 'id': 1, 'matched_value': 100},
                separators=(',', ':'),
            ).encode('utf-8')
        ).decode('ascii')
        wrong_field_resp = self.client.get(
            f'/api/realtime/whale-feed/aggregate/?sort=ts&cursor={wrong_field_cursor}'
        )
        self.assertEqual(wrong_field_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_whale_feed_aggregate_supports_scope_param_and_meta_payload(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        WatchlistGroup.objects.create(user=self.user, name='WL empty')
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=watchlist&watchlist_group_ids=999999&limit=10&sort=ts')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'watchlist')
        self.assertIn('scope_source', response.data['filters'])
        self.assertIn('meta', response.data)
        self.assertEqual(response.data['meta']['contract_version'], '1.1')
        self.assertEqual(response.data['meta']['pagination']['limit'], 10)
        self.assertEqual(response.data['meta']['pagination']['sort'], 'ts')
        self.assertEqual(response.data['meta']['scope']['value'], 'watchlist')

    def test_whale_feed_aggregate_symbols_are_deduplicated(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-dedup-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?symbols=fpt,FPT,fpt')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'custom')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])

    def test_whale_feed_aggregate_empty_symbols_returns_empty_payload(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=symbols&symbols=,, ,')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], [])
        self.assertFalse(response.data['has_more'])
        self.assertIsNone(response.data['next_cursor'])
        self.assertEqual(response.data['filters']['scope'], 'custom')
        self.assertEqual(response.data['filters']['symbols'], [])

    def test_whale_feed_aggregate_cursor_is_stable_for_ts_sort(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:02', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-ts-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:01', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='fpt-ts-2',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-ts-3',
        )
        self.authenticate()

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?sort=ts&limit=2')
        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_one.data['results']), 2)
        self.assertTrue(page_one.data['has_more'])
        self.assertGreaterEqual(page_one.data['results'][0]['ts'], page_one.data['results'][1]['ts'])
        page_one_ids = [item['id'] for item in page_one.data['results']]

        page_two = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?sort=ts&limit=2&cursor={page_one.data['next_cursor']}"
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

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_realtime_ticker')
    def test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_realtime_ticker):
        self.authenticate()
        mock_get_realtime_ticker.return_value = {
            'symbol': 'VNM',
            'current_price': 100000,
            'freshness_seconds': 0,
            'stale': False,
            'source': 'db',
        }

        response = self.client.get('/api/realtime/ticker/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_realtime_ticker.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_intraday_matched')
    def test_realtime_intraday_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_intraday_matched):
        self.authenticate()
        mock_get_intraday_matched.return_value = {
            'symbol': 'VNM',
            'trades': [],
            'total': 0,
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/intraday/VNM/?page_size=25')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_intraday_matched.assert_called_once_with('VNM', page_size='25')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_price_board')
    def test_price_board_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_price_board):
        self.authenticate()
        mock_get_price_board.return_value = {
            'symbol': 'VNM',
            'depth': [],
            'match': {},
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/price-board/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_price_board.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_sector_breadth')
    def test_sector_breadth_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_sector_breadth):
        self.authenticate()
        mock_get_sector_breadth.return_value = {
            'symbol': 'VNM',
            'groups': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/breadth/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_sector_breadth.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_rvol')
    def test_rvol_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_rvol):
        self.authenticate()
        mock_get_rvol.return_value = {
            'symbol': 'VNM',
            'buckets': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/rvol/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_rvol.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_whale_feed')
    def test_whale_feed_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_whale_feed):
        self.authenticate()
        mock_get_whale_feed.return_value = {
            'symbol': 'VNM',
            'threshold': 500000000,
            'source': 'redis_stream',
            'weights_version': 'weights-v1',
            'whale_orders': [],
            'summary': {
                'buy_value': 0,
                'sell_value': 0,
                'flow_net': 0,
                'shark_value': 0,
                'whale_value': 0,
                'small_value': 0,
                'shark_pct': 0,
                'whale_pct': 0,
                'small_pct': 0,
            },
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/whale-feed/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_whale_feed.assert_called_once_with(self.user, 'VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks', return_value=[])
    @patch('portfolio.market_data_service.fetch_intraday_dataframe')
    def test_refactored_whale_feed_response_contains_scoring_contract(self, mock_fetch_intraday_dataframe, _mock_stream_ticks, _mock_get_cache):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()
        mock_fetch_intraday_dataframe.return_value = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
            {'time': '2026-04-03T09:31:00+07:00', 'price': 99500, 'volume': 4000, 'match_type': 'sell'},
        ])

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

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks', return_value=[])
    @patch('portfolio.market_data_service.fetch_intraday_dataframe', side_effect=ExternalSystemException('vnstock unavailable', code='vnstock_error'))
    def test_refactored_whale_feed_falls_back_to_intraday_tick_db_when_vnstock_unavailable(self, _mock_fetch_intraday_dataframe, _mock_stream_ticks, _mock_get_cache):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()

        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
            price=Decimal('61800'),
            volume=16000,
            side='BUY',
            stream_id='mwg-refactor-db-1',
        )
        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
            price=Decimal('60500'),
            volume=21000,
            side='SELL',
            stream_id='mwg-refactor-db-2',
        )

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        self.assertEqual(response.data['whale_orders'][0]['side'], 'sell')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_whale_feed_aggregate')
    def test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_whale_feed_aggregate):
        self.authenticate()
        mock_get_whale_feed_aggregate.return_value = {
            'results': [],
            'next_cursor': None,
            'has_more': False,
            'server_time': '2026-04-05T10:00:00+07:00',
            'source': 'intraday_tick_db',
            'weights_version': 'weights-v1',
            'filters': {
                'scope': 'tracked',
                'scope_source': 'default_tracked',
                'symbols': [],
                'watchlist_group_ids': [],
                'sort': 'ts',
                'limit': 20,
                'threshold': 500000000,
            },
            'meta': {
                'contract_version': '1.1',
                'pagination': {
                    'sort': 'ts',
                    'limit': 20,
                    'has_more': False,
                    'next_cursor': None,
                },
                'scope': {
                    'value': 'tracked',
                    'source': 'default_tracked',
                },
            },
            'entitlements': {'plan': 'free'},
        }

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_whale_feed_aggregate.assert_called_once()

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_refactored_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements(self):
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
            stream_id='fpt-refactor-agg-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks')
    def test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db(self, mock_read_stream_intraday_ticks):
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
            stream_id='db-refactor-agg-fpt-1',
        )
        mock_read_stream_intraday_ticks.return_value = [
            {'price': 101000, 'volume': 10000, 'side': 'BUY', 'ts': '2026-04-03T09:20:00+07:00'},
        ]
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'redis_stream')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['source'], 'redis_stream')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_refactored_whale_feed_aggregate_rejects_invalid_cursor(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?cursor=@@not_base64@@')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_depth_chart')
    def test_depth_chart_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_depth_chart):
        self.authenticate()
        mock_get_depth_chart.return_value = {
            'symbol': 'VNM',
            'reference_price': 100000,
            'ceiling_price': 107000,
            'floor_price': 93000,
            'bids': [],
            'asks': [],
            'walls': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/depth-chart/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_depth_chart.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_financial_metrics')
    def test_financial_metrics_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_financial_metrics):
        self.authenticate()
        mock_get_financial_metrics.return_value = {
            'symbol': 'VNM',
            'years': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/stock-management/stocks/VNM/financials/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_financial_metrics.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_overview')
    def test_stock_workspace_overview_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_stock_workspace_overview):
        self.authenticate()
        mock_get_stock_workspace_overview.return_value = {
            'symbol': 'VNM',
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_stock_workspace_overview.assert_called_once_with(self.user, 'VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_chart')
    def test_stock_workspace_chart_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_stock_workspace_chart):
        self.authenticate()
        mock_get_stock_workspace_chart.return_value = {
            'symbol': 'VNM',
            'days': 180,
            'points': [],
            'technical': {},
        }

        response = self.client.get('/api/stock-management/stocks/VNM/chart/?days=120')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_stock_workspace_chart.assert_called_once_with(self.user, 'VNM', '120')

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