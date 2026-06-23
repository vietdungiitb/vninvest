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
from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone

from market_data.models import GlobalSymbolRegistry
from signal_intelligence.broadcasting import broadcast_ticker_update

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

# Intraday DB-hydrate intervals: how often the scheduler enqueues warm_intraday_universe
# for each tier so IntradayTick table is always fresh for the current session.
# Separate from price-cache prefetch (which only warms Redis).
DEFAULT_HOT_HYDRATE_INTERVAL_SECONDS = 300   # 5 minutes — hot symbols
DEFAULT_WARM_HYDRATE_INTERVAL_SECONDS = 900  # 15 minutes — warm symbols

REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX = 'realtime:hydrate:last_enqueue'


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


def _collect_universe_symbols() -> dict:
    """
    Collect active symbols from the global registry SSOT.

    The realtime prefetch universe must follow the shared market-data matrix,
    not user-local watchlists or alerts, so hot symbols like VHM are always
    eligible for prefetch even when they are not present in a specific user scope.
    """
    tier_order = Case(
        When(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT, then=Value(0)),
        When(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM, then=Value(1)),
        When(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD, then=Value(2)),
        default=Value(3),
        output_field=IntegerField(),
    )
    registries = GlobalSymbolRegistry.objects.filter(is_active=True).order_by(
        tier_order,
        '-priority_score',
        '-demand_source_count',
        'last_hydrated_at',
        'symbol',
    )

    universe = {
        'hot': [],
        'warm': [],
        'cold': [],
    }
    for registry in registries:
        tier = str(registry.current_priority_tier or '').lower()
        if tier == GlobalSymbolRegistry.PriorityTierChoices.WARM:
            universe['warm'].append(registry.symbol)
        elif tier == GlobalSymbolRegistry.PriorityTierChoices.COLD:
            universe['cold'].append(registry.symbol)
        else:
            universe['hot'].append(registry.symbol)

    universe['all'] = universe['hot'] + universe['warm'] + universe['cold']
    return universe


