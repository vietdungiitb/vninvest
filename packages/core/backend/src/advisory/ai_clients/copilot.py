"""R2.4 - client Copilot: 2 bước (doi token -> goi model).

Buoc 1 + vong doi/refresh token nam o `advisory.copilot_tokens.CopilotTokenManager`
(cache module, lock chong stampede, refresh som truoc het han).
File nay chi lo phan goi model, dung session token da co:

    POST {endpoints.api}/chat/completions
        Authorization: Bearer <session>
        Copilot-Integration-Id: vscode-chat     # BẮT BUỘC - thiếu là 401

Base URL **luôn** lấy từ token response (`endpoints.api`), cho pép override bằng
`COPILOT_API_BASE_URL` (Enterprise / proxy). Không hardcode.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from advisory.ai_clients.base import AiClient, ProviderHTTPError, parse_usage_dict
from advisory.copilot_tokens import (
    DEFAULT_INTEGRATION_ID,
    CopilotTokenExchangeError,
    CopilotTokenManager,
)

logger = logging.getLogger(__name__)

CHAT_PATH = '/chat/completions'
MODELS_PATH = '/models'


class CopilotClient(AiClient):
    """Adapter `copilot`. Token raw cua user la token GitHub OAuth (`ghu_`)."""

    provider = 'copilot'

    def __init__(
        self,
        *,
        api_key: str = '',
        base_url: str = '',
        endpoint: str = '',
        timeout: float = 30.0,
        model: str = '',
        integration_id: str = '',
        api_base_override: str = '',
        transport: httpx.BaseTransport | None = None,
        token_exchange_transport: httpx.BaseTransport | None = None,
        token_manager: CopilotTokenManager | None = None,
        allow_raw_token_catalog_fallback: bool = True,
    ):
        super().__init__(api_key=api_key, base_url=base_url, endpoint=endpoint,
                         timeout=timeout, model=model)
        self.integration_id = integration_id or DEFAULT_INTEGRATION_ID
        self.api_base_override = api_base_override
        self._transport = transport
        self._token_exchange_transport = token_exchange_transport
        self.allow_raw_token_catalog_fallback = allow_raw_token_catalog_fallback
        self._tokens = token_manager or CopilotTokenManager(
            integration_id=self.integration_id,
            api_base_override=api_base_override,
            transport=token_exchange_transport,
        )

    # ------------------------------------------------------------- helpers

    def _headers(self, session_token: str) -> dict:
        return {
            'Authorization': f'Bearer {session_token}',
            # Bắt buộc: thiếu header này GitHub trả 401.
            'Copilot-Integration-Id': self.integration_id,
            'Content-Type': 'application/json',
            'User-Agent': 'vninvest-ai-client',
        }

    def _payload(self, system: str, user: str, model: str, temperature: float,
                 max_tokens: int, response_format: str | None) -> dict:
        payload = {
            'model': model,
            'messages': [
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
            'temperature': temperature,
            'max_tokens': max_tokens,
        }
        # Không ép response_format: catalog gateway có thể từ chối.
        return payload

    def _session_sync(self):
        return self._tokens.get_session(self.api_key)

    async def _session(self):
        # Exchange là I/O chặn (httpx.Client) -> đẩy sang thread để không chặn loop.
        return await asyncio.to_thread(self._session_sync)

    # ------------------------------------------------------------ complete

    async def complete(
        self,
        system: str,
        user: str,
        *,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: float | None = None,
        response_format: str | None = None,
    ) -> dict:
        session = await self._session()
        body = self._payload(system, user, model, temperature, max_tokens, response_format)
        url = f'{session.base_url}{self.endpoint or CHAT_PATH}'

        async with httpx.AsyncClient(transport=self._transport,
                                     timeout=timeout or self.timeout) as client:
            response = await client.post(url, json=body, headers=self._headers(session.token))

            if response.status_code == 401:
                # AC12: token het han giua chung -> refresh 1 lan, retry 1 lan.
                # Retry lai vo han bo se toan 401 va khoe muc doi token cho user.
                logger.info('Copilot 401 - refresh session token 1 lan')
                session = await asyncio.to_thread(self._tokens.force_refresh, self.api_key)
                response = await client.post(
                    url, json=body, headers=self._headers(session.token),
                )

        response.raise_for_status()
        payload = response.json()
        choices = payload.get('choices') or []
        message = (choices[0].get('message') or {}) if choices else {}
        usage = payload.get('usage')
        tokens_in, tokens_out, unavailable = parse_usage_dict(usage)
        return {
            'text': str(message.get('content') or ''),
            'usage': None if unavailable else {'input': tokens_in, 'output': tokens_out},
            'raw': payload,
            'finish_reason': (choices[0].get('finish_reason') if choices else None),
        }

    # -------------------------------------------------------------- catalog

    async def catalog(self) -> list:
        """AC9-AC11 - danh muc model **that** cua tai khoan, khong bia list.

        Copilot gating theo goi/tai khoan nen danh muc lay tu API, khong hardcode.
        Rỗng hoặc lỗi => `[]` (KHÔNG trả danh sách tự chế ra).
        """
        try:
            session = await self._session()
        except CopilotTokenExchangeError as exc:
            # AC11: exchange fail nhung token raw co the goi duoc `/models`.
            if not self.allow_raw_token_catalog_fallback:
                logger.info('Copilot catalog: bo fallback raw token (%s)', exc.error_code)
                return []
            logger.info('Copilot catalog: fallback raw token cho /models')
            return await self._catalog_with_raw_token()

        async with httpx.AsyncClient(transport=self._transport, timeout=self.timeout) as client:
            response = await client.get(
                f'{session.base_url}{MODELS_PATH}', headers=self._headers(session.token),
            )
        return _filter_catalog(response)

    async def _catalog_with_raw_token(self) -> list:
        base = self.api_base_override or 'https://api.githubcopilot.com'
        headers = {
            'Authorization': f'token {self.api_key}',
            'Copilot-Integration-Id': self.integration_id,
            'Accept': 'application/vnd.github+json',
        }
        async with httpx.AsyncClient(transport=self._transport, timeout=self.timeout) as client:
            response = await client.get(f'{base}{MODELS_PATH}', headers=headers)
        return _filter_catalog(response)

    # ---------------------------------------------------------------- probe

    async def probe(self) -> dict:
        """Kiem tra song: doi token + doc catalog. Ma loi giu nguyen cua tung bay."""
        try:
            await self._session()
        except CopilotTokenExchangeError as exc:
            return {
                'ok': False, 'latency_ms': 0,
                'error_code': exc.error_code, 'detail': exc.user_message,
            }
        models = await self.catalog()
        return {
            'ok': True,
            'latency_ms': 0,
            'error_code': '' if models else 'copilot_catalog_empty',
            'detail': '' if models else (
                'Đã đổi được token Copilot nhưng danh mục model rỗng — tài khoản '
                'có thể chưa có quyền Copilot.'
            ),
        }


def _filter_catalog(response) -> list:
    """AC9/AC10 - loc theo `policy.state` + `model_picker_enabled`, lỗi => []."""
    if response.status_code >= 400:
        logger.info('Copilot catalog HTTP %s => trả rỗng', response.status_code)
        return []
    try:
        payload = response.json()
    except ValueError:
        return []
    entries = payload.get('data') if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        return []
    catalog = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        model_id = str(entry.get('id') or '').strip()
        if not model_id:
            continue
        policy = entry.get('policy') if isinstance(entry.get('policy'), dict) else {}
        state = str(policy.get('state') or '').strip().lower()
        if state and state != 'enabled':
            continue
        if entry.get('model_picker_enabled') is False:
            continue
        catalog.append({
            'id': model_id,
            'name': str(entry.get('name') or model_id),
            'policy_state': state or 'enabled',
            'vendor': str(entry.get('vendor') or ''),
        })
    return catalog


__all__ = ['CopilotClient', 'CopilotTokenExchangeError', 'ProviderHTTPError']