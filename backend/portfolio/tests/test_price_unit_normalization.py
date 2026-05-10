from decimal import Decimal

import pandas as pd
from django.test import SimpleTestCase

from portfolio import services


class PriceUnitNormalizationTests(SimpleTestCase):
    def test_resolve_vnbroker_price_unit_from_dataframe_attrs(self):
        df = pd.DataFrame([{'close': 30343.8}])
        df.attrs['price_unit'] = 'VND'

        unit = services._resolve_vnbroker_price_unit(df)

        self.assertEqual(unit, 'VND')

    def test_normalise_ohlcv_keeps_vnd_values_for_daily_price_storage(self):
        row = {
            'open': 30000,
            'high': 30500,
            'low': 29900,
            'close': 30343.8,
            'volume': 100,
        }

        data = services._normalise_ohlcv(row, price_scale=Decimal('1'))

        self.assertEqual(data['open_price'], Decimal('30000'))
        self.assertEqual(data['high_price'], Decimal('30500'))
        self.assertEqual(data['low_price'], Decimal('29900'))
        self.assertEqual(data['close_price'], Decimal('30343.8'))
        self.assertEqual(data['volume'], 100)

    def test_normalise_ohlcv_scales_thousand_vnd_to_vnd(self):
        row = {
            'open': 30,
            'high': 30.5,
            'low': 29.9,
            'close': 30.3438,
            'volume': 100,
        }

        data = services._normalise_ohlcv(row, price_scale=Decimal('1000'))

        self.assertEqual(data['open_price'], Decimal('30000'))
        self.assertEqual(data['high_price'], Decimal('30500.0'))
        self.assertEqual(data['low_price'], Decimal('29900.0'))
        self.assertEqual(data['close_price'], Decimal('30343.8000'))
        self.assertEqual(data['volume'], 100)

    def test_resolve_price_scale_to_system_unit_for_vnd_input(self):
        scale = services._resolve_price_scale_to_system_unit('VND')
        # VND → system THOUSAND_VND: must divide by 1000 → scale = 0.001
        self.assertEqual(scale, Decimal('0.001'))

    def test_resolve_price_scale_to_system_unit_for_thousand_vnd_input(self):
        scale = services._resolve_price_scale_to_system_unit('THOUSAND_VND')
        # Adapter already outputs THOUSAND_VND (canonical); no conversion needed → scale = 1
        self.assertEqual(scale, Decimal('1'))
