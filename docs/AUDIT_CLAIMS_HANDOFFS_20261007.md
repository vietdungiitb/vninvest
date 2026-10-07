# AUDIT CLAIMS & HANDOFFS — 2026-10-07

> **Phạm vi:** rà trạng thái claim, handoff, open-work trong `docs/CLAIMS.md` và `docs/`.
> **Nguồn sự thật:** `docs/CLAIMS.md` (registry) + `git` (bằng chứng) + `AGENTS.md` (bối cảnh).
> **Nguyên tắc:** chỉ kết luận dựa trên lệnh đã chạy thật. Mục nào **CHƯA CHẠY** sẽ ghi rõ.

---

## 0. Tóm tắt

| Chỉ số | Giá trị | Cách đo |
|---|---|---|
| Tổng dòng `CLAIMS.md` | **759** | `(Get-Content docs/CLAIMS.md \| Measure-Object -Line).Lines` |
| Claim `in-progress` | **48** | `Select-String "in-progress"` |
| Claim `done` | **43** | `Select-String "\bdone\b"` |
| Claim `released` | **67** | `Select-String "released"` |
| Claim `blocked` | **2** | `Select-String "blocked"` |
| Số file `*HANDOFF*` trong `docs/` | **65** | `Get-ChildItem docs -Recurse -Filter "*HANDOFF*"` |
| File `OPEN_WORK_*` | **2** | `OPEN_WORK_20260927.md`, `OPEN_WORK_20260929.md` |
| Working tree | **KHÔNG sạch** | `docs/evidence/portfolio-commercial/REPORT_FINAL.md` (M) + `docs/_workflow/` (??) |

**Kết luận chính:** `CLAIMS.md` **không sạch** — còn **48 dòng** chứa chuỗi `in-progress`,
nhưng phần lớn nằm trong **scope mô tả của claim đã `done`** (ví dụ dòng 948, 952 ghi
`"...claim L277 in-progress"` trong cột `scope` chứ không phải trạng thái hiện hành).
Cần phân biệt **claim thật đang giữ** (2 nhóm) với **nhắc nhở lịch sử** (46 dòng).

---

## 1. Claims Audit

### 1.1 Phân loại theo bằng chứng

| Nhóm | Số dòng | Bằng chứng | Kết luận |
|---|---|---|---|
| **A. Claim `in-progress` THẬT — còn giữ file** | 8 dòng | `CLAIMS.md:859-861` (Slice A/B/C của `owner-audit-fix`) + `:940-942` (Slice E/F/G) | ⚠ **Cần xác minh** — branch `feat/openwork-ow02-03-04` **tồn tại local + remote** |
| **B. Claim `in-progress` trên branch hiện tại** | 4 dòng | `CLAIMS.md:952,954,956,958` (`opencode-portfolio-p0`, `-b`, `-c`, `supersede-stale-claims`) | ✅ `956` ghi rõ `done` nhưng claim cha `952`/`954` chưa đóng |
| **C. Claim đã bị hủy nhưng dòng gốc còn `in-progress`** | 4 dòng | `CLAIMS.md:959-960` ghi rõ đã hủy 4 claim: `portfolio-exec-plan` (L251), `sec03-secret-scan` (L259), `portfolio-w3-api` (L277), `owner-audit-fix` (L942) | ⚠ **Dòng gốc chưa đổi trạng thái** — chỉ có dòng bổ sung |
| **D. Nhắc nhở lịch sử trong cột `scope`** | ~46 dòng | VD `CLAIMS.md:948` scope ghi `"views_dnse.py BI LOAI: claim L277 in-progress"` nhưng status = `done` | ℹ **KHÔNG phải nợ** — nhiễu khi đếm bằng grep |
| **E. Blocked (chờ Owner)** | 2 dòng | `AGENTS.md` mục P0-SEC-01 + P0-LEGAL-01 | ✅ Hợp lệ, có owner rõ |

### 1.2 Nhóm A — `owner-audit-fix` (claim thật đang giữ)

