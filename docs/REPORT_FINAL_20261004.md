# REPORT FINAL — Audit + remediation `vninvest`

**Ngày:** 2026-10-04 · **Base:** `dc65b342a` · **Merge:** `4e329b3ae` → `dev`
**Branch đã merge:** `feat/openwork-ow02-03-04`
**Quy trình:** `multi-agent-workflow` Mode B, Stage 0→8

Tài liệu: `docs/AUDIT_20261004.md` · `docs/PLAN_V2_VNINVEST_HARDENING_20261004.md`
· `docs/TEST_REPORT_20261004.md` · `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 245

---

## 1. DoD — chưa đạt, và nói rõ vì sao

| Tiêu chí | Trạng thái |
|---|---|
| 2 BLOCKER audit | **đóng** (1 chuyển thành khoảng trống chức năng — xem §3) |
| 4 HIGH audit | **đóng** 4/4 |
| 7 MEDIUM audit | **2 đóng** · 5 bàn giao (§4) |
| Audit độc lập Stage 5 | vòng 1 **REJECT** (3 blocker) → đã sửa → **vòng 2 chưa chạy** |
| Test mới fail-trước/pass-sau | **có bằng chứng** cho 4 fix |
| Gate nói thật | **đóng** — SKIP không còn đọc như PASS |
| Regression | **không** — 643 pass / 18 fail, 18 fail giống hệt ở base |

**Chưa đạt `production ready`.** Lý do không phải chưa hết việc, mà là **chưa có
đủ bằng chứng để gọi là production-ready**:

| Rào cản | Số liệu |
|---|---|
| Test suite không chạy nổi trong thời gian hợp lý | `pytest backend/src` **>30 phút**; `run_tests.py identity_access` **>15 phút** |
| **2104 test không bao giờ chạy trên đường push** | `run_tests.py:5-13`: `manage.py test` chỉ đọc `backend/tests/` (642 test) |
| Bề mặt kiểm thử chưa chạy | npm build/test, mypy, ruff, `npm audit`/`pip-audit` |
| Migration chưa chứng minh trên DB có dữ liệu | `AGENTS.md` §11 yêu cầu |
| CI chết | billing (`AGENT_PROTOCOL.md:235`) |

Con số 2104 là rào cản lớn nhất: **phần lớn kiểm thử của hệ thống không được
chạy trước khi merge**, và điều đó là do thiết kế lệnh test, không phải do
cài đặt thiếu.

---

## 2. Đã đóng — kèm cách chứng minh

| # | Lỗi | Bằng chứng |
|---|---|---|
| 1 | SAML: heuristic substring trên `sys.argv` biến "chấp nhận mọi assertion" | script đối chiếu: cũ **5/5** argv hạ `noop`, mới **0/5** |
| 2 | SAML: issuer mismatch chỉ `logger.warning` | test `test_foreign_issuer_is_rejected` |
| 3 | VNPay: secret rơi về `SECRET_DEMO` công khai | 6 test fail-closed (production) |
| 4 | VNPay: `vnp_Amount` không parse được **tắt** kiểm tra tiền | sửa thành `RspCode 99` |
| 5 | VNPay: `vnp_SecureHash` trong log INFO; so hash bằng `==` | `hmac.compare_digest`, chỉ log `txn_ref` |
| 6 | Stripe: price ID lạ ⇒ **cấp plan `pro`** | `test_unknown_price_refuses_instead_of_granting_pro` |
| 7 | Stripe: status lạ ⇒ **giữ ACTIVE** | `test_unknown_status_refuses_instead_of_defaulting_active` |
| 8 | Quota: refund chỉ hoàn cho **owner** — member không bao giờ được hoàn | `1 != 0` trước → `OK` sau |
| 9 | Quota: `get_or_create` không khoá ⇒ vượt trần | thêm `select_for_update()` |
| 10 | `viewer`/`editor` xoá được **toàn bộ phiên** của tenant | thêm `security:write` |
| 11 | `GET /tickets` đọc chéo tenant (đã claim rồi bỏ sót) | guard 400 khớp POST |
| 12 | Đường push không gọi `pre-push-gate.mjs`; SKIP = PASS; bypass im lặng | 4 negative test |

**Kiểm thử:** 118/118 PASS trên 11 module · gate **15 PASS / 0 SKIP / 0 FAIL**
sau merge · `check-multi-agent` 0 lỗi · `scan-secrets` 0 secret.

---

## 3. BLOCKER đóng **một nửa** — SAML

`_verify_signature` **chưa bao giờ được viết**. Sau khi sửa:

| Chế độ | Hành vi | Đánh giá |
|---|---|---|
| `strict` (mặc định production) | raise → SSO **không dùng được** | fail-closed ✅ |
| `noop` | chấp nhận mọi assertion | chỉ khi **đặt env tường minh** |

⇒ Không còn "cấu hình vừa chạy được vừa an toàn". Đây là **khoảng trống chức
năng** (SSO không dùng được), không phải lỗ hổng khai thác được.

`python3-saml>=1.15` đã có ở `requirements.txt:38` và `xmlsec1` ở
`Dockerfile:19,46` ⇒ **thiếu code, không thiếu thư viện**. Đây là BL-01b.

---

## 4. Bàn giao Owner

### 4.1 Không làm được trong repo (cần Owner)

| # | Việc | Vì sao |
|---|---|---|
| 1 | **OW-01** rotate 7 secret thật | cần network + owner; `git log -S` thấy `DNSE_CREDENTIAL_FERNET_KEY` ở 27 commit |
| 2 | **OW-05** quyết định `UserDNSECredential` legacy | quyết định nghiệp vụ |
| 3 | **CI billing** | `AGENT_PROTOCOL.md:235` |
| 4 | **BL-01b** chữ ký SAML thật | cần code, không cần cài |

### 4.2 Ghi vào `compose.*.env.example` (shared-file deny list — **coordinator-only**)

| # | Việc | Hiệu ứng nếu bỏ |
|---|---|---|
| 5 | `VNPAY_HASH_SECRET` | production fail-closed đúng, nhưng không có cách nối secret thật |
| 6 | `REDIS_URL=redis://127.0.0.1:6380/1` | `settings.py:423` mặc định `6379`, dev compose publish `6380` ⇒ cache rơi về LocMem **im lặng**; 4 test đếm fail |
| 7 | `SAML_SIGNATURE_VERIFICATION_MODE` | không tài liệu hoá chế độ fail-closed |

