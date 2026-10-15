"""Wave 3 BE-KIND + B3.2-BE fail-before: expose kind/source + guard aggregate + convert.

Chay TREN VPS STAGING theo runbook STAGING_VPS_RUNBOOK.md §12 (cam local):
  python manage.py test user_workspace.tests.test_portfolio_kind_guard --noinput

Fail-before (BE-KIND): `PortfolioSerializer` chua co `kind`/`is_archived`,
`SubAccountSerializer` chua co `provider`/`broker_config`/`last_sync_at`,
`WatchlistSerializer` chua co `source`/`provider`/`broker_account`,
`WatchlistListCreateView.get` chua loc `?provider=&broker_account=`.
Fail-before (B3.2-BE): POST transaction vao aggregate van 201 (chua guard),
PATCH `opening_balance` cua aggregate van 200, action `convert` tra 400
`validation_error` (chi nhan add/remove).
Contract dong bang (PLAN_WAVE3_ISOLATION_20261015.md §2): `kind` read-only
tren serializer (duong chuyen lan duy nhat la action `convert`); guard
`aggregate_read_only` (403 + message VI); 3 code tu choi convert
(`broker_backed_single_account`, `convert_requires_empty`,
`convert_needs_binding`); moi convert ghi audit.
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.models import (
    Portfolio,
    PortfolioBrokerBinding,
    SubAccount,
    UserBrokerConfig,
    Watchlist,
)
from user_workspace.tests.envelope import unwrapped_json

PORTFOLIO_URL = '/core/v1/workspace/portfolios/{pid}/'
TXN_URL = '/core/v1/workspace/portfolios/{pid}/transactions/'
TXN_DETAIL_URL = '/core/v1/workspace/transactions/{tid}/'
BINDINGS_URL = '/core/v1/workspace/portfolios/{pid}/broker-bindings/'
WATCHLISTS_URL = '/core/v1/workspace/watchlists/'
SUBACCOUNT_URL = '/core/v1/portfolio/subaccounts/{pk}/'
SUBACCOUNT_TXN_URL = '/core/v1/portfolio/subaccounts/{pk}/transactions/'

TXN_BODY = {
    'symbol': 'VCB', 'transaction_type': 'BUY', 'date': '2026-10-01',
    'price': '100000', 'quantity': 10,
}


def _owner_client(username):
    user = User.objects.create_user(username=username, password='x')
    tenant = CoreTenant.objects.create(
        tenant_code=f't-{username}', display_name=username,
        owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
    )
    client = APIClient()
    client.force_login(user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return user, tenant, client


def _mk_sub(user, tenant, portfolio, broker, name, acct, provider, ext):
    return SubAccount.objects.create(
        user=user, tenant=tenant, portfolio=portfolio, broker=broker,
        display_name=name, account_number=acct,
        provider=provider, external_id=ext)


class PortfolioKindReadTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('pkind')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM kind',
            kind='broker_backed')

    def test_portfolio_read_exposes_kind_and_is_archived(self):
        resp = self.client.get(PORTFOLIO_URL.format(pid=self.portfolio.id))
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertEqual(body['kind'], 'broker_backed')
        self.assertFalse(body['is_archived'])

    def test_portfolio_kind_is_read_only(self):
        resp = self.client.patch(
            PORTFOLIO_URL.format(pid=self.portfolio.id),
            {'name': 'DM doi ten', 'kind': 'aggregate'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.portfolio.refresh_from_db()
        self.assertEqual(self.portfolio.name, 'DM doi ten')
        self.assertEqual(self.portfolio.kind, 'broker_backed')


class SubAccountKindReadTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('psub')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM sub')
        self.config = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant, provider='dnse',
            label='Mac dinh')
        self.sub = _mk_sub(
            self.user, self.tenant, self.portfolio, 'DNSE', 'TK DNSE',
            '0001', 'dnse', 'E1')
        self.sub.broker_config = self.config
        self.sub.save(update_fields=['broker_config'])

    def test_subaccount_read_exposes_provider_config_last_sync(self):
        resp = self.client.get(SUBACCOUNT_URL.format(pk=self.sub.id))
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertEqual(body['provider'], 'dnse')
        self.assertEqual(body['broker_config'], self.config.id)
        self.assertIsNone(body['last_sync_at'])


class WatchlistScopeReadTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('pwl')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM wl')
        self.sub = _mk_sub(
            self.user, self.tenant, self.portfolio, 'DNSE', 'TK DNSE',
            '0001', 'dnse', 'E1')
        self.wl_dnse = Watchlist.objects.create(
            user=self.user, tenant=self.tenant, name='WL DNSE',
            source='manual', provider='dnse', broker_account=self.sub)
        self.wl_ssi = Watchlist.objects.create(
            user=self.user, tenant=self.tenant, name='WL SSI',
            source='manual', provider='ssi')

    def _names(self, resp):
        self.assertEqual(resp.status_code, 200)
        return [row['name'] for row in unwrapped_json(resp)['results']]

    def test_watchlist_read_exposes_source_scope(self):
        resp = self.client.get(WATCHLISTS_URL)
        rows = {row['name']: row for row in unwrapped_json(resp)['results']}
        self.assertEqual(rows['WL DNSE']['source'], 'manual')
        self.assertEqual(rows['WL DNSE']['provider'], 'dnse')
        self.assertEqual(rows['WL DNSE']['broker_account'], self.sub.id)
        self.assertEqual(rows['WL SSI']['provider'], 'ssi')

    def test_watchlist_filter_by_provider(self):
        resp = self.client.get(WATCHLISTS_URL, {'provider': 'dnse'})
        self.assertEqual(self._names(resp), ['WL DNSE'])

    def test_watchlist_filter_by_broker_account(self):
        resp = self.client.get(
            WATCHLISTS_URL, {'broker_account': str(self.sub.id)})
        self.assertEqual(self._names(resp), ['WL DNSE'])

    def test_watchlist_filter_combined_and_empty(self):
        resp = self.client.get(WATCHLISTS_URL, {
            'provider': 'ssi', 'broker_account': str(self.sub.id)})
        self.assertEqual(self._names(resp), [])
        resp = self.client.get(WATCHLISTS_URL, {'provider': 'tcbs'})
        self.assertEqual(self._names(resp), [])


class AggregateGuardTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('pguard')
        self.manual = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM tay',
            kind='manual')
        self.aggregate = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM tong hop',
            kind='aggregate')

    def test_post_transaction_to_manual_201_control(self):
        resp = self.client.post(
            TXN_URL.format(pid=self.manual.id), TXN_BODY, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_post_transaction_to_aggregate_rejected(self):
        resp = self.client.post(
            TXN_URL.format(pid=self.aggregate.id), TXN_BODY, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json().get('code'), 'aggregate_read_only')

    def test_patch_opening_balance_of_aggregate_rejected(self):
        resp = self.client.patch(
            PORTFOLIO_URL.format(pid=self.aggregate.id),
            {'opening_balance': '5000000',
             'opening_balance_source': 'manual'},
            format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json().get('code'), 'aggregate_read_only')

    def test_rename_of_aggregate_still_allowed(self):
        resp = self.client.patch(
            PORTFOLIO_URL.format(pid=self.aggregate.id),
            {'name': 'DM tong hop 2'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.aggregate.refresh_from_db()
        self.assertEqual(self.aggregate.name, 'DM tong hop 2')


class AggregateGuardLoopTests(TestCase):
    """Loop audit Stage 5 (F1): 3 write path cung ban chat bi sot."""

    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('ploop')
        self.manual = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM tay loop',
            kind='manual')
        self.aggregate = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM tong hop loop',
            kind='aggregate')
        self.txn_manual = self._post_txn(self.manual.id)
        self.txn_agg = self._post_txn_forced(self.aggregate.id)

    def _post_txn(self, pid):
        from user_workspace.models import Transaction
        resp = self.client.post(
            TXN_URL.format(pid=pid), TXN_BODY, format='json')
        self.assertEqual(resp.status_code, 201)
        return Transaction.objects.get(
            pk=unwrapped_json(resp)['id'])

    def _post_txn_forced(self, pid):
        from datetime import date
        from decimal import Decimal
        from user_workspace.models import Transaction
        return Transaction.objects.create(
            portfolio_id=pid, tenant=self.tenant,
            symbol='VCB', transaction_type='BUY', date=date(2026, 10, 1),
            price=Decimal('100000'), quantity=10)

    def test_patch_transaction_of_aggregate_rejected(self):
        resp = self.client.patch(
            TXN_DETAIL_URL.format(tid=self.txn_agg.id),
            {'quantity': 20}, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json().get('code'), 'aggregate_read_only')

    def test_delete_transaction_of_aggregate_rejected(self):
        resp = self.client.delete(TXN_DETAIL_URL.format(tid=self.txn_agg.id))
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json().get('code'), 'aggregate_read_only')

    def test_patch_delete_transaction_of_manual_allowed_control(self):
        resp = self.client.patch(
            TXN_DETAIL_URL.format(tid=self.txn_manual.id),
            {'quantity': 20}, format='json')
        self.assertEqual(resp.status_code, 200)
        resp = self.client.delete(
            TXN_DETAIL_URL.format(tid=self.txn_manual.id))
        self.assertEqual(resp.status_code, 204)

    def test_post_transaction_via_subaccount_of_aggregate_rejected(self):
        sub = _mk_sub(
            self.user, self.tenant, self.aggregate, 'DNSE', 'TK loop',
            '0099', 'dnse', 'E99')
        resp = self.client.post(
            SUBACCOUNT_TXN_URL.format(pk=sub.id), TXN_BODY, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json().get('code'), 'aggregate_read_only')


class ConvertActionTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('pconv')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM chuyen',
            kind='manual')
        self.sub1 = _mk_sub(
            self.user, self.tenant, self.portfolio, 'DNSE', 'TK 1',
            '0001', 'dnse', 'E1')
        self.sub2 = _mk_sub(
            self.user, self.tenant, self.portfolio, 'SSI', 'TK 2',
            '0002', 'ssi', 'E2')

    def _convert(self, kind):
        return self.client.patch(
            BINDINGS_URL.format(pid=self.portfolio.id),
            {'action': 'convert', 'kind': kind}, format='json')

    def _audit_rows(self):
        from ops_audit.models import AuditEvent
        return AuditEvent.objects.filter(
            resource_type='portfolio_binding',
            metadata__operation='portfolio.convert',
            metadata__portfolio_id=self.portfolio.id)

    def test_manual_to_aggregate_with_one_binding(self):
        PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=self.sub1,
            tenant=self.tenant, role='secondary')
        resp = self._convert('aggregate')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertEqual(body['kind'], 'aggregate')
        self.assertEqual(body['binding_count'], 1)
        self.portfolio.refresh_from_db()
        self.assertEqual(self.portfolio.kind, 'aggregate')
        self.assertTrue(PortfolioBrokerBinding.objects.filter(
            portfolio=self.portfolio, sub_account=self.sub1).exists())
        self.assertEqual(self._audit_rows().count(), 1)

    def test_manual_to_broker_backed_with_one_binding(self):
        PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=self.sub1,
            tenant=self.tenant, role='primary')
        resp = self._convert('broker_backed')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)['kind'], 'broker_backed')

    def test_convert_to_broker_backed_needs_exactly_one(self):
        resp = self._convert('broker_backed')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('code'), 'convert_needs_binding')

    def test_convert_to_broker_backed_rejects_two_bindings(self):
        for sub in (self.sub1, self.sub2):
            PortfolioBrokerBinding.objects.create(
                portfolio=self.portfolio, sub_account=sub,
                tenant=self.tenant, role='secondary')
        resp = self._convert('broker_backed')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.json().get('code'), 'broker_backed_single_account')

    def test_convert_to_aggregate_needs_binding(self):
        resp = self._convert('aggregate')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('code'), 'convert_needs_binding')

    def test_convert_to_manual_requires_empty(self):
        self.portfolio.kind = 'aggregate'
        self.portfolio.save(update_fields=['kind'])
        PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=self.sub1,
            tenant=self.tenant, role='secondary')
        resp = self._convert('manual')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('code'), 'convert_requires_empty')
        self.client.patch(
            BINDINGS_URL.format(pid=self.portfolio.id),
            {'action': 'remove', 'sub_account_id': self.sub1.id},
            format='json')
        resp = self._convert('manual')
        self.assertEqual(resp.status_code, 200)
        self.portfolio.refresh_from_db()
        self.assertEqual(self.portfolio.kind, 'manual')

    def test_convert_invalid_kind_rejected(self):
        resp = self._convert('khong-co')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('code'), 'validation_error')
