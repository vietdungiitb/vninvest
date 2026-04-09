from unittest.mock import MagicMock, patch
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test.utils import override_settings
from django.utils import timezone
import pandas as pd
from portfolio.exceptions import ExternalSystemException
from portfolio.models import DailyPrice, IntradayTick, OnboardingPlanPolicy, PlanAssignmentLog, Portfolio, SecuritiesGroup, SecuritiesItem, StockProfile, SubAccount, TrackedSymbol, UserConfig, WatchlistGroup, WatchlistItem, WhaleAdvisory, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, SystemAISettings
from portfolio.email_verification import generate_email_verification_token
from portfolio.starter_portfolio_service import STARTER_PORTFOLIO_TEMPLATES, STARTER_SUBACCOUNT_TEMPLATES
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
        user_cfg = UserConfig.objects.get(user=self.user)
        user_cfg.ai_provider = 'openai'
        user_cfg.ai_model = 'gpt-4o'
        user_cfg.set_ai_api_key('sk-route-smoke')
        user_cfg.save(update_fields=['ai_provider', 'ai_model', 'ai_api_key'])

    def authenticate(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from portfolio.opencore_dpi import DPIPlan, DPILicense

        base_features = {
            'sma': True,
            'rsi': True,
            'volume_profile': True,
            'whale_momentum': False,
            'dark_pool_flow': False,
            'correlation_matrix': False,
            'volatility_surface': False,
            'sentiment_score': False,
            'predictive_ml': False,
            'cross_market_alpha': False,
            'fund_flow_analysis': False,
            'hedging_strategy': False,
        }
        if feature_flags:
            base_features.update(feature_flags)

        defaults_by_plan = {
            'free': {'display_name': 'Community', 'annual_price_usd': 0, 'monthly_price_usd': 0},
            'pro': {'display_name': 'Professional', 'annual_price_usd': 99, 'monthly_price_usd': 9.99},
            'enterprise': {'display_name': 'Enterprise', 'annual_price_usd': 999, 'monthly_price_usd': 99.99},
        }
        plan_defaults = defaults_by_plan.get(plan_name, defaults_by_plan['free'])

        plan, _ = DPIPlan.objects.update_or_create(
            name=plan_name,
            defaults={
                'description': f'{plan_name} test plan',
                'display_name': plan_defaults['display_name'],
                'annual_price_usd': plan_defaults['annual_price_usd'],
                'monthly_price_usd': plan_defaults['monthly_price_usd'],
                'max_watchlist_items': 50,
                'max_portfolio_accounts': 5,
                'max_alerts': 100,
                'max_api_calls_per_month': 100000,
                'features': base_features,
                'is_active': True,
            },
        )

        defaults = {
            'plan': plan,
            'status': status,
            'billing_cycle': 'annual',
            'start_date': timezone.now(),
            'expiry_date': timezone.now() + timedelta(days=30),
            'grace_until': None,
        }
        if status == 'expired':
            defaults['expiry_date'] = timezone.now() - timedelta(days=1)
        if status == 'grace':
            defaults['grace_until'] = timezone.now() + timedelta(days=max(int(grace_days), 1))

        DPILicense.objects.update_or_create(
            user=self.user,
            defaults=defaults,
        )

    def _detach_dpi_license(self):
        from portfolio.opencore_dpi import DPILicense

        DPILicense.objects.filter(user=self.user).delete()

    def _create_stock_workspace_advisory(self, symbol='BCM'):
        return WhaleAdvisory.objects.create(
            user=self.user,
            symbol=symbol,
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

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
        self.assertEqual(
            Portfolio.objects.filter(user=created_user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES),
        )
        self.assertEqual(
            SubAccount.objects.filter(portfolio__user=created_user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )
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
        self.assertIn('xác thực', str(response.data['detail']).lower())

    def test_login_allows_unverified_superuser(self):
        admin_user = User.objects.create_superuser(
            username='root',
            email='root@example.com',
            password='Root@123456',
        )
        UserConfig.objects.update_or_create(
            user=admin_user,
            defaults={'email_verified': False},
        )

        response = self.client.post(
            '/api/auth/token/',
            {'username': 'root', 'password': 'Root@123456'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

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

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_register_endpoint_applies_active_onboarding_policy(self, _mock_send_verification_email):
        OnboardingPlanPolicy.objects.create(
            is_active=True,
            trial_plan=UserConfig.PlanChoices.PRO,
            trial_duration_days=14,
            fallback_plan=UserConfig.PlanChoices.BASIC,
        )

        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'onboarding_policy_user',
                'email': 'onboarding-policy@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['plan'], UserConfig.PlanChoices.PRO)

        created_user = User.objects.get(username='onboarding_policy_user')
        created_user.user_config.refresh_from_db()
        self.assertEqual(created_user.user_config.plan, UserConfig.PlanChoices.PRO)
        self.assertEqual(created_user.user_config.plan_source, UserConfig.PlanSourceChoices.ONBOARDING_TRIAL)
        self.assertIsNotNone(created_user.user_config.plan_expires_at)
        self.assertIsNotNone(created_user.user_config.plan_assigned_at)

        self.assertTrue(
            PlanAssignmentLog.objects.filter(
                user=created_user,
                reason=PlanAssignmentLog.ReasonChoices.SIGNUP_TRIAL,
                new_plan=UserConfig.PlanChoices.PRO,
            ).exists()
        )

    @override_settings(ONBOARDING_TRIAL_APPLY_ON_SIGNUP=False)
    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_register_endpoint_respects_signup_trial_feature_flag(self, _mock_send_verification_email):
        OnboardingPlanPolicy.objects.create(
            is_active=True,
            trial_plan=UserConfig.PlanChoices.PRO,
            trial_duration_days=14,
            fallback_plan=UserConfig.PlanChoices.BASIC,
        )

        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'onboarding_flag_off_user',
                'email': 'onboarding-flag-off@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['plan'], UserConfig.PlanChoices.FREE)

        created_user = User.objects.get(username='onboarding_flag_off_user')
        created_user.user_config.refresh_from_db()
        self.assertEqual(created_user.user_config.plan, UserConfig.PlanChoices.FREE)
        self.assertEqual(created_user.user_config.plan_source, UserConfig.PlanSourceChoices.SYSTEM_DEFAULT)
        self.assertFalse(
            PlanAssignmentLog.objects.filter(
                user=created_user,
                reason=PlanAssignmentLog.ReasonChoices.SIGNUP_TRIAL,
            ).exists()
        )

    @patch('portfolio.auth_views.should_provision_starter_portfolios_for_user', return_value=True)
    @patch('portfolio.auth_views.provision_starter_portfolios_for_user', side_effect=RuntimeError('starter seed failed'))
    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_register_endpoint_fail_soft_when_starter_provisioning_fails(
        self,
        _mock_send_verification_email,
        _mock_provision,
        _mock_should_provision,
    ):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'register_failsoft_user',
                'email': 'register-failsoft@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username='register_failsoft_user')
        self.assertEqual(Portfolio.objects.filter(user=created_user).count(), 0)
        self.assertEqual(SubAccount.objects.filter(portfolio__user=created_user).count(), 0)

    @patch('portfolio.auth_views.fetch_google_user_email', return_value='oauth-signup@example.com')
    def test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy(self, _mock_fetch_google_email):
        OnboardingPlanPolicy.objects.create(
            is_active=True,
            trial_plan=UserConfig.PlanChoices.PRO,
            trial_duration_days=10,
            fallback_plan=UserConfig.PlanChoices.BASIC,
        )

        response = self.client.post(
            '/api/auth/oauth/google/',
            {'access_token': 'fake-google-access-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['created'])
        self.assertEqual(response.data['email'], 'oauth-signup@example.com')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['plan'], UserConfig.PlanChoices.PRO)

        created_user = User.objects.get(email='oauth-signup@example.com')
        created_user.user_config.refresh_from_db()
        self.assertEqual(created_user.user_config.oauth_provider, 'google')
        self.assertTrue(created_user.user_config.email_verified)
        self.assertEqual(created_user.user_config.plan_source, UserConfig.PlanSourceChoices.ONBOARDING_TRIAL)
        self.assertEqual(
            Portfolio.objects.filter(user=created_user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES),
        )
        self.assertEqual(
            SubAccount.objects.filter(portfolio__user=created_user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )

    @patch('portfolio.auth_views.fetch_google_user_email', return_value='oauth-existing@example.com')
    def test_google_oauth_endpoint_existing_user_no_reassignment(self, _mock_fetch_google_email):
        existing_user = User.objects.create_user(
            username='oauth_existing',
            email='oauth-existing@example.com',
            password='Test@123456',
        )
        cfg, _ = UserConfig.objects.get_or_create(user=existing_user)
        cfg.plan = UserConfig.PlanChoices.PREMIUM
        cfg.plan_source = UserConfig.PlanSourceChoices.PAID
        cfg.email_verified = True
        cfg.save(update_fields=['plan', 'plan_source', 'email_verified', 'updated_at'])

        OnboardingPlanPolicy.objects.create(
            is_active=True,
            trial_plan=UserConfig.PlanChoices.PRO,
            trial_duration_days=10,
            fallback_plan=UserConfig.PlanChoices.BASIC,
        )

        response = self.client.post(
            '/api/auth/oauth/google/',
            {'access_token': 'fake-google-access-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['created'])
        self.assertEqual(response.data['plan'], UserConfig.PlanChoices.PREMIUM)

        cfg.refresh_from_db()
        self.assertEqual(cfg.plan, UserConfig.PlanChoices.PREMIUM)
        self.assertEqual(cfg.plan_source, UserConfig.PlanSourceChoices.PAID)
        self.assertFalse(
            PlanAssignmentLog.objects.filter(
                user=existing_user,
                reason=PlanAssignmentLog.ReasonChoices.SIGNUP_TRIAL,
            ).exists()
        )

    @patch('portfolio.auth_views.should_provision_starter_portfolios_for_user', return_value=True)
    @patch('portfolio.auth_views.provision_starter_portfolios_for_user', side_effect=RuntimeError('starter seed failed'))
    @patch('portfolio.auth_views.fetch_google_user_email', return_value='oauth-failsoft@example.com')
    def test_google_oauth_endpoint_fail_soft_when_starter_provisioning_fails(
        self,
        _mock_fetch_google_email,
        _mock_provision,
        _mock_should_provision,
    ):
        response = self.client.post(
            '/api/auth/oauth/google/',
            {'access_token': 'fake-google-access-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['created'])
        created_user = User.objects.get(email='oauth-failsoft@example.com')
        self.assertEqual(Portfolio.objects.filter(user=created_user).count(), 0)
        self.assertEqual(SubAccount.objects.filter(portfolio__user=created_user).count(), 0)

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
        self.assertEqual(response.data['entitlements']['tier'], 'pro_team')
        self.assertEqual(response.data['entitlements']['quota_caps']['api_calls_per_day'], 10000)
        self.assertEqual(response.data['entitlements']['quota_caps']['ai_regenerate_per_day'], 120)
        self.assertEqual(response.data['entitlements']['quota_caps']['whale_symbols_max'], 100)
        self.assertEqual(response.data['entitlements']['quota_caps']['exports_per_day'], 100)
        self.assertEqual(response.data['entitlements']['trial_state'], 'none')
        self.assertIsNone(response.data['entitlements']['trial_ends_at'])
        self.assertIsNone(response.data['entitlements']['grace_ends_at'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory_detail'])

    def test_auth_me_endpoint_returns_community_tier_for_free_plan(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'whale_alert_threshold': 500, 'email_verified': True},
        )
        self.authenticate()

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['entitlements']['plan'], 'free')
        self.assertEqual(response.data['entitlements']['tier'], 'community')
        self.assertEqual(response.data['entitlements']['quota_caps']['api_calls_per_day'], 300)
        self.assertEqual(response.data['entitlements']['quota_caps']['ai_regenerate_per_day'], 0)
        self.assertEqual(response.data['entitlements']['quota_caps']['whale_symbols_max'], 10)
        self.assertEqual(response.data['entitlements']['quota_caps']['exports_per_day'], 0)
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])

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
            user=self.user,
            symbol='VCB',
            matched_value=9_200_000_000,
            side='SELL',
            threshold=5_000_000_000,
            ai_summary='Tom tat pro',
            ai_detail='Chi tiet premium',
            ai_model='gpt-4o',
        )

        response = self.client.get('/api/portfolio/whale-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ai_summary'], 'Tom tat pro')
        self.assertEqual(response.data[0]['ai_detail'], '')
        self.assertIn('next_refresh_at', response.data[0])
        self.assertIn('refresh_count', response.data[0])
        self.assertIn('source', response.data[0])
        self.assertIn('advisory_type', response.data[0])
        self.assertIn('severity', response.data[0])

    def test_whale_advisory_endpoint_returns_detail_for_premium(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='HPG',
            matched_value=7_100_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat premium',
            ai_detail='Chi tiet premium day du',
            ai_model='gpt-4o',
        )

        response = self.client.get('/api/portfolio/whale-advisory/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['ai_detail'], 'Chi tiet premium day du')

    def test_whale_advisory_endpoint_can_filter_ready_for_refresh(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='AAA',
            matched_value=5_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='Ready advisory',
            ai_detail='Ready detail',
            ai_model='gpt-4o',
            next_refresh_at=timezone.now() - timedelta(minutes=5),
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BBB',
            matched_value=5_000_000_000,
            side='BUY',
            threshold=3_000_000_000,
            ai_summary='Pending advisory',
            ai_detail='Pending detail',
            ai_model='gpt-4o',
            next_refresh_at=timezone.now() + timedelta(hours=2),
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )

        response = self.client.get('/api/portfolio/whale-advisory/?refresh_status=ready')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['symbol'], 'AAA')

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_queues_task_for_pro(self, mock_apply_async, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
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
        self.assertEqual(kwargs['user_id'], self.user.id)
        self.assertEqual(kwargs['source'], WhaleAdvisory.SourceChoices.USER_REFRESH)

    def test_whale_advisory_auto_refresh_info_returns_status_and_budget(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': 'pro',
                'email_verified': True,
                'advisory_refresh_interval_hours': 12,
                'advisory_max_auto_refreshes_per_day': 3,
                'advisory_max_tokens_per_day': 5000,
            },
        )
        self.authenticate()
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
            next_refresh_at=timezone.now() + timedelta(hours=6),
            refresh_count=2,
            is_auto_generated=True,
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )
        from portfolio.models import AdvisoryTokenLog
        AdvisoryTokenLog.objects.create(
            user=self.user,
            advisory=advisory,
            tokens_used=320,
            source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
            symbol='FPT',
        )

        response = self.client.get('/api/portfolio/whale-advisory/FPT/auto-refresh-info/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertEqual(response.data['status'], 'scheduled')
        self.assertEqual(response.data['advisory_id'], advisory.id)
        self.assertEqual(response.data['refresh_count'], 2)
        self.assertTrue(response.data['is_auto_generated'])
        self.assertEqual(response.data['source'], WhaleAdvisory.SourceChoices.PERIODIC_JOB)
        self.assertEqual(response.data['tokens_used_today'], 320)
        self.assertEqual(response.data['tokens_remaining_today'], 4680)
        self.assertEqual(response.data['advisory_max_auto_refreshes_per_day'], 3)
        self.assertEqual(response.data['auto_refreshes_used_today'], 1)
        self.assertEqual(response.data['auto_refreshes_remaining_today'], 2)

    def test_whale_advisory_auto_refresh_info_returns_no_advisory_for_tracked_symbol(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        TrackedSymbol.objects.create(user=self.user, symbol='SSI')

        response = self.client.get('/api/portfolio/whale-advisory/SSI/auto-refresh-info/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['status'], 'no_advisory')
        self.assertIsNone(response.data['advisory_id'])

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

    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_whale_advisory_refresh_endpoint_returns_409_when_ai_model_missing(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': 'pro',
                'email_verified': True,
                'ai_provider': 'openai',
                'ai_model': '',
                'ai_api_key': '',
            },
        )
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        response = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_whale_advisory_refresh_endpoint_returns_409_when_ai_api_key_missing(self):
        cfg, _ = UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        cfg.ai_api_key = ''
        cfg.save(update_fields=['ai_api_key'])
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        response = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @patch.dict('os.environ', {'OPENCLAW_API_KEY': 'system-openclaw-key'}, clear=False)
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_uses_system_fallback_when_user_ai_missing(self, mock_apply_async, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': ''},
        )
        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        mock_task = MagicMock()
        mock_task.id = 'task-system-fallback-1'
        mock_apply_async.return_value = mock_task

        response = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])

    def test_whale_advisory_refresh_endpoint_queues_when_no_existing(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()

        with patch('portfolio.tasks.generate_whale_advisory_task.apply_async') as mock_apply_async:
            mock_task = MagicMock()
            mock_task.id = 'task-bootstrap-1'
            mock_apply_async.return_value = mock_task

            response = self.client.post('/api/portfolio/whale-advisory/SSI/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'SSI')

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_whale_advisory_refresh_endpoint_returns_429_when_manual_cooldown_active(self, _mock_cache_get):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        response = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertIn('retry_after_seconds', response.data)

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 3000,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_returns_429_when_ai_regenerate_quota_exceeded(self, mock_apply_async, _mock_cache_get):
        cache.clear()
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        mock_task = MagicMock()
        mock_task.id = 'task-123'
        mock_apply_async.return_value = mock_task

        first = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')
        second = self.client.post('/api/portfolio/whale-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_stock_ai_advisory_session_get_queues_generation_when_missing(self, mock_apply_async, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
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
        self.assertEqual(kwargs['user_id'], self.user.id)

    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_stock_ai_advisory_session_get_returns_409_when_ai_model_missing(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True, 'ai_provider': 'openai', 'ai_model': '', 'ai_api_key': ''},
        )
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

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
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
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

    def test_stock_order_flow_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'dark_pool_flow': False})
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'dark_pool_flow')

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_order_flow_returns_200_when_feature_enabled_for_pro_dpi_license(self, mock_cvd_series, mock_detect_dark_flow):
        self._attach_dpi_license('pro', {'dark_pool_flow': True})
        self.authenticate()
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }

        response = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_order_flow_returns_429_when_api_quota_exceeded(self, mock_cvd_series, mock_detect_dark_flow):
        cache.clear()
        self.authenticate()
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }

        first = self.client.get('/api/stock-management/stocks/FPT/order-flow/')
        second = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

    def test_stock_ai_advisory_session_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'whale_momentum': False})
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'whale_momentum')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    def test_stock_ai_advisory_session_get_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        first = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')
        second = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

    def test_stock_ai_advisory_components_generate_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    def test_stock_workspace_p0_role_matrix_blocks_free_dpi_license(self):
        self._attach_dpi_license(
            'free',
            {
                'dark_pool_flow': False,
                'whale_momentum': False,
                'sentiment_score': False,
            },
        )
        self.authenticate()

        matrix_cases = [
            ('order_flow', self.client.get('/api/stock-management/stocks/FPT/order-flow/'), 'dark_pool_flow'),
            ('advisory_session', self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/'), 'whale_momentum'),
            (
                'advisory_components_generate',
                self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                    {'timeframe': '15m'},
                    format='json',
                ),
                'sentiment_score',
            ),
        ]

        for case_name, response, expected_feature_key in matrix_cases:
            with self.subTest(case=case_name):
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(response.data['code'], 'feature_locked')
                self.assertEqual(response.data['feature_key'], expected_feature_key)

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_workspace_p0_role_matrix_allows_access_for_pro_premium_admin_trial_grace(
        self,
        mock_cvd_series,
        mock_detect_dark_flow,
        mock_build_templates,
        _mock_generate_with_ai,
    ):
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'matrix-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        matrix_cases = [
            (
                'pro_active',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='active',
                ),
            ),
            (
                'pro_trial',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='trial',
                ),
            ),
            (
                'pro_grace',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='grace',
                ),
            ),
            (
                'premium_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True}),
                ],
            ),
            (
                'admin_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'admin', 'email_verified': True}),
                ],
            ),
        ]

        for case_name, setup_case in matrix_cases:
            with self.subTest(case=case_name):
                setup_case()

                order_flow_resp = self.client.get('/api/stock-management/stocks/FPT/order-flow/')
                session_resp = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')
                components_resp = self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                    {'timeframe': '30m'},
                    format='json',
                )

                self.assertEqual(order_flow_resp.status_code, status.HTTP_200_OK)
                self.assertEqual(session_resp.status_code, status.HTTP_200_OK)
                self.assertEqual(components_resp.status_code, status.HTTP_201_CREATED)

    def test_stock_workspace_p0_role_matrix_blocks_expired_license(self):
        self._attach_dpi_license(
            'pro',
            {
                'dark_pool_flow': True,
                'whale_momentum': True,
                'sentiment_score': True,
            },
            status='expired',
        )
        self.authenticate()

        matrix_cases = [
            ('order_flow', self.client.get('/api/stock-management/stocks/FPT/order-flow/'), 'dark_pool_flow'),
            ('advisory_session', self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/'), 'whale_momentum'),
            (
                'advisory_components_generate',
                self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                    {'timeframe': '15m'},
                    format='json',
                ),
                'sentiment_score',
            ),
        ]

        for case_name, response, expected_feature_key in matrix_cases:
            with self.subTest(case=case_name):
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(response.data['code'], 'feature_locked')
                self.assertEqual(response.data['feature_key'], expected_feature_key)

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_accepts_chart_context_and_returns_usage_flags(
        self,
        mock_detect_dark_flow,
        mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 65,
            'confidence': 'high',
            'components': {'tick_rate': {'score': 55}},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'chart-context-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'BCM',
                    'chart_timeframe': '30m',
                    'visible_range': {'from_ts': 1712500000000, 'to_ts': 1712507200000},
                    'ohlcv': [
                        {'ts': 1712500000000, 'o': 70.1, 'h': 70.3, 'l': 69.9, 'c': 70.0, 'v': 120000},
                        {'ts': 1712501800000, 'o': 70.0, 'h': 70.4, 'l': 69.8, 'c': 70.2, 'v': 98000},
                    ],
                    'active_indicators': {'MA': True, 'VOL': True, 'MACD': True},
                    'computed_metrics': {'change_visible_pct': 1.3, 'volatility_visible': 0.8},
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['chart_context_used'])
        self.assertEqual(response.data['chart_context_warnings'], [])
        kwargs = mock_generate_with_ai.call_args.kwargs
        self.assertIn('chart_context', kwargs)
        self.assertEqual(kwargs['chart_context']['symbol'], 'BCM')

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_invalid_chart_context_sets_warning(
        self,
        mock_detect_dark_flow,
        _mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'invalid-chart-context-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'VNM',
                    'ohlcv': [{'ts': 1, 'o': 1, 'h': 1, 'l': 1, 'c': 1, 'v': 1}],
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['chart_context_used'])
        self.assertIn('chart_context_invalid', response.data['chart_context_warnings'])

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_prefers_active_rsi_indicator_from_chart_context(
        self,
        mock_detect_dark_flow,
        _mock_generate_with_ai,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 60,
            'confidence': 'high',
            'components': {'tick_rate': {'score': 70}},
        }

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'BCM',
                    'chart_timeframe': '30m',
                    'visible_range': {'from_ts': 1712500000000, 'to_ts': 1712507200000},
                    'ohlcv': [
                        {'ts': 1712500000000, 'o': 70.1, 'h': 70.3, 'l': 69.9, 'c': 70.0, 'v': 120000},
                        {'ts': 1712501800000, 'o': 70.0, 'h': 70.4, 'l': 69.8, 'c': 70.2, 'v': 98000},
                    ],
                    'active_indicators': {'RSI': True, 'MA': False, 'MACD': False, 'VOL': False},
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        indicator_components = [
            item for item in response.data.get('components', [])
            if item.get('component_type') == 'indicator'
        ]
        self.assertGreaterEqual(len(indicator_components), 1)
        self.assertEqual(indicator_components[0].get('indicator_name'), 'RSI')

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_without_chart_context_has_no_warning(
        self,
        mock_detect_dark_flow,
        mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 40,
            'confidence': 'medium',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'MA',
                'status': 'neutral',
                'confidence_score': 5,
                'suggested_action': 'watch',
                'rationale_text': 'no-chart-context',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '30m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['chart_context_used'])
        self.assertEqual(response.data['chart_context_warnings'], [])
        kwargs = mock_generate_with_ai.call_args.kwargs
        self.assertIsNone(kwargs.get('chart_context'))

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_chart_context_oversize_points_sets_warning(
        self,
        mock_detect_dark_flow,
        mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 40,
            'confidence': 'medium',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'MA',
                'status': 'neutral',
                'confidence_score': 5,
                'suggested_action': 'watch',
                'rationale_text': 'oversize-chart-context',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        ohlcv = [
            {'ts': 1712500000000 + i * 60000, 'o': 70.0, 'h': 70.3, 'l': 69.9, 'c': 70.1, 'v': 100000}
            for i in range(301)
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'BCM',
                    'chart_timeframe': '30m',
                    'ohlcv': ohlcv,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['chart_context_used'])
        self.assertIn('chart_context_invalid', response.data['chart_context_warnings'])
        kwargs = mock_generate_with_ai.call_args.kwargs
        self.assertIsNone(kwargs.get('chart_context'))

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_workspace_p1_regression_matrix_matches_current_gating_policy(self, mock_generate_with_ai, _mock_cache_get):
        self.authenticate()
        mock_generate_with_ai.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI Updated',
                'status': 'neutral',
                'confidence_score': 7,
                'suggested_action': 'watch',
                'rationale_text': 'p1-matrix',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        matrix_cases = [
            (
                'free_active',
                lambda: self._attach_dpi_license(
                    'free',
                    {'dark_pool_flow': False, 'whale_momentum': False, 'sentiment_score': False},
                    status='active',
                ),
                True,
            ),
            (
                'pro_active',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='active',
                ),
                False,
            ),
            (
                'pro_trial',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='trial',
                ),
                False,
            ),
            (
                'pro_grace',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='grace',
                ),
                False,
            ),
            (
                'premium_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True}),
                ],
                False,
            ),
            (
                'admin_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'admin', 'email_verified': True}),
                ],
                False,
            ),
        ]

        for case_name, setup_case, expect_locked in matrix_cases:
            with self.subTest(case=case_name):
                setup_case()
                self._create_stock_workspace_advisory(symbol='BCM')
                component = AIAdvisoryComponentRecord.objects.create(
                    user=self.user,
                    symbol='BCM',
                    component_type='indicator',
                    indicator_name='RSI',
                    status='neutral',
                    confidence_score=6,
                    suggested_action='watch',
                    rationale_text='p1-regression',
                    timeframe='30m',
                    include_in_summary=True,
                )

                refresh_resp = self.client.post(
                    f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
                    {},
                    format='json',
                )
                summary_resp = self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
                    {'component_ids': [component.id]},
                    format='json',
                )

                if expect_locked:
                    self.assertEqual(refresh_resp.status_code, status.HTTP_403_FORBIDDEN)
                    self.assertEqual(summary_resp.status_code, status.HTTP_403_FORBIDDEN)
                    self.assertEqual(refresh_resp.data.get('code'), 'feature_locked')
                    self.assertEqual(summary_resp.data.get('code'), 'feature_locked')
                else:
                    self.assertEqual(refresh_resp.status_code, status.HTTP_200_OK)
                    self.assertEqual(summary_resp.status_code, status.HTTP_201_CREATED)

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_order_flow_usage_tracking_calls_track_api_call(self, mock_cvd_series, mock_detect_dark_flow):
        self._attach_dpi_license('pro', {'dark_pool_flow': True})
        self.authenticate()
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'dark_pool_flow')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    def test_stock_ai_advisory_session_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'whale_momentum': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'whale_momentum')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_usage_tracking_calls_track_api_call(
        self,
        mock_detect_dark_flow,
        mock_build_templates,
        _mock_generate_with_ai,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'tracking-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                {'timeframe': '30m'},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_201_CREATED)

    def test_stock_ai_advisory_components_generate_creates_component_records(self):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
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

    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_stock_ai_advisory_components_generate_returns_409_when_ai_api_not_configured(self):
        self.authenticate()
        cfg = UserConfig.objects.get(user=self.user)
        cfg.ai_model = ''
        cfg.ai_api_key = ''
        cfg.save(update_fields=['ai_model', 'ai_api_key'])
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 300,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    def test_stock_ai_advisory_components_generate_returns_429_when_ai_regenerate_quota_exceeded(self, mock_build_templates, _mock_generate_with_ai):
        cache.clear()
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'quota-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        first = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '30m'},
            format='json',
        )
        second = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '30m'},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

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

    def test_stock_ai_advisory_component_toggle_include_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
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

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 30,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    def test_stock_ai_advisory_component_toggle_include_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
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

        first = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )
        second = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')

    def test_stock_ai_advisory_component_toggle_include_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
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

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_ai_advisory_component_refresh_updates_only_target_component(self, mock_generate_with_ai):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
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

    def test_stock_ai_advisory_component_refresh_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
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
            f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 3000,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_component_refresh_returns_429_when_ai_regenerate_quota_exceeded(
        self,
        mock_detect_dark_flow,
        mock_build_templates,
        _mock_generate_with_ai,
    ):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='quota-test',
            timeframe='30m',
            include_in_summary=True,
        )
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI Refresh',
                'status': 'neutral',
                'confidence_score': 7,
                'suggested_action': 'watch',
                'rationale_text': 'quota-refresh',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        first = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
            {},
            format='json',
        )
        second = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
            {},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_ai_advisory_component_refresh_usage_tracking_calls_track_api_call(self, mock_generate_with_ai):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='tracking-test',
            timeframe='30m',
            include_in_summary=True,
        )
        mock_generate_with_ai.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI New',
                'status': 'breakout',
                'confidence_score': 8,
                'suggested_action': 'buy',
                'rationale_text': 'tracking-refreshed',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

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

    def test_stock_ai_advisory_component_delete_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
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

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 30,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    def test_stock_ai_advisory_component_delete_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        first_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='first',
            timeframe='30m',
            include_in_summary=True,
        )
        second_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='second',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.delete(f'/api/stock-management/ai-advisory-components/{first_component.id}/')
        second = self.client.delete(f'/api/stock-management/ai-advisory-components/{second_component.id}/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')

    def test_stock_ai_advisory_component_delete_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
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

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.delete(f'/api/stock-management/ai-advisory-components/{component.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    def test_stock_ai_advisory_component_clear_deleted_hard_deletes_deleted_records(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()

        deleted_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='deleted',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )
        AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='active',
            timeframe='30m',
            include_in_summary=True,
            is_deleted=False,
        )

        response = self.client.delete('/api/stock-management/stocks/BCM/ai-advisory-components/deleted/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['deleted_count'], 1)
        self.assertFalse(AIAdvisoryComponentRecord.objects.filter(id=deleted_component.id).exists())
        self.assertEqual(
            AIAdvisoryComponentRecord.objects.filter(user=self.user, symbol='BCM', is_deleted=False).count(),
            1,
        )

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

    def test_stock_ai_advisory_component_restore_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
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

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 30,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    def test_stock_ai_advisory_component_restore_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        first_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='first',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )
        second_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='second',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )

        first = self.client.post(
            f'/api/stock-management/ai-advisory-components/{first_component.id}/restore/',
            {},
            format='json',
        )
        second = self.client.post(
            f'/api/stock-management/ai-advisory-components/{second_component.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')

    def test_stock_ai_advisory_component_restore_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
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

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                f'/api/stock-management/ai-advisory-components/{component.id}/restore/',
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

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

    def test_stock_ai_advisory_summary_regenerate_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 3000,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_summary_regenerate_returns_429_when_ai_regenerate_quota_exceeded(self, _mock_cache_get):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='quota-summary',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [component.id]},
            format='json',
        )
        second = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [component.id]},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_summary_regenerate_usage_tracking_calls_track_api_call(self, _mock_cache_get):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='tracking-summary',
            timeframe='30m',
            include_in_summary=True,
        )

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
                {'component_ids': [component.id]},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_201_CREATED)

    def test_stock_ai_advisory_summary_delete_removes_selected_summary(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        summary = AIAdvisoryExecutiveSummary.objects.create(
            user=self.user,
            symbol='BCM',
            summary_version=1,
            strategy_action='HOLD',
            risk_level='medium',
            overall_confidence=6,
            synthesis_text='summary',
            used_component_ids=[1, 2],
        )

        response = self.client.delete(
            f'/api/stock-management/stocks/BCM/ai-advisory-summary/{summary.id}/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertFalse(AIAdvisoryExecutiveSummary.objects.filter(id=summary.id).exists())

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_session_returns_summary_history_desc_by_version(self, _mock_cache_get):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
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
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
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

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 0,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    def test_whale_feed_aggregate_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()

        first = self.client.get('/api/realtime/whale-feed/aggregate/')
        second = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

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

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True, MARKET_VIEWS_CANARY_PERCENT=0)
    @patch('portfolio.market_views.market_data_service.get_realtime_ticker')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views.get_price_changes')
    def test_realtime_ticker_endpoint_uses_legacy_view_when_canary_percent_zero(
        self,
        mock_get_price_changes,
        _mock_cache_get,
        mock_get_realtime_ticker,
    ):
        self.authenticate()
        mock_get_price_changes.return_value = {
            'VNM': {
                'current_price': 100000,
                'prev_price': 99000,
                'last_date': datetime.now().isoformat(),
            }
        }

        response = self.client.get('/api/realtime/ticker/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_realtime_ticker.assert_not_called()
        mock_get_price_changes.assert_called_once_with(['VNM'])

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
        mock_get_intraday_matched.assert_called_once_with('VNM', page_size=25)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_intraday_matched')
    def test_realtime_intraday_endpoint_rejects_invalid_page_size(self, mock_get_intraday_matched):
        self.authenticate()

        response = self.client.get('/api/realtime/intraday/VNM/?page_size=abc')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_get_intraday_matched.assert_not_called()

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
    @patch('portfolio.market_data_service.read_stream_intraday_ticks')
    @patch('portfolio.market_data_service.fetch_intraday_dataframe')
    def test_realtime_intraday_refactored_returns_200_fallback_on_provider_exception(self, mock_fetch_intraday, mock_read_stream):
        self.authenticate()
        mock_read_stream.return_value = []
        mock_fetch_intraday.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/intraday/BCM/?page_size=50')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['trades'], [])
        self.assertIn('source', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.fetch_price_board_dataframe')
    def test_price_board_refactored_returns_200_fallback_on_provider_exception(self, mock_fetch_price_board):
        self.authenticate()
        mock_fetch_price_board.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/price-board/BCM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['depth'], [])
        self.assertEqual(response.data['match'], {})
        self.assertIn('source', response.data)

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

    @patch('portfolio.views.fetch_price_board_dataframe')
    @patch('portfolio.views._cache_get')
    def test_price_board_legacy_returns_200_fallback_on_provider_exception(self, mock_cache_get, mock_fetch_price_board):
        self.authenticate()
        mock_cache_get.return_value = None
        mock_fetch_price_board.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/price-board/BCM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['depth'], [])
        self.assertEqual(response.data['match'], {})
        self.assertIn('source', response.data)

    @patch('portfolio.realtime.stream_reader.StreamReader.get_intraday_ticks')
    @patch('portfolio.views.fetch_intraday_dataframe')
    @patch('portfolio.views._cache_get')
    def test_intraday_legacy_returns_200_fallback_on_provider_exception(self, mock_cache_get, mock_fetch_intraday, mock_get_intraday_ticks):
        self.authenticate()
        mock_cache_get.return_value = None
        mock_get_intraday_ticks.return_value = []
        mock_fetch_intraday.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/intraday/BCM/?page_size=50')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['trades'], [])
        self.assertIn('source', response.data)

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
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_overview')
    def test_stock_workspace_overview_refactored_returns_502_on_unexpected_exception(self, mock_get_stock_workspace_overview):
        self.authenticate()
        mock_get_stock_workspace_overview.side_effect = RuntimeError('boom')

        response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn('detail', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_financial_metrics')
    def test_financial_metrics_refactored_returns_502_on_unexpected_exception(self, mock_get_financial_metrics):
        self.authenticate()
        mock_get_financial_metrics.return_value = {
            'symbol': 'VNM',
            'years': [],
            'source': 'error',
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/stock-management/stocks/VNM/financials/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertEqual(response.data['years'], [])

    @patch('portfolio.views.fetch_financial_ratio_dataframe')
    def test_financial_metrics_returns_502_on_unexpected_provider_exception(self, mock_fetch_financials):
        self.authenticate()
        mock_fetch_financials.side_effect = RuntimeError('provider broken')

        response = self.client.get('/api/stock-management/stocks/VNM/financials/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertEqual(response.data['years'], [])
        self.assertIn('source', response.data)

    @patch('portfolio.views._build_stock_workspace_overview')
    def test_stock_workspace_overview_fallback_when_base_builder_crashes(self, mock_build_overview):
        self.authenticate()
        StockProfile.objects.create(symbol='VNM', company_name='Vinamilk')
        mock_build_overview.side_effect = RuntimeError('unexpected error')

        response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertIn('current_price', response.data)
        self.assertIn('market_groups', response.data)

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
        mock_get_stock_workspace_chart.assert_called_once_with(self.user, 'VNM', 120)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_chart')
    def test_stock_workspace_chart_endpoint_rejects_invalid_days(self, mock_get_stock_workspace_chart):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/VNM/chart/?days=9999')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_get_stock_workspace_chart.assert_not_called()

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

    def test_tracked_symbol_supports_per_symbol_threshold_create_and_patch(self):
        self.authenticate()

        create_response = self.client.post(
            '/api/stock-management/tracked-symbols/',
            {
                'symbol': 'FPT',
                'whale_alert_threshold_million': 850,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['symbol'], 'FPT')
        self.assertEqual(create_response.data['whale_alert_threshold_million'], 850.0)

        tracked_id = create_response.data['id']
        patch_response = self.client.patch(
            f'/api/stock-management/tracked-symbols/{tracked_id}/',
            {
                'whale_alert_threshold_million': 920,
            },
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data['whale_alert_threshold_million'], 920.0)

        clear_response = self.client.patch(
            f'/api/stock-management/tracked-symbols/{tracked_id}/',
            {
                'whale_alert_threshold_million': None,
            },
            format='json',
        )
        self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(clear_response.data['whale_alert_threshold_million'])

    def test_whale_feed_aggregate_applies_per_symbol_threshold_override(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT', whale_alert_threshold_million=900)
        TrackedSymbol.objects.create(user=self.user, symbol='HPG')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-threshold-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='hpg-threshold-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=tracked&sort=matched_value&limit=20')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_symbols = [row['symbol'] for row in response.data['results']]
        self.assertIn('HPG', result_symbols)
        self.assertNotIn('FPT', result_symbols)

    def test_tracked_symbol_bulk_threshold_endpoint_updates_multiple_rows(self):
        self.authenticate()
        ts1 = TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        ts2 = TrackedSymbol.objects.create(user=self.user, symbol='HPG', whale_alert_threshold_million=600)

        response = self.client.post(
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [ts1.id, ts2.id],
                'whale_alert_threshold_million': 750,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_count'], 2)
        self.assertEqual(response.data['whale_alert_threshold_million'], 750.0)
        self.assertEqual(len(response.data['rows']), 2)
        returned_ids = sorted([row['id'] for row in response.data['rows']])
        self.assertEqual(returned_ids, sorted([ts1.id, ts2.id]))
        ts1.refresh_from_db()
        ts2.refresh_from_db()
        self.assertEqual(float(ts1.whale_alert_threshold_million), 750.0)
        self.assertEqual(float(ts2.whale_alert_threshold_million), 750.0)

    def test_tracked_symbol_bulk_threshold_endpoint_validates_ids(self):
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [],
                'whale_alert_threshold_million': 500,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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
                'company_name': 'Ngân hàng TMCP Ngoại thương Việt Nam',
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
                'company_name': 'CTCP Tập đoàn Hòa Phát',
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
                'company_name': 'Ngân hàng TMCP Quân đội',
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