### 4.3 Task kỹ thuật chưa làm (có thể làm tiếp)

| # | Việc | Vị trí |
|---|---|---|
| 8 | 9 mismatch frontend↔backend | `docs/AUDIT_20261004.md` §4 |
| 9 | `agent-sync.ps1:159` thiếu `--noinput` | treo prompt xoá DB khi tự động hoá |
| 10 | Nối backend test vào đường push | phải giải quyết runtime 2104 test trước |
| 11 | Mã hoá `TenantWebhookConfig.secret` | cần migration trên DB có dữ liệu |
| 12 | Bỏ `float` cho tiền | `commercial/views.py:127`, `stripe_webhooks.py:230` |
| 13 | `is_staff` pivot tenant không audit | `resolve_tenant.py:245-263` |
| 14 | `sso.py:254-267` fallback resolve tenant từ assertion chưa verify | rủi ro còn lại |

---

## 5. Waiver

| Mục | Lý do | Rủi ro còn lại |
|---|---|---|
| Không nối backend test vào push path | 118 test mất 44s nhưng full suite >30 phút; nối vào sẽ làm push không dùng được | 2104 test vẫn không chạy trước merge |

Không có `minor` nào bị waive. Tất cả 12 lỗi đã đóng hoặc bàn giao có mục đích.

---

## 6. Bài học Stage 8

**"Đã viết cảnh báo trong commit message" không phải "đã xử lý".**

`f5f01e20b` mô tả chính xác hậu quả của mình: thiếu `VNPAY_HASH_SECRET` thì
payment create và mọi IPN **500**. Ngay sau đó audit độc lập trả `REJECT` đúng vì
thứ đó. Ghi cảnh báo vào commit không làm cho nó trở thành fix.

Bài học rút ra đề xuất thêm vào `AGENTS.md`:

> Khi cần sửa một `shared-file` để hoàn tất fix, đó là **blocker**, không phải
> ghi chú. Nếu fix không ship được vì thiếu biến ở file deny list: (1) đừng làm
> thay đổi đó, (2) ghi vào `OPEN_WORK` có hạn, (3) **báo owner trước khi commit**.

Hai sự cố kỹ thuật đáng ghi thêm:

1. **`git show HEAD:f | Set-Content -NoNewline` hỏng 4 file** — nối mọi dòng
   thành một. Cứu được nhờ backup trước. Đây là Hazard 11 xảy ra thật; phải dùng
   `git checkout HEAD -- <file>` hoặc `git stash`.
2. **`set -e` ở hook không cứu được `exit 0` ở cuối `.githooks/pre-push:32`** —
   `check-multi-agent` FAIL cũng push được. Đây là lý do phải sửa *nội dung*
   hook chứ không chỉ nối thêm lệnh.