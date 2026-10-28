"""
Envelope `{data, meta}` cho app `market_data` — **điểm vào duy nhất**.

Bản sao nguyên tắc từ `identity_access/envelope.py` (app mẫu, commit
`02d8b25f1`) và `service_ops/envelope.py` (commit `07d7be028`). Không import
chéo app khác: mỗi app giữ một helper riêng và cùng tuân theo một hợp đồng.

## Vì sao app này là app **nguy hiểm nhất** trong 4 app B5

`market_data` không chỉ có **hai** hình dạng phân trang cùng lúc như
`service_ops`. Nó còn có **ba** điều mà đợt B5 trước chưa gặp:

### ① View của app khác gọi view của app này và ngược lại

`stock_mgmt_native_views.py` có **2** chỗ gọi `AdvisoryRefreshView.as_view()()`
(thuộc app `advisory`):

    StockManagementAIAdvisorySessionView.post          — **live**
    StockManagementAIAdvisoryComponentsGenerateView.post — **live**

Cả hai đều đọc response qua `_advisory_field` (`:2322`), hàm cố ý đọc được cả
hai hình dạng. Nhưng `advisory` được bọc ở đợt B5 này **cùng lúc**, và:
`market_data` có chỗ trả thẳng `refresh_response` — response đó **đã bọc** ⇒
hai nhánh của cùng endpoint cùng shape. Đúng mức an toàn mà `adopt_envelope`
sinh ra.

Chỗ thứ 3 trước đây (`_ensure_advisory_record_for_symbol`) đọc thẳng
`refresh_response.data.get('advisory_id')` rồi rơi âm thầm về `_latest_ai_record`.
Bọc `advisory` làm `.get('advisory_id')` ra `None` ⇒ kích hoạt fallback im lặng.
**Đã xoá** 2026-10-02: 0 caller, và logic đúng của nó đã có sẵn ở hai call site
live qua `_advisory_field` + `_resolve_refreshed_advisory`. Giữ lại chỉ là giữ
một bản sai của logic đã có bản đúng. Chốt chặn:
`tests/test_internal_advisory_call_safety.py::RefreshResponseIsNeverReadDirectlyTests`.

### ② Endpoint phân trang có hai nhánh, và một nhánh **ghi vào `response.data`**

`StockProfileListView.get` (`views.py:31`):

    :77  return paginator.get_paginated_response(serializer.data)
    :80  return Response({'results': serializer.data})

`DailyPriceListView.get` (`views.py:103`) — nhánh khó hơn nhiều:

    :117  response = paginator.get_paginated_response(serializer.data)
    :118  response.data['symbol'] = symbol      <-- GHI THẲNG VÀO response.data
    :119  return response

Bọc phẳng `return response` thì dòng 118 ghi `symbol` **ngang hàng** `data`/`meta`
⇒ body thành `{symbol, data, meta}` ⇒ **vừa hỏng envelope vừa hỏng client**.
Phải bọc **trước**, rồi ghi vào **bên trong** `data`.

### ③ `status` viết bằng `IfExp` — gate đọc `status=` bằng `ast.Constant` nên **bỏ sót**

`TrackedSymbolsView.post` (`views.py:283`) dùng
`status=status.HTTP_201_CREATED if created else status.HTTP_200_OK`, và
`AdminOpsSystemDefaultsSeedView.post` (`admin_sync_views.py:110`) dùng
`status.HTTP_200_OK if ... else status.HTTP_207_MULTI_STATUS`. Cả hai đều là
`ast.IfExp` ⇒ `_status_kwarg` trả `None` ⇒ gate **không** nhận ra chúng là 2xx.
Cả hai đều là 2xx thật nên vẫn phải bọc.

## `meta` tối thiểu — không bịa giá trị

`IntradayTapeView` (`:366` và `:385`) là endpoint duy nhất của app này có
provenance **thật** trong payload: `stale`, `source`, `fetched_at`,
`source_event_at`, `age_seconds`. Đây đúng là loại `meta` mà hợp đồng mô tả.

Nhưng chúng **được giữ nguyên trong `data`**, không nhúc nhích. Lý do: chúng đi
kèm `symbol` / `trades` / `total` trong cùng một payload, và `tests/
test_market_data_intraday_native.py` + `test_intraday_tape_api.py` đọc thẳng
`response.data['stale']` / `['source']`. Tách ra `meta` là thay đổi hợp đồng
ngoài phạm vi B5 — làm ở ticket riêng nếu muốn.

Các endpoint còn lại **không** có provenance sẵn ⇒ `meta` để `{}`. Không điền
số đo được, không điền timestamp lúc gọi — client không được tin vào thứ không
có nguồn.

## Phạm vi: 38 call site, KHÔNG đụng gì ≥ 400

App này dựng tay rất nhiều response lỗi: `Response({'code','detail'}, 400)` ở
`StockManagementOHLCVBarsView` (7 chỗ), `{'detail'}` 400/404/409 ở các view
tracked-symbol / price-alert, `{ok,message}` 400/404/409 ở
`_find_component_record` / `_find_symbol_advisory_record`. Tất cả đi qua RFC
9457 và **không** đụng. `SKIP_NOBODY` 5 chỗ (204) cũng vậy.

## Nợ còn lại (có chủ đích, ghi ra ticket)

1. ~~`_ensure_advisory_record_for_symbol` (`:2670-2700`) — 0 caller nhưng còn bug
   im lặng~~ **đã đóng 2026-10-02: xoá hàm.** Lựa chọn là *xoá* chứ không phải
   *sửa*, vì hai call site live đã có bản đúng của cùng logic đó
   (`_advisory_field` + `_resolve_refreshed_advisory`), và hàm chết thì không
   test nào bắt được — sửa nó chỉ tạo ra một bản song song không ai gọi.
2. `views.py:469`/`:548` của `signal_intelligence` (`UNKNOWN`) — không liên quan
   app này nhưng cùng kiểu nợ.
3. Các `ListAPIView` — app này không có, nhưng `market_data` có nhiều view phân
   trang **tự** gọi `paginator.get_paginated_response` đã bọc ở trên.
"""
from rest_framework import status as http_status
from rest_framework.response import Response

