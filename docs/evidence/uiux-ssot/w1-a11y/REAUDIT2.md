# B8 re-audit độc lập vòng 2 — uiux-a11y-w1

- **Ngày**: 2026-11-19 · **Branch**: `feat/uiux-a11y-w1` · **Worktree**: `D:/Mujoco Projects/uiux-a11y-w1` · **HEAD**: `f5d20b15e`.
- **Vai trò**: auditor độc lập vòng 2, read-only với code/plan — không claim, không commit/push/deploy. Chỉ ghi file này + prepend `## Entry 554` vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
- **Scope**: CHỈ O-30 + N1/N2/N3 từ `REAUDIT.md` (Entry 552) và Entry 553. **Không mở lại O-01..O-29.**
- **Verdict**: **PASS** — **0 blocker / 0 major**, 3 note (N1/N2/N3) đã đóng. Cho phép B9.

## 1. Tóm tắt

1. **O-30 ĐÃ ĐÓNG** — `packages/web/src/pages/tenant-admin/TenantAdminReportsPage.tsx:263-266` có `ref={createModalRef}` + `role="dialog"` + `aria-modal="true"` + `aria-label`; `:81` `closeCreateModal = useCallback(...)`; `:261` backdrop dùng callback; `:82` truyền ref vào hook. Root cause v1 (`ref.current` luôn `null`) được phản chứng bằng code thật: `useModalA11y.ts:22` giờ lấy node hợp lệ ⇒ nhánh Tab `:30-41` và focus đầu `:44-48` chạy; `useCallback` ổn định dependency `onClose` tại `:53`.
2. **N1 ĐÓNG** — `docs/evidence/uiux-ssot/w1-a11y/a11y9-control.mjs` tồn tại (22 dòng), tự chạy được: 4 CONTROL đúng `false/true/false/false` đúng `expect`, exit 0.
3. **N2 ĐÓNG (vượt mục tiêu)** — `node scripts/check-focus-ring.mjs` → **0 vi phạm / 643 file**, exit 0. Không còn 2 vi phạm baseline (`PortfolioHeatmap.js`, `Sidebar.tsx`); script báo "8 vi phạm trong baseline đã hết". Plan `8→0` đạt.
4. **N3 ĐÓNG** — `docs/CLAIMS.md:1992` đã liệt kê `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` trong cột `files` và vẫn `in-progress`. Khớp diff.
5. **Baseline không bị đụng** — `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` rỗng; scanner rule đổi có control (§4).

## 2. Git / scope (đo thật)

| Kiểm tra | Kết quả |
|---|---|
| `git status --short` (trước khi ghi) | sạch, ngoài `?? docs/evidence/uiux-ssot/w1-a11y/REAUDIT.md` (sản phẩm B8 v1) |
| `git log --oneline -5` | `f5d20b15e, 55b89e701, 17bcee308, c39e05289, b82b04008` |
| `git rev-parse --abbrev-ref HEAD` | `feat/uiux-a11y-w1` — khớp tên agent `uiux-a11y-w1` |
| `git diff --name-only origin/dev..HEAD` | 14 file: `CLAIMS.md`, ledger, `scan-ui-guidelines.mjs`, `a11y9-control.mjs`, `budget-pass.md`, `guard-fixes.md`, 4 file modal, `useModalA11y.ts` + test, `PortfolioHeatmap.js`, `Sidebar.tsx` — đều trong scope |
| Claim `docs/CLAIMS.md:1992` | `in-progress`, files có `scan-ui-guidelines.mjs` (N3 đóng) |
| Ledger trước khi ghi | U+FFFD=0 · CJK=0 · endsWith LF=true (đo bằng `node`) |

## 3. Gate chạy thật — exit code thật (session này)

| # | Gate | Lệnh (cwd) | Exit | Output |
|---|---|---|---|---|
| 1 | modal test | `node node_modules/vitest/vitest.mjs run src/hooks/__tests__/useModalA11y.component.test.tsx` (`packages/web`) | **0** | 1 file / **3 tests passed** (8.51s, vitest 4.1.9) |
| 2 | A11Y-9 control | `node docs/evidence/uiux-ssot/w1-a11y/a11y9-control.mjs` (root worktree) | **0** | 4 CONTROL: `false/true/false/false` khớp `expect` |
| 3 | focus-ring | `node scripts/check-focus-ring.mjs` (`packages/web`) | **0** | **0 vi phạm** / 643 file; baseline 8, "8 vi phạm trong baseline đã hết"; 0 mới |
| 4 | baseline diff | `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` | **0** | rỗng |

Test hành vi có assert giá trị thật (L-V04): `useModalA11y.component.test.tsx:25` (`onClose` called 1), `:34-36` (`activeElement` = first/last), `:41` (focus đầu nằm trong modal) — không phải assert rỗng.

## 4. Scanner rule đổi có control

- A11Y-9: `docs/audit-uiux/scripts/scan-ui-guidelines.mjs:163-180` — cửa sổ `prev6+next6` (`:172`), chấp nhận `aria-label`/`aria-labelledby`, `<label>`, `htmlFor=` (`:173,177,179`). Control `a11y9-control.mjs:14-22` chạy 4/4 (§3 gate 2).
- CSS-2: `scan-ui-guidelines.mjs:29-37` đọc `GLOBAL_REDUCED_MOTION` từ `path.join(ROOT,"index.css")`, dùng tại `:217`; `packages/web/src/index.css:812` có `@media (prefers-reduced-motion: reduce)` — có thật.
- `guard-fixes.md:1,9,26` ghi rõ cả 2 rule là **sửa false-positive có control âm/dương**, không phải nâng baseline để xanh giả.

## 5. CHƯA CHẠY

- **Budget re-run (v2)**: `node packages/web/scripts/check-uiux-budget.mjs` — **CHƯA CHẠY**, timeout 2 lần (5 phút + 6 phút) trong session này. Chấp nhận evidence có sẵn: `budget-pass.md:1-10` (exit 0, `A11Y-9 5→2`, `CSS-2 46→0`, tổng giảm 102), Entry 553:7, và B8 v1 `REAUDIT.md` §5 gate 11 (exit 0). Không tự `--write-baseline`.
- 8 gate còn lại của B8 v1 (`REAUDIT.md` §5: token-conflict, theme-contrast, tokens, contrast, light-theme, dom-landmarks, heading-contract, portfolio-contrast) — **CHƯA CHẠY lại** trong vòng 2 (ngoài scope O-30/N1/N2/N3); đã có evidence v1 exit 0.
- Staging VPS `14.225.255.47` / `docker.edusuccess.vn`: deploy + verify — **CHƯA CHẠY**.
- Ảnh before/after, 4 route × 2 theme, `test:visual` / E2E Playwright — **CHƯA CHẠY**.
- `vitest run` full / `test:components` full, `npx tsc --noEmit`, `npm run build`, `npm run lint`, `i18n:scan` — **CHƯA CHẠY** (chỉ chạy 1 file modal test).

## 6. Next steps / owner

1. B9: đóng claim `docs/CLAIMS.md:1992` (`in-progress` → `released`) + Entry ledger + PR — **không còn blocker/major**.
2. Coordinator: xác nhận budget gate chạy lại được trên môi trường không timeout (v2 ghi CHƯA CHẠY); giữ baseline `check-ui-baseline/` rỗng.
3. Sau B9: chạy staging VPS + full suite/visual nếu yêu cầu nghiệm thu ở môi trường thật (hiện CHƯA CHẠY).
