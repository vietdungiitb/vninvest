from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.email_verification import generate_email_verification_token
from portfolio.models import UserConfig


class ApiRouteAuthEmailVerificationTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

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