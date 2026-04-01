from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse


class AdminStockProfileSyncTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='adminstockprofile',
            email='adminstockprofile@example.com',
            password='Admin@123456',
        )
        self.client.force_login(self.admin_user)

    @patch('portfolio.admin.sync_stock_profiles')
    def test_admin_stockprofile_sync_route(self, mock_sync_stock_profiles):
        mock_sync_stock_profiles.return_value = {
            'success': True,
            'message': 'Đồng bộ StockProfile thành công.',
            'warning': None,
        }

        response = self.client.post(
            reverse('admin:stock-profile-sync'),
            {
                'mode': 'manual',
                'next': reverse('admin:index'),
            },
        )

        self.assertEqual(response.status_code, 302)
        mock_sync_stock_profiles.assert_called_once()
        self.assertEqual(mock_sync_stock_profiles.call_args.kwargs['mode'], 'manual')