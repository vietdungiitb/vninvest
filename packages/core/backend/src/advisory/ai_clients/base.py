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

R2.9 bổ sung: `RetryPolicy` + `AiClient.complete_resilient()` (retry + backoff +
circuit breaker + deadline). `complete()` giữ là **primitive một lần** — nhờ vậy 3
sub-agent `asyncio.gather` **dùng chung** một client nên retry/breaker không nhân 3.
"""
import asyncio
import logging
import threading
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from django.conf import settings as django_settings

from advisory.health import (
    DEFAULT_FAILURE_THRESHOLD,
    ERROR_PROVIDER_CIRCUIT_OPEN,
    CircuitBreaker,
)

logger = logging.getLogger(__name__)

#: Breaker theo provider (xem `AiClient.breaker`) — process-level, có lock.
_BREAKERS: dict = {}
_BREAKERS_LOCK = threading.Lock()


def reset_circuit_breakers() -> int:
    """Xoá mọi breaker đang lưu (test + đóng sau khi sự cố provider hết).

    Trả số breaker bị xoá.
    """
    with _BREAKERS_LOCK:
        count = len(_BREAKERS)
        _BREAKERS.clear()
    return count


def get_circuit_breaker(key, *, failure_threshold: int, cooldown_seconds: float) -> CircuitBreaker:
    with _BREAKERS_LOCK:
        breaker = _BREAKERS.get(key)
        if breaker is None:
            breaker = CircuitBreaker(
                failure_threshold=failure_threshold,
                cooldown_seconds=cooldown_seconds,
                name=key[0],
            )
            _BREAKERS[key] = breaker
        return breaker

#: Chỉ retry lỗi **tạm thời**. 401/403/400 là lỗi cấu hình/tín dụng — retry chỉ
#: đốt hạn mức rồi vẫn hỏng (R2.9 AC2).
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504, 529})


class FactoryError(ValueError):
    """Provider chưa có client (chưa cấu hình / chưa implement). Loud, không rơi im lặng."""


class ProviderHTTPError(Exception):
    """HTTP error từ provider, giữ status + body để caller map mã lỗi."""

    def __init__(self, status: int | None, body: str = "", response: Any = None):
        self.status_code = status
        self.body_text = body or ""
        # Response httpx gốc (có headers Retry-After) — None khi lỗi mạng.
        self.response = response
        super().__init__(f"provider_http_{status or 'unknown'}: {self.body_text[:200]}")


class ProviderCircuitOpenError(ProviderHTTPError):
    """Breaker đang mở — KHÔNG gọi provider, trả `provider_circuit_open` (R2.9 AC4)."""

    error_code = ERROR_PROVIDER_CIRCUIT_OPEN
    status_code = None

    def __init__(self, body: str = ''):
        super().__init__(None, body=body or 'circuit breaker dang mo')
        self.status_code = None

    def __str__(self) -> str:
        return f'{self.error_code}: {self.body_text}'


def is_retryable_error(error: BaseException) -> bool:
    """Lỗi nào đáng retry: lỗi mạng + status tạm thời. KHÔNG retry lỗi cấu hình."""
    if isinstance(error, ProviderCircuitOpenError):
        return False
    if isinstance(error, ProviderHTTPError):
        return error.status_code in RETRYABLE_STATUS
    import httpx

    return isinstance(error, (httpx.TimeoutException, httpx.NetworkError))


def parse_retry_after(response: Any) -> float | None:
    """`Retry-After` giây (nếu có). Không parse được => None (dùng backoff luỹ thừa).

    Bằng chứng: Gemini **không** gửi `Retry-After` khi 429 hạn mức (probe
    2026-09-26) — nên phải có backoff tăng dần khi thiếu header.

    Nhận cả response httpx (có `.headers`) lẫn mapping thẳng — gọi chỗ nào cũng được.
    """
    headers = getattr(response, 'headers', None)
    if headers is None and isinstance(response, dict):
        headers = response
    if not headers:
        return None
    raw = headers.get('retry-after') or headers.get('Retry-After')
    if raw is None:
        return None
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError):
        return None
    return value if value >= 0 else None


@dataclass
class RetryPolicy:
    """Tham số retry/breaker. Nguồn: `AIDeployment` > settings > mặc định."""

    num_retries: int = 2
    backoff_base_ms: float = 500.0
    cooldown_seconds: float = 30.0
    deadline_seconds: float = 120.0
    failure_threshold: int = DEFAULT_FAILURE_THRESHOLD

    def __post_init__(self):
        self.num_retries = max(int(self.num_retries), 0)
        self.backoff_base_ms = max(float(self.backoff_base_ms), 0.0)
        self.cooldown_seconds = max(float(self.cooldown_seconds), 0.0)
        self.deadline_seconds = max(float(self.deadline_seconds), 0.0)
        self.failure_threshold = max(int(self.failure_threshold), 1)

    def delay_seconds(self, attempt: int, response: Any = None) -> float:
        """Lần thứ `attempt` (1-based): tôn trọng `Retry-After`, không thì luỹ thừa."""
        retry_after = parse_retry_after(response)
        if retry_after is not None:
            return retry_after
        return (self.backoff_base_ms * (2 ** max(attempt - 1, 0))) / 1000.0

    @classmethod
    def from_settings(cls) -> 'RetryPolicy':
        return cls(
            num_retries=getattr(django_settings, 'AI_PROVIDER_NUM_RETRIES', 2),
            backoff_base_ms=getattr(django_settings, 'AI_PROVIDER_BACKOFF_BASE_MS', 500),
            cooldown_seconds=getattr(django_settings, 'AI_PROVIDER_COOLDOWN_SECONDS', 30),
            deadline_seconds=getattr(django_settings, 'AI_ADVISORY_DEADLINE_SECONDS', 120),
            failure_threshold=getattr(django_settings, 'AI_PROVIDER_FAILURE_THRESHOLD',
                                      DEFAULT_FAILURE_THRESHOLD),
        )

    @classmethod
    def from_deployment(cls, deployment=None) -> 'RetryPolicy':
        """R2.9: mỗi deployment có thể đặt riêng; thiếu thì lấy settings."""
        policy = cls.from_settings()
        if deployment is None:
            return policy
        for field in ('num_retries', 'backoff_base_ms', 'cooldown_seconds'):
            value = getattr(deployment, field, None)
            if value is not None:
                setattr(policy, field, value)
        policy.__post_init__()
        return policy


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
        timeout: float | None = None,
        response_format: str | None = None,
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

    async def catalog(self) -> list | None:
        """Danh mục model provider trả (chuẩn R2.10); None = không hỗ trợ."""
        return None

    # ---------------------------------------------------- R2.9 retry/breaker

    def breaker(self, policy: RetryPolicy | None = None) -> CircuitBreaker:
        """Breaker **dùng chung theo provider**, không theo instance.

        3 sub-agent `asyncio.gather` cùng 1 client ⇒ 1 breaker. Tạo instance mới
        ở đây thì breaker sẽ bị nhân 3 và AC7 hỏng, nên lưu theo provider key.
        """
        policy = policy or RetryPolicy.from_settings()
        return get_circuit_breaker(
            (self.provider or self.__class__.__name__,
             policy.failure_threshold, policy.cooldown_seconds),
            failure_threshold=policy.failure_threshold,
            cooldown_seconds=policy.cooldown_seconds,
        )

    async def complete_resilient(
        self,
        system: str,
        user: str,
        *,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: float | None = None,
        response_format: str | None = None,
        policy: RetryPolicy | None = None,
        breaker: CircuitBreaker | None = None,
        sleep: Callable[[float], Any] | None = None,
        clock: Callable[[], float] | None = None,
    ) -> dict:
        """`complete()` + retry/backoff + circuit breaker + deadline (R2.9).

        - Chỉ retry lỗi tạm thời (`is_retryable_error`): 401/403/400/lỗi cấu hình
          fail ngay, không đốt hạn mức.
        - Breaker mở ⇒ raise `ProviderCircuitOpenError` **không** gọi provider.
        - `clock`/`sleep` injectable để test dùng đồng hồ giả (AC3/AC6).
        """
        policy = policy or RetryPolicy.from_settings()
        breaker = breaker if breaker is not None else self.breaker(policy)
        sleep_fn = sleep or asyncio.sleep
        clock_fn = clock or time.monotonic
        started = clock_fn()

        last_error: BaseException | None = None
        for attempt in range(1, policy.num_retries + 2):
            if not breaker.allow():
                raise ProviderCircuitOpenError(
                    f'provider {self.provider!r} đang trong circuit open'
                )
            try:
                result = await self.complete(
                    system, user, model=model, temperature=temperature,
                    max_tokens=max_tokens, timeout=timeout,
                    response_format=response_format,
                )
            except BaseException as exc:
                last_error = exc
                if not is_retryable_error(exc):
                    breaker.record_failure()
                    raise
                if attempt > policy.num_retries:
                    breaker.record_failure()
                    raise
                delay = policy.delay_seconds(attempt, getattr(exc, 'response', None))
                if policy.deadline_seconds and (
                    clock_fn() - started + delay > policy.deadline_seconds
                ):
                    logger.warning(
                        'Bo qua retry %d: vuot deadline %.1fs', attempt, policy.deadline_seconds,
                    )
                    breaker.record_failure()
                    raise
                logger.warning(
                    'provider %s loi tam thoi (attempt %d/%d); cho %.2fs',
                    self.provider, attempt, policy.num_retries, delay,
                )
                breaker.record_failure()
                await sleep_fn(delay)
                continue
            breaker.record_success()
            return result

        # Vòng lặp chỉ thoát bằng return/raise ở trên.
        raise last_error if last_error else ProviderHTTPError(None, 'khong co ket qua')
