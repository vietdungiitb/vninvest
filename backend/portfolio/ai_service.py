from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from django.conf import settings

from .ai_context import build_symbol_ai_context, render_context_for_prompt
from .ai_options import get_default_model
from .openclaw_client import generate_whale_deep, generate_whale_summary

logger = logging.getLogger(__name__)


def _openai_compatible_completion(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    max_tokens: int,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    if extra_headers:
        headers.update(extra_headers)

    endpoint = str(base_url or '').strip().rstrip('/')
    if endpoint.endswith('/chat/completions'):
        target_url = endpoint
    else:
        target_url = f"{endpoint}/chat/completions"

    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': max_tokens,
        'temperature': 0.3,
    }

    resp = httpx.post(
        target_url,
        headers=headers,
        json=payload,
        timeout=30.0,
    )

    # Some GitHub Models deployments expose OpenAI-compatible endpoint on
    # models.inference.ai.azure.com instead of models.github.ai/inference.
    if resp.status_code == 404 and 'models.github.ai' in target_url:
        fallback_url = target_url.replace('models.github.ai/inference', 'models.inference.ai.azure.com')
        if fallback_url != target_url:
            fallback_resp = httpx.post(
                fallback_url,
                headers=headers,
                json=payload,
                timeout=30.0,
            )
            if fallback_resp.status_code < 400:
                resp = fallback_resp

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


def generate_whale_text(
    provider: str,
    model: str,
    api_key: str,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    deep: bool,
    user=None,
) -> dict[str, Any]:
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or '').strip()
    if not model_id:
        raise RuntimeError(f'Missing AI model for provider {provider_key}')
    max_tokens = 450 if deep else 130
    mode_text = '200 từ' if deep else '50 từ'
    context_payload = build_symbol_ai_context(symbol, user=user)
    context_block = render_context_for_prompt(context_payload)
    prompt = (
        f"Phân tích tín hiệu giao dịch tại TTCK Việt Nam cho mã {symbol}. "
        f"Lệnh {side}, giá trị khoảng {matched_value_vnd / 1_000_000_000:.1f} tỷ VNĐ. "
        f"Viết khoảng {mode_text}, nêu ý nghĩa tín hiệu, rủi ro và điểm cần theo dõi."
        f"{context_block}"
    )

    if not api_key:
        if provider_key == 'openclaw':
            raise RuntimeError('Missing API key for provider openclaw')
        raise RuntimeError(f'Missing API key for provider {provider_key}')

    if provider_key == 'openclaw':
        return (
            generate_whale_deep(symbol, matched_value_vnd, side, extra_context=context_block)
            if deep
            else generate_whale_summary(symbol, matched_value_vnd, side, extra_context=context_block)
        )

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
        # GitHub Models inference API is OpenAI-compatible at /inference/chat/completions.
        base_url = os.getenv('COPILOT_BASE_URL', 'https://models.github.ai/inference')
        api_version = os.getenv('COPILOT_API_VERSION', '2026-03-10')
        return _openai_compatible_completion(
            base_url=base_url,
            api_key=api_key,
            model=model_id,
            prompt=prompt,
            max_tokens=max_tokens,
            extra_headers={
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': api_version,
            },
        )

    raise RuntimeError(f'Unsupported AI provider: {provider_key}')


def test_ai_connection(provider: str, model: str, api_key: str) -> dict[str, Any]:
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or get_default_model(provider_key)).strip()
    key = _resolve_provider_api_key(provider_key, api_key)

    if not model_id:
        return {
            'ok': False,
            'provider': provider_key,
            'model': model_id,
            'message': 'Bạn chưa chọn AI model.',
        }

    if not key:
        return {'ok': False, 'provider': provider_key, 'model': model_id, 'message': 'Bạn chưa cấu hình API key cho provider đã chọn.'}

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
