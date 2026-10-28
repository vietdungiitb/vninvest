"""
Envelope `{data, meta}` cho app `ops_audit` — **điểm vào duy nhất**.

Bản sao nguyên tắc từ `identity_access/envelope.py` (app mẫu, commit
`02d8b25f1`) và `service_ops/envelope.py` (commit `07d7be028`). Không import
chéo app khác: mỗi app giữ một helper riêng và cùng tuân theo một hợp đồng.

## Vì sao app này đặc biệt dễ hỏng

`ops_audit` nhỏ, nhưng có **hai** loại endpoint trả 2xx:

  - `views_parity.py` — dựng tay `{phase_status, day1, day2, ...}` (4 chỗ)
  - `views.py` — `generics.ListAPIView` + `AuditCursorPagination` /
    `CoreCursorPagination`, tức **DRF tự sinh** `{next, previous, results}`

Hai loại trước đây trả **phẳng** cả hai, không chỗ nào sửa hết một lượt.

## Phạm vi: chỉ 4 call site trong `views_parity.py`

`views.py` **không** đụng, và đây là quyết định có chủ đích chứ không phải bỏ sót:

`ListAPIView` không có `return Response(...)` nào — response do `DRF` dựng trong
`list()`. Nó **không** xuất hiện trong `docs/evidence/api02/map/callsites.csv`
(csv chỉ ghi call site `return Response(...)` / `get_paginated_response()`), và
`scripts/check-envelope-contract.py` cũng không thấy — nên nó là **F4_GENERATED**
theo đúng định nghĩa trong danh sách "không bọc".

Tiền lệ đã có: `identity_access.PATListView` (`views_tenant.py:222`) cũng là
`ListAPIView` + `CoreCursorPagination` và **đã được để nguyên** ở đợt B5 trước.
Bọc riêng hai chỗ đó sẽ tạo ra chính xác loại lệch hợp đồng mà `service_ops`
từng mắc: `views.py` phẳng còn `views_parity.py` bọc, trong **cùng một app**.

Muốn đóng nốt thì phải sửa `pagination.py` / thêm mixin ở tầng `vninvest_core`
— việc đó chạm app ngoài phạm vi B5-`ops_audit` nên để ticket riêng.

## `meta` tối thiểu — không bịa giá trị

Cả 4 call site ở `views_parity.py` là báo cáo shadow-run đọc thẳng từ
`ParityPhaseCheckpoint` / `ParityReport`; không có trường provenance sẵn có
(`as_of` / `stale` / `calculation_version` / `source`) nên `meta` để `{}`.
Không điền số đo được, không điền timestamp lúc gọi — client không được tin vào
thứ không có nguồn.

## Phạm vi bọc

Chỉ bọc **response 2xx**. Ba response lỗi trong `views_parity.py` (`:248` 404,
`:253`/`:259` 400 — tất cả `{error: ...}`) đi qua RFC 9457
(`vninvest_core.exceptions.core_api_exception_handler`) và **không** đụng.
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

    `page` là dict phân trang nguyên vẹn (`count` / `next` / `previous` /
    `results`) — giữ nguyên để client không mất `next`/`previous` để trang
    kế tiếp.

    Hiện **chưa** call site nào của `ops_audit` gọi hàm này (`views.py` để DRF
    tự phân trang). Có mặt để call site `get_paginated_response()` tương lai
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
