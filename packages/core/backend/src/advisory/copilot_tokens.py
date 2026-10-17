"""R2.4 - quản lý session token của GitHub Copilot (buoc 1 cua 2-buoc).

Copilot KHÔNG dùng thẳng khoá của user. Cần 2 bước:
  1. doi token: \`GET {COPILOT_EXCHANGE_URL}\` voi \`Authorization: token <ghu_>\`
     -> \`{token, endpoints.api, expires_in}\` (session token, ~25 phút).
  2. goi model: \`POST {endpoints.api}/chat/completions\` voi
     \`Authorization: Bearer <session>\` + \`Copilot-Integration-Id\` (bat buoc).

4 bẫy D-03b đã xác minh, xử lý riêng (không dùng chung "API key không hợp lệ"):
  | bẫy                | hiện tượng                          | xử lý                                   |
  |---------------------|-------------------------------------|------------------------------------------|
  | PAT không đổi token| exchange trả **404**                | `CopilotTokenExchangeError` + hướng dẫn `ghu_` |
  | sai OAuth client_id| cũng 404                            | trong message hướng dẫn dùng client_id VS Code |
  | token hết hạn 25p  | sau `expires_in` mọi request 401     | cache + refresh sớm `refresh_margin` s   |
  | Enterprise base URL| `api.githubcopilot.com` bị chặn     | đọc `endpoints.api` + cho override        |

**Token raw không bao giờ log/đưa vào message.** Khoá cache = sha256(raw) nên không
lộ giá trị; object trả về chỉ chứa session token + base URL.

Token clock dùng \`time.monotonic\` mặc định (đổi múi giờ hệ thống không làm hỏng
cache). Test truyền \`now_fn\` để dùng đồng hồ giả.
"""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_EXCHANGE_URL = 'https://api.github.com/copilot_internal/v2/token'
DEFAULT_INTEGRATION_ID = 'vscode-chat'
DEFAULT_REFRESH_MARGIN = 60
DEFAULT_TIMEOUT = 15.0

#: Biến môi trường (xem `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md`
#: §8 AI_COST / COPILOT_*). Không sửa file `.env*` — chúng nằm deny-list.
ENV_EXCHANGE_URL = 'COPILOT_EXCHANGE_URL'
ENV_API_BASE_URL = 'COPILOT_API_BASE_URL'
ENV_INTEGRATION_ID = 'COPILOT_INTEGRATION_ID'
ENV_REFRESH_MARGIN = 'COPILOT_TOKEN_REFRESH_MARGIN_SECONDS'

ERROR_TOKEN_EXCHANGE_FAILED = 'copilot_token_exchange_failed'

_MESSAGE_PAT = (
    'Cần GitHub OAuth token (bắt đầu bằng "ghu_"), không phải PAT. '
    'Trong "Kiểm tra kết nối", mở hướng dẫn lấy token Copilot. Nếu bạn dùng '
    'VS Code, OAuth client id là Iv1.b507a08c87ecfe98.'
)
_MESSAGE_NETWORK = (
    'Không trao đổi được token Copilot (lỗi mạng tới máy chủ GitHub). '
    'Thử lại sau; nếu còn lỗi thì kiểm tra kết nối ra api.github.com.'
)
_MESSAGE_MALFORMED = (
    'Máy chủ GitHub trả về dữ liệu token Copilot không đúng định dạng '
    '(thiếu token hoặc thiếu endpoints.api).'
)


class CopilotTokenExchangeError(RuntimeError):
    """Đổi token thất bại - mang `error_code` riêng, KHÔNG dùng mã 401 chung."""

    error_code = ERROR_TOKEN_EXCHANGE_FAILED

    def __init__(self, user_message: str, *, status: Optional[int] = None,
                 error_code: str = ERROR_TOKEN_EXCHANGE_FAILED):
        self.user_message = user_message
        self.status = status
        self.error_code = error_code
        super().__init__(f'{error_code} status={status}')


@dataclass(frozen=True)
class SessionToken:
    """Session token + base URL đã hợp nhất (kèm mốc hết hạn trên đồng hồ monotonic)."""

    token: str
    base_url: str
    expires_at: float

    def needs_refresh(self, now: float, margin: float) -> bool:
        return now >= (self.expires_at - margin)

    def __repr__(self) -> str:  # không bao giờ lộ token
        return f'SessionToken(base_url={self.base_url!r}, expires_at={self.expires_at!r})'


def _cache_key(raw_token: str) -> str:
    return hashlib.sha256((raw_token or '').encode('utf-8')).hexdigest()[:32]


