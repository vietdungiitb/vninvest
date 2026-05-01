"""
Order Flow Engine — Sprint 15
Phát hiện dòng tiền ẩn: iceberg orders, TWAP bots, smart money absorption.

Tất cả hàm đều pure/side-effect-free trừ compute_tick_rate (dùng cache)
và detect_dark_flow (gọi compute_tick_rate + query DB).
"""
from __future__ import annotations

from collections import defaultdict
import math
import statistics
from datetime import date, datetime, time, timedelta, timezone
from typing import Sequence

import pandas as pd
from django.core.cache import cache
from django.db.models import QuerySet
from django.utils import timezone as django_timezone

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
    return django_timezone.localdate()


def _now_time() -> time:
    return django_timezone.localtime().time()


def _time_to_seconds(t: time) -> int:
    """Chuyển time object sang tổng số giây kể từ 00:00."""
    return t.hour * 3600 + t.minute * 60 + t.second


def _seconds_to_time(seconds: int) -> time:
    normalized = max(int(seconds), 0)
    h = normalized // 3600
    m = (normalized % 3600) // 60
    s = normalized % 60
    return time(h, m, s)


def _fetch_ticks(symbol: str, window_minutes: int) -> list[dict]:
    """
    Query IntradayTick trong window_minutes gần nhất, trả về list[dict].
    Tránh import vòng: import model tại runtime.
    """
    from portfolio.models import IntradayTick  # noqa: PLC0415

    today = _today()
    now_secs = _time_to_seconds(_now_time())
    cutoff_secs = now_secs - window_minutes * 60

    cutoff_secs = max(cutoff_secs, 0)
    cutoff_time = _seconds_to_time(cutoff_secs)

    qs: QuerySet = IntradayTick.objects.filter(
        symbol=symbol,
        trade_date=today,
        trade_time__gte=cutoff_time,
    ).values("trade_time", "price", "volume", "side")
    rows = list(qs)
    if not rows:
        return []

    frame = pd.DataFrame.from_records(rows)
    frame["price"] = pd.to_numeric(frame.get("price"), errors="coerce").fillna(0.0).astype(float)
    frame["volume"] = pd.to_numeric(frame.get("volume"), errors="coerce").fillna(0).astype(int)
    frame["value"] = frame["price"] * frame["volume"]

    return frame.to_dict(orient="records")


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

    frame = pd.DataFrame.from_records(ticks)
    if frame.empty:
        return []
    frame["value"] = pd.to_numeric(frame.get("value"), errors="coerce").fillna(0.0).astype(float)
    frame["side"] = frame.get("side", "UNKNOWN").astype(str).str.upper()
    frame["bucket_idx"] = frame["trade_time"].map(lambda t: _bucket_index(t, bucket_seconds))

    frame["buy_value_row"] = frame["value"].where(frame["side"] == "BUY", 0.0)
    frame["sell_value_row"] = frame["value"].where(frame["side"] == "SELL", 0.0)
    unknown_mask = ~frame["side"].isin(["BUY", "SELL"])
    frame.loc[unknown_mask, "buy_value_row"] = frame.loc[unknown_mask, "value"] * 0.5
    frame.loc[unknown_mask, "sell_value_row"] = frame.loc[unknown_mask, "value"] * 0.5

    grouped = (
        frame.groupby("bucket_idx", as_index=False)[["buy_value_row", "sell_value_row"]]
        .sum()
        .sort_values("bucket_idx")
    )

    today = _today()
    result = []
    cumulative = 0.0
    for row in grouped.to_dict(orient="records"):
        bucket_idx = int(row["bucket_idx"])
        buy_value = float(row["buy_value_row"])
        sell_value = float(row["sell_value_row"])
        secs = bucket_idx * bucket_seconds
        bucket_time = (
            datetime.combine(today, time(0, 0))
            + timedelta(seconds=secs)
        )
        cvd = buy_value - sell_value
        cumulative += cvd
        result.append({
            "bucket_ts": bucket_time.isoformat(),
            "buy_value": round(buy_value, 2),
            "sell_value": round(sell_value, 2),
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
    cutoff_time = _seconds_to_time(cutoff_secs)

    qs = IntradayTick.objects.filter(
        symbol=symbol,
        trade_date=today,
        trade_time__gte=cutoff_time,
    ).values("price", "volume")

    frame = pd.DataFrame.from_records(list(qs))
    if frame.empty:
        total = 0
        small = 0
    else:
        frame["price"] = pd.to_numeric(frame.get("price"), errors="coerce").fillna(0.0).astype(float)
        frame["volume"] = pd.to_numeric(frame.get("volume"), errors="coerce").fillna(0).astype(float)
        frame["value"] = frame["price"] * frame["volume"]
        total = int(len(frame.index))
        small = int((frame["value"] < SMALL_ORDER_THRESHOLD).sum())

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

    frame = pd.DataFrame.from_records(ticks)
    if frame.empty:
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

    frame["value"] = pd.to_numeric(frame.get("value"), errors="coerce")
    frame = frame[pd.notna(frame["value"])]
    if frame.empty:
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

    values = frame["value"].astype(float)
    n = int(len(values.index))

    avg_value = float(values.mean())
    median_value = float(values.median())
    values_sorted = sorted(values.tolist())
    p95_idx = min(int(math.floor(0.95 * n)), n - 1)
    p95_value = float(values_sorted[p95_idx])

    small = int((values < SMALL_ORDER_THRESHOLD).sum())
    large = int((values >= LARGE_ORDER_THRESHOLD).sum())

    histogram = {
        "<50m": int((values < ORDER_FLOW_BUCKET_LT_50M_MAX_VND).sum()),
        "50-200m": int(((values >= ORDER_FLOW_BUCKET_LT_50M_MAX_VND) & (values < ORDER_FLOW_BUCKET_LT_200M_MAX_VND)).sum()),
        "200-500m": int(((values >= ORDER_FLOW_BUCKET_LT_200M_MAX_VND) & (values < ORDER_FLOW_BUCKET_LT_500M_MAX_VND)).sum()),
        "500m-2b": int(((values >= ORDER_FLOW_BUCKET_LT_500M_MAX_VND) & (values < ORDER_FLOW_BUCKET_LT_2B_MAX_VND)).sum()),
        ">2b": int((values >= ORDER_FLOW_BUCKET_LT_2B_MAX_VND).sum()),
    }

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


def _build_dark_flow_bucket_facts(*, ticks: list[dict], cvd_series: list[dict], bucket_seconds: int) -> list[dict]:
    if not ticks:
        return []

    today = _today()
    cvd_by_bucket_ts = {str(row.get("bucket_ts") or "").strip(): row for row in cvd_series or []}
    bucket_rows: dict[int, dict] = defaultdict(lambda: {
        "tick_count": 0,
        "small_order_count": 0,
        "buy_value": 0.0,
        "sell_value": 0.0,
        "total_value": 0.0,
        "max_tick_value": 0.0,
        "first_trade_time": None,
        "last_trade_time": None,
    })

    for tick in ticks:
        trade_time = tick.get("trade_time")
        if not isinstance(trade_time, time):
            continue

        bucket_idx = _bucket_index(trade_time, bucket_seconds)
        bucket_row = bucket_rows[bucket_idx]
        value = float(tick.get("value") or 0.0)
        side = str(tick.get("side") or "UNKNOWN").strip().upper()

        bucket_row["tick_count"] += 1
        bucket_row["total_value"] += value
        bucket_row["max_tick_value"] = max(bucket_row["max_tick_value"], value)
        if value < SMALL_ORDER_THRESHOLD:
            bucket_row["small_order_count"] += 1

        if side == "BUY":
            bucket_row["buy_value"] += value
        elif side == "SELL":
            bucket_row["sell_value"] += value
        else:
            bucket_row["buy_value"] += value * 0.5
            bucket_row["sell_value"] += value * 0.5

        if bucket_row["first_trade_time"] is None or trade_time < bucket_row["first_trade_time"]:
            bucket_row["first_trade_time"] = trade_time
        if bucket_row["last_trade_time"] is None or trade_time > bucket_row["last_trade_time"]:
            bucket_row["last_trade_time"] = trade_time

    bucket_facts = []
    running_cvd = 0.0
    for bucket_idx in sorted(bucket_rows):
        bucket_row = bucket_rows[bucket_idx]
        bucket_ts = (
            datetime.combine(today, time(0, 0))
            + timedelta(seconds=bucket_idx * bucket_seconds)
        ).isoformat()
        cvd_row = cvd_by_bucket_ts.get(bucket_ts) or {}
        buy_value = float(bucket_row["buy_value"] or 0.0)
        sell_value = float(bucket_row["sell_value"] or 0.0)
        total_value = float(bucket_row["total_value"] or 0.0)
        net_value = buy_value - sell_value
        cvd = float(cvd_row.get("cvd") if cvd_row else net_value)
        running_cvd = float(cvd_row.get("cumulative_cvd") if cvd_row else (running_cvd + net_value))
        tick_count = int(bucket_row["tick_count"] or 0)

        bucket_facts.append({
            "bucket_ts": bucket_ts,
            "bucket_index": bucket_idx,
            "bucket_seconds": bucket_seconds,
            "bucket_minutes": round(bucket_seconds / 60.0, 2),
            "tick_count": tick_count,
            "small_order_count": int(bucket_row["small_order_count"] or 0),
            "small_order_ratio": round((bucket_row["small_order_count"] or 0) / tick_count, 4) if tick_count else 0.0,
            "buy_value": round(buy_value, 2),
            "sell_value": round(sell_value, 2),
            "total_value": round(total_value, 2),
            "net_value": round(net_value, 2),
            "cvd": round(cvd, 2),
            "cumulative_cvd": round(running_cvd, 2),
            "dominant_side": "buy" if buy_value > sell_value else "sell" if sell_value > buy_value else "neutral",
            "max_tick_value": round(float(bucket_row["max_tick_value"] or 0.0), 2),
            "first_trade_time": bucket_row["first_trade_time"].isoformat() if bucket_row["first_trade_time"] else None,
            "last_trade_time": bucket_row["last_trade_time"].isoformat() if bucket_row["last_trade_time"] else None,
        })

    return bucket_facts


def _build_dark_flow_anomaly_markers(
    *,
    signal_type: str,
    strength: float,
    confidence: str,
    signals_active: list[str],
    absorption: dict,
    iceberg: dict,
    tick_rate: dict,
    size_dist: dict,
) -> list[dict]:
    markers = []

    if absorption.get("detected"):
        markers.append({
            "kind": "absorption",
            "label": "Hấp thụ",
            "severity": "urgent" if float(absorption.get("strength") or 0) >= 70 else "warning",
            "detected": True,
            "strength": round(float(absorption.get("strength") or 0), 2),
            "price_locked": bool(absorption.get("price_locked")),
            "cvd_change": round(float(absorption.get("cvd_change") or 0), 2),
        })

    if iceberg.get("detected"):
        markers.append({
            "kind": "iceberg",
            "label": "Iceberg",
            "severity": "urgent" if int(iceberg.get("repeat_count") or 0) >= 10 else "warning",
            "detected": True,
            "strength": round(min(int(iceberg.get("repeat_count") or 0) * 5.0, 100.0), 2),
            "repeat_count": int(iceberg.get("repeat_count") or 0),
            "confidence": iceberg.get("confidence") or "none",
            "level": round(float(iceberg.get("level") or 0), 2),
            "value_per_occurrence_avg": round(float(iceberg.get("value_per_occurrence_avg") or 0), 2),
        })

    if "twap_bot" in set(signals_active or []):
        markers.append({
            "kind": "twap_bot",
            "label": "TWAP bot",
            "severity": "info",
            "detected": True,
            "strength": round(float(strength), 2),
            "tick_rate_per_min": round(float(tick_rate.get("tick_rate_per_min") or 0.0), 2),
            "small_order_ratio": round(float(size_dist.get("small_order_ratio") or 0.0), 4),
        })

    if not markers and signal_type not in {"none", ""}:
        markers.append({
            "kind": signal_type,
            "label": signal_type.replace("_", " ").title(),
            "severity": "info" if confidence == "low" else "warning" if confidence == "medium" else "urgent",
            "detected": True,
            "strength": round(float(strength), 2),
        })

    return markers


def _build_dark_flow_session_summary(
    *,
    symbol: str,
    window_minutes: int,
    window_seconds: int,
    bucket_facts: list[dict],
    tick_count: int,
    tick_rate: dict,
    size_dist: dict,
    signal_type: str,
    strength: float,
    confidence: str,
    signals_active: list[str],
    anomaly_markers: list[dict],
) -> dict:
    total_buy_value = sum(float(item.get("buy_value") or 0.0) for item in bucket_facts)
    total_sell_value = sum(float(item.get("sell_value") or 0.0) for item in bucket_facts)
    net_value = total_buy_value - total_sell_value
    dominant_side = "buy" if total_buy_value > total_sell_value else "sell" if total_sell_value > total_buy_value else "neutral"
    strongest_bucket = max(
        bucket_facts,
        key=lambda item: max(abs(float(item.get("net_value") or 0.0)), float(item.get("total_value") or 0.0)),
        default=None,
    )

    peak_bucket = None
    if strongest_bucket is not None:
        peak_bucket = {
            "bucket_ts": strongest_bucket.get("bucket_ts"),
            "bucket_index": strongest_bucket.get("bucket_index"),
            "tick_count": strongest_bucket.get("tick_count"),
            "total_value": strongest_bucket.get("total_value"),
            "net_value": strongest_bucket.get("net_value"),
            "cumulative_cvd": strongest_bucket.get("cumulative_cvd"),
            "dominant_side": strongest_bucket.get("dominant_side"),
        }

    return {
        "symbol": symbol,
        "window_minutes": int(window_minutes),
        "window_seconds": int(window_seconds),
        "bucket_fact_count": len(bucket_facts),
        "tick_count": int(tick_count),
        "total_buy_value": round(float(total_buy_value), 2),
        "total_sell_value": round(float(total_sell_value), 2),
        "net_value": round(float(net_value), 2),
        "dominant_side": dominant_side,
        "signal_type": signal_type,
        "strength": round(float(strength), 2),
        "confidence": confidence,
        "tick_rate_per_min": round(float(tick_rate.get("tick_rate_per_min") or 0.0), 2),
        "small_order_ratio": round(float(size_dist.get("small_order_ratio") or 0.0), 4),
        "signals_active": list(signals_active or []),
        "anomaly_count": len(anomaly_markers),
        "peak_bucket": peak_bucket,
    }


# ---------------------------------------------------------------------------
# S15-06 — Dark Flow Detector (aggregated)
# ---------------------------------------------------------------------------

def detect_dark_flow(
    symbol: str,
    avg_tick_rate_baseline: float | None = None,
    window_minutes: int = 5,
) -> dict:
    """
    Gọi tất cả compute functions, aggregate thành signal tổng hợp.
    {signal_type, strength, confidence, components, triggered_at}
    signal_type: 'none' | 'absorption' | 'iceberg' | 'twap_bot' | 'mixed'
    """
    # --- Lấy dữ liệu ---
    resolved_window_minutes = max(int(window_minutes or 5), 1)
    window_seconds = resolved_window_minutes * 60

    ticks = _fetch_ticks(symbol, window_minutes=resolved_window_minutes)
    cvd_series = compute_cvd_series(symbol, window_minutes=resolved_window_minutes, bucket_seconds=30)
    tick_info = compute_tick_rate(symbol, window_seconds=window_seconds)
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
    iceberg = detect_iceberg_clustering(ticks, min_repeat=5, window_seconds=window_seconds)

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

    bucket_facts = _build_dark_flow_bucket_facts(
        ticks=ticks,
        cvd_series=cvd_series,
        bucket_seconds=30,
    )
    anomaly_markers = _build_dark_flow_anomaly_markers(
        signal_type=signal_type,
        strength=strength,
        confidence=confidence,
        signals_active=signals_active,
        absorption=absorption,
        iceberg=iceberg,
        tick_rate=tick_info,
        size_dist=size_dist,
    )
    session_summary = _build_dark_flow_session_summary(
        symbol=symbol,
        window_minutes=resolved_window_minutes,
        window_seconds=window_seconds,
        bucket_facts=bucket_facts,
        tick_count=int(tick_info.get("total_count") or len(ticks)),
        tick_rate=tick_info,
        size_dist=size_dist,
        signal_type=signal_type,
        strength=strength,
        confidence=confidence,
        signals_active=signals_active,
        anomaly_markers=anomaly_markers,
    )

    return {
        "signal_type": signal_type,
        "strength": round(strength, 2),
        "confidence": confidence,
        "window_minutes": resolved_window_minutes,
        "window_seconds": window_seconds,
        "components": {
            "absorption": absorption,
            "iceberg": iceberg,
            "tick_rate": tick_info,
            "size_distribution": size_dist,
        },
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "bucket_facts": bucket_facts,
        "session_summary": session_summary,
        "anomaly_markers": anomaly_markers,
        "materialization": {
            "source": "dark_flow_detect",
            "generated_at": django_timezone.now().isoformat(),
            "freshness_state": "fresh" if bucket_facts else "empty",
            "lag_seconds": 0.0,
            "bucket_fact_count": len(bucket_facts),
            "anomaly_count": len(anomaly_markers),
            "session_summary_state": "complete" if bucket_facts else "empty",
        },
    }
