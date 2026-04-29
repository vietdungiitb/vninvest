"""
Whale Advisory Generation Tasks

Handles:
- Whale advisory generation via AI providers
- Event merging and deduplication
- Provider failover and rate limiting
- Token usage tracking
"""

from __future__ import annotations

import logging
import random

from celery import shared_task
from django.core.cache import cache

from portfolio.models import (
    WhaleAdvisory,
)

from portfolio.observability import record_advisory_merge_observation

from portfolio.tasks_advisory_helpers import (
    _advisory_event_merge_cache_key,
    _normalize_advisory_source,
    _safe_float,
    _normalize_symbol,
    _resolve_side_by_dynamic_score,
)
from portfolio.tasks_whale_generation import (
    _fetch_news_context_for_advisory,
    generate_whale_advisory_task,
)
from portfolio.tasks_whale_auto_generation import auto_generate_advisories_for_all_tracked

logger = logging.getLogger(__name__)

# Core constants for advisory event management
ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY = 'advisory:auto-generation:job-lock'
ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX = 'advisory:event-merge'


def _resolve_flush_advisory_sources(*, sources: list[str], source_scores: dict, dark_flow_strength) -> tuple[str, str]:
    normalized_sources = [str(item).strip().lower() for item in (sources or []) if str(item).strip()]

    if dark_flow_strength is not None and 'dark_flow' in normalized_sources:
        advisory_source = 'dark_flow'
    else:
        advisory_source = WhaleAdvisory.SourceChoices.WHALE_SIGNAL

    primary_source = ''
    if isinstance(source_scores, dict) and source_scores:
        ranked_sources = sorted(
            (
                (str(name or '').strip().lower(), abs(_safe_float(score, 0.0)))
                for name, score in source_scores.items()
                if str(name or '').strip()
            ),
            key=lambda item: (-item[1], item[0]),
        )
        if ranked_sources:
            primary_source = str(ranked_sources[0][0] or '')

    if not primary_source and normalized_sources:
        primary_source = normalized_sources[0]

    return advisory_source, primary_source

@shared_task(bind=True, name='portfolio.tasks.flush_merged_advisory_event', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def flush_merged_advisory_event(self, user_id: int, symbol: str) -> dict:
    """Flush merged advisory event and trigger generation task."""
    normalized_symbol = _normalize_symbol(symbol)
    cache_key = _advisory_event_merge_cache_key(user_id, normalized_symbol)
    state = cache.get(cache_key)
    if not state:
        return {'status': 'skipped', 'reason': 'cache_miss'}

    # Atomic guard: if delete returns False, another concurrent worker already grabbed & deleted it.
    if cache.delete(cache_key) is False:
        return {'status': 'skipped', 'reason': 'race_lost'}

    threshold_vnd = _safe_float(state.get('threshold_vnd'), 100_000)
    matched_value = _safe_float(state.get('matched_value_vnd'), threshold_vnd)
    score_sum = _safe_float(state.get('score_sum'), 0)
    side = _resolve_side_by_dynamic_score(score_sum)
    sources = state.get('sources') or []
    source_scores = state.get('source_scores') or {}
    threshold_source = state.get('threshold_source', 'user_default')
    dark_flow_strength = state.get('dark_flow_strength')
    dark_flow_confidence = state.get('dark_flow_confidence')
    advisory_source, primary_source = _resolve_flush_advisory_sources(
        sources=sources,
        source_scores=source_scores,
        dark_flow_strength=dark_flow_strength,
    )

    record_advisory_merge_observation('flushed')

    generate_whale_advisory_task.apply_async(
        kwargs={
            'symbol': normalized_symbol,
            'matched_value_vnd': float(matched_value),
            'side': side,
            'threshold': float(threshold_vnd),
            'user_id': int(user_id),
            'source': advisory_source,
            'merged_sources': sources,
            'primary_source': primary_source,
            'threshold_source': threshold_source,
            'dark_flow_strength': dark_flow_strength,
            'dark_flow_confidence': dark_flow_confidence,
        },
        countdown=random.randint(2, 8),
    )
    return {
        'status': 'queued',
        'symbol': normalized_symbol,
        'side': side,
        'resolved_side': side,
        'matched_value': float(matched_value),
        'threshold': float(threshold_vnd),
        'sources': sources,
        'primary_source': primary_source,
        'threshold_source': threshold_source,
        'user_id': user_id,
    }
