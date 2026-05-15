"""
Native SaaS realtime prefetch tasks — không phụ thuộc legacy portfolio.

Tasks:
  - schedule_realtime_prefetch_shards: Main scheduler, enqueues shard jobs
  - prefetch_realtime_ticker_shard: Fetches ticker data for a shard, stores in cache
"""

import logging
import os
from collections import defaultdict
from datetime import datetime

from celery import shared_task
from django.core.cache import cache
from django.db.models import Count
from django.utils import timezone

logger = logging.getLogger(__name__)

# Cache key constants
REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY = 'realtime:universe:snapshot'
REALTIME_SHARD_CACHE_PREFIX = 'realtime:shard'
REALTIME_SHARD_LAST_ENQUEUE_PREFIX = 'realtime:shard:last_enqueue'
REALTIME_PREFETCH_QUEUE = 'realtime_prefetch'
PREFETCH_METRIC_CACHE_PREFIX = 'ticker:prefetch:metric'

# Min/default values
DEFAULT_HOT_INTERVAL_SECONDS = 3
DEFAULT_WARM_INTERVAL_SECONDS = 5
DEFAULT_COLD_INTERVAL_SECONDS = 15
DEFAULT_HOT_SHARDS = 4
DEFAULT_WARM_SHARDS = 6
DEFAULT_COLD_SHARDS = 6
DEFAULT_UNIVERSE_REFRESH_SECONDS = 60


def _read_int_env(name: str, default: int) -> int:
    """Read integer from environment, with fallback."""
    try:
        value = os.getenv(name)
        if value is not None:
            return int(value)
    except (TypeError, ValueError):
        pass
    return default


def _acquire_lock(lock_key: str, timeout_seconds: int) -> bool:
    """Try to acquire a distributed lock via cache."""
    try:
        return bool(cache.add(lock_key, timezone.now().isoformat(), timeout=timeout_seconds))
    except Exception as ex:
        logger.warning(f"Lock acquire failed for {lock_key}: {ex}")
        return False


def _safe_cache_delete(cache_key: str) -> None:
    """Delete from cache, ignoring errors."""
    try:
        cache.delete(cache_key)
    except Exception:
        pass


def _increment_prefetch_metric(metric_name: str, amount: int = 1) -> int:
    """Increment a prefetch metric counter."""
    key = f'{PREFETCH_METRIC_CACHE_PREFIX}:{metric_name}'
    try:
        current = int(cache.get(key) or 0)
        new_value = current + amount
        cache.set(key, new_value, timeout=86400)  # 24h retention
        return new_value
    except Exception as ex:
        logger.warning(f"Metric increment failed for {metric_name}: {ex}")
        return 0


def _get_topology() -> dict:
    """Read prefetch topology from environment."""
    return {
        'universe_refresh_seconds': max(_read_int_env('TICKER_UNIVERSE_REFRESH_SECONDS', DEFAULT_UNIVERSE_REFRESH_SECONDS), 10),
        'hot_interval_seconds': max(_read_int_env('TICKER_PREFETCH_HOT_INTERVAL_SECONDS', DEFAULT_HOT_INTERVAL_SECONDS), 1),
        'warm_interval_seconds': max(_read_int_env('TICKER_PREFETCH_WARM_INTERVAL_SECONDS', DEFAULT_WARM_INTERVAL_SECONDS), 1),
        'cold_interval_seconds': max(_read_int_env('TICKER_PREFETCH_COLD_INTERVAL_SECONDS', DEFAULT_COLD_INTERVAL_SECONDS), 1),
        'hot_shards': max(_read_int_env('TICKER_PREFETCH_HOT_SHARDS', DEFAULT_HOT_SHARDS), 1),
        'warm_shards': max(_read_int_env('TICKER_PREFETCH_WARM_SHARDS', DEFAULT_WARM_SHARDS), 1),
        'cold_shards': max(_read_int_env('TICKER_PREFETCH_COLD_SHARDS', DEFAULT_COLD_SHARDS), 1),
        'enable_warm_tier': os.getenv('TICKER_PREFETCH_ENABLE_WARM_TIER', 'true').lower() in {'true', '1', 'yes'},
        'enable_cold_tier': os.getenv('TICKER_PREFETCH_ENABLE_COLD_TIER', 'true').lower() in {'true', '1', 'yes'},
    }


def _stable_shard_id(symbol: str, shard_count: int) -> int:
    """Compute stable shard ID for symbol based on char sum."""
    if shard_count <= 1:
        return 0
    total = sum(ord(ch) for ch in str(symbol or '').upper())
    return int(total % shard_count)


