# PA-1 — Order safety gates (agent `pf1-ordersafety`)

**Branch:** `feat/pf1-ordersafety` · **Worktree:** `C:\Mujoco Projects\pf1-ordersafety`
**DB:** `ag_pf1_ordersafety` (`postgresql://vninvest:***@127.0.0.1:5433/ag_pf1_ordersafety`)
**Audit:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1 `P0-SAFETY-01`
**Base `dev`:** `51776e83`

Môi trường dùng cho mọi lệnh BE:

```powershell
$env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf1_ordersafety"
$env:DJANGO_DEBUG = "1"
cd C:\Mujoco Projects\pf1-ordersafety\packages\core\backend
```

> `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` **KHÔNG TỒN TẠI**
> — không có trong worktree này lẫn main tree (`C:\Mujoco Projects\vninvest`).
> Mọi bằng chứng dưới đây tự tạo lại từ source, không suy diễn từ file đó.

---

## 1. Test ĐỎ trước khi sửa (bắt buộc — bằng chứng X.1/X.2 là thật)

```powershell
python manage.py test user_workspace.test_order_safety user_workspace.test_broker_routes_unique -v 1
```

```
Ran 42 tests in 34.233s

FAILED (failures=32, errors=20)
```

### 1.1 X.1 — mọi lệnh DNSE từ UI trả HTTP 400 (regression từ `275fcd78`)

Cả 2 caller FE gửi `quantity`, BE chỉ đọc `volume`
(`views_dnse.py:72` → `int(None)` → `TypeError`):

```
FAIL: test_quantity_key_accepted_regression_x1
AC-3: caller FE gửi `quantity` ⇒ 200/201, KHÔNG 400.
----------------------------------------------------------------------
Traceback (most recent call last):
  File "...\user_workspace\test_order_safety.py", line 130, in test_quantity_key_accepted_regression_x1
    self.assertIn(resp.status_code, (200, 201))
AssertionError: 400 not found in (200, 201) : b'{"detail":"Kh\xe1\xbb\x91i l\xc6\xb0\xe1\xbb\xa3ng
ph\xe1\xba\xa3i l\xc3\xa0 s\xe1\xba\x91 nguy\xc3\xaan.","code":"validation_error", ...}'
```

Bằng chứng caller FE (grep toàn repo, 3/3 dùng `quantity`, 0 dùng `volume`):

| File | Dòng | Field |
|---|---|---|
| `packages/web/src/components/DNSEConnectionPanel.js` | 208-217 | `market_type:"STOCK"`, `order_category:"NORMAL"`, `payload.quantity` |
| `packages/web/src/components/advisory/AdvisoryOrderTicket.js` | 44-52 | `market_type:'STOCK'`, `order_category:'NORMAL'`, `payload.quantity` |
| `packages/web/src/components/__tests__/whale-advisory-alert-order.component.test.tsx` | 55-58 | `payload.quantity` |

### 1.2 X.2 — audit order **không bao giờ** ghi được (tách biệt khỏi X.1)

`AuditEvent.action` là `varchar(16)` (`ops_audit/models.py:25`) còn
`action='broker.place_order'` dài **18** ký tự (`views_dnse.py:110`).
Để chứng minh X.2 **không** phải hệ quả của X.1, chạy một throwaway probe
dùng key `volume` (né validator) rồi xoá file:

```
==============================================================================
X2 PROOF - order uses key "volume" (bypasses the X.1 validator)
==============================================================================
HTTP status                  : 200
response body                : {"result":{"order_id":"DNSE-1"}}
broker post_order call count : 1
AuditEvent rows for this order: QUERY FAILED -> TransactionManagementError: An
  error occurred in the current transaction. You can't execute queries until
  the end of the 'atomic' block.
AuditEvent.action max_length : 16
len("broker.place_order")    : 18
=> varchar(16) gets an 18-char string => DataError => swallowed
   by views_dnse.py except Exception (logger.exception only).
   BONUS: the DataError also poisons the transaction, so the
   ops_audit RequestTraceMiddleware write for THIS request fails too.
==============================================================================
```

