"""Wave 1 B1.6 tests: broker hub endpoints read-only + bindings.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_sync_views --noinput

Fail-before: truoc B1.6, GET /broker/accounts/ tra 404 (route chua co).
Service broker mock (FakeAdapter DTO that, khong mang, khong credential that).
"""
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.broker.adapters import (
    BrokerAdapter,
    BrokerBalance,
    BrokerOrder,
    BrokerPosition,
)
from user_workspace.models import (
    Portfolio,
    PortfolioBrokerBinding,
    SubAccount,
    set_user_broker_secrets,
)
from user_workspace.tests.envelope import unwrapped_json

BASE = '/core/v1/broker'


class FakeAdapter(BrokerAdapter):
    provider_id = 'fake'

    def is_available(self):
        return True

    def list_accounts(self):
        return []

    def get_balance(self, account_no):
        return BrokerBalance(
            cash=1000.0, stock_value=2000.0, debt=0.0, net_equity=3000.0,
            buying_power=1500.0)

    def get_positions(self, account_no):
        return [BrokerPosition(
            symbol='VCB', quantity=10.0, avg_price=90.0, market_price=100.0)]

    def get_orders(self, account_no):
        return [BrokerOrder(
            order_id='O1', symbol='VCB', side='BUY', price=95.0,
            quantity=10.0, status='FILLED')]


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


class BrokerSyncViewsTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('syncviews')
        set_user_broker_secrets(
            self.user, 'dnse', {'client_id': 'C', 'client_secret': 'S'},
            tenant=self.tenant)
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM',
            kind='broker_backed')
        self.sub = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK', account_number='0001',
            provider='dnse', external_id='E1',
            broker_config=self.user.broker_configs.get(provider='dnse'))

    def _service(self):
        from user_workspace.broker.sync_service import BrokerSyncService
        return BrokerSyncService(FakeAdapter())

    def test_accounts_list(self):
        resp = self.client.get(f'{BASE}/accounts/')
        self.assertEqual(resp.status_code, 200)
        rows = unwrapped_json(resp)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['provider'], 'dnse')
        self.assertEqual(rows[0]['external_id'], 'E1')

    def test_account_detail_404(self):
        resp = self.client.get(f'{BASE}/accounts/999999/')
        self.assertEqual(resp.status_code, 404)

    def test_positions_no_raw_key(self):
        with patch(
            'user_workspace.views_broker.BrokerSyncService'
        ) as svc_cls:
            svc_cls.for_config.return_value = self._service()
            resp = self.client.get(f'{BASE}/accounts/{self.sub.id}/positions/')
        self.assertEqual(resp.status_code, 200)
        rows = unwrapped_json(resp)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['symbol'], 'VCB')
        self.assertNotIn('raw', rows[0])

    def test_balance_shape(self):
        with patch(
            'user_workspace.views_broker.BrokerSyncService'
        ) as svc_cls:
            svc_cls.for_config.return_value = self._service()
            resp = self.client.get(f'{BASE}/accounts/{self.sub.id}/balance/')
        body = unwrapped_json(resp)
        self.assertEqual(body['net_equity'], 3000.0)
        self.assertEqual(body['buying_power'], 1500.0)

    def test_orders_list(self):
        with patch(
            'user_workspace.views_broker.BrokerSyncService'
        ) as svc_cls:
            svc_cls.for_config.return_value = self._service()
            resp = self.client.get(f'{BASE}/accounts/{self.sub.id}/orders/')
        rows = unwrapped_json(resp)
        self.assertEqual(rows[0]['order_id'], 'O1')

    def test_sync_enqueues_202(self):
        fake_job = SimpleNamespace(id='job-sync-1')
        with patch(
            'user_workspace.views_broker.sync_broker_account_task'
        ) as task:
            task.delay.return_value = fake_job
            resp = self.client.post(f'{BASE}/accounts/{self.sub.id}/sync/')
        self.assertEqual(resp.status_code, 202)
        body = unwrapped_json(resp)
        self.assertEqual(body['job_id'], 'job-sync-1')

    def test_sync_unlinked_400(self):
        lone = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, broker='DNSE',
            display_name='TK roi', account_number='0009',
            provider='dnse', external_id='E9')
        resp = self.client.post(f'{BASE}/accounts/{lone.id}/sync/')
        self.assertEqual(resp.status_code, 400)

    def test_runs_and_issues_list(self):
        from user_workspace.models import BrokerSyncIssue, BrokerSyncRun
        run = BrokerSyncRun.objects.create(
            user=self.user, tenant=self.tenant, provider='dnse',
            status='succeeded', stats={})
        BrokerSyncIssue.objects.create(
            run=run, tenant=self.tenant, severity='warning',
            code='position_drift', payload={})
        runs = unwrapped_json(self.client.get(f'{BASE}/sync-runs/'))
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0]['status'], 'succeeded')
        issues = unwrapped_json(self.client.get(
            f'{BASE}/sync-issues/', {'resolved': 'false'}))
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]['code'], 'position_drift')

    def test_bindings_add_remove(self):
        other = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, broker='SSI',
            display_name='TK2', account_number='0002',
            provider='ssi', external_id='E2')
        url = f'/core/v1/workspace/portfolios/{self.portfolio.id}/broker-bindings/'
        resp = self.client.patch(
            url, {'action': 'add', 'sub_account_id': other.id},
            format='json')
        # broker_backed da co 1 TK khac (E1 chua bind? chua) — them TK dau tien OK.
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(PortfolioBrokerBinding.objects.filter(
            portfolio=self.portfolio, sub_account=other).exists())
        resp = self.client.patch(
            url, {'action': 'remove', 'sub_account_id': other.id},
            format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(PortfolioBrokerBinding.objects.filter(
            portfolio=self.portfolio, sub_account=other).exists())

    def test_bindings_broker_backed_second_rejected(self):
        first = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK1', account_number='0011',
            provider='dnse', external_id='E11')
        PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=first,
            tenant=self.tenant, role='primary')
        second = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, broker='SSI',
            display_name='TK2', account_number='0012',
            provider='ssi', external_id='E12')
        url = f'/core/v1/workspace/portfolios/{self.portfolio.id}/broker-bindings/'
        resp = self.client.patch(
            url, {'action': 'add', 'sub_account_id': second.id},
            format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            unwrapped_json(resp).get('code'), 'broker_backed_single_account')

    def test_bindings_cross_tenant_404(self):
        other_user = User.objects.create_user(username='bind-other', password='x')
        other_tenant = CoreTenant.objects.create(
            tenant_code='t-bind-other', display_name='Other',
            owner_user=other_user, status=CoreTenant.StatusChoices.ACTIVE)
        foreign = SubAccount.objects.create(
            user=other_user, tenant=other_tenant, broker='SSI',
            display_name='TK la', account_number='0099',
            provider='ssi', external_id='E99')
        url = f'/core/v1/workspace/portfolios/{self.portfolio.id}/broker-bindings/'
        resp = self.client.patch(
            url, {'action': 'add', 'sub_account_id': foreign.id},
            format='json')
        self.assertEqual(resp.status_code, 404)
