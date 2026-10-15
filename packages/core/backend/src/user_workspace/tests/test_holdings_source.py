"""
Holdings per-row `source` (FE badge) — fail-before cho slice `be-holdings-source`.

`PortfolioHoldingsPage` render `SourceBadge` theo `row.source`
(`manual|broker_backed|aggregate`); view hien tai khong tra field nay nen
badge fail-closed ve null — holdings nhin y nhu cu. Test goi **view that**,
khong grep source.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from identity_access.models import CoreTenant
from user_workspace.models import Portfolio, Transaction
from user_workspace.tests.envelope import unwrapped


def _tenant(username):
    return CoreTenant.objects.create(
        tenant_code=f'hs-{username}',
        display_name=username,
        owner_user=User.objects.create_user(username=username, password='x'),
        status=CoreTenant.StatusChoices.ACTIVE,
    )


def _portfolio(tenant, name='P', kind='manual'):
    return Portfolio.objects.create(
        user=tenant.owner_user, tenant=tenant, name=name, kind=kind)


class HoldingsSourceTests(TestCase):
    def _holdings_response(self, portfolio):
        from rest_framework.test import APIRequestFactory

        from user_workspace.portfolio_analytics_views import PortfolioHoldingsView

        Transaction.objects.create(
            portfolio=portfolio, tenant=portfolio.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)
        request = APIRequestFactory().get(
            f'/api/portfolio/portfolios/{portfolio.pk}/holdings/')
        request.user = portfolio.tenant.owner_user
        request.tenant = portfolio.tenant
        view = PortfolioHoldingsView.as_view()
        return view(request, portfolio_id=portfolio.pk)

    def test_manual_portfolio_row_source_is_manual(self):
        portfolio = _portfolio(_tenant('u1'), kind='manual')
        row = unwrapped(self._holdings_response(portfolio))[0]
        self.assertEqual(row.get('source'), 'manual')

    def test_broker_backed_portfolio_row_source_matches_kind(self):
        portfolio = _portfolio(_tenant('u2'), kind='broker_backed')
        row = unwrapped(self._holdings_response(portfolio))[0]
        self.assertEqual(row.get('source'), 'broker_backed')

    def test_meta_exposes_portfolio_kind(self):
        from user_workspace.portfolio_analytics_views import PortfolioHoldingsView

        portfolio = _portfolio(_tenant('u3'), kind='aggregate')
        response = self._holdings_response(portfolio)
        self.assertEqual(response.data.get('meta', {}).get('kind'), 'aggregate')
