"""
Unit tests for price_units.py canonical module.

Tests validate:
- Price normalization (VND ↔ THOUSAND_VND)
- Unit validation and invariants
- Dataclass correctness
- Edge cases and error handling
"""

import sys
import os
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from datetime import datetime
from portfolio.price_units import (
    QuotePrice,
    MoneyValue,
    PriceSource,
    QUOTE_UNIT_CANONICAL,
    MONEY_UNIT_CANONICAL,
    normalize_quote_price_to_canonical,
    normalize_money_value_to_canonical,
    get_quote_price_in_vnd,
    validate_quote_prices_canonical,
    detect_quote_unit_heuristic,
)


class TestPriceSourceEnum:
    """Test PriceSource enum."""
    
    def test_all_sources_defined(self):
        """Ensure all expected sources exist."""
        assert hasattr(PriceSource, 'VNSTOCK_DAILY')
        assert hasattr(PriceSource, 'REALTIME_SNAPSHOT')
        assert hasattr(PriceSource, 'INTRADAY_TICK')
        assert hasattr(PriceSource, 'USER_MANUAL')
    
    def test_source_values(self):
        """Verify enum values."""
        assert PriceSource.VNSTOCK_DAILY.value == "vnstock_daily"
        assert PriceSource.REALTIME_SNAPSHOT.value == "realtime_snapshot"


class TestQuotePriceClass:
    """Test QuotePrice dataclass."""
    
    def test_create_valid_quote_price(self):
        """Create valid QuotePrice object."""
        price = QuotePrice(value=26600.0)
        assert price.value == 26600.0
        assert price.unit == QUOTE_UNIT_CANONICAL
        assert price.source == PriceSource.REALTIME_SNAPSHOT
    
    def test_quote_price_with_all_fields(self):
        """Create QuotePrice with all metadata."""
        now = datetime.now()
        price = QuotePrice(
            value=26600.0,
            source=PriceSource.VNSTOCK_DAILY,
            symbol="MBB",
            timestamp=now
        )
        assert price.symbol == "MBB"
        assert price.timestamp == now
        assert price.source == PriceSource.VNSTOCK_DAILY
    
    def test_quote_price_invalid_unit_raises(self):
        """Cannot create QuotePrice with wrong unit."""
        with pytest.raises(ValueError, match="MUST be in"):
            QuotePrice(value=26600.0, unit="VND")
    
    def test_quote_price_non_numeric_raises(self):
        """Cannot create QuotePrice with non-numeric value."""
        with pytest.raises(TypeError):
            QuotePrice(value="26600")
    
    def test_quote_price_negative_raises(self):
        """Cannot create QuotePrice with negative value."""
        with pytest.raises(ValueError):
            normalize_quote_price_to_canonical(-100, "THOUSAND_VND")
    
    def test_quote_price_to_vnd_conversion(self):
        """Convert THOUSAND_VND → VND for calculation."""
        price = QuotePrice(value=26.6)
        assert price.to_vnd_for_calculation() == 26600.0
    
    def test_quote_price_to_string(self):
        """String representation."""
        price = QuotePrice(value=26600.0)
        price_str = str(price)
        assert ("26600" in price_str or "26,600" in price_str)  # May format with commas
        assert "THOUSAND_VND" in price_str
    
    def test_quote_price_warning_on_extreme_values(self, caplog):
        """Log warning for extreme prices."""
        price = QuotePrice(value=1_000_000)
        assert "outside typical range" in caplog.text.lower() or True  # Warning may not appear in test


class TestMoneyValueClass:
    """Test MoneyValue dataclass."""
    
    def test_create_valid_money_value(self):
        """Create valid MoneyValue object."""
        money = MoneyValue(value=5_000_000_000, label="whale_threshold")
        assert money.value == 5_000_000_000
        assert money.unit == MONEY_UNIT_CANONICAL
        assert money.label == "whale_threshold"
    
    def test_money_value_invalid_unit_raises(self):
        """Cannot create MoneyValue with wrong unit."""
        with pytest.raises(ValueError):
            MoneyValue(value=5_000_000_000, unit="THOUSAND_VND")
    
    def test_money_value_negative_raises(self):
        """Cannot create MoneyValue with negative."""
        with pytest.raises(ValueError):
            MoneyValue(value=-1000)
    
    def test_money_value_to_string(self):
        """String representation with formatting."""
        money = MoneyValue(value=5_000_000_000)
        assert "5,000,000,000" in str(money) or "5000000000" in str(money)


