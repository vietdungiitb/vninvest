"""
Whale Advisory Generation Tasks

Handles:
- Whale advisory generation via AI providers
- Event merging and deduplication
- Provider failover and rate limiting
- Token usage tracking
"""

from __future__ import annotations

from datetime import timedelta, datetime
import logging
import os
import random
import re

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from portfolio.ai_options import get_advisory_provider_failover_chain, get_default_model
from portfolio.ai_runtime_config import resolve_ai_runtime_config
from portfolio.ai_service import _resolve_provider_api_key, generate_advisory_concise, generate_whale_text

from portfolio.models import (
    AdvisoryTokenLog,
    AdvisoryAggregateSnapshot,
    AdvisoryAggregateAuditLog,
    IntradayTick,
    TrackedSymbol,
    UserConfig,
    WhaleAdvisory,
)

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_actionability,
    record_advisory_confidence,
    record_advisory_error_recovery,
    record_advisory_merge_observation,
    record_advisory_token_usage,
    start_advisory_phase,
    start_advisory_session,
)

from portfolio.domain_constants import resolve_user_whale_threshold_vnd

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

# Core constants for advisory event management
ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY = 'advisory:auto-generation:job-lock'
ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX = 'advisory:event-merge'

# Vietnamese diacritic detection pattern  
_VI_DIACRITIC_PATTERN = re.compile(r'[\u0300-\u036f\u1ea0-\u1ef9]')

# Budget downgrade model mapping
_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS: dict[str, str] = {
    'openclaw': 'gpt-4o-mini',
    'gemini': 'gemini-1.5-flash',
    'claude': 'claude-3-5-haiku',
}


def _int_env(name: str, default: int) -> int:
    """Safe integer environment variable parsing."""
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return int(default)


def _safe_float(value, default: float = 0.0) -> float:
    """Safe float conversion with default fallback."""
    try:
        return float(value)
    except Exception:
        return default


def _normalize_symbol(symbol: str) -> str:
    """Normalize stock symbol to uppercase."""
    return str(symbol or '').strip().upper()


def _advisory_event_merge_cache_key(user_id: int, symbol: str) -> str:
    """Generate cache key for merged advisory events."""
    return f'{ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX}:{user_id}:{symbol}'


def _infer_dark_flow_direction(signal_type: str, cvd_change: float) -> int:
    """Infer buy/sell direction from signal type and CVD change."""
    signal_key = str(signal_type or '').strip().lower()
    if any(token in signal_key for token in ('buy', 'bid', 'accum', 'absorb_buy', 'accumulation')):
        return 1
    if any(token in signal_key for token in ('sell', 'ask', 'dist', 'distribution', 'absorb_sell')):
        return -1
    if cvd_change > 0:
        return 1
    if cvd_change < 0:
        return -1
    return 0


def _compute_event_side_score(source: str, payload: dict) -> float:
    """Compute directional score from event source and payload."""
    source_key = str(source or '').strip().lower()
    if source_key == 'whale_alert':
        event_score = _safe_float(payload.get('event_score'), 0.0)
        side = str(payload.get('side') or '').strip().lower()
        direction = 1 if side == 'buy' else -1 if side == 'sell' else 0
        return direction * event_score

    if source_key == 'dark_flow':
        strength = _safe_float(payload.get('strength'), 0.0)
        cvd_change = _safe_float(payload.get('cvd_change'), 0.0)
        direction = _infer_dark_flow_direction(payload.get('signal_type'), cvd_change)
        return direction * strength

    return 0.0


def _resolve_side_by_dynamic_score(score: float) -> str:
    """Map dynamic score to BUY/SELL/UNKNOWN side."""
    neutral_band = max(_safe_float(os.getenv('ADVISORY_DYNAMIC_SCORE_NEUTRAL_BAND', '8'), 8.0), 0.0)
    if score > neutral_band:
        return 'BUY'
    if score < -neutral_band:
        return 'SELL'
    return 'UNKNOWN'


