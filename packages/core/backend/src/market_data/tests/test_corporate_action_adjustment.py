"""Task 4 — adjustment engine: factor theo ex_date, cộng tiền, nhân dồn (fail-before)."""
import os
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from market_data.corporate_actions.adjustment import apply_adjustments, compute_adj_factors
from market_data.models import AdjFactor, CorporateAction, DailyPrice

Q10 = Decimal('0.0000000001')


class AdjustmentTests(TestCase):
    def _price(self, symbol, iso, close):
        day = date.fromisoformat(iso)
        return DailyPrice.objects.create(
            symbol=symbol, date=day, open=close, high=close, low=close, close=close, volume=1000,
        )

    def _event(self, symbol, iso, eid, cash=None, ratio=None, action='DIV',
               status='parsed_from_text', latest=True):
        return CorporateAction.objects.create(
            symbol=symbol, action_type=action, ex_date=date.fromisoformat(iso),
            cash_amount_per_share=Decimal(cash) if cash is not None else None,
            stock_ratio_pct=Decimal(ratio) if ratio is not None else None,
            source='VCI', source_event_id=eid, raw_title=eid,
            parse_status=status, is_latest=latest,
        )

    def test_two_div_same_ex_date(self):
        self._price('VNM', '2024-09-23', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'id-950', cash='950')
        self._event('VNM', '2024-09-24', 'id-1500', cash='1500')
        factors = compute_adj_factors('VNM')
        self.assertEqual(len(factors), 1)
        expected = (Decimal('100000') - Decimal('2450')) / Decimal('100000')
        self.assertEqual(factors[0].cash_factor, expected.quantize(Q10))
        self.assertEqual(AdjFactor.objects.count(), 1)
        # recompute idempotent, không nhân đôi factor
        compute_adj_factors('VNM')
        self.assertEqual(AdjFactor.objects.count(), 1)

    def test_golden_numeric_values(self):
        self._price('FPT', '2024-01-10', Decimal('100000'))
        self._event('FPT', '2024-01-11', 'fpt-15', ratio='15.0', action='ISS')
        fpt = compute_adj_factors('FPT')[0]
        self.assertEqual(fpt.stock_factor, (Decimal(1) / Decimal('1.15')).quantize(Q10))

        self._price('VCB', '2024-01-10', Decimal('100000'))
        self._event('VCB', '2024-01-11', 'vcb-450', cash='450')
        self._event('VCB', '2024-01-11', 'vcb-495', ratio='49.5', action='ISS')
        vcb = compute_adj_factors('VCB')[0]
        cash_factor = ((Decimal('100000') - Decimal('450')) / Decimal('100000')).quantize(Q10)
        stock_factor = (Decimal(1) / (Decimal(1) + Decimal('49.5') / Decimal(100))).quantize(Q10)
        self.assertEqual(vcb.cash_factor, cash_factor)
        self.assertEqual(vcb.stock_factor, stock_factor)
        self.assertEqual(vcb.factor_total, (cash_factor * stock_factor).quantize(Q10))

    def test_unparsed_is_per_date(self):
        self._price('VNM', '2024-09-23', Decimal('100000'))
        self._price('VNM', '2024-09-25', Decimal('100000'))
        self._price('VNM', '2025-05-13', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'unparsed-1', status='unparsed')
        self._event('VNM', '2025-05-14', 'clean-1', cash='2000')
        factors = compute_adj_factors('VNM')
        self.assertEqual(AdjFactor.objects.get(ex_date=date(2024, 9, 24)).status, 'partial')
        self.assertEqual(AdjFactor.objects.get(ex_date=date(2025, 5, 14)).status, 'computed')
        self.assertEqual(len(factors), 2)
        apply_adjustments('VNM')
        self.assertIsNone(DailyPrice.objects.get(date=date(2024, 9, 23)).adj_close)
        # P0: flag mặc định tắt ⇒ không ghi adj_close (kể cả factor computed).
        self.assertIsNone(DailyPrice.objects.get(date=date(2025, 5, 13)).adj_close)

    def test_writes_disabled_by_default(self):
        """AC-1: flag OFF ⇒ 0 UPDATE, freeze cả vòng reset lẫn vòng ghi."""
        self._price('VNM', '2024-09-23', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'clean', cash='1000')
        compute_adj_factors('VNM')
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('PRICE_ADJUSTMENT_WRITES_ENABLED', None)
            self.assertEqual(apply_adjustments('VNM'), 0)
        price = DailyPrice.objects.get(date=date(2024, 9, 23))
        self.assertIsNone(price.adj_close)
        self.assertFalse(price.is_adjusted)

    def test_invalid_factor_guard(self):
        self._price('VNM', '2024-09-23', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'bad', cash='120000')
        with self.assertLogs('market_data.corporate_actions.adjustment', level='WARNING'):
            factors = compute_adj_factors('VNM')
        self.assertEqual(factors, [])
        self.assertEqual(AdjFactor.objects.count(), 0)

    def test_is_latest_supersedes_old(self):
        self._price('VNM', '2024-09-23', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'old', cash='950', latest=False)
        self._event('VNM', '2024-09-24', 'new', cash='1500')
        factor = compute_adj_factors('VNM')[0]
        expected = (Decimal('100000') - Decimal('1500')) / Decimal('100000')
        self.assertEqual(factor.cash_factor, expected.quantize(Q10))

    def test_prev_close_is_last_trading_day(self):
        self._price('VNM', '2024-09-20', Decimal('90000'))
        self._price('VNM', '2024-09-23', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'e1', cash='1000')
        factor = compute_adj_factors('VNM')[0]
        self.assertEqual(factor.prev_close, Decimal('100000.00'))

    @patch.dict(os.environ, {'PRICE_ADJUSTMENT_WRITES_ENABLED': '1'})
    def test_recompute_clears_stale_factor_and_adj_close(self):
        price = self._price('VNM', '2024-09-23', Decimal('100000'))
        self._event('VNM', '2024-09-24', 'e1', cash='1000')
        compute_adj_factors('VNM')
        self.assertEqual(apply_adjustments('VNM'), 1)
        price.refresh_from_db()
        self.assertIsNotNone(price.adj_close)

        # Correction: số tiền mới vô hiệu hệ số ⇒ factor cũ bị xoá, adj_close bị reset.
        CorporateAction.objects.filter(source_event_id='e1').delete()
        self._event('VNM', '2024-09-24', 'e2', cash='120000')
        with self.assertLogs('market_data.corporate_actions.adjustment', level='WARNING'):
            factors = compute_adj_factors('VNM')
        self.assertEqual(factors, [])
        self.assertEqual(AdjFactor.objects.filter(symbol='VNM').count(), 0)
        apply_adjustments('VNM')
        price.refresh_from_db()
        self.assertIsNone(price.adj_close)
        self.assertFalse(price.is_adjusted)
