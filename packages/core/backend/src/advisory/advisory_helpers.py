"""
Advisory helpers for packages/core backend.

Includes prompt config parser & validator, and lookback window context builders.
"""
import logging
from market_data.models import DailyPrice
from market_serving.models import SessionFacts

logger = logging.getLogger(__name__)

CANONICAL_SOURCES = ("whale", "dark_flow", "technical", "news", "market", "fundamental", "ownership", "sector")
CANONICAL_INDICATORS = ("rsi", "bollinger", "vols", "prices", "ma20", "ma50", "snapshot", "cdms")

DEFAULT_LOOKBACKS = {
    "whale": 30,
    "dark_flow": 30,
    "technical": 20,
    "news": 14,
    "market": 7,
    "fundamental": 90,
    "ownership": 365,
    "sector": 20,
}

LOOKBACK_BOUNDS = {
    "whale": (1, 180),
    "dark_flow": (1, 180),
    "technical": (1, 60),
    "news": (1, 90),
    "market": (1, 30),
    "fundamental": (1, 365),
    "ownership": (1, 730),
    "sector": (1, 90),
}


def _get_default_prompt_config() -> dict:
    """Return the default canonical prompt_config v2."""
    config = {
        "version": 2,
        "sources": {}
    }
    for source in CANONICAL_SOURCES:
        source_data = {
            "enabled": True,
            "lookback": DEFAULT_LOOKBACKS[source]
        }
        if source == "technical":
            source_data["indicators"] = list(CANONICAL_INDICATORS)
        config["sources"][source] = source_data
    return config


def _parse_prompt_config(raw_config: dict | None) -> dict:
    """
    Parse and validate raw client configuration against canonical prompt_config v2 defaults.
    Clamps lookbacks and filters invalid indicators.
    """
    defaults = _get_default_prompt_config()
    if not raw_config or not isinstance(raw_config, dict):
        return defaults

    parsed = {
        "version": 2,
        "sources": {}
    }

    raw_sources = raw_config.get("sources")
    if not isinstance(raw_sources, dict):
        return defaults

    for source in CANONICAL_SOURCES:
        default_source_data = defaults["sources"][source]
        raw_source_data = raw_sources.get(source)

        if not isinstance(raw_source_data, dict):
            parsed["sources"][source] = default_source_data
            continue

        enabled = bool(raw_source_data.get("enabled", default_source_data["enabled"]))
        lookback = raw_source_data.get("lookback")
        
        # Validate and clamp lookback
        if not isinstance(lookback, int):
            lookback = default_source_data["lookback"]
        else:
            min_val, max_val = LOOKBACK_BOUNDS[source]
            lookback = max(min_val, min(max_val, lookback))

        source_data = {
            "enabled": enabled,
            "lookback": lookback
        }

        # Handle technical indicators list
        if source == "technical":
            raw_indicators = raw_source_data.get("indicators")
            if isinstance(raw_indicators, list):
                # Filter valid indicators
                valid_indicators = [
                    ind for ind in raw_indicators
                    if isinstance(ind, str) and ind.strip().lower() in CANONICAL_INDICATORS
                ]
                # If all filters removed, fallback to defaults
                if not valid_indicators:
                    source_data["indicators"] = default_source_data["indicators"]
                else:
                    source_data["indicators"] = valid_indicators
            else:
                source_data["indicators"] = default_source_data["indicators"]

        parsed["sources"][source] = source_data

    return parsed


def build_ohlcv_lookback_context(symbol: str, limit: int = 20) -> str:
    """
    Query the last N (default 20) DailyPrice rows and return a formatted markdown context table.
    """
    symbol = symbol.strip().upper()
    prices = DailyPrice.objects.filter(symbol=symbol).order_by('-date')[:limit]
    prices = list(reversed(prices))

    if not prices:
        return "Không có dữ liệu OHLCV lịch sử."

    context = f"Lịch sử biến động giá (OHLCV) của {symbol} trong {len(prices)} phiên gần nhất:\n"
    context += "| Ngày | Giá mở cửa | Giá cao nhất | Giá thấp nhất | Giá đóng cửa | Khối lượng khớp |\n"
    context += "| --- | --- | --- | --- | --- | --- |\n"
    for p in prices:
        # Check high/low/open/close fields
        p_open = getattr(p, 'open_price', None) or getattr(p, 'open', 0.0)
        p_high = getattr(p, 'high_price', None) or getattr(p, 'high', 0.0)
        p_low = getattr(p, 'low_price', None) or getattr(p, 'low', 0.0)
        p_close = getattr(p, 'close_price', None) or getattr(p, 'close', 0.0)
        p_vol = getattr(p, 'volume', 0)
        
        context += f"| {p.date} | {float(p_open):,.0f} | {float(p_high):,.0f} | {float(p_low):,.0f} | {float(p_close):,.0f} | {int(p_vol):,} |\n"
    return context


def build_cvd_lookback_context(symbol: str, limit: int = 20) -> str:
    """
    Query the last N (default 20) SessionFacts rows and return a formatted markdown context table.
    """
    symbol = symbol.strip().upper()
    facts = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date')[:limit]
    facts = list(reversed(facts))

    if not facts:
        return "Không có dữ liệu dòng tiền lớn lịch sử."

    context = f"Lịch sử chỉ số CVD và dòng tiền Cá mập của {symbol} trong {len(facts)} phiên gần nhất:\n"
    context += "| Ngày | CVD Normalized | Lực mua ròng % | Cường độ tổ chức % | Cá mập ròng (VND) |\n"
    context += "| --- | --- | --- | --- | --- |\n"
    for f in facts:
        cvd = float(getattr(f, 'cvd_normalized', 0.0) or 0.0)
        buy_str = float(getattr(f, 'buy_strength', 0.0) or 0.0) * 100
        inst_str = float(getattr(f, 'institutional_strength', 0.0) or 0.0) * 100
        whale_flow = float(getattr(f, 'whale_net_flow', 0.0) or 0.0)
        
        context += f"| {f.session_date} | {cvd:.3f} | {buy_str:.1f}% | {inst_str:.1f}% | {whale_flow:,.0f} |\n"
    return context
