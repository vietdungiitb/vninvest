from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx
from django.conf import settings

from .ai_context import build_symbol_ai_context, render_context_for_prompt, render_concise_context_for_prompt
from .ai_options import get_default_model
from .openclaw_client import generate_whale_deep, generate_whale_summary

logger = logging.getLogger(__name__)


def _resolve_output_language(user=None) -> str:
    language = str(getattr(user, 'language', '') or '').strip().lower()
    return 'en' if language == 'en' else 'vi'


def _language_instruction(language: str) -> str:
    if language == 'en':
        return 'Write the full response in English only.'
    return 'Viết toàn bộ nội dung bằng tiếng Việt có dấu.'


def _build_signal_prompt_intro(symbol: str, matched_value_vnd: float, side: str, context_payload: dict[str, Any]) -> str:
    side_key = str(side or '').strip().upper()
    value_billion = float(matched_value_vnd or 0.0) / 1_000_000_000
    order_flow = (context_payload or {}).get('order_flow') or {}
    market = (context_payload or {}).get('market') or {}
    intraday = (context_payload or {}).get('intraday') or {}
    order_stats = (context_payload or {}).get('order_stats') or {}
    session_stats = order_stats.get('session') or {}
    five_day_stats = order_stats.get('five_day') or {}

    session_side_stats = (session_stats.get('buy') if side_key == 'BUY' else session_stats.get('sell')) or {}
    five_day_side_stats = (five_day_stats.get('buy') if side_key == 'BUY' else five_day_stats.get('sell')) or {}

    session_count = int(session_side_stats.get('count') or 0)
    session_total = float(session_side_stats.get('total_value') or 0.0)
    session_max = float(session_side_stats.get('max_value') or 0.0)
    five_day_count = int(five_day_side_stats.get('count') or 0)
    five_day_total = float(five_day_side_stats.get('total_value') or 0.0)
    five_day_max = float(five_day_side_stats.get('max_value') or 0.0)

    signal_type = str(order_flow.get('latest_signal_type') or 'none').strip().lower()
    signal_strength = float(order_flow.get('latest_strength') or 0.0)
    signal_confidence = str(order_flow.get('latest_confidence') or 'low').strip().lower()

    latest_close = float(market.get('latest_close') or 0.0)
    change_1d_pct = float(market.get('change_1d_pct') or 0.0)
    change_5d_pct = float(market.get('change_5d_pct') or 0.0)
    intraday_buy_value = float(intraday.get('buy_value_today') or 0.0)
    intraday_sell_value = float(intraday.get('sell_value_today') or 0.0)
    intraday_net_value = intraday_buy_value - intraday_sell_value

    if side_key in {'BUY', 'SELL'} and value_billion > 0:
        market_clause = (
            f"Giá hiện tại khoảng {latest_close:,.2f} VND; biến động 1D {change_1d_pct:.2f}% và 5D {change_5d_pct:.2f}%."
            if latest_close > 0
            else ""
        )
        order_flow_clause = (
            f"Dark money/order-flow gần nhất: {signal_type.upper()} (strength {signal_strength:.1f}, confidence {signal_confidence})."
            if signal_type not in {'none', 'unknown', ''}
            else ""
        )
        intraday_clause = (
            f"Dòng tiền intraday: buy {intraday_buy_value:,.0f} VND, sell {intraday_sell_value:,.0f} VND, net {intraday_net_value:,.0f} VND."
            if (intraday_buy_value > 0 or intraday_sell_value > 0)
            else ""
        )
        return (
            f"Phân tích tín hiệu giao dịch tại TTCK Việt Nam cho mã {symbol}. "
            f"Lệnh {side_key}, giá trị khoảng {value_billion:.1f} tỷ VNĐ. "
            f"Thống kê {side_key} trong phiên: {session_count} lệnh, tổng {session_total:,.0f} VND, lớn nhất {session_max:,.0f} VND. "
            f"Thống kê {side_key} 5 phiên gần nhất: {five_day_count} lệnh, tổng {five_day_total:,.0f} VND, lớn nhất {five_day_max:,.0f} VND. "
            f"{market_clause} {order_flow_clause} {intraday_clause}".strip()
        )

    if signal_type not in {'none', 'unknown', ''} and signal_strength >= 50:
        return (
            f"Phân tích diễn biến order-flow cho mã {symbol}. "
            f"Tín hiệu gần nhất là {signal_type.upper()} (strength {signal_strength:.1f}), "
            "nhưng chưa đủ xác nhận hướng mua/bán lớn."
        )

    return (
        f"Phân tích trạng thái dòng tiền của mã {symbol} theo bối cảnh thị trường hiện tại. "
        "Hiện chưa ghi nhận lệnh mua/bán lớn đủ rõ để kết luận một chiều."
    )


