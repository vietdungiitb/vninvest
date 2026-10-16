# R1.4 gates — Skeleton + isDirty + refresh() imperative (2026-10-16)

Branch `feat/ai-r14-dirty` ← `dev`. Claim `ai-r14`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:578-600`.

## Fail-before thật (stash code, giữ test): 6/6 RED trên code cũ
Stash 3 file code → chạy test mới → 6 failed → pop. Không diễn.

## Thực hiện
- Page: 3 metric null-init + "—" tới khi có data + `aria-busy` (hết số giả 24/5000);
  `overviewLoaded`; `beforeunload` khi (promptConfigDirty || formFieldsDirty);
  timer notice qua ref + cleanup unmount; `auditRef` + `refresh()` imperative,
  bỏ remount `key=audit-panel-${k}` (giữ filter/page/expanded).
- Form: `fieldsDirty` (8 handler) + reset khi load/save/clear-key; Lưu disabled =
  `saving || (!fieldsDirty && !externalDirty)`; prop mới `externalDirty`,
  `onFieldsDirtyChange` (optional — Shell không vỡ); skeleton `role=status aria-busy`.
- Panel: `forwardRef` + `useImperativeHandle({refresh})` qua ref-stable.

## Sửa test cũ (ghi rõ, không giấu)
- Page test R0.3 "save without drawer" click Lưu khi sạch (trước R1.4 luôn bật)
  ⇒ thêm bước sửa 1 field (giữ nguyên assert NOT resend prompt_config).
  R1.4 AC2 thay thế hành vi cũ — có chủ đích, theo plan.

## Gates (EXIT=0)
- vitest mới **6/6**; hồi quy AI CC: r12 8/8 + nav1 + page 10/10 + AISliceE +
  drawer + parity×3 + smoke + contract (42+).
- `tsc` 0 · `eslint` 5 files 0 (1 `eslint-disable` có lý do: dep `refreshKey`
  giữ ngữ nghĩa refetch; `useImperativeHandle` deps `[]`) · `check-ai-cc` SẠCH
  · `npm run build` PASS 38s · `check-multi-agent` 0 lỗi.

## CHƯA CHẠY
- Video thao tác lưu 3 lần (plan) · visual skeleton · full BE · ruff · E2E · staging.
