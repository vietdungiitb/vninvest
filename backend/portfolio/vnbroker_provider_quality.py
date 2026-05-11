from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

from django.core.cache import cache

from portfolio.market_calendar import resolve_market_phase


PROVIDER_QUALITY_CACHE_PREFIX = 'vnbroker:provider_quality'
PROVIDER_QUALITY_SELECTION_CACHE_PREFIX = 'vnbroker:provider_quality:selected'
PROVIDER_QUALITY_CACHE_TTL_SECONDS = 60 * 60
PROVIDER_QUALITY_SELECTION_TTL_SECONDS = 60 * 60
PROVIDER_QUALITY_HYSTERESIS_DELTA = 3.0

QUALITY_COMPONENT_WEIGHTS = {
    'freshness': 0.40,
    'completeness': 0.30,
    'success_rate': 0.20,
    'parse_quality': 0.10,
}


def _normalize_provider(provider: str | None) -> str:
    return str(provider or '').strip().upper()


def _normalize_channel(channel: str | None) -> str:
    normalized = str(channel or '').strip().lower()
    return normalized or 'default'


def _normalize_market_phase(market_phase: str | None) -> str:
    normalized = str(market_phase or '').strip().lower()
    if normalized:
        return normalized

    try:
        resolved_phase = resolve_market_phase()
    except Exception:
        return 'default'

    return str((resolved_phase or {}).get('profile') or '').strip().lower() or 'default'


def _clamp_percent(raw_value: Any) -> float:
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        value = 0.0
    return max(0.0, min(value, 100.0))


def _normalize_component_weights(raw_weights: dict[str, Any] | None = None) -> dict[str, float]:
    weights = dict(QUALITY_COMPONENT_WEIGHTS)
    if isinstance(raw_weights, dict):
        for component in weights:
            try:
                parsed_weight = float(raw_weights.get(component, weights[component]))
            except (TypeError, ValueError):
                parsed_weight = weights[component]
            weights[component] = max(parsed_weight, 0.0)

    total_weight = sum(weights.values())
    if total_weight <= 0:
        return dict(QUALITY_COMPONENT_WEIGHTS)
    return {component: value / total_weight for component, value in weights.items()}


