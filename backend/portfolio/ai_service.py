from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from django.conf import settings

from .ai_options import get_default_model
from .openclaw_client import generate_whale_deep, generate_whale_summary

logger = logging.getLogger(__name__)


def _openai_compatible_completion(base_url: str, api_key: str, model: str, prompt: str, max_tokens: int) -> dict[str, Any]:
    resp = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': max_tokens,
            'temperature': 0.3,
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    body = resp.json()
    return {
        'text': body['choices'][0]['message']['content'].strip(),
        'prompt_tokens': body.get('usage', {}).get('prompt_tokens', 0),
        'completion_tokens': body.get('usage', {}).get('completion_tokens', 0),
    }


def _claude_completion(api_key: str, model: str, prompt: str, max_tokens: int) -> dict[str, Any]:
    resp = httpx.post(
        'https://api.anthropic.com/v1/messages',
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        json={
            'model': model,
            'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}],
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    body = resp.json()
    texts = [part.get('text', '') for part in body.get('content', []) if isinstance(part, dict)]
    return {
        'text': '\n'.join([t for t in texts if t]).strip(),
        'prompt_tokens': body.get('usage', {}).get('input_tokens', 0),
        'completion_tokens': body.get('usage', {}).get('output_tokens', 0),
    }


def _resolve_provider_api_key(provider: str, decrypted_user_key: str = '') -> str:
    if decrypted_user_key:
        return decrypted_user_key

    provider_key = str(provider or '').lower()
    env_map = {
        'openai': 'OPENAI_API_KEY',
        'claude': 'ANTHROPIC_API_KEY',
        'gemini': 'GEMINI_API_KEY',
        'copilot': 'COPILOT_API_KEY',
        'openclaw': 'OPENCLAW_API_KEY',
    }
    env_name = env_map.get(provider_key)
    if not env_name:
        return ''
    return os.getenv(env_name, '')


def generate_whale_text(provider: str, model: str, api_key: str, symbol: str, matched_value_vnd: float, side: str, deep: bool) -> dict[str, Any]:
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or get_default_model(provider_key)).strip() or get_default_model(provider_key)
    max_tokens = 450 if deep else 130
    mode_text = '200 từ' if deep else '50 từ'
    prompt = (
        f"Phân tích tín hiệu giao dịch tại TTCK Việt Nam cho mã {symbol}. "
        f"Lệnh {side}, giá trị khoảng {matched_value_vnd / 1_000_000_000:.1f} tỷ VNĐ. "
        f"Viết khoảng {mode_text}, nêu ý nghĩa tín hiệu, rủi ro và điểm cần theo dõi."
    )

    if provider_key == 'openclaw':
        return generate_whale_deep(symbol, matched_value_vnd, side) if deep else generate_whale_summary(symbol, matched_value_vnd, side)

    if not api_key:
        raise RuntimeError(f'Missing API key for provider {provider_key}')

    if provider_key == 'claude':
        return _claude_completion(api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)

    if provider_key == 'openai':
        base_url = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
        return _openai_compatible_completion(base_url=base_url, api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)

    if provider_key == 'gemini':
        # Gemini OpenAI-compatible endpoint (if enabled by key/project)
        base_url = os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai')
        return _openai_compatible_completion(base_url=base_url, api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)

    if provider_key == 'copilot':
        base_url = os.getenv('COPILOT_BASE_URL', 'https://api.githubcopilot.com/v1')
        return _openai_compatible_completion(base_url=base_url, api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)

    raise RuntimeError(f'Unsupported AI provider: {provider_key}')


def test_ai_connection(provider: str, model: str, api_key: str) -> dict[str, Any]:
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or get_default_model(provider_key)).strip()
    key = _resolve_provider_api_key(provider_key, api_key)

    if provider_key == 'openclaw' and not key:
        # Keep behavior compatible with current placeholder mode in openclaw_client.
        return {'ok': True, 'provider': provider_key, 'model': model_id, 'message': 'OPENCLAW_API_KEY chưa cấu hình, sẽ chạy placeholder mode.'}

    if provider_key != 'openclaw' and not key:
        return {'ok': False, 'provider': provider_key, 'model': model_id, 'message': 'Thiếu API key cho provider đã chọn.'}

    try:
        response = generate_whale_text(
            provider=provider_key,
            model=model_id,
            api_key=key,
            symbol='VCB',
            matched_value_vnd=2_000_000_000,
            side='BUY',
            deep=False,
        )
        return {
            'ok': True,
            'provider': provider_key,
            'model': model_id,
            'message': 'Kết nối thành công.',
            'prompt_tokens': int(response.get('prompt_tokens', 0)),
            'completion_tokens': int(response.get('completion_tokens', 0)),
        }
    except Exception as exc:
        logger.warning('AI connection test failed provider=%s model=%s error=%s', provider_key, model_id, exc)
        return {
            'ok': False,
            'provider': provider_key,
            'model': model_id,
            'message': str(exc),
        }
