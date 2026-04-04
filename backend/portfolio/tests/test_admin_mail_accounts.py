from unittest.mock import patch

import httpx
from django.contrib.auth.models import User
from django.core import signing
from django.test import TestCase
from django.urls import reverse

from portfolio.email_verification import send_verification_email
from portfolio.google_oauth_service import refresh_google_access_token
from portfolio.mail_service import build_email_connection, send_system_email, send_test_email
from portfolio.models import SystemEmailAccount


def _build_http_status_error(status_code: int, payload: dict) -> httpx.HTTPStatusError:
    request = httpx.Request('POST', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
    response = httpx.Response(status_code, request=request, json=payload)
    return httpx.HTTPStatusError('Gmail error', request=request, response=response)


class SystemEmailAccountModelTests(TestCase):
    def test_saving_new_default_account_unsets_previous_default(self):
        primary = SystemEmailAccount.objects.create(
            name='Primary SMTP',
            host='smtp.primary.local',
            port=587,
            from_email='primary@example.com',
            is_default=True,
        )

        fallback = SystemEmailAccount.objects.create(
            name='Fallback SMTP',
            host='smtp.fallback.local',
            port=465,
            from_email='fallback@example.com',
            use_tls=False,
            use_ssl=True,
            is_default=True,
        )

        primary.refresh_from_db()
        fallback.refresh_from_db()
        self.assertFalse(primary.is_default)
        self.assertTrue(fallback.is_default)

    @patch('portfolio.mail_service.get_connection')
    def test_build_email_connection_uses_database_config(self, mock_get_connection):
        account = SystemEmailAccount(
            name='SMTP DB Config',
            host='smtp.gmail.com',
            port=587,
            username='mailer@example.com',
            from_email='mailer@example.com',
            timeout_seconds=30,
            use_tls=True,
            use_ssl=False,
        )
        account.set_smtp_password('app-password-123')

        build_email_connection(account)

        mock_get_connection.assert_called_once_with(
            backend='django.core.mail.backends.smtp.EmailBackend',
            host='smtp.gmail.com',
            port=587,
            username='mailer@example.com',
            password='app-password-123',
            use_tls=True,
            use_ssl=False,
            timeout=30,
            fail_silently=False,
        )

    @patch('portfolio.mail_service.send_system_email', return_value=1)
    def test_send_test_email_updates_latest_status(self, mock_send_system_email):
        account = SystemEmailAccount.objects.create(
            name='SMTP Tester',
            host='smtp.test.local',
            port=587,
            from_email='tester@example.com',
            is_default=True,
        )

        sent_count = send_test_email(account, 'ops@example.com')

        self.assertEqual(sent_count, 1)
        account.refresh_from_db()
        self.assertEqual(account.last_test_status, SystemEmailAccount.TestStatusChoices.SUCCESS)
        self.assertIn('ops@example.com', account.last_test_message)
        mock_send_system_email.assert_called_once()

    @patch('portfolio.mail_service.send_gmail_api_message', return_value=1)
    @patch('portfolio.mail_service.refresh_google_access_token')
    def test_send_system_email_uses_google_oauth2_branch(self, mock_refresh_token, mock_send_gmail):
        mock_refresh_token.return_value = {
            'access_token': 'google-access-token',
            'expires_in': 3599,
            'token_type': 'Bearer',
        }
        account = SystemEmailAccount.objects.create(
            name='Google Mail Sender',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='google-mailer@example.com',
            google_client_id='google-client-id',
        )
        account.set_google_client_secret('google-client-secret')
        account.set_google_refresh_token('google-refresh-token')
        account.save(update_fields=['google_client_secret_ciphertext', 'google_refresh_token_ciphertext', 'updated_at'])

        sent = send_system_email(
            subject='OAuth2 Test',
            message='Testing OAuth2 delivery',
            recipient_list=['ops@example.com'],
            account=account,
        )

        self.assertEqual(sent, 1)
        mock_refresh_token.assert_called_once()
        mock_send_gmail.assert_called_once()
        account.refresh_from_db()
        self.assertEqual(account.token_last_error, '')
        self.assertIsNotNone(account.token_last_refreshed_at)

    @patch('portfolio.mail_service.send_gmail_api_message')
    @patch('portfolio.mail_service.refresh_google_access_token')
    def test_send_system_email_maps_google_401_error(self, mock_refresh_token, mock_send_gmail):
        mock_refresh_token.return_value = {
            'access_token': 'google-access-token',
            'expires_in': 3599,
            'token_type': 'Bearer',
        }
        mock_send_gmail.side_effect = _build_http_status_error(
            401,
            {
                'error': {
                    'code': 401,
                    'message': 'Invalid Credentials',
                    'status': 'UNAUTHENTICATED',
                }
            },
        )

        account = SystemEmailAccount.objects.create(
            name='Google Mail Sender 401',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='google-mailer-401@example.com',
            google_client_id='google-client-id',
        )
        account.set_google_client_secret('google-client-secret')
        account.set_google_refresh_token('google-refresh-token')
        account.save(update_fields=['google_client_secret_ciphertext', 'google_refresh_token_ciphertext', 'updated_at'])

        with self.assertRaises(RuntimeError) as raised:
            send_system_email(
                subject='OAuth2 Test',
                message='Testing OAuth2 failure mapping',
                recipient_list=['ops@example.com'],
                account=account,
            )

        self.assertIn('token không hợp lệ', str(raised.exception))
        account.refresh_from_db()
        self.assertIn('token không hợp lệ', account.token_last_error)

    @patch('portfolio.mail_service.send_gmail_api_message')
    @patch('portfolio.mail_service.refresh_google_access_token')
    def test_send_system_email_maps_google_429_error(self, mock_refresh_token, mock_send_gmail):
        mock_refresh_token.return_value = {
            'access_token': 'google-access-token',
            'expires_in': 3599,
            'token_type': 'Bearer',
        }
        mock_send_gmail.side_effect = _build_http_status_error(
            429,
            {
                'error': {
                    'code': 429,
                    'message': 'Rate Limit Exceeded',
                    'status': 'RESOURCE_EXHAUSTED',
                }
            },
        )

        account = SystemEmailAccount.objects.create(
            name='Google Mail Sender 429',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='google-mailer-429@example.com',
            google_client_id='google-client-id',
        )
        account.set_google_client_secret('google-client-secret')
        account.set_google_refresh_token('google-refresh-token')
        account.save(update_fields=['google_client_secret_ciphertext', 'google_refresh_token_ciphertext', 'updated_at'])

        with self.assertRaises(RuntimeError) as raised:
            send_system_email(
                subject='OAuth2 Test',
                message='Testing OAuth2 rate-limit mapping',
                recipient_list=['ops@example.com'],
                account=account,
            )

        self.assertIn('rate limit', str(raised.exception).lower())
        account.refresh_from_db()
        self.assertIn('rate limit', account.token_last_error.lower())


class SystemEmailAccountAdminTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='mailadmin',
            email='mailadmin@example.com',
            password='Admin@123456',
        )
        self.client.force_login(self.admin_user)

    def test_admin_changelist_is_accessible(self):
        response = self.client.get(reverse('admin:portfolio_systememailaccount_changelist'))
        self.assertEqual(response.status_code, 200)

    @patch('portfolio.admin.send_test_email', return_value=1)
    def test_admin_action_can_send_test_email(self, mock_send_test_email):
        account = SystemEmailAccount.objects.create(
            name='SMTP Admin Action',
            host='smtp.admin.local',
            port=587,
            from_email='admin-action@example.com',
            is_default=True,
        )

        response = self.client.post(
            reverse('admin:portfolio_systememailaccount_changelist'),
            {
                'action': 'send_test_email_to_selected_accounts',
                '_selected_action': [str(account.pk)],
                'index': '0',
            },
        )

        self.assertEqual(response.status_code, 302)
        mock_send_test_email.assert_called_once_with(account, 'mailadmin@example.com')

    @patch('portfolio.admin.build_google_oauth_authorize_url', return_value='https://accounts.google.com/o/oauth2/v2/auth?demo=1')
    def test_google_connect_view_redirects_to_google_authorize_url(self, mock_build_url):
        account = SystemEmailAccount.objects.create(
            name='Google OAuth Account',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='google-admin@example.com',
            google_client_id='google-client-id',
        )
        account.set_google_client_secret('google-client-secret')
        account.save(update_fields=['google_client_secret_ciphertext', 'updated_at'])

        url = reverse('admin:portfolio_systememailaccount_google_connect', args=[account.pk])
        response = self.client.get(url)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, 'https://accounts.google.com/o/oauth2/v2/auth?demo=1')
        mock_build_url.assert_called_once()

    @patch('portfolio.admin.fetch_google_user_email', return_value='oauth-mailer@example.com')
    @patch('portfolio.admin.exchange_google_oauth_code')
    def test_google_callback_view_saves_refresh_token(self, mock_exchange_code, mock_fetch_email):
        mock_exchange_code.return_value = {
            'access_token': 'google-access-token',
            'refresh_token': 'google-refresh-token',
            'scope': 'https://www.googleapis.com/auth/gmail.send openid email',
        }
        account = SystemEmailAccount.objects.create(
            name='Google Callback Account',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='callback-admin@example.com',
            google_client_id='google-client-id',
        )
        account.set_google_client_secret('google-client-secret')
        account.save(update_fields=['google_client_secret_ciphertext', 'updated_at'])

        state_payload = signing.dumps(
            {'account_id': account.pk, 'user_id': self.admin_user.pk},
            salt='portfolio.system-email-google-oauth-state',
        )
        session = self.client.session
        session['mail_google_oauth_state'] = state_payload
        session['mail_google_oauth_account_id'] = account.pk
        session.save()

        callback_url = reverse('admin:portfolio_systememailaccount_google_callback')
        response = self.client.get(callback_url, {'state': state_payload, 'code': 'sample-auth-code'})

        self.assertEqual(response.status_code, 302)
        account.refresh_from_db()
        self.assertTrue(account.has_google_refresh_token)
        self.assertEqual(account.google_account_email, 'oauth-mailer@example.com')
        self.assertEqual(account.token_last_error, '')
        self.assertIsNotNone(account.oauth_connected_at)

    def test_google_callback_view_rejects_state_mismatch(self):
        account = SystemEmailAccount.objects.create(
            name='Google Callback Mismatch',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='mismatch@example.com',
            google_client_id='google-client-id',
        )
        session = self.client.session
        session['mail_google_oauth_state'] = 'expected-state'
        session['mail_google_oauth_account_id'] = account.pk
        session.save()

        callback_url = reverse('admin:portfolio_systememailaccount_google_callback')
        response = self.client.get(callback_url, {'state': 'invalid-state', 'code': 'sample-auth-code'})

        self.assertEqual(response.status_code, 302)
        account.refresh_from_db()
        self.assertFalse(account.has_google_refresh_token)

    @patch('portfolio.admin.signing.loads', side_effect=signing.SignatureExpired('expired'))
    def test_google_callback_view_rejects_expired_state(self, _mock_loads):
        account = SystemEmailAccount.objects.create(
            name='Google Callback Expired',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='expired@example.com',
            google_client_id='google-client-id',
        )
        state_payload = signing.dumps(
            {'account_id': account.pk, 'user_id': self.admin_user.pk},
            salt='portfolio.system-email-google-oauth-state',
        )
        session = self.client.session
        session['mail_google_oauth_state'] = state_payload
        session['mail_google_oauth_account_id'] = account.pk
        session.save()

        callback_url = reverse('admin:portfolio_systememailaccount_google_callback')
        response = self.client.get(callback_url, {'state': state_payload, 'code': 'sample-auth-code'})
        self.assertEqual(response.status_code, 302)
        account.refresh_from_db()
        self.assertFalse(account.has_google_refresh_token)

    def test_google_callback_view_rejects_user_account_payload_mismatch(self):
        account = SystemEmailAccount.objects.create(
            name='Google Callback Payload Mismatch',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='payload-mismatch@example.com',
            google_client_id='google-client-id',
        )
        state_payload = signing.dumps(
            {'account_id': account.pk + 1, 'user_id': self.admin_user.pk + 1},
            salt='portfolio.system-email-google-oauth-state',
        )
        session = self.client.session
        session['mail_google_oauth_state'] = state_payload
        session['mail_google_oauth_account_id'] = account.pk
        session.save()

        callback_url = reverse('admin:portfolio_systememailaccount_google_callback')
        response = self.client.get(callback_url, {'state': state_payload, 'code': 'sample-auth-code'})
        self.assertEqual(response.status_code, 302)
        account.refresh_from_db()
        self.assertFalse(account.has_google_refresh_token)