def _accumulate_user_advisory_event(
    *,
    user_id: int,
    symbol: str,
    source: str,
    payload: dict,
    threshold_vnd: float,
    threshold_source: str = 'user_default',
) -> dict:
    """Accumulate and merge advisory events with multi-source deduplication."""
    normalized_symbol = _normalize_symbol(symbol)
    if not normalized_symbol:
        record_advisory_merge_observation('skipped')
        return {'status': 'skipped', 'reason': 'invalid_symbol'}

    merge_window_seconds = max(int(os.getenv('ADVISORY_EVENT_MERGE_WINDOW_SECONDS', '180')), 30)
    cache_ttl = merge_window_seconds + 300
    now = timezone.now()
    cache_key = _advisory_event_merge_cache_key(user_id, normalized_symbol)

    existing = cache.get(cache_key)
    matched_value_candidate = _safe_float(payload.get('matched_value_vnd') or payload.get('matched_value'), threshold_vnd)
    event_side_score = _compute_event_side_score(source, payload)

    if existing is None:
        state = {
            'user_id': int(user_id),
            'symbol': normalized_symbol,
            'threshold_vnd': float(threshold_vnd),
            'threshold_source': str(threshold_source or 'user_default'),
            'matched_value_vnd': float(max(matched_value_candidate, threshold_vnd)),
            'score_sum': float(event_side_score),
            'sources': [str(source)],
            'source_scores': {str(source): float(event_side_score)},
            'first_event_at': now.isoformat(),
            'updated_at': now.isoformat(),
            'dark_flow_strength': float(payload.get('strength', 0) or 0) if source == 'dark_flow' else None,
            'dark_flow_confidence': str(payload.get('confidence', 'low')) if source == 'dark_flow' else None,
        }
        cache.set(cache_key, state, timeout=cache_ttl)
        flush_merged_advisory_event.apply_async(
            kwargs={'user_id': int(user_id), 'symbol': normalized_symbol},
            countdown=merge_window_seconds,
        )
        record_advisory_merge_observation('scheduled')
        return {'status': 'scheduled', 'cache_key': cache_key, 'window_seconds': merge_window_seconds}

    source_list = [str(item) for item in (existing.get('sources') or [])]
    source_set = set(source_list)
    source_set.add(str(source))
    source_scores = existing.get('source_scores') or {}
    current_source_score = _safe_float(source_scores.get(str(source)), 0.0)
    source_scores[str(source)] = float(current_source_score + event_side_score)

    existing['threshold_vnd'] = float(max(_safe_float(existing.get('threshold_vnd'), threshold_vnd), threshold_vnd))
    if str(threshold_source or '').strip().lower() == 'symbol_override':
        existing['threshold_source'] = 'symbol_override'
    else:
        existing['threshold_source'] = str(existing.get('threshold_source') or 'user_default')
    existing['matched_value_vnd'] = float(max(_safe_float(existing.get('matched_value_vnd'), threshold_vnd), matched_value_candidate, threshold_vnd))
    existing['score_sum'] = float(_safe_float(existing.get('score_sum'), 0.0) + event_side_score)
    existing['sources'] = sorted(source_set)
    existing['source_scores'] = source_scores
    existing['updated_at'] = now.isoformat()
    if source == 'dark_flow':
        existing['dark_flow_strength'] = max(float(existing.get('dark_flow_strength', 0) or 0), float(payload.get('strength', 0) or 0))
        existing['dark_flow_confidence'] = str(payload.get('confidence') or existing.get('dark_flow_confidence', 'low'))
    cache.set(cache_key, existing, timeout=cache_ttl)
    record_advisory_merge_observation('merged')
    return {'status': 'merged', 'cache_key': cache_key, 'window_seconds': merge_window_seconds}


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


def _normalize_advisory_source(source: str | None) -> str:
    """Normalize advisory source enum value."""
    source_key = str(source or '').strip().lower()
    valid_sources = {
        'whale_signal': WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
        'periodic_job': WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        'user_refresh': WhaleAdvisory.SourceChoices.USER_REFRESH,
        'system': WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
    }
    return valid_sources.get(source_key, WhaleAdvisory.SourceChoices.WHALE_SIGNAL)


def _token_log_source_for_advisory_source(source: str) -> str:
    """Map advisory source to token log source."""
    source_key = str(source or '').strip().lower()
    mapping = {
        'whale_signal': 'whale_signal_generation',
        'periodic_job': 'auto_generation',
        'user_refresh': 'manual_refresh',
    }
    return mapping.get(source_key, 'unknown')


def _estimate_advisory_confidence(
    matched_value_vnd: float,
    threshold: float,
    dark_flow_strength: float | None = None,
    merged_sources: list[str] | None = None,
) -> float:
    """Estimate advisory confidence score."""
    base_confidence = min(_safe_float(matched_value_vnd / max(threshold, 1.0)), 2.0)
    dark_flow_bonus = 0.15 if _safe_float(dark_flow_strength) > 0 else 0.0
    multi_source_bonus = 0.10 * max(min(len(merged_sources or []) - 1, 2), 0)
    return min(base_confidence + dark_flow_bonus + multi_source_bonus, 1.0)


def _estimate_advisory_actionability(
    severity: str,
    use_concise: bool = False,
    merged_sources: list[str] | None = None,
) -> float:
    """Estimate advisory actionability score."""
    severity_score = {
        'urgent': 0.85,
        'warning': 0.65,
        'info': 0.40,
    }.get(str(severity or '').strip().lower(), 0.4)
    
    concise_penalty = -0.1 if use_concise else 0.0
    multi_source_bonus = 0.05 * min(len(merged_sources or []) - 1, 1)
    return min(max(severity_score + concise_penalty + multi_source_bonus, 0.0), 1.0)


def _advisory_audit_reason_for_source(source: str) -> str:
    """Map advisory source to audit reason."""
    source_key = str(source or '').strip().lower()
    mapping = {
        'whale_signal': 'whale_signal_advisory_generated',
        'periodic_job': 'auto_refresh_completed',
        'user_refresh': 'manual_refresh_completed',
    }
    return mapping.get(source_key, 'advisory_generated')


def _advisory_audit_actor_for_source(source: str) -> str:
    """Map advisory source to audit actor."""
    source_key = str(source or '').strip().lower()
    mapping = {
        'whale_signal': 'system:whale_signal',
        'periodic_job': 'system:periodic_job',
        'user_refresh': 'user:manual',
    }
    return mapping.get(source_key, 'system:auto')


