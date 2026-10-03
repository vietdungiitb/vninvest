# PLAN — Đóng BLOCKER/HIGH `vninvest`

**Ngày:** 2026-10-04 · **Base:** `dc65b342a` (`feat/openwork-ow02-03-04`)
**Nguồn:** `docs/AUDIT_20261004.md` · **Quy trình:** `multi-agent-workflow` Mode B
**Owner:** coordinator (quyết cả owner-gated trong phạm vi repo)

---

## 0. Baseline — exit code THẬT trước khi sửa (Hazard 6)

Không được đòi `PASS` từ một gate vốn đã đỏ mà không ghi nhận.

| Lệnh | Exit baseline | Ghi chú |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | `0` | nhưng có 14 cảnh báo |
| `node packages/web/scripts/scan-secrets.mjs` | `0` | 3454 file |
| `node scripts/pre-push-gate.mjs` | **`CHƯA CHẠY`** | sẽ chạy ở Stage 6 |
| `.githooks/pre-push` (qua `git push`) | **không gọi gate nào** | `H4` — chính là thứ cần sửa |
| `pytest backend/src` | **`CHƯA XONG` sau 30 phút** | `M7` — không có timeout |
| `pytest` theo app | `CHƯA CHẠY` | dùng để chứng minh slice |

> **Không có tiêu chí nào ở dưới đây đòi `PASS` từ full-suite `pytest`**, vì nó
> chưa từng chạy xong trong thời gian hợp lý. Tiêu chí dùng **pytest theo app**, có
> đường dẫn lệnh rõ ràng.

---

## 1. Slice và tính rời nhau

| Slice | Nội dung | File (chính xác) |
|---|---|---|
| **A** | Auth + thanh toán fail-closed | `identity_access/saml_service.py`, `identity_access/views/sso.py`, `commercial/vnpay_service.py`, `commercial/views.py`, `commercial/stripe_webhooks.py`, `vninvest_core/env_validation.py` |
| **B** | Tính đúng của quota | `advisory/tasks.py`, `advisory/views.py`, `identity_access/views_security.py`, `identity_access/utils/resolve_tenant.py` |
| **C** | Toàn vẹn đường push | `.githooks/pre-push`, `scripts/agent-sync.ps1` |

Kiểm tra rời nhau: **A∩B = ∅**, **A∩C = ∅**, **B∩C = ∅** ⇒ có thể chạy song song.
Tuy nhiên **C tự khóa mình**: sửa hook push có thể chặn chính commit của tôi, và
`.githooks/pre-push:14` chỉ chạy trên nhánh feature. Vì vậy **C chạy SAU A+B**, để
lỡ hỏng thì A+B vẫn commit được. Đây là ràng buộc thứ tự, không phải ràng buộc file.

**Không giao cho subagent:** A và B sửa logic tiền/quyền — cần đọc kỹ ngữ cảnh.
C sửa chính bộ chặn của agent, phải tự kiểm soát. Slice D (9 mismatch FE↔BE) **không
làm ở phiên này** vì mỗi mục phải xác minh mục đích sử dụng trước; xem §4.

---

## 2. Tiêu chí nghiệm thu — Given/When/Then

### Slice A

| # | Given/When/Then | Lệnh chứng minh |
|---|---|---|
| A1 | Given `SAML_SIGNATURE_VERIFICATION_MODE` không phải `noop`, When gọi endpoint SSO, Then **từ chối** (403) và **không** cấp token | `pytest .../identity_access/tests -k saml` |
| A2 | Given `DJANGO_DEBUG=false` và argv chứa `latest`, When chọn mode, Then **không** rơi về `noop` | test đơn vị `_default_signature_mode` |
| A3 | Given production không set `VNPAY_HASH_SECRET`, When `validate_production_settings`, Then **raise** | `pytest .../vninvest_core/tests -k env_validation` |
| A4 | Given IPN có `vnp_Amount="abc"`, When xử lý callback, Then trả `RspCode 99` và **không** kích hoạt subscription | `pytest .../commercial/tests -k ipn` |
| A5 | Given Stripe price ID lạ, When webhook tới, Then **từ chối**, không cấp plan `pro` | `pytest .../commercial/tests -k stripe` |

