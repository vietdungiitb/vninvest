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


def _get_indicator_cache(symbol: str) -> dict:
    """Lấy indicator cache từ Redis (tính bởi Celery task). Safe – không raise."""
    try:
        import json
        from django.core.cache import cache
        cache_key = f"watchlist_indicator:{symbol.upper()}"
        raw = cache.get(cache_key)
        if raw:
            return json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        pass
    return {}


def _normalize_signal_side(side_value: str) -> str:
    side_raw = str(side_value or "").strip().lower()
    if side_raw in ("buy", "bu", "b"):
        return "buy"
    if side_raw in ("sell", "sd", "s"):
        return "sell"
    return "neutral"


def _classify_signal_size(matched_value: float) -> str:
    return classify_whale_size_class(matched_value)


def _normalize_whale_timestamp(value: str | datetime | None) -> str:
    """Normalize whale event timestamp to second precision (UTC ISO8601)."""
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value or "").strip()
        if not raw:
            return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt.replace(microsecond=0).isoformat()


def _build_whale_event_id(signal: WhaleSignal, normalized_side: str) -> str:
    matched_value = int(round(float(signal.matched_value or 0.0)))
    normalized_ts = _normalize_whale_timestamp(signal.ts)
    return f"whale:{signal.symbol}:{normalized_ts}:{normalized_side}:{matched_value}"


def _derive_source_layer(source: str) -> str:
    """Map source string -> semantic source_layer token."""
    s = str(source or "").lower()
    if "vnbroker" in s or ":api" in s:
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

    ts_iso = _iso_now()

    indicators = _get_indicator_cache(symbol)

    return {
        "event_type": "ticker_update",
        "contract_version": contract_version,
        "symbol": symbol.upper(),
        "price": price,
        "current_price": price,
        "volume": volume,
        "vwap": compute_vwap(trades_df),
        "ts": ts_iso,
        "last_date": ts_iso,
        "freshness_seconds": 0,
        "stale": False,
        "source": "ws_stream",
        "seq": seq,
        # Phase B: kỹ thuật indicators từ Celery cache
        "rsi_14": indicators.get("rsi_14"),
        "ma20_dist_pct": indicators.get("ma20_dist_pct"),
        "rvol": indicators.get("rvol"),
        "indicator_ts": indicators.get("indicator_ts"),
    }


def build_ticker_payload_native(symbol: str, rows: list[dict], seq: int, contract_version: str = "1.0") -> dict:
    """Compatibility wrapper that routes native rows to pandas vectorized compute path."""
    frame = pd.DataFrame.from_records(rows or [])
    return build_ticker_payload(symbol=symbol, trades_df=frame, seq=seq, contract_version=contract_version)


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
        trade_ts = _normalize_whale_timestamp(raw_ts if raw_ts is not None else _iso_now())

        hit_thresholds = [threshold for threshold in sorted_thresholds if mv >= threshold]
        if not hit_thresholds:
            continue

        # Emit a single signal per trade at the highest threshold reached.
        selected_threshold = hit_thresholds[-1]
        signals.append(
            WhaleSignal(
                symbol=symbol.upper(),
                matched_value=mv,
                side=trade_side,
                threshold=selected_threshold,
                ts=trade_ts,
            )
        )
    return signals


def _build_explainability(
    matched_value: float,
    threshold: float,
    normalized_side: str,
    size_class: str,
    event_score: float,
) -> dict:
    """Generate why_triggered text bullets and next_checks action list for a whale event."""
    why: list[str] = []

    # Ratio to threshold
    try:
        ratio = float(matched_value) / float(threshold) if threshold > 0 else 0.0
        if ratio >= 1.0:
            why.append(f"{ratio:.1f}x threshold value")
    except (TypeError, ZeroDivisionError):
        pass

    # Size class label
    if size_class == "shark":
        why.append("shark-class trade (≥5B VND)")
    elif size_class == "whale":
        why.append("whale-class trade (≥1B VND)")
    else:
        why.append("threshold-crossing trade")

    # Side context
    if normalized_side == "buy":
        why.append("buy-side accumulation signal")
    elif normalized_side == "sell":
        why.append("sell-side distribution signal")
    else:
        why.append("neutral/mixed flow")

    # Conviction level
    if event_score >= 7:
        why.append(f"high conviction signal (score {event_score:.1f})")
    elif event_score >= 5:
        why.append(f"moderate conviction (score {event_score:.1f})")

    # next_checks action tokens
    checks: list[str] = ["compare_dark_flow"]
    if size_class == "shark":
        checks.append("check_depth_wall")
    if normalized_side == "buy":
        checks.append("check_related_symbols")
    elif normalized_side == "sell":
        checks.append("monitor_reversal")
    if event_score >= 7:
        checks.append("verify_inst_footprint")
    if "check_related_symbols" not in checks:
        checks.append("check_related_symbols")

    return {
        "why_triggered": why,
        "next_checks": checks,
    }


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
    normalized_ts = _normalize_whale_timestamp(signal.ts)
    normalized_signal = WhaleSignal(
        symbol=signal.symbol,
        matched_value=signal.matched_value,
        side=signal.side,
        threshold=signal.threshold,
        ts=normalized_ts,
    )
    event_id = _build_whale_event_id(normalized_signal, normalized_side)
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
    size_class = _classify_signal_size(signal.matched_value)
    explainability = _build_explainability(
        matched_value=signal.matched_value,
        threshold=signal.threshold,
        normalized_side=normalized_side,
        size_class=size_class,
        event_score=score_result["event_score"],
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
        "size_class": size_class,
        "event_score": score_result["event_score"],
        "display_score": display_result["display_score"],
        "severity": display_result["severity"],
        "weights_version": score_result["weights_version"],
            "freshness_bucket": _derive_freshness_bucket(normalized_ts),
            "recovered": recovered,
        "why_triggered": explainability["why_triggered"],
        "next_checks": explainability["next_checks"],
        "ts": normalized_ts,
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