Log thật trong lúc chạy:

```
[2026-09-26 14:16:22,486] ERROR user_workspace.views_dnse: audit write failed for dnse place_order
psycopg.errors.StringDataRightTruncation: value too long for type character varying(16)
django.db.utils.DataError: value too long for type character varying(16)
[2026-09-26 14:16:22,517] WARNING ops_audit.middleware: RequestTraceMiddleware: audit event
  write failed for POST /core/v1/broker/dnse/place-order/: An error occurred in the
  current transaction. You can't execute queries until the end of the 'atomic' block.
```

**Đọc đúng:** order **đã đặt thành công** (HTTP 200, `post_order` gọi 1 lần) mà
**0 dòng audit**. Không chỉ mất dòng order — `DataError` còn **làm hỏng transaction**,
khiến `ops_audit` `RequestTraceMiddleware` không ghi được nữa cho chính request đó.
`except Exception: logger.exception(...)` ở `views_dnse.py:121-122` biến lỗi dữ liệu
thành im lặng.

### 1.3 SAFE-01 — order không fail-closed

```
FAIL: test_missing_mode_never_calls_broker
AC-1: payload thiếu cả `mode` lẫn `dry_run` ⇒ broker call = 0.
AssertionError: 400 != 200  (trước đó chưa có code nào chặn — mặc định dry_run=False = LIVE)
```

`_to_bool` (`views_dnse.py:126-129`) hiểu `{"1","true","yes","y","on"}` ⇒ `dry_run="paper"`
hoặc `dry_run="live"` đều ra `False` = **LIVE**:

```
FAIL: test_unparsable_dry_run_string_never_calls_broker
AssertionError: 400 not found in ... ; broker call count = 1 (mode sai → vẫn gọi broker)
```

### 1.4 P1-CONTRACT-00 — 6 broker route trùng

```
FAIL: test_no_duplicate_url_names
AssertionError: ['broker-config', 'broker-config-schema', 'broker-job-status',
                  'broker-providers', 'broker-status', 'broker-test-connection']
FAIL: test_no_duplicate_route_patterns
AssertionError: ['broker/<str:provider>/config/', 'broker/<str:provider>/status/',
                  'broker/<str:provider>/test-connection/', 'broker/config-schema/<str:provider>/',
                  'broker/jobs/<str:job_id>/', 'broker/providers/']
```

`urls.py:81-86` và `urls.py:99-104` byte-identical.

---

## 2. Fix — 4 commit, mỗi nhóm một commit

| Commit | Nhóm | Nội dung |
|---|---|---|
| `060467ee` | test | 42 test đỏ (chứng minh X.1/X.2/SAFE-01/route trùng) |
| `913f4e0e` | 4 | Xoá 6 broker route trùng (`urls.py:99-104`) |
| `c922ced1` | 1 | X.1 `quantity` alias · X.3 `market_type` allowlist · X.4 `order_category` allowlist · X.6 TOCTOU |
| `d8a55ef3` | 2 | X.2 audit `action` hợp lệ + fail-closed |
| `b8d59fd6` | 3 | SAFE-01 fail-closed mode + `Idempotency-Key` + X.5 redact |

### 2.1 Nhóm 1 — X.1 / X.3 / X.4 / X.6

- `_read_volume()` nhận `volume` **và** `quantity`. Thiếu cả hai ⇒ `order_volume_missing`.
  Gửi cả hai mà lệch nhau ⇒ `order_volume_conflict` (không biết broker sẽ đọc giá trị nào).
- `_ALLOWED_MARKET_TYPES = ('STOCK',)` — **chỉ giá trị sản phẩm thật sự dùng**
  (grep toàn repo: `STOCK` ở `DNSEConnectionPanel.js:208`, `AdvisoryOrderTicket.js:44`,
  test FE; không tồn tại `FUND`/`BOND` nào ở đâu). Sai ⇒ `market_type_not_allowed`.
