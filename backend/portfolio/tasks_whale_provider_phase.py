from __future__ import annotations

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_error_recovery,
    start_advisory_phase,
)
from portfolio.tasks_whale_provider_generation import _run_whale_provider_generation


def _execute_whale_provider_phase(
    *,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    target_user,
    output_language: str,
    use_concise: bool,
    news_hint: str,
    remaining_budget: int,
    total_budget: int,
    primary_provider: str,
    model: str,
    api_key: str,
) -> dict:
    start_advisory_phase('provider_generation')
    try:
        provider_result = _run_whale_provider_generation(
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            target_user=target_user,
            output_language=output_language,
            use_concise=use_concise,
            news_hint=news_hint,
            remaining_budget=remaining_budget,
            total_budget=total_budget,
            primary_provider=primary_provider,
            primary_model=model,
            api_key=api_key,
        )
    except Exception as exc:
        end_advisory_phase('provider_generation')
        record_advisory_error_recovery(type(exc).__name__, 'provider_generation_failed', success=False)
        end_advisory_session()
        raise

    end_advisory_phase('provider_generation')
    return provider_result
