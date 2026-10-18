"""R4.3 — retention của `AIAuditLog` (append-only nhưng vẫn có thời hạn).

"Happend-only" nghĩa là **không sửa/xoá qua API** (AC1), không phải "giữ mãi
mãi". Giữ vĩnh viễn là điều không ai chịu nổi về mặt vận hành **và** về mặt pháp
lý: PIPL/ISO 27001 đều yêu cầu **giới hạn thời gian lưu** dữ liệu hành vi.
Vì vậy R4.3 đặt mặc định **365 ngày** và cho phép vận hành chỉnh qua
`AI_AUDIT_RETENTION_DAYS`.

Hai ranh giới đã cố ý vạch:

- **Tách khỏi retention của `AITrace`** (90 ngày, R3.1). Hai bảng khác ý nghĩa
  thì không được dùng chung một ngưỡng — xoá nhầm audit log là mất dấu vết.
- **`days` không hợp lệ ⇒ KHÔNG xoá gì cả.** Xoá theo một ngưỡng vô nghĩa (0,
  âm, chuỗi rỗng từ env) tức là xoá **toàn bộ** bảng audit trong một lần chạy
  beat. Fail-closed ở đây nghĩa là "không làm gì" chứ không phải "xoá hết".
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

#: Fallback khi settings không khai (settings đã có, nhưng module này không phụ
#: thuộc cứng vào settings để test được trực tiếp).
DEFAULT_RETENTION_DAYS = 365


def resolve_retention_days(days=None) -> int | None:
    """Số ngày retention hợp lệ, hoặc `None` nếu input vô nghĩa."""
    if days is None:
        return DEFAULT_RETENTION_DAYS
    try:
        value = int(days)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return value


def purge_audit_logs_older_than(days=None) -> int | None:
    """Xoá log cũ hơn `days`. Trả số dòng đã xoá, hoặc `None` nếu bỏ qua.

    `auto_now_add` không cho sửa `created_at` qua `save()`, nên test và migration
    đều phải dùng queryset `.update(created_at=...)` — giống cách R3.1 làm với
    `AITrace`.
    """
    from advisory.models import AIAuditLog

    effective = resolve_retention_days(days)
    if effective is None:
        return None
    cutoff = timezone.now() - timedelta(days=effective)
    deleted, _details = AIAuditLog.objects.filter(created_at__lt=cutoff).delete()
    return deleted