- `_ALLOWED_ORDER_CATEGORIES = ('NORMAL',)` — cùng lập luận. Sai ⇒ `order_category_not_allowed`.
- `_validate_order_payload` → `_normalize_order_payload` **trả về** bản đã chuẩn hoá;
  bản đó là bản duy nhất đi xuống broker (`symbol`/`side` upper, khối lượng là `int`
  đã kiểm, luôn có key chuẩn `volume`). Đóng TOCTOU của X.6.

> **Giới hạn đã biết, nói thẳng:** `vnbroker` **không cài** trong môi trường
> (`ModuleNotFoundError: No module named 'vnbroker'`) nên **không verify được** broker
> thực sự đọc key `volume` hay `quantity`. BE chuẩn hoá về `volume` (giữ luôn alias
> client gửi) và **không xoá** field nào của client. Nếu broker đòi tên khác thì đây là
> ticket riêng sau khi cài `vnbroker` — không đoán.

### 2.2 Nhóm 2 — X.2 audit

- `action` = `AuditEvent.ActionChoices.CREATE` (hợp lệ, ≤ 16 ký tự).
  Tên thao tác dài giữ ở `metadata['operation'] = 'broker.place_order'`.
- **Fail-closed:** dòng audit `outcome='requested'` ghi **trước** khi gọi broker.
  Ghi hỏng ⇒ `500` + `code='audit_unavailable'`, **không gọi broker**.
  Đây là điểm duy nhất fail-closed được đúng nghĩa — sau khi gọi broker thì không hoàn tác được.
- Vì thế `_finalize_audit_event()` **không** thể fail-closed; nó trả `False` và
  response mang `audit_recorded: false` thay vì `logger.exception` rồi bỏ qua.
- Lệnh bị loại cũng được audit: `rejected_validation`, `rejected_mode`,
  `rejected_live_mode`, `rejected_no_idempotency_key`.

### 2.3 Nhóm 3 — SAFE-01 + idempotency + X.5

`_resolve_order_mode(data) -> (mode, dry_run)`, ưu tiên xác định:

| Input | Kết quả |
|---|---|
| không `mode`, không `dry_run` | `400 order_mode_required` |
| `dry_run="paper"` / `"live"` / `"maybe"` | `400 order_mode_invalid` (`_parse_bool_strict` trả `None`) |
| `mode="sandbox"` | `400 order_mode_invalid` |
| `mode="paper"` + `dry_run=False` | `400 order_mode_conflict` |
| `mode="live"` | `403 live_ordering_disabled` + `field_errors` liệt kê 3 gate còn thiếu |
| `mode="paper"` | OK, `dry_run=True` xuống broker (**server quyết**) |
| chỉ `dry_run=True` (legacy) | OK, tương đương paper |
| chỉ `dry_run=False` (legacy) | `403 live_ordering_disabled` — đây là yêu cầu live tường minh |

`_to_bool` **đã xoá** — nó hiểu `{"1","true","yes","y","on"}` và trả `False` cho mọi thứ
còn lại, tức `dry_run="paper"` ra LIVE. Thay bằng `_parse_bool_strict` trả
`True`/`False`/`None`.

Idempotency (`services/idempotency.py`, **không tạo model/migration**):
`Idempotency-Key` bắt buộc · scope `(user, scope, key)` · TTL 7 ngày ·
`cache.add` atomic ⇒ đúng 1 request được thực thi · trùng ⇒ `200` + kết quả cũ +
`idempotent_replay: true` · cùng key khác payload ⇒ `409 idempotency_key_conflict` ·
đang chạy ⇒ `409 idempotency_in_progress` · thất bại ⇒ `release()` để retry được.

X.5: cả 3 nhánh `except Exception` cuối (kể cả `send-email-otp` và
`create-trading-token`) nay trả thông điệp chung + `code='internal_error'`, chi tiết
nằm trong log đã redact. `str(exc)` còn lại **chỉ** ở nhánh
`DNSECredentialMissingError` / `DNSEAdapterError` — đó là thông điệp nghiệp vụ có kiểm soát.

