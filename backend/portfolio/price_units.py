"""
Price Unit Standardization Module

This module provides a canonical standard for all price units across the system.
All quote prices (stock prices) MUST be in THOUSAND_VND (e.g., MBB = 26,600).
All money values (transactions, whale thresholds) MUST be in VND (e.g., 5 billion).

This eliminates the need for frontend heuristics and ensures data consistency.
"""

from enum import Enum
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Union
import logging

logger = logging.getLogger(__name__)

# ==================== CANONICAL UNIT CONSTANTS ====================

QUOTE_UNIT_CANONICAL = "THOUSAND_VND"  # For all quote prices (26,600 for MBB)
MONEY_UNIT_CANONICAL = "VND"           # For transaction/whale threshold values (5,000,000,000)

# Valid source units (what providers may send)
VALID_QUOTE_UNITS = ["VND", "THOUSAND_VND"]
VALID_MONEY_UNITS = ["VND"]


# ==================== ENUMS ====================

class PriceSource(Enum):
    """Source identifier for price data traceability."""
    VNBROKER_DAILY = "vnbroker_daily"           # EOD historical prices from vnbroker
    REALTIME_SNAPSHOT = "realtime_snapshot"   # Realtime market snapshot quote
    INTRADAY_TICK = "intraday_tick"          # Per-minute or per-tick intraday price
    USER_MANUAL = "user_manual"              # User-entered manual price


# ==================== DATACLASSES ====================

@dataclass
class QuotePrice:
    """Typed price value with unit and source metadata.
    
    Guarantees: value is always in THOUSAND_VND canonical.
    """
    value: float
    unit: str = QUOTE_UNIT_CANONICAL
    source: PriceSource = PriceSource.REALTIME_SNAPSHOT
    timestamp: Optional[datetime] = None
    symbol: Optional[str] = None
    
    def __post_init__(self):
        """Validate invariants."""
        if self.unit != QUOTE_UNIT_CANONICAL:
            raise ValueError(
                f"QuotePrice MUST be in {QUOTE_UNIT_CANONICAL} canonical. "
                f"Got {self.unit}. Use normalize_quote_price_to_canonical() first."
            )
        if not isinstance(self.value, (int, float)):
            raise TypeError(f"QuotePrice.value must be numeric. Got {type(self.value)}")
        
        # Sanity check: quote prices should be in reasonable range
        # VN stock prices typically 1,000 - 200,000 VND (1 - 200 THOUSAND_VND)
        if self.value < 0.5 or self.value > 500_000:
            logger.warning(
                f"QuotePrice {self.symbol}={self.value} {self.unit} is outside typical range [1-200k]"
            )
    
    def to_vnd_for_calculation(self) -> float:
        """Convert this THOUSAND_VND price to VND for monetary calculations.
        
        Example: If holding 100 shares at QuotePrice(26.6), total value = 2,660,000 VND.
        """
        return self.value * 1000
    
    def __str__(self) -> str:
        return f"{self.value:,.2f} {self.unit}"


@dataclass  
class MoneyValue:
    """Transaction or threshold value guaranteed in VND canonical."""
    value: float
    unit: str = MONEY_UNIT_CANONICAL
    label: Optional[str] = None
    
    def __post_init__(self):
        if self.unit != MONEY_UNIT_CANONICAL:
            raise ValueError(f"MoneyValue MUST be in {MONEY_UNIT_CANONICAL}")
        if not isinstance(self.value, (int, float)):
            raise TypeError(f"MoneyValue.value must be numeric")
        if self.value < 0:
            raise ValueError("MoneyValue cannot be negative")
    
    def __str__(self) -> str:
        return f"{self.value:,.0f} {self.unit}"


# ==================== CONVERSION FUNCTIONS ====================

def normalize_quote_price_to_canonical(
    value: float,
    source_unit: str,
    source: PriceSource = PriceSource.REALTIME_SNAPSHOT,
    symbol: Optional[str] = None,
    timestamp: Optional[datetime] = None
) -> QuotePrice:
    """Convert any quote price to THOUSAND_VND canonical.
    
    Args:
        value: Raw price value from provider
        source_unit: Unit of raw value ("VND" or "THOUSAND_VND")
        source: Source identifier for traceability
        symbol: Optional stock symbol for context
        timestamp: Optional timestamp of price
    
    Returns:
        QuotePrice object in THOUSAND_VND canonical
    
    Raises:
        ValueError: If source_unit invalid or value negative
    
    Examples:
        >>> normalize_quote_price_to_canonical(26_600_000, "VND", source=PriceSource.VNBROKER_DAILY, symbol="MBB")
        QuotePrice(value=26600.0, unit='THOUSAND_VND', source=<PriceSource.VNBROKER_DAILY>, symbol='MBB')
        
        >>> normalize_quote_price_to_canonical(26_600, "THOUSAND_VND", symbol="MBB")
        QuotePrice(value=26600.0, unit='THOUSAND_VND', symbol='MBB')
    """
    if source_unit not in VALID_QUOTE_UNITS:
        raise ValueError(
            f"Invalid source_unit '{source_unit}'. Must be one of {VALID_QUOTE_UNITS}"
        )
    
    if not isinstance(value, (int, float)):
        raise TypeError(f"Price value must be numeric. Got {type(value)}")
    
    if value < 0:
        raise ValueError(f"Price cannot be negative. Got {value}")
    
    # Convert to canonical THOUSAND_VND
    canonical_value = value
    if source_unit == "VND":
        canonical_value = value / 1000
    
    return QuotePrice(
        value=canonical_value,
        unit=QUOTE_UNIT_CANONICAL,
        source=source,
        symbol=symbol,
        timestamp=timestamp
    )


