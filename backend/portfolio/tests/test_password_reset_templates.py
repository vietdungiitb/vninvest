from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from portfolio.models import SystemEmailAccount
from portfolio.password_reset import send_password_reset_email


class PasswordResetTemplateTests(TestCase):
    @override_settings(
        FRONTEND_BASE_URL='http://localhost:3000',
        PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS=3600,
    )
    @patch('portfolio.password_reset.send_system_email', return_value=1)
    def test_send_password_reset_email_uses_rendered_templates(self, mock_send_system_email):
        user = User.objects.create_user(
            username='resetuser',
            email='reset@example.com',
            password='Test@123456',
        )
        account = SystemEmailAccount.objects.create(
            name='Template SMTP',
            host='smtp.template.local',
            port=587,
            from_email='noreply@example.com',
            is_default=True,
        )

        sent_count = send_password_reset_email(user)

        self.assertEqual(sent_count, 1)
        mock_send_system_email.assert_called_once()
        kwargs = mock_send_system_email.call_args.kwargs
        self.assertEqual(kwargs['subject'], '[VNInvest] Dat lai mat khau tai khoan')
        self.assertIn('http://localhost:3000/reset-password?token=', kwargs['message'])
        self.assertIn('Lien ket nay co hieu luc trong 1 gio.', kwargs['message'])
        self.assertIn('Dat lai mat khau ngay', kwargs['html_message'])
        self.assertIn('resetuser', kwargs['html_message'])
        self.assertEqual(kwargs['account'], account)
