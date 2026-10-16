"""
R2.2: OpenAI-compatible client (openai / gemini / local, và openclaw NẾU
OpenAI-compatible — quyết định ở R2.5 khi có spec D-03c).

Endpoint resolution + SSRF guard chuyển từ `orchestrator._resolve_chat_endpoint`
sang đây (orchestrator re-export để test R0.6 không phải sửa).
"""
import time

import httpx

from advisory.ai_clients.base import AiClient, ProviderHTTPError, parse_usage_dict

OPENAI_BASE_URL = 'https://api.openai.com/v1'
GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
LOCAL_BASE_URL = 'http://localhost:11434/v1'

_NO_KEY_MARKERS = ('', 'no-key-needed', 'none')


def _resolve_chat_endpoint(provider: str, custom_endpoint: str, ai_model: str = '') -> str:
    """Resolve + SSRF-guard chat-completions endpoint (R0.6 AC6/orchestrator).

    `custom_endpoint` đến từ `UserAICredential` (user nhập, lưu DB) — phải
    validate trước mỗi lần POST, giống như test-connection view. Fail-closed
    với message TINH: không echo endpoint (AC5), không str(e) raw (AC8).
    URL mặc định của từng provider là hằng số, không cần validate.
    `local` được phép loopback (Ollama/VLLM cùng host) nhưng vẫn chặn
    metadata cloud + RFC1918 + scheme lạ — giống view.
    """
    if provider == 'local':
        if custom_endpoint:
            base = custom_endpoint.rstrip('/')
            # Lazy import: tránh cycle advisory -> user_workspace lúc load module.
            from user_workspace.endpoint_safety import (
                UnsafeEndpointError,
                assert_safe_outbound_url,
            )
            try:
                assert_safe_outbound_url(base, allow_loopback=True)
            except UnsafeEndpointError:
                raise ValueError(
                    'Endpoint AI bị chặn vì lý do an toàn (SSRF). '
                    'Nếu đây là endpoint on-prem hợp lệ, cấu hình '
                    'SOC_AI_ALLOWED_ENDPOINT_HOSTS phía máy chủ.'
                )
            return base + '/chat/completions'
        return 'http://localhost:11434/v1/chat/completions'
    if provider == 'gemini' or (ai_model or '').lower().startswith('gemini'):
        return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    return 'https://api.openai.com/v1/chat/completions'


def _base_url_for(provider: str, custom_endpoint: str, ai_model: str = '') -> str:
    """Base URL tương ứng endpoint chat (để probe/catalog)."""
    chat = _resolve_chat_endpoint(provider, custom_endpoint, ai_model)
    if chat.endswith('/chat/completions'):
        return chat[: -len('/chat/completions')]
    return chat.rstrip('/')


class OpenAICompatClient(AiClient):
    """Client cho mọi provider nói OpenAI-compatible chat-completions."""

    provider = 'openai'

    def __init__(
        self,
        *,
        api_key: str = "",
        base_url: str = "",
        endpoint: str = "",
        timeout: float = 30.0,
        model: str = "",
        provider_kind: str = "openai",
        json_mode: bool = True,
        transport: object = None,
    ):
        super().__init__(
            api_key=api_key, base_url=base_url, endpoint=endpoint,
            timeout=timeout, model=model,
        )
        self.provider_kind = provider_kind or 'openai'
        self.provider = self.provider_kind
        self.json_mode = json_mode
        self._transport = transport

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_key not in _NO_KEY_MARKERS:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _client(self, timeout: float) -> httpx.AsyncClient:
        kwargs: dict = {'timeout': timeout}
        if self._transport is not None:
            kwargs['transport'] = self._transport
        return httpx.AsyncClient(**kwargs)

    async def complete(
        self,
        system: str,
        user: str,
        *,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: float = None,
        response_format: str = None,
    ) -> dict:
        payload: dict = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format == "json" and self.json_mode:
            payload["response_format"] = {"type": "json_object"}
        try:
            async with self._client(timeout if timeout is not None else self.timeout) as client:
                response = await client.post(self.endpoint, headers=self._headers(), json=payload)
        except Exception as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            raise ProviderHTTPError(status, str(exc)[:500]) from exc
        if response.status_code >= 400:
            raise ProviderHTTPError(
                response.status_code, (response.text or '')[:500], response=response,
            )
        try:
            res_data = response.json()
        except Exception as exc:
            raise ProviderHTTPError(response.status_code, f"invalid_json: {exc}"[:500]) from exc
        try:
            choice = res_data['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderHTTPError(response.status_code, f"bad_shape: {exc}"[:500]) from exc
        tokens_in, tokens_out, unavailable = parse_usage_dict(res_data.get('usage'))
        return {
            'text': (choice or '').strip(),
            'usage': None if unavailable else {'input': tokens_in, 'output': tokens_out},
            'raw': res_data,
            'finish_reason': (res_data['choices'][0] or {}).get('finish_reason'),
        }

    async def probe(self) -> dict:
        """GET {base}/models: tối thiểu 1 request, trả latency (R2.6 dùng lại)."""
        url = (self.base_url or '').rstrip('/') + '/models'
        started = time.monotonic()
        try:
            async with self._client(min(self.timeout, 10.0)) as client:
                response = await client.get(url, headers=self._headers())
        except Exception as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            return {
                'ok': False, 'latency_ms': int((time.monotonic() - started) * 1000),
                'error_code': 'provider_unreachable', 'detail': str(exc)[:200],
            }
        latency_ms = int((time.monotonic() - started) * 1000)
        if response.status_code >= 400:
            code = 'provider_auth_failed' if response.status_code in (401, 403) else 'provider_error'
            return {'ok': False, 'latency_ms': latency_ms, 'error_code': code, 'detail': (response.text or '')[:200]}
        return {'ok': True, 'latency_ms': latency_ms, 'error_code': '', 'detail': ''}

    async def catalog(self) -> list | None:
        """Danh mục model từ {base}/models (chuẩn R2.10); None khi không đọc được."""
        try:
            async with self._client(min(self.timeout, 15.0)) as client:
                response = await client.get(
                    (self.base_url or '').rstrip('/') + '/models', headers=self._headers()
                )
        except Exception:
            return None
        if response.status_code >= 400:
            return None
        try:
            data = response.json().get('data') or []
        except Exception:
            return None
        out = []
        for item in data:
            if not isinstance(item, dict) or not item.get('id'):
                continue
            out.append({
                'id': item['id'],
                'provider': self.provider_kind,
                'api': 'openai-chat',
                'context_window': item.get('context_window'),
                'state': 'verified',
            })
        return out
