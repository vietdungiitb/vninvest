from __future__ import annotations

from typing import Any

from .ai_options import get_default_model, is_valid_model, is_valid_provider
from .ai_service import _resolve_provider_api_key
from .models import SystemAISettings, UserConfig


def _normalize_provider(value: str | None) -> str:
    provider = str(value or '').strip().lower()
    return provider or 'openclaw'


def _resolve_api_key(provider: str, raw_key: str, allow_env_fallback: bool) -> str:
    if raw_key:
        return raw_key
    if not allow_env_fallback:
        return ''
    return _resolve_provider_api_key(provider, '')


def _build_not_ready_payload(reason: str, message: str, provider: str = '', model: str = '') -> dict[str, Any]:
    return {
        'ready': False,
        'source': None,
        'provider': provider,
        'model': model,
        'api_key': '',
        'reason': reason,
        'message': message,
    }


def resolve_ai_runtime_config(user=None, system_settings: SystemAISettings | None = None) -> dict[str, Any]:
    """
    Resolve effective AI runtime config with priority:
    1) User AI config (provider/model/key)
    2) System AI settings
    3) Env fallback (if enabled by system settings)
    """
    user_cfg = None
    if user is not None:
        user_cfg, _ = UserConfig.objects.get_or_create(user=user)

    if user_cfg is not None:
        user_provider = _normalize_provider(getattr(user_cfg, 'ai_provider', 'openclaw'))
        user_model = str(user_cfg.get_effective_ai_model() or get_default_model(user_provider)).strip()
        user_key = _resolve_api_key(
            provider=user_provider,
            raw_key=str(user_cfg.get_ai_api_key() or '').strip(),
            allow_env_fallback=True,
        )

        if (
            is_valid_provider(user_provider)
            and bool(user_model)
            and is_valid_model(user_provider, user_model)
            and bool(user_key)
        ):
            return {
                'ready': True,
                'source': 'user',
                'provider': user_provider,
                'model': user_model,
                'api_key': user_key,
                'reason': None,
                'message': '',
                'user_config_id': user_cfg.pk,
            }

    system_cfg = system_settings or SystemAISettings.get_active()
    if system_cfg is None:
        return _build_not_ready_payload(
            reason='missing_system_ai_settings',
            message='Chưa có System AI Settings. Vui lòng cấu hình trong Django Admin.',
        )

    system_provider = _normalize_provider(getattr(system_cfg, 'ai_provider', 'openclaw'))
    system_model = str(system_cfg.get_effective_ai_model() or get_default_model(system_provider)).strip()
    system_key = _resolve_api_key(
        provider=system_provider,
        raw_key=str(system_cfg.get_ai_api_key() or '').strip(),
        allow_env_fallback=bool(system_cfg.allow_env_fallback),
    )

    if not is_valid_provider(system_provider):
        return _build_not_ready_payload(
            reason='invalid_system_ai_provider',
            message='System AI provider không hợp lệ. Vui lòng cập nhật lại System AI Settings.',
            provider=system_provider,
            model=system_model,
        )

    if not system_model or not is_valid_model(system_provider, system_model):
        return _build_not_ready_payload(
            reason='invalid_system_ai_model',
            message='System AI model không hợp lệ. Vui lòng cập nhật lại System AI Settings.',
            provider=system_provider,
            model=system_model,
        )

    if not system_key:
        return _build_not_ready_payload(
            reason='missing_system_ai_api_key',
            message='System AI chưa có API key khả dụng (DB/env).',
            provider=system_provider,
            model=system_model,
        )

    return {
        'ready': True,
        'source': 'system',
        'provider': system_provider,
        'model': system_model,
        'api_key': system_key,
        'reason': None,
        'message': '',
        'system_config_id': system_cfg.pk,
    }
