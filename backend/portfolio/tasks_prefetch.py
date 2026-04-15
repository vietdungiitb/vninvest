from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import logging
import math
import os
import re

from celery import shared_task
from django.core.cache import cache
from django.db.models import Count
from django.utils import timezone

from portfolio.adapters.vnstock_adapter import fetch_price_board_dataframe
from portfolio.models import (
    DailyPrice,
    PriceAlertRule,
    SecuritiesItem,
    TrackedSymbol,
    Transaction,
    WatchlistItem,
)

logger = logging.getLogger(__name__)

try:
    import pandas as pd
except Exception:  # pragma: no cover - tests use pandas, this is a runtime safety net.
    pd = None

TICKER_PREFETCH_META_CACHE_KEY = 'ticker:prefetch:meta'
VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY = 'vnstock:rate-limit:price_board'
PREFETCH_RUNTIME_SETTINGS_CACHE_KEY = 'admin_ops:prefetch_runtime_settings'
PREFETCH_TIME_POLICY_CACHE_KEY = 'admin_ops:prefetch_time_policy'
PREFETCH_METRIC_CACHE_PREFIX = 'ticker:prefetch:metric'
VNSTOCK_TIMEOUT_COUNTER_KEY = 'vnstock:timeout-counter:price_board'
PREFETCH_ENQUEUE_LOCK_KEY = 'ticker:prefetch:enqueue:lock'
REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY = 'realtime:universe:snapshot'
REALTIME_UNIVERSE_TIER_CACHE_PREFIX = 'realtime:universe'
REALTIME_SHARD_CACHE_PREFIX = 'realtime:shard'
REALTIME_SHARD_LAST_ENQUEUE_PREFIX = 'realtime:shard:last_enqueue'


def _read_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name, 'true' if default else 'false')
    return str(value or '').strip().lower() in {'true', '1', 'yes', 'on'}


def _tier_shards(topology: dict, tier: str) -> int:
    if tier == 'hot':
        return max(int(topology.get('hot_shards', 4)), 1)
    if tier == 'warm':
        return max(int(topology.get('warm_shards', 6)), 1)
    return max(int(topology.get('cold_shards', 6)), 1)


def _tier_interval_seconds(topology: dict, tier: str) -> int:
    if tier == 'hot':
        return max(int(topology.get('hot_interval_seconds', 3)), 1)
    if tier == 'warm':
        return max(int(topology.get('warm_interval_seconds', 5)), 1)
    return max(int(topology.get('cold_interval_seconds', 15)), 1)


def _tier_batch_size(topology: dict, tier: str) -> int:
    if tier == 'hot':
        return max(int(topology.get('batch_size_hot', 50)), 1)
    if tier == 'warm':
        return max(int(topology.get('batch_size_warm', 60)), 1)
    return max(int(topology.get('batch_size_cold', 60)), 1)


def _tier_enabled(topology: dict, tier: str) -> bool:
    if tier == 'cold':
        return bool(topology.get('enable_cold_tier', True))
    if tier == 'warm':
        return bool(topology.get('enable_warm_tier', True))
    return True


def _resolve_prefetch_topology(runtime_settings: dict | None = None) -> dict:
    runtime_settings = runtime_settings or _get_prefetch_runtime_settings()

    def _override_int(env_name: str, default_value: int, key_name: str | None = None, min_value: int = 0) -> int:
        value = _int_env(env_name, default_value)
        override_key = key_name or env_name.lower()
        if override_key in runtime_settings:
            try:
                value = int(runtime_settings.get(override_key))
            except (TypeError, ValueError):
                pass
        return max(value, min_value)

    topology = {
        'universe_refresh_seconds': _override_int('TICKER_UNIVERSE_REFRESH_SECONDS', 60, min_value=10),
        'universe_symbol_limit': _override_int('TICKER_UNIVERSE_SYMBOL_LIMIT', 1800, min_value=0),
        'hot_limit': _override_int('TICKER_PREFETCH_HOT_LIMIT', 200, min_value=0),
        'warm_limit': _override_int('TICKER_PREFETCH_WARM_LIMIT', 600, min_value=0),
        'hot_interval_seconds': _override_int('TICKER_PREFETCH_HOT_INTERVAL_SECONDS', 3, min_value=1),
        'warm_interval_seconds': _override_int('TICKER_PREFETCH_WARM_INTERVAL_SECONDS', 5, min_value=1),
        'cold_interval_seconds': _override_int('TICKER_PREFETCH_COLD_INTERVAL_SECONDS', 15, min_value=1),
        'hot_shards': _override_int('TICKER_PREFETCH_HOT_SHARDS', 4, min_value=1),
        'warm_shards': _override_int('TICKER_PREFETCH_WARM_SHARDS', 6, min_value=1),
        'cold_shards': _override_int('TICKER_PREFETCH_COLD_SHARDS', 6, min_value=1),
        'batch_size_hot': _override_int('TICKER_PREFETCH_BATCH_SIZE_HOT', 50, min_value=1),
        'batch_size_warm': _override_int('TICKER_PREFETCH_BATCH_SIZE_WARM', 60, min_value=1),
        'batch_size_cold': _override_int('TICKER_PREFETCH_BATCH_SIZE_COLD', 60, min_value=1),
        'upstream_soft_cap_per_minute': _override_int('TICKER_UPSTREAM_SOFT_CAP_PER_MINUTE', 400, min_value=1),
        'upstream_warning_cap_per_minute': _override_int('TICKER_UPSTREAM_WARNING_CAP_PER_MINUTE', 500, min_value=1),
        'upstream_hard_cap_per_minute': _override_int('TICKER_UPSTREAM_HARD_CAP_PER_MINUTE', 600, min_value=1),
        'enable_cold_tier': _read_bool_env('TICKER_PREFETCH_ENABLE_COLD_TIER', True),
        'enable_warm_tier': _read_bool_env('TICKER_PREFETCH_ENABLE_WARM_TIER', True),
        'emergency_override_enabled': _read_bool_env('TICKER_PREFETCH_EMERGENCY_OVERRIDE_ENABLED', False),
        'emergency_disable_cold': _read_bool_env('TICKER_PREFETCH_EMERGENCY_DISABLE_COLD', True),
    }

    try:
        emergency_multiplier = float(os.getenv('TICKER_PREFETCH_EMERGENCY_INTERVAL_MULTIPLIER', '2.0'))
    except (TypeError, ValueError):
        emergency_multiplier = 2.0
    topology['emergency_interval_multiplier'] = max(emergency_multiplier, 1.0)
    return topology


def _stable_shard_id(symbol: str, shard_count: int) -> int:
    if shard_count <= 1:
        return 0
    total = sum(ord(ch) for ch in str(symbol or '').upper())
    return int(total % shard_count)


def _safe_cache_delete(cache_key: str) -> None:
    try:
        cache.delete(cache_key)
    except Exception:
        pass


def _acquire_lock(lock_key: str, timeout_seconds: int) -> bool:
    try:
        return bool(cache.add(lock_key, timezone.now().isoformat(), timeout=timeout_seconds))
    except Exception:
        return False


