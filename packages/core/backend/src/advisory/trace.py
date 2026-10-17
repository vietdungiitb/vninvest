"""R3.1 — ghi và dọn `AITrace` (4 bước mỗi advisory).

Hai quy tắc bất di bất dịch ở đây:

1. **KHÔNG lưu plaintext** (AC2 / PIPL 13/2023): chỉ SHA-256 của prompt/response.
2. **Trace lỗi KHÔNG được làm hỏng advisory** — `record_step_trace` nuốt mọi lỗi và
   chỉ log. Mất trace thì mất khả năng quan sát; làm sập advisory thì mất cả luồng.
"""
import hashlib
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

#: Retention AC6 — dữ liệu vận hành, không phải bản ghi kế toán.
TRACE_RETENTION_DAYS = 90


def sha256_hex(text) -> str:
    """SHA-256 hex của nội dung. `None`/rỗng ⇒ chuỗi rỗng (không bịa hash)."""
    if not text:
        return ''
    if not isinstance(text, str):
        text = str(text)
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _text_of(payload):
    """Chỉ lấy phần **text** để hash — không đụng `raw` (chứa cả prompt server trả về)."""
    if isinstance(payload, dict):
        return payload.get('text') or ''
    return ''


def record_step_trace(
    trace_ctx,
    step: str,
    *,
    provider: str = '',
    model: str = '',
    prompt='',
    response='',
    tokens_in=0,
    tokens_out=0,
    latency_ms=0,
    status: str = 'ok',
    error_code: str = '',
    routing_decision=None,
):
    """Ghi 1 dòng `AITrace`. Trả về row, hoặc `None` nếu không có ctx / ghi lỗi.

    `trace_ctx` do `advisory.tasks` dựng từ `AdvisoryRecord` (trace_id · advisory_id ·
    user_id · symbol · session_date). Thiếu ctx ⇒ **không** ghi, **không** ném lỗi:
    đường gọi cũ (test, script) không có trace vẫn chạy bình thường.
    """
    if not trace_ctx:
        return None
    try:
        from advisory.models import AITrace

        advisory_id = trace_ctx.get('advisory_id')
        user_id = trace_ctx.get('user_id')
        if not advisory_id or not user_id:
            logger.warning('trace bo qua: thieu advisory_id/user_id cho step=%s', step)
            return None

        usage = response.get('usage') or {} if isinstance(response, dict) else {}

        return AITrace.objects.create(
            trace_id=trace_ctx.get('trace_id') or None,
            advisory_id=advisory_id,
            user_id=user_id,
            symbol=(trace_ctx.get('symbol') or '')[:32],
            session_date=trace_ctx.get('session_date') or timezone.now().date(),
            step=step,
            provider=(provider or '')[:32],
            model=(model or '')[:64],
            prompt_hash=sha256_hex(prompt),
            response_hash=sha256_hex(
                response if isinstance(response, str) else _text_of(response)),
            tokens_in=int(tokens_in or usage.get('input') or 0),
            tokens_out=int(tokens_out or usage.get('output') or 0),
            latency_ms=max(0, int(latency_ms or 0)),
            status=status or AITrace.Status.OK,
            error_code=(error_code or '')[:64],
            routing_decision=routing_decision or {},
        )
    except Exception:  # trace lỗi KHÔNG chặn advisory
        logger.exception('ghi AITrace that bai (step=%s) — bo qua', step)
        return None


def purge_traces_older_than(days: int = TRACE_RETENTION_DAYS) -> int:
    """Xoá trace cũ hơn `days` ngày (AC6). Trả số dòng đã xoá."""
    from datetime import timedelta

    from advisory.models import AITrace

    cutoff = timezone.now() - timedelta(days=int(days))
    deleted, _ = AITrace.objects.filter(created_at__lt=cutoff).delete()
    logger.info('purge AITrace <%s ngay: %s dong', days, deleted)
    return deleted