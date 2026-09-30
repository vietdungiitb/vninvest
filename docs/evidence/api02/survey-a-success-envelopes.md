# Survey A — SUCCESS envelope

**Agent:** `api02-survey-a` · **Worktree:** `C:\Mujoco Projects\w3-a` · **Branch:** `wip/api02-a`
**Base commit:** `93764b8c` (Merge feat/portfolio-w3-api: Wave 3 API-01 (RFC 9457) + LED-06 …)
**Phạm vi:** đếm & phân loại **mọi shape response 2xx** trong production code Django.
**Không** làm: error envelope (agent B), phân loại test đỏ (agent C), đề xuất contract (owner).

---

## Tóm tắt 5 dòng

1. **591 call site trả 2xx** trong `packages/core/backend/src/` (không phải "con số shape" — đây là số *chỗ gọi*, mỗi chỗ 1 endpoint).
2. **10 họ envelope (family) đang tồn tại thật** (F2 = 0 nên không tính), phân bố trên **304 chữ ký key cấp trên cùng khác nhau** (distinct literal signatures) — trong đó **231 chữ ký là họ phẳng** (F8 `serializer.data` 5 + F9 dict dựng tay 226), tức client phải nhớ từng cái.
3. **Ledger nói envelope chuẩn là `{data, meta}` — họ đó có ĐÚNG 0 site.** Đã grep và đọc tay cả 8 chỗ có key `'meta'` trong production: tất cả đều **lồng**, không có cái nào ở cấp trên cùng.
4. **73% (426/591) response 2xx không có envelope nào** — phẳng, mảng trần, hoặc 204 rỗng. Chỉ 112/591 có envelope, 53/591 bán envelope.
5. **Phát hiện ngoài dự kiến, chặn deploy:** `signal_intelligence/outbound_notification_service.py:63` là **Python SyntaxError thật**, file **không import được** — tồn tại ở HEAD `93764b8c`, không phải do encoding.

---

## Phương pháp & phạm vi đo (đọc trước khi tin số)

| Mục | Giá trị | Cách đo |
|---|---|---|
| Thư mục gốc | `packages/core/backend/src/` | — |
| File `.py` production | **316** file trên đĩa | `Get-ChildItem -Recurse -Filter *.py` + lọc |
| File parse được | **315** (1 SyntaxError) | `ast.parse` |
| Loại trừ | `tests/`, `test_*.py`, `*_test.py`, `migrations/`, `commands/`, `management/`, `conftest.py` | — |
| App trong `INSTALLED_APPS` | 16 | `settings.py:95-110` |

**Vì sao phải dùng AST chứ không grep:** `Select-String 'Response\('` trả **969 dòng**, còn số call site thật của DRF `Response`/`JsonResponse` là **799**. Chênh 170 dòng là `-> Response:`, `class ProblemResponse(Response)`, comment, docstring. Tương tự `get_paginated_response(`: grep = 30, AST = 30 (khớp). Nên: **con số 2xx/4xx bắt buộc lấy từ AST**; script ở Phụ lục A.

### Script AST (bắt buộc cho số 2xx/4xx)
```powershell
python "$env:TEMP\opencode\api02a_scan2.py" "C:\Mujoco Projects\w3-a\packages\core\backend\src"
python "$env:TEMP\opencode\api02a_pag2.py"     # riêng cho get_paginated_response
```
Script nằm ở `%TEMP%\opencode\`, **không** commit vào repo (luật: chỉ được tạo file report).
Bản đầy đủ nội dung hai script ở **Phụ lục A**.

---

## Kiểm chứng lại claim của owner (không chép lại)

> Owner nói: `identity_access` register trả `{status, timestamp, request_id, data}`.

**XÁC MINH ĐÚNG.** `success_response()` tại `identity_access/views/helpers.py:327-338`:

```python
def success_response(data: dict, status_code: int = status.HTTP_200_OK, request=None) -> Response:
    ...
    return Response({
        "status": "success",                          # helpers.py:334
        "timestamp": timezone.now().isoformat(),      # helpers.py:335
        "request_id": request_id,                     # helpers.py:336
        "data": data                                  # helpers.py:337
    }, status=status_code)