def _collect_universe_symbols() -> list[str]:
    """
    Collect symbols from user watchlists and price alerts.
    Returns: list of normalized symbols.
    """
    symbols = set()
    
    try:
        from user_workspace.models import WatchlistItem
        watchlist_symbols = WatchlistItem.objects.values_list('symbol', flat=True).distinct()
        symbols.update(str(s).strip().upper() for s in watchlist_symbols if s)
    except (ImportError, RuntimeError):
        logger.debug("WatchlistItem not available")
    
    try:
        from user_workspace.models import PriceAlert
        alert_symbols = PriceAlert.objects.values_list('symbol', flat=True).distinct()
        symbols.update(str(s).strip().upper() for s in alert_symbols if s)
    except (ImportError, RuntimeError):
        logger.debug("PriceAlert not available")
    
    # Always include VPB, VCB, ACB as system defaults
    symbols.update(['VPB', 'VCB', 'ACB'])
    
    return sorted(list(symbols))


def _build_universe_snapshot(symbols: list[str], topology: dict) -> dict:
    """Build and cache universe snapshot grouped by tier/shard."""
    # Assign to tiers based on count heat
    hot_limit = _read_int_env('TICKER_PREFETCH_HOT_LIMIT', 200)
    warm_limit = _read_int_env('TICKER_PREFETCH_WARM_LIMIT', 600)
    
    hot = symbols[:hot_limit]
    warm = symbols[hot_limit:hot_limit + warm_limit]
    cold = symbols[hot_limit + warm_limit:]
    
    snapshot = {
        'computed_at': timezone.now().isoformat(),
        'totals': {
            'all': len(symbols),
            'hot': len(hot),
            'warm': len(warm),
            'cold': len(cold),
        },
        'topology': {
            'hot_shards': topology['hot_shards'],
            'warm_shards': topology['warm_shards'],
            'cold_shards': topology['cold_shards'],
        },
    }
    
    # Store tier lists
    cache.set(f'{REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY}:hot', hot, timeout=3600)
    cache.set(f'{REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY}:warm', warm, timeout=3600)
    cache.set(f'{REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY}:cold', cold, timeout=3600)
    
    # Store shards
    for tier, tier_symbols in [('hot', hot), ('warm', warm), ('cold', cold)]:
        shard_count = topology[f'{tier}_shards']
        shards = defaultdict(list)
        for symbol in tier_symbols:
            shard_id = _stable_shard_id(symbol, shard_count)
            shards[shard_id].append(symbol)
        
        for shard_id in range(shard_count):
            cache.set(
                f'{REALTIME_SHARD_CACHE_PREFIX}:{tier}:{shard_id}',
                shards.get(shard_id, []),
                timeout=3600,
            )
    
    # Store main snapshot
    cache.set(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY, snapshot, timeout=3600)
    
    return snapshot


def _snapshot_is_stale(refresh_seconds: int) -> bool:
    """Check if universe snapshot is stale."""
    snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)
    if not isinstance(snapshot, dict):
        return True
    
    computed_at_str = snapshot.get('computed_at')
    if not computed_at_str:
        return True
    
    try:
        computed_dt = datetime.fromisoformat(computed_at_str)
        if timezone.is_naive(computed_dt):
            computed_dt = timezone.make_aware(computed_dt, timezone.get_current_timezone())
        age_seconds = (timezone.now() - computed_dt).total_seconds()
        return age_seconds > max(int(refresh_seconds), 1)
    except (ValueError, TypeError):
        return True


