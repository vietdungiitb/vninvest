from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import math

import pandas as pd

from portfolio.domain_constants import (
    WHALE_CONFIG_VERSION,
    classify_whale_size_class,
)
from portfolio.whale_scoring import calculate_display_score, calculate_event_score, resolve_whale_score_config


@dataclass
class WhaleSignal:
    symbol: str
    matched_value: float
    side: str
    threshold: float
    ts: str


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_signal_side(side_value: str) -> str:
    side_raw = str(side_value or "").strip().lower()
    if side_raw in ("buy", "bu", "b"):
        return "buy"
    if side_raw in ("sell", "sd", "s"):
        return "sell"
    return "neutral"


def _classify_signal_size(matched_value: float) -> str:
    return classify_whale_size_class(matched_value)


def _build_whale_event_id(signal: WhaleSignal, normalized_side: str) -> str:
    matched_value = int(round(float(signal.matched_value or 0.0)))
    threshold = int(round(float(signal.threshold or 0.0)))
    return f"whale:{signal.symbol}:{signal.ts}:{normalized_side}:{matched_value}:{threshold}"


def _derive_source_layer(source: str) -> str:
    """Map source string -> semantic source_layer token."""
    s = str(source or "").lower()
    if "vnstock" in s or ":api" in s:
        return "api"
    if "db" in s or "intraday_tick" in s:
        return "db"
    return "live"


def _derive_freshness_bucket(ts_iso: str) -> str:
    """Classify event timestamp into freshness bucket relative to now."""
    try:
        ts = datetime.fromisoformat(str(ts_iso).replace("Z", "+00:00"))
        age_seconds = (datetime.now(timezone.utc) - ts).total_seconds()
        if not math.isfinite(age_seconds) or age_seconds < 0:
            return "live"
        if age_seconds <= 30:
            return "live"
        if age_seconds <= 300:
            return "recent"
        if age_seconds <= 900:
            return "stale"
        return "cold"
    except Exception:
        return "unknown"

def compute_vwap(trades_df: pd.DataFrame) -> float:
    if trades_df.empty:
        return 0.0
    frame = trades_df.copy()
    frame["price"] = pd.to_numeric(frame["price"], errors="coerce").fillna(0.0)
    frame["volume"] = pd.to_numeric(frame["volume"], errors="coerce").fillna(0.0)

    denominator = frame["volume"].sum()
    if denominator <= 0:
        return float(frame["price"].iloc[-1]) if not frame.empty else 0.0

    numerator = (frame["price"] * frame["volume"]).sum()
    return float(numerator / denominator)


def build_ticker_payload(symbol: str, trades_df: pd.DataFrame, seq: int, contract_version: str = "1.0") -> dict:
    if trades_df.empty:
        price = 0.0
        volume = 0.0
    else:
        price = float(pd.to_numeric(trades_df["price"], errors="coerce").fillna(0.0).iloc[-1])
        volume = float(pd.to_numeric(trades_df["volume"], errors="coerce").fillna(0.0).sum())

    return {
        "event_type": "ticker_update",
        "contract_version": contract_version,
        "symbol": symbol.upper(),
        "price": price,
        "volume": volume,
        "vwap": compute_vwap(trades_df),
        "ts": _iso_now(),
        "seq": seq,
    }


def detect_whale_signals(
    symbol: str,
    trades_df: pd.DataFrame,
    thresholds: Iterable[float],
) -> list[WhaleSignal]:
    if trades_df.empty:
        return []

    frame = trades_df.copy()
    frame["price"] = pd.to_numeric(frame["price"], errors="coerce").fillna(0.0)
    frame["volume"] = pd.to_numeric(frame["volume"], errors="coerce").fillna(0.0)
    frame["matched_value"] = frame["price"] * frame["volume"]

    sorted_thresholds = sorted(set(float(t) for t in thresholds if float(t) > 0))
    if not sorted_thresholds:
        return []

    min_threshold = sorted_thresholds[0]
    qualifying = frame[frame["matched_value"] >= min_threshold]
    if qualifying.empty:
        return []

    signals: list[WhaleSignal] = []
    for _, row in qualifying.iterrows():
        mv = float(row["matched_value"])
        # BUG FIX: use this row's own side instead of side_series.iloc[-1] (last tick)
        trade_side = str(row.get("side") or "UNKNOWN").upper()
        # BUG FIX: use actual trade timestamp instead of _iso_now()
        raw_ts = row.get("ts")
        trade_ts = str(raw_ts) if (raw_ts is not None and str(raw_ts).strip()) else _iso_now()

        for threshold in sorted_thresholds:
            if mv >= threshold:
                signals.append(
                    WhaleSignal(
                        symbol=symbol.upper(),
                        matched_value=mv,
                        side=trade_side,
                        threshold=threshold,
                        ts=trade_ts,
                    )
                )
    return signals


def build_whale_payload(
    signal: WhaleSignal,
    seq: int,
    contract_version: str = "1.0",
    config_version: str = WHALE_CONFIG_VERSION,
    source: str = "intraday-engine",
    score_config: dict | None = None,
     threshold_source: str = "user_default",
     recovered: bool = False,
) -> dict:
    score_config = score_config or resolve_whale_score_config()
    normalized_side = _normalize_signal_side(signal.side)
    event_id = _build_whale_event_id(signal, normalized_side)
    score_result = calculate_event_score(
        trade={
            "matched_value": signal.matched_value,
            "threshold": signal.threshold,
            "side": normalized_side,
        },
        context={
            "threshold_vnd": signal.threshold,
            "side": normalized_side,
        },
        config=score_config,
    )
    display_result = calculate_display_score(
        event_score=score_result["event_score"],
        occurred_at=signal.ts,
        config=score_config,
    )

    return {
        "event_type": "whale_alert",
        "event_id": event_id,
        "contract_version": contract_version,
        "config_version": config_version,
        "source": source,
            "source_layer": _derive_source_layer(source),
        "symbol": signal.symbol,
        "matched_value": signal.matched_value,
        "side": normalized_side,
        "threshold": signal.threshold,
            "threshold_source": str(threshold_source or "user_default"),
        "size_class": _classify_signal_size(signal.matched_value),
        "event_score": score_result["event_score"],
        "display_score": display_result["display_score"],
        "severity": display_result["severity"],
        "weights_version": score_result["weights_version"],
            "freshness_bucket": _derive_freshness_bucket(signal.ts),
            "recovered": recovered,
        "ts": signal.ts,
        "seq": seq,
    }


def build_heartbeat_payload(scope: str, seq: int, contract_version: str = "1.0") -> dict:
    return {
        "event_type": "heartbeat",
        "contract_version": contract_version,
        "scope": scope,
        "status": "ok",
        "ts": _iso_now(),
        "seq": seq,
    }
