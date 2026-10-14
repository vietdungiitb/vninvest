"""Wave 0 B0.2 tests: Portfolio kind/is_archived + PortfolioBrokerBinding + Watchlist source.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_portfolio_kind_binding --noinput

Fail-before: truoc B0.2, `Portfolio(kind=...)` nem TypeError; `PortfolioBrokerBinding`
ImportError; `Watchlist(source=...)` nem TypeError.
"""
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from user_workspace.models import (
    Portfolio,
    PortfolioBrokerBinding,
    SubAccount,
    Watchlist,
)
from user_workspace.tests.tenant_test_helpers import grant_tenant


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class PortfolioKindBindingTests(TestCase):
    def setUp(self):
        self.user = _make_user('pkind-b02')
        self.tenant = grant_tenant(self.user)
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='Danh muc test')
        self.sub = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK test', account_number='0001',
            provider='dnse', external_id='E1')

    def test_kind_defaults_manual_and_accepts_all_kinds(self):
        self.assertEqual(self.portfolio.kind, 'manual')
        for kind in ('manual', 'broker_backed', 'aggregate'):
            p = Portfolio.objects.create(
                user=self.user, tenant=self.tenant,
                name=f'P-{kind}', kind=kind)
            self.assertEqual(p.kind, kind)

    def test_is_archived_defaults_false(self):
        self.assertFalse(self.portfolio.is_archived)

    def test_binding_links_portfolio_and_subaccount(self):
        b = PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=self.sub,
            tenant=self.tenant, role='primary', is_default=True)
        self.assertEqual(b.portfolio_id, self.portfolio.id)
        self.assertEqual(b.sub_account_id, self.sub.id)
        self.assertIn(b, self.portfolio.broker_bindings.all())

    def test_binding_unique_portfolio_subaccount(self):
        PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=self.sub, tenant=self.tenant)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PortfolioBrokerBinding.objects.create(
                    portfolio=self.portfolio, sub_account=self.sub,
                    tenant=self.tenant)

    def test_binding_rejects_cross_tenant(self):
        other_user = _make_user('pkind-other')
        other_tenant = grant_tenant(
            other_user, tenant_code='other-tenant', display_name='Other')
        other_sub = SubAccount.objects.create(
            user=other_user, tenant=other_tenant, broker='SSI',
            display_name='TK other', account_number='0002',
            provider='ssi', external_id='E2')
        binding = PortfolioBrokerBinding(
            portfolio=self.portfolio, sub_account=other_sub,
            tenant=self.tenant)
        with self.assertRaises(ValidationError):
            binding.full_clean()

    def test_watchlist_source_defaults_manual(self):
        wl = Watchlist.objects.create(
            user=self.user, tenant=self.tenant, name='Theo doi tay')
        self.assertEqual(wl.source, 'manual')
        derived = Watchlist.objects.create(
            user=self.user, tenant=self.tenant, name='Dang nam giu @ dnse',
            source='derived', provider='dnse')
        self.assertEqual(derived.source, 'derived')

    def test_watchlist_scoped_to_broker_account(self):
        wl = Watchlist.objects.create(
            user=self.user, tenant=self.tenant, name='WL SSI',
            source='manual', provider='ssi', broker_account=self.sub)
        self.assertEqual(wl.broker_account_id, self.sub.id)
        self.assertEqual(wl.provider, 'ssi')