class CopilotTokenManager:
    """Cache session token theo raw token, refresh sớm, lock chống stampede."""

    #: cache dùng chung cho mọi instance (key = sha256(raw)) - trai nghiem
    #: giữa các request nên cache phai o cap module.
    _cache: dict = {}
    _cache_lock = threading.Lock()
    #: Lock doi token **rieng theo key**: token user A khong chan token user B.
    _exchange_locks: dict = {}

    def __init__(
        self,
        *,
        exchange_url: str = '',
        api_base_override: str = '',
        integration_id: str = '',
        refresh_margin: Optional[float] = None,
        timeout: float = DEFAULT_TIMEOUT,
        transport: Optional[httpx.BaseTransport] = None,
        now_fn: Callable[[], float] = time.monotonic,
    ):
        self.exchange_url = exchange_url or os.environ.get(ENV_EXCHANGE_URL) or DEFAULT_EXCHANGE_URL
        self.api_base_override = (api_base_override or os.environ.get(ENV_API_BASE_URL) or '').strip()
        self.integration_id = integration_id or os.environ.get(ENV_INTEGRATION_ID) or DEFAULT_INTEGRATION_ID
        if refresh_margin is None:
            raw_margin = os.environ.get(ENV_REFRESH_MARGIN)
            try:
                refresh_margin = float(raw_margin) if raw_margin else DEFAULT_REFRESH_MARGIN
            except ValueError:
                logger.warning('%s khong phai so => dung mac dinh', ENV_REFRESH_MARGIN)
                refresh_margin = DEFAULT_REFRESH_MARGIN
        self.refresh_margin = float(refresh_margin)
        self.timeout = timeout
        self._transport = transport
        self._now_fn = now_fn

    # ---------------------------------------------------------------- cache

    @classmethod
    def clear_cache(cls) -> int:
        """Xoá cache (key rotation R4.2 / test). Trả số entry đã xoá."""
        with cls._cache_lock:
            count = len(cls._cache)
            cls._cache.clear()
        return count

    def _exchange_headers(self, raw_token: str) -> dict:
        return {
            'Authorization': f'token {raw_token}',
            'Copilot-Integration-Id': self.integration_id,
            'User-Agent': 'vninvest-ai-client',
            'Editor-Version': 'vscode/1.95.0',
            'Editor-Plugin-Version': 'copilot-chat/0.23.0',
            'X-GitHub-Api-Version': '2025-04-01',
        }

    # ------------------------------------------------------------- exchange

    def _exchange(self, raw_token: str) -> SessionToken:
        headers = self._exchange_headers(raw_token)
        try:
            with httpx.Client(
                transport=self._transport, timeout=self.timeout,
            ) as client:
                response = client.get(self.exchange_url, headers=headers)
        except httpx.HTTPError:
            logger.warning('Copilot token exchange that bai (loi mang)')
            raise CopilotTokenExchangeError(_MESSAGE_NETWORK)

        status = response.status_code
        if status == 404:
            # Bẫy 1: PAT thuong, hoac sai OAuth client_id.
            logger.warning('Copilot token exchange 404 (token raw khong doi duoc session token)')
            raise CopilotTokenExchangeError(_MESSAGE_PAT, status=status)
        if status in (401, 403):
            logger.warning('Copilot token exchange %s', status)
            raise CopilotTokenExchangeError(
                'GitHub từ chối token Copilot (HTTP {status}). Token có thể đã hết hạn '
                'hoặc thiếu quyền Copilot. Kiểm tra lại token ghu_ của bạn.'.format(status=status),
                status=status,
            )
        if status >= 400:
            logger.warning('Copilot token exchange HTTP %s', status)
            raise CopilotTokenExchangeError(
                'GitHub từ chối đổi token Copilot (HTTP {status}).'.format(status=status),
                status=status,
            )

        try:
            payload = response.json()
        except ValueError:
            raise CopilotTokenExchangeError(_MESSAGE_MALFORMED, status=status)
        token = str((payload or {}).get('token') or '').strip()
        endpoints = (payload or {}).get('endpoints') or {}
        base_url = str(endpoints.get('api') or '').strip().rstrip('/')
        if not token or not base_url:
            raise CopilotTokenExchangeError(_MESSAGE_MALFORMED, status=status)
        try:
            expires_in = float((payload or {}).get('expires_in') or 0)
        except (TypeError, ValueError):
            expires_in = 0.0
        if expires_in <= 0:
            raise CopilotTokenExchangeError(_MESSAGE_MALFORMED, status=status)
        return SessionToken(
            token=token,
            base_url=self.api_base_override or base_url,
            expires_at=self._now_fn() + expires_in,
        )

    # ----------------------------------------------------------------- API

    def get_session(self, raw_token: str) -> SessionToken:
        """Session token hop le, refresh truoc kin het han.

        `threading.Lock` giữ quanh ca doi token: 10 request dong thoi chi **1**
        request len GitHub (AC4). Double-check cache sau khoa nen thread thu hai
        khong doi lai.
        """
        raw_token = (raw_token or '').strip()
        if not raw_token:
            raise ValueError('Thiếu token Copilot (không được để trống).')
        key = _cache_key(raw_token)

        with self._cache_lock:
            cached = self._cache.get(key)
            if cached is not None and not cached.needs_refresh(self._now_fn(), self.refresh_margin):
                return cached

        with self._exchange_lock(key):
            with self._cache_lock:
                cached = self._cache.get(key)
                if cached is not None and not cached.needs_refresh(
                    self._now_fn(), self.refresh_margin,
                ):
                    return cached
            fresh = self._exchange(raw_token)
            with self._cache_lock:
                self._cache[key] = fresh
            return fresh

    def force_refresh(self, raw_token: str) -> SessionToken:
        """Xoá entry cache roi doi lai - dung khi provider tra 401 giua chung (AC12)."""
        key = _cache_key((raw_token or '').strip())
        with self._cache_lock:
            self._cache.pop(key, None)
        return self.get_session(raw_token)

    @classmethod
    def _exchange_lock(cls, key: str) -> threading.Lock:
        """Lock **riêng theo key** - token user A khong chan token user B."""
        with cls._cache_lock:
            lock = cls._exchange_locks.get(key)
            if lock is None:
                lock = threading.Lock()
                cls._exchange_locks[key] = lock
        return lock