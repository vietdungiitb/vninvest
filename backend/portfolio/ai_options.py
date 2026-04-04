"""Danh sách provider/model AI khả dụng cho backend + frontend."""

from __future__ import annotations

AVAILABLE_MODELS = {
    'openai': ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    'claude': ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    'gemini': ['gemini-1.5-pro', 'gemini-1.5-flash'],
    'copilot': ['copilot-pro'],
    'openclaw': ['default'],
}

DEFAULT_MODELS = {
    'openai': 'gpt-4o',
    'claude': 'claude-3-5-sonnet-20240620',
    'gemini': 'gemini-1.5-pro',
    'copilot': 'copilot-pro',
    'openclaw': 'default',
}

PROVIDER_CHOICES = tuple((name, name.title()) for name in AVAILABLE_MODELS.keys())


def get_default_model(provider: str) -> str:
    provider_key = str(provider or '').strip().lower()
    return DEFAULT_MODELS.get(provider_key, 'default')


def is_valid_provider(provider: str) -> bool:
    provider_key = str(provider or '').strip().lower()
    return provider_key in AVAILABLE_MODELS


def is_valid_model(provider: str, model: str) -> bool:
    provider_key = str(provider or '').strip().lower()
    model_key = str(model or '').strip()
    if provider_key not in AVAILABLE_MODELS:
        return False
    if not model_key:
        return True
    return model_key in AVAILABLE_MODELS[provider_key]
