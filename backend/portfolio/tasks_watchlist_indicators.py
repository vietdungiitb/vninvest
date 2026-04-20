"""
portfolio/tasks_watchlist_indicators.py
Celery task chạy mỗi 10 giây để tính RSI(14), MA20, RVOL
cho tất cả symbol đang được theo dõi, cache vào Redis.

Cache key pattern: watchlist_indicator:{SYMBOL}
Cache TTL: 60 giây (fallback an toàn khi task bị delay)
"""
from __future__ import annotations

import json
import logging

import pandas as pd
from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger(__name__)

INDICATOR_CACHE_TTL = 60  # seconds
INDICATOR_CACHE_PREFIX = "watchlist_indicator"
MIN_RSI_PERIODS = 15      # Cần ít nhất 15 rows để tính RSI(14)
MA20_PERIODS = 20
RVOL_LOOKBACK = 20        # Số phiên để tính avg volume


def _rsi(series: pd.Series, period: int = 14) -> float | None:
    """RSI Wilder smoothing. Trả về float 0-100 hoặc None nếu dữ liệu không đủ."""
    if len(series) < period + 1:
        return None
    delta = series.diff().dropna()
    up = delta.clip(lower=0)
    down = -delta.clip(upper=0)
    # Wilder smoothed moving average
    avg_up = up.ewm(alpha=1 / period, adjust=False).mean().iloc[-1]
    avg_down = down.ewm(alpha=1 / period, adjust=False).mean().iloc[-1]
    if avg_down == 0:
        return 100.0
    rs = avg_up / avg_down
    return round(100 - (100 / (1 + rs)), 2)


def _ma20_dist_pct(series: pd.Series, current_price: float) -> float | None:
    """Khoảng cách % giữa giá hiện tại và MA20. Dương = trên MA, âm = dưới MA."""
    if len(series) < MA20_PERIODS or current_price <= 0:
        return None
    ma20 = series.tail(MA20_PERIODS).mean()
    if ma20 <= 0:
        return None
    return round((current_price - ma20) / ma20 * 100, 2)


def _rvol(volumes: pd.Series) -> float | None:
    """Relative Volume = last session volume / avg(last 20 sessions volume)."""
    if len(volumes) < RVOL_LOOKBACK + 1:
        return None
    last_vol = volumes.iloc[-1]
    avg_vol = volumes.iloc[-(RVOL_LOOKBACK + 1):-1].mean()
    if avg_vol <= 0:
        return None
    return round(last_vol / avg_vol, 2)


def compute_indicators_for_symbol(symbol: str) -> dict | None:
    """
    Truy vấn DailyPrice cho một symbol, tính toán indicators.
    Trả về dict {'rsi_14', 'ma20_dist_pct', 'rvol', 'indicator_ts'} hoặc None.
    """
    from portfolio.models import DailyPrice  # deferred import (Django apps loaded)

    try:
        qs = (
            DailyPrice.objects.filter(symbol=symbol)
            .order_by("date")
            .values_list("date", "close_price", "volume")
        )
        rows = list(qs[: -(MIN_RSI_PERIODS + RVOL_LOOKBACK + 5)])  # limit query size
        # Re-fetch fresh with enough rows
        rows = list(
            DailyPrice.objects.filter(symbol=symbol)
            .order_by("date")
            .values_list("date", "close_price", "volume")
        )
        if len(rows) < MIN_RSI_PERIODS:
            return None

        df = pd.DataFrame(rows, columns=["date", "close_price", "volume"])
        df["close_price"] = pd.to_numeric(df["close_price"], errors="coerce")
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
        df = df.dropna(subset=["close_price"])

        if len(df) < MIN_RSI_PERIODS:
            return None

        close = df["close_price"]
        current_price = float(close.iloc[-1])

        rsi = _rsi(close)
        ma_dist = _ma20_dist_pct(close, current_price)
        rvol = _rvol(df["volume"])

        return {
            "rsi_14": rsi,
            "ma20_dist_pct": ma_dist,
            "rvol": rvol,
            "indicator_ts": pd.Timestamp.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.warning("compute_indicators_for_symbol(%s): %s", symbol, exc)
        return None


def get_cached_indicators(symbol: str) -> dict:
    """Lấy indicators từ Redis cache. Trả về empty dict nếu chưa có."""
    cache_key = f"{INDICATOR_CACHE_PREFIX}:{symbol.upper()}"
    raw = cache.get(cache_key)
    if not raw:
        return {}
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return {}


@shared_task(name="portfolio.compute_watchlist_indicators", bind=True, max_retries=0)
def compute_watchlist_indicators(self):
    """
    Tính và cache indicators cho tất cả symbol đang được theo dõi.
    Chạy mỗi 10 giây theo Celery Beat.
    """
    from portfolio.models import TrackedSymbol

    try:
        symbols = list(
            TrackedSymbol.objects.values_list("symbol", flat=True).distinct()
        )
    except Exception as exc:
        logger.error("compute_watchlist_indicators: cannot load TrackedSymbol: %s", exc)
        return {"status": "error", "detail": str(exc)}

    if not symbols:
        return {"status": "ok", "computed": 0}

    computed = 0
    for symbol in symbols:
        result = compute_indicators_for_symbol(symbol)
        if result is not None:
            cache_key = f"{INDICATOR_CACHE_PREFIX}:{symbol.upper()}"
            cache.set(cache_key, json.dumps(result), timeout=INDICATOR_CACHE_TTL)
            computed += 1

    logger.debug(
        "compute_watchlist_indicators: computed %d/%d symbols", computed, len(symbols)
    )
    return {"status": "ok", "computed": computed, "total": len(symbols)}
