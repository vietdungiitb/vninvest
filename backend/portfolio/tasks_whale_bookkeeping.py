from __future__ import annotations

import logging

from django.utils import timezone

from portfolio.observability import record_advisory_token_usage
from portfolio.tasks_advisory_helpers import _increment_daily_counter, _is_language_mismatch

logger = logging.getLogger(__name__)


def _collect_generation_language_metrics(
    *,
    symbol: str,
    provider: str,
    model: str,
    output_language: str,
    summary_resp: dict,
    deep_resp: dict,
) -> bool:
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
    return language_mismatch


def _record_generation_token_usage(*, summary_resp: dict, deep_resp: dict, use_concise: bool) -> None:
    record_advisory_token_usage(
        int(summary_resp.get('prompt_tokens', 0) or 0) + int(summary_resp.get('completion_tokens', 0) or 0),
        source='summary_generation' if not use_concise else 'concise_generation',
    )
    if not use_concise:
        record_advisory_token_usage(
            int(deep_resp.get('prompt_tokens', 0) or 0) + int(deep_resp.get('completion_tokens', 0) or 0),
            source='detail_generation',
        )


def _resolve_generation_refresh_count(*, force_refresh: bool, latest_existing_advisory) -> int:
    return (latest_existing_advisory.refresh_count + 1) if (force_refresh and latest_existing_advisory is not None) else 0