### Slice B

| # | Given/When/Then | Lệnh chứng minh |
|---|---|---|
| B1 | Given thành viên **không phải owner**, When hoàn quota, Then credit đúng tenant đã tiêu | `pytest .../advisory/tests -k refund` |
| B2 | Given 2 request đồng thời với trần 1, When cả hai chạy, Then **một** cái bị từ chối | `pytest .../advisory/tests -k quota` |
| B3 | Given role chỉ có `security:read`, When gọi `partner_revoke_session`, Then **403** | `pytest .../identity_access/tests -k revoke` |

### Slice C

| # | Given/When/Then | Lệnh chứng minh |
|---|---|---|
| C1 | Given commit trên nhánh feature, When `git push`, Then hook **có** chạy gate thật (không phải `exit 0` sớm) | đọc `.githooks/pre-push` + chạy tay hook |
| C2 | Given backend test fail, When push, Then push **bị chặn** | test âm: cốm ý làm fail 1 test |

---

## 3. Ngoài phạm vi (non-goals) — thỏa thuận trước

| # | Không làm | Vì sao |
|---|---|---|
| 1 | **KHÔNG** cài `python3-saml`/`xmlsec1` | `AGENTS.md` cấm `pip install` khi chưa hỏi. Sửa A1 theo hướng **fail-closed**: từ chối SSO |
| 2 | **KHÔNG** lọc lịch sử git | `AGENTS.md` §2.1: cấm khi còn agent chạy |
| 3 | **KHÔNG** rotate secret thật | OW-01 cần network + owner |
| 4 | **KHÔNG** quyết OW-05 | Cần owner quyết định nghiệp vụ |
| 5 | **KHÔNG** sửa `.github/workflows` | CI chết vì billing (`AGENT_PROTOCOL.md:235`) |
| 6 | **KHÔNG** sửa 9 mismatch FE↔BE | Mỗi mục phải xác minh mục đích sử dụng trước; xem §4 |
| 7 | **KHÔNG** đụng `compose*.yml`, `.env*`, ledger | Shared-file deny list (`AGENT_PROTOCOL.md` §2) |

---

## 4. Slice D — vì sao hoãn

9 mismatch FE↔BE (`AUDIT_20261004.md` §4) **không được sửa hàng loạt**. Adapter có
thể là code chết, hoặc FE có thể đang gọi qua `LEGACY_BACKACTION_URL` tới backend khác
(`settings.py:197` cho thấy cơ chế proxy tồn tại). Sửa đường dẫn mà không xác minh
chỗ gọi là tạo lỗi mới.

Cần trước khi làm: `grep` call-site của từng method, xác minh có thật sự dùng không.

---

## 5. Rollback từng slice

Mỗi slice là một commit riêng ⇒ `git revert <hash>` độc lập, không đụng slice khác.
Không dùng `git checkout -- <file>` để thử nghiệm (Hazard 11).

---

## 6. Definition of Done

Cả 3 slice A+B+C:

- [ ] A1–A5, B1–B3, C1–C2 pass bằng **lệnh pytest ghi trong §2**
- [ ] Test mới **fail trước** khi sửa, **pass sau** (Hazard 10) — bằng cách tạm thay
      file bằng bản `HEAD:` rồi hoàn nguyên
- [ ] `check-multi-agent.mjs` exit 0, **không** thêm cảnh báo mới
- [ ] `scan-secrets.mjs` exit 0
- [ ] Claim của tôi `in-progress` → `done`
- [ ] Báo cáo trung thực: gate nào `Pass`, gate nào `CHƯA CHẠY`

**Ngoài DoD (không đóng được, bàn giao Owner):** OW-01, OW-05, CI billing,
SAML verify thật (cần cài đặt được duyệt).