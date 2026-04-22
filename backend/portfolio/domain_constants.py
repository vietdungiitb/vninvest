"""Domain-level constants and shared threshold policies."""
from __future__ import annotations

# Money unit conversion
VND_PER_MILLION = 1_000_000

# Whale advisory defaults and classification thresholds
WHALE_ALERT_DEFAULT_THRESHOLD_MILLION = 500
WHALE_ALERT_DEFAULT_THRESHOLD_VND = WHALE_ALERT_DEFAULT_THRESHOLD_MILLION * VND_PER_MILLION
WHALE_SIZE_CLASS_SHARK_MIN_VND = 5_000_000_000
WHALE_SIZE_CLASS_WHALE_MIN_VND = 1_000_000_000
SHARK_THRESHOLD_VND = WHALE_SIZE_CLASS_SHARK_MIN_VND
WHALE_THRESHOLD_VND = WHALE_SIZE_CLASS_WHALE_MIN_VND
WHALE_CONFIG_VERSION = "threshold-v1"
WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT = 6

# Order-flow thresholds
ORDER_FLOW_SMALL_ORDER_THRESHOLD_VND = 50_000_000
ORDER_FLOW_LARGE_ORDER_THRESHOLD_VND = 500_000_000
ORDER_FLOW_PRICE_LOCK_THRESHOLD_PCT = 0.003

# Order-flow value buckets (for histogram)
ORDER_FLOW_BUCKET_LT_50M_MAX_VND = 50_000_000
ORDER_FLOW_BUCKET_LT_200M_MAX_VND = 200_000_000
ORDER_FLOW_BUCKET_LT_500M_MAX_VND = 500_000_000
ORDER_FLOW_BUCKET_LT_2B_MAX_VND = 2_000_000_000


def resolve_user_whale_threshold_vnd(raw_threshold_million) -> float:
    """Convert stored threshold (in million VND) to VND with a safe fallback."""
    try:
        threshold_million = float(raw_threshold_million)
    except (TypeError, ValueError):
        threshold_million = float(WHALE_ALERT_DEFAULT_THRESHOLD_MILLION)
    if threshold_million <= 0:
        threshold_million = float(WHALE_ALERT_DEFAULT_THRESHOLD_MILLION)
    return threshold_million * VND_PER_MILLION


def classify_whale_size_class(matched_value: float) -> str:
    """Classify a matched-value event into small/whale/shark."""
    if matched_value >= WHALE_SIZE_CLASS_SHARK_MIN_VND:
        return "shark"
    if matched_value >= WHALE_SIZE_CLASS_WHALE_MIN_VND:
        return "whale"
    return "small"
