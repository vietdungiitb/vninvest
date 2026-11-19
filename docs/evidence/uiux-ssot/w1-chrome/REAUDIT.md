# B8 RE-AUDIT — `uiux-chrome-w1` (S2 / W1-chrome)

- **Ngày**: 2026-11-19 · **Branch**: `feat/uiux-chrome-w1` (worktree `D:/Mujoco Projects/uiux-chrome-w1`) · **Base**: `origin/dev`
- **Vai trò**: auditor độc lập (session khác người viết plan/code) — read-only. Không sửa code/plan, không claim, không commit/push/deploy. Chỉ ghi file này + `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 549.
- **Scope**: verify `docs/PLAN_UIUX_W1_CHROME_20261119.md` rev4 + handoff rev4 (`D2` glass thật, `D6` 4 route RED + 1 regression). **KHÔNG** mở lại W0 / O-01..O-28.
- **Verdict**: **NEED_REVISION** — 0 blocker, **1 major (O-29)**, 3 note không chặn. Chưa đủ điều kiện B9 theo yêu cầu "0 blocker / 0 major mới".

## 1. Kiểm chứng git (tự chạy)

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Worktree sạch | `git status --short` | output rỗng ✓ |
| 6 commit slice | `git log --oneline -6` | `cb43e3463, 1dcb5bff3, 2d5808e09, 6dc21dfba, 4412a00f2, dfc114a9d` ✓ |
| Diff trong scope claim | `git diff --name-only origin/dev..HEAD` | 17 file, đều nằm trong claim `docs/CLAIMS.md:1991` ✓ |
| Không nâng baseline | `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` | output rỗng ✓ |
| Claim đúng B8 | `docs/CLAIMS.md:1991` | vẫn `in-progress`, branch = tên agent ✓ |

## 2. Kiểm chứng code (file:line)

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Prop `actions` thật | `ShellPageTemplate.js:95` (`actions = null`), render tại `:127` trong `titleRow` ✓ | PASS |
| Kiểu TS | `ShellPageTemplate.d.ts:46` `actions?: ReactNode` ✓ | PASS |
| 4 route vào shell chrome | `AICommandCenterPage.tsx:210` · `DashboardPage.tsx:116` (`DashboardHeading`) · `PortfolioOverviewPage.tsx:118` · `AdminUsersPage.tsx:21` — đều `e(ShellPageChrome)` / `<ShellPageChrome>` ✓ | PASS |
| 4 route không tự render h1 | grep `h1\|ShellPageChrome\|ShellPageTemplate` trên 4 file: chỉ có import/dùng chrome; `<h1>` còn lại nằm trong comment `DashboardPage.tsx:111`, `AdminUsersPage.tsx:13-14` (detector test strip comment tại `uiux-chrome-w1.component.test.ts:13-15`) ✓ | PASS |
| Regression guard | `pages/admin/ShellOperationsCenterPage.tsx:4,91` dùng `ShellPageChrome`; **không** nằm trong `git diff --stat origin/dev..HEAD` → giữ nguyên ✓ | PASS |
| Glass thật | `theme/tokens.css:16` `--glass-surface: rgba(15,23,42,0.72)` (alpha 0.72 < 1), `:76` light `rgba(255,255,255,0.88)`, `:17` `--glass-blur: 12px` (kế thừa cả 2 mode) ✓ | PASS |
| Admin card glass | `adminUi.tsx:51,82` `background: var(--glass-surface)`; `:54,85` `backdropFilter: "blur(var(--glass-blur))"`; grep `bg-white` → **0 match** ✓ | PASS |
| 1 nguồn EmptyState | diff `ShellPageTemplate.js` cho thấy bản duplicate `export function ShellEmptyState` đã bị xoá; `:169-170` re-export từ `./ShellEmptyState`; grep toàn `src` chỉ còn 1 định nghĩa tại `ShellEmptyState.tsx:4` ✓ | PASS |
| Feedback kit | `feedback/EmptyState.tsx:2` re-export `ShellEmptyState as EmptyState` · `LoadingState.tsx:5-9` wrap `ShellSkeleton` (variant type khớp `ShellSkeleton.tsx:53`) · `ErrorState.tsx:5-14` wrap `EmptyState` ✓ | PASS |

## 3. Gate chạy thật — exit code

Mọi lệnh chạy với cwd `packages/web`; exit code lấy trực tiếp `$LASTEXITCODE`.

| # | Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|---|
| 1 | Component test | `node ./node_modules/vitest/vitest.mjs run src/components/__tests__/uiux-chrome-w1.component.test.ts` | **0** | 1 file / **8/8 test PASS** |
| 2 | check:tokens | `node ./scripts/check-tokens.mjs` | **0** | 79 allowlisted hex, 0 vi phạm |
| 3 | check:contrast | `node ./scripts/check-contrast.mjs` | **0** | 7 cặp × 2 mode ≥ 4.5:1 |
| 4 | check-theme-contrast | `node ./scripts/check-theme-contrast.mjs` | **0** | 6 cặp ⊆ baseline 32, **0 vi phạm mới**; 12 undecodable không kết luận; canvas runtime **CHƯA CHẠY** (build staging khác baseline) |
| 5 | check-token-conflict | `node ./scripts/check-token-conflict.mjs` | **0** | 0 hiện tại / baseline 0 |
| 6 | check-light-theme | `node ./scripts/check-light-theme.mjs` | **0** | 230 mẫu Tailwind / 642 file, mọi màu được phủ |
| 7 | check-dom-landmarks | `node ./scripts/check-dom-landmarks.mjs` | **0** | static PASS (runtime DOM 4 route là Playwright P4) |
| 8 | check-heading-contract | `node ./scripts/check-heading-contract.mjs` | **0** | 23 / 103 file, baseline 24, 0 vi phạm mới |
| 9 | check-focus-ring | `node ./scripts/check-focus-ring.mjs` | **0** | 2 / 642 file, baseline 8, 0 vi phạm mới |
| 10 | check-portfolio-contrast | `node ./scripts/check-portfolio-contrast.mjs` | **0** | 12 cặp × 2 theme ≥ 4.5:1 |

→ **10/10 exit 0**. Tuy nhiên exit 0 ở gate 4/8/9 mang nghĩa "tập vi phạm ⊆ baseline", **không** chứng minh detector đúng đặc tả — xem O-29.

## 4. Finding

### O-29 — MAJOR — Detector của `check-heading-contract.mjs` không được cập nhật theo plan (không "dùng chung hàm Task 1")

- **Plan**: `docs/PLAN_UIUX_W1_CHROME_20261119.md:16` (detector phải strip comment + nhận `renderElement("h1")` + `createElement("h1")` + `<h1`, có control âm), `:39` ("Produces `detectH1(src)` dùng chung cho test **và gate** `check-heading-contract.mjs` (cập nhật trong Task 2 của chính slice này, không chờ approve riêng)"), `:54` (control dương `Dashboard:120 renderElement("h1")`), `:68` (Task 2 Step 4 "Cập nhật detector vào `check-heading-contract.mjs` (dùng chung hàm Task 1)"), `:104` (DoD "detector nhận `renderElement`"); handoff `HANDOFF_2026-11-19_UIUX-SSOT.md:17` (O-06).
- **Thực tế**: `packages/web/scripts/check-heading-contract.mjs:81-85` — `buildsH1()` chỉ là `/<h1[\s/>]/` (không strip comment) + `/createElement\(\s*["']h1["']/` (**không** nhận `renderElement` / `e`). Line-map tại `:107` dùng cùng 2 regex. Self-test `:286-339` có control dương JSX/createElement nhưng **không** có control âm "comment có `<h1>` → PASS". Script này **không nằm** trong `git diff --name-only origin/dev..HEAD`. Detector đúng đặc tả chỉ tồn tại trong test `uiux-chrome-w1.component.test.ts:13-21`.
- **Tác động**:
  1. **False negative (chính rủi ro slice này nhắm tới)**: nếu `renderElement("h1", …)` — pattern gốc của `DashboardPage:120` theo plan `:16,:54` — bị tái đưa vào, gate **không bắt** (buildsH1 không khớp). Regression guard ở tầng enforcement bị hỏng dù component test vẫn xanh.
  2. **False positive**: `<h1>` trong comment vẫn bị đếm — gate in `AdminUsersPage.tsx#2 (dong 13, 14)` (`AdminUsersPage.tsx:13-14` là JSDoc). Commit `cb43e3463` ("bo literal h1 trong comment") chỉ sửa comment `DashboardPage.tsx:111` chứ **không** sửa detector ⇒ xử lý triệu chứng, không triệt để.
  3. Bị che vì gate baseline-locked (exit 0, 23 ⊆ 24) — đúng cạm bẫy "tin exit 0 khi chưa inject lỗi thật" của `MANDATORY-WORKFLOW.md`.
- **Đề xuất fix (nhỏ, không nâng baseline)**: đưa `detectH1`/`stripComments` từ `uiux-chrome-w1.component.test.ts:13-21` thành hàm dùng chung, cho `buildsH1()` (`:81-85`) và line-map (`:107`) gọi; thêm control âm "comment chứa `<h1>` → exit 0" + control dương `renderElement("h1")` vào self-test `selfTest()` (`:286-339`); chạy lại gate, giữ baseline 24 (không `--update-baseline`), rồi B8 lại. Không đụng nội dung 4 route (đã đúng).

## 5. Note (không chặn)

- **N1**: `--glass-blur` chỉ khai ở `:root` (`tokens.css:17`), không override riêng trong `:root[data-theme="light"]`; CSS custom property kế thừa ⇒ light vẫn nhận `12px`. Chấp nhận được, nhưng plan `:75` diễn giải "dark/light" có thể hiểu là khai ở cả 2 block — cần owner xác nhận nếu muốn nghiêm.
- **N2**: `adminUi.tsx:24` (`AdminPageHeader`) vẫn có `<h1>` thật, nhưng nằm trong allowlist của gate (`check-heading-contract.mjs:318`) và `AdminUsersPage.tsx:21` dùng `ShellPageChrome` nên không có double-h1. Không phải lỗi.
- **N3**: Check-theme-contrast in "26 vi phạm trong baseline đã hết / có thể hạ baseline" — đây là tín hiệu baseline cũ, **không** được dùng để nâng/sửa baseline trong slice này (R2).

## 6. CHƯA CHẠY

Deploy VPS staging (`14.225.255.47`) · ảnh 4 route × 2 theme · `test:visual` / E2E Playwright · vitest full suite · `tsc --noEmit` / `npm run build` · `lint` · runtime canvas contrast (build staging đang khác baseline). Theo handoff `:53`, test/build/E2E local bị cấm — chỉ chạy trên VPS staging.

## 7. Next steps / Owner

1. Agent S2 fix O-29 (đồng bộ detector gate + control) — **không** nâng baseline, không đụng 4 route.
2. Chạy lại 10 gate + self-test; B8 re-audit vòng 2 (chỉ O-29).
3. Sau 0 blocker / 0 major: coordinator cho B9 — đóng claim, PR, merge; riêng N1/N2/N3 chuyển note cho owner.