| Dòng | Slice | Nội dung | Files chính |
|---|---|---|---|
| `CLAIMS.md:859` | B (quota) | `advisory/tasks.py:238` hoàn tiền sai tenant · `advisory/views.py:490-501` race quota thiếu `select_for_update` · `permissions.py:144-158` `IsTenantActive` fail-open · `settings.py:188` SQLite default | `advisory/tasks.py`, `advisory/views.py`, `identity_access/views_security.py`, `identity_access/utils/resolve_tenant.py`, `identity_access/permissions.py`, `support/views.py`, `vninvest_core/settings.py` |
| `CLAIMS.md:860` | A (fail-closed) | `saml_service.py:52` heuristic trên `sys.argv` · `:363-367` strict raise vô điều kiện ⇒ SSO không xác thực crypto · `vnpay_service.py:18` secret fallback `SECRET_DEMO` · `:64` log `vnp_SecureHash` ở INFO · `commercial/views.py:252` `ipn_amount=-1` | `saml_service.py`, `views/sso.py`, `vnpay_service.py`, `commercial/views.py`, `stripe_webhooks.py` |
| `CLAIMS.md:861` | C (đường push) | `.githooks/pre-push:18,28,32` không gọi `pre-push-gate.mjs` · `:298` tính `SKIP` là cho phép push · `agent-sync.ps1:159` chỉ đọc `backend/tests/` bỏ 2104 test ở `src/*/tests/` | `.githooks/pre-push`, `scripts/pre-push-gate.mjs`, `scripts/agent-sync.ps1` |
| `CLAIMS.md:940` | E (perf test) | 3 class `TransactionTestCase` → `TestCase` (1130s → 241s) · 7 view flat bị khai nhầm envelope | `identity_access/tests/test_login_upgrade.py`, `test_register_upgrade.py`, `test_operator_mail_config.py`, `data_ingest/tests/test_tasks.py` |
| `CLAIMS.md:941` | F (web ESM) | 3 suite chết vì `jest.mock` biên dịch thành `require` trong native ESM | `useOrderBook.test.js`, `useSessionFacts.test.js`, `AuthPages.test.js` |
| `CLAIMS.md:942` | G (schema) | 42 view portfolio_analytics + stock_mgmt_native; Errors 1073 → 752 | `portfolio_analytics_views.py`, `stock_mgmt_native_views.py`, `openapi-schema-baseline.json` |

**Bằng chứng giảm nhẹ:** `CLAIMS.md:960` ghi rõ Slice D đã `done` + Stripe đã xong,
và 4 claim stale đã bị hủy. `CLAIMS.md:942` được ghi trong danh sách hủy.

**Xác minh chạy được:**
```
git branch --list "*openwork-ow02*"   → feat/openwork-ow02-03-04 (tồn tại)
git ls-remote --heads origin          → remotes/origin/feat/openwork-ow02-03-04 (tồn tại)
```

**⚠ Rủi ro:** Branch `feat/openwork-ow02-03-04` tồn tại local **và** remote nhưng
**chưa có upstream** cho branch hiện tại → cần Owner xác nhận đây là công việc
**đang dở dang cần tiếp tục** hay **đã abort nhưng chưa dọn**.

### 1.3 Nhóm C — 4 claim đã hủy, dòng gốc chưa đóng

| Claim | Dòng | Bằng chứng hủy (theo `CLAIMS.md:959`) | Branch |
|---|---|---|---|
| `portfolio-exec-plan` | L251 | Branch `docs/portfolio-exec-plan-20260927` không tồn tại local; 3/7 file đã bị archive | ⚠ remote **vẫn còn** |
| `sec03-secret-scan` | L259 | Tự ghi push `--no-verify`; PR #46 chưa merge | — |
| `portfolio-w3-api` | L277 | `docs/evidence/wave3-api/` **KHÔNG TỒN TẠI** (đã verify bằng `Test-Path`) | ⚠ remote **vẫn còn** |
| `owner-audit-fix` | L942 | Thiếu cột ngày; file đã bị commit bởi `1e1b6e0c4` | ⚠ xem §1.2 |

