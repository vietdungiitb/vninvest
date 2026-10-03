# Survey B — ERROR envelope

Agent `api02-survey-b` · worktree `C:\Mujoco Projects\w3-b` · branch `wip/api02-b` · base `93764b8c`
Khảo sát: chỉ đọc + chạy test. Không sửa source, không sửa test, không commit.

---

## Tóm tắt 5 dòng

1. **Contract lỗi hiện hành là `ProblemDetail.to_dict()`** (`exceptions.py:156-177`): 7 key luôn có
   (`type,title,status,detail,code,request_id,timestamp`) + 3 key có điều kiện (`instance,errors,field_errors`),
   `Content-Type: application/problem+json`.
2. **Câu "59b459dd đã đưa mọi lỗi về RFC 9457" SAI.** Handler chỉ chạy cho exception **ném ra trong view DRF**.
   Quét AST toàn `src/` (trừ `legacy_proxy.py`): **229 chỗ tự dựng shape lỗi riêng** với literal dict + status 4xx/5xx,
   trong đó **0 chỗ** mang bộ member lõi RFC 9457. 5 chỗ là `JsonResponse` thô ở middleware ⇒ không đi qua handler.
3. **47 test đỏ phân bố: (a) 23 · (b) 12 · (c) 5 · ngoài phạm vi 7.** Nhóm (a) chỉ sai URL slug
   (`/core/v1/register/` đã đổi thành `/core/v1/auth/register/`); nhóm (b) là `request_id` mất tiền tố `req_`
   (11 test) + `timestamp` mất hậu tố `Z` (1 test); nhóm (c) là tiền đề rate-limit đã lỗi thời.
4. **46/47 test đỏ đã đỏ TRƯỚC 59b459dd** (baseline `aade0a02`: 50 đỏ = 42F+8E). Commit này **sửa 4, làm hỏng 1**
   (`test_utc_only_on_django_timezone`, bộ đếm cứng 18→19). Nó **không** gây ra 46 test kia.
5. **Câu hỏi 5 ĐÚNG**: `429` sinh ra `type: "about:blank"` vì `login_rate_limit_exceeded` /
   `register_rate_limit_exceeded` / `password_reset_rate_limit_exceeded` không có trong `ProblemTypes._TABLE`
   (15 mục) trong khi `src/` dùng **62** mã `code=` khác nhau → **58 mã rơi vào `about:blank`**.

---

## Contract lỗi hiện hành (bảng key → ý nghĩa → nguồn `file:line @ 93764b8c`)

Nguồn duy nhất: `packages/core/backend/src/vninvest_core/exceptions.py`.
Hàm dựng payload: `ProblemDetail.to_dict()` — `exceptions.py:156-177`.

| key | Luôn có? | Kiểu | Ý nghĩa | Nguồn |
|---|---|---|---|---|
| `type` | ✅ luôn | str | URI của problem. `https://vninvest.dev/problems/<code>` nếu `code` có trong bảng, ngược lại `about:blank` | `exceptions.py:158` (gán ở `:138` từ `ProblemTypes.resolve` `:76-88`); base URI `:44` |
| `title` | ✅ luôn | str | Hằng số theo status, **không** phải thông báo cụ thể | `exceptions.py:159` (gán ở `:139`); bảng `ProblemTypes._TABLE` `:58-74`; fallback `_default_title` `:91-106` |
| `status` | ✅ luôn | int | HTTP status, trùng `Response.status` | `exceptions.py:160` |
| `detail` | ✅ luôn | **str hoặc dict** | Mô tả cụ thể. **Vi phạm RFC 9457 §3.1.4 khi là dict** — xem "Mâu thuẫn" M1 | `exceptions.py:161`; nguồn dict: `identity_access/views/register.py:164` truyền thẳng `serializer.errors` |
| `code` | ✅ luôn | str | Mã lỗi nghiệp vụ — **member mở rộng** (không phải của RFC) | `exceptions.py:162` |
| `request_id` | ✅ luôn | str | Khóa tra log. **Member mở rộng** | `exceptions.py:163`; sinh ở `:146`; nguồn thật `_request_id_for` `:581-593` |
| `timestamp` | ✅ luôn | str ISO-8601 | **Member mở rộng**, giữ lại để không phá client cũ (chú thích `:164-168`) | `exceptions.py:169`; sinh ở `:154` |
| `instance` | ⚠️ nếu truthy | str | Path của request | `exceptions.py:171-172` |
| `errors` | ⚠️ nếu non-empty | **array** `[{field, code, message}]` | **Member mở rộng**, dạng mảng (cố ý khác `field_errors`) | `exceptions.py:173-174`; sinh từ `_errors_from_field_errors` `:264-276` |
| `field_errors` | ⚠️ nếu non-empty | **object** `{field: [msg]}` | **Member mở rộng**, giữ shape cũ (D-10) | `exceptions.py:175-176` |

### Header

| header | Nguồn |
|---|---|
| `Content-Type: application/problem+json` | hằng `:47`; ép trong `ProblemResponse.rendered_content` `:238-242` (nhánh DRF) và `to_django_response` `:219` (nhánh Django) |
| `X-Request-ID: <request_id>` | `:198` (DRF), `:220` (Django) |

