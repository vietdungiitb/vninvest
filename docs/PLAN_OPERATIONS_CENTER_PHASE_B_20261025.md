# PLAN — Operations Center Phase B (Performance/Maintainability, P1)

**Master:** `docs/PLAN_OPERATIONS_CENTER_MASTER_20261025.md`

## B1. Code-split tabs/sections
- Files: `ShellOperationsCenterPage.tsx`, `SocDataOpsPanel.tsx`
- Dùng `React.lazy` + `Suspense` cho panels.
- Prefetch on hover.

## B2. Split SOC client adapter
- File: `packages/web/src/adapters/core/soc.js`
- Tách `soc/overview.ts`, `soc/dataops.ts`, `soc/signals.ts`, `soc/prefetch.ts`, `soc/vnbroker.ts`, `soc/broker.ts`, re-export.

## B3. Runtime KPI use SOC client
- File: `SocRuntimeKpiPanel.tsx`
- Add `getSocSloOverview` to SOC client; remove direct adapter cast.

## B4. Standardize error state
- Files: `DataOpsContext.tsx`, panel components.
- Shared error banner + retry callback.

## Gates
- `tsc --noEmit` PASS.
- Targeted component tests PASS.
- Bundle size check (CHƯA CHẠY nếu không build).