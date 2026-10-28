"""Celery task discovery shim for market_serving materializers and realtime prefetch."""

from .materializers import (
    materialize_pre_open_snapshots,
    materialize_session_facts,
    materialize_symbol_snapshot,
    materialize_unified_alerts,
)
from .realtime_prefetch import (
    prefetch_realtime_ticker_shard,
    schedule_realtime_prefetch_shards,
)

__all__ = [
    'materialize_pre_open_snapshots',
    'materialize_session_facts',
    'materialize_symbol_snapshot',
    'materialize_unified_alerts',
    'prefetch_realtime_ticker_shard',
    'schedule_realtime_prefetch_shards',
]