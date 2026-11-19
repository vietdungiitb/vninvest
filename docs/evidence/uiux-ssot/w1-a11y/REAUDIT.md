# B8 re-audit độc lập — uiux-a11y-w1

- **Ngày**: 2026-11-19 · **Branch**: `feat/uiux-a11y-w1` · **Worktree**: `D:/Mujoco Projects/uiux-a11y-w1`.
- **Vai trò**: auditor độc lập (session khác người viết code/plan) — read-only với code/plan; không claim, không commit/push/deploy. Chỉ ghi file này + prepend `## Entry 552` vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
- **Scope**: verify `docs/PLAN_UIUX_W1_A11Y_URL_20261119.md` rev2. Không mở lại O-01..O-29 đã đóng ở slice trước.
- **Verdict**: **NEED_REVISION** — **0 blocker, 1 major (O-30)**, 3 note không chặn. Chưa đủ điều kiện B9.

## 1. Tóm tắt 5 điểm quan trọng nhất

1. **O-30 (MAJOR)**: `packages/web/src/pages/tenant-admin/TenantAdminReportsPage.tsx:80-81,259-261` — hook được gọi nhưng `createModalRef` **không bao giờ được gắn vào node modal**; grep toàn file chỉ 2 lần xuất hiện (`:80` khai báo, `:81` truyền vào hook). Node content thực tế `:261` `<div className={`${styles.modalContent}`} onClick={...}>` không có `ref=`, không có `role="dialog"` / `aria-modal`. Hệ quả: `ref.current` luôn `null` ⇒ **Tab/Shift+Tab trap + focus ban đầu không hoạt động** trong modal này; chỉ Escape + focus-return chạy (document-level). Brief B8 yêu cầu mỗi trong 4 file phải có `useModalA11y(` **và** `ref=` trên content node → file này fail.
2. **3 file còn lại đúng**: `MuteModal.tsx:27,35` · `OptimizationModal.jsx:13,30` · `CampaignDetailDrawer.jsx:29,39` — mỗi file có hook + `ref={contentRef}` trên node `role="dialog"`/content. Test `useModalA11y.component.test.tsx` **3/3 PASS** (Escape, Tab vòng, focus ban đầu).
3. **Gate 11/11 exit 0** (5 root + 4 packages/web + modal test + budget). Budget `A11Y-9 5→2`, `CSS-2 46→0`, tổng `162→60 (-102)`; baseline `check-ui-baseline/` diff **rỗng** — không nâng baseline.
4. **Scanner rule đúng đặc tả**: A11Y-9 `scan-ui-guidelines.mjs:172-179` quét cửa sổ `prev6+next6`, chấp nhận `aria-label`/`aria-labelledby`, `<label>`, `htmlFor=`; CSS-2 `:29-37` đọc `GLOBAL_REDUCED_MOTION` từ `path.join(ROOT,"index.css")`, rule `:217` dùng cờ đó; `src/index.css:812` có `@media (prefers-reduced-motion: reduce)` — có thật.
5. **12 file URL state có thật** (grep): `CoreDashboardPositionDeck.tsx:83`, `FactsFirstModularPositionDeck.jsx:38`, `AdminCoreTenantsPage.tsx:33`, `AdminCoreJobsPage.tsx:70`, `AdminCorePATsPage.tsx:75`, `AdminCoreServiceAccountsPage.tsx:50`, `AdminCoreAuditTracePage.tsx:90`, `AdminBillingFleetPage.tsx:34`, `AdminAuditPage.tsx:44`, `TenantAdminMembersPage.tsx:87`, `PortfolioHoldingsPage.tsx:109`, `CampaignTable.jsx:10,65`. Ba page `AdminCore{Overview,Billing,Usage}` không có URL state nhưng là trang tĩnh, không có filter/phân trang — không thuộc nhóm "12 file nặng".

## 2. Git / scope

| Kiểm tra | Kết quả |
|---|---|
| `git status --short` | sạch (trước khi auditor ghi 2 file) |
| `git log --oneline -6` | `55b89e701, 17bcee308, c39e05289, b82b04008, c779a5bd8, d55f1d90a` — 5 commit slice + merge base |
| `git diff --name-only origin/dev..HEAD` | 10 file: `CLAIMS.md`, `scan-ui-guidelines.mjs`, `budget-pass.md`, `guard-fixes.md`, 4 file modal, `useModalA11y.ts`, test |
| Claim `docs/CLAIMS.md:1992` | `in-progress` — đúng B8; branch = `feat/uiux-a11y-w1` khớp tên agent `uiux-a11y-w1` |
| `git diff origin/dev..HEAD -- packages/web/scripts/check-ui-baseline/` | **rỗng** — không nâng baseline |
| Baseline file encode | `CODE_CHANGE_AUDIT_LEDGER.md`: U+FFFD=0, CJK=0 (đo bằng node trước khi ghi) |

