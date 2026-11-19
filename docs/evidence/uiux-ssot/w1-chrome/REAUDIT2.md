# B8 RE-AUDIT v2 — `uiux-chrome-w1` (O-29 đóng)

- **Ngày**: 2026-11-19 · **Branch**: `feat/uiux-chrome-w1` (worktree `D:/Mujoco Projects/uiux-chrome-w1`) · **Base**: `origin/dev`
- **Vai trò**: auditor độc lập (session khác người viết plan/code) — read-only. Không sửa code/plan, không claim, không commit/push/deploy. Chỉ ghi file này + `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 551.
- **Scope**: chỉ kiểm việc đóng **O-29** từ B8 v1 (`REAUDIT.md`, Entry 549) và Entry 550. **KHÔNG** mở lại các mục đã PASS ở v1 (D2 glass, 4 route, regression guard, feedback kit, N1/N2/N3).
- **Verdict**: **PASS** — **0 blocker / 0 major**. O-29 đã đóng đúng đặc tả; đủ điều kiện B9.

## 1. Kiểm chứng git (tự chạy)

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Trạng thái worktree | `git status --short` | `?? docs/evidence/uiux-ssot/w1-chrome/REAUDIT.md` — file untracked của v1, **không tính lỗi** ✓ |
| Branch | `git rev-parse --abbrev-ref HEAD` | `feat/uiux-chrome-w1` ✓ |
| 5 commit gần nhất | `git log --oneline -5` | `c868fe705` (fix O-29), `cb43e3463`, `1dcb5bff3`, `2d5808e09`, `6dc21dfba` ✓ |
| Diff trong scope claim | `git diff --name-only origin/dev..HEAD` | 21 file, đều nằm trong `docs/CLAIMS.md:1991` (đã mở rộng thêm `check-heading-contract.mjs` + `check-ui-baseline/check-heading-contract.json`) ✓ |
| Chỉ đụng 1 baseline | `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` | chỉ `check-heading-contract.json` ✓ |

## 2. O-29 — code detector (file:line)

| Yêu cầu v1 | Bằng chứng | Kết quả |
|---|---|---|
| `H1_RE` nhận cả 4 dạng | `packages/web/scripts/check-heading-contract.mjs:86` — `/<h1[\s/>]\|(?:createElement\|renderElement\|\be)\(\s*["']h1["']/` (JSX + `createElement` + `renderElement` + alias `e`) | ✓ PASS |
| Strip comment, giữ số dòng | `:88-92` `stripCommentsKeepLines()` thay nội dung comment bằng space, không xoá newline | ✓ PASS |
| Dùng chung cho detect + đếm dòng | `buildsH1()` `:94-96` test trên chuỗi đã strip; `collect()` `:114` strip rồi `:115` detect bằng `H1_RE`, `:118-119` đếm dòng bằng **cùng** `H1_RE` → không còn ID `#0` giả do lệch hàm | ✓ PASS |
| Control âm/control dương | self-test `:270-380`, 7 probe tại `:304-372`: dương JSX / `createElement('h1')` / `renderElement('h1')` + `e("h1")`; âm comment `<h1>` / allowlist `adminUi.tsx` / file test | ✓ PASS |
| File nằm trong diff + claim | `git diff --numstat origin/dev..HEAD -- packages/web/scripts/check-heading-contract.mjs` = `41 8`; `docs/CLAIMS.md:1991` có tên file | ✓ PASS |

**Kiểm chứng âm trên code thật**: các `<h1>` comment cũ tại `AdminUsersPage.tsx:13-14` không còn xuất hiện trong danh sách vi phạm gate; `DashboardPage.tsx#2` biến mất. False-positive/false-negative của v1 đã triệt để ở tầng detector (không còn dùng cách sửa comment triệu chứng của commit `cb43e3463`).

## 3. Gate chạy thật — exit code

Mọi lệnh chạy với cwd `packages/web`; exit code lấy trực tiếp `$LASTEXITCODE`.

| # | Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|---|
| 1 | heading self-test | `node ./scripts/check-heading-contract.mjs --self-test` | **0** | **7/7 PASS** (7 case theo đặc tả) |
| 2 | check-heading-contract | `node ./scripts/check-heading-contract.mjs` | **0** | 23 / 103 file · baseline 23 · **0 vi phạm mới** |
| 3 | check-dom-landmarks | `node ./scripts/check-dom-landmarks.mjs` | **0** | static PASS (runtime DOM 4 route là Playwright P4) |
| 4 | check-focus-ring | `node ./scripts/check-focus-ring.mjs` | **0** | 2 / 642 file · baseline 8 · 0 mới |
| 5 | check-portfolio-contrast | `node ./scripts/check-portfolio-contrast.mjs` | **0** | 12 cặp × 2 theme ≥ 4.5:1 |
| 6 | check:tokens | `node ./scripts/check-tokens.mjs` | **0** | 79 allowlisted hex · 0 vi phạm |
| 7 | check:contrast | `node ./scripts/check-contrast.mjs` | **0** | 7 tone × 2 mode ≥ 4.5:1 |
| 8 | check-light-theme | `node ./scripts/check-light-theme.mjs` | **0** | 230 mẫu Tailwind / 642 file |
| 9 | check-theme-contrast | `node ./scripts/check-theme-contrast.mjs` | **0** | 6 cặp ⊆ baseline 32 · 0 mới · 12 undecodable không kết luận |
| 10 | check-token-conflict | `node ./scripts/check-token-conflict.mjs` | **0** | 0 hiện tại / baseline 0 |
| 11 | Component test | `node ./node_modules/vitest/vitest.mjs run src/components/__tests__/uiux-chrome-w1.component.test.ts` (cwd `packages/web`) | **0** | 1 file · **8/8 test PASS** |

→ **11/11 exit 0**. Lưu ý: gate 2/4/9 là baseline-locked — exit 0 nghĩa là "tập vi phạm ⊆ baseline", nhưng ở đây detector đã được chứng minh đúng bằng self-test 7/7 có control thật (lần v1 bị che chính vì thiếu control), nên exit 0 đáng tin.

## 4. Baseline migrate

| Kiểm tra | Bằng chứng | Kết quả |
|---|---|---|
| 5 ID nợ cũ có mặt | `check-heading-contract.json:10` `AIUsageAnalyticsPage.tsx#1` · `:13` `SupportPage.tsx#1` · `:14` `TransactionsPage.tsx#1` · `:15` `UpgradePage.tsx#1` · `:16` `UserSettingsPage.tsx#1` | ✓ PASS |
| Hết `DashboardPage.tsx#2` | không còn trong `violations` (so với `git show origin/dev:...` có entry này) | ✓ PASS |
| Giải trình Owner | `baseline-heading-migration.md:3` (Owner chốt), `:4` ("không phải nâng baseline xanh giả"), `:21`, `:34` (slice riêng `W1-HEADING-FOLLOWUP`) | ✓ PASS |
| Chỉ 1 baseline file đổi | `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` = 1 file | ✓ PASS |

**Kiểm chứng bổ sung**: 5 ID admin bị xoá khỏi baseline (`AdminAnalyticsPage#1`, `AdminAuditPage#1`, `AdminBillingFleetPage#1`, `AdminUsageFleetPage#1`, `AdminUsersPage#2`) đều là false-positive comment của detector cũ — grep xác nhận `<h1>` chỉ nằm ở comment (`AdminAnalyticsPage.tsx:51`, `AdminAuditPage.tsx:93`, `AdminBillingFleetPage.tsx:99`, `AdminUsageFleetPage.tsx:43`, `AdminUsersPage.tsx:13-14`). Việc xoá là hệ quả đúng của detector mới, không che regression. Entry `WatchlistMainWorkspace.tsx#0` (`check-heading-contract.json:29`, detail trống) **có sẵn trên `origin/dev`** (`git show origin/dev:...`), không do slice này tạo — out of scope.

## 5. Note (không chặn)

- **N4**: vitest phải chạy từ `packages/web`, không phải worktree root — test dùng `readFileSync("src/pages/...")` tương đối (`uiux-chrome-w1.component.test.ts:30`) và root không có `node_modules/vitest` (`MODULE_NOT_FOUND`). Chạy đúng cwd → 8/8. Không ảnh hưởng verdict.
- **N5**: `check-theme-contrast` runtime canvas **CHƯA CHẠY** (staging chạy build khác baseline) — đã ghi ở v1, không mở lại.
- **N1/N2/N3** (kế thừa v1, không chặn): glass-blur kế thừa CSS · `adminUi.tsx` `<h1>` nằm allowlist · baseline theme-contrast cũ không được động trong slice này.

## 6. CHƯA CHẠY

Deploy VPS staging (`14.225.255.47`) · ảnh 4 route × 2 theme · `test:visual` / E2E Playwright · vitest full suite · `tsc --noEmit` / `npm run build` · `lint` · runtime canvas contrast. Theo handoff `:53`, test/build/E2E local bị cấm — chỉ chạy trên VPS staging. Không vì thế mà suy ra "chắc là được".

## 7. Next steps / Owner

1. **O-29 ĐÓNG** → 0 blocker / 0 major → coordinator cho phép **B9**.
2. B9: đóng claim `docs/CLAIMS.md:1991` → `done`, PR, **merge-commit** (không squash), cleanup worktree.
3. Chuyển N1–N5 cho owner; mở slice riêng `W1-HEADING-FOLLOWUP` cho 5 page nợ (KHÔNG nằm trong PR này).
