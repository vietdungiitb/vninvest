# PLAN v2 — Đóng BLOCKER/HIGH `vninvest`

**Ngày:** 2026-10-04 · **Base:** rebase lên `origin/dev` **trước khi cắt slice** (xem §0.3)
**Thay thế:** `PLAN_VNINVEST_HARDENING_20261004.md` (bị Stage 2 trả `REJECT`)
**Quy trình:** `multi-agent-workflow` Mode B · `docs/AGENT_PROTOCOL.md` thắng

> **Vì sao v1 bị REJECT:** 5/10 tiêu chí không thể pass (A1 đòi 403 trong khi view
> trả 400; A4/A5/B1/B2 trỏ thư mục test không tồn tại), A3 tự làm hỏng
> `manage.py check`, và Slice C dựa trên một tiền đề sai. Chi tiết ở
> `docs/PLAN_AUDIT_V2_20261004.md`.

---

## 0. Baseline — đo lại, không tin lần trước

### 0.1 Exit code

| Lệnh | Baseline | Ghi chú |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | `0` | **50** cảnh báo file-claim không tồn tại (đếm `!`-prefixed; v1 ghi 14 — sai, do đã truncate output) |
| `node packages/web/scripts/scan-secrets.mjs` | `0` | 3454 file |
| `python manage.py test tests` (qua `agent-sync.ps1:159`) | **`CHƯA CHẠY`** | chỉ 642 test |
| `python run_tests.py --src-only` | **`CHƯA CHẠY`** | 2104 test |
| `pytest backend/src` toàn bộ | **`CHƯA XONG`** sau 30 phút | không gate nào có timeout |

### 0.2 Vì sao không đòi `PASS` từ full suite

`run_tests.py:1-24` (đã tự ghi) cho biết `manage.py test` không label chỉ đọc
`backend/tests/`. Tiêu chí dưới đây vì vậy dùng **runner tường minh có label**, và
tiêu chí nào cần `src/*/tests/` đều **phải ghi rõ runner**.

### 0.3 Bắt buộc trước khi sửa dòng đầu tiên

```bash
git fetch origin
git status --short                    # AGENT_PROTOCOL.md:60
grep in-progress docs/CLAIMS.md       # :63
git diff --name-only origin/dev...HEAD   # hiện = 17 file
```

`origin/dev...HEAD` **đã có** `commercial/views.py` và `vninvest_core/env_validation.py`
— đúng hai file Slice A sắp sửa. **Phải rebase/gặp trước khi cắt slice**, nếu không
commit của tôi sẽ trộn với việc chưa merge của người khác.

---

## 1. Slice + file ĐẦY ĐỦ (kể cả file test)

| Slice | File sẽ sửa/tạo |
|---|---|
| **A** | `identity_access/saml_service.py`, `identity_access/views/sso.py`, `identity_access/tests/test_saml_sso.py`, `identity_access/tests/test_saml_signature_mode.py`, `commercial/vnpay_service.py`, `commercial/views.py`, `commercial/stripe_webhooks.py`, `vninvest_core/env_validation.py`, **mới:** `packages/core/backend/tests/test_vnpay_ipn_security.py`, **mới:** `packages/core/backend/tests/test_stripe_fail_closed.py` |
| **B** | `advisory/tasks.py`, `advisory/views.py`, `identity_access/views_security.py`, `identity_access/utils/resolve_tenant.py`, **mới:** `packages/core/backend/tests/test_advisory_quota_security.py` |
| **C** | `.githooks/pre-push`, `scripts/pre-push-gate.mjs`, `scripts/agent-sync.ps1` |

**Test đặt ở `packages/core/backend/tests/`**, không phải `src/*/tests/` — vì
`manage.py test tests` (đường push hiện tại) chỉ thấy thư mục đó. Đặt vào
`src/*/tests/` sẽ tạo test **không bao giờ được chạy** trên push, tức là lặp lại
đúng lỗi đang sửa.

