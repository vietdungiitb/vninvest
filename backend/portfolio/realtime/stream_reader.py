"""
StreamReader — helper để API views đọc dữ liệu theo 3-tier fallback:

  Tier 1: Redis Stream (XREVRANGE) — real-time, ms latency
  Tier 2: Redis Cache (Django cache) — TTL cache từ trước
  Tier 3: vnbroker direct call — chậm nhất, nguồn gốc

Cách dùng trong view:
    from portfolio.realtime.stream_reader import StreamReader

    reader = StreamReader()
    data = reader.get_intraday(symbol, count=200)
    snapshot = reader.get_snapshot(symbol)
    is_ok, status = reader.health(symbol)
"""
from __future__ import annotations

import logging
import time
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class StreamReader:
    """3-tier fallback reader: Stream → Cache → vnbroker."""

    def __init__(self) -> None:
        self._producer = None

    @property
    def producer(self):
        if self._producer is None:
            try:
                from portfolio.realtime.tick_producer import TickProducer
                self._producer = TickProducer()
            except Exception as exc:
                logger.warning("StreamReader: TickProducer init failed: %s", exc)
        return self._producer

    # ------------------------------------------------------------------
    # Tier 1: Stream
    # ------------------------------------------------------------------
    def _from_stream(self, symbol: str, count: int = 200) -> list[dict] | None:
        if self.producer is None:
            return None
        try:
            ticks = self.producer.read_latest_ticks(symbol, count=count)
            if ticks and self._is_stream_payload_stale(ticks):
                logger.info("StreamReader._from_stream(%s): ignore stale stream payload", symbol)
                return None
            return ticks if ticks else None
        except Exception as exc:
            logger.warning("StreamReader._from_stream(%s): %s", symbol, exc)
            return None

    def _is_stream_payload_stale(self, ticks: list[dict]) -> bool:
        """
        Redis stream can contain old ticks when collector is down.
        If newest message is too old, skip stream tier and fallback.
        """
        if not ticks:
            return True

        stale_after_seconds = int(getattr(settings, "STREAM_STALE_AFTER_SECONDS", 120) or 120)
        newest = ticks[0] or {}
        stream_id = str(newest.get("stream_id") or "")
        if not stream_id or "-" not in stream_id:
            return False

        try:
            stream_ms = int(stream_id.split("-", 1)[0])
            age_seconds = max(0.0, time.time() - (stream_ms / 1000.0))
            return age_seconds > stale_after_seconds
        except (TypeError, ValueError):
            return False

    def _snapshot_from_stream(self, symbol: str) -> dict | None:
        if self.producer is None:
            return None
        try:
            return self.producer.read_snapshot(symbol)
        except Exception as exc:
            logger.warning("StreamReader._snapshot_from_stream(%s): %s", symbol, exc)
            return None

    # ------------------------------------------------------------------
    # Tier 2: Django Cache (tái dùng _cache_get từ views.py)
    # ------------------------------------------------------------------
    def _from_cache(self, cache_key: str) -> Any | None:
        try:
            from django.core.cache import cache
            return cache.get(cache_key)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_intraday_ticks(self, symbol: str, count: int = 200) -> list[dict]:
        """Trả về list tick mới nhất — từ Stream nếu available, empty list nếu không."""
        ticks = self._from_stream(symbol, count)
        return ticks or []

    def get_snapshot(self, symbol: str) -> dict | None:
        """Trả về price snapshot mới nhất từ Stream (hoặc None)."""
        return self._snapshot_from_stream(symbol)

    def get_intraday_with_fallback(self, symbol: str, cache_key: str, count: int = 200) -> tuple[list[dict], str]:
        """
        3-tier fallback:
          - Tier 1: Stream → trả về (ticks, "stream")
          - Tier 2: Cache → trả về (cached_data, "cache")
          - Tier 3: empty → ([], "miss")
        """
        ticks = self._from_stream(symbol, count)
        if ticks:
            return ticks, "stream"

        cached = self._from_cache(cache_key)
        if cached is not None:
            return cached, "cache"

        return [], "miss"

    def health(self, symbol: str) -> tuple[bool, dict]:
        """
        Kiểm tra trạng thái stream cho một symbol.
        Trả về (is_healthy, info_dict).
        """
        info: dict = {"symbol": symbol.upper(), "stream_available": False, "tick_count": 0}
        if self.producer is None:
            info["error"] = "TickProducer unavailable"
            return False, info

        try:
            client = self.producer.client
            key = self.producer.stream_key(symbol)
            length = client.xlen(key)
            info["stream_available"] = True
            info["tick_count"] = length
            return True, info
        except Exception as exc:
            info["error"] = str(exc)
            return False, info

    def streams_health(self, symbols: list[str]) -> dict:
        """Kiểm tra tất cả symbols, trả về dict summary."""
        result = {"healthy": 0, "unhealthy": 0, "symbols": {}}
        for symbol in symbols:
            ok, info = self.health(symbol)
            result["symbols"][symbol] = info
            if ok:
                result["healthy"] += 1
            else:
                result["unhealthy"] += 1
        return result
