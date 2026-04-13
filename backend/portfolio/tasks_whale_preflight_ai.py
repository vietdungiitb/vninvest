"""
Whale Advisory AI Configuration & Provider Rate-Limit Checks
=============================================================

Validates AI runtime readiness and enforces provider rate-limit policies
for whale advisory generation pipeline.
"""

import logging
from typing import Optional

from django.conf import settings
from django.core.cache import cache

from portfolio.ai_runtime_config import resolve_ai_runtime_config

logger = logging.getLogger(__name__)


def _check_ai_runtime_config(
    *,
    target_user,
    symbol: str,
    user_id: Optional[int],
) -> Optional[dict | tuple]:
    """
    Validate AI runtime configuration readiness.
    
    Returns:
    - skip_response dict if AI runtime not ready
    - None if not ready check fails (signals caller should check manually)
    - (runtime_cfg, None) if ready — tuple with config and no error
    """
    runtime_cfg = resolve_ai_runtime_config(user=target_user)
    if not runtime_cfg.get('ready'):
        logger.info(
            'Whale advisory skipped for %s: runtime AI not ready reason=%s user_id=%s',
            symbol,
            runtime_cfg.get('reason'),
            user_id,
        )
        return {
            'skip_response': {
                'status': 'skipped',
                'symbol': symbol,
                'reason': str(runtime_cfg.get('reason') or 'runtime_ai_not_ready'),
                'user_id': user_id,
                'ai_source': runtime_cfg.get('source'),
            }
        }
    # Return tuple: (runtime_cfg, None) to indicate ready with config
    return runtime_cfg, None


def _check_provider_rate_limit(
    *,
    provider: str,
    symbol: str,
    user_id: Optional[int],
) -> Optional[dict]:
    """
    Check if provider is in rate-limit cooldown.
    
    Returns skip_response dict if rate-limited; otherwise None.
    """
    cache_key = f'advisory:provider-ratelimit:{provider}'
    if cache.get(cache_key):
        logger.info(
            'Whale advisory skipped — provider %s still in rate-limit cooldown symbol=%s user_id=%s',
            provider,
            symbol,
            user_id,
        )
        return {
            'skip_response': {
                'status': 'skipped',
                'symbol': symbol,
                'reason': 'provider_rate_limit_cooldown',
                'user_id': user_id,
            }
        }
    return None


def _extract_ai_config_values(runtime_cfg: dict) -> tuple:
    """
    Extract provider, model, and api_key from AI runtime config.
    
    Returns: (provider, model, api_key)
    """
    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    api_key = str(runtime_cfg.pop('api_key', '') or '').strip()
    return provider, model, api_key
