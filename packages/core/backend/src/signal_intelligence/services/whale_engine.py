WhaleSignalEngine - Single Source of Truth for whale detection logic

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional, List, Dict, Any

import pandas as pd
from django.db import models

from signal_intelligence.order_flow_engine import (
    load_session_ticks_df,
    detect_whale_ticks,
    detect_dark_flow_windows,
    compute_cvd_buckets_df,
    WHALE_VALUE_MIN_VND,
    DARK_FLOW_VALUE_MIN_VND,
    DARK_FLOW_BUY_RATIO_MIN,
    DARK_FLOW_PRICE_CV_MAX,
)

logger = logging.getLogger(__name__)


@dataclass
class WhaleSignalConfig:
    """Configuration for whale signal detection."""
    whale_value_min_vnd: int = WHALE_VALUE_MIN_VND
    dark_flow_value_min_vnd: int = DARK_FLOW_VALUE_MIN_VND
    dark_flow_buy_ratio_min: float = DARK_FLOW_BUY_RATIO_MIN
    dark_flow_price_cv_max: float = DARK_FLOW_PRICE_CV_MAX


@dataclass
class WhaleSignal:
    """A detected whale signal."""
    symbol: str
    session_date: date
    signal_type: str
    side: str
    strength: float
    whale_intensity: float
    price: float
    volume: int
    cvd: float
    metadata: Dict[str, Any]