### Ba đường render (không phải một)

| đường | hàm | dùng khi |
|---|---|---|
| DRF view | `ProblemDetail.to_response()` `:179-199` → `ProblemResponse` `:224-242` | exception ném trong view DRF |
| Django handler | `ProblemDetail.to_django_response()` `:201-221` | `handler400/403/404/500`, gán ở `vninvest_core/urls.py:94-97` |
| không xử lý | `core_api_exception_handler` trả `None` cho `exc` không map được | **không còn xảy ra** — nhánh cuối `:684-701` luôn trả problem 500 |

Handler được gắp **một lần toàn cục** tại `vninvest_core/settings.py:332`
(`'EXCEPTION_HANDLER': 'vninvest_core.exceptions.core_api_exception_handler'`) ⇒ không view DRF nào
thoát được khỏi nó. Nhưng ngược lại: **view nào `return Response({...}, status=4xx/5xx)` thì handler
không bao giờ chạy** — đó là lỗ hổng thật, xem mục kế.

### Payload thật, đo được (không mô tả suông)

Lệnh tái lập (xem "Lệnh" ở cuối mục):
`POST /core/v1/auth/login/` lần 4 → 429, và `POST /core/v1/auth/register/` body rỗng → 400:

```json
{"type":"about:blank","title":"Rate limit exceeded","status":429,
 "detail":"Quá nhiều yêu cầu đăng nhập cho tài khoản này. Vui lòng thử lại sau 1 phút.",
 "code":"login_rate_limit_exceeded","request_id":"1e9a041d-8e6e-4857-ba4e-e7fb31172527",
 "timestamp":"2026-09-30T08:18:49.925709+00:00","instance":"/core/v1/auth/login/"}
```

```json
{"type":"https://vninvest.dev/problems/validation_error","title":"Invalid request","status":400,
 "detail":{"username":["This field may not be blank."],"email":["Enter a valid email address."],
           "password_confirm":["This field is required."]},
 "code":"validation_error","request_id":"d52c9ed3-aac2-4a40-87ef-a4c4861fbfbe",
 "timestamp":"2026-09-30T08:18:49.934548+00:00","instance":"/core/v1/auth/register/"}
```

Lưu ý ở payload 400: **`detail` là dict, và `errors`/`field_errors` vắng mặt** dù thông tin field có mặt.
Lý do: `register.py:164` đưa `serializer.errors` vào `detail` mà không đưa vào `field_errors`, còn
`core_api_exception_handler:622` truyền thẳng `detail=exc.detail` — không qua `_field_errors_from_detail`
(đường này chỉ chạy cho `ValidationError` của DRF ở `:628` và `APIException` ở `:676`).

### `StandardErrorEnvelope` — đã chết, nhưng docstring nói còn sống

`exceptions.py:11-24` khẳng định `StandardErrorEnvelope` "**được giữ lại** và vẫn xuất hiện trong
`to_problem()` dưới tên thành viên mở rộng". Cả hai vế đều không đúng với code:
- Không có hàm `to_problem()` nào trong repo.
- `StandardErrorEnvelope` (`exceptions.py:382-439`) **không được handler dùng**;
  `CoreAPIException.get_envelope()` (`:479-487`) là nơi duy nhất trả về nó và
  **không có call site nào** (grep `get_envelope` chỉ ra 1 kết quả = chính dòng định nghĩa).

Tương thích ngược thực tế đến từ chỗ **nhân bản key** trong `ProblemDetail.to_dict()` (`:156-177`),
không phải từ việc giữ class. Lớp này giờ chỉ còn sống trong
`vninvest_core/tests/test_status_codes_and_errors.py:263-327` (4 unit test, đang xanh).

---

## Chỗ tự dựng shape lỗi riêng (bảng)

**Con số: 229 chỗ.** Phương pháp: AST thật (`ast.walk` tìm `Call` tới `Response`/`JsonResponse`/`ProblemResponse`,
`status=` là 4xx/5xx, body là `ast.Dict` literal có ít nhất key trong
`{detail,error,code,errors,field_errors,message}`). Loại trừ `legacy_proxy.py`, `tests/`, `migrations/`.
Lệnh tái lập ở cuối mục.

| Chỉ số | Số |
|---|---|
| Tổng chỗ tự dựng shape lỗi | **229** |
| … trong đó mang **đủ** 7 member lõi RFC 9457 (`type,title,status,detail,code,request_id,timestamp`) | **0** |
| … là `JsonResponse` thô (bypass handler DRF hoàn toàn) | **5** |
| … là `Response` của DRF, không có `code`/`request_id`/`type` | **177** |
| Số file chứa ít nhất 1 chỗ | 34 |

### 5 chỗ `JsonResponse` thô — nguy hiểm nhất vì không ai sửa được qua handler

