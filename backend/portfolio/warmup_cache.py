"""
Warmup task: Initialize realtime ticker cache on startup.

When Django starts or cache is cleared, prefetch hot tier symbols to avoid
initial request penalties from on-demand upstream calls.
"""
import logging
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)

WARMUP_IN_PROGRESS_KEY = 'realtime:ticker:warmup:in_progress'
WARMUP_COMPLETED_KEY = 'realtime:ticker:warmup:completed'


def should_run_warmup() -> bool:
    """
    Check if warmup should run based on cache state.
    
    Returns:
        True if warmup should proceed (no in-progress or completed flag)
    """
    if cache.get(WARMUP_IN_PROGRESS_KEY):
        logger.debug('Warmup already in progress, skipping')
        return False
    
    if cache.get(WARMUP_COMPLETED_KEY):
        logger.debug('Warmup already completed in this session, skipping')
        return False
    
    return True


def run_warmup_cache():
    """
    Initialize realtime ticker cache by prefetching hot tier symbols on startup.
    
    This prevents initial requests from hitting on-demand vnstock calls by
    pre-warming the cache with hot (frequently-traded) symbols.
    """
    if not should_run_warmup():
        return
    
    if not getattr(settings, 'TICKER_PREFETCH_SHARD_SCHEDULER_ENABLED', False):
        logger.debug('Prefetch scheduler disabled, skipping warmup')
        return
    
    try:
        # Set in-progress flag to prevent duplicate warmups
        cache.set(WARMUP_IN_PROGRESS_KEY, True, timeout=300)
        
        from .tasks_prefetch import build_realtime_symbol_universe_snapshot, prefetch_realtime_ticker_shard
        from .models import RuntimeVnstockConfig
        
        logger.info('Starting realtime ticker cache warmup on startup')
        
        # Build universe snapshot
        universe_task = build_realtime_symbol_universe_snapshot()
        if not universe_task or not universe_task.get('symbols'):
            logger.warning('No symbols in universe snapshot, warmup skipped')
            return
        
        # Get tier assignments from snapshot
        tier_assignments = universe_task.get('tier_assignments', {})
        hot_symbols = [s for s, t in (tier_assignments or {}).items() if t == 'hot']
        
        if not hot_symbols:
            logger.warning('No hot tier symbols found, warmup skipped')
            return
        
        logger.info('Warmup: Prefetching %d hot tier symbols', len(hot_symbols))
        
        # Get shard count for hot tier from config
        config = RuntimeVnstockConfig.objects.filter(key='TICKER_PREFETCH_HOT_SHARDS').first()
        hot_shards = int(config.value) if config else 4
        
        # Enqueue shard prefetches for hot tier
        # (Simple version: prefetch all hot symbols directly, or can be refined per-shard)
        try:
            from .tasks_prefetch import _cache_ticker_rows_from_dataframe
            from .adapters.vnstock_adapter import fetch_price_board_dataframe
            
            # Fetch all hot tier symbols in one batch
            df = fetch_price_board_dataframe(hot_symbols, anchor_symbol=hot_symbols[0])
            if df is not None and not df.empty:
                cached_count = _cache_ticker_rows_from_dataframe(df, hot_symbols)
                logger.info('Warmup completed: Cached %d hot tier symbols', cached_count)
            else:
                logger.warning('Warmup: Failed to fetch hot tier data')
        except Exception as exc:
            logger.warning('Warmup: Error prefetching hot tier: %s', exc)
        
        # Mark warmup as completed
        cache.set(WARMUP_COMPLETED_KEY, True, timeout=86400)  # 24 hours
        logger.info('Realtime ticker cache warmup completed')
        
    except Exception as exc:
        logger.exception('Warmup cache error: %s', exc)
    finally:
        # Clear in-progress flag
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