def _openai_compatible_completion(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    max_tokens: int,
    extra_headers: dict[str, str] | None = None,
    timeout_seconds: float | None = None,
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

    _max_retries = int(os.getenv('AI_PROVIDER_RATE_LIMIT_MAX_RETRIES', '3'))
    _retry_base_seconds = float(os.getenv('AI_PROVIDER_RATE_LIMIT_RETRY_BASE_SECONDS', '5'))
    _request_timeout = float(
        timeout_seconds
        if timeout_seconds is not None
        else os.getenv('AI_PROVIDER_REQUEST_TIMEOUT_SECONDS', '45')
    )

    for attempt in range(_max_retries + 1):
        resp = httpx.post(
            target_url,
            headers=headers,
            json=payload,
            timeout=_request_timeout,
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
                    timeout=_request_timeout,
                )
                if fallback_resp.status_code < 400:
                    resp = fallback_resp

        if resp.status_code == 429:
            if attempt >= _max_retries:
                logger.warning(
                    'AI provider 429 rate limit exceeded after %d retries url=%s',
                    attempt,
                    target_url,
                )
                resp.raise_for_status()
            # Respect Retry-After header if provider sends it; otherwise exponential backoff.
            retry_after_raw = resp.headers.get('Retry-After') or resp.headers.get('x-ratelimit-reset-after')
            try:
                wait_seconds = float(retry_after_raw) if retry_after_raw else _retry_base_seconds * (2 ** attempt)
            except (TypeError, ValueError):
                wait_seconds = _retry_base_seconds * (2 ** attempt)
            wait_seconds = min(max(wait_seconds, 1.0), 10.0)  # Capped at 10s to avoid blocking Celery worker
            logger.warning(
                'AI provider 429 rate limit url=%s attempt=%d/%d — retrying in %.1fs',
                target_url,
                attempt + 1,
                _max_retries,
                wait_seconds,
            )
            time.sleep(wait_seconds)
            continue

        break

    resp.raise_for_status()
    body = resp.json()
    return {
        'text': body['choices'][0]['message']['content'].strip(),
        'prompt_tokens': body.get('usage', {}).get('prompt_tokens', 0),
        'completion_tokens': body.get('usage', {}).get('completion_tokens', 0),
    }


def _claude_completion(api_key: str, model: str, prompt: str, max_tokens: int) -> dict[str, Any]:
    _max_retries = int(os.getenv('AI_PROVIDER_RATE_LIMIT_MAX_RETRIES', '3'))
    _retry_base_seconds = float(os.getenv('AI_PROVIDER_RATE_LIMIT_RETRY_BASE_SECONDS', '5'))

    for attempt in range(_max_retries + 1):
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
        if resp.status_code == 429:
            if attempt >= _max_retries:
                logger.warning('Claude 429 rate limit exceeded after %d retries', attempt)
                resp.raise_for_status()
            retry_after_raw = resp.headers.get('Retry-After') or resp.headers.get('anthropic-ratelimit-requests-reset')
            try:
                wait_seconds = float(retry_after_raw) if retry_after_raw else _retry_base_seconds * (2 ** attempt)
            except (TypeError, ValueError):
                wait_seconds = _retry_base_seconds * (2 ** attempt)
            wait_seconds = min(max(wait_seconds, 1.0), 10.0)  # Capped at 10s to avoid blocking Celery worker
            logger.warning('Claude 429 attempt=%d/%d — retrying in %.1fs', attempt + 1, _max_retries, wait_seconds)
            time.sleep(wait_seconds)
            continue
        break

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
    output_language: str | None = None,
    news_hint: str = '',
) -> dict[str, Any]:
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or '').strip()
    if not model_id:
        raise RuntimeError(f'Missing AI model for provider {provider_key}')
    max_tokens = 450 if deep else 130
    mode_text = '200 từ' if deep else '50 từ'
    context_payload = build_symbol_ai_context(symbol, user=user)
    context_block = render_context_for_prompt(context_payload)
    resolved_language = output_language or _resolve_output_language(getattr(user, 'userconfig', user))
    language_instruction = _language_instruction(resolved_language)
    intro_text = _build_signal_prompt_intro(symbol, matched_value_vnd, side, context_payload)
    news_block = f'\n\n{news_hint}' if news_hint and news_hint.strip() else ''
    prompt = (
        f"{intro_text} "
        f"Viết khoảng {mode_text}, nêu ý nghĩa tín hiệu, rủi ro và điểm cần theo dõi."
        f" {language_instruction}"
        f"{context_block}"
        f"{news_block}"
    )

    if not api_key:
        if provider_key == 'openclaw':
            raise RuntimeError('Missing API key for provider openclaw')
        raise RuntimeError(f'Missing API key for provider {provider_key}')

    if provider_key == 'openclaw':
        return (
            generate_whale_deep(symbol, matched_value_vnd, side, extra_context=context_block, output_language=resolved_language)
            if deep
            else generate_whale_summary(symbol, matched_value_vnd, side, extra_context=context_block, output_language=resolved_language)
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


def generate_portfolio_digest(
    provider: str,
    model: str,
    api_key: str,
    symbols: list[str],
    news_context_by_symbol: dict[str, str],
    user=None,
    output_language: str | None = None,
) -> dict[str, Any]:
    """
    Sprint35 Layer 3: Tạo bản tóm tắt tin tức danh mục AI.
    Nhận tin tức theo từng mã, trả về narrative cá nhân hóa.
    Returns dict với 'summary' (~50 từ), 'full' (~200 từ), 'prompt_tokens', 'completion_tokens'.
    """
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or '').strip()
    if not model_id:
        raise RuntimeError(f'generate_portfolio_digest: thiếu AI model cho provider {provider_key}')

    resolved_language = output_language or _resolve_output_language(getattr(user, 'userconfig', user))
    language_instruction = _language_instruction(resolved_language)

    # Lắp ghép news context vào prompt
    news_sections: list[str] = []
    for sym in symbols:
        ctx = str(news_context_by_symbol.get(sym) or '').strip()
        if ctx:
            news_sections.append(ctx)
    news_block = '\n\n'.join(news_sections) if news_sections else ''

    if not news_block:
        # Không có tin tức → không gọi AI
        raise ValueError('generate_portfolio_digest: không có tin tức để tóm tắt')

    symbol_list = ', '.join(symbols[:15])
    prompt = (
        f"Bạn là trợ lý đầu tư chứng khoán Việt Nam. Dưới đây là tổng hợp tin tức hôm nay cho danh mục quan tâm của nhà đầu tư.\n\n"
        f"Danh mục: {symbol_list}\n\n"
        f"{news_block}\n\n"
        f"Hãy viết bản tóm tắt news digest theo 2 phần:\n"
        f"SUMMARY: Tóm tắt toàn cảnh trong 2-3 câu (khoảng 50 từ) — đề cập các điểm nổi bật nhất.\n"
        f"FULL: Phân tích sâu hơn (150-200 từ) theo từng nhóm chủ đề hoặc từng mã, chỉ ra ý nghĩa và điểm cần theo dõi.\n\n"
        f"{language_instruction}\n"
        f"[Thông tin tham khảo, không phải lời khuyên đầu tư tài chính]"
    )

    if not api_key and provider_key != 'openclaw':
        raise RuntimeError(f'generate_portfolio_digest: thiếu API key cho provider {provider_key}')

    max_tokens = 500

    if provider_key == 'openclaw':
        # Dùng OpenAI-compatible openclaw endpoint
        base_url = os.getenv('OPENCLAW_BASE_URL', 'https://api.openclaw.ai/v1')
        return _call_provider_and_split(
            provider_key=provider_key, base_url=base_url, api_key=api_key,
            model_id=model_id, prompt=prompt, max_tokens=max_tokens,
        )

    if provider_key == 'claude':
        raw = _claude_completion(api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)
        return _split_digest_sections(raw)

    if provider_key in ('openai', 'gemini', 'copilot'):
        base_url_map = {
            'openai': os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            'gemini': os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
            'copilot': os.getenv('COPILOT_BASE_URL', 'https://models.github.ai/inference'),
        }
        extra_headers = None
        request_timeout_seconds = None
        if provider_key == 'copilot':
            extra_headers = {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': os.getenv('COPILOT_API_VERSION', '2026-03-10'),
            }
            request_timeout_seconds = float(os.getenv('COPILOT_REQUEST_TIMEOUT_SECONDS', '75'))
        raw = _openai_compatible_completion(
            base_url=base_url_map[provider_key],
            api_key=api_key,
            model=model_id,
            prompt=prompt,
            max_tokens=max_tokens,
            extra_headers=extra_headers,
            timeout_seconds=request_timeout_seconds,
        )
        return _split_digest_sections(raw)

    raise RuntimeError(f'generate_portfolio_digest: provider không hỗ trợ: {provider_key}')