| file:line | status | keys |
|---|---|---|
| `identity_access/middleware.py:77` | 403 | `detail, error` |
| `identity_access/middleware.py:100` | 403 | `detail, error` |
| `identity_access/middleware.py:110` | 403 | `detail, error` |
| `identity_access/middleware.py:119` | 403 | `detail, error` |
| `identity_access/middleware.py:419` | **429** | `detail, error, limit, period, used` |

Cả 5 nằm trong `TenantResolutionMiddleware` / quota middleware ⇒ chạy **trước** `APIView`, trả
`Content-Type: application/json`, dùng key `error` thay vì `code`, không có `type`/`title`/`request_id`/`timestamp`.
Riêng `middleware.py:419` là **một 429 thứ hai, hoàn toàn khác shape** với 429 của `core_api_exception_handler`.

### 10 signature shape phổ biến nhất (trong 229)

| signature | số lần |
|---|---|
| `detail` | 117 |
| `code,detail` | 44 |
| `error` | 27 |
| `detail,error` | 7 |
| `error,ok` | 7 |
| `message,ok` | 6 |
| `message,ok,symbol` | 3 |
| `detail,retry_after_seconds,scope` | 2 |
| `error,message` | 2 |
| `code,detail,ownership,request_id,timestamp,write_block_reason` | 2 |

Signature phổ biến nhất (`detail` đơn thuần, 117 chỗ) **không có `code`** ⇒ client không phân biệt được
lỗi nào. Signature `code,detail` (44 chỗ) gần nhất với contract, nhưng `code` đó là mã riêng của view
(xem mục 429) chứ không phải mã trong `ProblemTypes._TABLE`.

### File có nhiều chỗ nhất

`identity_access/views_webhooks.py` (11), `market_data/stock_mgmt_native_views.py` (25),
`identity_access/views/sso.py` (17), `identity_access/views_operator.py` (15),
`service_ops/views/symbol_groups.py` (12), `identity_access/views_reports.py` (6),
`user_workspace/portfolio_analytics_views.py` (11), `support/views.py` (10),
`identity_access/views_alert_config.py` (5), `service_ops/views/users.py` (11).

### Lệnh tái lập

Script: `C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\scan_shapes.py`
```
$env:PYTHONIOENCODING="utf-8"; python scan_shapes.py
```

---

## 47 test: phân loại (a)/(b)/(c) — kèm lệnh tái lập số đếm

### Lệnh tái lập số đếm

```powershell
# HEAD — xác nhận 47
cd C:\Mujoco Projects\w3-b\packages\core\backend
$env:CORE_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/w3seed"; $env:DJANGO_DEBUG="1"
python manage.py test vninvest_core --noinput -v 2
# -> Ran 229 tests ... FAILED (failures=47)

# đếm theo file
Select-String -Path <log> -Pattern '^(FAIL|ERROR): ' -Encoding UTF8 | Measure-Object
```

### Phương pháp tách (a) khỏi (b)/(c) — thí nghiệm, không đoán

Tôi **không** đoán test nào "chỉ sai URL". Tôi dựng một sandbox ngoài repo bằng
`git archive 93764b8c` rồi thêm 4 alias URL legacy vào `identity_access/urls.py` của sandbox, chạy lại
4 file trong phạm vi, và so kết quả:

| lần chạy | lệnh | kết quả |
|---|---|---|
| HEAD thật | `python manage.py test vninvest_core` | 47 đỏ (trong 4 file này: **40**) |
| HEAD + alias URL | `python manage.py test vninvest_core.tests.test_exception_handling vninvest_core.tests.test_exception_handling_a6 vninvest_core.tests.test_status_codes_and_errors vninvest_core.tests.test_rate_limiting` | `Ran 59 tests … FAILED (failures=19)` (trong 4 file: **19**) |

⇒ **40 − 23 = 17** test vẫn đỏ sau khi URL đúng. Đó là phần (b)+(c).

### Kết quả phân loại

| nhóm | số | tiêu chí |
|---|---|---|
| **(a) vẫn đúng, chỉ sai URL/slug** | **23** | thêm alias URL là xanh, không còn assert nào hỏng |
| **(b) đúng nội dung, sai tên key / hình dạng** | **12** | 11 test đòi `request_id` có tiền tố `req_`; 1 test đòi `timestamp` hậu tố `Z` |
| **(c) thực sự trái ý định thiết kế mới** | **5** | tiền đề rate-limit/serializer đã lỗi thời, không sửa slug cũng không xanh |
| **ngoài phạm vi 4 file** | **7** | 6 test tenant-isolation + 1 test canary timezone |
| **tổng** | **47** | |

### (a) — 23 test, chỉ sai URL slug

Tất cả gọi `/core/v1/register/`, `/core/v1/login/`, `/core/v1/password-reset/`, `/core/v1/password-reset/confirm/`.
Slug đúng ở `identity_access/urls.py:51-55` là `/core/v1/auth/register/`, `/core/v1/auth/login/`,
`/core/v1/auth/password-reset/`, `/core/v1/auth/password-reset/confirm/`.
Bằng chứng route đã đổi: `identity_access/urls.py:47` chú thích *"Merged from deleted api_urls.py
(Phase 0 - DJANGO_API_ROUTING_CLEANUP)"*. Ngay cả docstring của chính file test đã ghi slug chuẩn
`/api/auth/register/` (`test_rate_limiting.py:114,200,388,398,406`) — biến `self.register_url` chưa
bao giờ được cập nhật theo.

