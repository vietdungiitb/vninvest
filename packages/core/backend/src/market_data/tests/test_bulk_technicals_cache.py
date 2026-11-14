"""AC1/AC2/R1 cho PLAN_WS502_CODEFIX_20261114 (Entry 511).

RED truoc: goi POST bulk 2 lan giong nhau, lan 2 van query DB (chua co cache).
GREEN sau: lan 2 ~0 query (cache hit), thu tu symbols theo request.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, UserProfile
from market_data.models import DailyPrice, StockProfile
from market_data.tests.envelope import unwrapped_json

User = get_user_model()

BULK_URL = '/core/v1/market-data/technicals/bulk/'


def _seed_daily(symbol, days=60, base=18.0):
    start_date = timezone.localdate() - timedelta(days=days + 10)
    for offset in range(days):
        trade_date = start_date + timedelta(days=offset)
        close_price = base + (offset * 0.12)
        DailyPrice.objects.create(
            symbol=symbol,
            date=trade_date,
            open=close_price - 0.15,
            high=close_price + 0.2,
            low=close_price - 0.25,
            close=close_price,
            volume=10000 + (offset * 150),
            source='core',
        )


class BulkTechnicalsCacheTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username='bulk-cache-owner',
            email='bulk-cache-owner@test.local',
            password='pass123',
        )
        cls.tenant = CoreTenant.objects.create(
            tenant_code='bulk-cache-tenant',
            display_name='Bulk Cache Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
            owner_user=cls.owner,
        )
        cls.user = User.objects.create_user(
            username='bulk-cache-user',
            email='bulk-cache-user@test.local',
            password='pass123',
        )
        UserProfile.objects.create(user=cls.user, tenant=cls.tenant)
        StockProfile.objects.create(
            symbol='TPB',
            company_name='Tien Phong Bank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        StockProfile.objects.create(
            symbol='ZZC',
            company_name='Cache Probe Co',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Testing',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        _seed_daily('TPB')
        _seed_daily('ZZC', base=42.0)

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _post(self, symbols):
        return self.client.post(BULK_URL, {'symbols': symbols}, format='json')

    def _build(self, symbols):
        from market_data.stock_mgmt_native_views import StockManagementTechnicalsView

        return StockManagementTechnicalsView()._build_response(symbols)

    def _technicals_by_symbol(self, response):
        return {
            item['symbol']: {k: v for k, v in item.items() if k != 'updated_at'}
            for item in unwrapped_json(response)['technicals']
        }

    def test_second_identical_post_skips_db(self):
        # Ghi nhan: HTTP-level luon co INSERT audit (middleware/audit chay tren
        # connection chinh) + view chay tren threadpool rieng (Entry 509) nen
        # CaptureQueriesContext khong thay query cua view. Do cache o muc
        # _build_response goi truc tiep (cung thread) moi la tin hieu that.
        cache.clear()
        with CaptureQueriesContext(connection) as first_ctx:
            self._build(['TPB', 'ZZC'])
        with CaptureQueriesContext(connection) as second_ctx:
            self._build(['TPB', 'ZZC'])
        self.assertGreater(len(first_ctx), 0)
        self.assertEqual(len(second_ctx), 0)

        http_first = self._post(['TPB', 'ZZC'])
        http_second = self._post(['TPB', 'ZZC'])
        self.assertEqual(http_first.status_code, status.HTTP_200_OK)
        self.assertEqual(http_second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._technicals_by_symbol(http_second),
            self._technicals_by_symbol(http_first),
        )

    def test_different_symbols_miss_cache(self):
        cache.clear()
        with CaptureQueriesContext(connection) as ctx:
            self._build(['TPB'])
        self.assertGreater(len(ctx), 0)
        with CaptureQueriesContext(connection) as ctx:
            self._build(['ZZC'])
        self.assertGreater(len(ctx), 0)

        response = self._post(['ZZC'])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual([item['symbol'] for item in payload['technicals']], ['ZZC'])

    def test_hit_preserves_request_order(self):
        cache.clear()
        self._build(['TPB', 'ZZC'])
        with CaptureQueriesContext(connection) as ctx:
            ordered = self._build(['ZZC', 'TPB'])
        self.assertEqual(len(ctx), 0)
        self.assertEqual(
            [item['symbol'] for item in ordered.data['technicals']],
            ['ZZC', 'TPB'],
        )

        response = self._post(['ZZC', 'TPB'])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(
            [item['symbol'] for item in payload['technicals']],
            ['ZZC', 'TPB'],
        )