def _call_provider_and_split(
    provider_key: str,
    base_url: str,
    api_key: str,
    model_id: str,
    prompt: str,
    max_tokens: int,
) -> dict[str, Any]:
    """Internal helper: gọi openclaw-compatible endpoint, tách SUMMARY/FULL."""
    raw = _openai_compatible_completion(
        base_url=base_url,
        api_key=api_key,
        model=model_id,
        prompt=prompt,
        max_tokens=max_tokens,
    )
    return _split_digest_sections(raw)


def _split_digest_sections(raw: dict[str, Any]) -> dict[str, Any]:
    """Tách SUMMARY: / FULL: từ text AI trả về."""
    import re as _re
    text = str(raw.get('text') or '')
    summary = ''
    full = ''
    summary_match = _re.search(r'SUMMARY:\s*(.*?)(?=FULL:|$)', text, _re.DOTALL | _re.IGNORECASE)
    full_match = _re.search(r'FULL:\s*(.*)', text, _re.DOTALL | _re.IGNORECASE)
    if summary_match:
        summary = summary_match.group(1).strip()
    if full_match:
        full = full_match.group(1).strip()
    if not summary:
        # Fallback: dùng toàn bộ text làm summary
        summary = text[:500].strip()
    return {
        'summary': summary,
        'full': full,
        'prompt_tokens': int(raw.get('prompt_tokens') or 0),
        'completion_tokens': int(raw.get('completion_tokens') or 0),
    }


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


