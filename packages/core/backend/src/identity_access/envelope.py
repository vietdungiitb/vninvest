"""
Envelope `{data, meta}` cho app `identity_access` — **điểm vào duy nhất**.

## Vì sao có file này

Trước B5, app này trả **9 hình dạng payload** khác nhau cho cùng một việc
(trả dữ liệu 2xx). Mỗi hình dạng được dựng tay ở từng view, nên không có chỗ
nào sửa hết một lượt — đó là lý do `service_ops` trước đây có **hai** shape
phân trang cùng lúc mà không test nào bắt được.

## Vì sao helper **trả về `Response`**, không trả dict

DRF **bắt buộc** view trả `Response`; trả dict thì `finalize_response` ném
`AssertionError`. Nên helper trả thẳng `Response` để call site viết gọn:

    return envelope({'ok': True})          # thay vì Response({'data': ..., 'meta': {}})

Gate `scripts/check-envelope-contract.py` nhận đúng dạng này (`WRAPPED`),
nhưng **không** nhận `Response(envelope(x))` — dạng đó rơi vào `UNVERIFIED`.

## `meta` tối thiểu — không bịa giá trị

`meta` chỉ mang **provenance** (`as_of` / `stale` / `calculation_version` /
`source`). Endpoint nào không có sẵn provenance thì để `{}`. Không điền số đo
được, không điền timestamp lúc gọi — client không được tin vào thứ không có
nguồn.

## Phạm vi

Chỉ bọc **response 2xx**. Lỗi 4xx/5xx đi qua RFC 9457
(`vninvest_core.exceptions.core_api_exception_handler`) và **không** đụng —
bọc lỗi sẽ phá `test_problem_json.py` + `test_status_codes_and_errors.py`.
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
    `results`) — giữ nguyên để client không mất `next`/`previous` để trang
    kế tiếp.
    """
    return Response(
        {'data': page, 'meta': meta or {}},
        status=status or http_status.HTTP_200_OK,
    )


def adopt_envelope(response):
    """Trả về `response` nguyên trạng **nếu** nó đã là envelope.

    Dùng ở chỗ view của app này **gọi view của app khác** rồi trả thẳng
    (`commercial_partner_views.PartnerCostTrendView` → `commercial.`…). View
    được gọi nằm ngoài phạm vi B5-`identity_access` nên **chưa** chắc đã bọc;
    nếu bọc phẳng thì endpoint này có **hai shape cùng lúc** — đúng cái lỗi
    `service_ops` từng mắc và không test nào bắt được.

    Còn nếu chưa phải envelope thì bọc lại. Idempotent: chạy hai lần cho cùng
    kết quả, nên không phụ thuộc thứ tự các app khác được migrate.
    """
    data = getattr(response, 'data', None)
    if isinstance(data, dict) and 'data' in data and 'meta' in data:
        return response
    return envelope(data, status=getattr(response, 'status_code', None))