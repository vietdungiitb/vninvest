from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import OnboardingPlanPolicy, PlanAssignmentLog, Portfolio, SubAccount, UserConfig
from portfolio.starter_portfolio_service import STARTER_PORTFOLIO_TEMPLATES, STARTER_SUBACCOUNT_TEMPLATES


class ApiRouteAuthOauthGoogleTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

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
        cfg.oauth_provider = 'google'
        cfg.oauth_uid = 'oauth-existing@example.com'
        cfg.save(update_fields=['plan', 'plan_source', 'email_verified', 'oauth_provider', 'oauth_uid', 'updated_at'])

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