**N3 (note)**: `docs/claim` tại `CLAIMS.md:1992` không liệt kê `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` dù file này nằm trong diff (rule-change có thật, nằm trong `PLAN:54-56,80,86` + `guard-fixes.md`). Ngược lại claim có liệt kê `docs/CODE_CHANGE_AUDIT_LEDGER.md (append Entry)` nhưng slice chưa append — Entry 552 do auditor prepend theo chỉ thị B8. Không chặn (không file deny-list), nhưng coordinator nên cập nhật claim cho khớp diff.

## 3. Code verify

| Hạng mục | Bằng chứng | Kết quả |
|---|---|---|
| Hook Escape | `hooks/useModalA11y.ts:24-28` | OK |
| Tab/Shift+Tab trap | `useModalA11y.ts:30-41` (first/last vòng), `:43` capture listener | OK |
| Focus return | `useModalA11y.ts:21` lưu `previous`, `:49-52` cleanup focus lại | OK |
| Test hành vi | `hooks/__tests__/useModalA11y.component.test.tsx:20-42` 3 case | **3/3 PASS** |
| Áp dụng 4 file | `MuteModal.tsx:27,35` · `OptimizationModal.jsx:13,30` · `CampaignDetailDrawer.jsx:29,39` · `TenantAdminReportsPage.tsx:81` (ref **thiếu** tại `:261`) | **3/4 đúng, 1 major** |
| Scanner A11Y-9 | `scan-ui-guidelines.mjs:172-179` | OK |
| Scanner CSS-2 | `scan-ui-guidelines.mjs:29-37,217` + `src/index.css:812` | OK |
| 12 file URL state | xem §1.5 | OK |
| Không nâng baseline | diff rỗng | OK |

**N1 (note)**: `guard-fixes.md:9` nhắc control `a11y9-control.mjs` (4/4) nhưng `glob **/a11y9-control.mjs` trả **0 file** — control chỉ là mô tả bằng văn bản, không thể tự chạy lại để kiểm chứng 4/4. Đề xuất commit kèm script control hoặc ghi rõ "control inline, không có file".

**N2 (note)**: `PLAN:5,37,73` đặt mục tiêu focus-ring `8→0`; thực tế gate còn **2** vi phạm thuộc baseline: `PortfolioHeatmap.js:674` và `Sidebar.tsx:93` (đều `focus:outline-none` không ring thay thế). Gate vẫn exit 0 vì tập hiện tại ⊆ baseline 8 — không phải regression, nhưng mục tiêu plan chưa đạt. Không chặn B9 theo tiêu chí "0 blocker/0 major", nhưng nên mở follow-up.

## 4. O-30 (MAJOR) — chi tiết

- **Vị trí**: `packages/web/src/pages/tenant-admin/TenantAdminReportsPage.tsx:79-81` + `:259-261`.
- **Code**:
  - `:80` `const createModalRef = useRef<HTMLDivElement>(null);`
  - `:81` `useModalA11y(showCreateModal, () => setShowCreateModal(false), createModalRef);`
  - `:261` `<div className={`${styles.modalContent}`} onClick={e => e.stopPropagation()}>` — **không có `ref={createModalRef}`**, không `role="dialog"`, không `aria-modal`.
- **Root cause**: ref được tạo và truyền vào hook nhưng không bao giờ mount vào DOM ⇒ `node = ref.current` (`useModalA11y.ts:22`) luôn `null` ⇒ nhánh Tab tại `:30` (`if ... || !node) return`) và đo focus đầu `:44-48` bị bỏ qua. Escape (`:24-28`, listener document) và focus-return (`:51`) vẫn chạy.
- **Tác động**: create-modal của Tenant Admin Reports không có focus trap — sai AC `PLAN:22,48,71` ("5+ modal có hành vi trap/Escape/focus-return"). Ngoài ra `onClose` là arrow inline tạo mới mỗi render ⇒ dependency `onClose` của effect (`useModalA11y.ts:53`) đổi mỗi lần gõ form ⇒ cleanup/re-init focus lặp.
- **Đề xuất fix**: thêm `ref={createModalRef}` + `role="dialog"` + `aria-modal="true"` vào node `:261`; đưa `onClose` thành `useCallback` hoặc hàm đặt tên ổn định; thêm component test riêng cho modal này (Tab không thoát, Escape đóng, focus về trigger) rồi chạy lại B8.