`test_duplicate_email_returns_409_conflict`, `test_duplicate_registration_returns_conflict_or_bad_request`,
`test_duplicate_username_returns_409_conflict`, `test_exception_with_none_values`,
`test_invalid_register_returns_400_bad_request`, `test_login_rate_limit_429_with_envelope`,
`test_login_sixth_request_rate_limited`, `test_missing_required_fields_returns_400_not_500`,
`test_password_reset_confirm_invalid_token_returns_400_bad_request`,
`test_password_reset_confirm_valid_token_returns_200_ok`,
`test_password_reset_different_emails_independent_limits`, `test_password_reset_fourth_request_rate_limited`,
`test_password_reset_limit_expires_after_window`, `test_password_reset_nonexistent_email_returns_200_ok`,
`test_password_reset_request_returns_200_ok`, `test_password_reset_returns_proper_response`,
`test_password_reset_within_limit`, `test_rate_limit_exception_returns_429`, `test_register_returns_201_created`,
`test_success_response_preserves_envelope_compatibility`, `test_validation_error_has_standard_envelope`,
`test_validation_error_returns_400_not_500`, `test_validation_exception_returns_proper_response`

> Lưu ý: `test_success_response_preserves_envelope_compatibility` (`:239-260`) đòi success envelope có
> `status` + `data` — **thuộc scope SUCCESS envelope của agent A**, không phải scope của tôi. Tôi chỉ xác
> nhận nó xanh sau khi sửa URL.

### (b) — 12 test, đúng ý nhưng sai hình dạng

**(b1) 11 test — `request_id` mất tiền tố `req_`.** Đây là **lỗi thật trong sản phẩm, không phải test sai**:
`RequestTraceMiddleware` gán `request.META['X_REQUEST_ID'] = str(uuid.uuid4())` —
UUID trần, **không** có tiền tố (`ops_audit/middleware.py:27-28`).
`_request_id_for` (`exceptions.py:581-593`) ưu tiên `meta.get('X_REQUEST_ID')` nên nhánh sinh
`req_{uuid4().hex[:16]}` ở `exceptions.py:146` / `:592` **không bao giờ chạy trong production**.
Đo được: body trả `"request_id":"1e9a041d-8e6e-4857-ba4e-e7fb31172527"`.
Lỗi này **có trước 59b459dd** (bản `aade0a02` đã có cùng thứ tự ưu tiên) nhưng 59b459dd **không sửa**,
trong khi docstring `exceptions.py:142-145` vẫn mô tả `req_` như hành vi.

`test_exception_handling.py:65` · `:91` · `:107` · `:213` · `:232` ·
`test_exception_handling_a6.py:52` · `:74` · `:141` ·
`test_rate_limiting.py:110` · `:297` · `test_status_codes_and_errors.py:237`

**(b2) 1 test — `timestamp` mất hậu tố `Z`.** Đây là **regression do chính 59b459dd**:
`StandardErrorEnvelope` cũ sinh `datetime.utcnow().isoformat() + 'Z'` (`exceptions.py:420`) → **có** `Z`.
`ProblemDetail` mới sinh `datetime.now(dt_timezone.utc).isoformat()` (`exceptions.py:154`) → `+00:00`, **không** `Z`.
Đo được: `"timestamp":"2026-09-30T08:18:49.925709+00:00"`.
Test `test_error_envelope_has_iso8601_timestamp` (`test_status_codes_and_errors.py:215`,
`assertTrue(timestamp.endswith('Z'))`) là **đúng** vì `Z` là ISO-8601 hợp lệ và là hợp đồng đã phát ra
trước đây. Cả hai dạng đều parse được, nhưng đổi hình dạng giữa chừng là phá hợp đồng — đúng cái mà
chính `exceptions.py:164-168` nói là muốn tránh khi giữ `timestamp`.

### (c) — 5 test, thực sự trái ý định thiết kế

Cả 5 đều về **tiền đề rate-limit của register**, không liên quan shape lỗi. Test giả định
"3 request/phút mỗi IP, request lỗi cũng tiêu ngân sách". Code hiện tại đã **cố ý đảo**:
- `register.py:147` gọi `enforce_rate_limit(..., consume=False)` — chỉ **peek**, không trừ ngân sách
  (chú thích `:132` "Peek only: the attempt budget is NOT consumed yet (A6)").
- `register.py:154-162` dùng bucket riêng `register-malformed` với ngưỡng
  `REGISTER_IP_LIMIT_THRESHOLD * MALFORMED_ATTEMPT_IP_MULTIPLIER` = `3 * 3 = 9` (`register.py:52,74`).

⇒ 3 request lỗi đầu của test không tiêu ngân sách IP, nên request thứ 4 trả **400** chứ không **429**.
Đây là hành vi **đúng ý định bảo mật** (payload hỏng không được khoá user thật ra khỏi lần thử thật);
**test là bên lỗi**.