@shared_task(
    bind=True,
    name='market_serving.realtime_prefetch.schedule_realtime_prefetch_shards',
    queue=REALTIME_PREFETCH_QUEUE,
)
def schedule_realtime_prefetch_shards(self) -> dict:
    """
    Main scheduler task: builds universe snapshot and enqueues shard prefetch jobs.
    Runs every 3 seconds from Celery Beat.
    """
    topology = _get_topology()
    lock_key = 'lock:realtime_prefetch_scheduler'
    
    if not _acquire_lock(lock_key, timeout_seconds=10):
        _increment_prefetch_metric('scheduler_lock_skipped_total')
        return {
            'status': 'skipped_lock',
            'reason': 'scheduler_lock_held',
            'generated_at': timezone.now().isoformat(),
        }
    
    try:
        refresh_seconds = topology['universe_refresh_seconds']
        
        # Rebuild universe if stale
        if _snapshot_is_stale(refresh_seconds):
            symbols = _collect_universe_symbols()
            snapshot = _build_universe_snapshot(symbols, topology)
        else:
            snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY) or {}
        
        if not isinstance(snapshot, dict) or not snapshot.get('totals'):
            return {
                'status': 'no_snapshot',
                'reason': 'universe_snapshot_missing',
                'generated_at': timezone.now().isoformat(),
            }
        
        # Enqueue shard jobs
        now_epoch = int(timezone.now().timestamp())
        enqueued = []
        skipped_interval = 0
        skipped_disabled = 0
        
        for tier in ('hot', 'warm', 'cold'):
            if tier == 'warm' and not topology['enable_warm_tier']:
                skipped_disabled += 1
                continue
            if tier == 'cold' and not topology['enable_cold_tier']:
                skipped_disabled += 1
                continue
            
            shard_count = topology[f'{tier}_shards']
            interval_seconds = topology[f'{tier}_interval_seconds']
            
            for shard_id in range(shard_count):
                shard_symbols = cache.get(f'{REALTIME_SHARD_CACHE_PREFIX}:{tier}:{shard_id}') or []
                if not shard_symbols:
                    continue
                
                last_key = f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:{tier}:{shard_id}'
                last_epoch = int(cache.get(last_key) or 0)
                
                if now_epoch - last_epoch < interval_seconds:
                    skipped_interval += 1
                    continue
                
                # Enqueue prefetch task
                prefetch_realtime_ticker_shard.apply_async(
                    kwargs={'tier': tier, 'shard_id': int(shard_id)},
                    queue=REALTIME_PREFETCH_QUEUE,
                )
                cache.set(last_key, now_epoch, timeout=max(interval_seconds * 5, 30))
                enqueued.append({'tier': tier, 'shard_id': int(shard_id), 'symbols': len(shard_symbols)})
        
        _increment_prefetch_metric('scheduler_runs_total')
        _increment_prefetch_metric('scheduler_enqueued_total', amount=len(enqueued))
        
        return {
            'status': 'ok',
            'enqueued_total': len(enqueued),
            'skipped_interval': skipped_interval,
            'skipped_disabled': skipped_disabled,
            'snapshot_totals': snapshot.get('totals'),
            'generated_at': timezone.now().isoformat(),
        }
    finally:
        _safe_cache_delete(lock_key)


@shared_task(
    bind=True,
    name='market_serving.realtime_prefetch.prefetch_realtime_ticker_shard',
    queue=REALTIME_PREFETCH_QUEUE,
)
def prefetch_realtime_ticker_shard(self, tier: str, shard_id: int) -> dict:
    """
    Fetch realtime ticker data for a shard and store in cache.
    
    Args:
        tier: 'hot', 'warm', or 'cold'
        shard_id: shard number
    """
    try:
        from market_data.vnbroker_adapter import fetch_realtime_price
    except (ImportError, RuntimeError) as ex:
        logger.error(f"vnbroker_adapter not available: {ex}")
        return {
            'status': 'error',
            'reason': 'vnbroker_adapter_not_available',
            'tier': tier,
            'shard_id': shard_id,
        }
    
    shard_symbols = cache.get(f'{REALTIME_SHARD_CACHE_PREFIX}:{tier}:{shard_id}') or []
    if not shard_symbols:
        return {
            'status': 'ok',
            'reason': 'shard_empty',
            'tier': tier,
            'shard_id': shard_id,
            'fetched': 0,
        }
    
    fetched = 0
    errors = 0
    
    for symbol in shard_symbols:
        try:
            ticker = fetch_realtime_price(symbol)
            if ticker:
                # Cache individual ticker snapshot
                cache_key = f'realtime:ticker:{symbol}'
                cache.set(cache_key, ticker, timeout=300)  # 5-min TTL
                fetched += 1
        except Exception as ex:
            logger.warning(f"Failed to fetch {symbol}: {ex}")
            errors += 1
    
    _increment_prefetch_metric('shard_prefetch_runs_total')
    _increment_prefetch_metric('shard_prefetch_fetched_total', amount=fetched)
    
    return {
        'status': 'ok',
        'tier': tier,
        'shard_id': shard_id,
        'fetched': fetched,
        'errors': errors,
        'total': len(shard_symbols),
    }


__all__ = [
    'schedule_realtime_prefetch_shards',
    'prefetch_realtime_ticker_shard',
]