class GoogleOAuthServiceTests(TestCase):
    """Unit tests for google_oauth_service.refresh_google_access_token in isolation."""

    @patch('portfolio.google_oauth_service.httpx.post')
    def test_refresh_token_returns_access_token_on_success(self, mock_post):
        mock_post.return_value = httpx.Response(
            200,
            json={'access_token': 'new-access-token', 'expires_in': 3599, 'token_type': 'Bearer'},
            request=httpx.Request('POST', 'https://oauth2.googleapis.com/token'),
        )

        result = refresh_google_access_token(
            client_id='test-client-id',
            client_secret='test-client-secret',
            refresh_token='test-refresh-token',
        )

        self.assertEqual(result['access_token'], 'new-access-token')
        self.assertEqual(result['token_type'], 'Bearer')
        mock_post.assert_called_once()
        posted_data = mock_post.call_args.kwargs.get('data', {})
        self.assertEqual(posted_data.get('grant_type'), 'refresh_token')

    def test_refresh_token_raises_value_error_on_missing_credentials(self):
        with self.assertRaises(ValueError) as ctx:
            refresh_google_access_token(
                client_id='',
                client_secret='test-secret',
                refresh_token='test-refresh',
            )
        self.assertIn('Thiếu', str(ctx.exception))

    @patch('portfolio.google_oauth_service.httpx.post')
    def test_refresh_token_raises_value_error_when_response_has_no_access_token(self, mock_post):
        mock_post.return_value = httpx.Response(
            200,
            json={'token_type': 'Bearer', 'expires_in': 3599},
            request=httpx.Request('POST', 'https://oauth2.googleapis.com/token'),
        )

        with self.assertRaises(ValueError) as ctx:
            refresh_google_access_token(
                client_id='test-client-id',
                client_secret='test-client-secret',
                refresh_token='test-refresh-token',
            )
        self.assertIn('access_token', str(ctx.exception))

    @patch('portfolio.google_oauth_service.httpx.post')
    def test_refresh_token_raises_http_status_error_on_401_response(self, mock_post):
        mock_request = httpx.Request('POST', 'https://oauth2.googleapis.com/token')
        mock_post.return_value = httpx.Response(401, json={'error': 'invalid_client'}, request=mock_request)

        with self.assertRaises(httpx.HTTPStatusError):
            refresh_google_access_token(
                client_id='test-client-id',
                client_secret='test-client-secret',
                refresh_token='invalid-refresh-token',
            )


