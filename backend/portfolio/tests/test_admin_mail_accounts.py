from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from portfolio.mail_service import build_email_connection, send_test_email
from portfolio.models import SystemEmailAccount


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