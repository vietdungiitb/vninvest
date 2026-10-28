"""R2.5 - `openclaw` (dịch vụ nội bộ): **fail-closed**, không đoán protocol.

Owner xác nhận openclaw là dịch vụ nội bộ **thật**, nhưng repo **không có trace nào**
của protocol nó, và plan có STOP condition §3.4-6: thiếu bất kỳ mục nào trong 5 thông
tin D-03c thì BLOCKED — **không đoán** base URL / protocol / auth.

Vì vậy adapter này cố tình **không** implement gọi mạng:

| Tình trạng | Kết quả |
|---|---|
| Không có `OPENCLAW_BASE_URL` | `503 openclaw_not_configured` |
| Có base URL, `OPENCLAW_PROTOCOL` chưa khai | `503 openclaw_spec_missing` |
| Có base URL + protocol lạ (chưa hỗ trợ) | `503 openclaw_spec_missing` |

Khi Owner cấp D-03c, chỉ cần khai `OPENCLAW_PROTOCOL` và viết nhánh tương ứng; hợp
đồng lỗi ở trên **giữ nguyên**, nên không phải sửa lại call site nào.

Quan trọng: `test-connection` trước đây trả **200 + latency 0** cho openclaw mà chưa
từng gọi dịch vụ — đúng loại "hiển thị sai rồi mới biết" mà R0.4 đã gọi tên.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

import httpx
from django.conf import settings as django_settings

from advisory.ai_clients.base import AiClient

logger = logging.getLogger(__name__)

ENV_BASE_URL = 'OPENCLAW_BASE_URL'
ENV_API_KEY = 'OPENCLAW_API_KEY'
ENV_PROTOCOL = 'OPENCLAW_PROTOCOL'

ERROR_NOT_CONFIGURED = 'openclaw_not_configured'
ERROR_SPEC_MISSING = 'openclaw_spec_missing'

#: Protocol đã implement. Rỗng cho tới khi Owner cấp D-03c — cố ý KHÔNG đoán.
SUPPORTED_PROTOCOLS: tuple = ()

_MSG_NOT_CONFIGURED = (
    'Dịch vụ OpenClaw chưa được cấu hình trên máy chủ '
    f'({ENV_BASE_URL} chưa đặt). Hãy liên hệ quản trị viên hệ thống.'
)
_MSG_SPEC_MISSING = (
    'Cấu hình OpenClaw thiếu thông tin protocol. Cần Owner xác nhận D-03c: '
    f'đặt {ENV_PROTOCOL} (hiện hỗ trợ: {list(SUPPORTED_PROTOCOLS) or "chưa có"}) '
    'trước khi dùng được.'
)


class OpenClawNotConfiguredError(RuntimeError):
    """Chưa có base URL. 503, không rơi về provider khác (AC1)."""

    error_code = ERROR_NOT_CONFIGURED
    status_code = 503

    def __init__(self, message: str = ''):
        self.user_message = message or _MSG_NOT_CONFIGURED
        super().__init__(f'{self.error_code}: {self.user_message}')


class OpenClawSpecMissingError(RuntimeError):
    """Có base URL nhưng protocol chưa được khai/đã hỗ trợ (STOP condition §3.4-6)."""

    error_code = ERROR_SPEC_MISSING
    status_code = 503

    def __init__(self, message: str = ''):
        self.user_message = message or _MSG_SPEC_MISSING
        super().__init__(f'{self.error_code}: {self.user_message}')


def openclaw_base_url() -> str:
    """`OPENCLAW_BASE_URL` từ settings trước, env sau. Rỗng = chưa cấu hình."""
    configured = getattr(django_settings, ENV_BASE_URL, '') or ''
    return (configured or os.environ.get(ENV_BASE_URL) or '').strip().rstrip('/')


def openclaw_protocol() -> str:
    return (
        getattr(django_settings, ENV_PROTOCOL, '') or os.environ.get(ENV_PROTOCOL) or ''
    ).strip().lower()


def resolve_config() -> dict:
    """Trả cấu hình đã kiểm tra. Raise nếu thiếu — không trả giá trị đoán."""
    base_url = openclaw_base_url()
    if not base_url:
        raise OpenClawNotConfiguredError()
    protocol = openclaw_protocol()
    if protocol not in SUPPORTED_PROTOCOLS:
        raise OpenClawSpecMissingError()
    return {
        'base_url': base_url,
        'protocol': protocol,
        'api_key': (
            getattr(django_settings, ENV_API_KEY, '')
            or os.environ.get(ENV_API_KEY) or ''
        ),
    }


class OpenClawClient(AiClient):
    """Adapter openclaw — hiện **chỉ** fail-closed (D-03c chưa có).

    Không có nhánh gọi mạng cho tới khi `SUPPORTED_PROTOCOLS` có phần tử đầu tiên.
    """

    provider = 'openclaw'

    def __init__(
        self,
        *,
        api_key: str = '',
        base_url: str = '',
        endpoint: str = '',
        timeout: float = 30.0,
        model: str = '',
        transport: Optional[httpx.BaseTransport] = None,
    ):
        super().__init__(
            api_key=api_key, base_url=base_url, endpoint=endpoint,
            timeout=timeout, model=model,
        )
        self._transport = transport

    def _config(self) -> dict:
        # `base_url` truyền vào (custom endpoint của user) chỉ được dùng sau khi
        # kiểm tra protocol — không cho né được bước fail-closed.
        config = resolve_config()
        if self.base_url:
            config['base_url'] = self.base_url.rstrip('/')
        return config

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
        self._config()  # raise nếu chưa cấu hình / chưa có protocol
        raise OpenClawSpecMissingError()  # pragma: no cover - chưa có protocol nào

    async def probe(self) -> dict:
        started = time.monotonic()
        try:
            self._config()
        except OpenClawNotConfiguredError as exc:
            return {
                'ok': False, 'latency_ms': 0,
                'error_code': exc.error_code, 'detail': exc.user_message,
            }
        except OpenClawSpecMissingError as exc:
            return {
                'ok': False, 'latency_ms': int((time.monotonic() - started) * 1000),
                'error_code': exc.error_code, 'detail': exc.user_message,
            }
        return {  # pragma: no cover - chưa có protocol nào được hỗ trợ
            'ok': False, 'latency_ms': 0,
            'error_code': ERROR_SPEC_MISSING, 'detail': _MSG_SPEC_MISSING,
        }

    async def catalog(self) -> list:
        # Danh mục của dịch vụ chưa rõ nguồn (`/models` hay tĩnh?) — D-03c#4.
        return []


__all__ = [
    'ERROR_NOT_CONFIGURED',
    'ERROR_SPEC_MISSING',
    'SUPPORTED_PROTOCOLS',
    'OpenClawClient',
    'OpenClawNotConfiguredError',
    'OpenClawSpecMissingError',
    'openclaw_base_url',
    'openclaw_protocol',
    'resolve_config',
]