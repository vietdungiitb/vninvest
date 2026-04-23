from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


INTRADAY_SIDE_BACKFILL_STATUS_CACHE_PREFIX = 'admin:intraday-side-backfill:task:'
INTRADAY_SIDE_BACKFILL_STATUS_TTL_SECONDS = 7 * 24 * 60 * 60


def intraday_side_backfill_status_cache_key(task_id: str) -> str:
    return f'{INTRADAY_SIDE_BACKFILL_STATUS_CACHE_PREFIX}{task_id}'


def get_intraday_side_backfill_task_status(task_id: str) -> dict | None:
    try:
        payload = cache.get(intraday_side_backfill_status_cache_key(task_id))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def set_intraday_side_backfill_task_status(task_id: str, payload: dict) -> None:
    try:
        cache.set(
            intraday_side_backfill_status_cache_key(task_id),
            payload,
            timeout=INTRADAY_SIDE_BACKFILL_STATUS_TTL_SECONDS,
        )
    except Exception:
        logger.warning('Unable to persist intraday side backfill task status for %s', task_id, exc_info=True)


@shared_task(
    bind=True,
    name='portfolio.tasks.run_intraday_side_backfill_apply',
    autoretry_for=(),
    retry_kwargs={"max_retries": 0},
    time_limit=7200,
    soft_time_limit=7100,
)
def run_intraday_side_backfill_apply(
    self,
    *,
    symbols: list[str] | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    threshold: int = 0,
    batch_size: int = 2000,
) -> dict:
    from portfolio.services_backfill import intraday_side_backfill_apply

    task_id = str(getattr(self.request, 'id', '') or '')
    started_at = timezone.now().isoformat()
    
    def progress_callback(phase, rows_processed, rows_total, current_symbol):
        """Update task status with progress metrics."""
        if not task_id:
            return
        completion_pct = 0
        if rows_total > 0:
            completion_pct = round((rows_processed / rows_total) * 100, 1)
        
        status_payload = {
            'id': task_id,
            'status': 'running',
            'queued_at': existing_status.get('queued_at') if 'existing_status' in globals() else None,
            'started_at': started_at,
            'finished_at': None,
            'phase': phase,
            'rows_processed': rows_processed,
            'rows_total': rows_total,
            'completion_percentage': completion_pct,
            'current_symbol': current_symbol,
            'message': f'Backfill {phase}: {completion_pct}% ({rows_processed}/{rows_total})',
            'result': None,
            'error': None,
            'params': {
                'symbols': symbols or [],
                'start_date': start_date,
                'end_date': end_date,
                'threshold': int(threshold or 0),
                'batch_size': int(batch_size or 2000),
            },
        }
        set_intraday_side_backfill_task_status(task_id, status_payload)
    
    payload = {
        'id': task_id,
        'status': 'running',
        'queued_at': None,
        'started_at': started_at,
        'finished_at': None,
        'phase': 'querying',
        'rows_processed': 0,
        'rows_total': 0,
        'completion_percentage': 0,
        'current_symbol': None,
        'message': 'Backfill intraday side đang chạy nền.',
        'result': None,
        'error': None,
        'params': {
            'symbols': symbols or [],
            'start_date': start_date,
            'end_date': end_date,
            'threshold': int(threshold or 0),
            'batch_size': int(batch_size or 2000),
        },
    }
    if task_id:
        existing_status = get_intraday_side_backfill_task_status(task_id) or {}
        payload['queued_at'] = existing_status.get('queued_at')
        set_intraday_side_backfill_task_status(task_id, payload)

    try:
        result = intraday_side_backfill_apply(
            symbols=symbols or [],
            start_date=start_date,
            end_date=end_date,
            threshold=int(threshold or 0),
            batch_size=int(batch_size or 2000),
            progress_callback=progress_callback if task_id else None,
        )
    except Exception as exc:
        failed_payload = {
            **payload,
            'status': 'failed',
            'finished_at': timezone.now().isoformat(),
            'message': 'Backfill intraday side thất bại.',
            'error': str(exc),
        }
        if task_id:
            set_intraday_side_backfill_task_status(task_id, failed_payload)
        logger.exception('run_intraday_side_backfill_apply failed: %s', exc)
        raise

    success_payload = {
        **payload,
        'status': 'succeeded',
        'finished_at': timezone.now().isoformat(),
        'completion_percentage': 100,
        'message': 'Backfill intraday side đã hoàn tất.',
        'result': result,
    }
    if task_id:
        set_intraday_side_backfill_task_status(task_id, success_payload)
    logger.info(
        'run_intraday_side_backfill_apply completed: task_id=%s updated=%s scope_rows=%s',
        task_id,
        result.get('updated'),
        result.get('scope_rows'),
    )
    return result


@shared_task(bind=True, name='portfolio.tasks.run_stream_consumer_batch', autoretry_for=(Exception,), retry_backoff=False, retry_kwargs={"max_retries": 0})
def run_stream_consumer_batch(self, group: str = "all") -> dict:
    """Run one batch of realtime stream consumers for active symbols."""
    from portfolio.runtime_policy_helpers import _get_runtime_prefetch_settings
    runtime = _get_runtime_prefetch_settings()
    if not runtime.get('realtime_stream_enabled', False):
        return {"status": "disabled", "group": group}

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
def cleanup_old_intraday_ticks(self) -> dict:
    """Delete old IntradayTick rows to keep database size stable.

    Đọc keep_days và enabled flag từ runtime settings (có thể bật/tắt qua Admin UI).
    Sử dụng chunked delete (5000 rows/batch) để tránh lock table.
    """
    from datetime import date, timedelta
    from portfolio.models import IntradayTick
    from portfolio.runtime_policy_helpers import _get_runtime_prefetch_settings

    runtime = _get_runtime_prefetch_settings()
    if not runtime.get('intraday_tick_auto_cleanup_enabled', True):
        logger.info("EOD cleanup: disabled via runtime settings, skipping.")
        return {"status": "disabled"}

    keep_days = max(int(runtime.get('intraday_tick_keep_days', 7)), 1)
    cutoff = date.today() - timedelta(days=keep_days)
    total_deleted = 0
    chunk_size = 5000
    while True:
        ids = list(
            IntradayTick.objects.filter(trade_date__lt=cutoff)
            .values_list('id', flat=True)[:chunk_size]
        )
        if not ids:
            break
        deleted, _ = IntradayTick.objects.filter(id__in=ids).delete()
        total_deleted += deleted
    logger.info("EOD cleanup: deleted %d IntradayTick records older than %s", total_deleted, cutoff)
    return {"status": "ok", "deleted": total_deleted, "cutoff": str(cutoff), "keep_days": keep_days}


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

    max_len = int(getattr(settings, "STREAM_MAX_LEN", 10_000))
    hard_cap = int(getattr(settings, "STREAM_MAX_LEN_HARD_CAP", max_len))
    if hard_cap > 0:
        max_len = min(max_len, hard_cap)
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
