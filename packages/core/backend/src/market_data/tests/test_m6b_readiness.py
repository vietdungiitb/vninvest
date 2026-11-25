"""M6b — R1/R2 readiness: contract tests."""
from django.test import SimpleTestCase

from advisory.models import AdvisoryRecord
from market_data.serializers import DailyPriceSerializer
from user_workspace.models import ScreenerRunHistory


class M6bReadinessTests(SimpleTestCase):
    def test_r2_price_basis_field_on_records(self):
        adv = {f.name: f for f in AdvisoryRecord._meta.get_fields()}
        scr = {f.name: f for f in ScreenerRunHistory._meta.get_fields()}
        self.assertIn('price_basis', adv)
        self.assertIn('price_basis', scr)
        self.assertEqual(adv['price_basis'].default, 'raw')
        self.assertEqual(scr['price_basis'].default, 'raw')

    def test_r2_serializer_unchanged(self):
        fields = set(DailyPriceSerializer().fields.keys())
        self.assertTrue({'adj_close', 'adj_factor', 'price_source'} <= fields)
