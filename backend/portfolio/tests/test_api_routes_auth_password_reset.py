from unittest.mock import patch

from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio import auth_views
from portfolio.password_reset import generate_password_reset_token


class ApiRouteAuthPasswordResetTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)
        cache.clear()

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    @patch('portfolio.auth_views.send_password_reset_email', return_value=1)
    def test_password_reset_request_sends_email_when_user_exists(self, mock_send_password_reset_email):
        response = self.client.post(
            '/api/auth/password-reset/request/',
            {'identifier': self.username},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        mock_send_password_reset_email.assert_called_once_with(self.user)

    @patch('portfolio.auth_views.send_password_reset_email', return_value=1)
    def test_password_reset_request_returns_generic_message_for_unknown_user(self, mock_send_password_reset_email):
        response = self.client.post(
            '/api/auth/password-reset/request/',
            {'identifier': 'unknown-user'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        mock_send_password_reset_email.assert_not_called()

    @patch('portfolio.auth_views.logger')
    def test_password_reset_request_logs_unknown_identifier(self, mock_logger):
        response = self.client.post(
            '/api/auth/password-reset/request/',
            {'identifier': 'missing-user'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_logger.info.assert_any_call(
            'password_reset_request.unknown_identifier identifier_type=%s ip=%s',
            'username',
            '127.0.0.1',
        )

    def test_password_reset_confirm_updates_password(self):
        token = generate_password_reset_token(self.user)
        new_password = 'NewPass@123456'

        response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'token': token,
                'new_password': new_password,
                'new_password_confirm': new_password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

        login_response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': new_password},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm_rejects_invalid_token(self):
        response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'token': 'invalid-token',
                'new_password': 'NewPass@123456',
                'new_password_confirm': 'NewPass@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', response.data)

    @patch('portfolio.auth_views.logger')
    def test_password_reset_confirm_logs_invalid_token(self, mock_logger):
        response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'token': 'invalid-token',
                'new_password': 'NewPass@123456',
                'new_password_confirm': 'NewPass@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_logger.warning.assert_any_call('password_reset_confirm.invalid_token ip=%s', '127.0.0.1')

    @patch('portfolio.auth_views.logger')
    def test_password_reset_confirm_logs_success(self, mock_logger):
        token = generate_password_reset_token(self.user)
        response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'token': token,
                'new_password': 'Success@123456',
                'new_password_confirm': 'Success@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_logger.info.assert_any_call('password_reset_confirm.success user_id=%s ip=%s', self.user.id, '127.0.0.1')

    def test_password_reset_views_define_dedicated_throttle_scopes(self):
        self.assertEqual(auth_views.PasswordResetRequestView.throttle_scope, 'auth_password_reset_request')
        self.assertEqual(auth_views.PasswordResetConfirmView.throttle_scope, 'auth_password_reset_confirm')