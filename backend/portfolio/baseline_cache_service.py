"""
Baseline Cache Service — P1D1-08.

Cung cấp interface lưu/lấy baseline context cho từng symbol.
Baseline context bao gồm: ADV (Average Daily Volume/Value), session volume
percentiles, và price range anchors — dùng để tính abnormality score cho
whale events so với historical norm.

Phase 1 skeleton: tất cả method đều compile và expose đúng interface.
Actual data fetch từ IntradayTick/vnstock được wire vào Phase 1 Week 2.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_BASELINE_CACHE_TTL = int(getattr(settings, "BASELINE_CACHE_TTL_SECONDS", 300))
_BASELINE_ENABLED = bool(getattr(settings, "BASELINE_CACHE_ENABLED", False))

# Cache key prefix
_KEY_PREFIX = "vninvest:baseline:"


def _get_redis_client():
    import redis
    url = getattr(settings, "CACHE_REDIS_URL", "redis://localhost:6379/2")
    return redis.from_url(url, decode_responses=False)


class BaselineCacheService:
    """
    Skeleton service cung cấp baseline context cho abnormality scoring.

    Interface contract (Phase 1):
    - get_cached_baseline(symbol) -> dict | None
    - set_cached_baseline(symbol, data, ttl) -> None
    - fetch_symbol_baseline(symbol, days=20) -> dict
    - get_adv_relative(symbol, matched_value) -> float | None
    - refresh_symbol_baseline(symbol) -> dict
    """

    def __init__(self) -> None:
        self._redis = None

    @property
    def redis(self):
        if self._redis is None:
            try:
                self._redis = _get_redis_client()
            except Exception as exc:
                logger.warning("BaselineCacheService: Redis connect failed: %s", exc)
        return self._redis

    # ------------------------------------------------------------------
    # Cache primitives
    # ------------------------------------------------------------------

    def get_cached_baseline(self, symbol: str) -> dict | None:
        """Return cached baseline dict for symbol, or None if missing/expired."""
        if not _BASELINE_ENABLED or self.redis is None:
            return None
        try:
            import json
            key = f"{_KEY_PREFIX}{symbol.upper()}"
            raw = self.redis.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.debug("BaselineCacheService.get_cached_baseline(%s): %s", symbol, exc)
            return None

    def set_cached_baseline(self, symbol: str, data: dict, ttl: int = _BASELINE_CACHE_TTL) -> None:
        """Persist baseline dict to Redis with TTL."""
        if not _BASELINE_ENABLED or self.redis is None:
            return
        try:
            import json
            key = f"{_KEY_PREFIX}{symbol.upper()}"
            self.redis.set(key, json.dumps(data, default=str), ex=ttl)
        except Exception as exc:
            logger.debug("BaselineCacheService.set_cached_baseline(%s): %s", symbol, exc)

    # ------------------------------------------------------------------
    # Baseline fetch (stub — Phase 1 Week 2 will wire real data)
    # ------------------------------------------------------------------

    def fetch_symbol_baseline(self, symbol: str, days: int = 20) -> dict:
        """
        Fetch baseline statistics for symbol over last `days` trading days.

        Returns a dict with keys:
          adv_vnd         — Average Daily Value (VND) over the window
          adv_volume      — Average Daily Volume (shares)
          p50_session_vnd — Median single-trade matched_value in session
          p90_session_vnd — 90th percentile matched_value in session
          p99_session_vnd — 99th percentile matched_value in session
          price_anchor    — Last known closing price
          computed_at     — ISO timestamp

        Phase 1 skeleton returns a structured empty/null result so the
        caller interface is stable before the computation logic lands.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "symbol": symbol.upper(),
            "days": days,
            "adv_vnd": None,
            "adv_volume": None,
            "p50_session_vnd": None,
            "p90_session_vnd": None,
            "p99_session_vnd": None,
            "price_anchor": None,
            "computed_at": now_iso,
            "source": "skeleton",
        }

    def refresh_symbol_baseline(self, symbol: str, days: int = 20) -> dict:
        """
        Fetch fresh baseline and populate cache.  Returns the baseline dict.
        """
        data = self.fetch_symbol_baseline(symbol=symbol, days=days)
        self.set_cached_baseline(symbol=symbol, data=data, ttl=_BASELINE_CACHE_TTL)
        return data

    def get_or_refresh_baseline(self, symbol: str, days: int = 20) -> dict:
        """
        Return cached baseline if available; otherwise fetch, cache, and return.
        """
        cached = self.get_cached_baseline(symbol)
        if cached is not None:
            return cached
        return self.refresh_symbol_baseline(symbol=symbol, days=days)

    # ------------------------------------------------------------------
    # Derived metrics
    # ------------------------------------------------------------------

    def get_adv_relative(self, symbol: str, matched_value: float) -> float | None:
        """
        Return matched_value / adv_vnd ratio for abnormality context.
        Returns None when baseline is unavailable or adv_vnd is None/zero.
        """
        baseline = self.get_cached_baseline(symbol)
        if baseline is None:
            return None
        adv = baseline.get("adv_vnd")
        if not adv or float(adv) <= 0:
            return None
        try:
            return round(float(matched_value) / float(adv), 4)
        except (TypeError, ValueError, ZeroDivisionError):
            return None

    def get_session_percentile(self, symbol: str, matched_value: float) -> str | None:
        """
        Classify matched_value against session percentiles.
        Returns "p99+" | "p90-p99" | "p50-p90" | "below_p50" | None.
        """
        baseline = self.get_cached_baseline(symbol)
        if baseline is None:
            return None
        try:
            mv = float(matched_value)
            p99 = float(baseline.get("p99_session_vnd") or 0)
            p90 = float(baseline.get("p90_session_vnd") or 0)
            p50 = float(baseline.get("p50_session_vnd") or 0)
            if p99 > 0 and mv >= p99:
                return "p99+"
            if p90 > 0 and mv >= p90:
                return "p90-p99"
            if p50 > 0 and mv >= p50:
                return "p50-p90"
            if p50 > 0:
                return "below_p50"
            return None
        except (TypeError, ValueError):
            return None


# Module-level singleton — import once, reuse
_service: BaselineCacheService | None = None


def get_baseline_cache_service() -> BaselineCacheService:
    global _service
    if _service is None:
        _service = BaselineCacheService()
    return _service


def enrich_campaign_with_baseline(campaign: dict) -> dict:
    """
    Optional enrichment: add baseline_context block to a WhaleCampaign dict.
    No-ops when BASELINE_CACHE_ENABLED=False or baseline unavailable.
    Returns the same dict (mutated in place) for chaining.
    """
    if not _BASELINE_ENABLED:
        return campaign

    symbol = campaign.get("symbol", "")
    total_mv = campaign.get("total_matched_value")

    if not symbol or total_mv is None:
        return campaign

    svc = get_baseline_cache_service()
    baseline = svc.get_cached_baseline(symbol)
    if baseline is None:
        return campaign

    campaign["baseline_context"] = {
        "adv_relative": svc.get_adv_relative(symbol, float(total_mv)),
        "session_percentile": svc.get_session_percentile(symbol, float(total_mv)),
        "adv_vnd": baseline.get("adv_vnd"),
        "price_anchor": baseline.get("price_anchor"),
    }
    return campaign
