import pandas as pd
from django.test import SimpleTestCase
from portfolio.adapters import vnbroker_adapter

class PriceBoardNormalizationTests(SimpleTestCase):
    def test_kbs_flat_to_multiindex_mapping(self):
        # Mock KBS flat DataFrame structure
        flat_df = pd.DataFrame([
            {
                'symbol': 'MBS',
                'close_price': 25000.0,
                'reference_price': 24500.0,
                'bid_price_1': 24900.0,
                'bid_vol_1': 1000,
                'ask_price_1': 25100.0,
                'ask_vol_1': 2000,
                'total_volume': 500000,
            }
        ])
        
        normalized = vnbroker_adapter._normalize_price_board_dataframe(flat_df)
        
        self.assertIsInstance(normalized.columns, pd.MultiIndex)
        self.assertEqual(normalized[('match', 'match_price')].iloc[0], 25000.0)
        self.assertEqual(normalized[('match', 'reference_price')].iloc[0], 24500.0)
        self.assertEqual(normalized[('bid_ask', 'bid_1_price')].iloc[0], 24900.0)
        self.assertEqual(normalized[('bid_ask', 'bid_1_volume')].iloc[0], 1000)
        self.assertEqual(normalized[('match', 'accumulated_volume')].iloc[0], 500000)
        self.assertEqual(normalized[('listing', 'symbol')].iloc[0], 'MBS')

    def test_vci_multiindex_idempotent(self):
        # Mock VCI MultiIndex DataFrame structure
        mi_df = pd.DataFrame(
            [[25000.0, 1000.0]],
            columns=pd.MultiIndex.from_tuples([
                ('match', 'match_price'),
                ('bid_ask', 'bid_1_volume'),
            ])
        )
        
        normalized = vnbroker_adapter._normalize_price_board_dataframe(mi_df)
        
        self.assertEqual(normalized[('match', 'match_price')].iloc[0], 25000.0)
        self.assertEqual(normalized[('bid_ask', 'bid_1_volume')].iloc[0], 1000.0)
        # Verify it stays MultiIndex
        self.assertIsInstance(normalized.columns, pd.MultiIndex)

    def test_numeric_coercion_handles_invalid_data(self):
        # Mock flat data with dashes and empty strings
        flat_df = pd.DataFrame([
            {
                'bid_price_2': '-',
                'bid_vol_2': '',
                'bid_price_1': '25000',
            }
        ])
        
        normalized = vnbroker_adapter._normalize_price_board_dataframe(flat_df)
        
        import numpy as np
        self.assertTrue(np.isnan(normalized[('bid_ask', 'bid_2_price')].iloc[0]))
        self.assertTrue(np.isnan(normalized[('bid_ask', 'bid_2_volume')].iloc[0]))
        self.assertEqual(normalized[('bid_ask', 'bid_1_price')].iloc[0], 25000.0)
