from decimal import Decimal

import pandas as pd
from django.test import SimpleTestCase

from portfolio import services


class PriceUnitNormalizationTests(SimpleTestCase):
    def test_resolve_vnstock_price_unit_from_dataframe_attrs(self):
        df = pd.DataFrame([{'close': 30343.8}])
        df.attrs['price_unit'] = 'VND'

        unit = services._resolve_vnstock_price_unit(df)

        self.assertEqual(unit, 'VND')

    def test_normalise_ohlcv_scales_vnd_to_thousand_vnd(self):
        row = {
            'open': 30000,
            'high': 30500,
            'low': 29900,
            'close': 30343.8,
            'volume': 100,
        }

        data = services._normalise_ohlcv(row, price_scale=Decimal('0.001'))

        self.assertEqual(data['open_price'], Decimal('30.000'))
        self.assertEqual(data['high_price'], Decimal('30.500'))
        self.assertEqual(data['low_price'], Decimal('29.900'))
        self.assertEqual(data['close_price'], Decimal('30.3438'))
        self.assertEqual(data['volume'], 100)

    def test_resolve_price_scale_to_system_unit_for_vnd_input(self):
        scale = services._resolve_price_scale_to_system_unit('VND')
        self.assertEqual(scale, Decimal('0.001'))
