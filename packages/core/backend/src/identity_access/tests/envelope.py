"""Đọc payload 2xx trong test mà không phụ thuộc hình dạng envelope.

## Vì sao cần

B5 bọc response 2xx thành `{data, meta}`. Test cũ đọc thẳng
`response.data['members']` nên hỏng — **đúng như mong đợi**, vì hợp đồng đã đổi.

Nhưng **không** được sửa test thành `response.data['data']['members']` cứng:
làm vậy thì test chỉ pass với hình dạng mới, và hỏng ngay nếu app khác (chưa
bọc) vẫn trả phẳng. Đó là lý do `service_ops` từng có **hai** shape phân
trang cùng lúc mà không test nào bắt được.

Helper này **mở envelope nếu có, giữ nguyên nếu không** — cùng quy tắc với
FE (`packages/web/src/adapters/core/envelope.js`): chỉ coi là envelope khi có
**cả** `data` và `meta`. Nhờ vậy test pass ở cả hai trạng thái, và khi app khác
được bọc sau này thì test không cần sửa lần nữa.

## Dùng

```python
from identity_access.tests.envelope import unwrapped, unwrapped_json

self.assertEqual(unwrapped(response)['members'][0]['username'], 'invitee')
```

`unwrapped_json` cho test đọc qua `response.json()` thay vì `response.data`
(test dùng `APIClient` thay vì `APIRequestFactory`, hoặc đi qua proxy).

Tên `unwrapped` cố ý, **không** phải `payload`: nhiều test đã có biến cục bộ
tên `payload` (dict payload của request) và sẽ che mất hàm import.
"""
from rest_framework.response import Response

__all__ = ['is_envelope', 'unwrapped', 'unwrapped_json']


def is_envelope(body) -> bool:
    """Đúng quy tắc FE: có **cả** `data` và `meta` mới là envelope."""
    return (
        isinstance(body, dict)
        and 'data' in body
        and 'meta' in body
    )


def _open(body):
    return body['data'] if is_envelope(body) else body


def unwrapped(response) -> dict:
    """Trả payload đã mở envelope — chấp nhận **cả** hai hình dạng."""
    body = response.data if isinstance(response, Response) else response
    return _open(body)


def unwrapped_json(response) -> dict:
    """Như `unwrapped` nhưng đọc body đã serialize (test dùng `.json()`)."""
    return _open(response.json())