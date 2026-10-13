# WORKLOG — vninvest

> Nhật ký công việc. Mỗi dòng có **bằng chứng lệnh tái lập**, không ghi "PASS" cho thứ chưa chạy.
> Quy ước: `PASS` (đã chạy, xanh) · `FAIL` (đã chạy, đỏ) · `CHƯA CHẠY` (chưa chạy được).

## 2026-10-13 - Đóng P0 "test suite không chạy được" (PM/Tech Lead, Mode B solo)

| # | Task | Kết quả | Bằng chứng (lệnh) | Rủi ro | Next |
|---|---|---|---|---|---|
| 1 | Nạp skill `project-lessons` + `multi-agent-workflow` trước khi lập kế hoạch | PASS | Đọc `docs/LESSONS/{multi-agent,build-gates,tooling-traps,migrations}.md`; đọc `docs/HANDOFF_20261012_AFTER_RESCUE.md` | - | - |
| 2 | Đo baseline `dev` **sạch** (không tái dùng số liệu branch khác) | PASS | `pre-push-gate` **21/0/0**; full BE `Ran 2959 · failures=9 · errors=14 · skipped=6` (1565s) | - | - |
| 3 | Kiểm handoff cũ còn đúng không | PASS | §3.2/§3.3 đã sửa (`f540a0e9e` ∈ `dev`); §3.4 đã xoá (`790a53166` ∈ `dev`, grep `vn-kpi__` = 0 hit) | **Handoff cũ sai 3/4 mục** | Đã ghi rõ trong handoff mới |
| 4 | Tìm nguyên nhân gốc 14 error — **bằng probe, không đoán** | PASS | `LedgerEntry.objects.count()==1` **trước** khi `forwards()`; gọi `forwards()` trực tiếp ⇒ `IntegrityError Key (tenant_id=1, external_id='B-1')` | - | - |
| 5 | Chứng minh là xung đột ngâm, không phải hồi quy | PASS | test `c804a9422` (2026-10-03) · signal `d7226a591` (2026-10-06) · test lộ ra `768d0897f` (2026-10-12) | - | - |
| 6 | Tạo branch + **khai claim commit riêng** trước dòng code đầu tiên | PASS | `5ce4d9c63`; `docs/CLAIMS.md` `git diff --numstat` = `6/1` (đúng số dòng thêm) | - | - |
| 7 | Fix migration `0022` idempotent | PASS | `_existing_refs()` + bỏ qua `already_synced`; verify vẫn so `len(entries)` | Migration đã chạy ở DB nào đó thì không tái chạy | - |
| 8 | **Fail-before** chứng minh bằng vòng thật | PASS | Gỡ guard ⇒ `errors=1` `IntegrityError duplicate key ... Key (tenant_id=1, external_id='B-1')`; dựng lại ⇒ OK | Không dùng `git checkout --` (L-A01) | - |
| 9 | Fix fixture test (không nới lỏng assertion) | PASS | `_tx()`→`bulk_create`; `_tx_raw()` chỉ áp cho test đang FAIL | Test đang xanh giữ nguyên nguyên bản | - |
| 10 | Phát hiện **`seed_ledger_verification.py` là lệnh thật, không phải lỗi test** | PASS | Lệnh tự báo đỏ `LedgerEntry=5, CashFlow=5, Transaction=6` trên chính dữ liệu sạch của nó | - | - |
| 11 | Chạy lại full BE | PASS | **`Ran 2960 tests — OK (skipped=6)`** (2566s) | - | - |
| 12 | Rebase → check migration → gate (đúng thứ tự L-G01) | PASS | rebase sạch (`dev` không nhúc nhích) → `makemigrations --check` **No changes detected** → `pre-push-gate` **21/0/0** | - | - |
| 13 | Gate đầy đủ sau rebase | PASS | `check` 0 · `ruff --select F821` All checks passed · `check_admin_ux` 0/0 + self-test 25/25 · `test_admin_ui` **45/45** · `tsc` 0 · `lint` 0 error · `build` 0 · FE **918/918** | - | - |
| 14 | Ghi trung thực FE flake (không làm xanh) | **Ghi trung thực** | 3 run: run1 `2 failed \| 916 passed`, run2 **918/918**, run3 **918/918**; `tenantreg-auth-pages` riêng **29/29** | **Không ghi được tên file fail ở run 1** ⇒ không khẳng định là file đó | Phiên sau ghi tên khi gặp |
| 15 | Cập nhật ledger + báo cáo + handoff | PASS | ledger `## Entry 276`; `REPORT_FINAL_20261013.md`; `HANDOFF_20261013.md`; file này | - | - |
| 16 | **CHƯA CHẠY**: Playwright/E2E | CHƯA CHẠY | Đã xác nhận nguyên nhân: `vite.config.ts` khai `proxy` chỉ trong `server:` (dòng 27-43), **không có** khối `preview:`; `playwright.config.ts:71` chạy `npm run preview` | Sửa mà không chạy thật = không chứng minh được | Ticket riêng |
| 17 | **CHƯA CHẠY**: `ruff` mức cấu hình đầy đủ | CHƯA CHẠY | Chỉ chạy `--select F821`. 3 140 lỗi style còn lại | Owner phải chọn mức | Hỏi Owner |
| 18 | **CHƯA CHẠY**: `LiveBrokerContractTests` | CHƯA CHẠY | Cần `VNBROKER_RUN_LIVE_CONTRACT=1` + JWT thật | - | - |
| 19 | **CHƯA CHẠY**: CI billing | CHƯA CHẠY | Job bị chặn "recent account payments have failed"; `scan` vẫn chạy | Không riêng repo | Owner trả billing |
| 20 | **KHÔNG TỰ LÀM**: purge git history (P0-SEC-01) | Chờ Owner | `gh repo view` ⇒ `isPrivate: false` (**PUBLIC**) — điều kiện "không rotate" của `AGENTS.md` (2026-10-07) **đã không còn đúng** | Force-push không hoàn tác được | Owner chọn |

### Sai lầm của chính mình trong phiên này — ghi lại để không lặp

| # | Sai lầm | Hậu quả | Bắt bằng gì |
|---|---|---|---|
| 1 | Khai claim lần đầu **chèn giữa file** thay vì append cuối | Phải làm lại | `docs/AGENT_PROTOCOL.md` §3 |
| 2 | **L-T01 lần 10**: `Edit` đổi LF→CRLF trên `0022_...py` | `numstat` ra `307/252` thay vì `56/1` | `git diff --numstat` **trước khi stage** |
| 3 | **L-T01 lần 11**: `Edit` đổi LF→CRLF trên `test_review_findings_wave2.py` | `numstat` ra `867/868` thay vì `39/40` | `git diff --numstat` trước khi stage |
| 4 | **`Edit` khớp `oldString` chỉ với TIỀN TỐ của một method** | Nuốt mất assertion `CashFlow.objects.count() == 0` của test kế bên. Test kia FAIL **ở file khác** lúc tôi đang nhìn file khác | Đọc `git diff` cuối cùng — "test xanh" **không** phải giấy phép bỏ qua soi file |
| 5 | Dùng `Write` để ghi đè `docs/WORKLOG.md` thay vì chèn | **Mất nguyên mục 2026-10-12** (file còn trong git nên đã khôi phục được ngay) | `git checkout --` khôi phục; chèn bằng script Node |
| 6 | Lọc output vitest bằng mẫu không khớp | **Không ghi được** tên file FE fail ở run 1 | Tách `$LASTEXITCODE` khỏi pipeline (L-F07) |

### Sai lầm của **phiên trước** — đo lại được, không phải suy đoán

| Claim cũ | Thực tế | Lệnh tái lập |
|---|---|---|
| "Bug KBS: KBS cần ≥2 ngày" | **SAI** — `TickerModel` không có validator nào; cả 1 ngày lẫn 2 ngày đều `ValueError` vì **KBS chưa có bar cho ngày đó** | `vnbroker==3.7.2` thật |
| "Timestamp tick lệch 7h còn dở" | **ĐÃ SỬA** | `git merge-base --is-ancestor f540a0e9e origin/dev` → 0 |
| "Dead CSS `vn-kpi__*` còn dở" | **ĐÃ XOÁ** | `grep vn-kpi__ vnadmin.css` → 0 hit |
| "Full BE 724 test OK" | Đúng cho **trước** `768d0897f`; nay là 2959 test / 23 lỗi | `manage.py test --noinput` trên `dev` sạch |
## 2026-10-12 — Rotate secret · dọn branch · fix bug · audit toàn diện

| # | Task | Kết quả | Bằng chứng (lệnh) | Rủi ro | Next |
|---|---|---|---|---|---|
| 1 | Kiểm tra điều kiện L-S01 (không agent chạy) | PASS | `grep in-progress CLAIMS.md` → 0; `git status` sạch | — | — |
| 2 | Backup DB trước rotate | PASS | `pg_dump` schema + 2 bảng credential → `%TEMP%` | — | — |
| 3 | Đo tác động rotate (không đoán) | PASS | `UserDNSECredential`=0; `CorePATCredential`=252 → 210 chưa revoke → 209 hết hạn → **0 còn hiệu lực** | — | Hỏi Owner |
| 4 | Rotate `DNSE_CREDENTIAL_FERNET_KEY` + `CORE_PAT_PEPPER` | PASS | Fernet roundtrip PASS; PAT hash 64 hex; ghi vào `compose.dev.env` (local, không commit) | Mất **0** token thật | — |
| 5 | Chặn tái diễn (`.githooks/pre-commit`) | PASS | Repo thật: `ok.txt` rc=0 CHO QUA · `compose.dev.env` rc=1 CHAN · `.env` rc=1 CHAN · `compose.prod.env` rc=1 CHAN | — | — |
| 6 | Xoá branch đã merge | PASS | 16 branch, `merge-base --is-ancestor` = 0 | — | — |
| 7 | Xoá branch chưa merge | PASS | 24 branch diff **rỗng** (đã vào dev qua squash) + 3 branch doc đã hợp nhất vào ledger Entry 265–270 | **Có 1 sự cố tôi tạo**: tag an toàn trỏ vào commit trên `dev` ⇒ **không** bảo vệ commit branch. Đã verify nội dung vẫn còn trong `dev` | Đã xác minh không mất dữ liệu |
| 8 | Fix KBS realtime `None` | PASS | Trước `None` → sau `close=225500.0` | — | — |
| 9 | Bác bỏ claim sai của phiên trước | PASS | Chứng minh bằng thực nghiệm: 1 ngày **và** 2 ngày cùng `ValueError`; 5/30/120 ngày OK | — | — |
| 10 | Fix timestamp lệch 7h | PASS | assert: `14:35+00:00` vs `07:35+00:00` ⇒ lệch **7.0** | — | — |
| 11 | Fix `NameError` do xoá import | PASS | `market_data` 167/167 OK | — | — |
| 12 | Cài `ruff` (Owner cho phép) | PASS | `ruff 0.17.0` trong `.venv`; **không** thêm `requirements.txt` | — | — |
| 13 | Fix 8 lỗi `F821 NameError` | PASS | `ruff --select F821` → **All checks passed**; full BE 724 OK | — | — |
| 14 | Xoá CSS dead `vn-kpi__*` | PASS | `git grep` = 0 template dùng; `numstat` **0/36**; gate 25/25; test 45/45 | — | — |
| 15 | **Phát hiện P0: 147 file test không được chạy** | **FAIL** | `TOPLEVEL {'tests': 724}` · `HAS_market_data_tests False` · `USER_WORKSPACE_TESTS 2` (app có 21 file) | **CAO** | S1.1 |
| 16 | Đo 12 app bị bỏ | **FAIL (môi trường)** | 1 501 test → **218 errors**; 209/218 do `psycopg2.OperationalError` | Cao | Cần ≥4 GB RAM free |
| 17 | Full FE suite | PASS | `npm run test:components` → 128 file / **918 test** | — | — |
| 18 | pre-push gate (2 lần) | PASS | 21 PASS / 0 SKIP / 0 FAIL | — | — |
| 19 | Push 4 commit lên `dev` | PASS | `211c0b5d5` | — | — |
| 20 | Khôi phục 10 container worker | PASS | 19 container đang chạy | — | — |

