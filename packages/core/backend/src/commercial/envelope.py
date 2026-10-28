"""
Envelope `{data, meta}` cho app `commercial` — **điểm vào duy nhất**.

## Vì sao có file này

`commercial` là app cuối cùng còn trả 2xx phẳng. Khác với các app đã migrate,
ở đây còn một lý do **không** được bọc, và lý do đó không nằm trong danh sách
ngoại lệ gốc (`vninvest_core/api_envelope.py:23-40`).

## Ngoại lệ MỚI: giao thức cổng thanh toán bên thứ ba

`VNPayService` yêu cầu phản hồi đúng shape `{RspCode, Message}` — đó là **hợp
đồng với VNPay**, không phải hợp đồng với frontend của ta. Bọc nó vào
`{data, meta}` sẽ làm VNPay không đọc được phản hồi, tức là **hỏng tích hợp
thanh toán**.

Bằng chứng nội tại rằng đó là giao thức máy chứ không phải REST dành cho
frontend: `views.py` trả `{'RspCode': '99', 'Message': 'Internal Error: ...'}`
với **HTTP 200** cho lỗi nội bộ. Không REST API nào trả 200 cho lỗi.

Vì vậy `check-envelope-contract.py` có `SKIP_GATEWAY_PROTOCOL`, nhận diện **chỉ
bằng tên trường `RspCode`** — không dùng "có key `Message`", vì key đó quá rộng
và sẽ âm thầm bỏ sót response phẳng thật.

Tương tự: ACK `{'received': True}` tới webhook Stripe là `SKIP_WEBHOOK_ACK`, chỉ
áp dụng khi `received` là key **duy nhất**. `stripe_webhooks.py:111` trả
`{'received': True, 'error': ...}` — hai key, nên **không** được miễn.

## Chỉ bọc response 2xx

Lỗi 4xx/5xx đi qua RFC 9457 `application/problem+json` và **không** đụng.
"""
from rest_framework.response import Response

__all__ = ['adopt_envelope', 'envelope', 'paginated_envelope']


def envelope(data, meta=None, *, status=None, headers=None) -> Response:
    """Bọc payload 2xx thành `{data, meta}`.

    `meta` chỉ mang provenance (`as_of` / `source`). Endpoint nào không có sẵn
    thì để `{}` — không điền số đo được, không điền timestamp lúc gọi: client
    không được tin thứ không có nguồn.
    """
    return Response({'data': data, 'meta': meta or {}}, status=status, headers=headers)


def paginated_envelope(page, meta=None, *, status=None) -> Response:
    """Bọc cả khối phân trang, không nhét `results` ra ngoài."""
    return Response({'data': page, 'meta': meta or {}}, status=status)


def adopt_envelope(response):
    """Trả nguyên trạng nếu đã là envelope, nếu không thì bọc lại.

    Idempotent: chạy hai lần cho cùng kết quả, nên không phụ thuộc thứ tự các
    app khác được migrate.
    """
    data = getattr(response, 'data', None)
    if isinstance(data, dict) and 'data' in data and 'meta' in data:
        return response
    return envelope(data, status=getattr(response, 'status_code', None))