"""Tính lại OHLCV cho các bucket IntradayBar bị ảnh hưởng từ TOÀN BỘ IntradayTick trong DB.

S1 / REQ-BE-M01: đường nóng `warm_intraday_universe` trước đây chỉ dùng các tick trong
1 batch tape rồi `bulk_create(update_conflicts=True)` ghi đè lên cả cây nến — làm cụt
volume (91/117 nến 1H của VIC, tới 176x). Helper này là phần tách ra để tính lại từ
toàn bộ tick thuộc bucket, tránh phình `data_ingest/tasks.py` (3846 dòng).

Bất biến G-3a: hàm `floor_bucket` được truyền vào từ `data_ingest.tasks` — chính là
`_floor_intraday_bucket` — nên quy ước múi giờ của khung `2H`/`4H` giống hệt
`synthesize_intraday_bars_from_ticks` (cùng một hàm floor). Không tự floor lại ở đây.
"""
from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from typing import Any, Callable, Iterable

_BucketKey = tuple[str, datetime]


def _resolve_source(sources: set[str]) -> str:
    """Nhãng nguồn bar theo tick thật — khớp `_synthesize_bars_from_db_ticks`."""
    if any('dnse' in source for source in sources):
        return 'dnse_backfill'
    if not sources or any('vnbroker' in source for source in sources):
        return 'vnbroker_intraday'
    return sorted(sources)[0]


def recompute_bar_payloads_from_ticks(
    symbol: str,
    tick_rows: Iterable[dict[str, Any]],
    affected_keys: set[_BucketKey],
    floor_bucket: Callable[[datetime, str], datetime],
    timeframes: tuple[str, ...],
) -> dict[_BucketKey, dict[str, Any]]:
    """Trả về payload OHLCV chỉ cho các `(timeframe, bucket_ts)` trong `affected_keys`.

    - `tick_rows`: dict có `timestamp`, `price`, `volume`, tuỳ chọn `source`.
    - Mọi tick trong cùng bucket đều được cộng dồn — không phải batch partial.
    - Những bucket không nằm trong `affected_keys` bị bỏ qua (tránh ghi đè bucket khác).
    """
    buckets: dict[_BucketKey, dict[str, Any]] = {}
    ordered = sorted(tick_rows, key=lambda row: row['timestamp'])

    for row in ordered:
        timestamp = row['timestamp']
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=dt_timezone.utc)
        price = Decimal(str(row['price']))
        volume = int(row.get('volume') or 0)
        source = str(row.get('source') or '')

        for timeframe in timeframes:
            key: _BucketKey = (timeframe, floor_bucket(timestamp, timeframe))
            if key not in affected_keys:
                continue
            payload = buckets.get(key)
            if payload is None:
                buckets[key] = {
                    'symbol': symbol,
                    'datetime': key[1],
                    'timeframe': timeframe,
                    'open': price,
                    'high': price,
                    'low': price,
                    'close': price,
                    'volume': volume,
                    '_sources': {source} if source else set(),
                }
                continue
            payload['high'] = max(payload['high'], price)
            payload['low'] = min(payload['low'], price)
            payload['close'] = price
            payload['volume'] += volume
            if source:
                payload['_sources'].add(source)

    for payload in buckets.values():
        sources: set[str] = payload.pop('_sources')
        payload['source'] = _resolve_source(sources)
    return buckets
