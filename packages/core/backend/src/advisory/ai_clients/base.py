"""
R2.2: client hạ tầng chung cho mọi AI provider.

- `AiClient`: interface duy nhất (complete / probe / catalog).
- `ProviderHTTPError`: lỗi HTTP từ provider (status + body), orchestrator map
  sang mã lỗi hành động (giữ nguyên mọi thông điệp R0.x).
- `parse_usage_dict`: chuẩn usage OpenAI-shape -> (in, out, unavailable).
  Canonical ở đây; `advisory.orchestrator._extract_usage` là alias giữ tương
  thích cho test R0.7 (`from advisory.orchestrator import _extract_usage`).
- KHÔNG retry ở đây (orchestrator giữ vòng retry hiện tại để không đổi hành vi;
  R2.9 mới đưa retry/backoff vào tầng client).
"""
from abc import ABC, abstractmethod
from typing import Any, Optional


class FactoryError(ValueError):
    """Provider chưa có client (chưa cấu hình / chưa implement). Loud, không rơi im lặng."""


class ProviderHTTPError(Exception):
    """HTTP error từ provider, giữ status + body để caller map mã lỗi."""

    def __init__(self, status: Optional[int], body: str = "", response: Any = None):
        self.status_code = status
        self.body_text = body or ""
        # Response httpx gốc (có headers Retry-After) — None khi lỗi mạng.
        self.response = response
        super().__init__(f"provider_http_{status or 'unknown'}: {self.body_text[:200]}")


def parse_usage_dict(usage: Any) -> tuple:
    """(tokens_in, tokens_out, usage_unavailable) từ usage dict THẬT.

    R0.7 AC9: đọc `prompt_tokens`/`completion_tokens` thật. Thiếu hoặc không
    parse được => (0, 0, True), KHÔNG bịa số liệu.
    """
    if not isinstance(usage, dict):
        return 0, 0, True
    try:
        prompt = int(usage.get('prompt_tokens') or 0)
    except (TypeError, ValueError):
        prompt = 0
    try:
        completion = int(usage.get('completion_tokens') or 0)
    except (TypeError, ValueError):
        completion = 0
    if prompt <= 0 and completion <= 0:
        return 0, 0, True
    return max(prompt, 0), max(completion, 0), False


class AiClient(ABC):
    """Interface chuẩn mọi provider (R2.2). Thêm provider mới = thêm 1 file
    đăng ký trong registry, KHÔNG sửa orchestrator (AC6)."""

    provider: str = ""

    def __init__(
        self,
        *,
        api_key: str = "",
        base_url: str = "",
        endpoint: str = "",
        timeout: float = 30.0,
        model: str = "",
    ):
        self.api_key = api_key or ""
        self.base_url = (base_url or "").rstrip("/")
        self.endpoint = (endpoint or "").strip()
        self.timeout = timeout
        self.model = model or ""

    @abstractmethod
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
        """Một lượt gọi duy nhất (không retry). Trả:
        {'text': str, 'usage': {'input': int, 'output': int} | None, 'raw': dict,
         'finish_reason': str | None}.
        `usage=None` khi provider không trả usage — KHÔNG bịa 0 (AC2/R0.7-AC9).
        Lỗi HTTP => raise ProviderHTTPError (caller map + retry như cũ).
        """
        raise NotImplementedError

    async def probe(self) -> dict:
        """Kiểm tra sống: {'ok': bool, 'latency_ms': int, 'error_code': str, 'detail': str}."""
        return {'ok': False, 'latency_ms': 0, 'error_code': 'probe_not_implemented', 'detail': ''}

    async def catalog(self) -> Optional[list]:
        """Danh mục model provider trả (chuẩn R2.10); None = không hỗ trợ."""
        return None
