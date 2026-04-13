from __future__ import annotations

from portfolio.tasks_whale_bookkeeping import (
    _collect_generation_language_metrics,
    _record_generation_token_usage,
)


def _execute_whale_provider_bookkeeping_phase(
    *,
    symbol: str,
    output_language: str,
    use_concise: bool,
    provider_result: dict,
) -> dict:
    summary_resp = provider_result['summary_resp']
    deep_resp = provider_result['deep_resp']
    provider = provider_result['provider']
    model = provider_result['model']
    primary_model = provider_result['primary_model']
    failover_occurred = provider_result['failover_occurred']
    failover_reason = provider_result['failover_reason']
    failover_chain_attempted = provider_result['failover_chain_attempted']
    failover_attempt_count = provider_result['failover_attempt_count']

    language_mismatch = _collect_generation_language_metrics(
        symbol=symbol,
        provider=provider,
        model=model,
        output_language=output_language,
        summary_resp=summary_resp,
        deep_resp=deep_resp,
    )

    _record_generation_token_usage(
        summary_resp=summary_resp,
        deep_resp=deep_resp,
        use_concise=use_concise,
    )

    return {
        'summary_resp': summary_resp,
        'deep_resp': deep_resp,
        'provider': provider,
        'model': model,
        'primary_model': primary_model,
        'failover_occurred': failover_occurred,
        'failover_reason': failover_reason,
        'failover_chain_attempted': failover_chain_attempted,
        'failover_attempt_count': failover_attempt_count,
        'language_mismatch': language_mismatch,
    }
