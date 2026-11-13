"""S2 index constituents EP-6 — fail-before: endpoint chua ton tai."""
from unittest.mock import patch

from django.contrib.auth.models.User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember


class IndexConstituentsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='idx_owner', email='idx@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='idx-tenant-uuid', tenant_code='idx',
            display_name='Idx', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.owner, role=TenantMember.RoleChoices.OWNER,
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='IDX_SA', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read'],
        )
        _, self.token_no_scope = CorePATCredential.issue_for_service_account(
            service_account=self.sa, scopes=[],
            label='idx:noscope', audit_reason='test', is_human_session=False,
        )
        _, self.token_scoped = CorePATCredential.issue_for_service_account(
            service_account=self.sa, scopes=['market:read'],
            label='idx:scoped', audit_reason='test', is_human_session=False,
        )

    def _pat(self, token):
        c = APIClient()
        c.credentials(
            HTTP_AUTHORIZATION=f'Bearer {token}',
            HTTP_X_TENANT_ID=str(self.tenant.public_id),
        )
        return c

    @patch('market_data.vnbroker_adapter.fetch_symbol_group_members')
    def test_valid_code_200_shape(self, mock_fetch):
        mock_fetch.return_value = ['VNM', 'VCB']
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/market-data/index/vn30/constituents/')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get('code'), 'vn30')
        self.assertEqual(body.get('count'), 2)
        self.assertEqual(body.get('symbols'), ['VNM', 'VCB'])
        self.assertIsInstance(body.get('note'), str)
        for sym in body['symbols']:
            self.assertIsInstance(sym, str)

    def test_unknown_code_400(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/market-data/index/xyz-nope-999/constituents/')
        self.assertEqual(resp.status_code, 400)
        self.assertRegex(str(resp.json()), r'[A-Z]{2,}(_[A-Z]+)+')

    def test_pat_no_scope_403(self):
        resp = self._pat(self.token_no_scope).get('/core/v1/market-data/index/vn30/constituents/')
        self.assertEqual(resp.status_code, 403)

    @patch('market_data.vnbroker_adapter.fetch_symbol_group_members')
    def test_pat_scoped_200(self, mock_fetch):
        mock_fetch.return_value = ['VNM']
        resp = self._pat(self.token_scoped).get('/core/v1/market-data/index/vn30/constituents/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get('count'), 1)

    @patch('market_data.vnbroker_adapter.fetch_symbol_group_members')
    def test_empty_group_200_empty(self, mock_fetch):
        mock_fetch.return_value = []
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/market-data/index/hnx30/constituents/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get('count'), 0)
        self.assertEqual(resp.json().get('symbols'), [])
