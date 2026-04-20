"""Warmup task: Initialize realtime ticker cache on startup."""
import logging

from django.db.utils import OperationalError, ProgrammingError
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from portfolio.services_realtime_metrics import increment_realtime_metric

logger = logging.getLogger(__name__)

WARMUP_IN_PROGRESS_KEY = 'realtime:ticker:warmup:in_progress'
WARMUP_COMPLETED_KEY = 'realtime:ticker:warmup:completed'
PREFETCH_META_KEY = 'ticker:prefetch:meta'


def _set_startup_prefetch_meta(*, status: str, reason: str | None = None, symbols: int = 0, cached: int = 0, sample_symbols: list[str] | None = None):
    cache.set(
        PREFETCH_META_KEY,
        {
            'status': status,
            'trigger': 'startup_warmup',
            'reason': reason,
            'symbols': int(symbols or 0),
            'cached': int(cached or 0),
            'batches': 1,
            'sample_symbols': (sample_symbols or [])[:12],
            'generated_at': timezone.now().isoformat(),
            'policy': {
                'query_enabled': True,
                'effective_interval_seconds': 90,
                'profile': 'startup_warmup',
            },
        },
        timeout=900,
    )


def should_run_warmup() -> bool:
    if cache.get(WARMUP_IN_PROGRESS_KEY):
        return False
    # Only skip if meta is fresh AND has symbols cached (not a failed/empty run).
    # Ignore WARMUP_COMPLETED_KEY — it persists in Redis across container restarts
    # and can prevent warmup from running when meta is stale or empty.
    meta = cache.get(PREFETCH_META_KEY)
    if isinstance(meta, dict) and meta.get('symbols', 0) > 0:
        # Meta is present and healthy — no need to warmup again
        return False
    return True


def run_warmup_cache():
    if not should_run_warmup() or not getattr(settings, 'TICKER_PREFETCH_SHARD_SCHEDULER_ENABLED', False):
        return
    
    try:
        increment_realtime_metric('realtime_warmup_started_total')
        cache.set(WARMUP_IN_PROGRESS_KEY, True, timeout=300)
        from .tasks_prefetch import build_realtime_symbol_universe_snapshot, REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY

        universe_task = build_realtime_symbol_universe_snapshot()
        hot_symbols = []
        if isinstance(universe_task, dict) and universe_task.get('status') == 'ok':
            # rows are stored in cache, not in return value
            snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)
            if isinstance(snapshot, dict):
                snapshot_rows = snapshot.get('rows') or []
                hot_symbols = [
                    str(row.get('symbol') or '').strip().upper()
                    for row in snapshot_rows
                    if str(row.get('tier') or '').lower() == 'hot'
                ]
                hot_symbols = [s for s in hot_symbols if s]

        if not hot_symbols:
            _set_startup_prefetch_meta(status='ok', reason='no_symbols_to_prefetch', symbols=0, cached=0)
            increment_realtime_metric('realtime_warmup_errors_total')
            return
        
        try:
            from .tasks_prefetch import _cache_ticker_rows_from_dataframe
            from .adapters.vnstock_adapter import fetch_price_board_dataframe
            df = fetch_price_board_dataframe(hot_symbols, anchor_symbol=hot_symbols[0])
            if df is not None and not df.empty:
                cached_count = _cache_ticker_rows_from_dataframe(
                    df,
                    tier='hot',
                    shard_id=0,
                    now_iso=timezone.now().isoformat(),
                    cache_timeout_seconds=90,
                    market_phase='startup_warmup',
                    market_code='VN_STOCK',
                )
                increment_realtime_metric('realtime_warmup_symbols_cached_total', amount=cached_count)

                # Publish a bootstrap prefetch meta snapshot so Admin Ops health
                # can reflect warmup status immediately after startup.
                _set_startup_prefetch_meta(
                    status='ok',
                    reason=None,
                    symbols=len(hot_symbols),
                    cached=int(cached_count or 0),
                    sample_symbols=hot_symbols,
                )
            else:
                _set_startup_prefetch_meta(status='error', reason='empty_price_board', symbols=len(hot_symbols), cached=0, sample_symbols=hot_symbols)
                increment_realtime_metric('realtime_warmup_errors_total')
        except Exception as exc:
            logger.warning('Warmup error: %s', exc)
            _set_startup_prefetch_meta(status='error', reason='warmup_exception', symbols=len(hot_symbols), cached=0, sample_symbols=hot_symbols)
            increment_realtime_metric('realtime_warmup_errors_total')
        
        cache.set(WARMUP_COMPLETED_KEY, True, timeout=86400)
        increment_realtime_metric('realtime_warmup_completed_total')
        
    except (ProgrammingError, OperationalError) as exc:
        logger.info('Warmup skipped because database is not ready yet: %s', exc)
        _set_startup_prefetch_meta(status='error', reason='db_not_ready', symbols=0, cached=0)
    except Exception as exc:
        increment_realtime_metric('realtime_warmup_errors_total')
        _set_startup_prefetch_meta(status='error', reason='unexpected_exception', symbols=0, cached=0)
        logger.exception('Warmup cache error: %s', exc)
    finally:
        try:
            cache.delete(WARMUP_IN_PROGRESS_KEY)
        except Exception:
            pass


def trigger_warmup_async():
    """
    Trigger cache warmup asynchronously via Celery.
    
    Use this when you want non-blocking warmup (e.g., on demand).
    """
    try:
        from .tasks import warmup_realtime_ticker_cache
        warmup_realtime_ticker_cache.apply_async(countdown=0)
        logger.debug('Warmup task enqueued to Celery')
    except Exception as exc:
        logger.warning('Failed to enqueue warmup task: %s', exc)
