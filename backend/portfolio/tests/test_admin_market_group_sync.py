from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from portfolio.models import SecuritiesGroup


class AdminMarketGroupSyncTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='adminsync',
            email='adminsync@example.com',
            password='Admin@123456',
        )
        self.target_user = User.objects.create_user(
            username='targetsync',
            email='targetsync@example.com',
            password='User@123456',
        )
        self.client.force_login(self.admin_user)

    @patch('portfolio.admin.sync_market_groups_for_user')
    def test_admin_sync_route_supports_username_scope(self, mock_sync_user):
        mock_sync_user.return_value = {
            'success': True,
            'message': 'Đồng bộ theo user thành công.',
            'warning': None,
        }

        response = self.client.post(
            reverse('admin:market-group-sync'),
            {
                'username': self.target_user.username,
                'mode': 'all',
                'next': reverse('admin:index'),
            },
        )

        self.assertEqual(response.status_code, 302)
        mock_sync_user.assert_called_once()
        called_user = mock_sync_user.call_args.args[0]
        self.assertEqual(called_user.username, self.target_user.username)

    @patch('portfolio.admin.sync_market_groups_for_users')
    def test_admin_sync_route_supports_global_scope(self, mock_sync_users):
        mock_sync_users.return_value = {
            'success': True,
            'message': 'Đồng bộ toàn hệ thống thành công.',
            'warning': None,
        }

        response = self.client.post(
            reverse('admin:market-group-sync'),
            {
                'mode': 'all',
                'next': reverse('admin:index'),
            },
        )

        self.assertEqual(response.status_code, 302)
        mock_sync_users.assert_called_once()

    def test_market_group_admin_blocks_manual_add_and_change(self):
        group = SecuritiesGroup.objects.create(name='VN30', group_type='MARKET_CAP')

        add_response = self.client.get(reverse('admin:portfolio_securitiesgroup_add'))
        change_response = self.client.post(
            reverse('admin:portfolio_securitiesgroup_change', args=[group.id]),
            {
                'name': 'VN100',
                'group_type': 'MARKET_CAP',
                'description': 'edited',
                'color': '#3b82f6',
                'order': 1,
            },
        )

        self.assertEqual(add_response.status_code, 403)
        self.assertEqual(change_response.status_code, 403)
        group.refresh_from_db()
        self.assertEqual(group.name, 'VN30')
