"""Celery task discovery shim for market_serving materializers and realtime prefetch."""

from .materializers import (
    materialize_session_facts,
    materialize_symbol_snapshot,
    materialize_pre_open_snapshots,
    materialize_unified_alerts,
)
from .realtime_prefetch import (
    schedule_realtime_prefetch_shards,
    prefetch_realtime_ticker_shard,
)

__all__ = [
    'materialize_session_facts',
    'materialize_symbol_snapshot',
    'materialize_pre_open_snapshots',
    'materialize_unified_alerts',
    'schedule_realtime_prefetch_shards',
    'prefetch_realtime_ticker_shard',
]