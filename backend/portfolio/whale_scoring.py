from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import math

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone


_CACHE_KEY = 'whale_score_config:active'
_DEFAULT_SCORE_CONFIG = {
    'version': 'weights-v1',
    'decay_half_life_seconds': 900,
    'weights': {
        'size_impact': 0.6,
        'aggression_bonus': 0.15,
        'concentration_ratio': 0.25,
    },
    'severity_bands': [
        {'key': 'low', 'min': 0, 'max': 25},
        {'key': 'medium', 'min': 25, 'max': 50},
        {'key': 'high', 'min': 50, 'max': 75},
        {'key': 'extreme', 'min': 75, 'max': 101},
    ],
}

_PROFILE_DEFAULTS = {
    'v1': {
        'version': 'weights-v1',
        'weights': {
            'size_impact': 0.6,
            'aggression_bonus': 0.15,
            'concentration_ratio': 0.25,
        },
        'severity_bands': [
            {'key': 'low', 'min': 0, 'max': 25},
            {'key': 'medium', 'min': 25, 'max': 50},
            {'key': 'high', 'min': 50, 'max': 75},
            {'key': 'extreme', 'min': 75, 'max': 101},
        ],
    },
    'v2': {
        'version': 'weights-v2',
        'weights': {
            'size_impact': 0.64,
            'aggression_bonus': 0.10,
            'concentration_ratio': 0.26,
        },
        'severity_bands': [
            {'key': 'low', 'min': 0, 'max': 28},
            {'key': 'medium', 'min': 28, 'max': 56},
            {'key': 'high', 'min': 56, 'max': 82},
            {'key': 'extreme', 'min': 82, 'max': 101},
        ],
    },
}


def _safe_cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        return None


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _normalize_weights(raw_weights: dict | None) -> dict:
    weights = dict((_DEFAULT_SCORE_CONFIG.get('weights') or {}))
    if isinstance(raw_weights, dict):
        for key, value in raw_weights.items():
            try:
                weights[key] = max(float(value), 0.0)
            except (TypeError, ValueError):
                continue

    total = sum(weights.values())
    if total <= 0:
        return dict((_DEFAULT_SCORE_CONFIG.get('weights') or {}))
    return {key: value / total for key, value in weights.items()}


def _resolve_scoring_profile() -> str:
    profile = str(getattr(settings, 'WHALE_SCORE_PROFILE', 'v1') or 'v1').strip().lower()
    return profile if profile in _PROFILE_DEFAULTS else 'v1'


def _aggression_bonus_for_side(side: str, size_ratio: float, profile: str) -> float:
    if side not in ('buy', 'sell'):
        return 0.35

    if profile != 'v2':
        return 1.0

    # v2: near-threshold events get less aggression boost to reduce false-critical bursts.
    if size_ratio < 1.2:
        return 0.55
    if size_ratio < 2.0:
        return 0.78
    return 1.0


def resolve_whale_score_config() -> dict:
    cached_config = _safe_cache_get(_CACHE_KEY)
    profile = _resolve_scoring_profile()
    profile_defaults = deepcopy(_PROFILE_DEFAULTS.get(profile) or _PROFILE_DEFAULTS['v1'])

    base = deepcopy(getattr(settings, 'WHALE_SCORE_DEFAULT_CONFIG', None) or _DEFAULT_SCORE_CONFIG)
    base.update({
        'version': profile_defaults['version'],
        'weights': profile_defaults['weights'],
        'severity_bands': profile_defaults['severity_bands'],
    })

    if isinstance(cached_config, dict):
        base.update({key: value for key, value in cached_config.items() if key != 'weights'})
        if 'weights' in cached_config:
            base['weights'] = cached_config['weights']

    base['weights'] = _normalize_weights(base.get('weights'))
    try:
        base['decay_half_life_seconds'] = max(int(base.get('decay_half_life_seconds') or 900), 60)
    except (TypeError, ValueError):
        base['decay_half_life_seconds'] = 900
    if not isinstance(base.get('severity_bands'), list) or not base['severity_bands']:
        base['severity_bands'] = deepcopy(_DEFAULT_SCORE_CONFIG['severity_bands'])
    base['version'] = str(base.get('version') or 'weights-v1')
    base['profile'] = profile
    return base