def normalize_money_value_to_canonical(
    value: float,
    source_unit: str = "VND",
    label: Optional[str] = None
) -> MoneyValue:
    """Convert money value to VND canonical.
    
    Args:
        value: Raw money amount
        source_unit: Unit of raw value (typically "VND")
        label: Optional description (e.g., "whale_threshold", "transaction_fee")
    
    Returns:
        MoneyValue object in VND canonical
    
    Raises:
        ValueError: If invalid unit or negative value
    """
    if source_unit not in VALID_MONEY_UNITS:
        raise ValueError(f"Invalid money unit '{source_unit}'. Must be {VALID_MONEY_UNITS}")
    
    if not isinstance(value, (int, float)):
        raise TypeError(f"Money value must be numeric. Got {type(value)}")
    
    if value < 0:
        raise ValueError(f"Money value cannot be negative. Got {value}")
    
    return MoneyValue(
        value=value,
        unit=MONEY_UNIT_CANONICAL,
        label=label
    )


def get_quote_price_in_vnd(quote_price: Union[QuotePrice, float]) -> float:
    """Convert THOUSAND_VND quote price to VND for calculation purposes.
    
    Useful when calculating total portfolio value from share count × price.
    
    Args:
        quote_price: QuotePrice object or numeric value in THOUSAND_VND
    
    Returns:
        Price in VND
    
    Example:
        >>> holdings = 100 shares
        >>> price = QuotePrice(26.6)  # 26,600 THOUSAND_VND per unit
        >>> total_vnd = holdings * get_quote_price_in_vnd(price)
        >>> print(total_vnd)  # 2,660,000 VND
    """
    if isinstance(quote_price, QuotePrice):
        return quote_price.to_vnd_for_calculation()
    elif isinstance(quote_price, (int, float)):
        return quote_price * 1000
    else:
        raise TypeError(f"Expected QuotePrice or numeric. Got {type(quote_price)}")


def validate_quote_prices_canonical(prices: dict, symbol: Optional[str] = None) -> bool:
    """Validate that all prices in a dict/dataframe are in canonical format.
    
    Args:
        prices: Dict of symbol→price or could be checked
        symbol: Optional symbol to focus on
    
    Returns:
        True if all prices appear to be THOUSAND_VND canonical
    
    Logic:
        - Prices should be in range [1, 200_000] for THOUSAND_VND
        - If any price > 1_000_000, likely VND (not canonical)
    """
    if not prices:
        return True
    
    price_list = prices.values() if isinstance(prices, dict) else prices
    
    for price in price_list:
        if isinstance(price, QuotePrice):
            if price.unit != QUOTE_UNIT_CANONICAL:
                logger.error(f"Price has wrong unit: {price.unit}")
                return False
        elif isinstance(price, (int, float)):
            # Heuristic: if price > 1M, likely not canonical
            if price > 1_000_000:
                logger.warning(f"Price {price} exceeds 1M, may not be THOUSAND_VND canonical")
                return False
    
    return True


# ==================== LEGACY COMPATIBILITY ====================

def detect_quote_unit_heuristic(price_value: float) -> str:
    """DEPRECATED: Heuristic unit detection (fallback only).
    
    USE normalize_quote_price_to_canonical() instead with explicit source_unit.
    
    Args:
        price_value: Raw price to infer unit from
    
    Returns:
        "VND" if price > 1_000_000 (likely full VND)
        "THOUSAND_VND" if price <= 1_000_000 (likely already divided)
    
    WARNING: This is a heuristic and may be wrong for edge cases.
    Prices should always be explicitly tagged with source unit.
    """
    logger.warning(
        "Using heuristic unit detection. Set explicit source_unit instead."
    )
    if price_value > 1_000_000:
        return "VND"
    return "THOUSAND_VND"