**Đã xác minh:**
```
Test-Path docs/evidence/wave3-api        → False (đúng như claim ghi)
git branch -a --list "*portfolio-w3*"    → remotes/origin/feat/portfolio-w3-api (remote còn)
git branch -a --list "*portfolio-exec*"  → remotes/origin/docs/portfolio-exec-plan-20260927 (remote còn)
```

**→ Đây chính là "nợ ẩn" cần xử lý:** branch đã hủy ở local nhưng **còn trên remote**,
không ai dọn. Không gây conflict file nhưng gây rối khi agent mới nhìn thấy.

### 1.4 Working tree KHÔNG sạch

```
 M docs/evidence/portfolio-commercial/REPORT_FINAL.md
?? docs/_workflow/
```

| File | Tình trạng | Ghi chú |
|---|---|---|
| `docs/evidence/portfolio-commercial/REPORT_FINAL.md` | Modified, **CHƯA commit** | Theo `CLAIMS.md:956`, file này thuộc claim `opencode-portfolio-p0-c` đã `done`. Sửa dở chưa commit → cần xác minh nội dung diff |
| `docs/_workflow/` | Untracked, 14 file | Chứa `gates.json`, `STATE.json`, `gate-01..08`, `LESSONS.md` (**chỉ 128 bytes**), `README.md`, `VERIFICATION.md`. **Không ai claim theo `CLAIMS.md`** |

**⚠ Cần Owner xác nhận:** `docs/_workflow/` có phải hệ thống workflow chính thức cần commit,
hay là scratch pad của agent trước? `LESSONS.md` 128 bytes cho thấy **chưa được viết đầy đủ**
(đã có `docs/LESSONS/` thật từ commit `6c49f5741`).

---

## 2. Handoffs Audit

| Chỉ số | Giá trị |
|---|---|
| Tổng file `*HANDOFF*` | **65** |
| Xác minh tồn tại | `docs/HANDOFF_20261005.md` → **True** |

**Vấn đề:** 65 file handoff nhưng **không có bảng trạng thái** nào trong `CLAIMS.md`
hoặc `OPEN_WORK_*` trỏ tới chúng. Không thể xác định bằng lệnh đơn giản file nào:
- đã xử lý hoàn toàn
- còn action item mở
- là archive lịch sử

**⚠ CHƯA CHẠY:** chưa rà nội dung 65 file handoff để trích `TODO`/`Next steps`/`Follow-up`.
Việc này cần làm riêng (Bước 5 của kế hoạch cleanup) — **không nên kết luận "tất cả đã xong"**.

---

## 3. Open Work Audit

| File | Size | Ngày | Ghi chú |
|---|---|---|---|
| `docs/OPEN_WORK_20260927.md` | 32,341 B | 2026-09-27 | Được `AGENTS.md` chỉ định là **nguồn sự thật** cho 6 việc OW-01..OW-06 |
| `docs/OPEN_WORK_20260929.md` | 8,700 B | 2026-09-29 | **Thứ tự đảo** — file mới hơn nhưng nhỏ hơn gấp 3.7 lần |

**⚠ Rủi ro phát hiện được:** Có **2** file `OPEN_WORK` cùng họ ký hiệu nhưng
`AGENTS.md` chỉ trỏ tới `20260927`. `OPEN_WORK_20260929.md` có thể:
- (a) supersede file 27 → thì `AGENTS.md` **stale**, hoặc
- (b) là phần bổ sung → thì phải merge nội dung

**CHƯA CHẠY:** chưa đọc nội dung `OPEN_WORK_20260929.md` để phân định (a)/(b).

### 3.1 Các P0 trong `AGENTS.md` (trích nguyên văn, không diễn giải)

| ID | Vấn đề | Trạng thái | Chủ quyền |
|---|---|---|---|
| **P0-SEC-01** | `compose.dev.env` tracked + không ignored, chứa `DNSE_CREDENTIAL_FERNET_KEY` 44 ký tự ⇒ **mọi `UserDNSECredential` giải mã được**; 4 token GitHub thật / 20 file; 11 file `scratch/*.py` là code chạy được | ⛔ **CHỜ OWNER** | Owner |
| **P0-LEGAL-01** | License `vnbroker` chưa ký ⇒ **R3 live trading không tồn tại** | ⛔ CHỜ OWNER | Owner |
| AI Advisory quota | Gemini hết hạn mức (429 cả 3 request) | 🔧 **Cần nạp tiền/đổi gói** — không phải lỗi code | Owner |
| AI CC Rev.2 | R2.5 `openclaw` **BLOCKED** chờ 5 thông tin D-03c | ⛔ CHỜ OWNER | Owner |

