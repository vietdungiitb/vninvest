# R1.2 gates — AuditLogsPanel token + a11y + CSV (2026-10-16)

Branch `feat/ai-r12-auditpanel` ← `dev`. Claim `ai-r12`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:526-550`.

## Fail-before: 8/8 RED
Thiếu import (`buildAiAuditCsv`/`formatAuditDate` chưa tồn tại) + AC1 Tailwind cứng
+ AC2 header div + AC5 `params._r` + AC6 thiếu block css.

## Thực hiện
- Panel viết lại giữ nguyên `useUrlState` spec/defaults/options + reset-effect
  (nav1 không đụng): header `<button aria-expanded>` (keyboard native), badge →
  `.auditBadge*` token, filter/buttons → `.input/.select/.btn*` có sẵn, debounce
  300ms (mount gọi ngay, đổi filter debounce), bỏ `_r`, `applyFilters` hết
  double-fetch, `formatAuditDate` guard "—", Refresh/Export + notice
  (`exportedCount`/`exportTruncated`), `downloadAiAuditCsv` guard jsdom.
- CSS: block `/* R1.2 audit */` 23 class, chỉ `var(--ai-*)`, 0 hex.
- i18n: +4 key/panel-locale (`refreshList/exportCsv/exportedCount/exportTruncated`).
  Sự cố regex ăn nhầm `usage.exporting` (deprecated block) → phát hiện qua diff,
  khôi phục verbatim (bài học: regex xóa key phải neo block-scope).

## Sửa test trong lúc GREEN (trung thực)
- AC2/AC5: query số ít → số nhiều (25 header buttons).
- AC6: marker test khớp block thật (`/* R1.2 audit` mở).
- AC7: reject có message hiện message (đúng UX) → test dùng `new Error()` rỗng
  để vào nhánh `t(loadError)`.
- AC3 regex thêm lookbehind (loại `set(/get(`), AC5 loại comment (đã grep `https?://`=0,
  `/*` đều là comment thật).
- Panel: quên `import styles` (bắt ở GREEN lần 1); `react-hooks/exhaustive-deps`
  cho `refreshKey` → giữ dep + `eslint-disable` có lý do (giữ ngữ nghĩa refetch cũ).
- Test bỏ import `afterEach` thừa.

## Gates (EXIT=0)
- vitest mới **8/8**; hồi quy 8 files AI CC **42/42** (nav1/page/AISliceE/drawer/
  parity×2/form/smoke) — NAV-1 URL giữ nguyên.
- `tsc` 0 · `eslint` 0 · `i18n:scan:strict` (chạy ở R1.3, keys mới đối xứng) ·
  `check-ai-cc` SẠCH · `npm run build` PASS · `check-multi-agent` 0 lỗi.

## CHƯA CHẠY
- AC6 visual light/dark + 4 ảnh (không browser) · full BE · ruff · E2E UI · staging.