def _build_symbol_count_map(queryset, symbol_field: str, count_field: str) -> dict[str, int]:
    payload = {}
    for row in queryset:
        symbol = str(row.get(symbol_field) or '').strip().upper()
        if not symbol:
            continue
        payload[symbol] = int(row.get(count_field) or 0)
    return payload


def _compute_heat_score(
    *,
    watchlist_users: int,
    alert_users: int,
    holding_users: int,
    is_system_symbol: bool,
) -> int:
    return (
        5 * max(int(watchlist_users), 0)
        + 3 * max(int(alert_users), 0)
        + 2 * max(int(holding_users), 0)
        + (1 if is_system_symbol else 0)
    )


def _estimate_upstream_calls_per_minute(tier_symbols: int, interval_seconds: int, batch_size: int) -> int:
    if tier_symbols <= 0:
        return 0
    return int(math.ceil(float(tier_symbols) / float(max(batch_size, 1))) * (60.0 / float(max(interval_seconds, 1))))


def _collect_realtime_symbol_universe(topology: dict, runtime_settings: dict) -> tuple[list[dict], dict]:
    tracked_users = _build_symbol_count_map(
        TrackedSymbol.objects.values('symbol').annotate(user_count=Count('user', distinct=True)),
        'symbol',
        'user_count',
    )
    watchlist_users = _build_symbol_count_map(
        WatchlistItem.objects.values('symbol').annotate(user_count=Count('group__user', distinct=True)),
        'symbol',
        'user_count',
    )
    alert_users = _build_symbol_count_map(
        PriceAlertRule.objects.filter(is_active=True).values('symbol').annotate(user_count=Count('user', distinct=True)),
        'symbol',
        'user_count',
    )
    holding_users = _build_symbol_count_map(
        Transaction.objects.values('symbol').annotate(user_count=Count('sub_account__portfolio__user', distinct=True)),
        'symbol',
        'user_count',
    )
    include_group_symbols = bool(runtime_settings.get('include_group_symbols', False))
    system_symbols = set()
    if include_group_symbols:
        system_symbols = {
            str(symbol).strip().upper()
            for symbol in SecuritiesItem.objects.values_list('symbol', flat=True).distinct()
            if symbol and str(symbol).strip()
        }

    all_symbols = set(tracked_users) | set(watchlist_users) | set(alert_users) | set(holding_users) | set(system_symbols)

    universe_rows = []
    for symbol in all_symbols:
        watchlist_count = int(watchlist_users.get(symbol, 0))
        alert_count = int(alert_users.get(symbol, 0))
        holding_count = int(holding_users.get(symbol, 0))
        tracked_count = int(tracked_users.get(symbol, 0))
        is_system_symbol = symbol in system_symbols

        heat_score = _compute_heat_score(
            watchlist_users=watchlist_count,
            alert_users=alert_count,
            holding_users=holding_count,
            is_system_symbol=is_system_symbol,
        )
        universe_rows.append(
            {
                'symbol': symbol,
                'subscriber_count': max(watchlist_count, tracked_count),
                'tracked_by_watchlist_users': watchlist_count,
                'tracked_by_alert_rules': alert_count,
                'tracked_by_portfolio_holders': holding_count,
                'is_system_symbol': is_system_symbol,
                'heat_score': heat_score,
            }
        )

    universe_rows.sort(key=lambda item: (-int(item.get('heat_score', 0)), item.get('symbol', '')))
    symbol_limit = max(int(topology.get('universe_symbol_limit', 1800)), 0)
    if symbol_limit:
        universe_rows = universe_rows[:symbol_limit]

    hot_limit = max(int(topology.get('hot_limit', 200)), 0)
    warm_limit = max(int(topology.get('warm_limit', 600)), 0)
    for idx, row in enumerate(universe_rows):
        if idx < hot_limit:
            tier = 'hot'
        elif idx < hot_limit + warm_limit:
            tier = 'warm'
        else:
            tier = 'cold'
        shard_id = _stable_shard_id(row.get('symbol'), _tier_shards(topology, tier))
        row['tier'] = tier
        row['shard_id'] = shard_id
        row['computed_at'] = timezone.now().isoformat()

    source_counts = {
        'tracked_symbols': len(tracked_users),
        'watchlist_items': len(watchlist_users),
        'price_alerts': len(alert_users),
        'portfolio_transactions': len(holding_users),
        'market_group_items': len(system_symbols),
    }
    return universe_rows, source_counts


def _group_universe_by_tier(rows: list[dict]) -> dict[str, list[dict]]:
    grouped = {'hot': [], 'warm': [], 'cold': []}
    for row in rows:
        tier = str(row.get('tier') or '').lower()
        if tier in grouped:
            grouped[tier].append(row)
    return grouped


