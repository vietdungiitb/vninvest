"""Warmup task: Initialize realtime ticker cache on startup."""
import logging

from django.db.utils import OperationalError, ProgrammingError
from django.core.cache import cache
from django.conf import settings
from portfolio.services_realtime_metrics import increment_realtime_metric

logger = logging.getLogger(__name__)

WARMUP_IN_PROGRESS_KEY = 'realtime:ticker:warmup:in_progress'
WARMUP_COMPLETED_KEY = 'realtime:ticker:warmup:completed'


def should_run_warmup() -> bool:
    if cache.get(WARMUP_IN_PROGRESS_KEY):
        return False
    if cache.get(WARMUP_COMPLETED_KEY):
        return False
    return True


def run_warmup_cache():
    if not should_run_warmup() or not getattr(settings, 'TICKER_PREFETCH_SHARD_SCHEDULER_ENABLED', False):
        return
    
    try:
        increment_realtime_metric('realtime_warmup_started_total')
        cache.set(WARMUP_IN_PROGRESS_KEY, True, timeout=300)
        from .tasks_prefetch import build_realtime_symbol_universe_snapshot

        universe_task = build_realtime_symbol_universe_snapshot()
        if not universe_task or not universe_task.get('symbols'):
            increment_realtime_metric('realtime_warmup_errors_total')
            return
        
        tier_assignments = universe_task.get('tier_assignments', {})
        hot_symbols = [s for s, t in (tier_assignments or {}).items() if t == 'hot']
        
        if not hot_symbols:
            increment_realtime_metric('realtime_warmup_errors_total')
            return
        
        try:
            from .tasks_prefetch import _cache_ticker_rows_from_dataframe
            from .adapters.vnstock_adapter import fetch_price_board_dataframe
            df = fetch_price_board_dataframe(hot_symbols, anchor_symbol=hot_symbols[0])
            if df is not None and not df.empty:
                cached_count = _cache_ticker_rows_from_dataframe(df, hot_symbols)
                increment_realtime_metric('realtime_warmup_symbols_cached_total', amount=cached_count)
            else:
                increment_realtime_metric('realtime_warmup_errors_total')
        except Exception as exc:
            logger.warning('Warmup error: %s', exc)
            increment_realtime_metric('realtime_warmup_errors_total')
        
        cache.set(WARMUP_COMPLETED_KEY, True, timeout=86400)
        increment_realtime_metric('realtime_warmup_completed_total')
        
    except (ProgrammingError, OperationalError) as exc:
        logger.info('Warmup skipped because database is not ready yet: %s', exc)
    except Exception as exc:
        increment_realtime_metric('realtime_warmup_errors_total')
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