def _get_tokens_used_today(user_id: int) -> int:
    """Get total advisory tokens used by user today."""
    today = timezone.localdate()
    from portfolio.models import AdvisoryTokenLog
    return AdvisoryTokenLog.objects.filter(
        user_id=user_id,
        created_at__date=today,
    ).aggregate(total=Sum('tokens_used'))['total'] or 0


def _build_advisory_aggregate_state_payload(
    symbol: str,
    matched_value_vnd: float,
    threshold: float,
    side: str,
    severity: str,
    merged_sources: list[str] | None = None,
    dark_flow_strength: float | None = None,
) -> dict:
    """Build aggregate state payload for advisory snapshot."""
    return {
        'symbol': str(symbol).upper(),
        'matched_value_vnd': float(matched_value_vnd),
        'threshold_vnd': float(threshold),
        'ratio': float(matched_value_vnd / max(threshold, 1.0)),
        'side': str(side).upper(),
        'severity': str(severity).lower(),
        'sources': merged_sources or [],
        'dark_flow_strength': float(dark_flow_strength) if dark_flow_strength else None,
        'snapshot_at': timezone.now().isoformat(),
    }


def _persist_advisory_aggregate_snapshot(
    user,
    symbol: str,
    matched_value_vnd: float,
    threshold: float,
    side: str,
    source: str,
    severity: str,
    merged_sources: list[str] | None = None,
    primary_source: str | None = None,
    dark_flow_strength: float | None = None,
    dark_flow_confidence: str | None = None,
    use_concise: bool = False,
) -> AdvisoryAggregateSnapshot:
    """Create and persist advisory aggregate snapshot."""
    state_payload = _build_advisory_aggregate_state_payload(
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        threshold=threshold,
        side=side,
        severity=severity,
        merged_sources=merged_sources,
        dark_flow_strength=dark_flow_strength,
    )
    
    return AdvisoryAggregateSnapshot.objects.create(
        user=user,
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        threshold_vnd=threshold,
        side=side,
        source=source,
        severity=severity,
        merged_sources=merged_sources or [],
        primary_source=primary_source or (merged_sources[0] if merged_sources else None),
        state=state_payload,
        dark_flow_strength=dark_flow_strength,
        dark_flow_confidence=dark_flow_confidence,
        use_concise=use_concise,
    )


def _persist_advisory_metrics_audit_log(
    user,
    symbol: str,
    advisory,
    latest_existing_advisory,
    source: str,
    threshold_source: str,
    merged_sources: list[str],
    primary_source: str,
    metrics: dict,
    task_id: str = '',
) -> AdvisoryAggregateAuditLog:
    """Persist advisory metrics to audit log."""
    reason = _advisory_audit_reason_for_source(source)
    actor = _advisory_audit_actor_for_source(source)
    
    is_refresh = bool(latest_existing_advisory and metrics.get('force_refresh'))
    
    return AdvisoryAggregateAuditLog.objects.create(
        user=user,
        advisory=advisory,
        symbol=symbol,
        event_type='generation' if not is_refresh else 'refresh',
        reason=reason,
        actor=actor,
        source=source,
        threshold_source=threshold_source,
        merged_sources=merged_sources,
        primary_source=primary_source,
        metrics=metrics,
        task_id=task_id,
    )


def _get_remaining_advisory_budget(user_config: UserConfig) -> int:
    """Calculate remaining token budget for advisory generation."""
    if not user_config:
        return 0
    max_tokens = int(user_config.advisory_max_tokens_per_day or 0)
    used_today = _get_tokens_used_today(user_config.user_id)
    return max(max_tokens - used_today, 0)


def _get_auto_generation_count_today(user_id: int) -> int:
    """Count auto-generation advisory events today."""
    today = timezone.localdate()
    return WhaleAdvisory.objects.filter(
        user_id=user_id,
        source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        created_at__date=today,
    ).count()


def _get_remaining_auto_refreshes(user_config: UserConfig) -> int:
    """Calculate remaining auto-refresh count for user."""
    if not user_config:
        return 0
    max_refreshes = int(user_config.advisory_auto_refresh_limit_per_day or 3)
    used_today = _get_auto_generation_count_today(user_config.user_id)
    return max(max_refreshes - used_today, 0)


def _resolve_next_refresh_at(user_config: UserConfig | None) -> timezone.datetime | None:
    """Calculate next scheduled refresh timestamp."""
    if not user_config:
        return None
    refresh_interval_hours = int(user_config.advisory_auto_refresh_interval_hours or 6)
    return timezone.now() + timedelta(hours=refresh_interval_hours)


def _resolve_advisory_threshold_vnd(
    user_config: UserConfig | None,
    symbol: str,
) -> float:
    """Resolve advisory threshold with symbol override precedence."""
    threshold = resolve_user_whale_threshold_vnd(
        user_config=user_config,
        symbol=symbol,
    )
    return float(max(threshold, 100_000))


def _should_use_concise_advisory(source: str, remaining_budget: int | None) -> bool:
    """Determine if concise advisory mode should be used."""
    source_key = str(source or '').strip().lower()
    if source_key == 'periodic_job':
        return remaining_budget is not None and remaining_budget < 5000
    return False