def classify_severity(score: float, config: dict | None = None) -> str:
    score_config = config or resolve_whale_score_config()
    try:
        numeric_score = float(score)
    except (TypeError, ValueError):
        numeric_score = 0.0

    for band in score_config.get('severity_bands', []):
        try:
            band_min = float(band.get('min', 0))
            band_max = float(band.get('max', 0))
        except (TypeError, ValueError):
            continue
        if band_min <= numeric_score < band_max:
            return str(band.get('key') or 'low')
    return 'extreme' if numeric_score >= 75 else 'low'


def calculate_event_score(trade: dict, context: dict | None = None, config: dict | None = None) -> dict:
    score_config = config or resolve_whale_score_config()
    context = context or {}

    matched_value = float(trade.get('matched_value') or 0.0)
    threshold_vnd = max(float(context.get('threshold_vnd') or trade.get('threshold') or 1.0), 1.0)
    side = str(trade.get('side') or context.get('side') or '').strip().lower()
    profile = str(score_config.get('profile') or 'v1').strip().lower()

    size_ratio = matched_value / threshold_vnd
    size_impact = _clamp(size_ratio / 4.0)
    aggression_bonus = _aggression_bonus_for_side(side, size_ratio=size_ratio, profile=profile)
    concentration_ratio_raw = context.get('concentration_ratio')
    if concentration_ratio_raw is None:
        denominator_factor = 3.0 if profile == 'v2' else 2.0
        concentration_ratio_raw = matched_value / (threshold_vnd * denominator_factor)
    concentration_ratio = _clamp(float(concentration_ratio_raw))

    normalized_features = {
        'size_impact': round(size_impact, 4),
        'aggression_bonus': round(aggression_bonus, 4),
        'concentration_ratio': round(concentration_ratio, 4),
    }
    score_breakdown = {
        key: round(normalized_features[key] * score_config['weights'].get(key, 0.0) * 100.0, 2)
        for key in normalized_features
    }
    event_score = round(sum(score_breakdown.values()), 2)

    return {
        'event_score': event_score,
        'raw_features': {
            'matched_value': round(matched_value, 2),
            'threshold_vnd': round(threshold_vnd, 2),
            'size_ratio': round(size_ratio, 4),
            'side': side or 'neutral',
            'concentration_ratio': round(float(concentration_ratio_raw), 4),
        },
        'normalized_features': normalized_features,
        'score_breakdown': score_breakdown,
        'weights_version': score_config['version'],
    }


def calculate_display_score(event_score: float, occurred_at, now: datetime | None = None, config: dict | None = None) -> dict:
    score_config = config or resolve_whale_score_config()
    reference_time = now or timezone.now()

    if isinstance(occurred_at, str):
        parsed = datetime.fromisoformat(occurred_at.replace('Z', '+00:00'))
        occurred_dt = parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed, timezone.get_current_timezone())
    elif isinstance(occurred_at, datetime):
        occurred_dt = occurred_at if timezone.is_aware(occurred_at) else timezone.make_aware(occurred_at, timezone.get_current_timezone())
    else:
        occurred_dt = reference_time

    age_seconds = max((reference_time - occurred_dt).total_seconds(), 0.0)
    half_life = max(float(score_config.get('decay_half_life_seconds') or 900), 60.0)
    decay_factor = math.exp(-(math.log(2) / half_life) * age_seconds)
    display_score = round(float(event_score) * decay_factor, 2)

    return {
        'display_score': display_score,
        'decay_factor': round(decay_factor, 4),
        'age_seconds': round(age_seconds, 2),
        'severity': classify_severity(display_score, score_config),
    }