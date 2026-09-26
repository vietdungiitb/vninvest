"""R0.4 / R0.6 / R0.9 / R0.12 — contract API của advisory.

Bằng chứng gốc: `serializers.py` cũ đọc thẳng `structured_output.signal` trong
khi orchestrator không ghi key đó, nên `signal`/`confidence_score` trả `None`
vĩnh viễn và FE suy ra `side=UNKNOWN` cho mọi tín hiệu. Test bên dưới khóa lại
hành vi đúng sau khi sửa.
"""

import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryComponent, AdvisoryRecord, AdvisorySession

FULL_STRUCTURED = {
    'signal': 'SELL',
    'signal_raw': 'BÁN',
    'confidence_score': 0.82,
    'summary': 'Dòng tiền thoát mạnh, nên giảm tỷ trọng.',
    'rationale': 'CVD âm kéo dài, sức mạnh tổ chức suy yếu.',
    'recommendation': 'BÁN LỤC',
    'risk_level': 'high',
    'target_price': 15300.0,
    'matched_value': 14500,
    'schema_version': 2,
}


class AdvisoryRecordContractTests(TestCase):
    """R0.4 — 11 field mới phải có mặt và không được trả None bắt buộc."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='contract-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()
        self.record = AdvisoryRecord.objects.create(
            user=self.user,
            symbol='VNM',
            session_date=self.today,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            structured_output=dict(FULL_STRUCTURED),
        )

    def _payload(self):
        response = self.client.get(f'/core/v1/advisory/latest/{self.record.symbol}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_signal_read_from_structured_output(self):
        self.assertEqual(self._payload()['signal'], 'SELL')

    def test_side_derived_from_signal(self):
        self.assertEqual(self._payload()['side'], 'SELL')

    def test_confidence_score_exposed(self):
        self.assertEqual(self._payload()['confidence_score'], 0.82)

    def test_all_new_fields_present(self):
        payload = self._payload()
        for field in (
            'signal', 'side', 'confidence_score', 'summary', 'rationale',
            'recommendation', 'risk_level', 'target_price', 'components',
            'feature_attribution', 'input_snapshot', 'schema_version',
            'matched_value', 'is_discovery', 'whale_intensity', 'error_code',
            'user_message',
        ):
            with self.subTest(field=field):
                self.assertIn(field, payload)

    def test_vietnamese_sell_survives_serializer(self):
        """Ký lại: `BÁN` (có dấu) phải ra SELL, không phải None."""
        self.record.structured_output = {'recommendation': 'BÁN'}
        self.record.save()
        self.assertEqual(self._payload()['signal'], 'SELL')

    def test_negated_buy_is_unknown_not_buy(self):
        self.record.structured_output = {'recommendation': 'KHÔNG MUA'}
        self.record.save()
        self.assertEqual(self._payload()['signal'], 'UNKNOWN')
        self.assertEqual(self._payload()['side'], 'UNKNOWN')

    def test_confidence_never_invents_value(self):
        self.record.structured_output = {'signal': 'BUY'}
        self.record.save()
        self.assertIsNone(self._payload()['confidence_score'])

    def test_components_from_advisory_component_table(self):
        session = AdvisorySession.objects.create(
            user=self.user,
            symbol='VNM',
            session_date=self.today,
            status=AdvisorySession.StatusChoices.COMPLETED,
        )
        AdvisoryComponent.objects.create(
            session=session,
            component_type=AdvisoryComponent.ComponentType.TECHNICAL,
            content='RSI 14 = 71 (quá mua)',
            order=0,
        )
        components = self._payload()['components']
        self.assertEqual(len(components), 1)
        self.assertEqual(components[0]['component_type'], 'technical')
        self.assertIn('RSI', components[0]['content'])


class AdvisorySymbolStatsTests(TestCase):
    """R0.6 — endpoint thật thay stub `{'stats': []}`."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='stats-owner', password='testpass123')
        self.other = User.objects.create_user(username='stats-other', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def _record(self, user, symbol, record_status, structured=None):
        return AdvisoryRecord.objects.create(
            user=user,
            symbol=symbol,
            session_date=self.today,
            status=record_status,
            structured_output=structured if structured is not None else dict(FULL_STRUCTURED),
        )

    def test_empty_returns_empty_list(self):
        response = self.client.get('/core/v1/portfolio/ai-advisory-symbol-stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stats'], [])

    def test_generated_record_appears_with_real_values(self):
        self._record(self.user, 'VNM', AdvisoryRecord.StatusChoices.GENERATED)
        response = self.client.get('/core/v1/portfolio/ai-advisory-symbol-stats/')
        self.assertEqual(len(response.data['stats']), 1)
        row = response.data['stats'][0]
        self.assertEqual(row['symbol'], 'VNM')
        self.assertEqual(row['side'], 'SELL')
        self.assertEqual(row['confidence_score'], 0.82)

    def test_failed_and_pending_records_excluded(self):
        self._record(self.user, 'AAA', AdvisoryRecord.StatusChoices.FAILED)
        self._record(self.user, 'BBB', AdvisoryRecord.StatusChoices.PENDING)
        response = self.client.get('/core/v1/portfolio/ai-advisory-symbol-stats/')
        self.assertEqual(response.data['stats'], [])

    def test_no_fabricated_zero_columns(self):
        """Không được trả field số 0 giả — sidebar từng render '0%' cho 50 mã."""
        self._record(self.user, 'VNM', AdvisoryRecord.StatusChoices.GENERATED)
        response = self.client.get('/core/v1/portfolio/ai-advisory-symbol-stats/')
        row = response.data['stats'][0]
        for fabricated in ('whale_intensity', 'buy_count', 'sell_count'):
            with self.subTest(field=fabricated):
                self.assertNotIn(fabricated, row)

    def test_user_isolation(self):
        self._record(self.other, 'HAG', AdvisoryRecord.StatusChoices.GENERATED)
        response = self.client.get('/core/v1/portfolio/ai-advisory-symbol-stats/')
        self.assertEqual(response.data['stats'], [])

    def test_symbol_filter_respects_request_order(self):
        self._record(self.user, 'VIC', AdvisoryRecord.StatusChoices.GENERATED)
        self._record(self.user, 'VNM', AdvisoryRecord.StatusChoices.GENERATED)
        response = self.client.get('/core/v1/portfolio/ai-advisory-symbol-stats/?symbols=VNM,VIC')
        self.assertEqual(
            [row['symbol'] for row in response.data['stats']],
            ['VNM', 'VIC'],
        )