`test_register_rate_limit_429_with_envelope` (`test_exception_handling_a6.py:257`, `400 != 429`) ·
`test_register_rate_limit_error_envelope` (`test_rate_limiting.py:188`, `400 != 429`) ·
`test_register_fourth_request_rate_limited` (`test_rate_limiting.py:161`, `400 != 429`) ·
`test_register_limit_expires_after_window` (`test_rate_limiting.py:334`, `400 != 429`) ·
`test_register_within_limit` (`test_rate_limiting.py:135`, `400 not found in [201, 409]`;
serializer nay bắt buộc `password_confirm` + Turnstile nên payload test không tạo được user)

### 7 test ngoài 4 file trong phạm vi

| test | vì sao đỏ | thuộc ai |
|---|---|---|
| `test_T19`–`test_T23` legacy watchlist/securities (5 test) | `503 != 200/404/204`. `legacy_proxy.py:90` trả 503 với `code='LEGACY_BACKEND_NOT_CONFIGURED'` khi `LEGACY_BACKEND_URL` chưa set ⇒ **lỗi môi trường**, không phải lỗi contract | ngoài phạm vi |
| `test_T11_portfolio_list_pagination_format` | response không có `count` ⇒ SUCCESS/pagination envelope | **agent A** |
| `test_utc_only_on_django_timezone` | bộ đếm cứng `EXPECTED_STDLIB_USES = 18` (`test_no_timezone_utc.py:35`) thấy **19**. 59b459dd thêm `from datetime import … timezone as dt_timezone` (`:28`) + `datetime.now(dt_timezone.utc)` (`:154`) | xem dưới |

### Kiểm chứng lại "47 test đỏ" và "59b459dd đã đưa mọi lỗi về RFC 9457"

**(1) "47 test đỏ" — ĐÚNG, đã đo.** `Ran 229 tests … FAILED (failures=47)`, `errors=0`.

**(2) "mọi lỗi về RFC 9457" — SAI, đã đo.** 229 chỗ tự dựng shape, 0 chỗ có member lõi.
Handler chỉ bắt được exception **ném ra**; 177 `Response` + 5 `JsonResponse` là **return**, không ném.

**(3) Claim trong commit body 59b459dd: "GT9 full suite: 642 test, 11F/2E — bằng đúng baseline" — KHÔNG KHỚP.**
Đo lại app `vninvest_core` ở chính commit đó và ở cha nó:

| commit | lệnh | kết quả |
|---|---|---|
| `aade0a02` (cha, trước RFC) | `python manage.py test vninvest_core` | `Ran 195 tests … FAILED (failures=42, errors=8)` = **50 đỏ** |
| `93764b8c` (HEAD, sau RFC) | `python manage.py test vninvest_core` | `Ran 229 tests … FAILED (failures=47, errors=0)` = **47 đỏ** |

Set-diff (script `diff_runs.py`):
- **4 test được SỬA**: `test_all_auth_endpoints_return_error_not_500`,
  `test_exception_handler_invoked_on_auth_error`, `test_exception_handler_invoked_on_validation_error`,
  `test_request_ids_are_unique` (3 test sau chuyển từ ERROR → xanh; `Http404`/`DjangoPermissionDenied`
  nay được bắt ở `exceptions.py:646-655`).
- **46 test đỏ CẢ TRƯỚC LẪN SAU** — không phải do commit này.
- **1 hồi quy MỚI**: `test_utc_only_on_django_timezone` (xanh ở `aade0a02`, đỏ ở HEAD).

Về `test_utc_only_on_django_timezone`: phần `offenders` vẫn rỗng (`:135-141`) ⇒ **code đúng**,
`dt_timezone.utc` là chính tả stdlib đúng. Chỉ assert đếm ở `:142-149` bắt buộc. Đây là **canary** —
nó đỏ bất cứ khi nào ai đụng stdlib timezone, kể cả thay đổi đúng. Xử lý đúng là bump `EXPECTED_STDLIB_USES`
18 → 19, **không** phải sửa code.

Con số `642 test / 11F / 2E` trong commit body nhiều khả năng đo **full backend suite**, không phải app
`vninvest_core`. Tôi **không xác minh được** con số đó (xem cuối báo cáo).

---

## FE consumer của shape lỗi

**Có, đúng một chỗ:** `packages/web/src/adapters/core/transport.js` — hàm `toCoreApiRequestError`
(`:281-310`), đọc 4 trường:

| đọc gì | dòng | ảnh hưởng khi shape đổi |
|---|---|---|
| `payload.detail \|\| payload.message` | `:286-290` | dùng làm `Error.message` |
| `payload.field_errors \|\| payload.errors` → `error.fieldErrors` | `:291-292` | ⚠️ xem bên dưới |
| `payload.request_id` → `error.requestId` | `:293-294` | an toàn — vẫn là extension member |
| `payload.code` → `error.code` | `:295-296` | an toàn — vẫn là extension member |

Lớp `CoreApiRequestError` (`transport.js:239-251`) chỉ lưu `status/statusText/path/payload/code/fieldErrors/requestId`.

### FE có hỏng không?