## 5. Gate chạy thật (exit code thật)

Tất cả lệnh dưới tự chạy trong worktree này, không tin báo cáo của agent viết code.

| # | Gate | Lệnh (cwd) | Exit | Output tóm tắt |
|---|---|---|---|---|
| 1 | modal test | `node node_modules/vitest/vitest.mjs run src/hooks/__tests__/useModalA11y.component.test.tsx` (`packages/web`) | **0** | 1 file / **3 tests passed** (4.43s) |
| 2 | token-conflict | `node packages/web/scripts/check-token-conflict.mjs` (root) | **0** | 0 vi phạm / baseline 0 |
| 3 | theme-contrast | `node packages/web/scripts/check-theme-contrast.mjs` (root) | **0** | 6 cặp ⊆ baseline 32, **0 mới**; CONTROL 21.00/4.48 OK; 12 cặp undecodable "không kết luận"; canvas runtime **CHƯA CHẠY** (staging build khác baseline) |
| 4 | tokens | `node packages/web/scripts/check-tokens.mjs` (root) | **0** | 79 allowlisted hex, 0 outside |
| 5 | contrast | `node packages/web/scripts/check-contrast.mjs` (root) | **0** | 7 tone × 2 mode ≥ 4.5:1 |
| 6 | light-theme | `node packages/web/scripts/check-light-theme.mjs` (root) | **0** | 230 màu / 643 file, phủ hết |
| 7 | dom-landmarks | `node scripts/check-dom-landmarks.mjs` (`packages/web`) | **0** | static gate PASS |
| 8 | heading-contract | `node scripts/check-heading-contract.mjs` (`packages/web`) | **0** | 23 / 103 file, baseline 23, 0 mới |
| 9 | focus-ring | `node scripts/check-focus-ring.mjs` (`packages/web`) | **0** | 2 / 643 file, baseline 8, 0 mới (xem N2) |
| 10 | portfolio-contrast | `node scripts/check-portfolio-contrast.mjs` (`packages/web`) | **0** | 12 cặp × 2 theme ≥ 4.5:1 |
| 11 | budget | `node packages/web/scripts/check-uiux-budget.mjs` (root) | **0** | tổng 162→**60 (-102)**; A11Y-9 5→2; CSS-2 46→0; NAV-1 89→38; A11Y-8 4→2; 0 rule tăng; script đề xuất `--write-baseline` nhưng **không chạy** |

## 6. CHƯA CHẠY

- Staging VPS `14.225.255.47` / `docker.edusuccess.vn`: deploy + verify — CHƯA CHẠY.
- Ảnh before/after, 4 route × 2 theme, `test:visual` / E2E Playwright — CHƯA CHẠY.
- `vitest run` full / `test:components` full — CHƯA CHẠY (chỉ chạy 1 file modal test).
- `npx tsc --noEmit`, `npm run build`, `npm run lint`, `i18n:scan` — CHƯA CHẠY.
- Canvas runtime contrast của `check-theme-contrast` — CHƯA CHẠY (script tự báo build staging khác baseline: `/assets/adapters-CqPqhZ1i.js` ≠ `/assets/adapters-B64GAyed.js`).

## 7. Next steps / owner

1. Agent slice sửa **O-30** tại `TenantAdminReportsPage.tsx:261` (gắn `ref`, `role`, `aria-modal`, ổn định `onClose`), thêm test hành vi cho modal này.
2. Chạy lại B8: 11 gate ở §5 + test mới; giữ baseline `check-ui-baseline/` rỗng.
3. Coordinator: cập nhật claim `CLAIMS.md:1992` để liệt kê `scan-ui-guidelines.mjs` (N3); cân nhắc follow-up cho 2 focus-ring còn lại (N2) và control script `a11y9-control.mjs` (N1).
4. Sau khi O-30 đóng và gate xanh → B9 (đóng claim + Entry ledger + PR). Không tự PR khi còn major.