def _resolve_model_for_budget(
    provider: str,
    base_model: str,
    remaining_budget: int | None,
    total_budget: int | None = None,
) -> str:
    """Route to cheaper model based on remaining token budget."""
    if remaining_budget is None or total_budget is None or total_budget <= 0:
        return base_model
    
    budget_percentage = (remaining_budget / total_budget) * 100
    
    # If budget below 20%, use cheapest available model for provider
    if budget_percentage < 20:
        return _ADVISORY_BUDGET_DOWNGRADE_DEFAULTS.get(provider, base_model)
    
    return base_model


def _increment_daily_counter(key: str, timeout_seconds: int = 90_000) -> None:
    """Safely increment daily Redis counter with fallback."""
    try:
        current = cache.get(key, 0)
        cache.set(key, int(current) + 1, timeout=timeout_seconds)
    except Exception as exc:
        logger.debug('Counter increment failed for %s: %s', key, exc)


def _classify_provider_failure(exc: Exception) -> str:
    """Classify exception to provider failure type."""
    err_str = str(exc).lower()
    if '429' in err_str or 'rate_limit' in err_str or 'quota' in err_str:
        return 'rate_limited'
    if '401' in err_str or '403' in err_str or 'unauthorized' in err_str:
        return 'auth_failed'
    if 'timeout' in err_str or 'connection' in err_str:
        return 'timeout'
    return 'other'


def _is_failover_eligible_failure(failure_type: str) -> bool:
    """Check if failure type allows failover to next provider."""
    return failure_type in {'rate_limited', 'timeout'}


def _mark_provider_ratelimit(provider: str) -> None:
    """Mark provider as rate limited for cooldown period."""
    cooldown_seconds = max(int(os.getenv('ADVISORY_PROVIDER_RATELIMIT_COOLDOWN_SECONDS', '300')), 60)
    cache.set(f'advisory:provider-ratelimit:{provider}', True, timeout=cooldown_seconds)


def _record_provider_attempt(provider: str, success: bool, failure_type: str = '') -> None:
    """Record provider call attempt and result."""
    today_iso = timezone.localdate().isoformat()
    success_key = f'advisory:provider-success:{provider}:{today_iso}'
    failure_key = f'advisory:provider-failure:{provider}:{failure_type}:{today_iso}' if failure_type else None
    _increment_daily_counter(success_key if success else (failure_key or success_key))


def _record_failover_event(source_provider: str, target_provider: str, failure_type: str, success: bool) -> None:
    """Record failover event metrics."""
    status = 'success' if success else 'failed'
    today_iso = timezone.localdate().isoformat()
    key = f'advisory:failover:{source_provider}→{target_provider}:{failure_type}:{status}:{today_iso}'
    _increment_daily_counter(key)


def _is_language_mismatch(text: str, expected_language: str) -> bool:
    """Detect language mismatches in advisory text."""
    if not text or expected_language not in {'vi', 'en'}:
        return False
    
    has_vi_chars = bool(_VI_DIACRITIC_PATTERN.search(text))
    expect_vi = expected_language == 'vi'
    
    return (expect_vi and not has_vi_chars) or (not expect_vi and has_vi_chars)


def _compute_advisory_severity(matched_value_vnd: float, threshold: float) -> str:
    """Map matched_value/threshold ratio to severity level."""
    ratio = matched_value_vnd / max(threshold, 1.0)
    if ratio >= 2.5:
        return WhaleAdvisory.SeverityChoices.URGENT
    if ratio >= 1.5:
        return WhaleAdvisory.SeverityChoices.WARNING
    return WhaleAdvisory.SeverityChoices.INFO


def _compute_dark_flow_severity(
    strength: float,
    confidence: str = 'low',
    cvd_change: float = 0.0,
) -> str:
    """Map dark flow strength/confidence to severity level."""
    strength_val = _safe_float(strength, 0)
    conf_key = str(confidence or 'low').strip().lower()
    conf_mult = {'high': 1.0, 'medium': 0.7, 'low': 0.4}.get(conf_key, 0.4)
    
    final_score = strength_val * conf_mult
    if final_score >= 0.7:
        return WhaleAdvisory.SeverityChoices.WARNING
    if final_score >= 0.4:
        return WhaleAdvisory.SeverityChoices.INFO
    return WhaleAdvisory.SeverityChoices.INFO


def _detect_reversal_signal(symbol: str) -> dict | None:
    """Detect reversal patterns in intraday ticks."""
    try:
        recent_ticks = IntradayTick.objects.filter(
            symbol=symbol,
        ).order_by('-timestamp')[:50]
        
        if len(recent_ticks) < 5:
            return None
        
        prices = [float(tick.price) for tick in reversed(recent_ticks)]
        highs = [max(prices[i:i+5]) for i in range(len(prices)-4)]
        lows = [min(prices[i:i+5]) for i in range(len(prices)-4)]
        
        # Simple reversal detection: price went down then back up
        if len(highs) >= 2 and len(lows) >= 2:
            if lows[-1] < lows[-2] and highs[-1] > highs[-2]:
                return {
                    'type': 'v_reversal',
                    'confidence': 0.7,
                    'recent_low': lows[-1],
                    'recent_high': highs[-1],
                }
        
        return None
    except Exception as exc:
        logger.debug('Reversal detection failed for %s: %s', symbol, exc)
        return None


