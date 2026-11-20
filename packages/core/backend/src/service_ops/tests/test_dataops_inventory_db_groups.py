"""DataOps inventory phải đọc group members từ DB cache, không gọi KBS ngoài.

Fail-before (code cũ): patch fetch_symbol_group_members để raise ⇒ view gọi external
⇒ AssertionError/500. Pass-after: view chỉ query CachedSymbolGroupMember ⇒ 200.
"""
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import DailyPrice
from service_ops.models import (
    CachedSymbolGroup,
    CachedSymbolGroupMember,
    CustomSymbolGroup,
)

INVENTORY_URL = '/api/soc/dataops/inventory/'


class DataOpsInventoryDbGroupsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username='dataops-inventory-staff',
            email='dataops-inventory-staff@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        DailyPrice.objects.create(
            symbol='AAA', date=date(2026, 11, 1),
            open=Decimal('10'), high=Decimal('11'), low=Decimal('9'), close=Decimal('10.5'),
            volume=1000,
        )
        vn30 = CachedSymbolGroup.objects.create(
            group_name='VN30', group_code='30', category='Chỉ số VN',
            source_provider='KBS', group_type='INDEX',
        )
        CachedSymbolGroupMember.objects.create(group=vn30, symbol='AAA')
        # 'vn50' trong PREDEFINED_SYMBOL_GROUPS không trùng tên cache 'VNX50'
        vnx50 = CachedSymbolGroup.objects.create(
            group_name='VNX50', group_code='X50', category='Chỉ số VN',
            source_provider='KBS', group_type='INDEX',
        )
        CachedSymbolGroupMember.objects.create(group=vnx50, symbol='AAA')
        CustomSymbolGroup.objects.create(
            name='Probe custom', slug='probe', symbols=['aaa'], is_active=True,
        )

    def test_inventory_does_not_call_external_and_uses_db_cache(self):
        with patch(
            'market_data.vnbroker_adapter.fetch_symbol_group_members',
            side_effect=AssertionError('EXTERNAL_CALLED'),
        ):
            response = self.client.get(INVENTORY_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()['data']
        self.assertGreater(payload['summary']['total_rows'], 0)

        by_group = {row['id']: row for row in payload['by_group']}
        self.assertEqual(by_group['vn30']['symbol_count'], 1)
        self.assertEqual(by_group['vn30']['covered_symbols'], 1)
        self.assertEqual(by_group['vn50']['symbol_count'], 1)  # alias VNX50
        self.assertEqual(by_group['custom_probe']['symbol_count'], 1)
