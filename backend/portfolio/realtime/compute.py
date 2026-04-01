from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import pandas as pd


@dataclass
class WhaleSignal:
    symbol: str
    matched_value: float
    side: str
    threshold: float
    ts: str


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    side_series = frame.get("side")

    signals: list[WhaleSignal] = []
    max_matched = float(frame["matched_value"].max()) if not frame.empty else 0.0
    if max_matched <= 0:
        return signals

    last_side = "UNKNOWN"
    if side_series is not None and len(side_series) > 0:
        last_side = str(side_series.iloc[-1]).upper()

    for threshold in sorted(set(float(t) for t in thresholds if float(t) > 0)):
        if max_matched >= threshold:
            signals.append(
                WhaleSignal(
                    symbol=symbol.upper(),
                    matched_value=max_matched,
                    side=last_side,
                    threshold=threshold,
                    ts=_iso_now(),
                )
            )
    return signals


def build_whale_payload(signal: WhaleSignal, seq: int, contract_version: str = "1.0") -> dict:
    return {
        "event_type": "whale_alert",
        "contract_version": contract_version,
        "symbol": signal.symbol,
        "matched_value": signal.matched_value,
        "side": signal.side,
        "threshold": signal.threshold,
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
