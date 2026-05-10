from unittest.mock import patch

from django.contrib.auth.models import User
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import OnboardingPlanPolicy, PlanAssignmentLog, Portfolio, SubAccount, UserConfig


class ApiRouteAuthRegisterTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

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
