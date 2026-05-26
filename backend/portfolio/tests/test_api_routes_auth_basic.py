from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig


class ApiRouteAuthBasicTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_jwt_token_obtain_endpoint(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data['code'], 'LEGACY_AUTH_DECOMMISSIONED')
        self.assertIn('Các endpoint xác thực cũ đã bị gỡ bỏ khỏi hệ thống', response.data['detail'])

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