**Giao nhau:** A∩B = ∅, A∩C = ∅, B∩C = ∅ về code. Nhưng **cả ba đều phải append
`docs/CLAIMS.md`** (`AGENT_PROTOCOL.md:31`, `merge=union`) **và**
`docs/CODE_CHANGE_AUDIT_LEDGER.md` (`AGENTS.md:230`). Đây là lý do thật để chạy
**tuần tự**, không phải vì file code trùng nhau.

Thứ tự: **B → A → C.** C sửa bộ chặn của chính agent; để sau, và để sau A để lỡ hỏng
thì việc đã làm vẫn commit được.

---

## 2. Tiêu chí nghiệm thu — đã sửa theo R1–R12

Runner: `python manage.py test tests.<file> -v 2` (chạy từ `packages/core/backend`),
`CORE_DATABASE_URL` trỏ Postgres `127.0.0.1:5433`.

### Slice B — quota (làm trước)

| # | Given/When/Then | Test |
|---|---|---|
| B1 | Given thành viên **không phải owner** đã tiêu quota của tenant T, When hoàn, Then credit **đúng T** | `test_advisory_quota_security.py::RefundTenantScope` |
| B2 | Given **hai user khác nhau cùng tenant**, trần = 1, When gọi đồng thời, Then **đúng một** cái được phép | `...::ConcurrentQuota` (`TransactionTestCase` + thread thật) |
| B3 | Given role chỉ có `security:read`, When `partner_revoke_session`, Then bị từ chối | `...::RevokeNeedsWrite` |

> B2 phải là **hai user khác nhau**: `advisory/views.py:307-315` đã có khoá cache
> **theo user**, nên hai request cùng user đã bị chặn từ trước. Tiêu chí v1 (không
> nêu diễn viên) là vacuous.

### Slice A — fail-closed

| # | Given/When/Then | Test |
|---|---|---|
| A1 | Given mode ≠ `noop`, When gọi SSO, Then **HTTP 400** (không phải 403) và không cấp token | `test_saml_signature_mode.py` |
| A2 | Given `DEBUG=false` và `argv=['manage.py','contest']`, When chọn mode, Then **không** phải `noop` | `test_saml_signature_mode.py` |
| A3 | Given IPN có `vnp_Amount="abc"`, When xử lý, Then `RspCode 99`, subscription **không** kích hoạt | `test_vnpay_ipn_security.py` |
| A4 | Given VNPay secret **vẫn là** giá trị demo, When dựng `VNPayService`, Then raise `ImproperlyConfigured` **tại thời điểm dùng** | `test_vnpay_ipn_security.py` |
| A5 | Given Stripe price ID lạ, When webhook tới, Then **từ chối**, không cấp `pro` | `test_stripe_fail_closed.py` |
| A6 | Given 6 test SAML cũ (cert giả, không `<Signature>`), When chạy, Then **còn xanh** sau khi bỏ heuristic `sys.argv` | `test_saml_sso.py` (6 test) |

> **A3 đã đổi cách sửa.** v1 bắt buộc `VNPAY_HASH_SECRET` ở `env_validation` — sẽ làm
> `manage.py check` đỏ vì env dev không có biến đó, mà `.env*` nằm trong deny list
> (`AGENT_PROTOCOL.md:33`) nên tôi không thể tự thêm. Nay kiểm tra **tại thời điểm
> dùng**: chặn IPN, nhưng không chặn boot.

### Slice C — đường push

| # | Given/When/Then | Test |
|---|---|---|
| C1 | Given `SKIP_PRE_PUSH_GATE=1`, When chạy `pre-push-gate.mjs`, Then gate chạy **thật** | chạy tay hook |
| C2 | Given 1 test backend fail, When `manage.py test tests`, Then exit ≠ 0 **và** hook chặn | test âm |
| C3 | Given hook chạy, When đếm SKIP, Then SKIP **không** được tính là cho phép push | đọc `:298` |

---

