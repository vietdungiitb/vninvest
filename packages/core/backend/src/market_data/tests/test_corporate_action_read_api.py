"""Read API cho corporate actions — endpoint BE phuc vu widget overlay (Task 1).

Fail-before: route `/core/v1/stock-management/stocks/<symbol>/corporate-actions/`
chua ton tai -> cac test 200 deu do 404 cho den khi views.py + mount duoc them.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, UserProfile
from market_data.models import CorporateAction, StockProfile
from market_data.tests.envelope import unwrapped_json

User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class CorporateActionReadApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.tenant_owner = User.objects.create_user(
            username='corp-read-api-tenant-owner',
            email='corp-read-api-owner@test.local',
            password='pass123',
        )
        cls.tenant = CoreTenant.objects.create(
            tenant_code='corp-read-api-default-tenant',
            display_name='Default Test Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
            owner_user=cls.tenant_owner,
        )
        cls.user = User.objects.create_user(
            username='corp-read-api',
            email='corp-read-api@test.local',
            password='pass123',
        )
        UserProfile.objects.create(user=cls.user, tenant=cls.tenant)
        StockProfile.objects.create(
            symbol='VNM',
            company_name='Vinamilk',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Food',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        today = timezone.localdate()
        # 2 DIV cung ex_date, ID nguon khac nhau -> phai giu rieng 2 event (Review Focus 1).
        CorporateAction.objects.create(
            symbol='VNM',
            action_type=CorporateAction.ActionType.DIV,
            ex_date=today - timedelta(days=30),
            cash_amount_per_share=Decimal('950.00'),
            source='VCI',
            source_event_id='vci-div-1',
            raw_title='Tra co tuc 950d/CP',
            parse_status=CorporateAction.ParseStatus.STRUCTURED,
        )
        CorporateAction.objects.create(
            symbol='VNM',
            action_type=CorporateAction.ActionType.DIV,
            ex_date=today - timedelta(days=30),
            cash_amount_per_share=Decimal('1500.00'),
            source='VCI',
            source_event_id='vci-div-2',
            raw_title='Tra co tuc 1500d/CP',
            parse_status=CorporateAction.ParseStatus.STRUCTURED,
        )
        CorporateAction.objects.create(
            symbol='VNM',
            action_type=CorporateAction.ActionType.ISS,
            ex_date=today - timedelta(days=200),
            stock_ratio_pct=Decimal('20.0000'),
            source='VCI',
            source_event_id='vci-iss-1',
            raw_title='Phat hanh co phieu thuong 20%',
            parse_status=CorporateAction.ParseStatus.STRUCTURED,
        )
        # Event cu ngoai cua so mac dinh 365 ngay.
        CorporateAction.objects.create(
            symbol='VNM',
            action_type=CorporateAction.ActionType.DIV,
            ex_date=today - timedelta(days=500),
            cash_amount_per_share=Decimal('100.00'),
            source='VCI',
            source_event_id='vci-div-old',
            raw_title='Co tuc cu',
            parse_status=CorporateAction.ParseStatus.STRUCTURED,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _get(self, symbol, query=''):
        return self.client.get(f'/core/v1/stock-management/stocks/{symbol}/corporate-actions/{query}')

    def test_route_exists_and_returns_envelope(self):
        response = self._get('VNM')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'VNM')
        actions = payload['actions']
        # 3 event trong cua so mac dinh; event 500 ngay tuoi bi loai.
        self.assertEqual(len(actions), 3)
        self.assertEqual(payload['count'], 3)

    def test_two_div_same_ex_date_kept_separate(self):
        payload = unwrapped_json(self._get('VNM'))
        divs = [a for a in payload['actions'] if a['action_type'] == 'DIV']
        self.assertEqual(len(divs), 2)
        amounts = sorted(float(a['cash_amount_per_share']) for a in divs)
        self.assertEqual(amounts, [950.0, 1500.0])
        ids = {a['source_event_id'] for a in divs}
        self.assertEqual(ids, {'vci-div-1', 'vci-div-2'})

    def test_numbers_are_numbers_not_strings(self):
        payload = unwrapped_json(self._get('VNM'))
        for action in payload['actions']:
            cash = action['cash_amount_per_share']
            ratio = action['stock_ratio_pct']
            if cash is not None:
                self.assertIsInstance(cash, (int, float))
            if ratio is not None:
                self.assertIsInstance(ratio, (int, float))

    def test_range_filter_narrows_results(self):
        today = timezone.localdate()
        start = (today - timedelta(days=60)).isoformat()
        end = (today - timedelta(days=10)).isoformat()
        payload = unwrapped_json(self._get('VNM', f'?from={start}&to={end}'))
        self.assertEqual(payload['count'], 2)
        self.assertTrue(all(a['action_type'] == 'DIV' for a in payload['actions']))

    def test_explicit_range_reaches_old_event(self):
        today = timezone.localdate()
        start = (today - timedelta(days=600)).isoformat()
        payload = unwrapped_json(self._get('VNM', f'?from={start}'))
        self.assertEqual(payload['count'], 4)

    def test_invalid_range_400(self):
        response = self._get('VNM', '?from=2025-01-01&to=2024-01-01')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_symbol_normalized(self):
        payload = unwrapped_json(self._get('vnm'))
        self.assertEqual(payload['symbol'], 'VNM')
        self.assertEqual(payload['count'], 3)

    def test_unknown_symbol_404(self):
        response = self._get('XXXNOTEXIST')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self):
        anonymous = APIClient()
        response = anonymous.get('/core/v1/stock-management/stocks/VNM/corporate-actions/')
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
