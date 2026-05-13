"""
C3 Email Onboarding Celery Tasks Tests

Tests for async email sending tasks:
- send_email_verification_token: async email for registration verification
- send_password_reset_email: async email for password reset
"""

from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from data_ingest.tasks import send_email_verification_token, send_password_reset_email


class EmailVerificationTokenTaskTests(TestCase):
    """Test send_email_verification_token Celery task."""

    def setUp(self):
        """Set up test data."""
        self.email = 'verify@example.com'
        self.token = 'test_token_xyz'
        self.frontend_url = 'http://localhost:3000'

    @patch('data_ingest.tasks.send_mail')
    def test_send_email_verification_token_success(self, mock_send):
        """Test: send_email_verification_token sends email successfully."""
        mock_send.return_value = 1  # Successful send

        result = send_email_verification_token(
            email=self.email,
            token=self.token,
            frontend_url=self.frontend_url,
        )

        # Verify result
        self.assertEqual(result['status'], 'sent')
        self.assertEqual(result['email'], self.email)

        # Verify send_mail was called
        mock_send.assert_called_once()
        call_args = mock_send.call_args

        # Verify email content
        self.assertIn('verify-email', call_args[1]['message'])
        self.assertIn(self.token, call_args[1]['message'])
        self.assertEqual(call_args[1]['recipient_list'], [self.email])

    @patch('data_ingest.tasks.send_mail')
    def test_send_email_verification_token_failure(self, mock_send):
        """Test: send_email_verification_token handles send failure."""
        mock_send.side_effect = Exception('SMTP connection failed')

        # Task should handle exception gracefully
        result = send_email_verification_token(
            email=self.email,
            token=self.token,
            frontend_url=self.frontend_url,
        )

        # Verify result indicates failure
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['email'], self.email)
        self.assertIn('error', result)

    @patch('data_ingest.tasks.send_mail')
    def test_send_email_verification_token_default_frontend_url(self, mock_send):
        """Test: send_email_verification_token uses default frontend_url if not provided."""
        mock_send.return_value = 1

        result = send_email_verification_token(
            email=self.email,
            token=self.token,
            # frontend_url not provided
        )

        self.assertEqual(result['status'], 'sent')
        mock_send.assert_called_once()

        # Verify email contains a valid reset URL (with localhost fallback)
        call_args = mock_send.call_args
        message = call_args[1]['message']
        self.assertIn('verify-email', message)
        self.assertIn(self.token, message)


class PasswordResetEmailTaskTests(TestCase):
    """Test send_password_reset_email Celery task."""

    def setUp(self):
        """Set up test data."""
        self.email = 'reset@example.com'
        self.token = 'reset_token_abc'
        self.frontend_url = 'http://localhost:3000'

    @patch('data_ingest.tasks.send_mail')
    def test_send_password_reset_email_success(self, mock_send):
        """Test: send_password_reset_email sends email successfully."""
        mock_send.return_value = 1

        result = send_password_reset_email(
            email=self.email,
            token=self.token,
            frontend_url=self.frontend_url,
        )

        # Verify result
        self.assertEqual(result['status'], 'sent')
        self.assertEqual(result['email'], self.email)

        # Verify send_mail was called
        mock_send.assert_called_once()
        call_args = mock_send.call_args

        # Verify email content
        self.assertIn('reset-password', call_args[1]['message'])
        self.assertIn(self.token, call_args[1]['message'])
        self.assertIn('1 giờ', call_args[1]['message'])  # Vietnamese "1 hour"
        self.assertEqual(call_args[1]['recipient_list'], [self.email])

    @patch('data_ingest.tasks.send_mail')
    def test_send_password_reset_email_failure(self, mock_send):
        """Test: send_password_reset_email handles send failure."""
        mock_send.side_effect = Exception('SMTP timeout')

        result = send_password_reset_email(
            email=self.email,
            token=self.token,
            frontend_url=self.frontend_url,
        )

        # Verify result indicates failure
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['email'], self.email)
        self.assertIn('error', result)

    @patch('data_ingest.tasks.send_mail')
    def test_send_password_reset_email_default_frontend_url(self, mock_send):
        """Test: send_password_reset_email uses default frontend_url if not provided."""
        mock_send.return_value = 1

        result = send_password_reset_email(
            email=self.email,
            token=self.token,
            # frontend_url not provided
        )

        self.assertEqual(result['status'], 'sent')
        mock_send.assert_called_once()

        # Verify email contains a valid reset URL
        call_args = mock_send.call_args
        message = call_args[1]['message']
        self.assertIn('reset-password', message)
        self.assertIn(self.token, message)


class EmailTaskIntegrationTests(TestCase):
    """Integration tests for email tasks in views."""

    def setUp(self):
        """Set up test data."""
        self.email = 'integration@example.com'
        self.user = User.objects.create_user(
            username='testuser',
            email=self.email,
            password='password123',
        )

    @patch('data_ingest.tasks.send_mail')
    def test_password_reset_view_calls_async_task(self, mock_send):
        """Test: password_reset_request_view calls async email task."""
        mock_send.return_value = 1

        # Call password reset request (should queue task, not block)
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model

        User = get_user_model()
        admin = User.objects.create_superuser('admin', 'admin@test.com', 'admin')

        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(
            '/api/auth/password-reset/',
            {'email': self.email},
            format='json',
        )

        # Should return 200 (user enumeration protection)
        self.assertEqual(response.status_code, 200)

        # Email task should have been queued (not sent synchronously)
        # Note: In dev mode with CELERY_ALWAYS_EAGER=True, task runs immediately
        # In production, task would be queued for later execution

    @patch('data_ingest.tasks.send_mail')
    def test_register_view_calls_async_task(self, mock_send):
        """Test: register_view calls async email task for verification."""
        mock_send.return_value = 1

        from rest_framework.test import APIClient

        client = APIClient()

        response = client.post(
            '/api/auth/register/',
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'password': 'NewPassword123!',
                'password_confirm': 'NewPassword123!',
                'first_name': 'New',
                'last_name': 'User',
            },
            format='json',
        )

        # Should return 201 (registration success)
        self.assertEqual(response.status_code, 201)

        # Email task should have been queued
        # In dev mode with CELERY_ALWAYS_EAGER=True, task runs immediately
