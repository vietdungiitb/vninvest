"""Wave 3 BE-READ fail-before: GET danh sach lien ket broker cua danh muc.

Chay TREN VPS STAGING theo runbook STAGING_VPS_RUNBOOK.md §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_bindings_read --noinput

Fail-before: truoc BE-READ, endpoint `broker-bindings/` chi nhan PATCH
(`views_broker.py:570` `@api_view(['PATCH'])`) nen GET tra 405.
Contract dong bang (PLAN_WAVE3_ISOLATION_20261015.md §2):
  GET workspace/portfolios/<id>/broker-bindings/
  -> envelope([{binding_id, sub_account_id, provider, external_id,
                display_name, role, is_default}])
  404 khi portfolio khong thuoc user/tenant (giong PATCH).
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.models import Portfolio, PortfolioBrokerBinding, SubAccount
from user_workspace.tests.envelope import unwrapped_json

URL = '/core/v1/workspace/portfolios/{pid}/broker-bindings/'

CONTRACT_KEYS = {
    'binding_id', 'sub_account_id', 'provider', 'external_id',
    'display_name', 'role', 'is_default',
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


class BrokerBindingsReadTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('bread')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM doc')
        self.sub1 = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK DNSE 0001',
            account_number='0001', provider='dnse', external_id='E1')
        self.sub2 = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='SSI', display_name='TK SSI 0002',
            account_number='0002', provider='ssi', external_id='E2')
        self.binding = PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=self.sub1,
            tenant=self.tenant, role='primary', is_default=True)

    def test_get_lists_bindings_with_contract_fields(self):
        resp = self.client.get(URL.format(pid=self.portfolio.id))
        self.assertEqual(resp.status_code, 200)
        rows = unwrapped_json(resp)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(set(row.keys()), CONTRACT_KEYS)
        self.assertEqual(row['binding_id'], self.binding.id)
        self.assertEqual(row['sub_account_id'], self.sub1.id)
        self.assertEqual(row['provider'], 'dnse')
        self.assertEqual(row['external_id'], 'E1')
        self.assertEqual(row['display_name'], 'TK DNSE 0001')
        self.assertEqual(row['role'], 'primary')
        self.assertTrue(row['is_default'])

    def test_get_empty_returns_empty_list(self):
        self.binding.delete()
        resp = self.client.get(URL.format(pid=self.portfolio.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp), [])

    def test_get_foreign_portfolio_404(self):
        other_user = User.objects.create_user(username='bread-la', password='x')
        other_tenant = CoreTenant.objects.create(
            tenant_code='t-bread-la', display_name='La',
            owner_user=other_user, status=CoreTenant.StatusChoices.ACTIVE)
        foreign = Portfolio.objects.create(
            user=other_user, tenant=other_tenant, name='DM la')
        resp = self.client.get(URL.format(pid=foreign.id))
        self.assertEqual(resp.status_code, 404)

    def test_get_requires_authentication(self):
        self.client.logout()
        resp = self.client.get(URL.format(pid=self.portfolio.id))
        self.assertIn(resp.status_code, (401, 403))
