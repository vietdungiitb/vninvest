"""Idempotency guard cho thao tác đặt lệnh, dựa trên Django `cache`.

Vì sao là `cache` chứ không phải model:
- Wave PA-1 **không tạo migration** (`*/migrations/*` đang bị agent khác claim),
  nên không thêm model `OrderJob` có unique constraint thật.
- `cache` đủ để chặn double-click / retry của cùng một client trong 7 ngày.

Giới hạn đã biết, nói thẳng:
- Production dùng Redis (`settings.py:413`), `cache.add` atomic ⇒ chống được
  race thật giữa nhiều process.
- `TESTING` đổi sang `LocMemCache` (`settings.py:438`) ⇒ `add` atomic **trong
  một process**. Ở môi trường multi-process dùng LocMemCache, hai worker có
  thể cùng claim một key. Đây là lý do đây chỉ là lớp phòng thủ best-effort;
  wave sau thay bằng `OrderJob` với `unique (user, scope, key)`.

Ranh giới trách nhiệm:
- `claim()` trả về trạng thái, KHÔNG tự quyết định gọi broker hay không —
  caller kiểm tra `acquired` / `replay` / `conflict` / `in_progress`.
- `store_result()` chỉ ghi đè khi fingerprint khớp, nên một request thất bại
  không thể ghi kết quả của request khác vào cùng key.
- `release()` nhả key khi thao tác thất bại, để client retry được.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.core.cache import cache

#: Giữ key 7 ngày — đủ để bắt retry chậm và cả client bị cache giữa hai lần mở app.
IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 3600

_STATE_IN_PROGRESS = 'in_progress'
_STATE_COMPLETED = 'completed'


class IdempotencyKeyError(ValueError):
    """`Idempotency-Key` thiếu hoặc chỉ gồm khoảng trắng."""


@dataclass(frozen=True)
class Claim:
    """Kết quả claim. Đúng một trong `acquired` / `replay` / `conflict` / `in_progress` là True."""

    acquired: bool
    replay: bool = False
    conflict: bool = False
    in_progress: bool = False
    result: Any = None


def _cache_key(user_id, scope: str, key: str) -> str:
    return f'idemp:{scope}:{user_id}:{key}'


def _normalize_key(key) -> str:
    if key is None:
        raise IdempotencyKeyError('Thiếu Idempotency-Key.')
    normalized = str(key).strip()
    if not normalized:
        raise IdempotencyKeyError('Idempotency-Key không được rỗng.')
    return normalized


def claim(*, user_id, scope: str, key, fingerprint: str) -> Claim:
    """Giữ key cho user + scope này, hoặc báo trạng thái của request đang giữ nó.

    `cache.add` chỉ trả True cho đúng một lần gọi ⇒ chỉ một request được quyền
    thực thi. Lần gọi sau thấy `in_progress` hoặc `completed`.
    """
    normalized = _normalize_key(key)
    ck = _cache_key(user_id, scope, normalized)
    ttl = IDEMPOTENCY_TTL_SECONDS

    if cache.add(ck, {'state': _STATE_IN_PROGRESS, 'fingerprint': fingerprint}, ttl):
        return Claim(acquired=True)

    record = cache.get(ck)
    if record is None:
        # Key vừa hết hạn giữa `add` và `get` — thử giành lại đúng một lần.
        if cache.add(ck, {'state': _STATE_IN_PROGRESS, 'fingerprint': fingerprint}, ttl):
            return Claim(acquired=True)
        record = cache.get(ck) or {}

    if record.get('fingerprint') != fingerprint:
        # Cùng key, payload khác ⇒ client bug hoặc cố ý tái sử dụng key.
        return Claim(acquired=False, conflict=True)

    if record.get('state') == _STATE_COMPLETED:
        return Claim(acquired=False, replay=True, result=record.get('result'))

    return Claim(acquired=False, in_progress=True)


def store_result(*, user_id, scope: str, key, fingerprint: str, result: Any) -> bool:
    """Ghi kết quả để các lần gọi sau trả lại y hệt. Trả `False` nếu key đã lệch."""
    normalized = _normalize_key(key)
    ck = _cache_key(user_id, scope, normalized)
    record = cache.get(ck) or {}
    if record.get('fingerprint') != fingerprint or record.get('state') != _STATE_IN_PROGRESS:
        return False
    cache.set(
        ck,
        {'state': _STATE_COMPLETED, 'fingerprint': fingerprint, 'result': result},
        IDEMPOTENCY_TTL_SECONDS,
    )
    return True


def release(*, user_id, scope: str, key) -> None:
    """Nhả key khi thao tác thất bại, để client retry được với cùng key."""
    try:
        normalized = _normalize_key(key)
    except IdempotencyKeyError:
        return
    cache.delete(_cache_key(user_id, scope, normalized))