---

## 3. Gate XANH

```powershell
cd C:\Mujoco Projects\pf1-ordersafety\packages\core\backend
$env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf1_ordersafety"
$env:DJANGO_DEBUG = "1"
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test user_workspace.test_order_safety user_workspace.test_broker_routes_unique -v 2
```

| Lệnh | Kết quả |
|---|---|
| `python manage.py check` | `System check identified no issues (0 silenced).` — **exit 0** |
| `python manage.py makemigrations --check --dry-run` | `No changes detected` — **exit 0** (không tạo migration nào) |
| `python manage.py test user_workspace.test_order_safety user_workspace.test_broker_routes_unique -v 2` | `Ran 50 tests in 60.243s` — **OK** |
| `node packages/web/scripts/check-multi-agent.mjs` | `15 app có migration, 109 file, 11 claim hợp lệ` · `0 lỗi, 0 trùng số migration — PASS` — **exit 0** |

50 test, phân bố:

| Lớp test | Số | Bìa |
|---|---|---|
| `OrderFailClosedTests` | 9 | SAFE-01 mode |
| `OrderPayloadContractTests` | 9 | X.1 / X.3 / X.4 / X.6 |
| `OrderIdempotencyTests` | 5 | idempotency end-to-end |
| `OrderAuditTests` | 8 | X.2 + fail-closed audit |
| `OrderErrorRedactionTests` | 3 | X.5 (canary) |
| `ChallengeEndpointModeTests` | 6 | OTP / trading token fail-closed |
| `IdempotencyUnitTests` | 5 | unit `services/idempotency.py` |
| `BrokerRouteUniquenessTests` | 5 | P1-CONTRACT-00 |

### 3.1 Regression rộng hơn — `user_workspace` toàn bộ

```
python manage.py test user_workspace -v 1
Ran 162 tests in 221.232s
FAILED (errors=4, skipped=2)
```

4 lỗi **PRE-EXISTING**, không phải do thay đổi này. Bằng chứng: worktree sạch tại
base `51776e83` tái hiện **đúng 4 lỗi đó**:

| Lỗi | Nguyên nhân | Base `51776e83` sạch |
|---|---|---|
| `test_broker_retail.RetailReferenceTests.test_exchange_rate_ok` | `ModuleNotFoundError: No module named 'vnbroker'` | **tái hiện** |
| `test_broker_retail.RetailReferenceTests.test_gold_ok_and_cached` | như trên | **tái hiện** |
| `test_broker_retail.RetailReferenceTests.test_upstream_error_mapped` | như trên | **tái hiện** |
| `test_portfolio_analytics_native_routes...test_core_v1_workspace_portfolio_analytics_routes_match_legacy_contracts` | 500 ở `/api/portfolio/portfolios/3/holdings/` | **tái hiện** |

Cách lấy bằng chứng: `git worktree add <tmp> 51776e83` rồi chạy
`python manage.py test user_workspace.test_broker_retail user_workspace.test_portfolio_analytics_native_routes`
→ `Ran 8 tests` / `FAILED (errors=4)`. Worktree tạm đã `git worktree remove` sau đó.

### 3.2 Regression `manage.py test tests` — `agent-sync.ps1` bước 5c ĐỎ, không phải do PA-1

`scripts/agent-sync.ps1` (bước 5c) chạy `python manage.py test tests` và dừng ở đây:

```
[5c] manage.py check + test BE
System check identified no issues (0 silenced).
    X   test BE that bai. Log: agent-be-test.txt
  Ran 534 tests in 801.319s
  FAILED (failures=10, errors=4)
```

**Đây là trạng thái sẵn có của repo, không phải hồi quy của PA-1.** Bằng chứng: worktree
sạch tại base `51776e83` chạy đúng lệnh đó cho **cùng số test và cùng danh sách test đỏ**:

```
# base 51776e83 sach
Ran 534 tests in 866.684s
FAILED (failures=10, errors=4)
```