**Không hỏng** với phần lớn thay đổi. Cụ thể:
- FE **không** đọc `type`, `title`, `status` (trong body), `instance` ⇒ thêm 4 member này vô hại.
- `code` / `request_id` / `timestamp` được giữ đúng như extension member ⇒ không đứt.
- `detail` là dict (payload 400 ở trên) **vẫn được xử lý**:
  `authErrors.js:142-143` kiểm tra `isPlainObject(error?.payload?.detail)` rồi nối vào map field.
  ⇒ vi phạm M1 **không** làm hỏng FE.

**Một điểm mềm thật sự:** `errors[]` mới là **mảng** `[{field, code, message}]`
(`exceptions.py:150-151`, `:264-276`) nhưng `authErrors.js:145` chỉ nhận
`isPlainObject(error?.fieldErrors)` ⇒ **mảng bị bỏ âm thầm, không ném lỗi**. Chỉ xảy ra trên đường
truyền `errors=` mà không kèm `field_errors=`; ở các endpoint auth đang chạy, `field_errors`
được dựng từ `_field_errors_from_detail` (`:628`, `:676`) nên chưa lộ. Đây là **nợ ngầm**, không phải
hỏng đang xảy ra.

Ngoài ra `authErrors.js:157-164` (`resolveRetryAfterSeconds`) đọc `payload.retry_after`/`retryAfter` —
backend **không** gửi 2 key này; chính chú thích `:151-156` thừa nhận và dùng cooldown mặc định.
Lỗi có trước, không liên quan RFC 9457.

---

## 429 / rate limit

### Có 3 shape 429 khác nhau trong cùng hệ thống

| # | nguồn | `type` | `code` | `Content-Type` | có `request_id`? |
|---|---|---|---|---|---|
| 1 | `RateLimitErrorException` qua `core_api_exception_handler` (login/register/password-reset) | **`about:blank`** | `login_rate_limit_exceeded` / `register_rate_limit_exceeded` / `password_reset_rate_limit_exceeded` | `application/problem+json` | ✅ (UUID trần) |
| 2 | quota middleware `identity_access/middleware.py:419` | — không có | `error: 'quota_exceeded'` (+`limit,used,period`) | `application/json` | ❌ |
| 3 | `legacy_proxy.py:90` | không có `ProblemDetail` | `LEGACY_BACKEND_NOT_CONFIGURED`, 503 | `application/json` | ❌ |

### Câu hỏi 5: `type` có phải `about:blank` không? — **CÓ, đã đo**

Gợi ý của bạn đúng. `ProblemTypes._TABLE` (`exceptions.py:58-74`) chỉ có **15** mục, trong đó mục
duy nhất liên quan 429 là `rate_limit_exceeded`. Nhưng `security_utils.enforce_rate_limit` nhận
`code` từ call site và mặc định chính là `'rate_limit_exceeded'` (`security_utils.py:103`) —
còn ba call site auth **truyền mã riêng**:

- `identity_access/views/login.py:118` → `code='login_rate_limit_exceeded'`
- `identity_access/views/register.py:147,161,187` → `code='register_rate_limit_exceeded'`
- `identity_access/views/password_reset.py:77` → `code='password_reset_rate_limit_exceeded'`

Cả 3 không có trong `_TABLE` ⇒ `ProblemTypes.resolve` (`:85-88`) rơi vào nhánh
`return 'about:blank', _default_title(status_code)`.

Đo được trên response thật:
```json
{"type":"about:blank","title":"Rate limit exceeded","status":429, ...,
 "code":"login_rate_limit_exceeded", ...}
```

### Quy mô: 58 mã rơi vào `about:blank`

Đếm bằng AST/regex trên `src/` (trừ `tests/`, `migrations/`, `legacy_proxy.py`, và chính `exceptions.py`):

| chỉ số | số |
|---|---|
| số mục trong `ProblemTypes._TABLE` | **15** |
| số mã `code=` khác nhau tại call site thật | **62** |
| … **KHÔNG** có trong `_TABLE` ⇒ `type = about:blank` | **58** |
| … có trong `_TABLE` | **4** |
| trong 58 mã đó, mã viết `lower_snake` (nhóm đáng lẽ phải chuẩn hoá) | **27** |

27 mã `lower_snake` rơi vào `about:blank`:
`account_unavailable`, `alert_not_found`, `broker_not_supported`, `broker_unavailable`,
`broker_writes_disabled`, `expired`, `invalid_credentials`, `invalid_refresh_token`,
`invalid_reset_token`, `invalid_token`, `login_rate_limit_exceeded`, `missing_cvd_buckets`,
`missing_session_facts`, `not_supported_yet`, `password_confirmation_mismatch`,
`password_reset_rate_limit_exceeded`, `register_rate_limit_exceeded`, `resend_cooldown_active`,
`resend_failed`, `service_account_inactive`, `tenant_not_found`, `test_connection_rate_limited`,
`upstream_error`, `user_inactive`, `verification_locked_out`, `verification_rate_limited`, `weak_password`.

