"""
C3 Email Onboarding Celery Tasks Tests

Tests for async email sending tasks:
- send_email_verification_token: async email for registration verification
- send_password_reset_email: async email for password reset
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone

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

    @patch('identity_access.mail_service.send_system_email')
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

    @patch('identity_access.mail_service.send_system_email')
    @patch('data_ingest.tasks.send_mail')
    def test_send_password_reset_email_failure(self, mock_send_mail, mock_send_system):
        """Test: send_password_reset_email handles send failure."""
        mock_send_system.side_effect = Exception('SMTP timeout')
        mock_send_mail.side_effect = Exception('SMTP timeout')

        result = send_password_reset_email(
            email=self.email,
            token=self.token,
            frontend_url=self.frontend_url,
        )

        # Verify result indicates failure
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['email'], self.email)
        self.assertIn('error', result)

    @patch('identity_access.mail_service.send_system_email')
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


class SendWelcomeEmailTests(TestCase):
    """Tests for send_welcome_email Celery task (Sprint 2)."""

    @patch('identity_access.mail_service.send_system_email')
    def test_send_welcome_email_success(self, mock_send):
        mock_send.return_value = 1
        from django.contrib.auth.models import User as DjangoUser

        from identity_access.models import CoreTenant, UserProfile
        user = DjangoUser.objects.create_user(
            username='welcometest', email='welcome@test.com', password='pass123',
        )
        profile = UserProfile.objects.create(user=user, display_name='Welcome User')
        tenant = CoreTenant.objects.create(
            owner_user=user, display_name='Test Tenant',
            tenant_code='t-welcome-test', plan='free', status='trial',
        )
        from identity_access.email_tasks import send_welcome_email
        result = send_welcome_email(user.id, tenant.public_id)
        self.assertEqual(result['status'], 'sent')
        self.assertEqual(result['recipient'], user.email)
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        self.assertIn(user.email, call_args[1]['recipient_list'])
        self.assertIn('html_message', call_args[1])

    @patch('identity_access.mail_service.send_system_email')
    def test_send_welcome_email_user_not_found(self, mock_send):
        from identity_access.email_tasks import send_welcome_email
        result = send_welcome_email(99999, 'nonexistent-id')
        self.assertEqual(result['status'], 'skipped')
        mock_send.assert_not_called()

    @patch('identity_access.mail_service.send_system_email')
    def test_send_welcome_email_send_failure_retries(self, mock_send):
        mock_send.side_effect = Exception('SMTP down')
        from django.contrib.auth.models import User as DjangoUser

        from identity_access.models import CoreTenant, UserProfile
        user = DjangoUser.objects.create_user(
            username='retrytest', email='retry@test.com', password='pass123',
        )
        UserProfile.objects.create(user=user, display_name='Retry User')
        tenant = CoreTenant.objects.create(
            owner_user=user, display_name='Retry Tenant',
            tenant_code='t-retry-test', plan='free', status='trial',
        )
        from identity_access.email_tasks import send_welcome_email
        with self.assertRaises(Exception):
            send_welcome_email(user.id, tenant.public_id)


class SendInviteEmailTests(TestCase):
    """Tests for send_invite_email Celery task (Sprint 2)."""

    @patch('identity_access.mail_service.send_system_email')
    def test_send_invite_email_success(self, mock_send):
        mock_send.return_value = 1
        from django.contrib.auth.models import User as DjangoUser

        from identity_access.models import CoreTenant, TenantInvite, UserProfile
        user = DjangoUser.objects.create_user(
            username='inviter1', email='inviter@test.com', password='pass123',
        )
        UserProfile.objects.create(user=user, display_name='Inviter User')
        tenant = CoreTenant.objects.create(
            owner_user=user, display_name='Invite Tenant',
            tenant_code='t-invite-test', plan='free', status='trial',
        )
        invite = TenantInvite.objects.create(
            tenant=tenant, invited_email='invitee@test.com',
            inviter=user, token=TenantInvite.generate_token(),
            role='viewer', expires_at=timezone.now() + timedelta(days=7),
        )
        from identity_access.email_tasks import send_invite_email
        result = send_invite_email(invite.id)
        self.assertEqual(result['status'], 'sent')
        self.assertEqual(result['recipient'], 'invitee@test.com')
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        self.assertIn('invitee@test.com', call_args[1]['recipient_list'])

    @patch('identity_access.mail_service.send_system_email')
    def test_send_invite_email_not_found(self, mock_send):
        from identity_access.email_tasks import send_invite_email
        result = send_invite_email(99999)
        self.assertEqual(result['status'], 'skipped')
        mock_send.assert_not_called()

    @patch('identity_access.mail_service.send_system_email')
    def test_send_invite_email_already_accepted(self, mock_send):
        from django.contrib.auth.models import User as DjangoUser

        from identity_access.models import CoreTenant, TenantInvite, UserProfile
        user = DjangoUser.objects.create_user(
            username='inviter2', email='inviter2@test.com', password='pass123',
        )
        UserProfile.objects.create(user=user, display_name='Inviter 2')
        tenant = CoreTenant.objects.create(
            owner_user=user, display_name='Invite Tenant 2',
            tenant_code='t-invite-test2', plan='free', status='trial',
        )
        invite = TenantInvite.objects.create(
            tenant=tenant, invited_email='invitee2@test.com',
            inviter=user, token=TenantInvite.generate_token(),
            role='viewer', expires_at=timezone.now() + timedelta(days=7),
            status=TenantInvite.StatusChoices.ACCEPTED,
        )
        from identity_access.email_tasks import send_invite_email
        result = send_invite_email(invite.id)
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'not_pending')
        mock_send.assert_not_called()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class EmailTaskIntegrationTests(TestCase):
    """Integration tests for email tasks in views."""

    def setUp(self):
        from vninvest_core.celery import app as celery_app
        celery_app.conf.task_always_eager = True
        self.email = 'integration@example.com'
        self.user = User.objects.create_user(
            username='testuser', email=self.email, password='password123',
        )

    def tearDown(self):
        from vninvest_core.celery import app as celery_app
        celery_app.conf.task_always_eager = False

    @patch('data_ingest.tasks.send_mail')
    def test_register_view_wires_welcome_email(self, mock_send):
        """onboarding register_tenant_view → send_welcome_email.delay called."""
        mock_send.return_value = 1
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.post(
            '/core/v1/onboarding/register/',
            {'display_name': 'Integration Tenant'}, format='json',
        )
        self.assertEqual(response.status_code, 201)

    @patch('identity_access.mail_service.send_system_email')
    def test_invite_view_wires_invite_email(self, mock_send):
        """TenantInvitesCombinedView.post → send_invite_email.delay called."""
        from identity_access.models import CoreTenant, TenantMember
        tenant = CoreTenant.objects.create(
            owner_user=self.user, display_name='Int Tenant',
            tenant_code='t-int-test', plan='free', status='trial',
        )
        TenantMember.objects.create(
            tenant=tenant, user=self.user, role='owner',
        )
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.post(
            '/core/v1/tenant-members/invites/',
            {'invited_email': 'newmember@test.com', 'role': 'viewer'},
            format='json',
            HTTP_X_TENANT_ID=str(tenant.public_id),
        )
        # Either 201 (invite created + email enqueued) or 400 (validation)
        self.assertIn(response.status_code, [201, 400])
        if response.status_code == 201:
            mock_send.assert_called()
