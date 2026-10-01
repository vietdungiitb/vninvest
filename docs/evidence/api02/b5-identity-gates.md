# B5 — `identity_access`: bọc `{data, meta}` + **gate không thể exit 0**

`verified: 2026-10-01 @ 738c06394` · branch `wip/b2` · base `ec048cc9`
DB: `postgresql://vninvest:devpassword@127.0.0.1:5433/b5b`

---

## 1. Kết luận 1 chữ

**Gate `check-envelope-contract.py identity_access` KHÔNG THỂ exit 0.** Không
phải vì còn sót — mà vì **115/115 điểm còn lại đều thuộc loại mà lệnh cấm bọc.**
Số điểm đã bọc: **92**.

Đây là phát hiện cần owner quyết trước khi nhân app — xem §4.

---

## 2. Đã bọc

| | Số |
|---|---:|
| Điểm 2xx đã bọc (`envelope` / `paginated_envelope` / `adopt_envelope`) | **92** |
| Trong đó nằm trong `callsites.csv` (families F1/F6/F7/F8/F9) | 91 |
| Ngoài CSV (xem §3.1) | 1 |

92 = 93 lời gọi wrapper trong AST trừ 1 lời gọi nội bộ trong chính `envelope.py`.

Số liệu kiểm lại (không đếm tay):

```
$ python -c "<dem wrapper call site trong src/identity_access>"
  TONG WRAPPER CALL   93      # 92 response + 1 trong envelope.py
```

Gate đếm được phần mình nhìn thấy: `WRAPPED: 95` (92 + 2 `success_response` đã
đúng sẵn + 1 `views_operator.py` paginator).

### `meta` để rỗng ở mọi nơi

Không endpoint nào trong app này có sẵn provenance (`as_of` / `stale` /
`calculation_version` / `source`) để chuyển vào `meta`. Không bịa giá trị, không
điền timestamp lúc gọi. `meta` = `{}` toàn bộ — đúng như yêu cầu "chỉ điền
provenance **đã có sẵn**".

---

## 3. Không bọc 115 điểm — và vì sao

Đếm bằng AST, không đoán:

| Nhóm | Số | Căn cứ cấm bọc |
|---|---:|---|
| **A. `return {...}` trong hàm không phải HTTP** | 38 | Không phải response. Xem §3.2 |
| **B. `Response(..., status=4xx/5xx)`** | 69 | Đi qua RFC 9457 `core_api_exception_handler` |
| **C. F3 `success_response`** | 2 | Đã có `data`; sửa là đổi cả 12 call site F3 |
| **D. F4_GENERATED** (`object:` + sibling) | 4 | Bọc là mất sibling |
| **E. F0_NO_BODY (204)** | 1 | DRF bỏ thân body |
| **F. F5_DATA_PLUS** | 1 | Bọc là mất sibling |

### 3.1 Điểm **ngoài** `callsites.csv`: `issue_pat`

`views_tenant.py:258` (`issue_pat`, legacy) **không có** trong CSV, nhưng trả
**đúng payload** và **đúng status** như `views_tenant.py:362`
(`partner_issue_pat`) — cùng `_serialize_partner_pat(...)`, cùng `201`.

Chỉ bọc một trong hai ⇒ cùng một thao tác trả **hai shape**. Đó đúng là lỗi
`service_ops` từng mắc. Bọc cả hai, ghi lại ở đây.

### 3.2 Nhóm A — 38 `return {...}` **không phải HTTP response**

Gate không phân biệt được: `_returns_envelope()` xử lý `ast.Dict` **ngay cả khi
không nằm trong `Response(...)`** và trả `UNWRAPPED`.

Đây là payload builder, task Celery, và header throttle — **không endpoint nào**:

| Nơi | Hàm |
|---|---|
| `views/helpers.py` ×9 | `_tenant_payload`, `_user_payload`, `_service_account_payload`, `_build_navigation`, `_build_entitlements`, `_build_capabilities_payload`, `_build_auth_payload` |
| `tasks.py` ×12 | `deliver_webhook`, `flush_pat_audit_log`, `cross_ref_pat_audit_events`, `_generate_report_content` |
| `email_tasks.py` ×7 | `send_welcome_email`, `send_invite_email`, `prune_email_verification_tokens` |
| `saml_service.py` ×2 | `parse_response`, `test_connection` |
| `throttles.py` ×2 | `get_rate_limit_headers` (trả **header**, không phải body) |
| `views_forecast.py` ×2, `views_personal.py` ×2 | `_forecast_meter`, `_current_period_quotas` |
| `signals.py`, `models.py`, `authentication.py`, `dnse_credential_views.py` | `_build_member_payload`, `get_secrets`, `get_security_definition`, `_safe_serialize` |