## 3. Ngoài phạm vi — sửa lại theo R5/R10/R11

| # | Không làm | Vì sao |
|---|---|---|
| 1 | ~~cài `python3-saml`~~ | **Sai lý do v1.** `requirements.txt:38` đã khai `python3-saml>=1.15,<2.0`; `Dockerfile:19,46` đã cài `xmlsec1`. **Thiếu là CODE, không phải cài đặt.** Nên BL-01b là task code, không cần xin phép cài |
| 2 | KHÔNG lọc lịch sử git | `AGENTS.md` §2.1 — cấm khi còn agent chạy |
| 3 | KHÔNG rotate secret thật | OW-01 cần network + owner |
| 4 | KHÔNG quyết OW-05 | Cần owner quyết nghiệp vụ |
| 5 | KHÔNG sửa `.github/workflows` | CI chết vì billing |
| 6 | KHÔNG sửa 9 mismatch FE↔BE | cần xác minh call-site trước |
| 7 | ~~KHÔNG sửa ledger~~ → **ĐÃ GỠ** | `AGENTS.md:230` **bắt buộc** cập nhật ledger; cấm nó là vi phạm gate |
| 8 | KHÔNG sửa `compose*.yml`, `.env*` | deny list `AGENT_PROTOCOL.md:33` — **giữ**, nhưng đã gỡ hệ quả A3 |

### 3.1 Bổ sung (R11) — các mục audit bị plan v1 bỏ sót, nay xử lý

| Mục | Xử lý ở đâu |
|---|---|
| `settings.py:188` mặc định SQLite | **Slice B** — đổi thành raise nếu `DEBUG=false` mà thiếu `CORE_DATABASE_URL` |
| M4 `IsTenantActive` trả `True` khi chưa resolve tenant | **Slice B** — trả `False` |
| M5 `support/views.py` mất lọc tenant | **Slice B** — fail-closed |
| M1 `security:read` cho revoke (nâng lên B3) | Slice B |
| M2 webhook secret plaintext | **Tách riêng** — cần migration; xem §3.2 |
| M3 tiền qua `float` | **Tách riêng** — xem §3.2 |
| M6 `is_staff` pivot tenant | **Tách riêng** — cần quyết định sản phẩm |
| `vnpay_service.py:64` log `vnp_SecureHash` ở INFO | **Slice A** — hạ xuống DEBUG hoặc bỏ |
| `vnpay_service.py:94` so hash không constant-time | **Slice A** — `hmac.compare_digest` |
| `sso.py:254-267` fallback resolve tenant từ assertion chưa verify | **Slice A** — bỏ fallback |
| M7 không có timeout cho test | **Slice C** — thêm timeout vào hook |

### 3.2 Mục cần migration — không làm trong phiên này

`M2` (mã hoá `TenantWebhookConfig.secret`) và `M3` (bỏ `float` cho tiền) đều cần
migration chạy được trên **DB đã có dữ liệu** — chưa có bằng chứng migration nào ở
đây chạy thật trên DB có số liệu. Đưa vào backlog với owner, **không** sửa vội.

---

## 4. Definition of Done

- [ ] A1–A6, B1–B3, C1–C3 pass bằng lệnh ghi ở §2
- [ ] Mỗi test mới **fail trước** khi sửa, **pass sau** (Hazard 10) — dùng
      `git show HEAD:<file> > <file>`, **không** `git checkout --` (Hazard 11)
- [ ] `check-multi-agent.mjs` exit 0, **không** tăng số cảnh báo (hiện 50)
- [ ] `scan-secrets.mjs` exit 0
- [ ] `docs/CLAIMS.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã append
- [ ] Báo cáo trung thực: `Pass` / `CHƯA CHẠY` / waive có lý do

**Bàn giao Owner (không đóng được trong repo):** OW-01 rotate secret · OW-05 quyết
định nghiệp vụ · CI billing · M2/M3 cần migration · 9 mismatch FE↔BE.