"""Shared Redis connection pool for the realtime pipeline.

All realtime modules (TickProducer, stream_consumers, RealtimePublisher)
should use get_stream_client() from this module instead of creating their
own redis.from_url() connections. This prevents connection exhaustion
under sustained Celery task throughput.
"""
from __future__ import annotations

import redis
from django.conf import settings

_stream_pool: redis.ConnectionPool | None = None


def get_stream_pool() -> redis.ConnectionPool:
    """Return a singleton ConnectionPool for the stream Redis instance."""
    global _stream_pool
    if _stream_pool is None:
        url = getattr(settings, "STREAM_REDIS_URL", "redis://localhost:6379/1")
        _stream_pool = redis.ConnectionPool.from_url(url, decode_responses=True)
    return _stream_pool


def get_stream_client() -> redis.Redis:
    """Return a Redis client backed by the shared connection pool."""
    return redis.Redis(connection_pool=get_stream_pool())