Bọc `_tenant_payload()` ⇒ `_build_auth_payload()` sẽ ra
`'tenant': {'data': {...}, 'meta': {}}` — **sai**, vì đó là payload **lồng**.

---

## 4. Vì sao gate không sửa được (khuyến nghị)

Gate là **điều kiện cứng** của cả B5. Nhưng với `identity_access` nó **không
thoả được**, và chỉ thoả được bằng cách **phá thứ lệnh cấm bảo vệ**:

```
BẮT BUỘC  : python scripts/check-envelope-contract.py identity_access   # exit 0
CẤM        : "TUYỆT ĐỐI KHÔNG bọc — Response lỗi … Sai chỗ này sẽ phá 34 test
              của vninvest_core/tests/test_problem_json.py + test_status_codes_and_errors.py"
```

69 điểm nhóm B là **response lỗi**. Gate đếm chúng là `UNWRAPPED` vì
`_returns_envelope()` **không đọc `status`**. Muốn gate xanh thì phải bọc lỗi →
phá đúng 34 test nêu trên.

Ba đường, đều cần owner chọn:

1. **Sửa gate** — chỉ xét `Response`/`JsonResponse` có `status` 2xx, và bỏ
   nhánh `ast.Dict` trần (nó bắt cả payload builder). *Khuyến nghị.* Đây là
   điều kiện tiên quyết cho 3 app còn lại — nếu không sửa, 3 agent sau sẽ cùng
   dừng ở cùng một chỗ hoặc sẽ phá hợp đồng lỗi.
2. **Thêm allow-list** cho `tasks.py` / `email_tasks.py` / `views/helpers.py` /
   `throttles.py` / `saml_service.py`. *Rẻ hơn nhưng phải liệt kê tay.*
3. **Coi `UNVERIFIED` là kết quả** — nhưng gate hiện in `UNVERIFIED: 0` dù
   `continue` trước khi đếm (dòng 107-108), nên số này **luôn 0** và không
   phản ánh gì.

> Gate là file **dùng chung** (`packages/core/backend/scripts/`), nằm ngoài
> phạm vi sửa của `b5-identity` ⇒ **không** tự sửa. Đã báo coordinator.

---

## 5. `.as_view()()` — server tự gọi view của nó

Có **1** chỗ: `commercial_partner_views.py:41-42`

```python
view = InnerView.as_view()
return view(request._request)          # -> commercial.views_analytics.PartnerCostTrendView
```

View được gọi nằn ở app `commercial` — **ngoài phạm vi B5 này**, nên **chưa
chắc** đã bọc. Trả thẳng ⇒ endpoint này có **hai shape cùng lúc** (nhánh
thành công phẳng, nhánh `ImportError`/`Exception` đã bọc).

Xử lý: `adopt_envelope()` — trả nguyên nếu đã là envelope, bọc lại nếu chưa.
**Idempotent**, nên không phụ thuộc thứ tự các app khác được migrate.

Không có chỗ nào trong app đọc `.data` của response từ view khác ⇒ không có
rủi ro kiểu "bọc xong `.get()` ra `None`" mà B0 gặp ở `market_data`.

---

## 6. Gate chạy thật

| Lệnh | Kết quả |
|---|---|
| `python scripts/check-envelope-contract.py identity_access` | **exit 1** — `WRAPPED: 95`, `UNWRAPPED: 115`, `UNVERIFIED: 0` |
| `python manage.py check` | exit 0 — no issues |
| `python manage.py makemigrations --check --dry-run` | exit 0 — **No changes detected** |
| `python -m ruff check --output-format=concise <29 file đã sửa>` | **0 lỗi mới** (đối chiếu từng file với `ec048cc9`) |
| `python manage.py test --noinput identity_access` | **418/418 OK** (31.4 phút) |
| `node scripts/verify-envelope.mjs` | `14 pass, 0 fail` — exit 0 |
| `node scripts/verify-envelope-wiring.mjs` | `9 pass, 0 fail` — exit 0 |