def _group_tier_by_shard(rows: list[dict], shard_count: int) -> dict[int, list[str]]:
    grouped = defaultdict(list)
    for row in rows:
        symbol = str(row.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        shard_id = int(row.get('shard_id', _stable_shard_id(symbol, shard_count)) or 0)
        grouped[shard_id].append(symbol)

    for shard_id in range(max(shard_count, 1)):
        grouped.setdefault(shard_id, [])
    return dict(grouped)


def _store_universe_snapshot(rows: list[dict], source_counts: dict, topology: dict) -> dict:
    grouped = _group_universe_by_tier(rows)
    computed_at = timezone.now().isoformat()

    snapshot = {
        'computed_at': computed_at,
        'generated_at': computed_at,
        'source_counts': source_counts,
        'totals': {
            'all': len(rows),
            'hot': len(grouped['hot']),
            'warm': len(grouped['warm']),
            'cold': len(grouped['cold']),
        },
        'topology': {
            'hot_shards': _tier_shards(topology, 'hot'),
            'warm_shards': _tier_shards(topology, 'warm'),
            'cold_shards': _tier_shards(topology, 'cold'),
        },
        'rows': rows,
    }
    cache.set(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY, snapshot, timeout=max(int(topology.get('universe_refresh_seconds', 60)), 10) * 3)
    cache.set(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:hot', grouped['hot'], timeout=60 * 15)
    cache.set(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:warm', grouped['warm'], timeout=60 * 15)
    cache.set(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:cold', grouped['cold'], timeout=60 * 15)

    for tier in ('hot', 'warm', 'cold'):
        shard_map = _group_tier_by_shard(grouped[tier], _tier_shards(topology, tier))
        for shard_id, symbols in shard_map.items():
            cache.set(
                f'{REALTIME_SHARD_CACHE_PREFIX}:{tier}:{int(shard_id)}',
                symbols,
                timeout=60 * 15,
            )
    return snapshot


def _resolve_scheduler_plan(snapshot: dict, topology: dict) -> tuple[dict, dict]:
    tier_counts = {
        'hot': int((snapshot.get('totals') or {}).get('hot', 0)),
        'warm': int((snapshot.get('totals') or {}).get('warm', 0)),
        'cold': int((snapshot.get('totals') or {}).get('cold', 0)),
    }
    plan = {
        'hot': {
            'enabled': True,
            'interval_seconds': _tier_interval_seconds(topology, 'hot'),
            'batch_size': _tier_batch_size(topology, 'hot'),
            'shards': _tier_shards(topology, 'hot'),
        },
        'warm': {
            'enabled': _tier_enabled(topology, 'warm'),
            'interval_seconds': _tier_interval_seconds(topology, 'warm'),
            'batch_size': _tier_batch_size(topology, 'warm'),
            'shards': _tier_shards(topology, 'warm'),
        },
        'cold': {
            'enabled': _tier_enabled(topology, 'cold'),
            'interval_seconds': _tier_interval_seconds(topology, 'cold'),
            'batch_size': _tier_batch_size(topology, 'cold'),
            'shards': _tier_shards(topology, 'cold'),
        },
    }

    if topology.get('emergency_override_enabled'):
        multiplier = float(topology.get('emergency_interval_multiplier', 2.0) or 2.0)
        for tier_name in ('hot', 'warm', 'cold'):
            plan[tier_name]['interval_seconds'] = max(int(plan[tier_name]['interval_seconds'] * multiplier), 1)
        if topology.get('emergency_disable_cold'):
            plan['cold']['enabled'] = False

    def _compute_total_calls_per_minute(local_plan: dict) -> int:
        total = 0
        for tier_name in ('hot', 'warm', 'cold'):
            if not local_plan[tier_name].get('enabled'):
                continue
            total += _estimate_upstream_calls_per_minute(
                tier_symbols=tier_counts.get(tier_name, 0),
                interval_seconds=int(local_plan[tier_name].get('interval_seconds', 1)),
                batch_size=int(local_plan[tier_name].get('batch_size', 1)),
            )
        return total

    hard_cap = max(int(topology.get('upstream_hard_cap_per_minute', 600)), 1)
    if _compute_total_calls_per_minute(plan) > hard_cap and plan['cold'].get('enabled'):
        plan['cold']['enabled'] = False
    if _compute_total_calls_per_minute(plan) > hard_cap and plan['warm'].get('enabled'):
        plan['warm']['interval_seconds'] = max(int(plan['warm']['interval_seconds']) * 2, 1)
    if _compute_total_calls_per_minute(plan) > hard_cap:
        plan['hot']['interval_seconds'] = max(int(plan['hot']['interval_seconds']) * 2, 1)

    metrics = {
        'estimated_upstream_calls_per_minute': _compute_total_calls_per_minute(plan),
        'soft_cap': int(topology.get('upstream_soft_cap_per_minute', 400)),
        'warning_cap': int(topology.get('upstream_warning_cap_per_minute', 500)),
        'hard_cap': hard_cap,
    }
    return plan, metrics


@shared_task(bind=True, name='portfolio.tasks.build_realtime_symbol_universe_snapshot')
def build_realtime_symbol_universe_snapshot(self) -> dict:
    runtime_settings = _get_prefetch_runtime_settings()
    topology = _resolve_prefetch_topology(runtime_settings=runtime_settings)
    lock_key = 'lock:realtime_universe:snapshot'
    lock_ttl = max(int(topology.get('universe_refresh_seconds', 60)), 10)

    if not _acquire_lock(lock_key, timeout_seconds=lock_ttl):
        skipped_total = _increment_prefetch_metric('universe_lock_skipped_total')
        return {
            'status': 'skipped_lock',
            'reason': 'universe_snapshot_lock_held',
            'metrics': {'universe_lock_skipped_total': skipped_total},
            'generated_at': timezone.now().isoformat(),
        }

    try:
        rows, source_counts = _collect_realtime_symbol_universe(topology=topology, runtime_settings=runtime_settings)
        snapshot = _store_universe_snapshot(rows, source_counts=source_counts, topology=topology)
        return {
            'status': 'ok',
            'snapshot_key': REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
            'total_symbols': int((snapshot.get('totals') or {}).get('all', 0)),
            'hot_symbols': int((snapshot.get('totals') or {}).get('hot', 0)),
            'warm_symbols': int((snapshot.get('totals') or {}).get('warm', 0)),
            'cold_symbols': int((snapshot.get('totals') or {}).get('cold', 0)),
            'source_counts': source_counts,
            'generated_at': snapshot.get('generated_at'),
        }
    finally:
        _safe_cache_delete(lock_key)


def _snapshot_is_stale(snapshot: dict, refresh_seconds: int) -> bool:
    if not isinstance(snapshot, dict):
        return True
    raw_computed_at = snapshot.get('computed_at') or snapshot.get('generated_at')
    if not raw_computed_at:
        return True
    try:
        computed_dt = datetime.fromisoformat(str(raw_computed_at))
    except ValueError:
        return True
    if timezone.is_naive(computed_dt):
        computed_dt = timezone.make_aware(computed_dt, timezone.get_current_timezone())
    return (timezone.now() - computed_dt).total_seconds() > max(int(refresh_seconds), 1)


@shared_task(bind=True, name='portfolio.tasks.schedule_realtime_prefetch_shards')
def schedule_realtime_prefetch_shards(self) -> dict:
    runtime_settings = _get_prefetch_runtime_settings()
    topology = _resolve_prefetch_topology(runtime_settings=runtime_settings)
    lock_key = 'lock:realtime_prefetch_scheduler'
    if not _acquire_lock(lock_key, timeout_seconds=10):
        skipped_total = _increment_prefetch_metric('scheduler_lock_skipped_total')
        return {
            'status': 'skipped_lock',
            'reason': 'scheduler_lock_held',
            'metrics': {'scheduler_lock_skipped_total': skipped_total},
            'generated_at': timezone.now().isoformat(),
        }

    try:
        refresh_seconds = int(topology.get('universe_refresh_seconds', 60))
        snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)
        if _snapshot_is_stale(snapshot, refresh_seconds=refresh_seconds):
            build_realtime_symbol_universe_snapshot.run()
            snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)

        if not isinstance(snapshot, dict):
            return {
                'status': 'no_snapshot',
                'reason': 'universe_snapshot_missing',
                'generated_at': timezone.now().isoformat(),
            }

        plan, budget_metrics = _resolve_scheduler_plan(snapshot=snapshot, topology=topology)
        now_epoch = int(timezone.now().timestamp())
        enqueued = []
        skipped_due_to_interval = 0

        for tier in ('hot', 'warm', 'cold'):
            tier_plan = plan[tier]
            if not tier_plan.get('enabled'):
                continue

            shard_count = int(tier_plan.get('shards', 1))
            interval_seconds = max(int(tier_plan.get('interval_seconds', 1)), 1)
            for shard_id in range(shard_count):
                shard_symbols = cache.get(f'{REALTIME_SHARD_CACHE_PREFIX}:{tier}:{shard_id}') or []
                if not shard_symbols:
                    continue

                last_key = f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:{tier}:{shard_id}'
                last_epoch = int(cache.get(last_key) or 0)
                if now_epoch - last_epoch < interval_seconds:
                    skipped_due_to_interval += 1
                    continue

                prefetch_realtime_ticker_shard.apply_async(kwargs={'tier': tier, 'shard_id': int(shard_id)})
                cache.set(last_key, now_epoch, timeout=max(interval_seconds * 5, 30))
                enqueued.append({'tier': tier, 'shard_id': int(shard_id), 'symbols': len(shard_symbols)})

        _increment_prefetch_metric('scheduler_runs_total')
        _increment_prefetch_metric('realtime_upstream_calls_per_minute', amount=max(int(budget_metrics.get('estimated_upstream_calls_per_minute', 0)), 0))

        return {
            'status': 'ok',
            'enqueued_total': len(enqueued),
            'skipped_due_to_interval': skipped_due_to_interval,
            'enqueued': enqueued,
            'plan': plan,
            'budget': budget_metrics,
            'snapshot_totals': snapshot.get('totals', {}),
            'generated_at': timezone.now().isoformat(),
        }
    finally:
        _safe_cache_delete(lock_key)


def _cache_ticker_rows_from_dataframe(df, *, tier: str, shard_id: int, now_iso: str) -> int:
    cached_count = 0
    for _, row in df.iterrows():
        try:
            sym = _extract_row_symbol(row)
            if not sym:
                continue
            match_price = _f(_extract_row_match_price(row))
            ref_price = _f(_extract_row_ref_price(row))
            highest = _f(_extract_row_highest(row))
            lowest = _f(_extract_row_lowest(row))
            open_price = _f(_extract_row_open_price(row))
            accum_vol = _i(_extract_row_volume(row))
            change_value = round(match_price - ref_price, 2) if match_price and ref_price else None
            change_pct = round((match_price - ref_price) / ref_price * 100, 2) if match_price and ref_price else None
            cache.set(
                f'ticker:{sym}',
                {
                    'symbol': sym,
                    'current_price': match_price,
                    'prev_price': ref_price,
                    'change_value': change_value,
                    'change_pct': change_pct,
                    'high_price': highest,
                    'low_price': lowest,
                    'open_price': open_price,
                    'volume': accum_vol,
                    'last_date': now_iso,
                    'freshness_seconds': 0,
                    'stale': False,
                    'source': 'prefetch',
                },
                timeout=60,
            )
            cache.set(
                f'ticker:meta:{sym}',
                {
                    'tier': tier,
                    'shard_id': int(shard_id),
                    'upstream_source': 'vnstock',
                    'fetched_at': now_iso,
                    'last_success_at': now_iso,
                    'failure_count': 0,
                    'last_error': None,
                },
                timeout=60 * 60,
            )
            cached_count += 1
        except Exception as exc:
            logger.warning('prefetch_realtime_ticker_shard parse error row: %s', exc)
    return cached_count


def _f(val):
    try:
        v = float(val)
        return v if v == v and v != 0 else None
    except (TypeError, ValueError):
        return None


def _i(val):
    try:
        v = float(val)
        return int(v) if v == v else None
    except (TypeError, ValueError):
        return None


@shared_task(bind=True, name='portfolio.tasks.prefetch_realtime_ticker_shard')
def prefetch_realtime_ticker_shard(self, tier: str, shard_id: int) -> dict:
    normalized_tier = str(tier or '').strip().lower()
    if normalized_tier not in {'hot', 'warm', 'cold'}:
        return {
            'status': 'invalid_tier',
            'tier': normalized_tier,
            'generated_at': timezone.now().isoformat(),
        }

    lock_key = f'lock:realtime_prefetch:{normalized_tier}:{int(shard_id)}'
    if not _acquire_lock(lock_key, timeout_seconds=30):
        skipped_total = _increment_prefetch_metric('realtime_shard_skipped_lock_total', suffix=normalized_tier)
        return {
            'status': 'skipped_lock',
            'tier': normalized_tier,
            'shard_id': int(shard_id),
            'metrics': {'realtime_shard_skipped_lock_total': skipped_total},
            'generated_at': timezone.now().isoformat(),
        }

    try:
        topology = _resolve_prefetch_topology(runtime_settings=_get_prefetch_runtime_settings())
        batch_size = _tier_batch_size(topology, normalized_tier)
        symbols = cache.get(f'{REALTIME_SHARD_CACHE_PREFIX}:{normalized_tier}:{int(shard_id)}') or []
        symbols = [str(symbol).strip().upper() for symbol in symbols if symbol and str(symbol).strip()]
        if not symbols:
            return {
                'status': 'ok',
                'tier': normalized_tier,
                'shard_id': int(shard_id),
                'symbols': 0,
                'cached': 0,
                'generated_at': timezone.now().isoformat(),
            }

        now_iso = timezone.now().isoformat()
        cached_count = 0
        batches = 0
        for start in range(0, len(symbols), batch_size):
            batch_symbols = symbols[start:start + batch_size]
            if not batch_symbols:
                continue
            df = fetch_price_board_dataframe(batch_symbols, anchor_symbol=batch_symbols[0])
            batches += 1
            if df is None or df.empty:
                continue
            cached_count += _cache_ticker_rows_from_dataframe(df, tier=normalized_tier, shard_id=int(shard_id), now_iso=now_iso)

        _increment_prefetch_metric('realtime_prefetch_rows_cached_total', suffix=normalized_tier, amount=cached_count)
        return {
            'status': 'ok',
            'tier': normalized_tier,
            'shard_id': int(shard_id),
            'symbols': len(symbols),
            'cached': cached_count,
            'batches': batches,
            'generated_at': now_iso,
        }
    except Exception as exc:
        _increment_prefetch_metric('realtime_shard_error_total', suffix=normalized_tier)
        raise exc
    finally:
        _safe_cache_delete(lock_key)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return int(default)


def _prefetch_runtime_defaults() -> dict:
    return {
        'batch_size': max(_int_env('TICKER_PREFETCH_BATCH_SIZE', 60), 1),
        'symbol_limit': max(_int_env('TICKER_PREFETCH_SYMBOL_LIMIT', 240), 0),
        'max_retries': max(_int_env('TICKER_PREFETCH_MAX_RETRIES', 6), 0),
        'retry_base_seconds': max(_int_env('TICKER_PREFETCH_RETRY_BASE_SECONDS', 8), 1),
        'retry_max_seconds': max(_int_env('TICKER_PREFETCH_RETRY_MAX_SECONDS', 120), 1),
        'rate_limit_cooldown_seconds': max(_int_env('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', 20), 5),
        'circuit_window_seconds': max(_int_env('VNSTOCK_CIRCUIT_WINDOW_SECONDS', 300), 30),
        'circuit_breaker_timeout_threshold': max(_int_env('VNSTOCK_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', 3), 1),
        'circuit_breaker_cooldown_seconds': max(_int_env('VNSTOCK_CIRCUIT_BREAKER_COOLDOWN_SECONDS', 1800), 60),
        'include_group_symbols': os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true',
    }


def _get_prefetch_runtime_settings() -> dict:
    defaults = _prefetch_runtime_defaults()
    raw = cache.get(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY)
    if not isinstance(raw, dict):
        return defaults

    settings_payload = dict(defaults)
    int_keys = {
        'batch_size': 1,
        'symbol_limit': 0,
        'max_retries': 0,
        'retry_base_seconds': 1,
        'retry_max_seconds': 1,
        'rate_limit_cooldown_seconds': 5,
        'circuit_window_seconds': 30,
        'circuit_breaker_timeout_threshold': 1,
        'circuit_breaker_cooldown_seconds': 60,
    }
    for key, min_value in int_keys.items():
        if key not in raw:
            continue
        try:
            settings_payload[key] = max(int(raw.get(key)), min_value)
        except (TypeError, ValueError):
            continue

    if 'include_group_symbols' in raw:
        settings_payload['include_group_symbols'] = bool(raw.get('include_group_symbols'))

    settings_payload['retry_max_seconds'] = max(
        settings_payload['retry_max_seconds'],
        settings_payload['retry_base_seconds'],
    )
    return settings_payload


def _prefetch_time_policy_defaults() -> dict:
    return {
        'timezone': 'Asia/Ho_Chi_Minh',
        'market': {
            'open_time': '09:00',
            'close_time': '15:00',
            'pre_open_minutes': 30,
            'post_close_minutes': 30,
            'lunch_break': {
                'enabled': True,
                'start': '11:30',
                'end': '13:00',
            },
            'weekend_mode': 'offhours',
        },
        'profiles': {
            'pre_open': {'query_enabled': True, 'interval_seconds': 90, 'batch_size': 10, 'symbol_limit': 20, 'max_retries': 2},
            'market_open': {'query_enabled': True, 'interval_seconds': 35, 'batch_size': 20, 'symbol_limit': 40, 'max_retries': 4},
            'lunch_break': {'query_enabled': True, 'interval_seconds': 180, 'batch_size': 8, 'symbol_limit': 20, 'max_retries': 1},
            'pre_close': {'query_enabled': True, 'interval_seconds': 60, 'batch_size': 12, 'symbol_limit': 30, 'max_retries': 2},
            'post_close': {'query_enabled': True, 'interval_seconds': 180, 'batch_size': 8, 'symbol_limit': 20, 'max_retries': 1},
            'offhours': {'query_enabled': False, 'interval_seconds': 600, 'batch_size': 5, 'symbol_limit': 10, 'max_retries': 0},
        },
        'rate_limit_guard': {
            'jitter_percent': 15.0,
            'cooldown_multiplier_on_429': 2.0,
            'max_interval_seconds': 1800,
        },
    }


def _coerce_prefetch_time_policy(raw_payload, fallback=None) -> dict:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    def _to_int(value, default_value, min_value=0):
        try:
            return max(int(value), min_value)
        except (TypeError, ValueError):
            return max(int(default_value), min_value)

    def _to_float(value, default_value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default_value)

    def _to_bool(value, default_value):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {'true', '1', 'yes', 'on'}:
                return True
            if lowered in {'false', '0', 'no', 'off'}:
                return False
        return bool(default_value)

    def _time_or_default(value, default_value):
        candidate = str(value or '').strip()
        if re.match(r'^\d{2}:\d{2}$', candidate):
            return candidate
        return str(default_value)

    base = fallback or _prefetch_time_policy_defaults()
    payload = raw_payload if isinstance(raw_payload, dict) else {}

    timezone_name = str(payload.get('timezone', base['timezone']) or '').strip() or base['timezone']
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        timezone_name = base['timezone']

    market_raw = payload.get('market') if isinstance(payload.get('market'), dict) else {}
    market_base = base['market']
    lunch_raw = market_raw.get('lunch_break') if isinstance(market_raw.get('lunch_break'), dict) else {}
    lunch_base = market_base['lunch_break']

    market = {
        'open_time': _time_or_default(market_raw.get('open_time'), market_base['open_time']),
        'close_time': _time_or_default(market_raw.get('close_time'), market_base['close_time']),
        'pre_open_minutes': _to_int(market_raw.get('pre_open_minutes'), market_base['pre_open_minutes'], min_value=0),
        'post_close_minutes': _to_int(market_raw.get('post_close_minutes'), market_base['post_close_minutes'], min_value=0),
        'lunch_break': {
            'enabled': _to_bool(lunch_raw.get('enabled'), lunch_base['enabled']),
            'start': _time_or_default(lunch_raw.get('start'), lunch_base['start']),
            'end': _time_or_default(lunch_raw.get('end'), lunch_base['end']),
        },
        'weekend_mode': str(market_raw.get('weekend_mode', market_base.get('weekend_mode', 'offhours')) or 'offhours').strip().lower(),
    }
    if market['weekend_mode'] not in {'offhours'}:
        market['weekend_mode'] = 'offhours'

    profiles_raw = payload.get('profiles') if isinstance(payload.get('profiles'), dict) else {}
    profiles = {}
    for profile_name, profile_base in base['profiles'].items():
        profile_raw = profiles_raw.get(profile_name) if isinstance(profiles_raw.get(profile_name), dict) else {}
        profiles[profile_name] = {
            'query_enabled': _to_bool(profile_raw.get('query_enabled'), profile_base['query_enabled']),
            'interval_seconds': _to_int(profile_raw.get('interval_seconds'), profile_base['interval_seconds'], min_value=5),
            'batch_size': _to_int(profile_raw.get('batch_size'), profile_base['batch_size'], min_value=1),
            'symbol_limit': _to_int(profile_raw.get('symbol_limit'), profile_base['symbol_limit'], min_value=0),
            'max_retries': _to_int(profile_raw.get('max_retries'), profile_base['max_retries'], min_value=0),
        }

    guard_raw = payload.get('rate_limit_guard') if isinstance(payload.get('rate_limit_guard'), dict) else {}
    guard_base = base['rate_limit_guard']
    rate_limit_guard = {
        'jitter_percent': min(max(_to_float(guard_raw.get('jitter_percent'), guard_base['jitter_percent']), 0.0), 50.0),
        'cooldown_multiplier_on_429': max(_to_float(guard_raw.get('cooldown_multiplier_on_429'), guard_base['cooldown_multiplier_on_429']), 1.0),
        'max_interval_seconds': _to_int(guard_raw.get('max_interval_seconds'), guard_base['max_interval_seconds'], min_value=60),
    }

    for profile_payload in profiles.values():
        profile_payload['interval_seconds'] = min(profile_payload['interval_seconds'], rate_limit_guard['max_interval_seconds'])

    return {
        'timezone': timezone_name,
        'market': market,
        'profiles': profiles,
        'rate_limit_guard': rate_limit_guard,
    }


def _get_prefetch_time_policy() -> dict:
    defaults = _prefetch_time_policy_defaults()
    raw = cache.get(PREFETCH_TIME_POLICY_CACHE_KEY)
    if not isinstance(raw, dict):
        return defaults
    return _coerce_prefetch_time_policy(raw, fallback=defaults)


def _parse_hhmm_to_minutes(hhmm: str, fallback_minutes: int) -> int:
    candidate = str(hhmm or '').strip()
    if not re.match(r'^\d{2}:\d{2}$', candidate):
        return int(fallback_minutes)
    hh, mm = candidate.split(':', 1)
    try:
        return max(min(int(hh) * 60 + int(mm), 1439), 0)
    except (TypeError, ValueError):
        return int(fallback_minutes)


def _resolve_prefetch_time_profile(now_dt=None, policy=None) -> tuple[str, str]:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    normalized_policy = _coerce_prefetch_time_policy(policy, fallback=_prefetch_time_policy_defaults())
    timezone_name = normalized_policy.get('timezone', 'Asia/Ho_Chi_Minh')
    try:
        tz = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo('Asia/Ho_Chi_Minh')
    local_now = (now_dt or timezone.now()).astimezone(tz)

    market = normalized_policy['market']
    open_minutes = _parse_hhmm_to_minutes(market.get('open_time'), 9 * 60)
    close_minutes = _parse_hhmm_to_minutes(market.get('close_time'), 15 * 60)
    if open_minutes >= close_minutes:
        open_minutes, close_minutes = 9 * 60, 15 * 60

    now_minutes = local_now.hour * 60 + local_now.minute
    pre_open_minutes = max(int(market.get('pre_open_minutes', 30)), 0)
    post_close_minutes = max(int(market.get('post_close_minutes', 30)), 0)
    pre_close_minutes = max(int(market.get('pre_close_minutes', pre_open_minutes)), 0)

    if local_now.weekday() >= 5 and market.get('weekend_mode') == 'offhours':
        return 'offhours', 'weekend_offhours_mode'

    lunch = market.get('lunch_break') if isinstance(market.get('lunch_break'), dict) else {}
    lunch_enabled = bool(lunch.get('enabled', False))
    lunch_start_minutes = _parse_hhmm_to_minutes(lunch.get('start'), 11 * 60 + 30)
    lunch_end_minutes = _parse_hhmm_to_minutes(lunch.get('end'), 13 * 60)

    pre_open_start = max(open_minutes - pre_open_minutes, 0)
    post_close_end = min(close_minutes + post_close_minutes, 24 * 60)
    pre_close_start = max(close_minutes - pre_close_minutes, open_minutes)

    if pre_open_start <= now_minutes < open_minutes:
        return 'pre_open', 'within_pre_open_window'
    if open_minutes <= now_minutes < close_minutes:
        if lunch_enabled and lunch_start_minutes <= now_minutes < lunch_end_minutes:
            return 'lunch_break', 'within_lunch_break_window'
        if pre_close_start <= now_minutes < close_minutes:
            return 'pre_close', 'within_pre_close_window'
        return 'market_open', 'within_market_open_window'
    if close_minutes <= now_minutes < post_close_end:
        return 'post_close', 'within_post_close_window'
    return 'offhours', 'outside_market_windows'


def _resolve_effective_prefetch_settings(runtime_settings=None, policy=None, now_dt=None) -> tuple[dict, dict]:
    base_runtime = dict(runtime_settings or _get_prefetch_runtime_settings())
    normalized_policy = _coerce_prefetch_time_policy(policy, fallback=_prefetch_time_policy_defaults())
    profile_name, reason = _resolve_prefetch_time_profile(now_dt=now_dt, policy=normalized_policy)
    profile_payload = normalized_policy.get('profiles', {}).get(profile_name, {})

    effective_settings = dict(base_runtime)
    for field in ('batch_size', 'symbol_limit', 'max_retries'):
        if field in profile_payload:
            try:
                effective_settings[field] = max(int(profile_payload.get(field)), 0 if field != 'batch_size' else 1)
            except (TypeError, ValueError):
                continue

    policy_meta = {
        'timezone': normalized_policy.get('timezone'),
        'profile': profile_name,
        'reason': reason,
        'query_enabled': bool(profile_payload.get('query_enabled', True)),
        'effective_interval_seconds': int(profile_payload.get('interval_seconds', 0) or 0),
    }
    return effective_settings, policy_meta


def _distinct_symbols(queryset) -> list[str]:
    return sorted({
        str(symbol).strip().upper()
        for symbol in queryset
        if symbol and str(symbol).strip()
    })


def _collect_prefetch_symbols(runtime_settings: dict | None = None) -> tuple[list[str], dict]:
    runtime_settings = runtime_settings or _get_prefetch_runtime_settings()
    include_group_symbols = bool(runtime_settings.get('include_group_symbols', False))
    symbol_limit = max(int(runtime_settings.get('symbol_limit', 240)), 0)

    source_lists = {
        'tracked_symbols': _distinct_symbols(TrackedSymbol.objects.values_list('symbol', flat=True).distinct()),
        'watchlist_items': _distinct_symbols(WatchlistItem.objects.values_list('symbol', flat=True).distinct()),
        'price_alerts': _distinct_symbols(PriceAlertRule.objects.values_list('symbol', flat=True).distinct()),
        'portfolio_transactions': _distinct_symbols(Transaction.objects.values_list('symbol', flat=True).distinct()),
    }
    if include_group_symbols:
        source_lists['market_group_items'] = _distinct_symbols(
            SecuritiesItem.objects.values_list('symbol', flat=True).distinct()
        )

    merged_symbols = []
    seen = set()
    for _, symbols in source_lists.items():
        for symbol in symbols:
            if symbol in seen:
                continue
            seen.add(symbol)
            merged_symbols.append(symbol)

    if symbol_limit:
        merged_symbols = merged_symbols[:symbol_limit]

    source_counts = {name: len(symbols) for name, symbols in source_lists.items()}
    return merged_symbols, source_counts


def _store_prefetch_meta(payload: dict, timeout: int = 600) -> None:
    try:
        cache.set(TICKER_PREFETCH_META_CACHE_KEY, payload, timeout=timeout)
    except Exception:
        pass


def _metric_cache_key(name: str, suffix: str | None = None) -> str:
    if suffix:
        return f'{PREFETCH_METRIC_CACHE_PREFIX}:{name}:{suffix}'
    return f'{PREFETCH_METRIC_CACHE_PREFIX}:{name}'


def _increment_prefetch_metric(name: str, *, suffix: str | None = None, amount: int = 1, timeout: int = 60 * 60 * 24) -> int:
    key = _metric_cache_key(name, suffix=suffix)
    try:
        if cache.add(key, int(amount), timeout=timeout):
            return int(amount)
        value = cache.incr(key, amount)
        cache.touch(key, timeout=timeout)
        return int(value)
    except Exception:
        try:
            current = int(cache.get(key) or 0)
            current += int(amount)
            cache.set(key, current, timeout=timeout)
            return current
        except Exception:
            return 0


def _is_rate_limited_error(exc: Exception) -> bool:
    message = str(exc or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'gioi han api' in message
        or 'giới hạn api' in message
    )


def _row_get_value(row, key_options: list):
    for key in key_options:
        try:
            value = row.get(key)
        except Exception:
            value = None
        if value is None:
            continue
        try:
            if pd.isna(value):
                continue
        except Exception:
            pass
        return value
    return None


def _extract_row_symbol(row):
    raw = _row_get_value(
        row,
        [
            ('listing', 'symbol'),
            ('symbol', ''),
            ('symbol', 'symbol'),
            'symbol',
            'listing_symbol',
            'ticker',
        ],
    )
    value = str(raw or '').strip().upper()
    return value or None


def _extract_row_ref_price(row):
    return _row_get_value(
        row,
        [
            ('listing', 'ref_price'),
            ('match', 'reference_price'),
            'ref_price',
            'reference_price',
        ],
    )


def _extract_row_match_price(row):
    return _row_get_value(
        row,
        [
            ('match', 'match_price'),
            'match_price',
            'price',
            'last_price',
        ],
    )


def _extract_row_open_price(row):
    return _row_get_value(row, [('match', 'open_price'), 'open_price'])


def _extract_row_highest(row):
    return _row_get_value(row, [('match', 'highest'), 'highest', 'high'])


def _extract_row_lowest(row):
    return _row_get_value(row, [('match', 'lowest'), 'lowest', 'low'])


def _extract_row_volume(row):
    return _row_get_value(
        row,
        [
            ('match', 'accumulated_volume'),
            'accumulated_volume',
            'match_volume',
            'volume',
        ],
    )


def _prefetch_retry_countdown(retries: int) -> int:
    runtime_settings = _get_prefetch_runtime_settings()
    base = max(int(runtime_settings.get('retry_base_seconds', 8)), 1)
    max_seconds = max(int(runtime_settings.get('retry_max_seconds', 120)), base)
    return min(max_seconds, base * (2 ** max(retries, 0)))


def _prefetch_retry_countdown_with_policy(retries: int, runtime_settings: dict | None = None, policy_guard: dict | None = None) -> tuple[int, float]:
    settings_payload = runtime_settings or _get_prefetch_runtime_settings()
    base = max(int(settings_payload.get('retry_base_seconds', 8)), 1)
    max_seconds = max(int(settings_payload.get('retry_max_seconds', 120)), base)
    base_countdown = min(max_seconds, base * (2 ** max(retries, 0)))

    guard = policy_guard if isinstance(policy_guard, dict) else {}
    multiplier = float(guard.get('cooldown_multiplier_on_429', 1.0) or 1.0)
    if multiplier < 1.0:
        multiplier = 1.0
    max_interval = max(int(guard.get('max_interval_seconds', max_seconds) or max_seconds), 1)
    adjusted = int(base_countdown * multiplier)
    adjusted = min(max_interval, max(adjusted, 1))
    return adjusted, multiplier


def _mark_price_board_rate_limited(exc: Exception) -> None:
    runtime_settings = _get_prefetch_runtime_settings()
    cooldown_seconds = max(int(runtime_settings.get('rate_limit_cooldown_seconds', 20)), 5)
    try:
        cache.set(
            VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
            {
                'triggered_at': timezone.now().isoformat(),
                'reason': str(exc or '')[:200],
            },
            timeout=cooldown_seconds,
        )
    except Exception:
        pass


def _record_vnstock_timeout(exc: Exception) -> bool:
    if not isinstance(exc, (TimeoutError, ConnectionError, OSError)):
        return False
    try:
        runtime_settings = _get_prefetch_runtime_settings()
        _counter_window = int(runtime_settings.get('circuit_window_seconds', 300))
        _threshold = int(runtime_settings.get('circuit_breaker_timeout_threshold', 3))
        _circuit_cooldown = int(runtime_settings.get('circuit_breaker_cooldown_seconds', 1800))

        current = cache.get(VNSTOCK_TIMEOUT_COUNTER_KEY) or 0
        new_count = current + 1
        cache.set(VNSTOCK_TIMEOUT_COUNTER_KEY, new_count, timeout=_counter_window)

        if new_count >= _threshold:
            logger.warning(
                'vnstock circuit breaker triggered after %d consecutive timeouts - pausing %ds',
                new_count,
                _circuit_cooldown,
            )
            cache.set(
                VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
                {
                    'triggered_at': timezone.now().isoformat(),
                    'reason': f'circuit_breaker_timeout_threshold_exceeded count={new_count}',
                },
                timeout=_circuit_cooldown,
            )
            cache.delete(VNSTOCK_TIMEOUT_COUNTER_KEY)
            return True
    except Exception:
        pass
    return False


@shared_task(bind=True, name='portfolio.tasks.prefetch_ticker_price_board')
def prefetch_ticker_price_board(self) -> dict:
    runtime_settings = _get_prefetch_runtime_settings()
    time_policy = _get_prefetch_time_policy()
    effective_settings, policy_meta = _resolve_effective_prefetch_settings(
        runtime_settings=runtime_settings,
        policy=time_policy,
    )
    _increment_prefetch_metric('profile_hits_total', suffix=str(policy_meta.get('profile') or 'unknown').lower())
    batch_size = max(int(effective_settings.get('batch_size', 60)), 1)
    symbols, source_counts = _collect_prefetch_symbols(runtime_settings=effective_settings)
    if not policy_meta.get('query_enabled', True):
        skip_total = _increment_prefetch_metric('skip_total', suffix='policy_disabled')
        payload = {
            'status': 'throttled_by_policy',
            'reason': policy_meta.get('reason', 'policy_query_disabled'),
            'policy': policy_meta,
            'metrics': {
                'skip_total': skip_total,
            },
            'symbols': len(symbols),
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload

    if not symbols:
        payload = {
            'status': 'ok',
            'policy': policy_meta,
            'symbols': 0,
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': [],
        }
        _store_prefetch_meta(payload)
        return payload

    def _f(val):
        try:
            v = float(val)
            return v if v == v and v != 0 else None
        except (TypeError, ValueError):
            return None

    def _i(val):
        try:
            v = float(val)
            return int(v) if v == v else None
        except (TypeError, ValueError):
            return None

    now_iso = timezone.now().isoformat()
    cached_count = 0
    processed_batches = 0
    max_retries = max(int(effective_settings.get('max_retries', 6)), 0)
    if cache.get(VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY):
        payload = {
            'status': 'backoff',
            'reason': 'price_board rate limit cooldown active',
            'policy': policy_meta,
            'symbols': len(symbols),
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload
    try:
        for start in range(0, len(symbols), batch_size):
            batch_symbols = symbols[start:start + batch_size]
            # Preserve compatibility with tests that patch portfolio.tasks.fetch_price_board_dataframe.
            from portfolio import tasks as tasks_facade

            fetch_fn = getattr(tasks_facade, 'fetch_price_board_dataframe', fetch_price_board_dataframe)
            df = fetch_fn(batch_symbols, anchor_symbol=batch_symbols[0])
            processed_batches += 1

            if df is None or df.empty:
                continue

            for _, row in df.iterrows():
                try:
                    sym = _extract_row_symbol(row)
                    if not sym:
                        continue
                    match_price = _f(_extract_row_match_price(row))
                    ref_price = (
                        _f(_extract_row_ref_price(row))
                    )
                    highest = _f(_extract_row_highest(row))
                    lowest = _f(_extract_row_lowest(row))
                    open_price = _f(_extract_row_open_price(row))
                    accum_vol = _i(_extract_row_volume(row))
                    change_value = round(match_price - ref_price, 2) if match_price and ref_price else None
                    change_pct = (
                        round((match_price - ref_price) / ref_price * 100, 2)
                        if match_price and ref_price
                        else None
                    )
                    data = {
                        'symbol': sym,
                        'current_price': match_price,
                        'prev_price': ref_price,
                        'change_value': change_value,
                        'change_pct': change_pct,
                        'high_price': highest,
                        'low_price': lowest,
                        'open_price': open_price,
                        'volume': accum_vol,
                        'last_date': now_iso,
                        'freshness_seconds': 0,
                        'stale': False,
                        'source': 'prefetch',
                    }
                    cache.set(f'ticker:{sym}', data, timeout=60)
                    cached_count += 1
                except Exception as exc:
                    logger.warning('prefetch_ticker_price_board parse error row: %s', exc)
    except (Exception, SystemExit) as exc:
        logger.warning('prefetch_ticker_price_board vnstock error: %s', exc)
        _record_vnstock_timeout(exc)
        if _is_rate_limited_error(exc):
            _mark_price_board_rate_limited(exc)
            policy_guard = time_policy.get('rate_limit_guard', {}) if isinstance(time_policy, dict) else {}
            countdown, multiplier_applied = _prefetch_retry_countdown_with_policy(
                getattr(self.request, 'retries', 0),
                runtime_settings=effective_settings,
                policy_guard=policy_guard,
            )
            multiplier_total = _increment_prefetch_metric('429_multiplier_total')
            payload = {
                'status': 'retrying',
                'reason': str(exc),
                'policy': policy_meta,
                'policy_cooldown_multiplier_applied': multiplier_applied,
                'policy_effective_retry_after_seconds': countdown,
                'metrics': {
                    '429_multiplier_total': multiplier_total,
                },
                'symbols': len(symbols),
                'cached': cached_count,
                'source_counts': source_counts,
                'generated_at': timezone.now().isoformat(),
                'batch_size': batch_size,
                'batches': processed_batches,
                'sample_symbols': symbols[:10],
                'retry_after_seconds': countdown,
                'retry_count': getattr(self.request, 'retries', 0) + 1,
                'max_retries': max_retries,
            }
            _store_prefetch_meta(payload)
            raise self.retry(exc=exc, countdown=countdown, max_retries=max_retries)

        payload = {
            'status': 'error',
            'reason': str(exc),
            'policy': policy_meta,
            'symbols': len(symbols),
            'cached': cached_count,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': processed_batches,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload

    status = 'ok'
    reason = None
    if len(symbols) > 0 and processed_batches > 0 and cached_count == 0:
        status = 'parse_zero_cached'
        reason = 'no_rows_parsed_from_provider_payload'

    payload = {
        'status': status,
        'policy': policy_meta,
        'symbols': len(symbols),
        'cached': cached_count,
        'source_counts': source_counts,
        'generated_at': now_iso,
        'batch_size': batch_size,
        'batches': processed_batches,
        'sample_symbols': symbols[:10],
        'retry_count': getattr(self.request, 'retries', 0),
    }
    if reason:
        payload['reason'] = reason
    _store_prefetch_meta(payload)
    logger.info(
        'prefetch_ticker_price_board: symbols=%d cached=%d batches=%d status=%s',
        len(symbols),
        cached_count,
        processed_batches,
        status,
    )
    return payload


@shared_task(bind=True, name='portfolio.tasks.offpeak_vnstock_ingest')
def offpeak_vnstock_ingest(self, days: int | None = None, max_symbols: int | None = None, trigger: str = 'manual') -> dict:
    """
    Off-peak ingest pipeline:
    1) Pull OHLCV into DailyPrice (DB)
    2) Refresh ticker cache from latest DB rows (Redis)
    """
    from datetime import timedelta

    from portfolio.services import fetch_and_save_daily_prices

    resolved_days = max(int(days or os.getenv('OFFPEAK_VNSTOCK_INGEST_DAYS', '5')), 1)
    resolved_max_symbols = max(int(max_symbols or os.getenv('OFFPEAK_VNSTOCK_INGEST_MAX_SYMBOLS', '300')), 1)
    runtime_settings = _get_prefetch_runtime_settings()
    symbols, source_counts = _collect_prefetch_symbols(runtime_settings=runtime_settings)
    symbols = symbols[:resolved_max_symbols]

    if not symbols:
        return {
            'status': 'ok',
            'trigger': str(trigger or 'manual'),
            'days': resolved_days,
            'max_symbols': resolved_max_symbols,
            'symbols_total': 0,
            'symbols_ingested': 0,
            'db_created': 0,
            'db_updated': 0,
            'db_errors': 0,
            'cache_refreshed': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
        }

    end_date = timezone.localdate()
    start_date = end_date - timedelta(days=max(resolved_days - 1, 0))
    db_created = 0
    db_updated = 0
    db_errors = 0
    symbols_ingested = 0
    cache_refreshed = 0
    failed_symbols: list[str] = []

    for symbol in symbols:
        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            continue

        try:
            ingest_result = fetch_and_save_daily_prices(
                normalized_symbol,
                start_date=start_date,
                end_date=end_date,
            )
            db_created += int(ingest_result.get('created', 0) or 0)
            db_updated += int(ingest_result.get('updated', 0) or 0)
            symbol_errors = int(ingest_result.get('errors', 0) or 0)
            db_errors += symbol_errors
            if symbol_errors > 0:
                failed_symbols.append(normalized_symbol)
            symbols_ingested += 1
        except Exception as exc:
            logger.warning('offpeak_vnstock_ingest failed for %s: %s', normalized_symbol, exc)
            db_errors += 1
            failed_symbols.append(normalized_symbol)
            continue

        latest = DailyPrice.objects.filter(symbol=normalized_symbol).order_by('-date').first()
        if latest is None:
            continue

        prev = (
            DailyPrice.objects.filter(symbol=normalized_symbol, date__lt=latest.date)
            .order_by('-date')
            .first()
        )

        try:
            current_price = float(latest.close_price)
        except (TypeError, ValueError):
            current_price = None
        try:
            prev_price = float(prev.close_price) if prev is not None and prev.close_price is not None else None
        except (TypeError, ValueError):
            prev_price = None

        if current_price is not None and prev_price not in (None, 0):
            change_value = round(current_price - prev_price, 2)
            change_pct = round((change_value / prev_price) * 100, 2)
        else:
            change_value = None
            change_pct = None

        cache_payload = {
            'symbol': normalized_symbol,
            'current_price': current_price,
            'prev_price': prev_price,
            'change_value': change_value,
            'change_pct': change_pct,
            'high_price': float(latest.high_price) if latest.high_price is not None else None,
            'low_price': float(latest.low_price) if latest.low_price is not None else None,
            'open_price': float(latest.open_price) if latest.open_price is not None else None,
            'volume': int(latest.volume) if latest.volume is not None else None,
            'last_date': timezone.now().isoformat(),
            'freshness_seconds': 0,
            'stale': False,
            'source': 'offpeak_db_ingest',
            'price_date': latest.date.isoformat(),
        }
        cache.set(f'ticker:{normalized_symbol}', cache_payload, timeout=60 * 60)
        cache_refreshed += 1

    status = 'ok' if not failed_symbols else 'partial'
    return {
        'status': status,
        'trigger': str(trigger or 'manual'),
        'days': resolved_days,
        'max_symbols': resolved_max_symbols,
        'symbols_total': len(symbols),
        'symbols_ingested': symbols_ingested,
        'db_created': db_created,
        'db_updated': db_updated,
        'db_errors': db_errors,
        'cache_refreshed': cache_refreshed,
        'failed_symbols': sorted(set(failed_symbols))[:30],
        'source_counts': source_counts,
        'generated_at': timezone.now().isoformat(),
    }