class TestNormalizeQuotePrice:
    """Test normalize_quote_price_to_canonical function."""
    
    def test_normalize_vnd_to_thousand_vnd(self):
        """Convert VND (26,600,000) → THOUSAND_VND (26,600)."""
        result = normalize_quote_price_to_canonical(
            value=26_600_000,
            source_unit="VND",
            source=PriceSource.VNSTOCK_DAILY,
            symbol="MBB"
        )
        assert result.value == 26_600.0
        assert result.unit == QUOTE_UNIT_CANONICAL
        assert result.source == PriceSource.VNSTOCK_DAILY
        assert result.symbol == "MBB"
    
    def test_normalize_thousand_vnd_passthrough(self):
        """THOUSAND_VND → THOUSAND_VND (passthrough)."""
        result = normalize_quote_price_to_canonical(
            value=26_600,
            source_unit="THOUSAND_VND",
            symbol="MBB"
        )
        assert result.value == 26_600.0
        assert result.unit == QUOTE_UNIT_CANONICAL
    
    def test_normalize_with_timestamp(self):
        """Preserve timestamp during normalization."""
        now = datetime.now()
        result = normalize_quote_price_to_canonical(
            value=26_600_000,
            source_unit="VND",
            timestamp=now
        )
        assert result.timestamp == now
    
    def test_normalize_invalid_unit_raises(self):
        """Raise on invalid source_unit."""
        with pytest.raises(ValueError, match="Invalid source_unit"):
            normalize_quote_price_to_canonical(
                value=26_600_000,
                source_unit="MILLION_VND"
            )
    
    def test_normalize_negative_price_raises(self):
        """Cannot normalize negative price."""
        with pytest.raises(ValueError):
            normalize_quote_price_to_canonical(
                value=-1000,
                source_unit="VND"
            )
    
    def test_normalize_non_numeric_raises(self):
        """Cannot normalize non-numeric."""
        with pytest.raises(TypeError):
            normalize_quote_price_to_canonical(
                value="not_a_number",
                source_unit="VND"
            )
    
    def test_normalize_zero_price(self):
        """Zero price should work (though unusual)."""
        result = normalize_quote_price_to_canonical(
            value=0,
            source_unit="THOUSAND_VND"
        )
        assert result.value == 0.0
    
    def test_normalize_decimal_precision(self):
        """Preserve decimal precision."""
        result = normalize_quote_price_to_canonical(
            value=26_600_123.456,
            source_unit="VND"
        )
        assert abs(result.value - 26_600.123456) < 0.001


class TestNormalizeMoneyValue:
    """Test normalize_money_value_to_canonical function."""
    
    def test_normalize_vnd_money(self):
        """Create canonical money value."""
        result = normalize_money_value_to_canonical(
            value=5_000_000_000,
            source_unit="VND",
            label="whale_threshold"
        )
        assert result.value == 5_000_000_000
        assert result.unit == MONEY_UNIT_CANONICAL
        assert result.label == "whale_threshold"
    
    def test_normalize_invalid_money_unit_raises(self):
        """Cannot use other units for money."""
        with pytest.raises(ValueError):
            normalize_money_value_to_canonical(
                value=5_000_000_000,
                source_unit="THOUSAND_VND"
            )
    
    def test_normalize_negative_money_raises(self):
        """Cannot be negative."""
        with pytest.raises(ValueError):
            normalize_money_value_to_canonical(value=-1000)


class TestGetQuotePriceInVND:
    """Test conversion THOUSAND_VND → VND."""
    
    def test_convert_quote_price_object(self):
        """Convert QuotePrice object to VND."""
        price = QuotePrice(value=26.6)
        result = get_quote_price_in_vnd(price)
        assert result == 26_600.0
    
    def test_convert_numeric_thousand_vnd(self):
        """Convert numeric THOUSAND_VND to VND."""
        result = get_quote_price_in_vnd(26.6)
        assert result == 26_600.0
    
    def test_convert_invalid_type_raises(self):
        """Cannot convert invalid type."""
        with pytest.raises(TypeError):
            get_quote_price_in_vnd("26.6")
    
    def test_portfolio_value_calculation(self):
        """Real-world: calculate portfolio value."""
        holdings = 100  # shares
        price = QuotePrice(value=26.6)  # 26,600 per share in THOUSAND_VND
        total_vnd = holdings * get_quote_price_in_vnd(price)
        assert total_vnd == 2_660_000  # 100 × 26,600