def _build_universe_snapshot(universe: dict, topology: dict) -> dict:
    """Build and cache universe snapshot grouped by tier/shard."""
    hot = list(universe.get('hot', []))
    warm = list(universe.get('warm', []))
    cold = list(universe.get('cold', []))
    all_symbols = list(universe.get('all', hot + warm + cold))
    
    snapshot = {
        'computed_at': timezone.now().isoformat(),
        'totals': {
            'all': len(all_symbols),
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
            universe = _collect_universe_symbols()
            snapshot = _build_universe_snapshot(universe, topology)
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
        
        # ── SSOT Intraday Hydrate Leg ────────────────────────────────────────────
        # Same SSOT universe snapshot that drives price-cache prefetch ALSO drives
        # IntradayTick DB persistence.  This closes the gap where the realtime cache
        # was refreshed every 3s but the tick table was only filled by the weekly
        # DNSE backfill.  After hydration the existing detect-whale-alerts-5m and
        # materialize-session-facts-5m tasks will pick up fresh rows automatically.
        # Deferred import avoids circular dependency at module load time.
        hydrate_enqueued: list[dict] = []
        _hydrate_tier_map = {
            'hot': _read_int_env('REALTIME_HOT_HYDRATE_INTERVAL_SECONDS', DEFAULT_HOT_HYDRATE_INTERVAL_SECONDS),
            'warm': _read_int_env('REALTIME_WARM_HYDRATE_INTERVAL_SECONDS', DEFAULT_WARM_HYDRATE_INTERVAL_SECONDS),
        }
        for _htier, _hinterval in _hydrate_tier_map.items():
            if _htier == 'warm' and not topology['enable_warm_tier']:
                continue
            _hydrate_key = f'{REALTIME_HYDRATE_LAST_ENQUEUE_PREFIX}:{_htier}'
            _last_hydrate = int(cache.get(_hydrate_key) or 0)
            if now_epoch - _last_hydrate < _hinterval:
                continue
            _tier_symbols = cache.get(f'{REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY}:{_htier}') or []
            if not _tier_symbols:
                continue
            try:
                from data_ingest.tasks import warm_intraday_universe
                _page_size = 120 if _htier == 'hot' else 60
                _plan = [
                    {'symbol': _s, 'page_size': _page_size, 'dataset': 'intraday_ticks'}
                    for _s in _tier_symbols
                ]
                warm_intraday_universe.apply_async(
                    kwargs={'plan_items': _plan},
                    queue=REALTIME_PREFETCH_QUEUE,
                )
                cache.set(_hydrate_key, now_epoch, timeout=max(_hinterval * 5, 120))
                hydrate_enqueued.append({'tier': _htier, 'symbols': len(_tier_symbols)})
            except Exception as _hex:
                logger.warning(
                    'schedule_realtime_prefetch_shards: hydrate enqueue failed tier=%s: %s',
                    _htier, _hex,
                )
        # ── end hydrate leg ──────────────────────────────────────────────────────

        _increment_prefetch_metric('scheduler_runs_total')
        _increment_prefetch_metric('scheduler_enqueued_total', amount=len(enqueued))

        return {
            'status': 'ok',
            'enqueued_total': len(enqueued),
            'skipped_interval': skipped_interval,
            'skipped_disabled': skipped_disabled,
            'snapshot_totals': snapshot.get('totals'),
            'hydrate_enqueued': hydrate_enqueued,
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
    
    # Pre-fetch reference prices from SymbolSnapshot for change calculation
    from django.utils.timezone import localdate
    from market_serving.models import SymbolSnapshot as SnapshotModel
    today = localdate()
    ref_map: dict[str, float] = {}
    try:
        snapshots = SnapshotModel.objects.filter(
            symbol__in=shard_symbols,
            session_date=today,
        ).values('symbol', 'reference_price')
        for s in snapshots:
            rp = s.get('reference_price')
            if rp is not None:
                ref_map[s['symbol']] = float(rp)
    except Exception as ex:
        logger.warning(f"Failed to load reference prices for shard {tier}/{shard_id}: {ex}")
    
    fetched = 0
    errors = 0
    broadcast_count = 0
    
    for symbol in shard_symbols:
        try:
            ticker = fetch_realtime_price(symbol)
            if ticker:
                symbol_upper = ticker.get('symbol', symbol)
                close = ticker.get('close')
                open_price = ticker.get('open')
                high = ticker.get('high')
                low = ticker.get('low')
                volume = ticker.get('volume')
                
                # Cache individual ticker snapshot
                cache_key = f'realtime:ticker:{symbol}'
                cache.set(cache_key, ticker, timeout=300)  # 5-min TTL
                fetched += 1
                
                # Compute change values and broadcast to WebSocket
                if close is not None:
                    ref_price = ref_map.get(symbol)
                    change_value = None
                    change_pct = None
                    if ref_price is not None and ref_price > 0:
                        change_value = float(close) - ref_price
                        change_pct = round((change_value / ref_price) * 100, 2)
                    
                    try:
                        broadcast_ticker_update(symbol_upper, {
                            'price': float(close),
                            'current_price': float(close),
                            'prev_price': ref_price,
                            'change_value': change_value,
                            'change_pct': change_pct,
                            'open_price': float(open_price) if open_price is not None else None,
                            'high_price': float(high) if high is not None else None,
                            'low_price': float(low) if low is not None else None,
                            'volume': int(volume) if volume is not None else None,
                        })
                        broadcast_count += 1
                    except Exception as broadcast_ex:
                        logger.warning(f"Broadcast failed for {symbol}: {broadcast_ex}")
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
        'broadcast': broadcast_count,
        'errors': errors,
        'total': len(shard_symbols),
    }


__all__ = [
    'schedule_realtime_prefetch_shards',
    'prefetch_realtime_ticker_shard',
]