def calculate_provider_quality_score(
    metrics: dict[str, Any] | None,
    *,
    weights: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = metrics if isinstance(metrics, dict) else {}
    normalized_metrics = {
        'freshness_pct': _clamp_percent(payload.get('freshness_pct', payload.get('freshness'))),
        'completeness_pct': _clamp_percent(payload.get('completeness_pct', payload.get('completeness'))),
        'success_rate_pct': _clamp_percent(payload.get('success_rate_pct', payload.get('success_rate'))),
        'parse_quality_pct': _clamp_percent(payload.get('parse_quality_pct', payload.get('parse_quality'))),
    }
    normalized_weights = _normalize_component_weights(weights)

    contributions = {
        'freshness': round(normalized_metrics['freshness_pct'] * normalized_weights['freshness'], 2),
        'completeness': round(normalized_metrics['completeness_pct'] * normalized_weights['completeness'], 2),
        'success_rate': round(normalized_metrics['success_rate_pct'] * normalized_weights['success_rate'], 2),
        'parse_quality': round(normalized_metrics['parse_quality_pct'] * normalized_weights['parse_quality'], 2),
    }
    score = round(sum(contributions.values()), 2)

    return {
        'score': score,
        'metrics': normalized_metrics,
        'weights': normalized_weights,
        'contributions': contributions,
    }


def build_provider_quality_snapshot(
    provider: str,
    channel: str,
    metrics: dict[str, Any] | None,
    *,
    source: str = 'runtime',
    observed_at: str | None = None,
    weights: dict[str, Any] | None = None,
) -> dict[str, Any]:
    score_payload = calculate_provider_quality_score(metrics, weights=weights)
    return {
        'provider': _normalize_provider(provider),
        'channel': _normalize_channel(channel),
        'source': str(source or 'runtime').strip().lower() or 'runtime',
        'observed_at': observed_at or datetime.now(timezone.utc).isoformat(),
        'score': score_payload['score'],
        'metrics': score_payload['metrics'],
        'weights': score_payload['weights'],
        'contributions': score_payload['contributions'],
    }


def _snapshot_cache_key(channel: str, provider: str) -> str:
    return f'{PROVIDER_QUALITY_CACHE_PREFIX}:{_normalize_channel(channel)}:{_normalize_provider(provider)}'


def _selection_cache_key(channel: str, market_phase: str | None = None) -> str:
    return f'{PROVIDER_QUALITY_SELECTION_CACHE_PREFIX}:{_normalize_channel(channel)}:{_normalize_market_phase(market_phase)}'


def cache_provider_quality_snapshot(snapshot: dict[str, Any], ttl_seconds: int = PROVIDER_QUALITY_CACHE_TTL_SECONDS) -> None:
    if not isinstance(snapshot, dict):
        return
    provider = _normalize_provider(snapshot.get('provider'))
    channel = _normalize_channel(snapshot.get('channel'))
    if not provider:
        return

    timeout = max(int(ttl_seconds or PROVIDER_QUALITY_CACHE_TTL_SECONDS), 30)
    try:
        cache.set(_snapshot_cache_key(channel, provider), copy.deepcopy(snapshot), timeout=timeout)
    except Exception:
        return


def get_provider_quality_snapshot(channel: str, provider: str) -> dict[str, Any] | None:
    provider_name = _normalize_provider(provider)
    if not provider_name:
        return None
    try:
        cached = cache.get(_snapshot_cache_key(channel, provider_name))
    except Exception:
        return None
    if isinstance(cached, dict):
        return copy.deepcopy(cached)
    return None


def cache_provider_quality_selection(
    channel: str,
    provider: str,
    ttl_seconds: int = PROVIDER_QUALITY_SELECTION_TTL_SECONDS,
    *,
    market_phase: str | None = None,
) -> None:
    provider_name = _normalize_provider(provider)
    if not provider_name:
        return
    timeout = max(int(ttl_seconds or PROVIDER_QUALITY_SELECTION_TTL_SECONDS), 30)
    try:
        cache.set(_selection_cache_key(channel, market_phase=market_phase), provider_name, timeout=timeout)
    except Exception:
        return


def get_provider_quality_selection(channel: str, market_phase: str | None = None) -> str | None:
    try:
        cached = cache.get(_selection_cache_key(channel, market_phase=market_phase))
    except Exception:
        return None
    provider_name = _normalize_provider(cached)
    return provider_name or None


def _score_snapshot_sort_key(item: tuple[int, str, dict[str, Any] | None]) -> tuple[float, float, int]:
    index, provider, snapshot = item
    if not isinstance(snapshot, dict):
        return (-1.0, -1.0, index)

    try:
        score = float(snapshot.get('score') or 0.0)
    except (TypeError, ValueError):
        score = 0.0

    try:
        freshness = float((snapshot.get('metrics') or {}).get('freshness_pct') or 0.0)
    except (TypeError, ValueError):
        freshness = 0.0

    return (-score, -freshness, index)


def resolve_provider_order(
    channel: str,
    candidates: list[str] | tuple[str, ...],
    *,
    hysteresis_delta: float | None = None,
    market_phase: str | None = None,
) -> list[str]:
    resolved_market_phase = _normalize_market_phase(market_phase)

    normalized_candidates: list[str] = []
    for candidate in candidates or []:
        provider = _normalize_provider(candidate)
        if provider and provider not in normalized_candidates:
            normalized_candidates.append(provider)

    if not normalized_candidates:
        return []

    snapshots: dict[str, dict[str, Any]] = {}
    scored_candidates: list[tuple[int, str, dict[str, Any]]] = []
    for index, provider in enumerate(normalized_candidates):
        snapshot = get_provider_quality_snapshot(channel, provider)
        if snapshot is None:
            continue
        snapshots[provider] = snapshot
        scored_candidates.append((index, provider, snapshot))

    if not scored_candidates:
        return normalized_candidates

    ranked = sorted(scored_candidates, key=_score_snapshot_sort_key)
    chosen_provider = ranked[0][1]
    chosen_snapshot = ranked[0][2]

    selected_provider = get_provider_quality_selection(channel, market_phase=resolved_market_phase)
    if selected_provider and selected_provider in snapshots and selected_provider != chosen_provider:
        selected_snapshot = snapshots[selected_provider]
        try:
            selected_score = float(selected_snapshot.get('score') or 0.0)
        except (TypeError, ValueError):
            selected_score = 0.0
        try:
            top_score = float(chosen_snapshot.get('score') or 0.0)
        except (TypeError, ValueError):
            top_score = 0.0

        delta = PROVIDER_QUALITY_HYSTERESIS_DELTA if hysteresis_delta is None else max(float(hysteresis_delta), 0.0)
        if top_score - selected_score <= delta:
            chosen_provider = selected_provider

    ordered: list[str] = [chosen_provider]
    for _index, provider, _snapshot in ranked:
        if provider != chosen_provider and provider not in ordered:
            ordered.append(provider)

    for provider in normalized_candidates:
        if provider not in ordered:
            ordered.append(provider)

    cache_provider_quality_selection(channel, chosen_provider, market_phase=resolved_market_phase)
    return ordered