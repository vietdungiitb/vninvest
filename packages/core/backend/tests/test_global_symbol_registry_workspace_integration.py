"""
Global symbol registry integration tests for workspace and legacy user paths.
"""
import os
import sys
import datetime
from decimal import Decimal

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import GlobalSymbolDemandSource, GlobalSymbolRegistry
from user_workspace.models import Portfolio, Watchlist


class GlobalSymbolRegistryWorkspaceIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='workspace-global-registry-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_workspace_watchlist_item_create_and_delete_sync_registry(self):
        watchlist = Watchlist.objects.create(user=self.user, name='Theo dõi nền tảng', description='')

        create_response = self.client.post(
            f'/api/workspace/watchlists/{watchlist.pk}/items/',
            {'symbol': 'fpt'},
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        registry = GlobalSymbolRegistry.objects.get(symbol='FPT')
        edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref=f'watchlist:{watchlist.pk}',
        )
        self.assertTrue(edge.is_active)
        self.assertEqual(registry.demand_source_count, 1)

        delete_response = self.client.delete(f'/api/workspace/watchlists/{watchlist.pk}/items/FPT/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        registry.refresh_from_db()
        edge.refresh_from_db()
        self.assertFalse(edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_workspace_transaction_symbol_change_and_delete_resync_registry(self):
        portfolio = Portfolio.objects.create(user=self.user, name='Danh mục giao dịch')

        create_response = self.client.post(
            f'/api/workspace/portfolios/{portfolio.pk}/transactions/',
            {
                'symbol': 'VCB',
                'transaction_type': 'BUY',
                'date': datetime.date(2026, 5, 8),
                'price': Decimal('88500.00'),
                'quantity': 120,
                'fee': Decimal('15000.00'),
                'tax': Decimal('0.00'),
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        transaction_id = create_response.data['id']

        vcb_registry = GlobalSymbolRegistry.objects.get(symbol='VCB')
        vcb_edge = GlobalSymbolDemandSource.objects.get(
            registry=vcb_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.HOLDING,
            source_ref=f'portfolio:{portfolio.pk}',
        )
        self.assertTrue(vcb_edge.is_active)

        patch_response = self.client.patch(
            f'/api/workspace/transactions/{transaction_id}/',
            {'symbol': 'FPT'},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        vcb_registry.refresh_from_db()
        vcb_edge.refresh_from_db()
        self.assertFalse(vcb_edge.is_active)

        fpt_registry = GlobalSymbolRegistry.objects.get(symbol='FPT')
        fpt_edge = GlobalSymbolDemandSource.objects.get(
            registry=fpt_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.HOLDING,
            source_ref=f'portfolio:{portfolio.pk}',
        )
        self.assertTrue(fpt_edge.is_active)

        delete_response = self.client.delete(f'/api/workspace/transactions/{transaction_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        fpt_registry.refresh_from_db()
        fpt_edge.refresh_from_db()
        self.assertFalse(fpt_edge.is_active)
        self.assertEqual(fpt_registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_legacy_watchlist_item_paths_sync_registry(self):
        watchlist = Watchlist.objects.create(user=self.user, name='Legacy list', description='')

        create_response = self.client.post(
            f'/api/portfolio/watchlist/groups/{watchlist.pk}/items/',
            {'symbol': 'HPG'},
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        item_id = create_response.data['id']

        registry = GlobalSymbolRegistry.objects.get(symbol='HPG')
        edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref=f'watchlist:{watchlist.pk}',
        )
        self.assertTrue(edge.is_active)

        delete_response = self.client.delete(f'/api/portfolio/watchlist/items/{item_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        registry.refresh_from_db()
        edge.refresh_from_db()
        self.assertFalse(edge.is_active)