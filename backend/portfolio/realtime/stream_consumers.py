"""
Stream Consumers — đọc từ Redis Streams và xử lý theo consumer group.

Ba consumer groups:
  1. "db-writer"       → ghi IntradayTick vào DB (bulk_create)
  2. "ws-broadcaster"  → build ticker/whale payload, push Channel Layer
  3. "alert-engine"    → phát hiện lệnh cá mập, gọi RealtimePublisher

Chạy qua management command: python manage.py run_stream_consumers
Hoặc qua Celery task: run_stream_consumer_worker.delay(group)
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, date
from decimal import Decimal
from typing import Callable

import redis

from django.conf import settings

logger = logging.getLogger(__name__)


def _get_stream_client() -> redis.Redis:
    url = getattr(settings, "STREAM_REDIS_URL", "redis://localhost:6379/1")
    return redis.from_url(url, decode_responses=True)


# ---------------------------------------------------------------------------
# Base consumer
# ---------------------------------------------------------------------------
class TickConsumerBase:
    """
    Base class: đọc pending + new messages từ một consumer group,
    gọi process_batch(), xác nhận XACK sau khi xử lý thành công.
    """

    group_name: str = ""
    consumer_name: str = "worker-1"

    def __init__(self, consumer_name: str | None = None) -> None:
        self._client: redis.Redis | None = None
        self._batch_size: int = getattr(settings, "STREAM_CONSUMER_BATCH", 100)
        self._block_ms: int = getattr(settings, "STREAM_BLOCK_MS", 2000)
        if consumer_name:
            self.consumer_name = consumer_name

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = _get_stream_client()
        return self._client

    @staticmethod
    def stream_key(symbol: str) -> str:
        return f"vninvest:ticks:{symbol.upper()}"

    def process_batch(self, symbol: str, messages: list[tuple[str, dict]]) -> None:
        """Override trong subclass. messages = [(stream_id, fields), ...]"""
        raise NotImplementedError

    def run_once(self, symbol: str) -> int:
        """Đọc 1 batch và xử lý. Trả về số message đã xử lý."""
        key = self.stream_key(symbol)
        try:
            # Đọc pending trước (bị crash lần trước chưa ACK)
            pending = self.client.xreadgroup(
                self.group_name, self.consumer_name,
                {key: "0"}, count=self._batch_size,
            )
            # Sau đó đọc mới
            new_msgs = self.client.xreadgroup(
                self.group_name, self.consumer_name,
                {key: ">"}, count=self._batch_size, block=self._block_ms,
            )

            all_entries: list[tuple[str, dict]] = []
            for stream_result in (pending or []) + (new_msgs or []):
                _key, messages = stream_result
                all_entries.extend(messages)

            if not all_entries:
                return 0

            self.process_batch(symbol, all_entries)

            # ACK
            ids = [sid for sid, _ in all_entries]
            self.client.xack(key, self.group_name, *ids)
            return len(ids)

        except redis.exceptions.ResponseError as exc:
            if "NOGROUP" in str(exc):
                logger.warning("Consumer group '%s' not found for %s, skipping", self.group_name, key)
            else:
                logger.error("Redis error in %s.run_once(%s): %s", self.__class__.__name__, symbol, exc)
            return 0
        except Exception as exc:
            logger.error("Consumer error in %s.run_once(%s): %s", self.__class__.__name__, symbol, exc)
            return 0


# ---------------------------------------------------------------------------
# 1. DbWriterConsumer
# ---------------------------------------------------------------------------
class DbWriterConsumer(TickConsumerBase):
    """Ghi ticks vào IntradayTick model (bulk_create, ignore_conflicts)."""

    group_name = "db-writer"
    consumer_name = "db-writer-1"

    def process_batch(self, symbol: str, messages: list[tuple[str, dict]]) -> None:
        from portfolio.models import IntradayTick

        objs: list[IntradayTick] = []
        for stream_id, fields in messages:
            try:
                ts_str = fields.get("ts", "")
                price_str = fields.get("price", "0")
                volume_str = fields.get("volume", "0")
                side_str = fields.get("side", "UNKNOWN")

                # Parse timestamp
                try:
                    if " " in ts_str:
                        dt = datetime.fromisoformat(ts_str)
                    elif "T" in ts_str:
                        dt = datetime.fromisoformat(ts_str.replace("Z", ""))
                    else:
                        dt = datetime.now()
                except (ValueError, TypeError):
                    dt = datetime.now()

                trade_date = dt.date() if isinstance(dt, datetime) else date.today()
                trade_time = dt.time() if isinstance(dt, datetime) else datetime.now().time()

                objs.append(IntradayTick(
                    symbol=symbol.upper(),
                    trade_date=trade_date,
                    trade_time=trade_time,
                    price=Decimal(str(price_str)),
                    volume=int(float(volume_str)),
                    side=side_str if side_str in ("BUY", "SELL") else "UNKNOWN",
                    stream_id=stream_id,
                ))
            except Exception as exc:
                logger.warning("DbWriter: skip bad tick %s: %s", stream_id, exc)

        if objs:
            try:
                IntradayTick.objects.bulk_create(objs, ignore_conflicts=True)
                logger.debug("DbWriter: wrote %d ticks for %s", len(objs), symbol)
            except Exception as exc:
                logger.error("DbWriter: bulk_create failed for %s: %s", symbol, exc)


# ---------------------------------------------------------------------------
# 2. WsBroadcastConsumer
# ---------------------------------------------------------------------------
class WsBroadcastConsumer(TickConsumerBase):
    """Build ticker_payload từ batch và push lên Channel Layer."""

    group_name = "ws-broadcaster"
    consumer_name = "ws-broadcaster-1"

    def process_batch(self, symbol: str, messages: list[tuple[str, dict]]) -> None:
        import pandas as pd
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from portfolio.realtime.compute import build_ticker_payload

        rows = []
        for stream_id, fields in messages:
            try:
                rows.append({
                    "ts": fields.get("ts", ""),
                    "price": float(fields.get("price", 0)),
                    "volume": float(fields.get("volume", 0)),
                    "side": fields.get("side", "UNKNOWN"),
                })
            except (ValueError, TypeError):
                pass

        if not rows:
            return

        df = pd.DataFrame(rows)
        seq = int(time.time() * 1000) % 2**31
        payload = build_ticker_payload(symbol=symbol, trades_df=df, seq=seq)

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        group = f"ticker_{symbol.upper()}"
        try:
            async_to_sync(channel_layer.group_send)(
                group,
                {
                    "type": "ticker_update",
                    "payload": payload,
                },
            )
        except Exception as exc:
            logger.warning("WsBroadcast: group_send(%s) failed: %s", group, exc)


# ---------------------------------------------------------------------------
# 3. AlertEngineConsumer
# ---------------------------------------------------------------------------
class AlertEngineConsumer(TickConsumerBase):
    """Phát hiện lệnh cá mập và publish alert qua RealtimePublisher."""

    group_name = "alert-engine"
    consumer_name = "alert-engine-1"

    def process_batch(self, symbol: str, messages: list[tuple[str, dict]]) -> None:
        import pandas as pd
        from portfolio.realtime.compute import detect_whale_signals, build_whale_payload
        from portfolio.realtime.publisher import RealtimePublisher
        from portfolio.services import resolve_whale_runtime_config

        rows = []
        for stream_id, fields in messages:
            try:
                rows.append({
                    "ts": fields.get("ts", ""),
                    "price": float(fields.get("price", 0)),
                    "volume": float(fields.get("volume", 0)),
                    "side": fields.get("side", "UNKNOWN"),
                })
            except (ValueError, TypeError):
                pass

        if not rows:
            return

        df = pd.DataFrame(rows)
        publisher = RealtimePublisher()
        runtime_config = resolve_whale_runtime_config(
            symbol=symbol,
            worker_name=self.consumer_name,
            source='stream_consumer',
        )
        thresholds = runtime_config['thresholds_vnd'] or [float(getattr(settings, "REALTIME_DEFAULT_WHALE_THRESHOLD", 500_000_000))]

        for signal in detect_whale_signals(symbol=symbol, trades_df=df, thresholds=thresholds):
            seq = int(time.time() * 1000) % 2**31
            payload = build_whale_payload(
                signal=signal,
                seq=seq,
                config_version=runtime_config['version_code'],
                source=f"intraday-engine:{runtime_config['mode']}",
                score_config=runtime_config['score_config'],
            )
            channel = f"whale:{symbol.upper()}"
            publisher.publish(channel, payload)
