"""Danh sách provider/model AI khả dụng cho backend + frontend."""

from __future__ import annotations

ADVISORY_CAPABILITY = 'text_advisory'


MODEL_CATALOG = {
    'openai': [
        {'id': 'gpt-4o', 'label': 'GPT-4o', 'api_family': 'openai', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
        {'id': 'gpt-4-turbo', 'label': 'GPT-4 Turbo', 'api_family': 'openai', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
        {'id': 'gpt-3.5-turbo', 'label': 'GPT-3.5 Turbo', 'api_family': 'openai', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
    ],
    'claude': [
        {'id': 'claude-mythos-5', 'label': 'Claude Mythos 5', 'api_family': 'anthropic', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'claude-4.6-opus', 'label': 'Claude 4.6 Opus', 'api_family': 'anthropic', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'claude-4.6-sonnet', 'label': 'Claude 4.6 Sonnet', 'api_family': 'anthropic', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'claude-4.5-haiku', 'label': 'Claude 4.5 Haiku', 'api_family': 'anthropic', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'claude-3-5-sonnet-20240620', 'label': 'Claude 3.5 Sonnet', 'api_family': 'anthropic', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
        {'id': 'claude-3-opus-20240229', 'label': 'Claude 3 Opus', 'api_family': 'anthropic', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
        {'id': 'claude-3-haiku-20240307', 'label': 'Claude 3 Haiku', 'api_family': 'anthropic', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
    ],
    'gemini': [
        {'id': 'gemini-3.1-pro', 'label': 'Gemini 3.1 Pro', 'api_family': 'gemini-openai-compatible', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'gemini-3.1-flash', 'label': 'Gemini 3.1 Flash', 'api_family': 'gemini-openai-compatible', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'gemini-3.1-flash-lite', 'label': 'Gemini 3.1 Flash-Lite', 'api_family': 'gemini-openai-compatible', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'nano-banana-2', 'label': 'Nano Banana 2', 'api_family': 'gemini-openai-compatible', 'capabilities': [], 'validated_for_runtime': False},
        {'id': 'gemini-1.5-pro', 'label': 'Gemini 1.5 Pro', 'api_family': 'gemini-openai-compatible', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
        {'id': 'gemini-1.5-flash', 'label': 'Gemini 1.5 Flash', 'api_family': 'gemini-openai-compatible', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
    ],
    'copilot': [
        {'id': 'openai/gpt-4.1-mini', 'label': 'OpenAI GPT-4.1 Mini', 'api_family': 'github-models', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
        {'id': 'openai/gpt-4.1', 'label': 'OpenAI GPT-4.1', 'api_family': 'github-models', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
    ],
    'openclaw': [
        {'id': 'default', 'label': 'OpenClaw Default', 'api_family': 'openclaw', 'capabilities': [ADVISORY_CAPABILITY], 'validated_for_runtime': True},
    ],
}

DEFAULT_MODELS = {
    'openai': 'gpt-4o',
    'claude': 'claude-3-5-sonnet-20240620',
    'gemini': 'gemini-1.5-pro',
    'copilot': 'openai/gpt-4.1-mini',
    'openclaw': 'default',
}


def _entry_supports(entry: dict, capability: str | None, validated_only: bool) -> bool:
    if validated_only and not bool(entry.get('validated_for_runtime')):
        return False
    if capability and capability not in list(entry.get('capabilities') or []):
        return False
    return True


def get_model_entries(provider: str, capability: str | None = None, validated_only: bool = False) -> list[dict]:
    provider_key = str(provider or '').strip().lower()
    entries = MODEL_CATALOG.get(provider_key, [])
    return [entry.copy() for entry in entries if _entry_supports(entry, capability, validated_only)]


def get_model_entry(provider: str, model: str) -> dict | None:
    provider_key = str(provider or '').strip().lower()
    model_key = str(model or '').strip()
    for entry in MODEL_CATALOG.get(provider_key, []):
        if str(entry.get('id') or '').strip() == model_key:
            return entry.copy()
    return None


def build_provider_model_map(capability: str | None = None, validated_only: bool = False) -> dict[str, list[str]]:
    return {
        provider: [str(entry.get('id') or '').strip() for entry in get_model_entries(provider, capability=capability, validated_only=validated_only)]
        for provider in MODEL_CATALOG.keys()
    }


AVAILABLE_MODELS = build_provider_model_map(capability=ADVISORY_CAPABILITY, validated_only=True)

PROVIDER_CHOICES = tuple((name, name.title()) for name in AVAILABLE_MODELS.keys())


def get_default_model(provider: str) -> str:
    provider_key = str(provider or '').strip().lower()
    return DEFAULT_MODELS.get(provider_key, 'default')


def is_valid_provider(provider: str) -> bool:
    provider_key = str(provider or '').strip().lower()
    return provider_key in AVAILABLE_MODELS


def is_valid_model(provider: str, model: str) -> bool:
    model_key = str(model or '').strip()
    if not model_key:
        return True
    return get_model_entry(provider, model_key) is not None


def is_model_allowed_for_capability(provider: str, model: str, capability: str, validated_only: bool = True) -> bool:
    model_key = str(model or '').strip()
    if not model_key:
        return False
    entry = get_model_entry(provider, model_key)
    if not entry:
        return False
    return _entry_supports(entry, capability=capability, validated_only=validated_only)


def get_models_for_capability(provider: str, capability: str, validated_only: bool = True) -> list[str]:
    return [str(entry.get('id') or '').strip() for entry in get_model_entries(provider, capability=capability, validated_only=validated_only)]