14 test đỏ giống **hệt**, không khác tên nào, và **không test nào trong số đó chạm
`user_workspace.views_dnse` / `urls.py` / `services/idempotency.py`**:

| File test | Số | Nội dung |
|---|---|---|
| `tests.test_admin_route` | 1 E | admin login page |
| `tests.test_scheduler_management_commands` | 3 E + 4 F | drift / sync scheduler |
| `tests.test_tenant_quota_middleware` | 1 E | quota 429 |
| `tests.test_audit_logs_api` | 1 F | cross-tenant 403 |
| `tests.test_session_facts_api` | 4 F | CVD 404 + throttle 60/min |
| `tests.test_stock_management_api_routes` | 1 F | native stock routes |

Khớp với ghi chú đã có ở `AGENTS.md` (Entry 228): *"14 test đỏ nằm ngoài domain AI CC
(`test_admin_route`, `test_scheduler_management_commands`, `test_tenant_quota_middleware`,
`test_audit_logs_api`, `test_session_facts_api`, `test_stock_management_api_routes`)"*.

Ngoài phạm vi PA-1 nên **không tự sửa**. Cần một ticket riêng (mỗi test một nguyên nhân,
không gộp). Worktree tạm đã `git worktree remove` sau khi lấy bằng chứng.

---

## 4. AC — đối chiếu từng test

| # | AC | Test | Kết quả |
|---|---|---|---|
| 1 | thiếu `dry_run`/`mode` ⇒ broker call = 0 | `OrderFailClosedTests.test_missing_mode_never_calls_broker` | PASS |
| 2 | `mode="live"` bị từ chối khi thiếu policy/OTP/confirm ⇒ call = 0 | `OrderFailClosedTests.test_live_mode_rejected_with_explicit_code`, `test_dry_run_false_is_an_explicit_live_request` | PASS |
| 3 | `quantity` (không `volume`) ⇒ 200/201, không 400 | `OrderPayloadContractTests.test_quantity_key_accepted_regression_x1` | PASS |
| 4 | `market_type` ngoài allowlist ⇒ 400, call = 0 | `OrderPayloadContractTests.test_market_type_outside_allowlist_rejected` | PASS |
| 5 | 10 request cùng key ⇒ đúng 1 order, 9 trả 200 | `OrderIdempotencyTests.test_ten_same_keys_create_exactly_one_order` | PASS |
| 6 | audit order thực sự ghi, `action` hợp lệ | `OrderAuditTests.test_audit_row_is_written_with_a_valid_action` | PASS |
| 7 | response không chứa exception gốc (canary) | `OrderErrorRedactionTests.*` (3 test) | PASS |
| 8 | giá trị đã chuẩn hoá mới xuống broker | `OrderPayloadContractTests.test_normalized_values_are_what_reaches_the_broker` | PASS |
| 9 | mỗi broker name 1 lần, mỗi path 1 view | `BrokerRouteUniquenessTests.*` (5 test) | PASS |
| 10 | chạy với `DJANGO_DEBUG=1` + DB `ag_pf1_ordersafety` | mọi lệnh §3 | PASS |

**10/10 AC PASS.**

---

## 5. Rủi ro còn lại — nói thẳng, không bịa

1. **`vnbroker` không cài** ⇒ chưa chứng minh được contract payload thật của broker
   (`post_order` đọc `volume` hay `quantity`; có bắt buộc `account_no`/`order_type` không).
   Test dùng spy nên chỉ chứng minh "có/không gọi broker" và "giá trị nào được truyền",
   **không** chứng minh broker nhận đúng. Cần chạy E2E với sandbox thật.
2. **Idempotency trên `cache`, chưa bền vững.** Production dùng Redis nên `cache.add`
   atomic thật; nhưng `TESTING` đổi sang `LocMemCache` (`settings.py:438`) và nếu
   production cấu hình LocMemCache qua nhiều process thì `add` chỉ atomic **trong một
   process** ⇒ còn cửa sổ trùng. Wave sau thay bằng `OrderJob` + `unique (user, scope, key)`.
