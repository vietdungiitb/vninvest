"""
Order Flow Engine — Sprint 15
Phát hiện dòng tiền ẩn: iceberg orders, TWAP bots, smart money absorption.

Tất cả hàm đều pure/side-effect-free trừ compute_tick_rate (dùng cache)
và detect_dark_flow (gọi compute_tick_rate + query DB).
"""
from __future__ import annotations

import math
import statistics
from datetime import date, datetime, time, timedelta, timezone
from typing import Sequence

from django.core.cache import cache
from django.db.models import QuerySet

from .domain_constants import (
    ORDER_FLOW_BUCKET_LT_200M_MAX_VND,
    ORDER_FLOW_BUCKET_LT_2B_MAX_VND,
    ORDER_FLOW_BUCKET_LT_500M_MAX_VND,
    ORDER_FLOW_BUCKET_LT_50M_MAX_VND,
    ORDER_FLOW_LARGE_ORDER_THRESHOLD_VND,
    ORDER_FLOW_PRICE_LOCK_THRESHOLD_PCT,
    ORDER_FLOW_SMALL_ORDER_THRESHOLD_VND,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SMALL_ORDER_THRESHOLD = ORDER_FLOW_SMALL_ORDER_THRESHOLD_VND
LARGE_ORDER_THRESHOLD = ORDER_FLOW_LARGE_ORDER_THRESHOLD_VND
PRICE_LOCK_THRESHOLD_PCT = ORDER_FLOW_PRICE_LOCK_THRESHOLD_PCT
DEFAULT_WINDOW_MINUTES = 60
DEFAULT_BUCKET_SECONDS = 60
TICK_RATE_CACHE_TTL = 10                # giây


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now_time() -> time:
    return datetime.now(timezone.utc).time()


def _time_to_seconds(t: time) -> int:
    """Chuyển time object sang tổng số giây kể từ 00:00."""
    return t.hour * 3600 + t.minute * 60 + t.second


def _fetch_ticks(symbol: str, window_minutes: int) -> list[dict]:
    """
    Query IntradayTick trong window_minutes gần nhất, trả về list[dict].
    Tránh import vòng: import model tại runtime.
    """
    from portfolio.models import IntradayTick  # noqa: PLC0415

    today = _today()
    now_secs = _time_to_seconds(_now_time())
    cutoff_secs = now_secs - window_minutes * 60

    qs: QuerySet = IntradayTick.objects.filter(
        symbol=symbol,
        trade_date=today,
    ).values("trade_time", "price", "volume", "side")

    result = []
    for row in qs:
        t_secs = _time_to_seconds(row["trade_time"])
        if t_secs >= cutoff_secs:
            result.append({
                "trade_time": row["trade_time"],
                "price": float(row["price"]),
                "volume": int(row["volume"]),
                "side": row["side"],
                "value": float(row["price"]) * int(row["volume"]),
            })
    return result


def _bucket_index(trade_time: time, bucket_seconds: int) -> int:
    """Trả về bucket index cho một trade_time."""
    secs = _time_to_seconds(trade_time)
    return secs // bucket_seconds


# ---------------------------------------------------------------------------
# S15-01 — CVD Series
# ---------------------------------------------------------------------------

def compute_cvd_series(
    symbol: str,
    window_minutes: int = DEFAULT_WINDOW_MINUTES,
    bucket_seconds: int = DEFAULT_BUCKET_SECONDS,
) -> list[dict]:
    """
    Trả về list[{bucket_ts, buy_value, sell_value, cvd, cumulative_cvd}].
    CVD = buy_value - sell_value trong mỗi bucket.
    cumulative_cvd = tổng tích luỹ từ đầu cửa sổ.
    Side UNKNOWN chia đôi: 50% buy / 50% sell.
    """
    ticks = _fetch_ticks(symbol, window_minutes)
    if not ticks:
        return []

    buckets: dict[int, dict] = {}
    for tick in ticks:
        idx = _bucket_index(tick["trade_time"], bucket_seconds)
        if idx not in buckets:
            buckets[idx] = {"buy_value": 0.0, "sell_value": 0.0, "bucket_idx": idx}
        b = buckets[idx]
        val = tick["value"]
        side = tick["side"]
        if side == "BUY":
            b["buy_value"] += val
        elif side == "SELL":
            b["sell_value"] += val
        else:  # UNKNOWN — split 50/50
            b["buy_value"] += val * 0.5
            b["sell_value"] += val * 0.5

    # Sắp xếp theo bucket_idx tăng dần
    sorted_buckets = sorted(buckets.values(), key=lambda x: x["bucket_idx"])

    # Tính bucket_ts (ISO string) và cvd
    today = _today()
    result = []
    cumulative = 0.0
    for b in sorted_buckets:
        secs = b["bucket_idx"] * bucket_seconds
        bucket_time = (
            datetime.combine(today, time(0, 0))
            + timedelta(seconds=secs)
        )
        cvd = b["buy_value"] - b["sell_value"]
        cumulative += cvd
        result.append({
            "bucket_ts": bucket_time.isoformat(),
            "buy_value": round(b["buy_value"], 2),
            "sell_value": round(b["sell_value"], 2),
            "cvd": round(cvd, 2),
            "cumulative_cvd": round(cumulative, 2),
        })
    return result


# ---------------------------------------------------------------------------
# S15-02 — Tick Rate
# ---------------------------------------------------------------------------

def compute_tick_rate(
    symbol: str,
    window_seconds: int = 60,
) -> dict:
    """
    Trả {tick_rate_per_min, small_order_count, small_order_ratio, window_seconds}.
    small_order = tick có value < SMALL_ORDER_THRESHOLD (50 triệu VNĐ).
    Dùng cache Redis 10s để không đọc DB liên tục.
    """
    cache_key = f"order_flow:tick_rate:{symbol}:{window_seconds}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    from portfolio.models import IntradayTick  # noqa: PLC0415

    today = _today()
    now_secs = _time_to_seconds(_now_time())
    cutoff_secs = max(0, now_secs - window_seconds)

    qs = IntradayTick.objects.filter(
        symbol=symbol,
        trade_date=today,
    ).values("trade_time", "price", "volume")

    total = 0
    small = 0
    for row in qs:
        t_secs = _time_to_seconds(row["trade_time"])
        if t_secs >= cutoff_secs:
            total += 1
            val = float(row["price"]) * int(row["volume"])
            if val < SMALL_ORDER_THRESHOLD:
                small += 1

    tick_rate = total * (60.0 / window_seconds) if window_seconds > 0 else 0.0
    small_ratio = (small / total) if total > 0 else 0.0

    result = {
        "tick_rate_per_min": round(tick_rate, 2),
        "small_order_count": small,
        "total_count": total,
        "small_order_ratio": round(small_ratio, 4),
        "window_seconds": window_seconds,
    }
    cache.set(cache_key, result, TICK_RATE_CACHE_TTL)
    return result


# ---------------------------------------------------------------------------
# S15-03 — Size Distribution
# ---------------------------------------------------------------------------

def compute_size_distribution(
    symbol: str,
    ticks: list[dict],
) -> dict:
    """
    Trả {avg_value, median_value, p95_value, small_ratio, large_ratio, bucket_histogram}.
    Tham số symbol dùng cho logging, không query DB thêm.
    """
    if not ticks:
        return {
            "avg_value": 0.0,
            "median_value": 0.0,
            "p95_value": 0.0,
            "small_ratio": 0.0,
            "large_ratio": 0.0,
            "bucket_histogram": {
                "<50m": 0, "50-200m": 0, "200-500m": 0, "500m-2b": 0, ">2b": 0,
            },
            "total_ticks": 0,
        }

    values = [t["value"] for t in ticks]
    values_sorted = sorted(values)
    n = len(values)

    avg_value = statistics.mean(values)
    median_value = statistics.median(values)

    # P95: lấy phần tử ở vị trí floor(0.95 * n)
    p95_idx = min(int(math.floor(0.95 * n)), n - 1)
    p95_value = values_sorted[p95_idx]

    small = sum(1 for v in values if v < SMALL_ORDER_THRESHOLD)
    large = sum(1 for v in values if v >= LARGE_ORDER_THRESHOLD)

    histogram = {
        "<50m": 0, "50-200m": 0, "200-500m": 0, "500m-2b": 0, ">2b": 0,
    }
    for v in values:
        if v < ORDER_FLOW_BUCKET_LT_50M_MAX_VND:
            histogram["<50m"] += 1
        elif v < ORDER_FLOW_BUCKET_LT_200M_MAX_VND:
            histogram["50-200m"] += 1
        elif v < ORDER_FLOW_BUCKET_LT_500M_MAX_VND:
            histogram["200-500m"] += 1
        elif v < ORDER_FLOW_BUCKET_LT_2B_MAX_VND:
            histogram["500m-2b"] += 1
        else:
            histogram[">2b"] += 1

    return {
        "avg_value": round(avg_value, 2),
        "median_value": round(median_value, 2),
        "p95_value": round(p95_value, 2),
        "small_ratio": round(small / n, 4),
        "large_ratio": round(large / n, 4),
        "bucket_histogram": histogram,
        "total_ticks": n,
    }


# ---------------------------------------------------------------------------
# S15-04 — Absorption Detection
# ---------------------------------------------------------------------------

def detect_absorption(
    symbol: str,
    cvd_series: list[dict],
    price_series: Sequence[float],
    min_buckets: int = 3,
) -> dict:
    """
    Phát hiện khi: |cvd_change| đáng kể VÀ |price_change_pct| < 0.3%.
    {detected, strength, price_locked, price_range_pct, cvd_change, description}
    """
    _empty = {
        "detected": False,
        "strength": 0.0,
        "price_locked": False,
        "price_range_pct": 0.0,
        "cvd_change": 0.0,
        "description": "Không đủ dữ liệu",
    }

    if len(cvd_series) < min_buckets or len(price_series) < min_buckets:
        return _empty

    # Dùng min_buckets cuối cùng để phân tích
    recent_cvd = cvd_series[-min_buckets:]
    recent_prices = list(price_series[-min_buckets:])

    price_min = min(recent_prices)
    price_max = max(recent_prices)
    price_range_pct = (
        (price_max - price_min) / price_min if price_min > 0 else 0.0
    )
    price_locked = price_range_pct < PRICE_LOCK_THRESHOLD_PCT

    cvd_values = [b["cumulative_cvd"] for b in recent_cvd]
    cvd_start = cvd_values[0]
    cvd_end = cvd_values[-1]
    cvd_change = cvd_end - cvd_start

    # Normalise cvd_change sang %: so sánh với giá trị tuyệt đối trung bình
    abs_mean = statistics.mean([abs(v) for v in cvd_values]) or 1.0
    cvd_change_pct = abs(cvd_change) / abs_mean * 100 if abs_mean else 0.0

    # strength: mỗi 20% cvd_change_pct → 100 strength
    strength = min(cvd_change_pct / 20 * 100, 100.0)

    detected = price_locked and cvd_change_pct > 20.0

    if detected:
        direction = "tăng mạnh" if cvd_change > 0 else "giảm mạnh"
        description = (
            f"Giá khoá trong {price_range_pct*100:.2f}% trong khi CVD {direction} "
            f"{cvd_change_pct:.0f}% — dấu hiệu hấp thụ"
        )
    else:
        description = "Không phát hiện hấp thụ"

    return {
        "detected": detected,
        "strength": round(strength, 2),
        "price_locked": price_locked,
        "price_range_pct": round(price_range_pct * 100, 4),
        "cvd_change": round(cvd_change, 2),
        "description": description,
    }


# ---------------------------------------------------------------------------
# S15-05 — Iceberg Clustering Detection
# ---------------------------------------------------------------------------

def detect_iceberg_clustering(
    ticks: list[dict],
    price_tolerance_pct: float = 0.05,
    min_repeat: int = 5,
    window_seconds: int = 300,
) -> dict:
    """
    Phát hiện nhiều lệnh nhỏ lặp lại tại cùng mức giá (sai số < price_tolerance_pct%).
    {detected, level, repeat_count, value_per_occurrence_avg, confidence}
    """
    _empty = {
        "detected": False,
        "level": 0.0,
        "repeat_count": 0,
        "value_per_occurrence_avg": 0.0,
        "confidence": "none",
    }

    if not ticks:
        return _empty

    # Lọc ticks trong window_seconds gần nhất
    if ticks:
        latest_secs = _time_to_seconds(ticks[-1]["trade_time"])
        cutoff = latest_secs - window_seconds
        recent = [t for t in ticks if _time_to_seconds(t["trade_time"]) >= cutoff]
    else:
        recent = ticks

    if not recent:
        return _empty

    # Bucket hoá theo giá: price_bucket = round(price / (price * price_tolerance_pct / 100))
    # Thực ra bucket = round(price / tick_size) với tick_size tương đối
    # Dùng: bucket_key = round(price * 100 / price_tolerance_pct) (làm tròn theo tolerance)
    def price_bucket(price: float) -> int:
        if price <= 0:
            return 0
        tolerance_unit = max(price * price_tolerance_pct / 100, 0.01)
        return int(round(price / tolerance_unit))

    buckets: dict[int, list[dict]] = {}
    for tick in recent:
        key = price_bucket(tick["price"])
        if key not in buckets:
            buckets[key] = []
        buckets[key].append(tick)

    # Tìm bucket có nhiều lần lặp nhất
    best_key = max(buckets, key=lambda k: len(buckets[k]))
    best_ticks = buckets[best_key]

    if len(best_ticks) < min_repeat:
        return _empty

    repeat_count = len(best_ticks)
    level = statistics.mean([t["price"] for t in best_ticks])
    avg_value = statistics.mean([t["value"] for t in best_ticks])

    if repeat_count >= min_repeat * 4:
        confidence = "high"
    elif repeat_count >= min_repeat * 2:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "detected": True,
        "level": round(level, 2),
        "repeat_count": repeat_count,
        "value_per_occurrence_avg": round(avg_value, 2),
        "confidence": confidence,
    }


