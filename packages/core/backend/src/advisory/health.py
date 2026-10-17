"""R2.9 - circuit breaker theo provider.

Ba trang thai: `closed` (bình thường) → `open` (N lỗi liên tiếp ⇒ **không** gọi
provider nữa, trả `provider_circuit_open`) → `half_open` (sau `cooldown_seconds`
thì cho thử 1 lần; thành công ⇒ đóng, thất bại ⇒ mở lại).

Vì sao breaker là thứ **chặn 9 request**: 3 sub-agent chạy song song, mỗi agent
retry 3 lần với provider luôn trả `429` ⇒ 9 request với 1 API key. Breaker dùng
chung cho cả client nên chặn ở mức provider, không nhân theo agent (R2.9 AC7).

Clock mặc định `time.monotonic` (đổi múi giờ hệ thống không mở breaker oan);
test truyền `now_fn` để dùng đồng hồ giả.
"""

from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)

STATE_CLOSED = 'closed'
STATE_OPEN = 'open'
STATE_HALF_OPEN = 'half_open'

ERROR_PROVIDER_CIRCUIT_OPEN = 'provider_circuit_open'

DEFAULT_FAILURE_THRESHOLD = 3
DEFAULT_COOLDOWN_SECONDS = 30.0


class CircuitBreaker:
    """Nút chặn gọi provider khi lỗi liên tiếp. Thread-safe."""

    def __init__(
        self,
        *,
        failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
        cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS,
        now_fn=time.monotonic,
        name: str = '',
    ):
        self.failure_threshold = max(int(failure_threshold), 1)
        self.cooldown_seconds = max(float(cooldown_seconds), 0.0)
        self._now_fn = now_fn
        self.name = name
        self._lock = threading.Lock()
        self._failures = 0
        self._opened_at = None

    def state(self) -> str:
        with self._lock:
            if self._opened_at is None:
                return STATE_CLOSED
            elapsed = self._now_fn() - self._opened_at
            return STATE_HALF_OPEN if elapsed >= self.cooldown_seconds else STATE_OPEN

    def allow(self) -> bool:
        """True = được gọi provider. False = breaker đang mở."""
        return self.state() != STATE_OPEN

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None

    def record_failure(self) -> None:
        """Ghi 1 lần thất bại. Mở breaker khi chạm ngưỡng liên tiếp."""
        with self._lock:
            self._failures += 1
            # Đang mở (hoặc half_open) mà lại thất bại => MỞ LẠI với cooldown mới,
            # nếu không breaker sẽ kẹt ở half_open vĩnh viễn và cứ thử lại mãi.
            if self._opened_at is not None or self._failures >= self.failure_threshold:
                self._opened_at = self._now_fn()
                logger.warning(
                    'Circuit breaker MO cho %s sau %d loi lien tiep (cooldown %.1fs)',
                    self.name or 'provider', self._failures, self.cooldown_seconds,
                )

    def reset(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None

    def snapshot(self) -> dict:
        """Cho endpoint health (R2.6) — không chứa bí mật."""
        with self._lock:
            return {
                'name': self.name,
                'state': self.state(),
                'consecutive_failures': self._failures,
                'cooldown_seconds': self.cooldown_seconds,
                'failure_threshold': self.failure_threshold,
                'opened_at': self._opened_at,
            }