def _fetch_news_context_for_advisory(symbol: str, max_items: int = 4) -> str:
    """Fetch recent news context for advisory generation prompt."""
    try:
        import pandas as _pd
        from portfolio.models import StockNews
        
        recent_news = StockNews.objects.filter(
            symbol=symbol,
        ).order_by('-published_date')[:max_items]
        
        if not recent_news:
            return ''
        
        news_items = []
        for news in recent_news:
            date_str = news.published_date.strftime('%Y-%m-%d') if hasattr(news.published_date, 'strftime') else str(news.published_date)
            news_items.append(f'[{date_str}] {news.title}')
        
        return '\n'.join(news_items)
    except Exception as exc:
        logger.debug('News fetch failed for %s: %s', symbol, exc)
        return ''


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={'max_retries': 2})
def generate_whale_advisory_task(
    self,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float = 0,
    force_refresh: bool = False,
    user_id: int | None = None,
    source: str = WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
    merged_sources: list[str] | None = None,
    primary_source: str | None = None,
    advisory_type: str = WhaleAdvisory.AdvisoryTypeChoices.DEFAULT,
    severity_override: str | None = None,
    threshold_source: str = 'user_default',
    dark_flow_strength: float | None = None,
    dark_flow_confidence: str | None = None,
) -> dict:
    """
    Generate whale advisory via AI provider.
    
    Steps:
    1. Check Redis cooldown — skip if generated recently
    2. Call AI provider (summary + detail)
    3. Save WhaleAdvisory to DB
    4. Push WebSocket event to user/symbol group
    """
    cooldown = getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)
    cache_key = f'whale_advisory_lock:{user_id}:{symbol}' if user_id is not None else f'whale_advisory_lock:{symbol}'
    source_key = _normalize_advisory_source(source)

    advisory_qs = WhaleAdvisory.objects.filter(symbol=symbol)
    if user_id is not None:
        advisory_qs = advisory_qs.filter(user_id=user_id)
    latest_existing_advisory = advisory_qs.order_by('-created_at').first()

    if not force_refresh and latest_existing_advisory is not None:
        logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'existing_advisory'}

    if not force_refresh and cache.get(cache_key):
        logger.info('Whale advisory cooldown active — skipping %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'cooldown'}

    target_user = None
    user_cfg = None
    remaining_budget = None
    if user_id is not None:
        user_cfg = UserConfig.objects.filter(user_id=user_id).select_related('user').first()
        target_user = getattr(user_cfg, 'user', None)

    if user_cfg is not None:
        if source_key == WhaleAdvisory.SourceChoices.WHALE_SIGNAL and not user_cfg.advisory_whale_signal_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'whale_signal_disabled', 'user_id': user_id}
        if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and not user_cfg.advisory_auto_generation_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'auto_generation_disabled', 'user_id': user_id}
        if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH and not user_cfg.advisory_manual_refresh_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'manual_refresh_disabled', 'user_id': user_id}

        _gen_lock_key = f'advisory:gen-lock:{user_id}'
        _lock_acquired = cache.add(_gen_lock_key, 1, timeout=90)
        if not _lock_acquired:
            logger.info('Whale advisory generation locked (concurrent task) for user=%s symbol=%s', user_id, symbol)
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'concurrent_generation_active', 'user_id': user_id}

        try:
            remaining_budget = _get_remaining_advisory_budget(user_cfg)
            if remaining_budget <= 0:
                logger.info('Whale advisory budget exhausted for user=%s symbol=%s source=%s', user_id, symbol, source_key)
                return {
                    'status': 'skipped',
                    'symbol': symbol,
                    'reason': 'daily_budget_exceeded',
                    'user_id': user_id,
                    'source': source_key,
                }
            if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and _get_remaining_auto_refreshes(user_cfg) <= 0:
                logger.info('Whale advisory auto-refresh count exhausted for user=%s symbol=%s', user_id, symbol)
                return {
                    'status': 'skipped',
                    'symbol': symbol,
                    'reason': 'daily_auto_refresh_limit_exceeded',
                    'user_id': user_id,
                    'source': source_key,
                }
        finally:
            cache.delete(_gen_lock_key)

    runtime_cfg = resolve_ai_runtime_config(user=target_user)
    if not runtime_cfg.get('ready'):
        logger.info(
            'Whale advisory skipped for %s: runtime AI not ready reason=%s user_id=%s',
            symbol,
            runtime_cfg.get('reason'),
            user_id,
        )
        return {
            'status': 'skipped',
            'symbol': symbol,
            'reason': str(runtime_cfg.get('reason') or 'runtime_ai_not_ready'),
            'user_id': user_id,
            'ai_source': runtime_cfg.get('source'),
        }

    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    primary_provider = provider
    primary_model = model
    api_key = str(runtime_cfg.pop('api_key', '') or '').strip()
    ai_source = str(runtime_cfg.get('source') or 'unknown')

    if cache.get(f'advisory:provider-ratelimit:{provider}'):
        logger.info(
            'Whale advisory skipped — provider %s still in rate-limit cooldown symbol=%s user_id=%s',
            provider,
            symbol,
            user_id,
        )
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'provider_rate_limit_cooldown', 'user_id': user_id}

    use_concise = _should_use_concise_advisory(source_key, remaining_budget)
    output_language = str(getattr(user_cfg, 'language', 'vi') if user_cfg is not None else 'vi').strip().lower()
    if output_language not in {'vi', 'en'}:
        output_language = 'vi'

    _total_budget = int(user_cfg.advisory_max_tokens_per_day or 0) if user_cfg is not None else None
    model = _resolve_model_for_budget(provider, model, remaining_budget, _total_budget)
    primary_model = model

    failover_chain = get_advisory_provider_failover_chain().get(primary_provider, [])
    providers_to_try = [primary_provider] + [p for p in failover_chain if p != primary_provider]
    failover_occurred = False
    failover_reason = ''
    failover_chain_attempted: list[str] = []
    failover_attempt_count = 0

    news_hint = '' if use_concise else _fetch_news_context_for_advisory(symbol)

    start_advisory_session()
    start_advisory_phase('provider_generation')
    summary_resp = None
    deep_resp = None
    last_exc: Exception | None = None

    for idx, attempt_provider in enumerate(providers_to_try):
        failover_chain_attempted.append(attempt_provider)
        attempt_model = model if attempt_provider == primary_provider else get_default_model(attempt_provider)
        attempt_model = _resolve_model_for_budget(attempt_provider, attempt_model, remaining_budget, _total_budget)
        attempt_api_key = api_key if attempt_provider == primary_provider else _resolve_provider_api_key(attempt_provider, '')

        if not attempt_api_key:
            _record_provider_attempt(attempt_provider, success=False, failure_type='missing_api_key')
            if idx + 1 < len(providers_to_try):
                failover_attempt_count += 1
                _record_failover_event(attempt_provider, providers_to_try[idx + 1], 'missing_api_key', success=False)
            continue

        try:
            if use_concise:
                summary_resp = generate_advisory_concise(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    user=target_user,
                    output_language=output_language,
                )
                deep_resp = {'text': '', 'prompt_tokens': 0, 'completion_tokens': 0}
            else:
                summary_resp = generate_whale_text(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    deep=False,
                    user=target_user,
                    output_language=output_language,
                    news_hint=news_hint,
                )
                deep_resp = generate_whale_text(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    deep=True,
                    user=target_user,
                    output_language=output_language,
                    news_hint=news_hint,
                )

            _record_provider_attempt(attempt_provider, success=True)
            if attempt_provider != primary_provider:
                failover_occurred = True
                _record_failover_event(primary_provider, attempt_provider, failover_reason or 'unknown', success=True)
            provider = attempt_provider
            model = attempt_model
            break
        except Exception as exc:
            failure_type = _classify_provider_failure(exc)
            last_exc = exc
            _record_provider_attempt(attempt_provider, success=False, failure_type=failure_type)

            if failure_type == 'rate_limited':
                _mark_provider_ratelimit(attempt_provider)

            can_failover = _is_failover_eligible_failure(failure_type)
            has_next_provider = idx + 1 < len(providers_to_try)

            if can_failover and has_next_provider:
                failover_attempt_count += 1
                if not failover_reason:
                    failover_reason = failure_type
                next_provider = providers_to_try[idx + 1]
                _record_failover_event(attempt_provider, next_provider, failure_type, success=False)
                logger.warning(
                    'Advisory provider failover: %s/%s failed (%s) symbol=%s -> next=%s',
                    attempt_provider,
                    attempt_model,
                    failure_type,
                    symbol,
                    next_provider,
                )
                continue

            logger.error(
                'AI provider error for %s via %s/%s (%s): %s',
                symbol,
                attempt_provider,
                attempt_model,
                failure_type,
                exc,
            )
            break

    end_advisory_phase('provider_generation')
    if summary_resp is None or deep_resp is None:
        record_advisory_error_recovery(type(last_exc).__name__ if last_exc else 'RuntimeError', 'provider_generation_failed', success=False)
        end_advisory_session()
        raise (last_exc or RuntimeError('All advisory providers failed'))

    today_iso = timezone.localdate().isoformat()
    _increment_daily_counter(f'advisory:language-check-count:{output_language}:{today_iso}')
    summary_language_mismatch = _is_language_mismatch(summary_resp.get('text', ''), output_language)
    detail_language_mismatch = _is_language_mismatch(deep_resp.get('text', ''), output_language)
    language_mismatch = bool(summary_language_mismatch or detail_language_mismatch)
    if language_mismatch:
        _increment_daily_counter(f'advisory:language-mismatch-count:{output_language}:{today_iso}')
        logger.warning(
            'Advisory language mismatch detected symbol=%s expected=%s provider=%s model=%s',
            symbol,
            output_language,
            provider,
            model,
        )

    record_advisory_token_usage(
        int(summary_resp.get('prompt_tokens', 0) or 0) + int(summary_resp.get('completion_tokens', 0) or 0),
        source='summary_generation' if not use_concise else 'concise_generation',
    )
    if not use_concise:
        record_advisory_token_usage(
            int(deep_resp.get('prompt_tokens', 0) or 0) + int(deep_resp.get('completion_tokens', 0) or 0),
            source='detail_generation',
        )

    refresh_count = (latest_existing_advisory.refresh_count + 1) if (force_refresh and latest_existing_advisory is not None) else 0
    
    if severity_override:
        resolved_severity = str(severity_override).strip().lower()
    elif source == 'dark_flow' and dark_flow_strength is not None:
        resolved_severity = _compute_dark_flow_severity(
            strength=dark_flow_strength,
            confidence=dark_flow_confidence or 'low',
            cvd_change=0.0,
        )
    else:
        resolved_severity = _compute_advisory_severity(matched_value_vnd, float(threshold or 0))
    
    if resolved_severity not in {
        WhaleAdvisory.SeverityChoices.URGENT,
        WhaleAdvisory.SeverityChoices.WARNING,
        WhaleAdvisory.SeverityChoices.INFO,
    }:
        resolved_severity = WhaleAdvisory.SeverityChoices.INFO

    advisory_type_key = str(advisory_type or WhaleAdvisory.AdvisoryTypeChoices.DEFAULT).strip().lower()
    if advisory_type_key not in {
        WhaleAdvisory.AdvisoryTypeChoices.DEFAULT,
        WhaleAdvisory.AdvisoryTypeChoices.REVERSAL,
    }:
        advisory_type_key = WhaleAdvisory.AdvisoryTypeChoices.DEFAULT

    normalized_merged_sources = sorted({str(item).strip().lower() for item in (merged_sources or []) if str(item).strip()})
    normalized_primary_source = str(primary_source or '').strip().lower()
    normalized_threshold_source = str(threshold_source or 'user_default').strip().lower() or 'user_default'
    if normalized_threshold_source not in {'user_default', 'symbol_override'}:
        normalized_threshold_source = 'user_default'
    if not normalized_primary_source and normalized_merged_sources:
        normalized_primary_source = normalized_merged_sources[0]

    record_advisory_confidence(
        _estimate_advisory_confidence(
            matched_value_vnd=matched_value_vnd,
            threshold=float(threshold or 0),
            dark_flow_strength=dark_flow_strength,
            merged_sources=normalized_merged_sources,
        ),
        source=source_key,
    )
    record_advisory_actionability(
        _estimate_advisory_actionability(
            severity=resolved_severity,
            use_concise=use_concise,
            merged_sources=normalized_merged_sources,
        ),
        factors={
            'severity_weight': 1.0 if resolved_severity == WhaleAdvisory.SeverityChoices.URGENT else 0.75 if resolved_severity == WhaleAdvisory.SeverityChoices.WARNING else 0.5,
            'multi_source_bonus': 0.05 if len(normalized_merged_sources) > 1 else 0.0,
            'concise_penalty': -0.05 if use_concise else 0.0,
        },
    )

    aggregate_snapshot = _persist_advisory_aggregate_snapshot(
        user=target_user,
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        threshold=float(threshold or 0),
        side=side,
        source=source_key,
        severity=resolved_severity,
        merged_sources=normalized_merged_sources,
        primary_source=normalized_primary_source,
        dark_flow_strength=dark_flow_strength,
        dark_flow_confidence=dark_flow_confidence,
        use_concise=use_concise,
    )

    start_advisory_phase('persist_advisory')
    advisory = WhaleAdvisory.objects.create(
        user=target_user,
        symbol=symbol,
        matched_value=int(matched_value_vnd),
        side=side,
        threshold=float(threshold or 0),
        ai_summary=summary_resp['text'],
        ai_detail=deep_resp['text'],
        ai_provider=provider,
        ai_model=model,
        prompt_tokens=summary_resp['prompt_tokens'] + deep_resp['prompt_tokens'],
        completion_tokens=summary_resp['completion_tokens'] + deep_resp['completion_tokens'],
        next_refresh_at=_resolve_next_refresh_at(user_cfg),
        refresh_count=refresh_count,
        is_auto_generated=source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        aggregate_snapshot=aggregate_snapshot,
        source=source_key,
        merged_sources=normalized_merged_sources,
        primary_source=normalized_primary_source,
        advisory_type=advisory_type_key,
        severity=resolved_severity,
    )

    if target_user is not None:
        AdvisoryTokenLog.objects.create(
            user=target_user,
            advisory=advisory,
            tokens_used=advisory.prompt_tokens + advisory.completion_tokens,
            source=_token_log_source_for_advisory_source(source_key),
            symbol=symbol,
        )
    end_advisory_phase('persist_advisory')

    if not force_refresh:
        cache.set(cache_key, True, timeout=cooldown)

    try:
        start_advisory_phase('broadcast')
        channel_layer = get_channel_layer()
        target_group = f'user_{user_id}_alerts' if user_id is not None else f'whale_{symbol}'
        async_to_sync(channel_layer.group_send)(
            target_group,
            {
                'type': 'whale_advisory',
                'payload': {
                    'event_type': 'whale_advisory',
                    'symbol': symbol,
                    'side': side,
                    'matched_value': int(matched_value_vnd),
                    'threshold': float(threshold or 0),
                    'threshold_source': normalized_threshold_source,
                    'ai_summary': advisory.ai_summary,
                    'ai_detail': advisory.ai_detail,
                    'ai_provider': advisory.ai_provider,
                    'ai_model': advisory.ai_model,
                    'ts': advisory.created_at.isoformat(),
                    'created_at': advisory.created_at.isoformat(),
                    'id': advisory.id,
                    'snapshot_id': advisory.aggregate_snapshot_id,
                },
            },
        )
        end_advisory_phase('broadcast')
    except Exception as exc:
        end_advisory_phase('broadcast')
        record_advisory_error_recovery(type(exc).__name__, 'broadcast_failed', success=False)
        logger.warning('WebSocket push failed for whale_advisory %s: %s', symbol, exc)

    metrics_payload = end_advisory_session()
    if metrics_payload:
        metrics_payload.update(
            {
                'advisory_id': advisory.id,
                'ai_provider': provider,
                'ai_model': model,
                'ai_provider_primary': primary_provider,
                'ai_model_primary': primary_model,
                'ai_source': ai_source,
                'output_language': output_language,
                'language_mismatch': language_mismatch,
                'failover_occurred': failover_occurred,
                'failover_reason': failover_reason,
                'failover_chain_attempted': failover_chain_attempted,
                'failover_attempt_count': failover_attempt_count,
                'threshold_source': normalized_threshold_source,
                'source': source_key,
                'merged_sources': normalized_merged_sources,
                'primary_source': normalized_primary_source,
                'used_concise': use_concise,
                'snapshot_id': advisory.aggregate_snapshot_id,
            }
        )
        _persist_advisory_metrics_audit_log(
            user=target_user,
            symbol=symbol,
            advisory=advisory,
            latest_existing_advisory=latest_existing_advisory,
            source=source_key,
            threshold_source=normalized_threshold_source,
            merged_sources=normalized_merged_sources,
            primary_source=normalized_primary_source,
            metrics=metrics_payload,
            task_id=getattr(self.request, 'id', ''),
        )

    logger.info('WhaleAdvisory created: id=%d symbol=%s side=%s', advisory.id, symbol, side)
    return {
        'status': 'ok',
        'advisory_id': advisory.id,
        'symbol': symbol,
        'ai_provider': provider,
        'ai_model': model,
        'ai_provider_primary': primary_provider,
        'ai_model_primary': primary_model,
        'ai_source': ai_source,
        'output_language': output_language,
        'language_mismatch': language_mismatch,
        'failover_occurred': failover_occurred,
        'failover_reason': failover_reason,
        'failover_chain_attempted': failover_chain_attempted,
        'failover_attempt_count': failover_attempt_count,
        'force_refresh': bool(force_refresh),
        'user_id': user_id,
        'source': source_key,
        'threshold_source': normalized_threshold_source,
        'merged_sources': normalized_merged_sources,
        'primary_source': normalized_primary_source,
        'used_concise': use_concise,
        'snapshot_id': advisory.aggregate_snapshot_id,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def auto_generate_advisories_for_all_tracked(self, batch_size: int | None = None) -> dict:
    """Auto-generate advisories for all tracked symbols with enabled users."""
    batch_size = batch_size or int(os.getenv('ADVISORY_AUTO_GENERATE_BATCH_SIZE', '20'))
    
    from portfolio.models import TrackedSymbol
    from django.db.models import Q
    
    start_time = timezone.now()
    tracked_symbols = TrackedSymbol.objects.filter(
        user__userconfig__advisory_auto_generation_enabled=True,
        is_active=True,
    ).select_related('user', 'user__userconfig').distinct()[:batch_size]
    
    generated_count = 0
    skipped_count = 0
    failed_count = 0
    
    for ts in tracked_symbols:
        try:
            user_cfg = UserConfig.objects.filter(user_id=ts.user_id).first()
            if not user_cfg or not user_cfg.advisory_auto_generation_enabled:
                skipped_count += 1
                continue
            
            remaining_budget = _get_remaining_advisory_budget(user_cfg)
            if remaining_budget <= 0:
                skipped_count += 1
                continue
            
            threshold = _resolve_advisory_threshold_vnd(user_cfg, ts.symbol)
            
            result = generate_whale_advisory_task.apply_async(
                kwargs={
                    'symbol': ts.symbol,
                    'matched_value_vnd': threshold,
                    'side': 'BUY',
                    'threshold': threshold,
                    'user_id': ts.user_id,
                    'source': WhaleAdvisory.SourceChoices.PERIODIC_JOB,
                },
                countdown=random.randint(1, 5),
            )
            generated_count += 1
        except Exception as exc:
            logger.error('Auto-generation failed for user=%s symbol=%s: %s', ts.user_id, ts.symbol, exc)
            failed_count += 1
    
    elapsed = (timezone.now() - start_time).total_seconds()
    return {
        'status': 'ok',
        'generated_count': generated_count,
        'skipped_count': skipped_count,
        'failed_count': failed_count,
        'elapsed_seconds': elapsed,
        'batch_size': batch_size,
    }
