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

        resolver_list = resolve('/api/workspace/portfolios/')
        self.assertIs(resolver_list.func.view_class, PortfolioListCreateView)

        list_response = self.client.get('/api/workspace/portfolios/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'][0]['name'], 'Danh mục Core')

        resolver_detail = resolve(f'/api/workspace/portfolios/{portfolio.id}/')
        self.assertIs(resolver_detail.func.view_class, PortfolioDetailView)

        detail_response = self.client.get(f'/api/workspace/portfolios/{portfolio.id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['id'], portfolio.id)
        self.assertEqual(detail_response.data['name'], 'Danh mục Core')

        resolver_transactions = resolve(f'/api/workspace/portfolios/{portfolio.id}/transactions/')
        self.assertIs(resolver_transactions.func.view_class, TransactionListCreateView)

        transactions_response = self.client.get(f'/api/workspace/portfolios/{portfolio.id}/transactions/?symbol=VCB')
        self.assertEqual(transactions_response.status_code, status.HTTP_200_OK)
        self.assertEqual(transactions_response.data['results'][0]['symbol'], 'VCB')

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

        resolver_list = resolve('/api/workspace/watchlists/')
        self.assertIs(resolver_list.func.view_class, WatchlistListCreateView)

        list_response = self.client.get('/api/workspace/watchlists/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'][0]['name'], 'Theo dõi chiến lược')

        resolver_items = resolve(f'/api/workspace/watchlists/{watchlist.id}/items/')
        self.assertIs(resolver_items.func.view_class, WatchlistItemListCreateView)

        items_response = self.client.get(f'/api/workspace/watchlists/{watchlist.id}/items/')
        self.assertEqual(items_response.status_code, status.HTTP_200_OK)
        self.assertEqual(items_response.data['results'][0]['symbol'], 'FPT')

        resolver_delete = resolve(f'/api/workspace/watchlists/{watchlist.id}/items/FPT/')
        self.assertIs(resolver_delete.func.view_class, WatchlistItemDeleteView)

        delete_response = self.client.delete(f'/api/workspace/watchlists/{watchlist.id}/items/FPT/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)


class UserWorkspaceAdvisoryCompatRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='workspace-advisory-owner',
            email='workspace-advisory-owner@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='workspace-advisory-tenant-1',
            display_name='Workspace Advisory Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)

    def _current_period(self):
        today = timezone.localdate()
        return (
            today.replace(day=1),
            today.replace(day=monthrange(today.year, today.month)[1]),
        )

    def _create_quota_record(self, *, used: int, limit: int):
        period_start, period_end = self._current_period()
        return QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=period_start,
            period_end=period_end,
            api_calls_used=used,
            api_calls_limit=limit,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )

    def test_portfolio_ai_advisory_get_routes_delegate_to_native_advisory_view(self):
        today = timezone.localdate()
        AdvisoryRecord.objects.create(
            symbol='HPG',
            session_date=today,
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Tich luy co ky luat.',
            tokens_used=321,
            generated_at=timezone.now(),
        )

        route_expectations = [
            ('/api/portfolio/ai-advisory/HPG/canonical/', PortfolioAIAdvisoryCanonicalView),
            ('/api/portfolio/ai-advisory/HPG/current/', PortfolioAIAdvisoryCurrentView),
        ]

        for path, expected_view in route_expectations:
            with self.subTest(path=path):
                resolver = resolve(path)
                self.assertIs(resolver.func.view_class, expected_view)

                response = self.client.get(path)

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data['symbol'], 'HPG')
                self.assertEqual(response.data['status'], AdvisoryRecord.StatusChoices.GENERATED)
                self.assertEqual(response.data['advisory_text'], 'Tich luy co ky luat.')

    def test_portfolio_ai_advisory_refresh_route_delegates_to_native_advisory_view(self):
        resolver = resolve('/api/portfolio/ai-advisory/HPG/refresh/')
        self.assertIs(resolver.func.view_class, PortfolioAIAdvisoryRefreshView)
        self._create_quota_record(used=0, limit=1)

        response = self.client.post('/api/portfolio/ai-advisory/HPG/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['symbol'], 'HPG')
        self.assertEqual(response.data['manual_trigger']['job_key'], 'advisory_refresh')
        self.assertEqual(response.data['manual_trigger']['priority_tier'], 'pro')