---

## 4. Đánh giá công việc 2026-10-07 (LESSONS + skill)

| Hạng mục | Commit | Trạng thái |
|---|---|---|
| `docs/LESSONS/` (7 file: INDEX + 6 topic) | `6c49f5741` | ✅ Đã commit, **CHƯA push** |
| `skills/project-lessons/SKILL.md` | `6c49f5741` | ✅ Đã commit, **CHƯA push** |
| `docs/AGENT_PROTOCOL.md` §11 Planning Gate | `6c49f5741` | ✅ Đã commit (+42 dòng, 0 dòng bị xoá), **CHƯA push** |

**Gate đã chạy thật:** `check:multi-agent` → `0 lỗi, 0 trùng số migration — PASS`.
Hook `check:multi-agent` cảnh báo **63** dòng claim tham chiếu file không tồn tại —
đây chính là nhiễu đã nêu ở §1.1 nhóm D (script parse `CLAIMS.md` bằng regex không
phân biệt cột `scope` với cột `status`).

**CHƯA CHẠY:** `pre-push-gate.mjs`, `agent-sync.ps1`, `npm run build`, test suite.
Theo `docs/LESSONS/build-gates.md` **L-G02** (tự tạo trong commit này):
**không được báo PASS cho những thứ chưa chạy.**

---

## 5. Gaps & Inconsistencies

| # | Gap | Mức | Bằng chứng |
|---|---|---|---|
| **G-1** | Branch `feat/openwork-ow02-03-04` có claim `in-progress` (8 dòng) nhưng **không có ai đang chạy** (`git status` không sạch nhưng không có dấu hiệu agent active) | 🟠 Cao | `CLAIMS.md:859-861, 940-942` vs `git branch --list` |
| **G-2** | 4 claim đã hủy nhưng **branch remote vẫn còn** (`portfolio-w3-api`, `portfolio-exec-plan-20260927`) | 🟠 Cao | `git branch -a --list` |
| **G-3** | `docs/_workflow/` untracked 14 file, **không ai claim** trong `CLAIMS.md` | 🟡 TB | `git status` vs `CLAIMS.md` |
| **G-4** | `REPORT_FINAL.md` sửa dở chưa commit dù claim `opencode-portfolio-p0-c` đã `done` | 🟡 TB | `git status` vs `CLAIMS.md:956` |
| **G-5** | 2 file `OPEN_WORK` cùng họ, `AGENTS.md` chỉ trở 1 → nghi nễ **stale reference** | 🟡 TB | `AGENTS.md` Progress vs `docs/OPEN_WORK_20260929.md` |
| **G-6** | 65 file handoff **không có bảng trạng thái** nào trỏ tới | 🟡 TB | `Get-ChildItem docs -Recurse -Filter "*HANDOFF*"` |
| **G-7** | 63 cảnh báo false-positive từ `check:multi-agent` do parse `CLAIMS.md` không phân biệt `scope` vs `status` | 🟢 TB | Output hook khi commit |
| **G-8** | `CLAIMS.md` 216 KB / 759 dòng — lớn dần, khó đọc thủ công | 🟢 Thấp | `Get-Item docs/CLAIMS.md` |

---

## 6. Recommended Next Actions

> Thứ tự theo **rủi ro × khả thi**. Mỗi bước độc lập, review được riêng.

