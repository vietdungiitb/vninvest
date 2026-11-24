"""M2 — schema fields & concurrent index (TDD factual)."""
from django.test import SimpleTestCase

from market_data.models import DailyPrice


class M2SchemaTests(SimpleTestCase):
    def test_fields_exist_with_expected_defaults(self):
        fields = {f.name: f for f in DailyPrice._meta.get_fields()}
        self.assertIn('adj_factor', fields)
        self.assertIn('price_source', fields)
        self.assertTrue(fields['adj_factor'].null)
        self.assertEqual(fields['adj_factor'].decimal_places, 10)
        self.assertEqual(fields['price_source'].default, 'vnbroker_legacy')
        self.assertFalse(fields['price_source'].db_index)  # index tạo riêng concurrent

    def test_index_sql_is_concurrent(self):
        """Chỉ assert migration dùng CONCURRENTLY + atomic=False (verify thật trên staging)."""
        from importlib import import_module

        mod = import_module('market_data.migrations.0012_dailyprice_price_source_adj_factor')
        migration = mod.Migration
        runpython = [op for op in migration.operations
                     if op.__class__.__name__ == 'RunPython']
        self.assertEqual(len(runpython), 1)
        self.assertFalse(runpython[0].atomic)
        import inspect

        self.assertIn('CONCURRENTLY', inspect.getsource(mod._create_index_concurrently))

    def test_new_row_defaults(self):
        fields = {f.name: f for f in DailyPrice._meta.get_fields()}
        self.assertEqual(fields['price_source'].default, 'vnbroker_legacy')
        self.assertTrue(fields['adj_factor'].null)
