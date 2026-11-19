# UI/UX W1-A11y — Accessible name, focus trap, URL state, budget xanh (rev2)

> Thực thi theo skill repo `workflow-dev-loop` + `writing-plans`; từng step checkbox `- [ ]`. Không dùng `superpowers:*` (O-20).

**Goal:** `check-uiux-budget` PASS (`CSS-2 55→≤46`, `A11Y-9 16→≤5`); focus-ring baseline 8→0; 5+ modal có **hành vi** trap/Escape/focus-return; 29 điểm lọc/phân trang deep-link.

**Architecture:** Dùng wrapper Radix có sẵn `components/ui/dialog.tsx:5-48` + `drawer.tsx:5-45` — trap nằm trong `DialogPrimitive.Content`, **không** do hook trả props (O-10). Accessible name sửa theo nhóm (`components/ui`, `advertising`, alert-center). URL state dùng `packages/web/src/hooks/useUrlState.ts` có sẵn. Motion giảm bằng script giữ `<time> <easing>` (L-F05).

**Tech Stack:** React 19, Radix wrappers, Vitest behavioral test (`userEvent.tab()`), Playwright staging, `check-uiux-budget.mjs`.

**Spec:** `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (O-09..O-14) · handoff rev2. **Base** `dev@2b10b3016`.

## Global Constraints

- Modal inventory dùng **full path + symbol**, không line number (O-09):
  - `src/pages/tenant-admin/TenantAdminReportsPage.tsx` — `showCreateModal` block (bắt đầu ~`:256`); `:243-245` là nút Xoá, KHÔNG phải modal.
  - `src/components/alert-center/MuteModal.tsx`
  - `src/components/dashboard/OptimizationModal.jsx`
  - `src/features/advertising/components/CampaignDetailDrawer.jsx`
  - `src/components/TenantAdminCommandPalette.tsx` — đã có `aria-modal` + Escape `:36-42` → **regression test**, không đòi RED.
  - Bổ sung: `src/components/shared/ConfirmModal.tsx` (dùng qua `useConfirm`), `src/components/soc/SocScreenerRuleModal.tsx`.
- Test **hành vi** Tab/Shift+Tab/Escape/focus-return, KHÔNG scan `aria-modal` (O-11). Expected: 2 GREEN regression + phần còn RED.
- Focus baseline 8 file phải được bao phủ hết: `TenantAdminCommandPalette`, `PortfolioHeatmap.js`, `ScreenerFilterBuilder`, `ScreenerSchedulePanel`, `SocScreenerConfigForm`, `SocScreenerRuleModal`, `Sidebar.tsx`, `ScreenerPage.tsx` (O-12).
- `check-a11y-runtime` baseline **113**, 10 route build 2026-10-21, **không đo modal**, exit 0 ngay cả `CHUA_CHAY` (O-13) → modal dùng component test.
- `scan-ui-guidelines.mjs` **không có timeout nội tại**; lần chạy thật ~6.2 phút (O-22) — ghi thời gian thật, không nói "tăng timeout".
- Không sửa `vi.js`/`en.js`; module riêng `locales/{vi,en}/uiuxA11y.js`.
- Không đụng file của S2/S4 theo ownership.

**Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-007, L-008, L-M02, L-A01, L-F05, L-F06, L-G02, L-V02, L-V03, L-V04, L-V05, L-T01]
**Checklist đã tick:** [x] đọc tay 3 candidate false-positive focus · [x] đo baseline 8 file · [x] pin full path modal · [x] replicate regex/control · [x] không nâng baseline.

## Baseline thật

| Gate | Trước | Mục tiêu |
|---|---|---|
| `check-uiux-budget` | exit 1 — tổng 129, CSS-2 55, A11Y-9 16 | PASS — ≤46 / ≤5 |
| `check-focus-ring` | **8** | **0** |
| `check-heading-contract` | 24 | không mới |
| `check-a11y-runtime` | **113**, build cũ | 0 mới; modal component test |

---

### Task 1: Inventory + test đỏ có control

**Files:** Create `docs/evidence/uiux-ssot/w1-a11y/hits-baseline.md`, `packages/web/src/components/__tests__/uiux-a11y-w1.component.test.ts`

- [ ] **Step 1:** Chạy `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` (cho chạy hết ~6.2 phút, không đặt "timeout 600s" sai cơ chế). Ghi output A11Y-9/CSS-2 + timestamp.
- [ ] **Step 2:** Viết test: (a) accessible name cho control đã pin; (b) modal **behavior** với `userEvent.tab()`: assert focus không thoát dialog, Escape đóng, focus về trigger. Positive control: `TenantAdminCommandPalette` + `MuteModal` (đã có aria-modal) phải **PASS ngay** (regression). Negative control: modal chỉ có `aria-modal` nhưng không trap → phải FAIL.
- [ ] **Step 3:** Chạy → expected **2 PASS + phần còn FAIL**. Ghi `red.md`. Nếu 5/5 FAIL hoặc 5/5 PASS → dừng, sửa test.
- [ ] **Step 4: Commit test đỏ.**

---

### Task 2: Accessible name theo nhóm

**Files:** Modify `components/ui/command.tsx`, `components/shared/PaginationBar.jsx`, `components/alert-center/{FilterBar.tsx,StatsPanel.tsx}`, ≤15 file `features/advertising/components/`; Create `locales/{vi,en}/uiuxA11y.js`.

- [ ] **Step 1:** Đọc tay từng candidate (≥3 — L-F06); loại wrapper đã có `label` (`ui/input.tsx:6`).
- [ ] **Step 2:** `aria-label={t(...)}` / `<label htmlFor>`; VI đủ dấu, cả 2 locale.
- [ ] **Step 3:** `check-uiux-budget` → A11Y-9 ≤5; vitest xanh.
- [ ] **Step 4: Commit.**

---

### Task 3: Modal wrappers + focus baseline 8 file

**Files:** Modify 7 modal path trong inventory; Modify 8 file focus baseline; Create `locales/{vi,en}/uiuxA11y.js` (key mới nếu cần).

**Interfaces:** Consumes `components/ui/dialog.tsx` / `drawer.tsx`. Produces: 0 focus-ring baseline.

- [ ] **Step 1:** Thay modal tự dựng bằng `<Dialog>/<DialogContent>` hoặc `<DrawerContent>`; **không** tạo hook `contentProps`. Giữ business logic.
- [ ] **Step 2:** Sửa 8 file focus-ring (kể cả 6 file plan v1 bỏ sót): bỏ `outline-none` trần, thêm ring thay thế; kiểm false-positive tại file level.
- [ ] **Step 3:** Test behavior Task 1 → xanh; `check-focus-ring` → **0**; `check-a11y-runtime` → 0 vi phạm mới (ghi rõ baseline 113, không báo "PASS sạch").
- [ ] **Step 4: Commit** — `fix(uiux-a11y-w1): Radix modal behavior + 8 focus baselines`.

---

### Task 4: URL state + motion

**Files:** Modify 12 file theo audit §10.1 (đối chiếu code thật) qua `hooks/useUrlState.ts`; Modify CSS motion theo `hits-baseline.md`.

**Interfaces:** Produces: filter/sort/page trên URL; form input loại C (`AdvisoryOrderTicket`, `DNSEConnectionPanel.orderQuantity`) **không đổi**.

- [ ] **Step 1:** Test đỏ: mỗi file có `useUrlState(` và không còn `useState` cho cùng biến.
- [ ] **Step 2:** Thay state → URL; giữ default; back/forward hoạt động.
- [ ] **Step 3:** Giảm CSS-2 9 rule bằng script giữ duration/easing; đếm transition thiếu thời gian = 0 (L-F05).
- [ ] **Step 4:** `check-uiux-budget` → **PASS**; `tsc`; `test:components`.
- [ ] **Step 5: Commit.**

---

### Task 5: B7/B8/B9

`agent-sync.ps1` → chạy lại mọi gate sau rebase (L-003). Auditor ghi `REAUDIT.md` → 0 blocker/0 major. Claim done → Entry ledger → PR → cleanup.

## Rollback

Revert từng commit Task 2–4. Nếu budget vẫn đỏ → giữ đỏ báo blocker, **không** nâng baseline. Nếu a11y-runtime trả `CHUA_CHAY` → ghi `CHƯA CHẠY`, không báo PASS.