3. **`_finalize_audit_event` không fail-closed được.** Lệnh đã đẩy xuống broker thì không
   hoàn tác được; nếu update audit hỏng thì response có `audit_recorded: false` và log
   `AUDIT-FINALIZE-FAILED` nhưng dòng audit vẫn ở `outcome='requested'`.
4. **Call `ops_audit.models` không có transaction riêng.** Một lỗi DB bất kỳ trong lúc
   ghi audit vẫn có thể làm hỏng transaction của request. Preflight gate biến hậu quả
   từ "im lặng" thành `500` có mã lỗi, nhưng chưa sửa gốc rễ.
5. **Allowlist chỉ có `STOCK` / `NORMAL`.** Đúng fail-closed nhưng là **thay đổi hành vi**:
   ai gửi `FUND` trước đây (giả sử broker chấp nhận) nay bị 400. Cần xác nhận nghiệp vụ
   có hỗ trợ nhiều loại thị trường không trước khi bật.
6. **FE chưa được sửa** (`packages/web/**` ngoài phạm vi). Cả 2 caller
   (`DNSEConnectionPanel.js:207-218`, `AdvisoryOrderTicket.js:43-53`) gửi **không**
   `mode` và **không** `Idempotency-Key` ⇒ từ góc nhìn UI, đặt lệnh **luôn** trả 400
   `order_mode_required` / `idempotency_key_required`. Đây là hệ quả **đúng** của
   "server là nguồn sự thật", nhưng nghĩa là tính năng đặt lệnh **đang tắt** cho tới
   khi FE được sửa. Cần ticket FE riêng (kèm sinh `Idempotency-Key` mỗi lần bấm).
7. **Chưa có `evidence` chạy E2E với sandbox DNSE thật** — không có credential.
8. `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` không tồn tại
   (xem đầu file) nên không đối chiếu được với nó.
9. **`agent-sync.ps1` bước 5c đỏ** vì 14 test pre-existing ngoài phạm vi (xem §3.2).
   Đó là gate của *script sync*, không phải gate của PA-1. `pre-push` chỉ chạy
   `check:multi-agent` + `manage.py check` nên **không** chặn push.
   **Không dùng `--no-verify` ở bất kỳ commit nào** — cả 6 commit đều qua hook.

## 6. Việc phát hiện NHƯNG ngoài phạm vi — KHÔNG tự sửa

| Việc | Vì sao không sửa |
|---|---|
| `ops_audit/models.py:25` `action` `max_length=16` quá hẹp cho action dạng `broker.*` | `ops_audit/**` đang do `tenantreg-b` claim; nới `max_length` + thêm choice cần **migration** mà `*/migrations/*` đang do `tenantreg-c` claim. Đề xuất cho coordinator: `AlterField(action, max_length=48)` + `ActionChoices` thêm `BROKER = 'broker'` (4 ký tự) và map action dài vào `metadata`. |
| `DataError` làm hỏng transaction ⇒ `ops_audit` `RequestTraceMiddleware` mất trace | `ops_audit/middleware.py` do `tenantreg-b` claim. Bài học chung: mọi ghi audit nên bọc `transaction.atomic()` riêng để lỗi không lan ra. |
| `order_type` trong payload (`'LO'`) không được validate | Không có nguồn allowlist đáng tin (chỉ 1 giá trị trong FE) ⇒ thêm allowlist lúc này là **bịa** contract. Mở ticket riêng. |
| FE `DNSEConnectionPanel.js` / `AdvisoryOrderTicket.js` chưa gửi `mode` + `Idempotency-Key` | `packages/web/**` ngoài phạm vi (xem rủi ro #6). |
| `packages/web/src/adapters/core/workspace.js:341-356` adapter không fail-closed và JSDoc chỉ còn `dry_run?: boolean` | `packages/web/**` ngoài phạm vi. Cần cập nhật JSDoc + fail-closed ở adapter. |
| `test_broker_retail` + `test_portfolio_analytics_native_routes` đỏ | Pre-existing, xem §3.1. Không thuộc PA-1. |
