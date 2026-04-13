from __future__ import annotations

from portfolio.ai_service import generate_advisory_concise, generate_whale_text


def _execute_provider_ai_call(
    *,
    provider: str,
    model: str,
    api_key: str,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    target_user,
    output_language: str,
    use_concise: bool,
    news_hint: str,
) -> tuple[dict, dict]:
    """Execute AI call for a single provider attempt.

    Returns (summary_resp, deep_resp) tuple.
    """
    if use_concise:
        summary_resp = generate_advisory_concise(
            provider=provider,
            model=model,
            api_key=api_key,
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            user=target_user,
            output_language=output_language,
        )
        deep_resp: dict = {'text': '', 'prompt_tokens': 0, 'completion_tokens': 0}
    else:
        summary_resp = generate_whale_text(
            provider=provider,
            model=model,
            api_key=api_key,
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            deep=False,
            user=target_user,
            output_language=output_language,
            news_hint=news_hint,
        )
        deep_resp = generate_whale_text(
            provider=provider,
            model=model,
            api_key=api_key,
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            deep=True,
            user=target_user,
            output_language=output_language,
            news_hint=news_hint,
        )

    return summary_resp, deep_resp
