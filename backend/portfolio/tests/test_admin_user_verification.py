from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from portfolio.models import SystemEmailAccount, UserConfig


class UserConfigAdminVerificationTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='verificationadmin',
            email='verificationadmin@example.com',
            password='Admin@123456',
        )
        self.pending_user = User.objects.create_user(
            username='pendingverify',
            email='pendingverify@example.com',
            password='User@123456',
        )
        self.verified_user = User.objects.create_user(
            username='verifieduser',
            email='verifieduser@example.com',
            password='User@123456',
        )
        self.pending_config = UserConfig.objects.update_or_create(
            user=self.pending_user,
            defaults={'email_verified': False},
        )[0]
        self.verified_config = UserConfig.objects.update_or_create(
            user=self.verified_user,
            defaults={'email_verified': True},
        )[0]
        self.client.force_login(self.admin_user)

    def test_userconfig_admin_changelist_is_accessible(self):
        response = self.client.get(reverse('admin:portfolio_userconfig_changelist'))
        self.assertEqual(response.status_code, 200)

    def test_userconfig_change_view_shows_resend_button_for_unverified_user(self):
        response = self.client.get(reverse('admin:portfolio_userconfig_change', args=[self.pending_config.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Gui lai email xac thuc')
        self.assertContains(response, reverse('admin:portfolio_userconfig_resend_verification', args=[self.pending_config.pk]))

    def test_userconfig_change_view_hides_resend_button_for_verified_user(self):
        response = self.client.get(reverse('admin:portfolio_userconfig_change', args=[self.verified_config.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, reverse('admin:portfolio_userconfig_resend_verification', args=[self.verified_config.pk]))

    def test_admin_index_shows_verification_operations_summary(self):
        SystemEmailAccount.objects.create(
            name='Primary Ops SMTP',
            host='smtp.ops.local',
            port=587,
            from_email='ops@example.com',
            is_default=True,
        )
        self.pending_config.email_verification_sent_at = timezone.now()
        self.pending_config.save(update_fields=['email_verification_sent_at', 'updated_at'])

        response = self.client.get(reverse('admin:index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Vận hành xác thực email')
        self.assertContains(response, 'Primary Ops SMTP')
        self.assertContains(response, self.pending_user.username)
        self.assertContains(response, 'email_verified__exact=0')
        self.assertContains(response, 'Gửi lại mail cho user gần nhất')

    @patch('portfolio.admin.send_verification_email', return_value=1)
    def test_admin_route_can_resend_latest_pending_verification_email(self, mock_send_verification_email):
        response = self.client.post(
            reverse('admin:resend-latest-verification'),
            {'next': reverse('admin:index')},
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        mock_send_verification_email.assert_called_once_with(self.pending_user)
        self.pending_config.refresh_from_db()
        self.assertIsNotNone(self.pending_config.email_verification_sent_at)
        self.assertContains(response, 'Đã gửi lại email xác thực cho pendingverify.')

    @patch('portfolio.admin.send_verification_email', return_value=1)
    def test_userconfig_detail_route_can_resend_verification_email(self, mock_send_verification_email):
        response = self.client.post(
            reverse('admin:portfolio_userconfig_resend_verification', args=[self.pending_config.pk]),
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        mock_send_verification_email.assert_called_once_with(self.pending_user)
        self.pending_config.refresh_from_db()
        self.assertIsNotNone(self.pending_config.email_verification_sent_at)
        self.assertContains(response, 'Đã gửi lại email xác thực cho pendingverify.')

    def test_userconfig_detail_route_skips_verified_user(self):
        response = self.client.post(
            reverse('admin:portfolio_userconfig_resend_verification', args=[self.verified_config.pk]),
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Tài khoản verifieduser đã xác thực email, không cần gửi lại.')

    def test_admin_route_warns_when_no_pending_verification_accounts(self):
        self.pending_config.email_verified = True
        self.pending_config.save(update_fields=['email_verified', 'updated_at'])

        response = self.client.post(
            reverse('admin:resend-latest-verification'),
            {'next': reverse('admin:index')},
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Không còn tài khoản nào đang chờ xác thực email.')

    @patch('portfolio.admin.send_verification_email', return_value=1)
    def test_admin_action_resends_only_for_unverified_accounts(self, mock_send_verification_email):
        response = self.client.post(
            reverse('admin:portfolio_userconfig_changelist'),
            {
                'action': 'resend_verification_email_to_selected_users',
                '_selected_action': [str(self.pending_config.pk), str(self.verified_config.pk)],
                'index': '0',
            },
        )

        self.assertEqual(response.status_code, 302)
        mock_send_verification_email.assert_called_once_with(self.pending_user)

        self.pending_config.refresh_from_db()
        self.assertIsNotNone(self.pending_config.email_verification_sent_at)