# PHASE 1: Concise advisory generation (5-10 lines, ~100 tokens)
def generate_advisory_concise(
    provider: str,
    model: str,
    api_key: str,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    user=None,
    output_language: str | None = None,
) -> dict[str, Any]:
    """
    PHASE 1: Generate a concise advisory (5-10 lines, optimized for token efficiency).
    Used for auto-generation and manual refresh to save API costs.
    
    Returns dict with 'text', 'prompt_tokens', 'completion_tokens'
    """
    provider_key = str(provider or 'openclaw').strip().lower()
    model_id = str(model or '').strip()
    if not model_id:
        raise RuntimeError(f'Missing AI model for provider {provider_key}')
    
    context_payload = build_symbol_ai_context(symbol, user=user)
    context_block = render_concise_context_for_prompt(context_payload)
    resolved_language = output_language or _resolve_output_language(getattr(user, 'userconfig', user))
    language_instruction = _language_instruction(resolved_language)
    
    # Concise prompt: target ~100 tokens output, 5-10 lines max
    prompt = (
        f"Phân tích ngắn gọn (5-10 dòng) về tín hiệu giao dịch tại TTCK Việt Nam:\n\n"
        f"{context_block}\n\n"
        f"Lệnh: {side}\n"
        f"Giá trị: {matched_value_vnd / 1_000_000_000:.1f} tỷ VNĐ\n\n"
        f"Hãy viết nhanh gọn (5-10 dòng tối đa) bao gồm:\n"
        f"- Động lực có thể của tín hiệu\n"
        f"- Rủi ro chính cần chú ý\n"
        f"- Điểm cần theo dõi ngắn hạn\n\n"
        f"{language_instruction}\n"
        f"[Thông tin tham khảo, không phải lời khuyên đầu tư tài chính]"
    )
    
    if not api_key:
        if provider_key == 'openclaw':
            raise RuntimeError('Missing API key for provider openclaw')
        raise RuntimeError(f'Missing API key for provider {provider_key}')
    
    # Call appropriate provider
    max_tokens = 130  # ~100 tokens for output, rest for overhead
    
    if provider_key == 'openclaw':
        from .openclaw_client import generate_whale_concise
        return generate_whale_concise(symbol, matched_value_vnd, side, extra_context=context_block, output_language=resolved_language)
    
    if provider_key == 'claude':
        return _claude_completion(api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)
    
    if provider_key == 'openai':
        base_url = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
        return _openai_compatible_completion(base_url=base_url, api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)
    
    if provider_key == 'gemini':
        base_url = os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai')
        return _openai_compatible_completion(base_url=base_url, api_key=api_key, model=model_id, prompt=prompt, max_tokens=max_tokens)
    
    if provider_key == 'copilot':
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