class AdvisoryListViewTests(TestCase):
    """R0.12 — list view thật thay stub `{'items': []}`."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='list-owner', password='testpass123')
        self.other = User.objects.create_user(username='list-other', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def _record(self, user, symbol, record_status='generated'):
        return AdvisoryRecord.objects.create(
            user=user,
            symbol=symbol,
            session_date=self.today,
            status=record_status,
            structured_output=dict(FULL_STRUCTURED),
        )

    def test_returns_today_records_for_user(self):
        self._record(self.user, 'VNM')
        self._record(self.user, 'VIC')
        response = self.client.get('/core/v1/portfolio/ai-advisory/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['session_date'], self.today.isoformat())

    def test_empty_when_no_records(self):
        response = self.client.get('/core/v1/portfolio/ai-advisory/')
        self.assertEqual(response.data['items'], [])
        self.assertEqual(response.data['count'], 0)

    def test_user_isolation(self):
        self._record(self.other, 'HAG')
        response = self.client.get('/core/v1/portfolio/ai-advisory/')
        self.assertEqual(response.data['count'], 0)

    def test_symbol_filter(self):
        self._record(self.user, 'VNM')
        self._record(self.user, 'VIC')
        response = self.client.get('/core/v1/portfolio/ai-advisory/?symbol=VIC')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['items'][0]['symbol'], 'VIC')

    def test_items_use_full_contract(self):
        self._record(self.user, 'VNM')
        response = self.client.get('/core/v1/portfolio/ai-advisory/')
        item = response.data['items'][0]
        self.assertEqual(item['signal'], 'SELL')
        self.assertEqual(item['side'], 'SELL')
        self.assertEqual(item['confidence_score'], 0.82)