class EmailVerificationRegressionTests(TestCase):
    """Regression tests: send_verification_email() works end-to-end with an OAuth2 default account."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='verifyuser',
            email='verifyuser@example.com',
            password='User@123456',
        )

    @patch('portfolio.mail_service.send_gmail_api_message', return_value=1)
    @patch('portfolio.mail_service.refresh_google_access_token')
    def test_send_verification_email_routes_through_oauth2_account(self, mock_refresh, mock_send_gmail):
        mock_refresh.return_value = {
            'access_token': 'verify-access-token',
            'expires_in': 3599,
            'token_type': 'Bearer',
        }
        account = SystemEmailAccount.objects.create(
            name='Google OAuth Default Verify',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='noreply@vninvest.vn',
            google_client_id='verify-client-id',
            is_default=True,
            is_active=True,
        )
        account.set_google_client_secret('verify-client-secret')
        account.set_google_refresh_token('verify-refresh-token')
        account.save(update_fields=[
            'google_client_secret_ciphertext',
            'google_refresh_token_ciphertext',
            'updated_at',
        ])

        sent = send_verification_email(self.user)

        self.assertEqual(sent, 1)
        mock_refresh.assert_called_once_with(
            client_id='verify-client-id',
            client_secret='verify-client-secret',
            refresh_token='verify-refresh-token',
            timeout_seconds=account.timeout_seconds,
        )
        send_gmail_kwargs = mock_send_gmail.call_args.kwargs
        self.assertEqual(send_gmail_kwargs['access_token'], 'verify-access-token')
        self.assertIn(self.user.email, send_gmail_kwargs['recipient_list'])
        self.assertIn('email', send_gmail_kwargs['subject'].lower())

    @patch('portfolio.mail_service.send_gmail_api_message', side_effect=RuntimeError('Gmail offline'))
    @patch('portfolio.mail_service.refresh_google_access_token')
    def test_send_verification_email_propagates_oauth2_error(self, mock_refresh, _mock_send_gmail):
        mock_refresh.return_value = {'access_token': 'bad-token', 'expires_in': 3599, 'token_type': 'Bearer'}
        account = SystemEmailAccount.objects.create(
            name='Google OAuth Default Error',
            auth_type=SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2,
            oauth_provider='google',
            host='smtp.gmail.com',
            port=587,
            from_email='noreply-error@vninvest.vn',
            google_client_id='verify-client-id-err',
            is_default=True,
            is_active=True,
        )
        account.set_google_client_secret('verify-client-secret')
        account.set_google_refresh_token('verify-refresh-token')
        account.save(update_fields=[
            'google_client_secret_ciphertext',
            'google_refresh_token_ciphertext',
            'updated_at',
        ])

        with self.assertRaises(RuntimeError):
            send_verification_email(self.user)