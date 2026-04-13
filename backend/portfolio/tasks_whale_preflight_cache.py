from __future__ import annotations

import logging
from datetime import date, timedelta

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


WHALE_PREFLIGHT_METRIC_PREFIX = 'whale_preflight:metrics'
METRIC_EXISTING_ADVISORY_HIT = 'existing_advisory_hit'
METRIC_EXISTING_ADVISORY_MISS = 'existing_advisory_miss'
METRIC_COOLDOWN_HIT = 'cooldown_hit'
METRIC_COOLDOWN_MISS = 'cooldown_miss'
METRIC_COOLDOWN_BYPASS_FORCE_REFRESH = 'cooldown_bypass_force_refresh'

WHALE_PREFLIGHT_METRIC_NAMES = (
    METRIC_EXISTING_ADVISORY_HIT,
    METRIC_EXISTING_ADVISORY_MISS,
    METRIC_COOLDOWN_HIT,
    METRIC_COOLDOWN_MISS,
    METRIC_COOLDOWN_BYPASS_FORCE_REFRESH,
)


def _metric_cache_key(*, day_key: str, metric: str) -> str:
    return f'{WHALE_PREFLIGHT_METRIC_PREFIX}:{day_key}:{metric}'


def _read_preflight_metrics(*, day_key: str, metric_names: tuple[str, ...] = WHALE_PREFLIGHT_METRIC_NAMES) -> dict:
    metrics: dict[str, int] = {}
    for name in metric_names:
        try:
            metrics[name] = int(cache.get(_metric_cache_key(day_key=day_key, metric=name)) or 0)
        except Exception:
            metrics[name] = 0
    return metrics


def _read_preflight_metrics_window(
    *,
    end_date: date,
    window_days: int,
    metric_names: tuple[str, ...] = WHALE_PREFLIGHT_METRIC_NAMES,
) -> list[dict]:
    rows: list[dict] = []
    for offset in reversed(range(window_days)):
        current_day = end_date - timedelta(days=offset)
        day_key = current_day.isoformat()
        rows.append(
            {
                'date': day_key,
                'metrics': _read_preflight_metrics(day_key=day_key, metric_names=metric_names),
            }
        )
    return rows


def _sum_preflight_metrics_window(
    *,
    window_rows: list[dict],
    metric_names: tuple[str, ...] = WHALE_PREFLIGHT_METRIC_NAMES,
) -> dict:
    totals = {name: 0 for name in metric_names}
    for row in window_rows:
        metrics = row.get('metrics') if isinstance(row, dict) else None
        if not isinstance(metrics, dict):
            continue
        for name in metric_names:
            try:
                totals[name] += int(metrics.get(name) or 0)
            except Exception:
                continue
    return totals


def _build_preflight_metric_rates(*, totals: dict) -> dict:
    existing_hit = int(totals.get(METRIC_EXISTING_ADVISORY_HIT) or 0)
    existing_miss = int(totals.get(METRIC_EXISTING_ADVISORY_MISS) or 0)
    cooldown_hit = int(totals.get(METRIC_COOLDOWN_HIT) or 0)
    cooldown_miss = int(totals.get(METRIC_COOLDOWN_MISS) or 0)
    cooldown_bypass = int(totals.get(METRIC_COOLDOWN_BYPASS_FORCE_REFRESH) or 0)

    existing_total = existing_hit + existing_miss
    cooldown_total = cooldown_hit + cooldown_miss
    cooldown_decisions_total = cooldown_hit + cooldown_miss + cooldown_bypass

    return {
        'existing_advisory_hit_rate_pct': round(existing_hit / existing_total * 100.0, 2) if existing_total else None,
        'cooldown_hit_rate_pct': round(cooldown_hit / cooldown_total * 100.0, 2) if cooldown_total else None,
        'cooldown_bypass_rate_pct': (
            round(cooldown_bypass / cooldown_decisions_total * 100.0, 2) if cooldown_decisions_total else None
        ),
    }


def _build_preflight_metric_summary(*, totals: dict, rates: dict) -> dict:
    signal_items = [
        {'name': name, 'count': int(totals.get(name) or 0)}
        for name in WHALE_PREFLIGHT_METRIC_NAMES
    ]
    signal_items.sort(key=lambda item: (-item['count'], item['name']))
    top_signal = signal_items[0] if signal_items else {'name': None, 'count': 0}

    existing_total = int(totals.get(METRIC_EXISTING_ADVISORY_HIT) or 0) + int(totals.get(METRIC_EXISTING_ADVISORY_MISS) or 0)
    cooldown_total = int(totals.get(METRIC_COOLDOWN_HIT) or 0) + int(totals.get(METRIC_COOLDOWN_MISS) or 0)
    bypass_total = int(totals.get(METRIC_COOLDOWN_BYPASS_FORCE_REFRESH) or 0)
    decision_volume_total = existing_total + cooldown_total + bypass_total

    return {
        'top_signal_name': top_signal['name'],
        'top_signal_count': top_signal['count'],
        'decision_volume_total': decision_volume_total,
        'existing_advisory_decisions_total': existing_total,
        'cooldown_decisions_total': cooldown_total,
        'force_refresh_bypass_total': bypass_total,
        'existing_advisory_hit_rate_pct': rates.get('existing_advisory_hit_rate_pct'),
        'cooldown_hit_rate_pct': rates.get('cooldown_hit_rate_pct'),
        'cooldown_bypass_rate_pct': rates.get('cooldown_bypass_rate_pct'),
    }


def _increment_preflight_counter(metric: str) -> None:
    if metric not in WHALE_PREFLIGHT_METRIC_NAMES:
        logger.warning('Unknown whale preflight metric: %s', metric)
        return

    key = _metric_cache_key(day_key=timezone.localdate().isoformat(), metric=metric)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=90_000)
    except Exception:
        pass


def _build_skip_response(*, symbol: str, reason: str) -> dict:
    return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': reason}}


def _check_existing_advisory_skip(*, force_refresh: bool, latest_existing_advisory, symbol: str) -> dict | None:
    if force_refresh or latest_existing_advisory is None:
        _increment_preflight_counter(METRIC_EXISTING_ADVISORY_MISS)
        return None
    logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
    _increment_preflight_counter(METRIC_EXISTING_ADVISORY_HIT)
    return _build_skip_response(symbol=symbol, reason='existing_advisory')


def _check_cooldown_skip(*, force_refresh: bool, cache_key: str, symbol: str) -> dict | None:
    if force_refresh:
        _increment_preflight_counter(METRIC_COOLDOWN_BYPASS_FORCE_REFRESH)
        return None

    has_cooldown = bool(cache.get(cache_key))
    if not has_cooldown:
        _increment_preflight_counter(METRIC_COOLDOWN_MISS)
        return None

    logger.info('Whale advisory cooldown active — skipping %s', symbol)
    _increment_preflight_counter(METRIC_COOLDOWN_HIT)
    return _build_skip_response(symbol=symbol, reason='cooldown')


def _check_preflight_cache_skips(
    *,
    force_refresh: bool,
    latest_existing_advisory,
    cache_key: str,
    symbol: str,
) -> dict | None:
    existing_skip = _check_existing_advisory_skip(
        force_refresh=force_refresh,
        latest_existing_advisory=latest_existing_advisory,
        symbol=symbol,
    )
    if existing_skip is not None:
        return existing_skip

    cooldown_skip = _check_cooldown_skip(
        force_refresh=force_refresh,
        cache_key=cache_key,
        symbol=symbol,
    )
    if cooldown_skip is not None:
        return cooldown_skip

    return None