| # | Hành động | Mức | Owner | Bằng chứng cần có |
|---|---|---|---|---|
| **1** | **Push branch `feat/portfolio-p0-20261005`** (chứa commit `6c49f5741`) — hiện **CHƯA** lên remote | 🔴 P0 | Tự làm | `git ls-remote --heads origin` thấy branch |
| **2** | **Xác minh `owner-audit-fix` (L859-861, L940-942)**: tiếp tục hay abort? Nếu tiếp tục → cần agent giữ; nếu abort → append dòng `superseded` | 🔴 P0 | **Owner** | Diff `feat/openwork-ow02-03-04` vs `dev` + trạng thái PR |
| **3** | **Dọn 2 branch remote đã hủy**: `origin/feat/portfolio-w3-api`, `origin/docs/portfolio-exec-plan-20260927` | 🟠 P1 | **Owner** | Xác nhận không còn PR mở |
| **4** | **Quyết định `docs/_workflow/`**: commit vào repo (thành hệ thống workflow) hay xoá (scratch pad)? | 🟠 P1 | **Owner** | Kiểm tra `README.md` + `STATE.json` trong thư mục |
| **5** | **Commit `REPORT_FINAL.md`** hoặc revert — không để dở sửa chưa commit | 🟡 P1 | Tự làm | `git diff docs/evidence/portfolio-commercial/REPORT_FINAL.md` |
| **6** | **Phân định 2 file `OPEN_WORK`**: merge `20260929` vào `20260927`, hoặc cập nhật `AGENTS.md` trỏ đúng file | 🟡 P1 | Tự làm | Đọc `OPEN_WORK_20260929.md` |
| **7** | **Bảng trạng thái 65 file handoff** — thêm index `docs/HANDOFF_INDEX.md` | 🟢 P2 | Tự làm | Grep `TODO`/`Next steps` trong 65 file |
| **8** | **Sửa parser `check:multi-agent.mjs`** để phân biệt cột `scope` vs cột `status` (giảm 63 false-positive) | 🟢 P2 | Tự làm | Gate chạy còn 0 cảnh báo giả |

**Việc KHÔNG nên tự làm** (cần Owner):
- Push/xoá branch remote
- Abort hoặc tiếp tục claim `owner-audit-fix`
- Xử lý `P0-SEC-01` (revoke/rotate/purge — xem `docs/LESSONS/security.md` **L-S01**)

---

## 7. Appendix — Lệnh đã chạy

```powershell
# Trạng thái repo
git status --short
git branch --show-current                                    # feat/portfolio-p0-20261005
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'        # fatal: no upstream configured
git log --oneline dev..HEAD                                  # 9 commit portfolio chưa push

# CLAIMS.md
(Get-Content docs\CLAIMS.md | Measure-Object -Line).Lines     # 759
Select-String -Path docs\CLAIMS.md -Pattern "in-progress"     # 48
Select-String -Path docs\CLAIMS.md -Pattern "\bdone\b"         # 43
Select-String -Path docs\CLAIMS.md -Pattern "released"        # 67
Select-String -Path docs\CLAIMS.md -Pattern "blocked"         # 2

# Handoff + Open Work
(Get-ChildItem docs -Recurse -Filter "*HANDOFF*" -File).Count  # 65
Get-ChildItem docs -Filter "OPEN_WORK*" -File                  # 2

# Xác minh file/branch
Test-Path docs/evidence/wave3-api                             # False
Test-Path docs/HANDOFF_20261005.md                             # True
Test-Path docs/AUDIT_20261004.md                               # True
git branch -a --list "*openwork-ow02*" "*portfolio-w3*" "*portfolio-exec-plan*"
```

## 8. Appendix — File đã tạo 2026-10-07

| File | Nội dung |
|---|---|
| `docs/LESSONS/INDEX.md` | Index + mapping tag → file + quy tắc ghi lesson mới |
| `docs/LESSONS/multi-agent.md` | L-001..L-008 |
| `docs/LESSONS/migrations.md` | L-M01..L-M03 |
| `docs/LESSONS/build-gates.md` | L-G01..L-G03 |
| `docs/LESSONS/backend.md` | L-B01..L-B03 |
| `docs/LESSONS/frontend.md` | L-F01..L-F03 |
| `docs/LESSONS/security.md` | L-S01..L-S02 |
| `skills/project-lessons/SKILL.md` | Skill autoload theo ngữ cảnh |
| `docs/AGENT_PROTOCOL.md` §11 | Planning Gate (sửa, +42 dòng) |
| `docs/AUDIT_CLAIMS_HANDOFFS_20261007.md` | File này |