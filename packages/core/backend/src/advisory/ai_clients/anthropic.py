"""R2.3 - adapter `anthropic`: native `/v1/messages`, KHÔNG OpenAI-compatible.

Vì sao cần adapter riêng (AC1 nói "RED trước fix"): Anthropic **không** dùng
`Authorization: Bearer`. Nó dùng `x-api-key` + `anthropic-version`. Trước R2.3,
`claude` rơi vào nhánh `else` của `_resolve_chat_endpoint` ⇒ gửi tới
`api.openai.com` kèm Bearer ⇒ 401 và thông điệp sai cho user. Đó là F-06.

Payload khác OpenAI: `system` là **tham số đầu** (không phải message đầu tiên),
`max_tokens` là **bắt buộc**, usage nằm ở `input_tokens`/`output_tokens`.

Dùng `httpx` thuần — repo đã vậy cho mọi provider (đã phản biện trong plan: thêm
SDK `anthropic` cho 1 provider là nợ phụ thuộc vô ích).

**Mặc định TẮT** (AC7). `AI_ENABLE_ANTHROPIC` không khai trong `settings.py` ⇒
`getattr(..., False)` ⇒ fail-closed. Provider chưa bật thì raise
`AnthropicDisabledError` ngay ở client, **không** rơi về provider khác.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Optional

import httpx
from django.conf import settings as django_settings

from advisory.ai_clients.base import AiClient, ProviderHTTPError, parse_usage_dict

logger = logging.getLogger(__name__)

ANTHROPIC_BASE_URL = os.environ.get('ANTHROPIC_BASE_URL') or 'https://api.anthropic.com'
ANTHROPIC_VERSION = '2023-06-01'
MESSAGES_PATH = '/v1/messages'
MODELS_PATH = '/v1/models'

ENV_ENABLE = 'AI_ENABLE_ANTHROPIC'

ERROR_PROVIDER_DISABLED = 'provider_disabled'
ERROR_AUTH_FAILED = 'provider_auth_failed'
ERROR_MODEL_NOT_FOUND = 'provider_model_not_found'


class AnthropicDisabledError(RuntimeError):
    """Provider bị tắt. Fail-closed, KHÔNG gọi nhầm provider khác (AC7)."""

    error_code = ERROR_PROVIDER_DISABLED
    status_code = 503

    def __init__(self, provider: str = 'claude'):
        self.provider = provider
        self.user_message = (
            f'Provider {provider} chưa được bật. Bật bằng {ENV_ENABLE}=true '
            f'sau khi đã cấu hình khoá Anthropic.'
        )
        super().__init__(f'{self.error_code}: {provider}')


def anthropic_enabled() -> bool:
    """Mặc định **tắt** (fail-closed). Chỉ bật khi owner đặt cờ tường minh."""
    return bool(getattr(django_settings, ENV_ENABLE, False))


def _parse_anthropic_usage(usage) -> Optional[dict]:
    """AC2: `input_tokens`/`output_tokens`. Không có ⇒ `None`, không bịa 0.

    `parse_usage_dict` của R2.2 đọc shape OpenAI (`prompt_tokens`), nên không dùng
    ở đây — nếu dùng nhầm thì mọi lượt gọi Claude đều báo usage không có.
    """
    if not isinstance(usage, dict):
        return None
    try:
        tokens_in = int(usage.get('input_tokens') or 0)
    except (TypeError, ValueError):
        tokens_in = 0
    try:
        tokens_out = int(usage.get('output_tokens') or 0)
    except (TypeError, ValueError):
        tokens_out = 0
    if tokens_in <= 0 and tokens_out <= 0:
        return None
    return {'input': max(tokens_in, 0), 'output': max(tokens_out, 0)}


class AnthropicClient(AiClient):
    """Adapter Claude. Token raw là API key `sk-ant-...` của Anthropic."""

    provider = 'claude'

    def __init__(
        self,
        *,
        api_key: str = '',
        base_url: str = '',
        endpoint: str = '',
        timeout: float = 30.0,
        model: str = '',
        transport: Optional[httpx.BaseTransport] = None,
        enabled: Optional[bool] = None,
    ):
        super().__init__(
            api_key=api_key, base_url=base_url, endpoint=endpoint,
            timeout=timeout, model=model,
        )
        self._transport = transport
        self._enabled = anthropic_enabled() if enabled is None else bool(enabled)

    # ------------------------------------------------------------- helpers

    def _ensure_enabled(self) -> None:
        if not self._enabled:
            raise AnthropicDisabledError(self.provider)

    def _headers(self) -> dict:
        return {
            # AC1: Anthropic KHÔNG dùng Authorization: Bearer.
            'x-api-key': self.api_key,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
        }

    def _payload(self, system: str, user: str, model: str, temperature: float,
                 max_tokens: int) -> dict:
        return {
            'model': model,
            # `system` là tham số riêng, không phải message đầu tiên.
            'system': system,
            'messages': [{'role': 'user', 'content': user}],
            'max_tokens': max(int(max_tokens or 0), 1),
            'temperature': temperature,
        }

    @property
    def _url(self) -> str:
        base = (self.base_url or ANTHROPIC_BASE_URL).rstrip('/')
        path = self.endpoint or MESSAGES_PATH
        if not path.startswith('/'):
            path = '/' + path
        return base + path

    # ------------------------------------------------------------ complete

    async def complete(
        self,
        system: str,
        user: str,
        *,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: Optional[float] = None,
        response_format: Optional[str] = None,
    ) -> dict:
        self._ensure_enabled()
        async with httpx.AsyncClient(transport=self._transport,
                                     timeout=timeout or self.timeout) as client:
            response = await client.post(
                self._url,
                json=self._payload(system, user, model, temperature, max_tokens),
                headers=self._headers(),
            )
        if response.status_code >= 400:
            # Hợp đồng của `AiClient`: lỗi HTTP phải là `ProviderHTTPError` để tầng
            # retry R2.9 phân loại được (401 không retry, 429/5xx thì retry).
            # `httpx.HTTPStatusError` sẽ lọt qua và bị coi là lỗi lạ ⇒ fail ngay.
            raise ProviderHTTPError(
                response.status_code,
                body=response.text[:500],
                response=response,
            )
        payload = response.json()

        # Nhiều khối text; bỏ các khối kiểu khác (thinking/tool_use).
        parts = [
            block.get('text') or ''
            for block in (payload.get('content') or [])
            if isinstance(block, dict) and block.get('type') == 'text'
        ]
        return {
            'text': ''.join(parts),
            'usage': _parse_anthropic_usage(payload.get('usage')),
            'raw': payload,
            'finish_reason': payload.get('stop_reason'),
        }

    # -------------------------------------------------------------- catalog

    async def catalog(self) -> list:
        if not self._enabled:
            return []
        async with httpx.AsyncClient(transport=self._transport, timeout=self.timeout) as client:
            response = await client.get(
                f'{(self.base_url or ANTHROPIC_BASE_URL).rstrip("/")}{MODELS_PATH}',
                headers=self._headers(),
            )
        if response.status_code >= 400:
            return []
        try:
            data = response.json().get('data') or []
        except ValueError:
            return []
        out = []
        for item in data:
            if not isinstance(item, dict) or not item.get('id'):
                continue
            out.append({
                'id': item['id'],
                'name': item.get('display_name') or item['id'],
                'context_window': None,
                'vendor': 'anthropic',
                'policy_state': 'enabled',
            })
        return out

    # ---------------------------------------------------------------- probe

    async def probe(self) -> dict:
        """AC6: tối thiểu 1 request tới Anthropic, trả latency.

        `GET /v1/models` nhẹ hơn `POST /messages` (không tốn token) và đủ để xác
        thực khoá — 401/403 ở đây chính là "sai khoá", 404 là "model/endpoint lỗi".
        """
        if not self._enabled:
            return {
                'ok': False, 'latency_ms': 0,
                'error_code': ERROR_PROVIDER_DISABLED,
                'detail': (
                    f'Provider {self.provider} chưa bật ({ENV_ENABLE} chưa đặt true).'
                ),
            }
        started = time.monotonic()
        url = f'{(self.base_url or ANTHROPIC_BASE_URL).rstrip("/")}{MODELS_PATH}'
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=min(self.timeout, 15.0),
            ) as client:
                response = await client.get(url, headers=self._headers())
        except Exception as exc:
            return {
                'ok': False,
                'latency_ms': int((time.monotonic() - started) * 1000),
                'error_code': 'provider_unreachable',
                'detail': f'{type(exc).__name__}: {exc}'[:200],
            }
        latency_ms = int((time.monotonic() - started) * 1000)
        if response.status_code in (401, 403):
            # AC4: khoá sai là auth, KHÔNG phải 404 như khi chọn sai model.
            return {
                'ok': False, 'latency_ms': latency_ms,
                'error_code': ERROR_AUTH_FAILED,
                'detail': 'Anthropic từ chối khoá (401/403). Kiểm tra lại API key.',
            }
        if response.status_code == 404:
            return {
                'ok': False, 'latency_ms': latency_ms,
                'error_code': ERROR_MODEL_NOT_FOUND,
                'detail': 'Anthropic không có endpoint/model này (404).',
            }
        if response.status_code >= 400:
            return {
                'ok': False, 'latency_ms': latency_ms,
                'error_code': 'provider_error',
                'detail': f'HTTP {response.status_code}',
            }
        return {'ok': True, 'latency_ms': latency_ms, 'error_code': '', 'detail': ''}


__all__ = [
    'AnthropicClient',
    'AnthropicDisabledError',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_VERSION',
    'anthropic_enabled',
]