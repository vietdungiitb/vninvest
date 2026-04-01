from unittest.mock import patch
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from portfolio.models import DailyPrice, SecuritiesGroup, SecuritiesItem, StockProfile, TrackedSymbol, WatchlistGroup, WatchlistItem


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

    def test_admin_stockprofile_workspace_route(self):
        StockProfile.objects.create(
            symbol='ACB',
            company_name='Ngan hang ACB',
            industry='Ngan hang',
            exchange='HOSE',
            is_active=True,
        )
        for offset in range(40):
            DailyPrice.objects.create(
                symbol='ACB',
                date=date.today() - timedelta(days=offset),
                open_price=23000 + offset,
                high_price=23500 + offset,
                low_price=22800 + offset,
                close_price=23200 + offset,
                volume=1000000 + offset * 1000,
            )
        group = SecuritiesGroup.objects.create(name='Ngan hang', group_type='SECTOR')
        SecuritiesItem.objects.create(group=group, symbol='ACB', order=1)
        tracked_user = User.objects.create_user(username='watcher', password='Test@123456')
        TrackedSymbol.objects.create(user=tracked_user, symbol='ACB', source_group=group)
        watchlist_group = WatchlistGroup.objects.create(user=tracked_user, name='Theo doi ngan hang')
        WatchlistItem.objects.create(group=watchlist_group, symbol='ACB')

        response = self.client.get(reverse('admin:stock-profile-workspace', args=['ACB']))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Chi tiết mã ACB')
        self.assertContains(response, 'Ngan hang ACB')
        self.assertContains(response, 'Tóm tắt kỹ thuật')
        self.assertContains(response, 'Biểu đồ nến EOD 48 phiên gần nhất')
        self.assertContains(response, 'Trung tính')
        self.assertContains(response, 'Độ sâu giả lập')
        self.assertContains(response, 'Ngan hang')

    def test_admin_navigation_links_to_workspace_from_related_models(self):
        StockProfile.objects.create(
            symbol='VCB',
            company_name='Vietcombank',
            industry='Ngan hang',
            exchange='HOSE',
            is_active=True,
        )
        group = SecuritiesGroup.objects.create(name='Ngan hang lon', group_type='SECTOR')
        SecuritiesItem.objects.create(group=group, symbol='VCB', order=1)
        DailyPrice.objects.create(
            symbol='VCB',
            date=date.today(),
            open_price=90000,
            high_price=91000,
            low_price=89500,
            close_price=90500,
            volume=2500000,
        )

        item_response = self.client.get(reverse('admin:portfolio_securitiesitem_changelist'))
        price_response = self.client.get(reverse('admin:portfolio_dailyprice_changelist'))

        workspace_url = reverse('admin:stock-profile-workspace', args=['VCB'])
        self.assertContains(item_response, workspace_url)
        self.assertContains(price_response, workspace_url)