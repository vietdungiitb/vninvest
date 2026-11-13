"""Dot3 remaining — B-4 fundamentals typed + B-6 PAT scope (fail-before → pass-after).

B-4: financials records co 5 key co dinh (period/year/quarter/report_date/items),
so la number, thieu la null; ?period la phai quarter|year, sai -> 400 UPPER_SNAKE.
B-6: machine PAT thieu scope -> 403; human session bypass (khong hoi quy).
"""
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember


def _payload(response):
    body = response.json()
    if isinstance(body, dict) and 'data' in body and isinstance(body['data'], dict):
        return body['data']
    return body


class Dot3RemainingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='dot3_owner', email='dot3@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='dot3-tenant-uuid', tenant_code='dot3',
            display_name='Dot3', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.owner, role=TenantMember.RoleChoices.OWNER,
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='DOT3_SA', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read', 'ai:invoke'],
        )
        _, self.token_no_scope = CorePATCredential.issue_for_service_account(
            service_account=self.sa, scopes=[],
            label='dot3:noscope', audit_reason='test', is_human_session=False,
        )
        _, self.token_scoped = CorePATCredential.issue_for_service_account(
            service_account=self.sa, scopes=['market:read', 'signals:read', 'ai:invoke'],
            label='dot3:scoped', audit_reason='test', is_human_session=False,
        )

    def _pat(self, token):
        c = APIClient()
        c.credentials(
            HTTP_AUTHORIZATION=f'Bearer {token}',
            HTTP_X_TENANT_ID=str(self.tenant.public_id),
        )
        return c

    # --- B-4 ---
    @patch('market_data.vnbroker_adapter.fetch_company_financials')
    def test_b4_financials_records_typed(self, mock_fetch):
        mock_fetch.return_value = {
            'ratio': [{'roe': '12.5', 'eps': '', 'symbol': 'VNMX'}],
            'income_statement': [],
            'balance_sheet': [],
        }
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/stock-management/stocks/VNMX/financials/')
        self.assertEqual(resp.status_code, 200)
        fin = _payload(resp)['financials']
        rec = fin['ratio'][0]
        self.assertEqual(
            set(rec.keys()), {'period', 'year', 'quarter', 'report_date', 'items'},
        )
        self.assertEqual(rec['items']['roe'], 12.5)
        self.assertIsInstance(rec['items']['roe'], float)
        self.assertIsNone(rec['items']['eps'])

    def test_b4_period_invalid_400(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/stock-management/stocks/VNM/financials/?period=foo')
        self.assertEqual(resp.status_code, 400)
        self.assertRegex(str(resp.json()), r'[A-Z]{2,}(_[A-Z]+)+')

    @patch('market_data.vnbroker_adapter.fetch_company_financials')
    def test_b4_period_year_empty_400(self, mock_fetch):
        mock_fetch.return_value = {'ratio': [], 'income_statement': [], 'balance_sheet': []}
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/stock-management/stocks/VNMY/financials/?period=year')
        self.assertEqual(resp.status_code, 400)
        self.assertRegex(str(resp.json()), r'[A-Z]{2,}(_[A-Z]+)+')

    # --- B-6 ---
    def test_b6_market_pat_without_scope_403(self):
        resp = self._pat(self.token_no_scope).get('/core/v1/realtime/ticker/VNM/')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('scope', str(resp.json()).lower())

    def test_b6_market_pat_with_scope_200(self):
        resp = self._pat(self.token_scoped).get('/core/v1/realtime/ticker/VNM/')
        self.assertEqual(resp.status_code, 200)

    def test_b6_signal_pat_without_scope_403(self):
        resp = self._pat(self.token_no_scope).get('/core/v1/signals/alert-center/feed')
        self.assertEqual(resp.status_code, 403)

    def test_b6_advisory_pat_without_scope_403(self):
        resp = self._pat(self.token_no_scope).post(
            '/core/v1/advisory/refresh/VNM/', {}, format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_b6_human_session_unaffected(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get('/core/v1/realtime/ticker/VNM/')
        self.assertEqual(resp.status_code, 200)
