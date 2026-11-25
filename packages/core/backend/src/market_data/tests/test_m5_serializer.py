"""M5a — serializer phải trả trường điều chỉnh cho FE (TDD)."""
from django.test import SimpleTestCase

from market_data.serializers import DailyPriceSerializer


class M5SerializerTests(SimpleTestCase):
    def test_adjustment_fields_exposed(self):
        fields = set(DailyPriceSerializer().fields.keys())
        for name in ('adj_close', 'adj_factor', 'price_source'):
            self.assertIn(name, fields, name)

    def test_legacy_fields_still_exposed(self):
        fields = set(DailyPriceSerializer().fields.keys())
        for name in ('symbol', 'date', 'open', 'high', 'low', 'close',
                     'volume', 'value', 'change_pct', 'source', 'is_adjusted'):
            self.assertIn(name, fields, name)
