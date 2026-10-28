# Location: packages/core/backend/src/identity_access/tests/test_admin_mail_oauth.py
"""
Tests for SystemMailConfigAdmin Google OAuth2 connect/callback/revoke views.
Covers: connect redirect, callback token save, revoke token clear, test-email action,
        non-staff access denial.
"""
# Inject mock google modules BEFORE any import that might pull them
import sys
import uuid
from unittest.mock import MagicMock, patch

sys.modules.setdefault('google', MagicMock())
sys.modules.setdefault('google.oauth2', MagicMock())
sys.modules.setdefault('google.oauth2.service_account', MagicMock())
sys.modules.setdefault('googleapiclient', MagicMock())
sys.modules.setdefault('googleapiclient.discovery', MagicMock())

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core import signing
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from identity_access.models import MailConfigAuditLog, SystemMailConfig

User = get_user_model()
TEST_FERNET_KEY = Fernet.generate_key().decode()


def _make_signed_state(config_id, user_id):
    return signing.dumps(
        {'config_id': config_id, 'user_id': user_id, 'nonce': uuid.uuid4().hex},
        salt='identity_access.system-mail-google-oauth-state',
    )


@override_settings(
    DEFAULT_FROM_EMAIL='fallback@vninvest.vn',
    FRONTEND_URL='http://localhost:3000',
    DEBUG=True,
    SESSION_ENGINE='django.contrib.sessions.backends.db',
)
class AdminMailOAuthConnectTests(TestCase):
    """Tests for the google_connect_view."""

    def setUp(self):
        self.client = Client()
        self.staff = User.objects.create_user(
            username='staff_oauth',
            email='staff@vninvest.vn',
            password='Password123!',
            is_staff=True,
            is_superuser=True,
        )
        self.config = SystemMailConfig.objects.create(
            name='Test OAuth Config',
            provider=SystemMailConfig.PROVIDER_GMAIL,
            from_email='noreply@vninvest.vn',
            is_active=False,
        )
        self.config.google_client_id = 'test-client-id'
        self.config.set_google_client_secret('test-client-secret')
        self.config.save()
        self.client.force_login(self.staff)

    def _connect_url(self):
        return reverse('admin:identity_access_systemmailconfig_google_connect', args=[self.config.pk])

    def test_connect_view_redirects_to_google(self):
        """google_connect_view must redirect to accounts.google.com authorize URL."""
        with patch(
            'identity_access.admin.build_google_oauth_authorize_url',
            return_value='https://accounts.google.com/o/oauth2/auth?test=1',
        ):
            response = self.client.get(self._connect_url())

        self.assertEqual(response.status_code, 302)
        self.assertIn('accounts.google.com', response['Location'])

    def test_connect_view_sets_session_state(self):
        """Session must store mail_google_oauth_state after connect redirect."""
        with patch(
            'identity_access.admin.build_google_oauth_authorize_url',
            return_value='https://accounts.google.com/o/oauth2/auth',
        ):
            response = self.client.get(self._connect_url())

        session = self.client.session
        self.assertIn('mail_google_oauth_state', session)
        self.assertEqual(session['mail_google_oauth_account_id'], self.config.pk)

    def test_connect_view_rejects_non_gmail_provider(self):
        """connect view for SMTP config must redirect back with error message, not to Google."""
        smtp_config = SystemMailConfig.objects.create(
            name='SMTP Config',
            provider=SystemMailConfig.PROVIDER_SMTP,
            from_email='smtp@vninvest.vn',
        )
        url = reverse('admin:identity_access_systemmailconfig_google_connect', args=[smtp_config.pk])
        response = self.client.get(url)
        # Should redirect back to change page, NOT to Google
        self.assertEqual(response.status_code, 302)
        self.assertNotIn('accounts.google.com', response['Location'])

    def test_connect_view_rejects_missing_client_secret(self):
        """connect view without client secret must redirect back, not to Google."""
        bare_config = SystemMailConfig.objects.create(
            name='No Secret Config',
            provider=SystemMailConfig.PROVIDER_GMAIL,
            from_email='bare@vninvest.vn',
            google_client_id='cid',
        )
        # do NOT set client secret
        url = reverse('admin:identity_access_systemmailconfig_google_connect', args=[bare_config.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        self.assertNotIn('accounts.google.com', response['Location'])

    def test_non_staff_cannot_access_connect_view(self):
        """Non-staff user must be redirected to login, not reach connect view."""
        non_staff = User.objects.create_user(
            username='plainuser_oauth',
            email='plain@vninvest.vn',
            password='Password123!',
            is_staff=False,
        )
        self.client.force_login(non_staff)
        response = self.client.get(self._connect_url())
        # Admin redirects non-staff to login
        self.assertIn(response.status_code, [302, 403])
        if response.status_code == 302:
            self.assertIn('/login/', response['Location'])


@override_settings(
    DEFAULT_FROM_EMAIL='fallback@vninvest.vn',
    FRONTEND_URL='http://localhost:3000',
    DEBUG=True,
    SESSION_ENGINE='django.contrib.sessions.backends.db',
)
class AdminMailOAuthCallbackTests(TestCase):
    """Tests for the google_callback_view."""

    def setUp(self):
        self.client = Client()
        self.staff = User.objects.create_user(
            username='staff_callback',
            email='staff_cb@vninvest.vn',
            password='Password123!',
            is_staff=True,
            is_superuser=True,
        )
        self.config = SystemMailConfig.objects.create(
            name='Callback Config',
            provider=SystemMailConfig.PROVIDER_GMAIL,
            from_email='noreply@vninvest.vn',
            is_active=False,
        )
        self.config.google_client_id = 'test-client-id'
        self.config.set_google_client_secret('test-client-secret')
        self.config.save()
        self.client.force_login(self.staff)

    def _callback_url(self):
        return reverse('admin:identity_access_systemmailconfig_google_callback')

    def _seed_session(self, state_token):
        session = self.client.session
        session['mail_google_oauth_state'] = state_token
        session['mail_google_oauth_account_id'] = self.config.pk
        session.save()

    def test_callback_saves_refresh_token_and_audit_log(self):
        """callback_view must persist refresh_token and create MailConfigAuditLog."""
        state = _make_signed_state(self.config.pk, self.staff.pk)
        self._seed_session(state)

        mock_token = {
            'refresh_token': 'rt-abc123',
            'access_token': 'at-xyz',
            'scope': 'https://www.googleapis.com/auth/gmail.send',
        }
        with patch('identity_access.admin.exchange_google_oauth_code', return_value=mock_token), \
             patch('identity_access.admin.fetch_google_user_email', return_value='noreply@vninvest.vn'):
            response = self.client.get(self._callback_url(), {'state': state, 'code': 'authcode123'})

        self.assertEqual(response.status_code, 302)
        self.config.refresh_from_db()
        self.assertTrue(self.config.has_google_refresh_token)
        self.assertIsNotNone(self.config.oauth_connected_at)
        self.assertEqual(self.config.google_account_email, 'noreply@vninvest.vn')
        self.assertTrue(
            MailConfigAuditLog.objects.filter(
                target_config_id=self.config.pk,
                action='google_connect',
            ).exists()
        )

    def test_callback_rejects_mismatched_state(self):
        """callback_view with state mismatch must not save token and redirect with error."""
        real_state = _make_signed_state(self.config.pk, self.staff.pk)
        self._seed_session(real_state)
        wrong_state = _make_signed_state(self.config.pk, self.staff.pk)  # different nonce

        initial_token = self.config.google_refresh_token_encrypted
        response = self.client.get(self._callback_url(), {'state': wrong_state, 'code': 'code'})

        self.assertEqual(response.status_code, 302)
        self.config.refresh_from_db()
        self.assertEqual(self.config.google_refresh_token_encrypted, initial_token)

    def test_callback_rejects_oauth_error_param(self):
        """callback_view with ?error= from Google must redirect without saving token."""
        state = _make_signed_state(self.config.pk, self.staff.pk)
        self._seed_session(state)

        response = self.client.get(self._callback_url(), {'state': state, 'error': 'access_denied'})
        self.assertEqual(response.status_code, 302)
        self.config.refresh_from_db()
        self.assertFalse(self.config.has_google_refresh_token)

    def test_callback_rejects_expired_state(self):
        """callback_view with expired signed state (max_age) must redirect with error."""
        # Forge a state signed with a past timestamp by monkeypatching max_age check
        state = _make_signed_state(self.config.pk, self.staff.pk)
        self._seed_session(state)

        with patch('identity_access.admin.signing.loads', side_effect=signing.SignatureExpired('expired')):
            response = self.client.get(self._callback_url(), {'state': state, 'code': 'code'})

        self.assertEqual(response.status_code, 302)
        self.config.refresh_from_db()
        self.assertFalse(self.config.has_google_refresh_token)


@override_settings(
    DEFAULT_FROM_EMAIL='fallback@vninvest.vn',
    FRONTEND_URL='http://localhost:3000',
    DEBUG=True,
    SESSION_ENGINE='django.contrib.sessions.backends.db',
)
class AdminMailOAuthRevokeTests(TestCase):
    """Tests for the google_revoke_view."""

    def setUp(self):
        self.client = Client()
        self.staff = User.objects.create_user(
            username='staff_revoke',
            email='staff_rv@vninvest.vn',
            password='Password123!',
            is_staff=True,
            is_superuser=True,
        )
        self.config = SystemMailConfig.objects.create(
            name='Revoke Config',
            provider=SystemMailConfig.PROVIDER_GMAIL,
            from_email='noreply@vninvest.vn',
            is_active=False,
        )
        self.config.google_client_id = 'test-client-id'
        self.config.set_google_client_secret('test-client-secret')
        self.config.set_google_refresh_token('refresh-token-to-revoke')
        self.config.save()
        self.client.force_login(self.staff)

    def _revoke_url(self):
        return reverse('admin:identity_access_systemmailconfig_google_revoke', args=[self.config.pk])

    def test_revoke_clears_refresh_token(self):
        """revoke_view must clear google_refresh_token_encrypted."""
        self.assertTrue(self.config.has_google_refresh_token)

        response = self.client.get(self._revoke_url())

        self.assertEqual(response.status_code, 302)
        self.config.refresh_from_db()
        self.assertFalse(self.config.has_google_refresh_token)

    def test_revoke_clears_oauth_timestamps(self):
        """revoke_view must set oauth_connected_at and token_last_refreshed_at to None."""
        from django.utils import timezone
        self.config.oauth_connected_at = timezone.now()
        self.config.token_last_refreshed_at = timezone.now()
        self.config.save(update_fields=['oauth_connected_at', 'token_last_refreshed_at'])

        response = self.client.get(self._revoke_url())
        self.assertEqual(response.status_code, 302)

        self.config.refresh_from_db()
        self.assertIsNone(self.config.oauth_connected_at)
        self.assertIsNone(self.config.token_last_refreshed_at)

    def test_revoke_creates_audit_log(self):
        """revoke_view must create a MailConfigAuditLog with action='google_revoke'."""
        self.client.get(self._revoke_url())
        self.assertTrue(
            MailConfigAuditLog.objects.filter(
                target_config_id=self.config.pk,
                action='google_revoke',
            ).exists()
        )


@override_settings(
    DEFAULT_FROM_EMAIL='fallback@vninvest.vn',
    FRONTEND_URL='http://localhost:3000',
    DEBUG=True,
    SESSION_ENGINE='django.contrib.sessions.backends.db',
)
class AdminSendTestEmailActionTests(TestCase):
    """Tests for the send_test_email_to_selected_accounts admin action."""

    def setUp(self):
        self.client = Client()
        self.staff = User.objects.create_user(
            username='staff_test_action',
            email='staff_ta@vninvest.vn',
            password='Password123!',
            is_staff=True,
            is_superuser=True,
        )
        self.config = SystemMailConfig.objects.create(
            name='Action Config',
            provider=SystemMailConfig.PROVIDER_SMTP,
            from_email='noreply@vninvest.vn',
            smtp_host='smtp.example.com',
            smtp_port=587,
            smtp_username='user@example.com',
            is_active=False,
        )
        self.client.force_login(self.staff)

    def test_send_test_email_action_calls_send_test_email(self):
        """Admin action 'send_test_email_to_selected_accounts' must call mail_service.send_test_email."""
        changelist_url = reverse('admin:identity_access_systemmailconfig_changelist')
        with patch('identity_access.admin.send_test_email') as mock_send:
            mock_send.return_value = 1
            self.client.post(changelist_url, {
                'action': 'send_test_email_to_selected_accounts',
                '_selected_action': [str(self.config.pk)],
            })
        mock_send.assert_called_once_with(self.config, self.staff.email)

    def test_send_test_email_action_no_email_shows_error(self):
        """Admin action with staff having no email must show error message, not crash."""
        self.staff.email = ''
        self.staff.save(update_fields=['email'])
        changelist_url = reverse('admin:identity_access_systemmailconfig_changelist')
        with patch('identity_access.admin.send_test_email') as mock_send:
            response = self.client.post(changelist_url, {
                'action': 'send_test_email_to_selected_accounts',
                '_selected_action': [str(self.config.pk)],
            })
        mock_send.assert_not_called()