31 mã còn lại là `UPPER_SNAKE` của app `service_ops` (vd `CONFIG_CONFLICT`, `SCHEDULER_JOB_NOT_FOUND`) —
tự dựng shape ở `Response`, không đi qua handler nên còn không có `type` nào để nói.

**Kết luận nhất quán:** `type` **không** nhất quán. RFC 9457 §3.1.1 nói `type` phải là URI; ở đây
94% mã lỗi trả `about:blank`, tức client **không** phân nhánh được bằng `type` — buộc phải so `code`
đúng như chú thích `exceptions.py:40-43` nói. Tức `type` gần như vô nghĩa ở hệ thống này.

### Nhất quán với phần còn lại?

**Không.** Ba điểm:
1. `type` không nhất quán (58/62 mã → `about:blank`).
2. `request_id` không nhất quán: qua handler thì có (UUID trần), qua `middleware.py:419` thì không có.
3. 429 của `middleware.py:419` dùng key `error`/`detail`/`limit`/`used`/`period` — FE `transport.js:295`
   đọc `payload.code` sẽ nhận `null` ⇒ `resolveErrorCode` (`authErrors.js:174-179`) rơi về `""` ⇒
   hiển thị `auth.errorCodeUnknown` thay vì mã cụ thể.

---

## Mâu thuẫn cần quyết định

**M1 — `detail` phải là string, nhưng code truyền dict.** RFC 9457 §3.1.4 định nghĩa `detail` là string.
`identity_access/views/register.py:164` truyền `detail=serializer.errors` (dict) vào
`ValidationErrorException`; `core_api_exception_handler:622` chuyển thẳng vào `ProblemDetail`.
Đo được: `"detail":{"username":[...],...}`. Hệ quả kép: (i) vi phạm chuẩn; (ii) `errors`/`field_errors`
vắng mặt ở chính response đó ⇒ **lập luận D-10 "giữ `field_errors` cho client cũ" không đúng ở đường này**.
Cần quyết: `detail` luôn là string + `field_errors` mang dữ liệu field, hay chấp nhận dict.

**M2 — `StandardErrorEnvelope` sống hay chết.** Docstring `exceptions.py:11-24` nói nó được giữ và
vẫn xuất hiện trong `to_problem()`. Cả hai vế sai: không có `to_problem()`, và handler không dùng
lớp này (chỉ `get_envelope()` `:479-487` trả về nó, **không call site nào**). Cần quyết: xoá lớp +
4 unit test, hay sửa docstring.

**M3 — `request_id` có tiền tố `req_` không?** 11 test + docstring `exceptions.py:142-145` nói có;
`ops_audit/middleware.py:27-28` + đo thực tế nói không. Cần quyết: sửa middleware thành `req_…`, hay
bỏ kỳ vọng `req_`. Đây là quyết định **rẻ nhất và giá trị cao nhất** trong toàn bộ nhóm lỗi.

**M4 — `timestamp` kết thúc bằng `Z` hay `+00:00`?** `exceptions.py:154` (mới) vs `:420` (cũ) vs
`test_status_codes_and_errors.py:215`. Cả hai đều ISO-8601 hợp lệ. Cần chọn một và ghi vào contract.

**M5 — `type` có đáng giữ không?** Với 58/62 mã rơi vào `about:blank`, `type` không mang thông tin phân
nhánh. Hoặc đăng ký 27 mã `lower_snake` vào `_TABLE`, hoặc thừa nhận `code` là khoá chính và `type` là
trang trí. Ước lượng công sức: ~27 dòng bảng.

**M6 — 229 chỗ tự dựng shape: giữ nguyên hay thu hồi?** Thu hồi toàn bộ là thay đổi rủi ro cao
(33 file). Trung gian khả thi: chỉ 5 chỗ `JsonResponse` ở `identity_access/middleware.py` + 44 chỗ
`code,detail` — đây là 2 nhóm nhỏ, giá trị cao nhất. Cần owner chọn mức.

**M7 — 5 test rate-limit của register thuộc về ai?** Chúng đỏ vì test giả định ngân sách bị tiêu khi
payload hỏng, còn code đã cố ý đảo (`register.py:147` `consume=False`). Sửa test, không sửa code.

---

## KHÔNG XÁC MINH ĐƯỢC

1. **Con số `642 test / 11F / 2E` trong commit body 59b459dd không đối chiếu được.** Tôi chỉ chạy được
   app `vninvest_core` (229 test). Chạy full backend suite cần thời gian > budget phiên này, và DB test
   dùng chung tên nên không thể chạy song song. Nếu số 11F/2E là thật thì nó **không mô tả** app
   `vninvest_core` — cần tái lập riêng trước khi dùng làm baseline.
2. **`?` thay cho tiếng Việt trong console KHÔNG phải mojibake — đã xác minh.** Quét encoding toàn `src/`
   bằng `open(..., encoding='utf-8')`: `NOT-UTF8 files skipped: 0`. Đọc trực tiếp
   `identity_access/views/login.py:53` bằng tool `read` cho ra `'Tên đăng nhập và mật khẩu không được để trống.'`
   — file sạch. Đây là hiện ứng cp1252 của console. **Không ai được báo mojibake cho file tiếng Việt
   trong repo này.**