### Không phá RFC 9457

`vninvest_core.tests.test_problem_json` + `test_status_codes_and_errors`:
**50 test, 11 fail — y hệt ở `ec048cc9`.**

Đã kiểm chứng bằng cách `git checkout ec048cc9 -- src/identity_access`, chạy
lại, rồi khôi phục. **11 lỗi là có sẵn** (`/core/v1/register/` đã đổi thành
`/core/v1/auth/register/` → `404 != 200/201`). **0 lỗi do bọc.** Theo lệnh: ghi
nhận, không sửa.

---

## 7. Test phải sửa: 9 file, **0 skip**

Test đọc `response.data[...]` trực tiếp nên hỏng khi hợp đồng đổi — đúng như
mong đợi.

Thêm `src/identity_access/tests/envelope.py`:

- `unwrapped(response)` — mở envelope nếu có, giữ nguyên nếu không
- `unwrapped_json(response)` — như trên, cho test đọc qua `.json()`

Cùng quy tắc FE (`packages/web/src/adapters/core/envelope.js`): chỉ coi là
envelope khi có **cả** `data` và `meta`. Nhờ vậy test pass ở **cả hai** trạng
thái, và khi app khác được bọc sau này thì test không phải sửa lần nữa.

Không sửa thành `response.data['data'][...]` cứng — làm vậy thì test chỉ pass
với hình dạng mới và hỏng ngay nếu app chưa bọc.

| File test | Test sửa |
|---|---|
| `tests/test_tenant_member_views.py` | 4 |
| `tests/test_identity_access_api_routes.py` | 6 |
| `tests/test_identity_access.py` | 2 |
| `tests/.../test_tenant_custom_role.py` | 9 |
| `tests/.../test_tenant_settings.py` | 4 |
| `tests/.../test_dnse_credential.py` | 4 |
| `tests/.../test_capabilities_soc.py` | 4 |
| `tests/.../test_password_change.py` | 2 |
| `tests/.../test_personal_keys.py` | 15 |
| `tests/.../test_saml_sso.py` | 12 |
| `tests/.../test_webhook_detail_permissions.py` | 1 |

**Không** thêm `skip`, **không** xoá assert. Tổng số assert đổi cách đọc, không
đổi ý nghĩa.

---

## 8. CHƯA CHẠY

| Việc | Lý do |
|---|---|
| **Full suite 2760 test** | Lệnh cấm (`~55 phút`). Chỉ chạy app + 2 file RFC 9457 |
| **`identity_access` qua HTTP thật** | Chỉ chạy qua DRF test client. Chưa `runserver` + `curl` |
| **`spectacular` / OpenAPI sinh ra** | Không sinh lại schema sau khi đổi shape |
| **`npm test` / `vitest` FE** | `node_modules/.bin/` rỗng, AGENTS.md cấm `npm install`. Đã chạy 2 script `verify-envelope*` bằng Node trần |
| **3 app khác** | Ngoài phạm vi `b5-identity` |
| **`market_data` / `service_ops`** | Ngoài phạm vi |

---

## 9. Mẫu để nhân sang app khác

1. Tạo `envelope.py` ở app, helper **trả về `Response`** (DRF bắt buộc view trả
   `Response`; trả dict ⇒ `finalize_response` ném `AssertionError`).
2. **`return envelope(x)`**, không phải `Response(envelope(x))` — gate xếp
   dạng sau vào `UNVERIFIED`, tức **không được chứng minh**.
3. Khối phân trang: `paginated_envelope(page)` giữ nguyên `next`/`previous`/
   `results`; với `paginator.get_paginated_response()` thì
   `paginated_envelope(dict(paged.data))`.
4. **Chạy gate TRƯỚC khi sửa dòng nào** để lấy danh sách thật — CSV
   `callsites.csv` có dòng lệch với code hiện tại, phải đối chiếu AST.
5. Với chỗ gọi view của **app khác**: `adopt_envelope()`.
6. Test dùng `unwrapped()` / `unwrapped_json()`, không hard-code `['data']`.