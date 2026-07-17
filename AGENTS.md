
## Goal
Hoàn thiện SOC DataOps tab (Phase 1 parity với legacy) — Steps 1–3 đã xong. Maintenance và build verification cho codebase sau khi thay local vninvestcharts component bằng npm package `vninvestcharts-widget`.

## Constraints & Preferences
- SOC glassmorphism patterns, soc.module.css tokens, i18n qua LangContext.
- API calls dùng defaultCoreApiAdapter cast as unknown as { … }.
- Vietnamese labels full dấu, theo bảng thuật ngữ thống nhất.
- Build verification: npx tsc --noEmit sau mỗi sub-step, npm run build cuối mỗi step.

## Progress
### Done
- Gap analysis hoàn chỉnh: Legacy DataOpsPanel.jsx vs packages/web SOC components. ~45-50% parity overall, ~20 feature gaps. Lưu tại docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md.
- Consolidated implementation plan: docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md.
- Step 0: Backend contract verification — dataset map confirmed (5 keys), inventory response shape fixed.
- Step 1: i18n keys audit + create — 34 keys + 5 subtab nested keys trong vi.js + en.js. Verified resolve.
- Step 2a–2d: Inventory section rewrite — SocDataInventorySection.tsx — dynamic data types grid, coverage by group table (6 columns, color-coded ratio), queue tiers accordion, year distribution bar chart.
- Step 3a–3c: Operations section rewrite — SocDataOpsBackfillForm.tsx — dataset checkboxes, VN100+CUSTOM groups, Preview+Run flow với Planner Console, Run Logs, inline error/success. tsc + build pass.
- Documented full chart refactor analysis: docs/CHART_REFACTOR_ANALYSIS_20260625.md.
- **Migration to vninvestcharts-widget (npm)**: Xoá local component tree `packages/web/src/components/vninvestcharts/` (+ `packages/vn-kline-engine-core/`, `packages/vn-kline-engine-react/`) — 745 files, -102k lines. Import chuyển sang `vninvestcharts-widget` ^1.2.5. Path aliases trong tsconfig + vite.config dọn dẹp. WatchlistDetailPanel sửa props `hideX` → `showX`.
- **Priority 2 (renderSeries registry)**: Hoàn thành trong commit `3df5ff6c`. DynamicChart renderSeries() chuyển 40 case switch → SeriesRendererRegistry dispatcher, tách ~200 dòng.
- **Priority 1 & 3**: Obsolete — local VNInvestCharts.js và contract tests đã bị xoá cùng component tree.

### Done (2026-07-17)
- **React 19 peer-dep TDZ fix**: `vninvestcharts-widget` ^1.2.5 declares `peerDependencies: react ^19.0.0` nhưng app là React 18.3.1. Static import trong `VNStockChartPanel.js` gây TDZ `Cannot access 'N' before initialization` lúc load `StockDetailPage`. Quyết định: lazy-load widget qua dynamic `import()` trong `useEffect` (Option B), KHÔNG upgrade app lên React 19 — vì recharts v2 peer-dep không hỗ trợ React 19 (sẽ ép recharts v3 migration rủi ro). Widget tách thành async chunk riêng (`index-C5jP24jD.js`, 2.1MB), `StockDetailPage` giảm từ ~3.5MB → 58KB. tsc + build pass.
- **SOC DataOps gap analysis — ALL 20 gaps CLOSED**: P0 #1–5, P1 #6–11, P2 #12–16, P3 #17–20 đều đã implement (Inventory/Operations/Monitor/Config sections). `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md` đã stale → đánh dấu hoàn thành.

## Key Decisions & Metrics
- Local `vninvestcharts/` component tree (~745 files, -102k lines) replaced by npm package `vninvestcharts-widget` ^1.2.5
- New adapter file: `packages/web/src/adapters/chartAdapter.js` — bridges core API → chart bar format
- New type declarations: `packages/web/src/types/vninvestcharts-widget.d.ts` — 44 lines
- renderSeries() registry refactor (Priority 2) completed in commit `3df5ff6c`
- **Widget lazy-load** (Option B): React 18 giữ nguyên, tránh recharts v3 migration. Widget code-split thành async chunk.
- **SOC DataOps parity: ~95%+** (tất cả 20 feature gaps đóng).
- Priority 1 (VNInvestCharts.js split) và Priority 3 (contract test split) obsolete — component đã xoá
