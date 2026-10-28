"""
Envelope `{data, meta}` cho app `user_workspace` — **điểm vào duy nhất**.

Bản sao nguyên tắc từ `identity_access/envelope.py` (app mẫu, commit
`02d8b25f1`) và `service_ops/envelope.py` (commit `07d7be028`). Không import
chéo app khác: `identity_access` **không** được sửa trong phạm vi
B5-`user_workspace`, nên mỗi app giữ một helper riêng và cùng tuân theo một
hợp đồng.

## Vì sao app này đặc biệt dễ hỏng

`user_workspace` là app **tài chính** — nó giữ `PortfolioSummaryView` (NAV /
P&L) và `PortfolioHoldingsView` (giá vốn, giá thị trường). Trước B5 các
endpoint trả lẫn ít nhất 6 hình dạng cho cùng một việc:

  - list trần (`Response([])` ở `PortfolioHoldingsView.get`)
  - `{portfolio_id, curve: []}` dựng tay
  - `Serializer(...).data` (dict trần)
  - `paginator.get_paginated_response(...)` — `CoreCursorPagination` **không**
    override nên shape là `{next, previous, results}` (**không có** `count`)
  - `{count, results}` dựng tay ở nhánh fallback khi paginator trả `None`
  - `{results, total, limit, offset}` tự phân trang

Không test nào bắt được sự lẫn lộn đó vì mỗi endpoint có test riêng và test chỉ
so với chính hình dạng cũ. Đó là lý do `check-envelope-contract.py` ra đời.

## `meta` tối thiểu — không bịa giá trị

`meta` chỉ mang **provenance đã có sẵn**. App này có đúng hai payload vốn đã
đính kèm provenance và ta **chuyển nó lên** `meta` thay vì để lại bên trong
`data` (xem `PortfolioSummaryView` — `build_meta(ledger)`; và
`PortfolioWhaleAnalyticsView` — `{data_state, degraded_mode, is_stale,
stale_reason}`). Endpoint nào không có provenance thì để `{}`. Không điền
số đo được, không điền timestamp lúc gọi — client không được tin vào thứ
không có nguồn.

## Phạm vi

Chỉ bọc **response 2xx**. Lỗi 4xx/5xx đi qua RFC 9457
(`vninvest_core.exceptions.core_api_exception_handler`) và **không** đụng — bọc
lỗi sẽ phá `test_problem_json.py`.

**Không** đụng logic kiểm tra dữ liệu. `PortfolioSummaryView` fail-closed theo
LED-03 R5 (thiếu `opening_balance` / giá / `CashFlow` backfill ⇒ `nav = null` +
`nav_reason`); bọc envelope ở đây **không** được đổi một điều kiện nào của
guard đó, và cũng không được biến `null` thành `0`.
"""
from rest_framework import status as http_status
from rest_framework.response import Response

__all__ = ['adopt_envelope', 'envelope', 'inner_payload', 'is_envelope', 'paginated_envelope']


def is_envelope(body) -> bool:
    """Đúng quy tắc FE (`adapters/core/envelope.js`): có **cả** `data` và `meta`
    mới là envelope.

    Định nghĩa **một lần** ở đây vì cả view lẫn test đều cần đúng một quy tắc:
    `PortfolioAnalyticsView` phải mở envelope của `PortfolioSummaryView` trước
    khi lồng vào `summary`, còn `tests/envelope.py` dùng lại hàm này. Hai bản
    sao ở hai module là hai nguồn sự thật — và `service_ops` đã từng có **hai**
    shape phân trang cùng lúc vì đúng lý do đó.
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
    cho `StandardPageNumberPagination`, hoặc `next`/`previous`/`results` cho
    `CoreCursorPagination` (cursor **không** có `count`). Giữ nguyên để client
    không mất `next`/`previous` để trang kế tiếp.

    Endpoint chỉ có mảng (không có `count`) truyền `{'results': [...]}`, đúng
    như `identity_access` đã làm.
    """
    return Response(
        {'data': page, 'meta': meta or {}},
        status=status or http_status.HTTP_200_OK,
    )


def adopt_envelope(response):
    """Trả về `response` nguyên trạng **nếu** nó đã là envelope.

    Idempotent: chạy hai lần cho cùng kết quả. Dùng ở chỗ view của app này
    **gọi view của app khác** rồi trả thẳng — `PortfolioAIAdvisory*View` gọi
    `advisory.views.AdvisoryLatestView` / `AdvisoryRefreshView`, thuộc app khác
    và **chưa** chắc đã bọc. Bọc phẳng thì endpoint này có **hai** shape cùng
    lúc (đúng lỗi mà `service_ops` từng mắc và không test nào bắt được), còn
    bỏ qua thì `PortfolioAIAdvisoryCanonicalView` vẫn phẳng trong khi
    `PortfolioAIAdvisoryListView` đã bọc.
    """
    data = getattr(response, 'data', None)
    if is_envelope(data):
        return response
    return envelope(data, status=getattr(response, 'status_code', None))


def inner_payload(body):
    """Mở envelope nếu có, giữ nguyên nếu không.

    Dùng ở chỗ view của app này **lồng** response của chính nó vào payload khác
    (`PortfolioAnalyticsView` đặt `PortfolioSummaryView` vào key `summary`).
    Không mở thì `summary` chứa envelope lồng envelope — client phải đào 2 tầng
    ở một endpoint mà mọi endpoint khác chỉ đào 1.
    """
    return body['data'] if is_envelope(body) else body