__all__ = [
    'adopt_envelope',
    'envelope',
    'envelope_schema',
    'is_envelope',
    'paginated_envelope',
]


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

    `page` là dict phân trang nguyên vẹn — `count`/`next`/`previous`/`results` cho
    `PageNumberPagination`, hoặc `next`/`previous`/`results` cho cursor (cursor
    **không** có `count`). Giữ nguyên để client không mất `next`/`previous` để
    trang kế tiếp.

    Endpoint chỉ có mảng (không phân trang) truyền `{'results': [...]}`.
    """
    return Response(
        {'data': page, 'meta': meta or {}},
        status=status or http_status.HTTP_200_OK,
    )


def adopt_envelope(response):
    """Trả về `response` nguyên trạng **nếu** nó đã là envelope.

    Idempotent: chạy hai lần cho cùng kết quả.

    Dùng ở đúng chỗ cần nhất ở app này: `StockManagementAIAdvisorySessionView.post`
    (`:2844`) và `StockManagementAIAdvisoryComponentsGenerateView.post` trả thẳng
    `refresh_response` của `advisory` — app khác đã bọc. Bọc phẳng thì endpoint
    có **hai** shape cùng lúc (đúng lỗi mà `service_ops` từng mắc và không test
    nào bắt được), còn bỏ qua thì nhánh này phẳng trong khi nhánh kia đã bọc.
    """
    data = getattr(response, 'data', None)
    if is_envelope(data):
        return response
    return envelope(data, status=getattr(response, 'status_code', None))


def envelope_schema(inner):
    """Mô tả `{data: <inner>, meta: {...}}` cho `@extend_schema` khi `inner` là
    schema **dict** dựng tay.

    ## Vì sao cần hàm này khi đã có `vninvest_core.api_envelope.envelope_response`

    `envelope_response()` **cố ý** chỉ nhận serializer class/instance
    (`api_envelope.py:199` ném `TypeError` với thứ khác, và có test khoá hành vi
    đó). Nó **không** nhận dict schema — đúng vì dict không phải serializer.

    Mà app này có **8** `@extend_schema` mô tả payload bằng dict tay ở
    `stock_mgmt_native_views.py` (`_STOCK_DARK_MONEY_HISTORY_SCHEMA`,
    `_STOCK_NEWS_AI_SUMMARY_SCHEMA`, `_TRACKED_SYMBOL_BULK_THRESHOLD_RESPONSE_SCHEMA`, …).
    Gọi `envelope_response()` ở đó sẽ thành `data` free-form và **xoá mất** mô tả
    field đang có — docs tệ hơn hiện trạng, đúng cái `api_envelope.py` cảnh báo.

    Với endpoint nào **có** serializer thì dùng `envelope_response(SomeSerializer)`;
    hàm này chỉ dành cho dict tay.
    """
    return {
        'type': 'object',
        'properties': {
            'data': inner,
            'meta': {'type': 'object'},
        },
        'required': ['data', 'meta'],
    }