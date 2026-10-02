"""
Native user_workspace API route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from calendar import monthrange
import datetime
import os
import sys
from decimal import Decimal

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord
from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from user_workspace.portfolio_analytics_views import (
    PortfolioAIAdvisoryCanonicalView,
    PortfolioAIAdvisoryCurrentView,
    PortfolioAIAdvisoryRefreshView,
)
from user_workspace.models import Portfolio, Transaction, Watchlist, WatchlistItem
from user_workspace.tests.envelope import unwrapped
from user_workspace.views import (
    PortfolioDetailView,
    PortfolioListCreateView,
    TransactionListCreateView,
    WatchlistItemDeleteView,
    WatchlistItemListCreateView,
    WatchlistListCreateView,
)


class UserWorkspaceApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='workspace-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_portfolio_routes_are_native_and_return_results_envelope(self):
        portfolio = Portfolio.objects.create(
            user=self.user,
            name='Danh mục Core',
            description='Portfolio native',
            is_default=True,
        )
        Transaction.objects.create(
            portfolio=portfolio,
            symbol='VCB',
            transaction_type='BUY',
            date=datetime.date(2026, 5, 8),
            price=Decimal('88500.00'),
            quantity=120,
            fee=Decimal('15000.00'),
        )

        resolver_list = resolve('/core/v1/workspace/portfolios/')
        self.assertIs(resolver_list.func.view_class, PortfolioListCreateView)

        list_response = self.client.get('/core/v1/workspace/portfolios/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(list_response)['results'][0]['name'], 'Danh mục Core')

        resolver_detail = resolve(f'/core/v1/workspace/portfolios/{portfolio.id}/')
        self.assertIs(resolver_detail.func.view_class, PortfolioDetailView)

        detail_response = self.client.get(f'/core/v1/workspace/portfolios/{portfolio.id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(detail_response)['id'], portfolio.id)
        self.assertEqual(unwrapped(detail_response)['name'], 'Danh mục Core')

        resolver_transactions = resolve(f'/core/v1/workspace/portfolios/{portfolio.id}/transactions/')
        self.assertIs(resolver_transactions.func.view_class, TransactionListCreateView)

        transactions_response = self.client.get(f'/core/v1/workspace/portfolios/{portfolio.id}/transactions/?symbol=VCB')
        self.assertEqual(transactions_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(transactions_response)['results'][0]['symbol'], 'VCB')

    def test_watchlist_routes_are_native_and_item_delete_works(self):
        watchlist = Watchlist.objects.create(
            user=self.user,
            name='Theo dõi chiến lược',
            description='Watchlist native',
            is_default=False,
        )
        WatchlistItem.objects.create(
            watchlist=watchlist,
            symbol='FPT',
            note='Quan sát breakout',
        )

        resolver_list = resolve('/core/v1/workspace/watchlists/')
        self.assertIs(resolver_list.func.view_class, WatchlistListCreateView)

        list_response = self.client.get('/core/v1/workspace/watchlists/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(list_response)['results'][0]['name'], 'Theo dõi chiến lược')

        resolver_items = resolve(f'/core/v1/workspace/watchlists/{watchlist.id}/items/')
        self.assertIs(resolver_items.func.view_class, WatchlistItemListCreateView)

        items_response = self.client.get(f'/core/v1/workspace/watchlists/{watchlist.id}/items/')
        self.assertEqual(items_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(items_response)['results'][0]['symbol'], 'FPT')

        resolver_delete = resolve(f'/core/v1/workspace/watchlists/{watchlist.id}/items/FPT/')
        self.assertIs(resolver_delete.func.view_class, WatchlistItemDeleteView)

        delete_response = self.client.delete(f'/core/v1/workspace/watchlists/{watchlist.id}/items/FPT/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)


# UserWorkspaceAdvisoryCompatRouteTests was deleted because compatibility /api/portfolio/ai-advisory/ paths were decommissioned.