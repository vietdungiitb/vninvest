"""Đọc payload 2xx trong test mà không phụ thuộc hình dạng envelope.

## Vì sao cần

B5 bọc response 2xx thành `{data, meta}`. Test cũ ở `backend/tests/test_advisory_*.py`
đọc thẳng `response.data['symbol']` nên hỏng — **đúng như mong đợi**, vì hợp
đồng đã đổi.

Nhưng **không** được sửa test thành `response.data['data']['symbol']` cứng: làm
vậy thì test chỉ pass với hình dạng mới, và hỏng ngay nếu app khác (chưa bọc)
vẫn trả phẳng. Đó là lý do `service_ops` từng có **hai** shape phân trang cùng
lúc mà không test nào bắt được.

Helper này **mở envelope nếu có, giữ nguyên nếu không** — cùng quy tắc với FE
(`packages/web/src/adapters/core/envelope.js`) và với
`identity_access/tests/envelope.py`: chỉ coi là envelope khi có **cả** `data`
và `meta`. Nhờ vậy test pass ở cả hai trạng thái, và khi app khác được bọc sau
này thì test không cần sửa lần nữa.

## Vì sao `advisory` đặc biệt cần helper này

`AdvisoryRefreshView` được `market_data` gọi **nội bộ** (`.as_view()()`) và
`market_data` đọc nó qua `_advisory_field` (`stock_mgmt_native_views.py:2317`) —
hàm đó đã cố ý đọc được cả hai hình dạng. Nếu test của `market_data` chỉ khẳng
định hình dạng phẳng thì sẽ hỏng ngay khi `advisory` bọc, và ngược lại.

## Dùng

```python
from advisory.tests.envelope import unwrapped, unwrapped_json

self.assertEqual(unwrapped(response)['symbol'], 'VNM')
```

`unwrapped_json` cho test đọc qua `response.json()` thay vì `response.data`
(test dùng `APIClient` thay vì `APIRequestFactory`, hoặc đi qua proxy).

Tên `unwrapped` cố ý, **không** phải `payload`: nhiều test đã có biến cục bộ
tên `payload` (dict payload của request) và sẽ che mất hàm import.
"""
from rest_framework.response import Response

from advisory.envelope import is_envelope

__all__ = ['unwrapped', 'unwrapped_json', 'is_envelope']


def _open(body):
    return body['data'] if is_envelope(body) else body


def unwrapped(response) -> dict:
    """Trả payload đã mở envelope — chấp nhận **cả** hai hình dạng."""
    body = response.data if isinstance(response, Response) else response
    return _open(body)


def unwrapped_json(response) -> dict:
    """Như `unwrapped` nhưng đọc body đã serialize (test dùng `.json()`)."""
    return _open(response.json())