"""
Whale Advisory Language & Model Configuration
==============================================

Consolidates language selection, model resolution based on budget,
and conciseness logic for whale advisory generation.
"""

import logging
import os
from typing import Optional

from django.core.cache import cache
from django.utils import timezone

from portfolio.models import WhaleAdvisory

logger = logging.getLogger(__name__)


def _resolve_output_language(user_cfg) -> str:
    """
    Resolve output language from user config with fallback to Vietnamese.
    
    Returns: 'vi' or 'en'
    """
    output_language = str(getattr(user_cfg, 'language', 'vi') if user_cfg is not None else 'vi').strip().lower()
    if output_language not in {'vi', 'en'}:
        output_language = 'vi'
    return output_language


# Default cheaper/faster fallback model per provider used during low-budget routing.
_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS: dict[str, str] = {
    'openai': 'gpt-3.5-turbo',
    'claude': 'claude-3-haiku-20240307',
    'gemini': 'gemini-1.5-flash',
    'copilot': 'openai/gpt-4.1-mini',
    'openclaw': 'default',
}


def _resolve_model_for_budget(
    provider: str,
    model: str,
    remaining_budget: Optional[int],
    total_budget: Optional[int],
) -> str:
    """
    Return a (possibly downgraded) model ID based on remaining daily token budget.

    When the user's remaining budget falls below ``ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT``
    percent of ``total_budget``, the task is automatically routed to a cheaper / faster model
    so the session can serve more advisory cycles with the remaining tokens.

    The fallback model is configurable per provider via env vars of the form
    ``ADVISORY_BUDGET_DOWNGRADE_MODEL_{PROVIDER}`` (e.g. ``ADVISORY_BUDGET_DOWNGRADE_MODEL_OPENAI``).
    An empty or missing env var falls back to :data:`_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS`.
    """
    if remaining_budget is None or total_budget is None or total_budget <= 0:
        return model

    threshold_pct = max(float(os.getenv('ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT', '20')), 1.0)
    threshold_tokens = total_budget * (threshold_pct / 100.0)

    if remaining_budget > threshold_tokens:
        return model  # Budget still comfortable — keep original model.

    provider_key = str(provider or '').strip().lower()
    env_key = f'ADVISORY_BUDGET_DOWNGRADE_MODEL_{provider_key.upper()}'
    cheap_model = (os.getenv(env_key) or _ADVISORY_BUDGET_DOWNGRADE_DEFAULTS.get(provider_key, '')).strip()

    if not cheap_model or cheap_model == model:
        return model

    logger.info(
        'Advisory model downgraded (low budget): provider=%s %s→%s remaining=%s total=%s threshold_pct=%.1f',
        provider, model, cheap_model, remaining_budget, total_budget, threshold_pct,
    )
    # Increment daily downgrade counter for monitoring metrics endpoint.
    _dg_key = f'advisory:budget-downgrade-count:{timezone.localdate().isoformat()}'
    try:
        cache.incr(_dg_key)
    except ValueError:
        cache.set(_dg_key, 1, timeout=90_000)  # ~25h
    except Exception:
        pass
    return cheap_model


def _should_use_concise_advisory(source: str, remaining_budget: Optional[int]) -> bool:
    """
    Determine if advisory should use concise format based on source and budget.
    
    Concise format is used for:
    - Periodic jobs
    - Low-budget scenarios (remaining <= threshold)
    """
    threshold = max(int(os.getenv('ADVISORY_CONCISE_BUDGET_THRESHOLD', '1200')), 200)
    return source == WhaleAdvisory.SourceChoices.PERIODIC_JOB or (
        remaining_budget is not None and remaining_budget <= threshold
    )


def _resolve_advisory_output_config(
    *,
    user_cfg,
    provider: str,
    model: str,
    source_key: str,
    remaining_budget: Optional[int],
    total_budget: Optional[int],
) -> dict:
    """
    Consolidate language, model, and format decisions for advisory output.
    
    Returns dict with keys:
    - output_language: 'vi' or 'en'
    - resolved_model: model ID (possibly downgraded)
    - use_concise: bool indicating concise format
    """
    output_language = _resolve_output_language(user_cfg)
    resolved_model = _resolve_model_for_budget(provider, model, remaining_budget, total_budget)
    use_concise = _should_use_concise_advisory(source_key, remaining_budget)
    
    return {
        'output_language': output_language,
        'resolved_model': resolved_model,
        'use_concise': use_concise,
    }
