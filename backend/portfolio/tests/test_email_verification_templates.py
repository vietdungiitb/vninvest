from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from portfolio.email_verification import send_verification_email
from portfolio.models import SystemEmailAccount


class EmailVerificationTemplateTests(TestCase):
    @override_settings(
        FRONTEND_BASE_URL='http://localhost:3000',
        EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS=7200,
    )
    @patch('portfolio.email_verification.send_system_email', return_value=1)
    def test_send_verification_email_uses_rendered_templates(self, mock_send_system_email):
        user = User.objects.create_user(
            username='templateuser',
            email='template@example.com',
            password='Test@123456',
        )
        account = SystemEmailAccount.objects.create(
            name='Template SMTP',
            host='smtp.template.local',
            port=587,
            from_email='noreply@example.com',
            is_default=True,
        )

        sent_count = send_verification_email(user)

        self.assertEqual(sent_count, 1)
        mock_send_system_email.assert_called_once()
        kwargs = mock_send_system_email.call_args.kwargs
        self.assertEqual(kwargs['subject'], '[VNInvest] Xac thuc email tai khoan')
        self.assertIn('http://localhost:3000/verify-email?token=', kwargs['message'])
        self.assertIn('Lien ket nay co hieu luc trong 2 gio.', kwargs['message'])
        self.assertIn('Kich hoat dang nhap bang email xac thuc', kwargs['html_message'])
        self.assertIn('Xac thuc email ngay', kwargs['html_message'])
        self.assertIn('templateuser', kwargs['html_message'])
        self.assertEqual(kwargs['account'], account)
