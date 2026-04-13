from __future__ import annotations

import logging

from portfolio.ai_options import get_advisory_provider_failover_chain, get_default_model
from portfolio.ai_service import _resolve_provider_api_key
from portfolio.tasks_whale_ai_call import _execute_provider_ai_call
from portfolio.tasks_advisory_helpers import (
    _resolve_model_for_budget,
    _classify_provider_failure,
    _is_failover_eligible_failure,
    _mark_provider_ratelimit,
    _record_provider_attempt,
    _record_failover_event,
)

logger = logging.getLogger(__name__)


def _run_whale_provider_generation(
    *,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    target_user,
    output_language: str,
    use_concise: bool,
    news_hint: str,
    remaining_budget: int | None,
    total_budget: int | None,
    primary_provider: str,
    primary_model: str,
    api_key: str,
) -> dict:
    failover_chain = get_advisory_provider_failover_chain().get(primary_provider, [])
    providers_to_try = [primary_provider] + [provider for provider in failover_chain if provider != primary_provider]
    failover_occurred = False
    failover_reason = ''
    failover_chain_attempted: list[str] = []
    failover_attempt_count = 0
    summary_resp = None
    deep_resp = None
    last_exc: Exception | None = None
    active_provider = primary_provider
    active_model = primary_model

    for idx, attempt_provider in enumerate(providers_to_try):
        failover_chain_attempted.append(attempt_provider)
        attempt_model = primary_model if attempt_provider == primary_provider else get_default_model(attempt_provider)
        attempt_model = _resolve_model_for_budget(attempt_provider, attempt_model, remaining_budget, total_budget)
        attempt_api_key = api_key if attempt_provider == primary_provider else _resolve_provider_api_key(attempt_provider, '')

        if not attempt_api_key:
            _record_provider_attempt(attempt_provider, success=False, failure_type='missing_api_key')
            if idx + 1 < len(providers_to_try):
                failover_attempt_count += 1
                _record_failover_event(attempt_provider, providers_to_try[idx + 1], 'missing_api_key', success=False)
            continue

        try:
            summary_resp, deep_resp = _execute_provider_ai_call(
                provider=attempt_provider,
                model=attempt_model,
                api_key=attempt_api_key,
                symbol=symbol,
                matched_value_vnd=matched_value_vnd,
                side=side,
                target_user=target_user,
                output_language=output_language,
                use_concise=use_concise,
                news_hint=news_hint,
            )

            _record_provider_attempt(attempt_provider, success=True)
            if attempt_provider != primary_provider:
                failover_occurred = True
                _record_failover_event(primary_provider, attempt_provider, failover_reason or 'unknown', success=True)
            active_provider = attempt_provider
            active_model = attempt_model
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

    if summary_resp is None or deep_resp is None:
        raise (last_exc or RuntimeError('All advisory providers failed'))

    return {
        'summary_resp': summary_resp,
        'deep_resp': deep_resp,
        'provider': active_provider,
        'model': active_model,
        'primary_model': primary_model,
        'failover_occurred': failover_occurred,
        'failover_reason': failover_reason,
        'failover_chain_attempted': failover_chain_attempted,
        'failover_attempt_count': failover_attempt_count,
    }
