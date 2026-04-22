"""
Order Flow History Helper — Sprint 35
Phuc vu recompute OrderFlowSignal tu du lieu IntradayTick lich su voi deduplication.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from typing import Any, Dict, List, Optional

import pandas as pd
from django.utils import timezone as django_timezone

from .order_flow import (
    compute_cvd_series,
    compute_size_distribution,
    detect_absorption,
    detect_iceberg_clustering,
    SMALL_ORDER_THRESHOLD,
    LARGE_ORDER_THRESHOLD,
)
from .domain_constants import ORDER_FLOW_SMALL_ORDER_THRESHOLD_VND

logger = logging.getLogger(__name__)

def compute_dark_flow_for_trade_date(
    symbol: str,
    trade_date: date,
    *,
    duplicate_threshold_pct: float = 15.0,
    min_ticks: int = 20,
    dedupe: bool = True,
) -> Dict[str, Any]:
    """
    Phan tich dark flow cho mot ngay giao dich cu the.
    Tra ve {audit, signal_preview, eligible_for_persist, skip_reason}.
    """
    from portfolio.models import IntradayTick

    # 1. Fetch ticks
    qs = IntradayTick.objects.filter(
        symbol=symbol,
        trade_date=trade_date
    ).values("trade_time", "price", "volume", "side", "match_type")
    
    raw_ticks = list(qs)
    raw_count = len(raw_ticks)

    if raw_count < min_ticks:
        return {
            "eligible_for_persist": False,
            "skip_reason": ["low_data_density"],
            "audit": {"raw_tick_count": raw_count},
            "signal_preview": None
        }

    frame = pd.DataFrame.from_records(raw_ticks)
    frame["price"] = frame["price"].astype(float)
    frame["volume"] = frame["volume"].astype(float)
    
    # 2. Deduplication
    # Theo spec: symbol, trade_date, trade_time, price, volume, side, match_type
    # symbol va trade_date da duoc filter o query nen chi can cac cot con lai.
    dedup_cols = ["trade_time", "price", "volume", "side", "match_type"]
    
    deduped_frame = frame.drop_duplicates(subset=dedup_cols, keep='first')
    deduped_count = len(deduped_frame)
    duplicate_count = raw_count - deduped_count
    duplicate_ratio = (duplicate_count / raw_count) * 100 if raw_count > 0 else 0

    # 3. Audit Whale Inflation
    def calc_whale_value(df):
        if df.empty: return 0
        df_copy = df.copy()
        df_copy["value"] = df_copy["price"].astype(float) * df_copy["volume"].astype(float)
        # Neu gia < 1000 thi nhan 1000 (VND unit)
        df_copy.loc[df_copy["price"] < 1000, "value"] *= 1000
        # Whale threshold 500M VND
        return df_copy[df_copy["value"] >= 500_000_000]["value"].sum()

    whale_val_raw = calc_whale_value(frame)
    whale_val_dedup = calc_whale_value(deduped_frame)
    whale_inflation = whale_val_raw / max(whale_val_dedup, 1)

    audit = {
        "raw_tick_count": raw_count,
        "deduped_tick_count": deduped_count,
        "duplicate_count": duplicate_count,
        "duplicate_ratio_pct": round(duplicate_ratio, 2),
        "whale_val_raw": whale_val_raw,
        "whale_val_dedup": whale_val_dedup,
        "whale_inflation_ratio": round(whale_inflation, 2),
    }

    # 4. Guard Rails
    skip_reason = []
    if duplicate_ratio > duplicate_threshold_pct:
        skip_reason.append("duplicate_ratio_above_threshold")
    
    if deduped_count < min_ticks:
        skip_reason.append("low_data_density_after_dedupe")

    eligible = len(skip_reason) == 0

    # 5. Compute Signal (Preview)
    # Su dung tap ticks da deduped
    ticks_for_compute = deduped_frame.to_dict(orient="records")
    for t in ticks_for_compute:
        t["value"] = float(t["price"]) * float(t["volume"])
        if float(t["price"]) < 1000: t["value"] *= 1000

    # Gia su compute_cvd_series va cac ham khac co the dung ticks pass vao 
    # (Hien tai chung no dang query DB, minh can refactor hoac mock).
    # Tuy nhien de don gian va an toan, minh se thuc hien compute inline o day 
    # dua tren tap ticks da co.

    signal_preview = _detect_dark_flow_from_ticks(symbol, ticks_for_compute)

    return {
        "eligible_for_persist": eligible,
        "skip_reason": skip_reason,
        "audit": audit,
        "signal_preview": signal_preview
    }

def _detect_dark_flow_from_ticks(symbol: str, ticks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Phien ban detect dark flow chay tren tap ticks truyen vao thay vi query DB."""
    if not ticks:
        return {"signal_type": "none", "strength": 0}

    # CVDS
    frame = pd.DataFrame.from_records(ticks)
    frame["price"] = frame["price"].astype(float)
    frame["value"] = frame["value"].astype(float)
    frame["side"] = frame.get("side", "UNKNOWN").astype(str).str.upper()
    
    # Bucket 30s
    def _to_secs(t): return t.hour * 3600 + t.minute * 60 + t.second
    frame["bucket_idx"] = frame["trade_time"].map(lambda t: _to_secs(t) // 30)
    
    frame["buy_v"] = frame["value"].where(frame["side"] == "BUY", 0.0)
    frame["sell_v"] = frame["value"].where(frame["side"] == "SELL", 0.0)
    unknown_mask = ~frame["side"].isin(["BUY", "SELL"])
    frame.loc[unknown_mask, "buy_v"] = frame.loc[unknown_mask, "value"] * 0.5
    frame.loc[unknown_mask, "sell_v"] = frame.loc[unknown_mask, "value"] * 0.5

    grouped = frame.groupby("bucket_idx").agg({"buy_v": "sum", "sell_v": "sum"}).sort_index()
    cvd_series = []
    cum_cvd = 0
    for idx, row in grouped.iterrows():
        cvd = row["buy_v"] - row["sell_v"]
        cum_cvd += cvd
        cvd_series.append({"cumulative_cvd": cum_cvd, "cvd": cvd})

    # Price series
    price_series = frame.groupby("bucket_idx")["price"].last().tolist()

    # Absorption
    from .order_flow import detect_absorption
    absorption = detect_absorption(symbol, cvd_series, price_series, min_buckets=3)

    # Iceberg
    from .order_flow import detect_iceberg_clustering
    iceberg = detect_iceberg_clustering(ticks, min_repeat=5, window_seconds=300)

    # Tick Rate (last 5 mins of the day or peak window? Spec says window_minutes=5)
    # Cho backfill, minh tinh tren toan bo tap ticks cua ngay do chia cho trading time?
    # Spec Step 5 noi goi helper. Minh se lay max tick rate trong cac window 5p?
    # Hoac don gian la lay tick rate trung binh cua ngay.
    total_ticks = len(ticks)
    # Trading time VN: 9:00 - 11:30, 13:00 - 14:45 => 2.5h + 1.75h = 4.25h = 255 mins
    tick_rate = total_ticks / 255.0

    # Size Dist
    from .order_flow import compute_size_distribution
    size_dist = compute_size_distribution(symbol, ticks)

    # Signal logic
    signals = []
    if absorption["detected"]: signals.append("absorption")
    if iceberg["detected"] and size_dist["small_ratio"] > 0.70: signals.append("iceberg")
    
    if len(signals) >= 2: signal_type = "mixed"
    elif signals: signal_type = signals[0]
    else: signal_type = "none"

    strength_sources = []
    if absorption["detected"]: strength_sources.append(absorption["strength"])
    if iceberg["detected"]: strength_sources.append(min(iceberg["repeat_count"] * 5, 100))
    
    strength = max(strength_sources) if strength_sources else 0

    return {
        "signal_type": signal_type,
        "strength": round(strength, 2),
        "confidence": "high" if strength >= 70 else "medium" if strength >= 40 else "low",
        "tick_rate": round(tick_rate, 2),
        "small_order_ratio": size_dist["small_ratio"],
        "cvd_at_signal": absorption["cvd_change"],
        "price_at_signal": price_series[-1] if price_series else 0,
        "components_json": {
            "absorption": absorption,
            "iceberg": iceberg,
            "size_distribution": size_dist
        },
        "event_count": total_ticks,
        "triggered_at": django_timezone.now().isoformat()
    }
