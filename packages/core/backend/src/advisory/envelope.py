"""
Envelope `{data, meta}` cho app `advisory` — **điểm vào duy nhất**.

Bản sao nguyên tắc từ `identity_access/envelope.py` (app mẫu, commit
`02d8b25f1`) và `service_ops/envelope.py` (commit `07d7be028`). Không import
chéo app khác: `identity_access` **không** được sửa trong phạm vi B5-`advisory`,
nên mỗi app giữ một helper riêng và cùng tuân theo một hợp đồng.

## Vì sao app này đặc biệt dễ hỏng — 3 lý do, đều đã xảy ra thật

**① View của app này được app khác gọi trực tiếp.**

`market_data/stock_mgmt_native_views.py` có **2** chỗ gọi
`AdvisoryRefreshView.as_view()(...)`:

    StockManagementAIAdvisorySessionView.post
    StockManagementAIAdvisoryComponentsGenerateView.post

Chỗ thứ 3 trước đây (`_ensure_advisory_record_for_symbol`, 0 caller) đọc thẳng
`.data.get('advisory_id')` nên **đã bị xoá** 2026-10-02 — bọc ở đây làm nó im
lặng rơi về record của phiên khác.

Cả hai chỗ **live** đọc `refresh_response.data` qua
`market_data.stock_mgmt_native_views._advisory_field`, hàm **cố ý đọc được cả
hai** hình dạng (`_advisory_field` tại `:2317`) — nhưng nó chỉ an toàn vì hàm đó
tồn tại. Bọc ở đây mà quên phần này thì `advisory_id` ra `None`, mà `None` lại
**kích hoạt fallback âm thầm** sang record của phiên khác (xem `_resolve_refreshed_advisory`
tại `:2341` và `AGENTS.md` Entry 231). Vì vậy **không** được đổi tên/shape payload
mà không sửa cả hai phía.

**② Endpoint phân trang có HAI nhánh trả hai hình dạng.**

`AdvisoryHistoryView.get` (`:652`):

    :667  return paginator.get_paginated_response(serializer.data)
            -> {next, previous, results}   (CoreCursorPagination, KHONG co count)
    :670  return Response({'results': serializer.data})   <- fallback

Nhánh fallback chỉ chạy khi `paginate_queryset` trả `None`. Chỉ bọc một nhánh
thì endpoint có **hai** shape cùng lúc — đúng lỗi `service_ops` từng mắc và
không test nào bắt được. **Hai nhánh phải bọc giống nhau.**

**③ `AdvisoryStatusView.get` (`:227`) là F4 — cố ý KHÔNG bọc.**

Payload `{advisory_id, symbol, status, generated_at, error_message}` có
`generated_at` ⇒ theo tiêu chí F4 đã được máy kiểm trong
`scripts/check-envelope-contract.py`, nó **không** thuộc phạm vi đợt này.

## `meta` tối thiểu — không bịa giá trị

`meta` chỉ mang **provenance đã có sẵn**. Endpoint nào không có thì để `{}`.

`AdvisoryRefreshView.post` (`:637`) **có** provenance sẵn trong payload
(`response_data['budget']['quota']` có `period_start`/`period_end`), nhưng đó là
ngân sách token của user chứ không phải provenance của *response*, nên
**không** nhúc nhích — `meta` để `{}`. Điền số đo được, hoặc timestamp lúc gọi,
là bịa giá trị: client sẽ tin vào thứ không có nguồn.

## Phạm vi

Chỉ bọc **response 2xx**. Lỗi 4xx/5xx đi qua RFC 9457
(`vninvest_core.exceptions.core_api_exception_handler`) và **không** đụng — ở
app này có tới **8** response lỗi dựng tay (`{detail}` 404/400, 403, 402, 409,
429 với `retry_after_seconds`).
"""
from rest_framework import status as http_status
from rest_framework.response import Response

__all__ = ['adopt_envelope', 'envelope', 'is_envelope', 'paginated_envelope']


def is_envelope(body) -> bool:
    """Đúng quy tắc FE (`packages/web/src/adapters/core/envelope.js`) và giống
    `identity_access/tests/envelope.py`: có **cả** `data` và `meta` mới là
    envelope.

    Định nghĩa **một lần** ở đây vì cả view lẫn test đều cần đúng một quy tắc.
    Hai bản sao ở hai module là hai nguồn sự thật — và `service_ops` đã từng có
    **hai** shape phân trang cùng lúc vì đúng lý do đó.
    """
    return (
        isinstance(body, dict)
        and 'data' in body
        and 'meta' in body
    )


def envelope(data, meta=None, *, status=None, headers=None) -> Response:
    """Bọc payload 2xx thành `{data, meta}`.

    Args:
        data: payload thật của endpoint (dict hoặc list — kể cả list rỗng).
        meta: provenance. Mặc định `{}` — **không** bịa giá trị.
        status: chỉ truyền khi cần 201/202; mặc định 200 của DRF.
        headers: header bổ sung (ví dụ `Retry-After`).
    """
    return Response(
        {'data': data, 'meta': meta or {}},
        status=status,
        headers=headers,
    )


def paginated_envelope(page, meta=None, *, status=None) -> Response:
    """Bọc **cả khối phân trang**, không nhét `results` ra ngoài.

    `page` là dict phân trang nguyên vẹn — `count`/`next`/`previous`/`results`
    cho `PageNumberPagination`, hoặc `next`/`previous`/`results` cho
    `CoreCursorPagination` (cursor **không** có `count`). Giữ nguyên để client
    không mất `next`/`previous` để trang kế tiếp.

    `AdvisoryHistoryView` dùng `AdvisoryRecordCursorPagination` (cursor) nên
    payload của nó là `{next, previous, results}` — hàm này giữ nguyên cả ba,
    **không** tự thêm `count` vì client không có `count` để đối chiếu.
    """
    return Response(
        {'data': page, 'meta': meta or {}},
        status=status or http_status.HTTP_200_OK,
    )


def adopt_envelope(response):
    """Trả về `response` nguyên trạng **nếu** nó đã là envelope.

    Idempotent: chạy hai lần cho cùng kết quả. Dùng ở chỗ không chắc payload đã
    được bọc hay chưa — để không bao giờ sinh ra endpoint có **hai** shape cùng
    lúc (đúng lỗi mà `service_ops` từng mắc và không test nào bắt được).
    """
    data = getattr(response, 'data', None)
    if is_envelope(data):
        return response
    return envelope(data, status=getattr(response, 'status_code', None))