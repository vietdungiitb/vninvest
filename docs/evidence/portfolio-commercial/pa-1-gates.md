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

## 2. Fix + gate XANH

_(phần này điền sau khi sửa — xem §3, §4)_