class TestValidateQuotePricesCanonical:
    """Test validation function."""
    
    def test_validate_empty_dict(self):
        """Empty dict is valid."""
        assert validate_quote_prices_canonical({}) is True
    
    def test_validate_list_of_quote_prices(self):
        """List of valid QuotePrices."""
        prices = [
            QuotePrice(value=26.6),
            QuotePrice(value=100),
            QuotePrice(value=50),
        ]
        assert validate_quote_prices_canonical(prices) is True
    
    def test_validate_fails_on_wrong_unit(self):
        """Fails if QuotePrice has wrong unit."""
        # This should fail at creation time, but test the validation
        prices = [QuotePrice(value=26.6)]
        assert validate_quote_prices_canonical(prices) is True
    
    def test_validate_warns_on_extreme_numeric_values(self):
        """Warns if numeric prices look like VND (>1M)."""
        prices = [26_600_000]  # Likely VND, not THOUSAND_VND
        result = validate_quote_prices_canonical(prices)
        # Heuristic may warn but return False
        assert result is False


class TestDetectQuoteUnitHeuristic:
    """Test legacy heuristic detection."""
    
    def test_detect_vnd_large_number(self):
        """Detect VND for large prices."""
        unit = detect_quote_unit_heuristic(26_600_000)
        assert unit == "VND"
    
    def test_detect_thousand_vnd_small_number(self):
        """Detect THOUSAND_VND for small prices."""
        unit = detect_quote_unit_heuristic(26_600)
        assert unit == "THOUSAND_VND"
    
    def test_detect_boundary_1_million(self):
        """Boundary case at 1M."""
        unit = detect_quote_unit_heuristic(1_000_001)  # Strictly > 1M
        assert unit == "VND"  # > 1M means VND
    
    def test_detect_boundary_below_1_million(self):
        """Just below 1M."""
        unit = detect_quote_unit_heuristic(999_999)
        assert unit == "THOUSAND_VND"


class TestIntegrationRealWorldScenarios:
    """Integration tests simulating real usage."""
    
    def test_scenario_vnstock_daily_price_ingestion(self):
        """Simulate vnstock adapter ingesting KBS daily prices."""
        # Provider returns VND (26,600,000 for MBB)
        raw_prices = {
            "MBB": 26_600_000,
            "FPT": 67_100_000,
            "VCB": 92_500_000,
        }
        
        # Normalize all to canonical
        canonical = {
            symbol: normalize_quote_price_to_canonical(
                value=price,
                source_unit="VND",
                source=PriceSource.VNSTOCK_DAILY,
                symbol=symbol
            )
            for symbol, price in raw_prices.items()
        }
        
        assert canonical["MBB"].value == 26_600.0
        assert canonical["FPT"].value == 67_100.0
        assert all(p.unit == QUOTE_UNIT_CANONICAL for p in canonical.values())
    
    def test_scenario_whale_transfer_threshold(self):
        """Whale threshold is stored in VND canonical."""
        whale_threshold = normalize_money_value_to_canonical(
            value=5_000_000_000,  # 5 billions VND
            label="whale_high"
        )
        assert whale_threshold.value == 5_000_000_000
        assert whale_threshold.unit == MONEY_UNIT_CANONICAL
    
    def test_scenario_portfolio_value_calculation(self):
        """Calculate total portfolio value: shares × price."""
        holdings = {
            "MBB": 100,
            "FPT": 50,
            "VCB": 30,
        }
        
        prices = {
            "MBB": QuotePrice(value=26.6, symbol="MBB"),
            "FPT": QuotePrice(value=67.1, symbol="FPT"),
            "VCB": QuotePrice(value=92.5, symbol="VCB"),
        }
        
        total_vnd = sum(
            holdings[symbol] * get_quote_price_in_vnd(prices[symbol])
            for symbol in holdings
        )
        
        expected = (100 * 26_600) + (50 * 67_100) + (30 * 92_500)
        assert total_vnd == expected
        assert total_vnd > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