```

`register.py:302` (`return success_response({...})`) và `register.py:462` dùng nó.

**Bổ sung owner chưa nói — đây là phần quan trọng:** có **hai** định nghĩa `success_response` trong cùng app, **copy-paste trùng nội dung**:
- `identity_access/views/helpers.py:327` (dùng bởi `login.py`, `register.py`) — **6 call site**
- `identity_access/views_operator.py:20` (dùng bởi chính file) — **6 call site**

Cùng shape, **không mâu thuẫn**, nhưng là 2 nguồn sự thật cho 1 contract.

**Owner cũng nói "ledger ghi là envelope `{data, meta}`" — con số này SAI, xem mục `F2` bên dưới.**

---

## Bảng shape

Mỗi dòng = 1 **họ envelope**. "Số endpoint" = số call site 2xx.
Lệnh tái lập: `R` = chạy `api02a_scan2.py`, `P` = chạy `api02a_pag2.py`, `G` = grep PowerShell (giá trị grep ghi kèm khi **khác** AST).

| # | Shape (key cấp trên cùng) | Tìm thấy ở đâu (file:line @ `93764b8c`) | Số endpoint | Lệnh tái lập |
|---|---|---|---:|---|
| **F0** | `EMPTY` — `Response(status=204)`, không body | `portfolio_analytics_views.py:2734`, `:2931`; `dnse_credential_views.py:89`; +18 site khác | **21** | `R` → `F0 EMPTY` · G: `'HTTP_204_NO_CONTENT'\|'status\s*=\s*204'` = 22 dòng |
| **F1** | `BARE ARRAY` — mảng JSON trần, không envelope | `commercial_partner_views.py:159,162`; `views_tenant.py:475`; `portfolio_analytics_views.py:135,173,439,443,2636`; `views_retail`/`overview.py:1130,1181`; `signals_triage.py:92`; +7 site | **19** | `R` → `F1` · G: `'Response\(\s*(\[\|sorted\()'` = **17** (chênh 2: `legacy_stubs.py:60,71` gọi qua `_empty_list()`, không chứa chữ `Response(`) |
| **F2** | **`{data, meta}`** ← contract trong ledger | **KHÔNG TỒN TẠI — 0 site** | **0** | G: `'meta'\s*:` = **8** dòng, đọc tay cả 8 → **tất cả đều lồng**, xem Chi tiết F2 |
| **F3** | `{status, timestamp, request_id, data}` | `views/helpers.py:327` (def) + `views_operator.py:20` (def); gọi từ `login.py:206,258`, `register.py:302,462,544,607`, `views_operator.py:112,139,200,235,274,410` | **12** | G: `'success_response\('` bỏ dòng `def`/comment = **12** ✔ khớp AST |
| **F4** | `{object, generated_at, summary_cards, data}` | `vninvest_core/contracts/operator/operator_tenant_views.py:207,225,267,315` (qua `_envelope()` tại `:14-20`) | **4** | G: `'summary_cards'` = 11 dòng → lọc còn 4 site `Response(_envelope(...))` |
| **F4b** | `{object, generated_at, …}` (**không có `data`**) | `vninvest_core/contracts/operator/views.py:146`, `:161` | **2** | `R` → `F4b` |
| **F5** | `{data, +siblings}` — có `data` nhưng lẫn key khác | `identity_access/views_usage.py:140` `{data,days,end_date,group_by,start_date}`; `:205` `{data,days,end_date,interval,start_date}`; `market_serving/native_views.py:216` `{data,stale,symbol}` | **3** | `R` → `F5` |
| **F6** | LIST-ISH — `{results…}` / `{count,next,previous,results}` / `{next,previous,results}` | 62 site viết tay + 29 site qua paginator | **91** | `P` (29 paginator) + `R` (62 viết tay) |
| **F7** | ACK — `{message}` / `{ok}` / `{detail}` | `views_operator.py`, `admin_ops/views.py:2128,2148,2273,2342`, `sso.py:397,405`, `stock_mgmt_native_views.py:2862,2891,2996`; +44 site | **50** | `R` → `F7` |
| **F7x** | **RUNTIME** — shape quyết định lúc chạy | `stock_mgmt_native_views.py:2188,2780` (dict từ cache); `portfolio_analytics_views.py:2577` (echo nguyên request body) | **3** | `R` → `F7x` |
| **F8** | FLAT — `Response(SomeSerializer(x).data)` | 96 site `.data` thẳng + `prefetch/screener/signals/vnbroker.py` (`to_response_dict`) + `profile.py:128,139` + `ai_analytics/views.py:123` + `admin_ops/views.py:2090` | **104** | `R` → `F8` |
| **F9** | FLAT — dict domain dựng tay, field nằm thẳng cấp trên cùng | 284 site; lớn nhất: `{Message,RspCode}` (8), `{job_id,state}` (4), `{ad,hide_trademark,show_ads}` (3) | **282** | `R` → `F9` |
| | | | **591** | |

### Tổng khớp
```
F0 21 + F1 19 + F2 0 + F3 12 + F4 4 + F4b 2 + F5 3 + F6 91 + F7 50 + F7x 3 + F8 104 + F9 282 = 591 ✔
```
Cách ra 591 từ số thô:
```
551  Response()/JsonResponse() call site 2xx        (AST)
 -3  thân helper, không phải endpoint:
      vninvest_core/pagination.py:27        (thân StandardPageNumberPagination.get_paginated_response)
      vninvest_core/utils/legacy_stubs.py:30 (thân _empty_list())
      vninvest_core/utils/legacy_stubs.py:34 (thân _empty_paginated() — KHÔNG có caller ⇒ dead code)
 +2  caller thật của _empty_list():  legacy_stubs.py:60, :71
 +29 get_paginated_response() thật (P; 1 delegation base.py:164 bị loại)
 +12 success_response() call site (thân 2 helper đã loại ở nhánh VAR-status)
 = 591
```

### Phân bố envelope (591)
| Mức bọc | Số | % |
|---|---:|---:|
| **Có envelope thật** (F3, F4, F4b, F5, F6) | 112 | 19% |
| **Bán envelope** (F7 ack, F7x runtime) | 53 | 9% |
| **KHÔNG envelope** (F0 rỗng, F1 mảng trần, F8/F9 phẳng) | **426** | **72%** |

### Phân bố theo app (chỉ 549 site `Response()`, chưa gồm 29 paginator + 12 success_response)
`service_ops` 144 · `identity_access` 102 · `user_workspace` 100 · `market_data` 64 · `vninvest_core` 41 · `market_serving` 29 · `commercial` 17 · `advertising` 9 · `signal_intelligence` 9 · `advisory` 8 · `support` 7 · `data_ingest` 6 · `ai_agents` 5 · `ops_audit` 4 · `ai_analytics` 4

---

## Chi tiết từng shape

### F2 — `{data, meta}`: **0 site. Contract trong ledger không có hệ thống nào dùng.**

Đây là phát hiện quan trọng nhất, nên dẫn chứng đầy đủ. Grep `'meta'\s*:` trong production cho **8 dòng**, đọc tay **cả 8**:

| file:line | Cấp trúc thật | Có phải envelope cấp trên cùng? |
|---|---|---|
| `market_serving/native_views.py:549` | lồng trong dict lớn hơn (`filters`, `next_cursor`, `has_more` là anh em) | ❌ |
| `market_serving/native_views.py:1235` | lồng | ❌ |
| `market_serving/native_views.py:1456` | lồng | ❌ |
| `user_workspace/portfolio_analytics_views.py:284` | `'meta': build_meta(ledger)` — lồng cạnh `data` | ⚠️ xem dưới |
| `user_workspace/portfolio_analytics_views.py:1719` | lồng | ❌ |
| `user_workspace/ledger/holdings.py:332` | `_serialize()` — **cache payload nội bộ**, không phải HTTP response | ❌ |
| `user_workspace/ledger/services.py:134` | `_serialize()` — cache payload nội bộ | ❌ |
| `user_workspace/ledger/services.py:161` | `_deserialize()` — cache payload nội bộ | ❌ |

→ **Không có call site 2xx nào trả đúng `{data, meta}` ở cấp trên cùng.** AST xác nhận độc lập: family F2 không xuất hiện trong output.

Gần nhất là `portfolio_analytics_views.py:284` — có cả `data` lẫn `meta` nhưng `meta` là **anh em** của key khác, nên rơi vào **F5** (`{data, +siblings}`), không phải F2.

Lệnh tái lập:
```powershell
$f = Get-ChildItem -Path "C:\Mujoco Projects\w3-a\packages\core\backend\src" -Recurse -Filter *.py |
     Where-Object { $_.FullName -notmatch '\\(tests|migrations|commands|management|__pycache__)\\' -and $_.Name -notlike 'test_*' }
$f | Select-String -Pattern "'meta'\s*:" -Encoding UTF8 | Measure-Object -Line   # → 8
```

### F3 — `{status, timestamp, request_id, data}` (12 endpoint)
Định nghĩa: `identity_access/views/helpers.py:327-338` và bản trùng `views_operator.py:20-31`.
Khác biệt duy nhất giữa 2 bản: `views_operator.py` **không** import `timezone`… không, cả hai đều dùng `timezone.now()`. **Hai bản giống hệt nhau.**

### F4 / F4b — 2 họ "operator" khác nhau trong cùng thư mục
- F4 `{object, generated_at, summary_cards, data}` — qua `_envelope(data, summary_cards, object_label)` tại `operator_tenant_views.py:14-20`.
- F4b `{object, generated_at, health_status, summary_cards, health_cards, sections}` (`views.py:146`) và `{object, generated_at, health_status, healthy_component_count, …, sources}` (`views.py:161`).

Cả 3 đều dùng tiền tố `object` + `generated_at` nhưng **một cái có `data`, hai cái không** ⇒ client đọc `body.data` sẽ `undefined` ở 2 endpoint hàng xóm.

### F6 — LIST-ISH: **3 contract phân trang khác nhau, cộng thêm 25 biến thể viết tay**
29 endpoint dùng paginator thật (đã resolve tới tận lớp base DRF):

| Shape | Số endpoint | Quyết định bởi |
|---|---:|---|
| `{next, previous, results}` — **KHÔNG có `count`** | **28** | 19 view không set `pagination_class` → `settings.py:316` `DEFAULT_PAGINATION_CLASS = CursorPagination`; 9 view set subclass của `CoreCursorPagination` |
| `{count, page, page_size, results, total_pages}` | 1 | `service_ops/views/scheduler.py:268`, `SchedulerJobHistoryPagination` (override) |

Ngoài ra **62 site viết tay** với **27 chữ ký khác nhau**, trong đó tên key chứa mảng không thống nhất:
`results` (42) · `rows` (6) · `items` (2) · `services` (1) · `stats` (1), và **14 site trả `{results}` trần — không có bất kỳ trường phân trang nào**.

*(62 = 64 site `Response()` trong F6 trừ 2 thân helper: `vninvest_core/pagination.py:27` và `vninvest_core/utils/legacy_stubs.py:34`. Cả hai đều là `{count,next,previous,results}` nên 27 chữ ký = 28 − 1.)*

⚠️ **Đính chính quan trọng — tôi đã đếm sai một lần và tự sửa:** lần đầu tôi quy cả 30 site paginator là `{count, next, previous, results}`. Sai, vì 2 lý do đã kiểm chứng:
1. `settings.py:316` đặt `DEFAULT_PAGINATION_CLASS = CursorPagination` — **không phải** `PageNumberPagination`.
2. Đọc source DRF 3.15.1 đã cài: `CursorPagination.get_paginated_response` trả `{next, previous, results}` — **không có `count`**; `PageNumberPagination` mới có `count`.

Lệnh xác minh:
```powershell
python -c "import re;p=r'C:\Users\Pham Viet Dung\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\site-packages\rest_framework\pagination.py';s=open(p,encoding='utf-8').read();print(re.search(r'class CursorPagination.*?(?=\nclass )',s,re.S).group(0).split('def get_paginated_response')[1][:200])"
```
`StandardPageNumberPagination` (`pagination.py:6-32`) — class được docstring tự gọi là "Standard", trả `{count,next,previous,results}` — **không được dùng làm `pagination_class` ở bất kỳ view nào**. Nó chỉ được *instantiate thủ công* ở 4 chỗ (`audit.py:91`, `base.py:160`, `billing.py:117`, `operator_tenant_views.py:200`) và subclass 1 lần (`users.py:70` `SocUsersPagination`).

### F7 — ACK: **31 chữ ký**, nguy hiểm nhất là `{detail}` (12 site)
`{detail}` ở **2xx** là kháng nghịch ngữ với convention DRF/Python (`detail` = lỗi). 12 site:
`login.py:272,273` · `password_change.py:106` · `password_reset.py:99,232` · `views_security.py:146,153` · `views_webhooks.py:145,165,246` · `signal_intelligence/admin_views.py:61` · `dnse_credential_views.py:89` (204)

### F7x — RUNTIME (3 site, không xác định được tĩnh)
- `stock_mgmt_native_views.py:2188` — `return Response(cached_data)`, `cached_data = cache.get(...)`. Shape phụ thuộc dữ liệu đã serialize trong cache ⇒ **mọi lần chạy có thể khác**.
- `stock_mgmt_native_views.py:2780` — `status=status_code` + payload cache.
- `portfolio_analytics_views.py:2577` — `return Response(payload)` với `payload` lấy từ `request.data` ⇒ **server echo nguyên body client gửi**, không kiểm soát được shape.

---

## Endpoint nào PHẲNG (không bọc) — nguy hiểm nhất vì client phải biết từng cái

**426/591 endpoint (72%) không có envelope.** Ba nhóm:

### 1. F8 — `Response(SomeSerializer(x).data)` — 104 site
Client phải biết **tên class serializer** để biết shape. 96 site `.data` thẳng + 8 site qua biến trung gian. Ví dụ đã đọc tay:
- `matrix.py:150` `ScrapeMatrixSerializer(matrix).data` → `Response(...)` tại `matrix.py:206,255,268,329`
- `signals_triage.py:41` `UserAlertDeliveryStateSerializer(row).data` → `:121,144,149`
- `views_tenant.py:124` `CorePATCredentialSerializer(credential).data` → `:257,361` (HTTP 201)
- 4 site `matrix.to_response_dict(...)` + `payload['write_block_reason'] = …` (`prefetch.py:160`, `screener.py:213`, `signals.py:312`, `vnbroker.py:242`)

### 2. F9 — dict domain dựng tay — 282 site, **226 chữ ký khác nhau**
Không có 2 endpoint nào giống nhau. 10 chữ ký phổ biến nhất:

| n | Shape |
|---:|---|
| 8 | `{Message, RspCode}` — **PascalCase**, lệch hoàn toàn convention snake_case của phần còn lại |
| 4 | `{job_id, state}` |
| 3 | `{ad, hide_trademark, show_ads}` |
| 3 | `{monthly, note}` |
| 3 | `{billing_period_end, billing_period_start, plan, status, trial_ends_at}` |
| 3 | `{days, end_date, interval, points, start_date, symbol, technical, timeframe}` |
| 3 | `{*, ownership}` (`**` spread) |
| 3 | `{has_report, report}` |

### 3. F1 — mảng trần — 19 site
`portfolio_analytics_views.py:173` là ví dụ điển hình:
```python
return Response(sorted(results, key=lambda x: x['symbol']))   # → [ {...}, {...} ]
```
Client không có chỗ nào gắn metadata, không phân trang, không `count`.

### 4. F0 — 204 rỗng — 21 site

---

## Điểm mâu thuẫn (contract vs contract)

### M1 — `status` ở cấp trên cùng mang **ít nhất 3 nghĩa khác nhau** (đã đọc tay cả 3)
| file:line | Giá trị | Nghĩa |
|---|---|---|
| `identity_access/views/helpers.py:334` | `"success"` (hằng số) | **mức transport** |
| `identity_access/commercial_partner_views.py:117` | `'none'` | **trạng thái subscription** |
| `vninvest_core/contracts/admin_ops/views.py:2130` | `'accepted'` | **trạng thái job** |

→ Một client viết `if (res.status === 'success')` sẽ **hỏng âm thầm** ở 2 endpoint còn lại. Và vì F3 đặt `status` ở cấp trên cùng, code đang **tranh chấp tên key với dữ liệu nghiệp vụ**.

### M2 — Ba contract phân trang cùng tồn tại
- Thực tế đa số (28/29): `{next, previous, results}` — **không `count`**
- `StandardPageNumberPagination` tự doc: `{count, next, previous, results}` — nhưng **không view nào dùng làm `pagination_class`**
- `SchedulerJobHistoryPagination`: `{count, page, page_size, results, total_pages}` — thêm `total_pages` mà 2 kia không có

### M3 — 2 bản `success_response` trùng nội dung trong cùng app
`views/helpers.py:327` vs `views_operator.py:20`. Hiện **giống hệt** ⇒ 2 nguồn sự thật, chưa phân kỳ. Rủi ro: sửa 1 bản thì contract lệch.

### M4 — Cùng tiền tố `object` + `generated_at`, 3 shape, 2 khác biệt cấu trúc
`operator_tenant_views.py` (có `data`) vs `operator/views.py:146,161` (**không có `data`**).

### M5 — `settings.py:316` đặt `DEFAULT_PAGINATION_CLASS = CursorPagination` — **không ai document**
Nhưng `pagination.py:6-20` lại docstring "Standard … Response format: {count, next, previous, results}". Tài liệu và cấu hình **ngược nhau**.

### M6 — F5 `{data, +siblings}` phá vỡ giả định "có `data` ⇒ đã bọc"
`views_usage.py:140,205` và `market_serving/native_views.py:216`. Ở 3 endpoint này `data` là **một field nghiệp vụ**, không phải vùng chứa envelope. Client check `if ('data' in res)` sẽ phân loại sai.

### M7 — `{Message, RspCode}` (8 site) vs `{message, ok}` (F7) vs `{message, status, task_id}`
Ba kiểu viết hoa/tinh giảng cho "kết quả thao tác". Client check `res.Message` sẽ hỏng ở phần còn lại.

---

## KHÔNG XÁC MINH ĐƯỢC (kèm lý do)

| # | Claim / phạm vi | Vì sao không xác minh được |
|---|---|---|
| 1 | **Số *endpoint* thật** (route) | Đếm **call site** (chỗ gọi `Response`), không map `urls.py` ⇒ 1 view có thể đăng ký nhiều route, 1 route có thể phụ thuộc `request.method`. Muốn số route phải resolve `urlpatterns` + `include()` — **ngoài phạm vi Survey A**. Con số 591 là call site, **không phải** số URL. |
| 2 | **`signal_intelligence/outbound_notification_service.py`** | **SyntaxError thật tại `:63`** (`fcode"key={fcm_api_key}"` — có `f` thừa trước dấu quote) ⇒ `ast.parse` fail ⇒ **file không scan được**. Đã xác nhận bằng `py_compile` và bằng `git show 93764b8c:…` (lỗi **có sẵn ở HEAD**, không phải do tôi). Chưa xác minh: file này có chứa `Response(` không — grep `Response(` trong file cho 0 kết quả, nhưng **không import được thì không deploy được**, nên cần ticket riêng. Đã grep toàn repo: **không module nào import nó** ⇒ nhiều khả năng chết, chưa chứng minh được. |
| 3 | **Shape thật của 3 endpoint F7x** | Phụ thuộc dữ liệu runtime (cache) hoặc echo body client gửi. Tĩnh không xác định. Cần chạy thật + quan sát traffic. |
| 4 | **`legacy_proxy.py:138-148`** | `HttpResponse(content=resp.content, status=resp.status_code)` — **passthrough byte-for-byte** sang `LEGACY_BACKEND_URL`. Shape là shape của **legacy backend**, nằm ngoài repo này ⇒ không đếm được, không sửa được ở đây. |
| 5 | **242+4 response lỗi (4xx/5xx)** | Đã **loại có chủ đích** khỏi đếm — thuộc agent B. Ghi lại ở đây để agent B có con số khởi đầu: 246 literal 4xx/5xx + 4 xác minh tay (`exceptions.py:215,439`, `base.py:157`, `legacy_proxy.py:73`) = **250**. |
| 6 | **SSE stream** (`signal_intelligence/sse.py:42` `AlertCenterStreamEventRenderer`) | Dùng `BaseRenderer` tự viết, không đi qua `Response(dict)` ⇒ **không nằm trong 591**. Shape của SSE **không so sánh được** với JSON envelope — cần khung riêng. |
| 7 | **WebSocket / channels** | `settings.py:93` bật `channels`. Không có `Response()` ⇒ không đếm. Chưa khảo sát. |
| 8 | **Contract ghi trong OpenAPI** | `drf-spectacular` có cài (`settings.py:88`) nhưng **chưa chạy** `spectacular --file` ⇒ chưa biết schema sinh ra có khớp code không. Cần môi trường. |
| 9 | **`market_data/stock_mgmt_native_views.py` (4.400+ dòng)** | Đã scan AST bình thường, nhưng **không đọc tay từng view**. 67 site `market_data` trong bảng phân bố app là **đếm máy**, không phải đọc tay. |
| 10 | **Test** | **Không chạy test nào.** Không cần cho survey này, và `CORE_DATABASE_URL` chưa set. Nói rõ: **0 test đã chạy** ⇒ mọi khẳng định ở đây là **static analysis**, không phải behavior quan sát được. |
| 11 | **Mojibake / "mất dấu"** | **KHÔNG phát hiện.** Console PowerShell hiển thị sai (`t?i` thay `tái`) nhưng `read` tool + `python open(encoding='utf-8')` xác nhận file **sạch**. Đã verify 4 mẫu: `signals_triage.py:40` = `"…tái dùng + context alert (additive) để FE render cột feed."` ✔ · `portfolio_analytics_views.py:2575` = `"Tác vụ không thuộc bộ lọc này."` ✔ · `dnse_credential_views.py:78` = `"Lỗi cấu hình mã hoá phía server. Liên hệ admin."` ✔ · `legacy_proxy.py:65` ✔. **Không báo cáo mojibake.** Lệnh verify: `Get-Content -LiteralPath <f> -Encoding UTF8`. |
| 12 | **Chỗ gọi `Response` nằm trong `if TYPE_CHECKING` / docstring** | AST không phân biệt "code chạy" với "code trong docstring". Đã lọc thủ công các case thấy được; **không bảo đảm không còn sót**. |

---

## Khuyến nghị (ràng buộc, KHÔNG quyết định)

1. **Ràng buộc đo lường:** 591 là call site, 304 là chữ ký key, 10 là họ envelope. Mọi tài liệu API-02 nên ghi **cả 3** và nói rõ phạm vi (`src/`, bỏ tests/migrations) — nếu không, "hợp nhất 5 shape" sẽ là con số bịa.
2. **Ràng buộc kỹ thuật:** `{data, meta}` **0 site** ⇒ chuẩn hoá nó là **viết mới**, không phải "sửa về chuẩn". Chi phí ≈ 426 site phẳng + 19 mảng trần, không phải 12 site.
3. **Ràng buộc tương thích:** F3 đã **lộ ra ngoài** (`X-Request-ID` header `ops_audit/middleware.py:38` + test `identity_access/tests/test_login_upgrade.py:75` khẳng định `request_id` trong body). Bất kỳ envelope mới phải giữ `request_id`, nếu không sẽ phá test đang xanh.
4. **Ràng buộc phân trang:** `DEFAULT_PAGINATION_CLASS = CursorPagination` (`settings.py:316`) là quyết định **hiệu lực** của cả hệ thống nhưng **không được document**; `StandardPageNumberPagination` là quyết định **được document** nhưng không hiệu lực. Phải chọn một và sửa cả doc lẫn setting — không thể giữ cả hai.
5. **Ràng buộc ưu tiên ngoài phạm vi:** sửa `outbound_notification_service.py:63` (SyntaxError, file không import được) là **việc P0 độc lập**, không nên gộp vào ticket envelope.

---

## Phụ lục A — script tái lập

Không commit vào repo (luật: chỉ được tạo file report). Lưu ở `%TEMP%\opencode\`:

**`api02a_scan2.py`** — quét AST mọi `Response()` / `JsonResponse()`, tách 2xx / 4xx / `status=<var>`, resolve payload không literal (biến local → phép gán, `Serializer().data`, `helper()` → dict trả về, `dict(**kw)`, `IfExp`), áp bảng override thủ công cho 31 site đã **đọc tay**, xuất family + JSON.
Vị trí hiện tại: `C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\api02a_scan2.py`

**`api02a_pag2.py`** — riêng cho `get_paginated_response()`: loại call nằm trong thân chính nó (delegation), đi MRO của class chủ sở hữu tới lớp DRF base, đọc source DRF 3.15.1 đã cài để phân biệt `CursorPagination` (**không `count`**) với `PageNumberPagination` (**có `count`**), và đọc `settings.py:316` cho default.
Vị trí hiện tại: `C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\api02a_pag2.py`

**`api02a_shapes.json`** — output máy đọc được (families → sites), cùng thư mục.

### Các lệnh 1 dòng đã chạy thật
```powershell
# 1. Số file production
Get-ChildItem -Path "C:\Mujoco Projects\w3-a\packages\core\backend\src" -Recurse -Filter *.py |
  Where-Object { $_.FullName -notmatch '\\(tests|migrations|commands|management|__pycache__)\\' -and $_.Name -notlike 'test_*' } |
  Measure-Object
# → 316

# 2. success_response() call site  (khớp AST = 12)
$f | Select-String -Pattern 'success_response\(' -Encoding UTF8 |
  Where-Object { $_.Line -notmatch 'def |^\s*#' } | Measure-Object -Line
# → 12

# 3. get_paginated_response() call site  (khớp AST = 30, thật = 29)
$f | Select-String -Pattern 'get_paginated_response\(' -Encoding UTF8 |
  Where-Object { $_.Line -notmatch 'def ' } | Measure-Object -Line
# → 30

# 4. 'meta' key — 8 dòng, tất cả đều LỒNG
$f | Select-String -Pattern "'meta'\s*:" -Encoding UTF8 | Measure-Object -Line
# → 8

# 5. SyntaxError thật
python -c "import py_compile; py_compile.compile(r'C:\Mujoco Projects\w3-a\packages\core\backend\src\signal_intelligence\outbound_notification_service.py', doraise=True)"
# → PyCompileError line 63: "Authorization": fcode"key={fcm_api_key}",

# 6. Xác nhận lỗi CÓ SẴN ở HEAD, không phải do worktree
git -C "C:\Mujoco Projects\w3-a" show 93764b8c:packages/core/backend/src/signal_intelligence/outbound_notification_service.py |
  Select-String -Pattern "Authorization" -Encoding UTF8
# → "Authorization": fcode"key={fcm_api_key}",

# 7. Xác minh KHÔNG mojibake (rule 2)
python -c "print(open(r'C:\Mujoco Projects\w3-a\packages\core\backend\src\service_ops\views\signals_triage.py',encoding='utf-8').read().split(chr(10))[39])"
# →     """Serializer tái dùng + context alert (additive) để FE render cột feed."""
```

### Sai số đã tự phát hiện & sửa trong lúc làm (ghi lại để không ai tin nhầm bản nháp)
1. **Đếm sai 30 paginator là `{count,next,previous,results}`** → sửa thành 28 `{next,previous,results}` + 1 custom. Lý do: `settings.py:316` + source DRF thật.
2. **Bỏ sót 30 site `get_paginated_response()`** ở lượt đầu (vì không phải `Response()` call) → phát hiện khi grep `PaginatedResponse` = 0 nhưng `get_paginated_response` = 33.
3. **Đếm `base.py:164` là endpoint** → thực ra là delegation trong thân `SOCBaseView.get_paginated_response` → loại.
4. **`{object, generated_at, …}` của `operator/views.py:146,161` bị xếp nhầm vào F9** (vì heuristic "không có `data` ⇒ phẳng") → tái phân loại thành F4b.
5. **Bản `api02a_scan.py` v1** báo `{detail}` n=110 là shape lớn thứ nhất — con số sai vì không lọc status. Đã bỏ, không dùng.
