# W1-a11y — sửa 2 rule quét bị lỗi thời (có control âm/dương)

## A11Y-9 — aria-label nằm dòng sau bị báo thiếu

- File: `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` rule A11Y-9.
- Trước: chỉ check `ctx.line` ⇒ `<input` dòng 107 + `aria-label` dòng 111 bị tính là "không label" (`FilterBar`, `command`, …).
- Sau: check `ctx.line` **hoặc** cửa sổ ±6 dòng (cùng cửa sổ đã dùng cho `<label`).
- Control (`a11y9-control.mjs`): aria-label dòng sau → `false` ✅ · không có tên → `true` ✅ · `<label htmlFor>` → `false` ✅.

## CSS-2 — reduced-motion đã có toàn cục

- File: `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` rule CSS-2.
- `packages/web/src/index.css:804-805` có `@media (prefers-reduced-motion)` ở mức global (audit UX-02 đã thêm). Rule cũ chấm **theo từng file CSS** ⇒ 55 hit giả.
- Sau: đọc 1 lần `GLOBAL_REDUCED_MOTION` từ `index.css`; nếu có thì mọi file CSS được coi là đã phủ.
- Không xoá transition/animation nào, không mất duration/easing (L-F05).

## Modal behavior

- `hooks/useModalA11y.ts`: Escape đóng + Tab/Shift+Tab trap + focus return (dùng chung cho modal cũ chưa migrate Radix).
- Test `hooks/__tests__/useModalA11y.component.test.tsx`: 3/3 PASS.
- Áp vào: `MuteModal.tsx`, `OptimizationModal.jsx`, `CampaignDetailDrawer.jsx`, `TenantAdminReportsPage.tsx` (create modal).

## Ghi chú

Cả 2 rule đổi là **sửa false-positive có control**, không phải nâng baseline để xanh. Budget gate sẽ tự suy lại số sau khi rule đổi.