3. **`signal_intelligence/outbound_notification_service.py:63` có `SyntaxError` khi `ast.parse`** ⇒
   file đó **không** được quét bởi bộ đếm 229. Nếu nó chứa `Response` 4xx/5xx thì con số 229 là **dưới**
   thực tế. (Nghi vấn: template hoặc cú pháp hỏng sẵn — ngoài phạm vi, chưa xác minh.)
4. **`_python_sources()` trong `test_no_timezone_utc.py` quét phạm vi nào** — tôi chỉ xác minh được
   rằng 18→19 do `exceptions.py:28,154`, chưa xác minh đầy đủ 19 chỗ đếm được là gì.
5. **Không xác minh hành vi 429 của `register` trên HTTP thật** — chỉ suy ra từ
   `register.py:147,154-162` + `settings.py:876-878` + kết quả test `400 != 429`. Không bắn request
   thật qua tenant/production config.
6. **Không xác minh `test_problem_json.py` (34 test, 573 dòng) có đúng là 34 test và đều xanh** —
   suy ra từ chênh lệch `229 − 195 = 34` và việc `errors=0` ở HEAD. Chưa đọc file.
7. **Không chạy FE test.** Nhận định về `authErrors.js:145` bỏ mảng `errors[]` là **đọc tĩnh code**,
   chưa có test chứng minh. Đường `errors=` không kèm `field_errors=` hiện **không** được
   `vninvest_core` dùng, nên tôi không tìm thấy endpoint nào đang bị nó ảnh hưởng.

---

## Ràng buộc cho quyết định contract (tối đa 5 dòng)

1. Handler chỉ bắt được **exception ném trong view DRF**; 229 chỗ `return Response(4xx/5xx)` không đi qua
   nó ⇒ đừng hứa "mọi lỗi là problem+json" trước khi thu hồi hoặc chấp nhận ngoại lệ.
2. Giữ `code` + `request_id` + `timestamp` là **bắt buộc** — FE đọc theo tên ở `transport.js:291-296`.
3. Sửa `ops_audit/middleware.py:27` thành `req_…` **hoặc** bỏ kỳ vọng `req_` ở 11 test — chọn một,
   đừng để hai bên trái nhau; đây là nợ lâu năm không phải do RFC 9457.
4. Chốt `timestamp` (`Z` hay `+00:00`) và `detail` (string hay dict) **trước**, vì 12 test trong nhóm (b)
   và 5 chỗ FE đang phụ thuộc vào hai quyết định này.
5. Nếu giữ `type` làm khoá phân nhánh thì phải đăng ký 27 mã `lower_snake` vào `ProblemTypes._TABLE`;
   nếu không thì ghi rõ trong contract rằng `code` mới là khoá phân nhánh, còn `type` là `about:blank`.

---

## Phụ lục — lệnh tái lập đầy đủ

```powershell
# 0. biến môi trường
$env:CORE_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/w3seed"
$env:DJANGO_DEBUG="1"

# 1. HEAD — 47 đỏ
cd C:\Mujoco Projects\w3-b\packages\core\backend
python manage.py test vninvest_core --noinput -v 2 *> head.log
Select-String -Path head.log -Pattern '^(FAIL|ERROR): ' -Encoding UTF8 | Measure-Object

# 2. baseline cha (read-only, ngoài repo)
cd C:\Mujoco Projects\w3-b
git archive aade0a02 packages/core/backend | tar -x -C C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\base_aade0a02
cd C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\base_aade0a02\packages\core\backend
python manage.py test vninvest_core --noinput -v 2 *> base.log      # -> failures=42, errors=8

# 3. sandbox thí nghiệm phân loại (a) vs (b)/(c)
cd C:\Mujoco Projects\w3-b
git archive 93764b8c packages/core/backend | tar -x -C C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\head_alias
# thêm 4 alias vào identity_access/urls.py:54-57 của SANDBOX (không sửa repo)
cd C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\head_alias\packages\core\backend
python manage.py test vninvest_core.tests.test_exception_handling vninvest_core.tests.test_exception_handling_a6 vninvest_core.tests.test_status_codes_and_errors vninvest_core.tests.test_rate_limiting --noinput -v 2
# -> Ran 59 tests ... FAILED (failures=19)

# 4. đếm shape tự dựng (AST)
$env:PYTHONIOENCODING="utf-8"; python C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\scan_shapes.py

# 5. đếm mã code -> about:blank
$env:PYTHONIOENCODING="utf-8"; python C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\recount.py

# 6. probe payload thật (cần override CACHES vì Redis không chạy ngoài test)
$env:PYTHONIOENCODING="utf-8"
python manage.py shell -c "exec(open(r'C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\probe_429.py', encoding='utf-8').read())"
```

> Sandbox ở bước 3 nằm ngoài repo, dùng `git archive` (không ghi `.git`), đã xoá sau khi đo.
> **Không sửa file nào trong `C:\Mujoco Projects\w3-b`.** Đã kiểm tra `git status` sạch trước khi viết báo cáo này.
