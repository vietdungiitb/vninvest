"""
Envelope `{data, meta}` cho app `service_ops` — **điểm vào duy nhất**.

Bản sao nguyên tắc từ `identity_access/envelope.py` (app mẫu, commit
`02d8b25f1`). Không import chéo app khác: `identity_access` **không** được
sửa trong phạm vi B5-`service_ops`, nên mỗi app giữ một helper riêng và cùng
tuân theo một hợp đồng.

## Vì sao app này đặc biệt dễ hỏng

`service_ops` là app SOC — **196 chỗ** trả `Response(...)` trong `views/`, trong
đó có **6** chỗ dùng `get_paginated_response` với **hai** lớp paginator khác
nhau (`StandardPageNumberPagination` từ `vninvest_core` và
`rest_framework.pagination.PageNumberPagination` cục bộ ở `views/scheduler.py`).
Trước B5 các endpoint trả lẫn:
  - payload phẳng (`{'services': [...], 'total': n}`)
  - DRF pagination (`{count, next, previous, results}`)
  - `Serializer(many=True).data` (list trần)
  - F4 `{object, generated_at, ...}` (scheduler/overview — **có hợp đồng riêng**)

Không test nào bắt được sự lẫn lộn đó vì mỗi endpoint có test riêng và test chỉ
so với chính hình dạng cũ. Đó là lý do `check-envelope-contract.py` ra đời.

## Vì sao helper trả về `Response`, không trả dict

DRF **bắt buộc** view trả `Response`; trả dict thì `finalize_response` ném
`AssertionError`. Nên helper trả thẳng `Response` để call site viết gọn:

    return envelope({'ok': True})     # thay vì Response({'data': ..., 'meta': {}})

Gate `scripts/check-envelope-contract.py` nhận đúng dạng này (`WRAPPED`), nhưng
**không** nhận `Response(envelope(x))` — dạng đó rơi vào `UNVERIFIED` và gate
không chứng minh được gì.

## `meta` tối thiểu — không bịa giá trị

`meta` chỉ mang **provenance đã có sẵn** (`as_of` / `stale` /
`calculation_version` / `source`). Endpoint nào không có provenance thì để
`{}`. Không điền số đo được, không điền timestamp lúc gọi — client không được
tin vào thứ không có nguồn.

## Phạm vi

Chỉ bọc **response 2xx**. Lỗi 4xx/5xx đi qua RFC 9457
(`vninvest_core.exceptions.core_api_exception_handler`) và **không** đụng — bọc
lỗi sẽ phá `SOCBaseView.error_response` (chính là body lỗi chuẩn của app này).
"""
from rest_framework import status as http_status
from rest_framework.response import Response

__all__ = ['adopt_envelope', 'envelope', 'paginated_envelope']


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
    `results`) — giữ nguyên để client không mất `next`/`previous` để trang kế
    tiếp. Endpoint chỉ có mảng (không có `count`) truyền `{'results': [...]}`,
    đúng như `identity_access` đã làm.
    """
    return Response(
        {'data': page, 'meta': meta or {}},
        status=status or http_status.HTTP_200_OK,
    )


def adopt_envelope(response):
    """Trả về `response` nguyên trạng **nếu** nó đã là envelope.

    Idempotent: chạy hai lần cho cùng kết quả. Dùng ở chỗ view của app này
    **gọi view của app khác** rồi trả thẳng, hoặc ở chỗ không chắc payload đã
    được bọc hay chưa — để không bao giờ sinh ra endpoint có **hai** shape cùng
    lúc (đúng lỗi mà `service_ops` từng mắc và không test nào bắt được).
    """
    data = getattr(response, 'data', None)
    if isinstance(data, dict) and 'data' in data and 'meta' in data:
        return response
    return envelope(data, status=getattr(response, 'status_code', None))