# ---------------------------------------------------------------------------
# S15-06 — Dark Flow Detector (aggregated)
# ---------------------------------------------------------------------------

def detect_dark_flow(
    symbol: str,
    avg_tick_rate_baseline: float | None = None,
) -> dict:
    """
    Gọi tất cả compute functions, aggregate thành signal tổng hợp.
    {signal_type, strength, confidence, components, triggered_at}
    signal_type: 'none' | 'absorption' | 'iceberg' | 'twap_bot' | 'mixed'
    """
    # --- Lấy dữ liệu ---
    ticks = _fetch_ticks(symbol, window_minutes=5)  # 5 phút gần nhất
    cvd_series = compute_cvd_series(symbol, window_minutes=5, bucket_seconds=30)
    tick_info = compute_tick_rate(symbol, window_seconds=300)
    size_dist = compute_size_distribution(symbol, ticks)

    # price_series từ cvd_series: dùng buy+sell tổng để ước lượng hoạt động giá
    # Nếu không có tick thì không thể tính absorption
    price_series: list[float] = []
    if ticks:
        # Lấy giá theo thứ tự thời gian của ticks
        price_series = [t["price"] for t in ticks]
        # Cắt về cùng số bucket với cvd_series (lấy giá end của mỗi bucket)
        if cvd_series:
            bucket_secs = 30
            bucket_prices: dict[int, float] = {}
            for t in ticks:
                bidx = _bucket_index(t["trade_time"], bucket_secs)
                bucket_prices[bidx] = t["price"]
            price_series = [bucket_prices[b] for b in sorted(bucket_prices.keys())]

    absorption = detect_absorption(symbol, cvd_series, price_series, min_buckets=3)
    iceberg = detect_iceberg_clustering(ticks, min_repeat=5, window_seconds=300)

    tick_rate = tick_info["tick_rate_per_min"]
    small_ratio = size_dist["small_ratio"]

    # --- Phân loại tín hiệu ---
    signals_active: list[str] = []

    if absorption["detected"] and absorption["price_locked"]:
        signals_active.append("absorption")

    if iceberg["detected"] and small_ratio > 0.70:
        signals_active.append("iceberg")

    # TWAP bot: tick rate > 3x baseline, nhỏ đều, CVD tăng đều
    baseline = avg_tick_rate_baseline or 5.0
    cvd_steady = False
    if len(cvd_series) >= 3:
        cvd_deltas = [
            abs(cvd_series[i]["cvd"] - cvd_series[i - 1]["cvd"])
            for i in range(1, len(cvd_series))
        ]
        if cvd_deltas:
            delta_std = statistics.pstdev(cvd_deltas) if len(cvd_deltas) > 1 else 0.0
            delta_mean = statistics.mean(cvd_deltas) or 1.0
            cvd_steady = (delta_std / delta_mean) < 0.5  # CV < 50% → đều đặn

    if tick_rate > baseline * 3 and small_ratio > 0.60 and cvd_steady:
        signals_active.append("twap_bot")

    if len(signals_active) >= 2:
        signal_type = "mixed"
    elif len(signals_active) == 1:
        signal_type = signals_active[0]
    else:
        signal_type = "none"

    # --- Tổng hợp strength ---
    strength_sources: list[float] = []
    if absorption["detected"]:
        strength_sources.append(absorption["strength"])
    if iceberg["detected"]:
        iceberg_strength = min(iceberg["repeat_count"] / 2 * 10, 100.0)
        strength_sources.append(iceberg_strength)
    if "twap_bot" in signals_active:
        twap_strength = min((tick_rate / baseline) * 20, 100.0)
        strength_sources.append(twap_strength)

    strength = max(strength_sources) if strength_sources else 0.0

    if strength >= 70:
        confidence = "high"
    elif strength >= 40:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "signal_type": signal_type,
        "strength": round(strength, 2),
        "confidence": confidence,
        "components": {
            "absorption": absorption,
            "iceberg": iceberg,
            "tick_rate": tick_info,
            "size_distribution": size_dist,
        },
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }
