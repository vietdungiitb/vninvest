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

## 2026-10-21 - UI Standardization W0 (template + 5 gate) + W1 (light theme (a)) — Owner chốt 2 quyết định (Agent solo, multi-agent-workflow Stage 1-8)

| # | Task | Kết quả | Bằng chứng (lệnh) | Rủi ro | Next |
|---|---|---|---|---|---|
| 1 | Đọc `project-lessons` + `multi-agent-workflow` **TRƯỚC** khi lập kế hoạch / khai claim | PASS | Đọc `docs/LESSONS/{css-soc,verification,multi-agent}.md`; ghi "Lessons áp dụng" trong plan | - | - |
| 2 | W0 Stage 1-3: plan v1.3 + audit plan (verdict `AGREE`) + 3 claim | PASS | `docs/PLAN_UI_STANDARDIZATION_W0.md`; audit `%TEMP%\opencode\PLAN_AUDIT_W0_v12.md` | - | - |
| 3 | W0 S1: template `CommercialPage` + 4 primitive + CSS module + test | PASS | `vitest src/components/__tests__/commercial-page.component.test.tsx` → **20/20**; 0 hex cứng | - | - |
| 4 | W0 S2: 5 gate máy baseline-locked + điểm gọi `pre-push-gate` | PASS | 5 gate exit 0 · `--self-test` **27 case** | Gate runtime đo trên **app sống** ⇒ tập vi phạm đổi theo dữ liệu | Vòng 3 (đã xử lý) |
| 5 | W0 S3: đo light theme + ADR (KHÔNG sửa token) | PASS | H1 `/admin/users` light = **1.0000:1 (vô hình)**; 28/60 chữ dưới AA (ADR §2) | - | - |
| 6 | **Audit code W0 vòng 1** (sub-agent độc lập, read-only) | **FAIL** | **2 BLOCKER + 10 MAJOR**: B-1 route không đo được bị coi "không vi phạm" (gate xanh + gợi ý **hạ baseline**); B-2 cặp FAIL đổi sang `oklch()` rơi khỏi tập ⇒ gate báo "đã hết" ⇒ **XANH** | Gate có đường xanh giả **đã chứng minh bằng chạy thật** | Vòng 2 (đã sửa) |
| 7 | Sửa W0 vòng 2: 2 BLOCKER + 9 MAJOR + probe suite | PASS | **Probe 17/17** đường lách bị bắt (fixture ngoài repo, baseline đo trên fixture **SẠCH** trước khi mutate — L-V04) | - | - |
| 8 | Push W0 + PR | PASS | pre-push **28 PASS / 0 FAIL**; **PR #272** (`feat/uistd-w0` → `dev`) | - | - |
| 9 | **Owner chốt** (2026-10-21): (1) light theme theo **(a)**; (2) M-10 + phần còn lại theo khuyến nghị | PASS | Ghi trong `docs/PLAN_UI_STANDARDIZATION_W1.md` + 2 claim | - | - |
| 10 | W1-A đo quy mô bằng script riêng (**có control**) | PASS | 227 màu Tailwind / 424 file · 185 biến thể alpha · `slate-900/950` dùng cả làm chữ (96) lẫn nền (48) ⇒ remap **theo property** | - | - |
| 11 | W1-A: T1 token light + T2 remap utility + T3 gate `check-light-theme` | PASS | gate exit 0 + self-test **5/5**; `build` 0 (verify rule trong **CSS build** — L-F11) | - | - |
| 12 | W1-A fail-after trên staging (deploy branch) | PASS | H1 `/admin/users` **1.0000:1 → 13.98:1** · `/dashboard` 1.0471:1 → 12.85:1 · chữ dưới AA **28/60 → 5/60** | Còn 4× breadcrumb chip (3.45:1) + 1× biên 4.45:1 | Backlog W1-C (C-1..C-2) |
| 13 | W1-B: M-10 (41 token → họ đảo được) + T-1 (bỏ 11 inline `outline:none`) + T-6 (5 key vào cả 2 locale) | PASS | `check-focus-ring` 8 → **2** · `check-i18n-hardcoded` **0** · `i18n:scan:strict` 0 | - | - |
| 14 | Gate "XAU DI" của `check-theme-contrast` bắt hồi quy của chính tôi | PASS | 3 cặp 3.75 → 2.36 ⇒ gate đo sai scope (không thấy `light-theme.css`) ⇒ thêm file vào scope + **đo lại baseline** (tập 32 **không đổi**) | - | - |
| 15 | Gate runtime W0 chuyển sang `--advisory` (app sống) | PASS | 3 lần đo liên tiếp: 113 → 141 → 173 vi phạm ⇒ delta không phản hồi hồi quy | Gate runtime KHÔNG còn là hàng rào chặn | T-2 (staging seed) |
| 16 | Push W1 + PR | PASS | pre-push **29 PASS / 0 FAIL**; **PR #273** (`feat/uistd-w1` → `feat/uistd-w0`, **xếp tầng**) | - | Merge #272 trước, rồi #273 |
| 17 | Ghi ledger + lessons + SUMMARY + handover | PASS | ledger **Entry 390** (W0) + **Entry 391** (W1) · lessons **L-V08** + **L-V09** (47/60) · `docs/SUMMARY_uistd-w0-{template,gates,tokens}.md` · `docs/SUMMARY_uistd-w1.md` · `docs/HANDOVER_UI_STANDARDIZATION_W0_20261021.md` + `..._W1_20261021.md` | - | - |
| 18 | **CHƯA CHẠY** | **CHƯA CHẠY** | `npm run test:visual` · BE test (Django) · **ảnh chụp thật light/dark** (L-V05: phải mở ảnh ra xem) · staging E2E ngoài 10 route ghim | Không có bằng chứng ⇒ không ghi "PASS" | Ticket W1-C |
| 19 | Bài học mới (7) ghi trong Entry 391 | PASS | probe "0 lỗi" do **CHƯA ĐĂNG NHẬP** (cần control "đã đo thật") · specificity 0,2,0 thua rule module ⇒ `:root[data-theme]` · class bị scope hash không override được từ file global · vá ở tầng token · gate đo sai scope · blob EOL "mixed" kẹt vĩnh viễn (normalize-eol chặn mọi lần sửa) ⇒ xoá rồi thêm lại · double-encoding UTF-8 qua PowerShell | - | - |

**Rủi ro lớn nhất phát hiện trong phiên này**: **gate có thể XANH GIẢ** (2 BLOCKER W0: route không đo được + `oklch()` làm cặp rơi khỏi tập) và **probe của tôi cũng xanh giả** (do CHƯA ĐĂNG NHẬP) ⇒ **mọi phép đo đều phải có CONTROL** (L-V01/L-V04). Gate của W0/W1 đã đóng 2 BLOCKER + 9 MAJOR + 17/17 probe.

## 2026-10-21 (tiếp) — Redesign 2 panel Operations Center + light theme (a) + **2 lỗi nghiêm trọng về chính gate**

| # | Task | Kết quả | Bằng chứng (lệnh) | Rủi ro | Next |
|---|---|---|---|---|---|
| 1 | Nạp skill UI/UX (`ui-skills-root` → `pbakaus/layout` · `pbakaus/distill` · `mengto/tailwindcss`) + khảo sát BE+FE 2 panel (sub-agent read-only) | PASS | Bản đồ: 15 hành động (Môi giới) + 29 hành động (VNBroker) · 21 nhãn dễ nhầm · 5 nhóm lỗi bố cục | - | - |
| 2 | R1: đổi 20 nhãn + 4 giá trị raw (phân biệt "nguồn dữ liệu" / "nhà môi giới") | PASS | **PR #274 (merged)** · tsc 0 · vitest 0 · i18n:scan:strict 0 | - | - |
| 3 | R2: tile → **bảng 9 cột** + KPI 4 + dải meta đầu trang (VNBroker) | PASS | **PR #275 (merged)** · 12/12 test contract **cũ** vẫn pass | - | - |
| 4 | R3: 3 card → **bảng 5 cột** + dải chính sách + rút badge lặp (Môi giới) | PASS | **PR #276 (merged)** · 15 hành động giữ nguyên | - | - |
| 5 | Light theme (a): 5 vòng **chụp ảnh → mở ảnh ra xem** | PASS | H1 `/admin/users` light **1.0000:1 → 19.2806:1**; chữ dưới AA **28/60 → 10/60**; dark **không hồi quy** (8/60) | 10/60 chữ vẫn dưới AA (chủ yếu `th` bảng admin) | C-1/C-2 |
| 6 | ⚠ **Phát hiện: `pre-push-gate.mjs` hỏng cú pháp ⇒ gate KHÔNG chạy** | PASS (đã sửa) | Thủ phạm `1fe43761c` (merge W1, ghép conflict **tay**) · `node --check` FAIL dòng 522 · sửa `b45b9c8ed` → gate **28 PASS** | Các push giữa đó **không được gate** | lesson L-G09 |
| 7 | ⚠ **Phát hiện: `.githooks/pre-push` kết thúc `exit 0` + bỏ qua gate khi ở `dev`** | PASS (đã sửa) | Sửa `688f73243`: gate fail ⇒ `exit $gate_status`; `dev` chỉ bỏ qua khi **không có gì để đẩy** ⇒ đã kiểm chứng push từ `dev` **có** chạy gate | Mọi squash-merge vào `dev` trước đó **không qua gate** | lesson L-G09 |
| 8 | Dọn dẹp: 5 worktree `agent-uistd-*` + branch local/remote + claim đóng | PASS | worktree còn: main + `agent-infra-p0` (agent khác) | - | - |

**Bài học lớn nhất phiên:** *"push thành công" **KHÔNG** chứng minh gate đã chạy* — 2 lỗi (file hỏng cú pháp + hook nuốt exit code) cùng làm cho nhiều push **không được gate thật**. Đã ghi **L-G09** + sửa cả hai.