### Chi tiết bug đã sửa

| Commit | File | Vấn đề |
|---|---|---|
| `5979cefaa` | `.githooks/pre-commit`, `.gitignore` | Thiếu `compose*.env` trong deny-list |
| `57022e823` | `vnbroker_adapter.py` | `fetch_realtime_price` trả `None`; timestamp lệch 7h |
| `30966a2f7` | `vnadmin.css` | 36 dòng dead code |
| `211c0b5d5` | 5 file | 8 lỗi `F821 NameError` |

### Bài học (Stage 8)

1. **L-T01 phạm 9 lần trong 1 phiên.** `Edit` tool trên Windows đổi LF→CRLF mỗi lần. Nếu không có `git diff --numstat` trước khi stage: `574/574` (thay vì 11/11), `1506/1484` (thay vì 28/6), `82/79` (thay vì 4/1).
2. **Claim phải kiểm lại.** "KBS cần ≥2 ngày" sai — chạy thật cho thấy cả 1 ngày lẫn 2 ngày đều lỗi, nguyên nhân thật là KBS **chưa có bar cho ngày đó**.
3. **Tag "an toàn" phải chứa commit cần giữ.** Tag tôi tạo trỏ vào commit trên `dev` ⇒ không bảo vệ gì. Phải tag **trước khi xoá** và trỏ tới **commit của branch**.
4. **"Full suite PASS" phải kèm số.** 724 OK trong khi tổng thực tế 2 225.

### Việc chưa làm

| Việc | Lý do |
|---|---|
| S1.1 sửa test discovery | Chưa bắt đầu — ưu tiên cao nhất session sau |
| S1.2 đo số lỗi thật | Host thiếu RAM (`vmmemWSL` 4.4 GB) |
| S1.3 fix `pytest` | Chưa làm (P1) |
| S1.4 cấu hình ruff | Cần Owner chọn mức |
| Purge git history | Cần Owner quyết (không thể hoàn tác) |

## 2026-10-12 (S1.1) — Sửa test discovery: 724 → 2932 test

| # | Task | Kết quả | Bằng chứng | Next |
|---|---|---|---|---|
| 21 | Viết `AppTestRunner` union 2 test root | PASS | `manage.py test` → `Ran 2932 tests` | — |
| 22 | AC1 (≥2200 test) | **PASS** | 2932 (+2208) | — |
| 23 | AC2 (`test_review_findings_wave2` chạy) | **PASS** | 14 dòng khớp trong log | — |
| 24 | AC3 fail-before | PASS | 724 không đạt AC1 | — |
| 25 | Đo lại số file test (đính chính 147→175) | PASS | `Get-ChildItem` lọc `__pycache__\|.venv\|node_modules` | — |
| 26 | Phân loại 51 lỗi mới lộ ra | PASS | 38 UniqueViolation · 13 FAIL · 2 OOM | Ticket riêng |
| 27 | Xác minh 23 lỗi ruff của `settings.py` là có sẵn | PASS | `git stash push/pop` (không `git checkout --`) | — |
| 28 | Khôi phục 10 container worker | PASS | 19 container đang chạy | — |

**Sửa sai của chính tôi**: Entry 273 ghi "147 file test bị bỏ" — sai. Đo lại
bằng công cụ cho **175 file / 246 file tổng**. Regex `\tests\` bỏ sót file ở
test con. Con số cũ đã được đính chính ngay trong ledger.

**Ba lỗi tự thân khi viết runner** (đều bị bắt bằng lệnh, không đoán):
`dirname` x2 thay vì x3 · `top_level` phải là `src/` không phải `backend/` ·
`extra_tests` keyword-only trên Django 5.1.

**CHƯA CHẠY**: sửa 38 lỗi `UniqueViolation` (cần xác định `TransactionTestCase`
hay thứ tự discovery) · 13 FAIL cụ thể · ruff mức cấu hình · purge git history.