class WhaleSignalEngine:
    """
    Single Source of Truth for whale detection logic.

    Consolidates threshold resolution, side detection, and signal aggregation
    to ensure consistency between alerts and advisories.
    """

    def __init__(self, config: Optional[WhaleSignalConfig] = None):
        self.config = config or WhaleSignalConfig()

    def resolve_whale_threshold(self, user=None) -> int:
        """
        Resolve whale threshold for a user.

        Args:
            user: User object (optional). If None, returns global default.

        Returns:
            Threshold in VND (e.g., 500_000_000 for 500M VND)
        """
        if user is None:
            return self.config.whale_value_min_vnd

        # Try to get user-specific threshold from UserProfile
        try:
            from identity_access.models import UserProfile
            profile = UserProfile.objects.filter(user=user).first()
            if profile and profile.whale_alert_threshold:
                # User threshold is in "units of 1M VND" (e.g., 500 = 500M VND)
                return int(profile.whale_alert_threshold) * 1_000_000
        except Exception:
            pass

        return self.config.whale_value_min_vnd

    def get_large_flows(self, symbol: Optional[str] = None, scope: str = "watchlist", user=None) -> List[WhaleSignal]:
        """
        Returns filtered flows based on user config or global market thresholds.

        Args:
            symbol: Specific symbol to analyze (None = all)
            scope: 'watchlist' (user's tracked symbols) or 'market' (all symbols)
            user: User object for watchlist filtering and threshold resolution
        """
        from market_data.models import IntradayTick
        from django.db.models import Count

        session_date = self._get_latest_session_date()
        if session_date is None:
            return []

        qs = IntradayTick.objects.filter(timestamp__date=session_date)

        if scope == "watchlist" and user:
            # Filter by user's tracked symbols
            from user_workspace.models import TrackedSymbol
            tracked = TrackedSymbol.objects.filter(user=user, is_active=True).values_list("symbol", flat=True)
            qs = qs.filter(symbol__in=tracked)
        elif symbol:
            qs = qs.filter(symbol=symbol.upper())

        symbols = list(qs.values("symbol").annotate(cnt=Count("id")).order_by("-cnt").values_list("symbol", flat=True))[:500]

        # Resolve user-specific threshold
        user_threshold = self.resolve_whale_threshold(user)

        signals = []
        for sym in symbols:
            try:
                df = load_session_ticks_df(sym, session_date)
                if df.empty:
                    continue
                sym_signals = self._detect_signals_for_symbol(df, sym, session_date, user_threshold)
                signals.extend(sym_signals)
            except Exception as exc:
                logger.exception("get_large_flows: error for %s: %s", sym, exc)
                continue

        return signals

    def _detect_signals_for_symbol(self, df: pd.DataFrame, symbol: str, session_date: date, whale_threshold: int) -> List[WhaleSignal]:
        """Detect all signal types for a single symbol."""
        signals = []

        # 1. Per-tick whale detection
        whale_df = detect_whale_ticks(df, whale_threshold)
        for _, row in whale_df.iterrows():
            signals.append(WhaleSignal(
                symbol=symbol,
                session_date=session_date,
                signal_type="whale_buy" if row["side"] == "BUY" else "whale_sell",
                side=row["side"],
                strength=min(1.0, row["value"] / 5_000_000_000),
                whale_intensity=min(1.0, row["value"] / 5_000_000_000),
                price=float(row["price"]),
                volume=int(row["volume"]),
                cvd=0.0,  # Will be filled below
                metadata={"source": "pandas_tick_engine", "value": float(row["value"])}
            ))

        # 2. CVD for context
        cvd_df = compute_cvd_buckets_df(df, bucket_minutes=1)
        final_cvd = float(cvd_df["cumulative_cvd"].iloc[-1]) if not cvd_df.empty else 0.0

        # Update CVD on whale signals
        for sig in signals:
            sig.cvd = final_cvd

        # 3. Dark flow detection
        dark_flow_windows = detect_dark_flow_windows(
            df,
            value_min_vnd=self.config.dark_flow_value_min_vnd,
            buy_ratio_min=self.config.dark_flow_buy_ratio_min,
            price_cv_max=self.config.dark_flow_price_cv_max,
        )
        for window in dark_flow_windows:
            signals.append(WhaleSignal(
                symbol=symbol,
                session_date=session_date,
                signal_type="dark_flow",
                side="BUY" if window["buy_ratio"] > 0.5 else "SELL",
                strength=window["strength"],
                whale_intensity=window["strength"] * 0.7,
                price=window["avg_price"],
                volume=window["total_volume"],
                cvd=final_cvd,
                metadata={
                    "source": "pandas_dark_flow_engine",
                    "window_start": window["window_start"].isoformat() if hasattr(window["window_start"], "isoformat") else str(window["window_start"]),
                    "window_end": window["window_end"].isoformat() if hasattr(window["window_end"], "isoformat") else str(window["window_end"]),
                    "buy_ratio": window["buy_ratio"],
                    "price_cv": window["price_cv"],
                    "total_value": window["total_value"],
                }
            ))

        return signals

    def detect_side(self, tick_data: Dict[str, Any]) -> str:
        """Canonical side detection algorithm."""
        # Tick-by-tick side from exchange
        side = tick_data.get("side", "").upper()
        if side in ("BUY", "SELL"):
            return side
        # Fallback: infer from price movement
        return "UNKNOWN"

    def _get_latest_session_date(self) -> Optional[date]:
        from market_data.models import IntradayTick
        latest = IntradayTick.objects.order_by("-timestamp").values_list("timestamp", flat=True).first()
        if latest is None:
            return None
        return latest.date()

    def get_market_discovery_symbols(self, limit: int = 10, session_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """Get top symbols by whale activity for market discovery mode."""
        if session_date is None:
            session_date = self._get_latest_session_date()
        if session_date is None:
            return []

        from market_data.models import IntradayTick
        from django.db.models import Sum, Count

        # Aggregate by symbol for the session
        qs = IntradayTick.objects.filter(timestamp__date=session_date)
        symbol_stats = qs.values("symbol").annotate(
            total_value=Sum("price", output_field=models.DecimalField()) * Sum("volume", output_field=models.BigIntegerField()),
            buy_value=Sum("price", filter=models.Q(side="BUY"), output_field=models.DecimalField()) * Sum("volume", filter=models.Q(side="BUY"), output_field=models.BigIntegerField()),
            sell_value=Sum("price", filter=models.Q(side="SELL"), output_field=models.DecimalField()) * Sum("volume", filter=models.Q(side="SELL"), output_field=models.BigIntegerField()),
            tick_count=Count("id"),
        ).order_by("-total_value")[:limit]

        results = []
        for stat in symbol_stats:
            results.append({
                "symbol": stat["symbol"],
                "total_value": float(stat["total_value"] or 0),
                "buy_value": float(stat["buy_value"] or 0),
                "sell_value": float(stat["sell_value"] or 0),
                "tick_count": stat["tick_count"],
                "net_flow": float(stat["buy_value"] or 0) - float(stat["sell_value"] or 0),
            })

        return results