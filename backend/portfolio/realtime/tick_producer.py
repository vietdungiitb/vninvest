"""
TickProducer — đẩy tick data thô từ vnstock vào Redis Streams.

Stream key:   vninvest:ticks:{SYMBOL}   (db=1, maxlen=STREAM_MAX_LEN)
Snapshot key: vninvest:snapshot:{SYMBOL} (HSET, TTL=STREAM_SNAPSHOT_TTL giây)

Consumer groups được tạo sẵn trước khi producer bắt đầu push:
  - "db-writer"       → ghi IntradayTick vào PostgreSQL
  - "ws-broadcaster"  → push ticker_payload lên Channel Layer
  - "alert-engine"    → phát hiện lệnh cá mập, gửi alert
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

import pandas as pd
import redis

from django.conf import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_CONSUMER_GROUPS = ["db-writer", "ws-broadcaster", "alert-engine"]


def _get_client() -> redis.Redis:
    url = getattr(settings, "STREAM_REDIS_URL", "redis://localhost:6379/1")
    return redis.from_url(url, decode_responses=True)


class TickProducer:
    """Push intraday ticks và snapshots vào Redis Streams."""

    def __init__(self) -> None:
        self._client: redis.Redis | None = None
        self._max_len: int = getattr(settings, "STREAM_MAX_LEN", 50_000)
        self._snapshot_ttl: int = getattr(settings, "STREAM_SNAPSHOT_TTL", 60)

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = _get_client()
        return self._client

    # ------------------------------------------------------------------
    # Stream key helpers
    # ------------------------------------------------------------------
    @staticmethod
    def stream_key(symbol: str) -> str:
        return f"vninvest:ticks:{symbol.upper()}"

    @staticmethod
    def snapshot_key(symbol: str) -> str:
        return f"vninvest:snapshot:{symbol.upper()}"

    # ------------------------------------------------------------------
    # Consumer-group bootstrap
    # ------------------------------------------------------------------
    def ensure_consumer_groups(self, symbol: str) -> None:
        """Tạo consumer groups nếu chưa tồn tại (idempotent)."""
        key = self.stream_key(symbol)
        try:
            for group in _CONSUMER_GROUPS:
                try:
                    # $ = chỉ nhận message mới; mkstream=True tạo stream nếu chưa có
                    self.client.xgroup_create(key, group, id="$", mkstream=True)
                    logger.debug("Created consumer group '%s' for stream %s", group, key)
                except redis.exceptions.ResponseError as exc:
                    if "BUSYGROUP" not in str(exc):
                        raise
        except Exception as exc:
            logger.warning("ensure_consumer_groups(%s) failed: %s", symbol, exc)

    # ------------------------------------------------------------------
    # Push ticks
    # ------------------------------------------------------------------
    def push_intraday_ticks(self, symbol: str, df: pd.DataFrame) -> int:
        """
        Nhận DataFrame từ collect_intraday_frame() và push từng row vào Stream.
        Trả về số lượng tick đã push thành công.
        """
        if df is None or df.empty:
            return 0

        key = self.stream_key(symbol)
        pushed = 0
        pipe = self.client.pipeline(transaction=False)

        for _, row in df.iterrows():
            fields = {
                "symbol": symbol.upper(),
                "ts": str(row.get("ts", "")),
                "price": str(row.get("price", 0)),
                "volume": str(int(row.get("volume", 0))),
                "side": str(row.get("side", "UNKNOWN")),
            }
            pipe.xadd(key, fields, maxlen=self._max_len, approximate=True)
            pushed += 1

        try:
            pipe.execute()
        except Exception as exc:
            logger.error("push_intraday_ticks(%s) pipeline error: %s", symbol, exc)
            return 0

        return pushed

    # ------------------------------------------------------------------
    # Push price snapshot (HSET, quick access cho API views)
    # ------------------------------------------------------------------
    def push_price_snapshot(self, symbol: str, payload: dict) -> bool:
        """
        Lưu snapshot giá mới nhất dạng Hash để API views đọc nhanh mà không cần
        XREVRANGE toàn bộ stream.
        """
        key = self.snapshot_key(symbol)
        try:
            flat = {k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                    for k, v in payload.items()}
            pipe = self.client.pipeline(transaction=False)
            pipe.hset(key, mapping=flat)
            pipe.expire(key, self._snapshot_ttl)
            pipe.execute()
            return True
        except Exception as exc:
            logger.warning("push_price_snapshot(%s) error: %s", symbol, exc)
            return False

    # ------------------------------------------------------------------
    # Read latest ticks (dùng bởi API views — 3-tier fallback tier-1)
    # ------------------------------------------------------------------
    def read_latest_ticks(self, symbol: str, count: int = 200) -> list[dict]:
        """
        Đọc `count` tick mới nhất từ Stream theo thứ tự ngược (mới → cũ).
        Mỗi item: {"stream_id": ..., "ts": ..., "price": ..., "volume": ..., "side": ...}
        """
        key = self.stream_key(symbol)
        try:
            entries = self.client.xrevrange(key, count=count)
            result = []
            for stream_id, fields in entries:
                item = dict(fields)
                item["stream_id"] = stream_id
                result.append(item)
            return result
        except Exception as exc:
            logger.warning("read_latest_ticks(%s) error: %s", symbol, exc)
            return []

    def read_snapshot(self, symbol: str) -> dict | None:
        """Đọc snapshot giá mới nhất từ Hash key."""
        key = self.snapshot_key(symbol)
        try:
            data = self.client.hgetall(key)
            if not data:
                return None
            result = {}
            for k, v in data.items():
                try:
                    result[k] = json.loads(v)
                except (json.JSONDecodeError, TypeError):
                    result[k] = v
            return result
        except Exception as exc:
            logger.warning("read_snapshot(%s) error: %s", symbol, exc)
            return None
