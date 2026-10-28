"""
Envelope `{data, meta}` cho app `signal_intelligence` — **điểm vào duy nhất**.

Bản sao nguyên tắc từ `identity_access/envelope.py` (app mẫu, commit
`02d8b25f1`) và `service_ops/envelope.py` (commit `07d7be028`). Không import
chéo app khác: mỗi app giữ một helper riêng và cùng tuân theo một hợp đồng.

## Vì sao app này đặc biệt dễ hỏng

`signal_intelligence` có **hai** kiểu endpoint trả 2xx:

  - `APIView` dựng tay (`AlertCenter*View`, `WhaleFeedAggregateView`)
  - `generics.ListAPIView` + cursor pagination (`AlertFeedBaseListView` tại `:345`,
    `OrderFlowEventListView` tại `:899`) — DRF **tự sinh** response

Trước B5 cả hai trả phẳng. Chỉ nhóm thứ nhất được bọc ở đợt này; nhóm thứ hai
xem mục "Phạm vi" bên dưới.

## Phạm vi: 7 call site, và 2 chỗ cố ý KHÔNG bọc

**Bọc (7):**

| file:line | view | family |
|---|---|---|
| `admin_views.py:35` | `SignalAdminStatsView` | F9_HAND_BUILT |
| `admin_views.py:61` | `SignalAdminFlushView` | F7_ACK (200, **không** phải lỗi) |
| `views.py:617` | `AlertCenterEventDetailView` | F8_SERIALIZER |
| `views.py:654` | `AlertCenterSymbolContextView` | F9_HAND_BUILT |
| `views.py:680` | `AlertCenterAcknowledgeView` | F8_SERIALIZER |
| `views.py:715` | `AlertCenterMutePreferenceView` | F9_HAND_BUILT |
| `views.py:956` | `WhaleFeedAggregateView` | F9_HAND_BUILT |

**KHÔNG bọc — 3 lý do, đều có chủ đích:**

**① `views.py:469` và `views.py:548` — family `UNKNOWN` trong CSV.**

Hai chỗ này **là** response 2xx thật (`Response(payload)` với payload dựng ở
`_build_summary_payload` / `_build_symbol_stats_payload`), đọc tay thì rõ.
Nhưng `docs/evidence/api02/map/callsites.csv` xếp chúng là `UNKNOWN` vì công cụ
đo không đọc được giá trị của biến `payload`, và hợp đồng B5 loại `UNKNOWN` khỏi
phạm vi. Bọc chúng ở đây sẽ **lệch** với CSV mà không ai duyệt — nên để nguyên
và ghi ra ticket: CSV cần sửa family của 2 dòng này thành `F9_HAND_BUILT`.

Hệ quả phải nói thẳng: app này **vẫn còn 2 endpoint 2xx trả phẳng** sau B5
(`/core/v1/signals/alert-center/summary`, `/core/v1/signals/alert-center/symbol-stats`
và bản `ai-alerts` của cả hai). Đây là nợ **có chủ đích**, không phải bỏ sót.

**② `AlertFeedBaseListView` / `OrderFlowEventListView` — `ListAPIView`.**

DRF dựng response trong `list()`, không có `return Response(...)` nào ⇒ không có
trong `callsites.csv` và gate không thấy ⇒ `F4_GENERATED`. Tiền lệ đã có:
`identity_access.PATListView` (`views_tenant.py:222`) cũng `ListAPIView` và **đã
được để nguyên** ở đợt B5 trước.

**③ `AlertCenterStreamView` (`:737`) — SSE.**

`@extend_schema(exclude=True)`, trả `StreamingHttpResponse`. Không có body JSON
để bọc.

## `meta` tối thiểu — không bịa giá trị

Hai payload có sẵn provenance và **đã được chuyển lên `meta`** thay vì để lại
bên trong `data`:

- `WhaleFeedAggregateView` (`:956`) — `symbol` là tham số lọc của chính request,
  không phải provenance ⇒ giữ trong `data`, không nhúc nhích.

Không endpoint nào của app này có `as_of` / `stale` / `calculation_version` /
`source` sẵn có, nên **`meta` để `{}` ở cả 7 chỗ**. Không điền số đo được,
không điền timestamp lúc gọi — client không được tin vào thứ không có nguồn.

## Phạm vi bọc: chỉ 2xx

Lỗi đi qua RFC 9457 (`vninvest_core.exceptions.core_api_exception_handler`).
App này **không** dựng response lỗi bằng tay mà ném `NotFoundErrorException` /
`ValidationErrorException`, nên không có nguy cơ bọc nhầm lỗi — nhưng
`SignalAdminFlushView` (`:61`) trả `{'detail': ...}` với **status 200**, tức là
ACK **thành công**, nên vẫn thuộc phạm vi bọc. Đừng nhầm `detail` với lỗi: ở đây
`status` mới quyết định.
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

    `page` là dict phân trang nguyên vẹn (`count`/`next`/`previous`/`results` cho
    `PageNumberPagination`, hoặc `next`/`previous`/`results` cho cursor).

    Hiện **chưa** call site nào của `signal_intelligence` gọi hàm này: hai
    endpoint danh sách (`AlertFeedBaseListView`, `OrderFlowEventListView`) để DRF
    tự phân trang. Có mặt để call site `get_paginated_response()` tương lai
    không phải phát minh lại từ đầu, và để hợp đồng của 4 app B5 giống nhau.
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