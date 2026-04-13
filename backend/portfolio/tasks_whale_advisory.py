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
    _safe_float,
    _normalize_symbol,
    _resolve_side_by_dynamic_score,
)
from portfolio.tasks_whale_generation import (
    _fetch_news_context_for_advisory,
    generate_whale_advisory_task,
    auto_generate_advisories_for_all_tracked,
)

logger = logging.getLogger(__name__)

# Core constants for advisory event management
ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY = 'advisory:auto-generation:job-lock'
ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX = 'advisory:event-merge'

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def flush_merged_advisory_event(self, user_id: int, symbol: str) -> dict:
    """Flush merged advisory event and trigger generation task."""
    normalized_symbol = _normalize_symbol(symbol)
    cache_key = _advisory_event_merge_cache_key(user_id, normalized_symbol)
    state = cache.get(cache_key)
    if not state:
        return {'status': 'skipped', 'reason': 'cache_miss'}

    threshold_vnd = _safe_float(state.get('threshold_vnd'), 100_000)
    matched_value = _safe_float(state.get('matched_value_vnd'), threshold_vnd)
    score_sum = _safe_float(state.get('score_sum'), 0)
    side = _resolve_side_by_dynamic_score(score_sum)
    sources = state.get('sources') or []
    source_scores = state.get('source_scores') or {}
    primary_source = sources[0] if sources else 'unknown'
    threshold_source = state.get('threshold_source', 'user_default')
    dark_flow_strength = state.get('dark_flow_strength')
    dark_flow_confidence = state.get('dark_flow_confidence')

    cache.delete(cache_key)
    record_advisory_merge_observation('flushed')

    generate_whale_advisory_task.apply_async(
        kwargs={
            'symbol': normalized_symbol,
            'matched_value_vnd': float(matched_value),
            'side': side,
            'threshold': float(threshold_vnd),
            'user_id': int(user_id),
            'source': WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
            'merged_sources': sources,
            'primary_source': primary_source,
            'threshold_source': threshold_source,
            'dark_flow_strength': dark_flow_strength,
            'dark_flow_confidence': dark_flow_confidence,
        },
        countdown=random.randint(2, 8),
    )
    return {
        'status': 'ok',
        'symbol': normalized_symbol,
        'side': side,
        'matched_value': float(matched_value),
        'threshold': float(threshold_vnd),
        'sources': sources,
        'user_id': user_id,
    }
