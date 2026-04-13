from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


@shared_task(bind=True, name='portfolio.tasks.run_stream_consumer_batch', autoretry_for=(Exception,), retry_backoff=False, retry_kwargs={"max_retries": 0})
def run_stream_consumer_batch(self, group: str = "all") -> dict:
    """Run one batch of realtime stream consumers for active symbols."""
    from portfolio import tasks as tasks_facade
    from portfolio.realtime.stream_consumers import (
        AlertEngineConsumer,
        DbWriterConsumer,
        WsBroadcastConsumer,
    )

    worker_name = getattr(self.request, 'hostname', '') or f'{group}-worker'
    consumers = []
    if group in ("all", "db-writer"):
        consumers.append(DbWriterConsumer(consumer_name=worker_name))
    if group in ("all", "ws-broadcaster"):
        consumers.append(WsBroadcastConsumer(consumer_name=worker_name))
    if group in ("all", "alert-engine"):
        consumers.append(AlertEngineConsumer(consumer_name=worker_name))

    symbols = tasks_facade.collect_symbols_for_user(user_id=None)
    if not symbols:
        return {"status": "ok", "processed": 0}

    total = 0
    for symbol in symbols:
        for consumer in consumers:
            try:
                total += consumer.run_once(symbol)
            except Exception as exc:
                logger.warning("consumer.run_once(%s, %s) error: %s", group, symbol, exc)

    return {"status": "ok", "group": group, "symbols": len(symbols), "processed": total}


@shared_task(bind=True, name='portfolio.tasks.cleanup_old_intraday_ticks', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def cleanup_old_intraday_ticks(self, keep_days: int = 7) -> dict:
    """Delete old IntradayTick rows to keep database size stable."""
    from datetime import date, timedelta

    from portfolio.models import IntradayTick

    cutoff = date.today() - timedelta(days=keep_days)
    deleted, _ = IntradayTick.objects.filter(trade_date__lt=cutoff).delete()
    logger.info("EOD cleanup: deleted %d IntradayTick records older than %s", deleted, cutoff)
    return {"status": "ok", "deleted": deleted, "cutoff": str(cutoff)}


@shared_task(bind=True, name='portfolio.tasks.run_vnstock_price_board_benchmark', autoretry_for=(), retry_kwargs={"max_retries": 0})
def run_vnstock_price_board_benchmark(self, payload: dict | None = None) -> dict:
    """Chạy benchmark provider price board và lưu kết quả vào cache.

    Được dispatch bất đồng bộ từ view để tránh gateway timeout.
    """
    from portfolio.vnstock_provider_benchmark import (
        BENCHMARK_CACHE_KEY,
        BENCHMARK_CACHE_TTL_SECONDS,
        run_price_board_provider_benchmark,
        _utc_now_iso,
    )

    try:
        report = run_price_board_provider_benchmark(payload or {})
        logger.info(
            'run_vnstock_price_board_benchmark completed: providers=%s results=%d',
            report.get('providers'),
            len(report.get('results', [])),
        )
        return {'status': 'ok', 'finished_at': report.get('finished_at')}
    except Exception as exc:  # noqa: BLE001
        logger.warning('run_vnstock_price_board_benchmark failed: %s', exc)
        try:
            cache.set(
                BENCHMARK_CACHE_KEY,
                {
                    'status': 'failed',
                    'started_at': _utc_now_iso(),
                    'finished_at': _utc_now_iso(),
                    'results': [],
                    'recommendation': None,
                    'error': str(exc),
                },
                timeout=BENCHMARK_CACHE_TTL_SECONDS,
            )
        except Exception:
            pass
        return {'status': 'error', 'reason': str(exc)}


@shared_task(bind=True, name='portfolio.tasks.trim_streams', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def trim_streams(self) -> dict:
    """Trim Redis streams to configured max length."""
    from portfolio import tasks as tasks_facade
    from portfolio.realtime.tick_producer import TickProducer

    max_len = getattr(settings, "STREAM_MAX_LEN", 50_000)
    symbols = tasks_facade.collect_symbols_for_user(user_id=None)
    if not symbols:
        return {"status": "ok", "trimmed": 0}

    try:
        client = TickProducer().client
    except Exception as exc:
        logger.warning("trim_streams: Redis unavailable: %s", exc)
        return {"status": "skipped", "reason": str(exc)}

    trimmed = 0
    for symbol in symbols:
        key = TickProducer.stream_key(symbol)
        try:
            client.xtrim(key, maxlen=max_len, approximate=True)
            trimmed += 1
        except Exception as exc:
            logger.warning("trim_streams: xtrim(%s) failed: %s", key, exc)

    return {"status": "ok", "trimmed": trimmed, "max_len": max_len}
