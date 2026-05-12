"""
Tests for vnbroker_adapter canonical price unit enforcement.

Verifies that all adapter outputs guarantee THOUSAND_VND canonical prices.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import pandas as pd
from portfolio.adapters.vnbroker_adapter import (
    _normalize_price_board_dataframe,
    _ensure_quote_prices_canonical_thousand_vnd,
    _price_board_dataframe_is_parseable,
)
from portfolio.price_units import QUOTE_UNIT_CANONICAL


class TestAdapterCanonicalOutput:
    """Test that adapter guarantees THOUSAND_VND canonical output."""
    
    def test_ensure_prices_canonical_kbs_source_detects_vnd(self):
        """KBS source detected as VND - should convert to THOUSAND_VND."""
        df = pd.DataFrame({
            ('match', 'match_price'): [26_600_000, 67_100_000],
            ('match', 'open_price'): [26_500_000, 67_000_000],
        })
        
        result = _ensure_quote_prices_canonical_thousand_vnd(df, source_provider='KBS')
        
        assert result[('match', 'match_price')].iloc[0] == 26_600.0
        assert result[('match', 'open_price')].iloc[0] == 26_500.0
        assert result.attrs['price_unit_canonical'] == QUOTE_UNIT_CANONICAL
        assert result.attrs['price_unit_source'] == 'KBS'
    
    def test_ensure_prices_canonical_vci_source_passthrough(self):
        """VCI source detected as THOUSAND_VND - should passthrough."""
        df = pd.DataFrame({
            ('match', 'match_price'): [26_600.0, 67_100.0],
            ('match', 'open_price'): [26_500.0, 67_000.0],
        })
        
        result = _ensure_quote_prices_canonical_thousand_vnd(df, source_provider='VCI')
        
        # Should remain same (/ 1000 of 26,600.0 = 26.6, but source is already THOUSAND_VND)
        # Actually VCI detected as THOUSAND_VND, so divide by 1 -> passthrough
        # Wait, let me reconsider: if source_provider=='VCI', unit is 'THOUSAND_VND',
        # so value/1 = value 
        assert result[('match', 'match_price')].iloc[0] == 26_600.0
        assert result.attrs['price_unit_canonical'] == QUOTE_UNIT_CANONICAL
    
    def test_ensure_prices_canonical_handles_nan_values(self):
        """NaN values should be skipped."""
        df = pd.DataFrame({
            ('match', 'match_price'): [26_600_000.0, None, 67_100_000.0],
            ('match', 'open_price'): [26_500_000.0, 26_400_000, None],
        })
        
        result = _ensure_quote_prices_canonical_thousand_vnd(df, source_provider='KBS')
        
        assert result[('match', 'match_price')].iloc[0] == 26_600.0
        assert pd.isna(result[('match', 'match_price')].iloc[1])
        assert result[('match', 'match_price')].iloc[2] == 67_100.0
    
    def test_ensure_prices_canonical_all_price_columns(self):
        """All price-related columns are normalized."""
        df = pd.DataFrame({
            ('match', 'match_price'): [26_600_000],
            ('match', 'reference_price'): [26_500_000],
            ('match', 'open_price'): [26_400_000],
            ('match', 'highest'): [26_700_000],
            ('match', 'lowest'): [26_300_000],
            ('bid_ask', 'bid_1_price'): [26_590_000],
            ('bid_ask', 'ask_1_price'): [26_610_000],
            ('listing', 'ref_price'): [26_500_000],
        })
        
        result = _ensure_quote_prices_canonical_thousand_vnd(df, source_provider='KBS')
        
        assert result[('match', 'match_price')].iloc[0] == 26_600.0
        assert result[('match', 'reference_price')].iloc[0] == 26_500.0
        assert result[('match', 'highest')].iloc[0] == 26_700.0
        assert result[('bid_ask', 'bid_1_price')].iloc[0] == 26_590.0
        assert result[('listing', 'ref_price')].iloc[0] == 26_500.0
    
    def test_ensure_prices_canonical_empty_dataframe(self):
        """Empty dataframe handled gracefully."""
        df = pd.DataFrame()
        result = _ensure_quote_prices_canonical_thousand_vnd(df, source_provider='KBS')
        assert result.empty
    
    def test_ensure_prices_canonical_resets_attrs(self):
        """Contract seal attrs are set."""
        df = pd.DataFrame({
            ('match', 'match_price'): [26_600_000],
        })
        df.attrs['old_attr'] = 'persists'
        
        result = _ensure_quote_prices_canonical_thousand_vnd(df, source_provider='KBS')
        
        assert result.attrs['price_unit_canonical'] == QUOTE_UNIT_CANONICAL
        assert result.attrs['price_unit_source'] == 'KBS'
        # Original attrs should persist
        assert result.attrs.get('old_attr') == 'persists'
    
    def test_normalize_then_canonicalize_workflow(self):
        """Full workflow: normalize structure, then canonicalize units."""
        # Simulate raw KBS flat data
        raw_df = pd.DataFrame({
            'symbol': ['MBB', 'FPT'],
            'ref_price': [26_500_000, 67_000_000],
            'match_price': [26_600_000, 67_100_000],
            'open_price': [26_400_000, 66_900_000],
        })
        
        # Step 1: Structure normalization 
        normalized = _normalize_price_board_dataframe(raw_df)
        
        # Step 2: Unit canonicalization
        canonical = _ensure_quote_prices_canonical_thousand_vnd(
            normalized,
            source_provider='KBS'
        )
        
        # Verify output
        assert canonical.attrs['price_unit_canonical'] == QUOTE_UNIT_CANONICAL
        assert canonical.attrs['price_unit_source'] == 'KBS'
        
        # Verify prices are in THOUSAND_VND
        prices_output = canonical[[('match', 'match_price')]].values.flatten()
        for price in prices_output:
            if pd.notna(price):
                # Should be in range [1000-200000] for THOUSAND_VND
                assert 1000 <= price <= 200_000, f"Price {price} out of range"


class TestAdapterParseable:
    """Test parseability detection."""
    
    def test_canonical_dataframe_is_parseable(self):
        """Canonical dataframe should be parseable."""
        df = pd.DataFrame({
            ('match', 'match_price'): [26_600.0],
            ('match', 'reference_price'): [26_500.0],
            ('listing', 'symbol'): ['MBB'],
        })
        df.columns = pd.MultiIndex.from_tuples(df.columns)
        
        result = _price_board_dataframe_is_parseable(df)
        assert result is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
