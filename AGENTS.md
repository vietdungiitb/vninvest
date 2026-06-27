
## Goal
Hoàn thiện SOC DataOps tab (Phase 1 parity với legacy) — Steps 1–3 đã xong. Chuyển sang 3 priority mới: split VNInvestCharts.js (orchestration layer), refactor renderSeries() trong DynamicChart.js (switch → registry), split VNInvestCharts.contract.test.js (theo feature domain).

## Constraints & Preferences
- Pure createElement pattern (không JSX) — pre-commit hook react/jsx-no-literals. Với UI phức tạp dùng helper factory functions.
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

### In Progress
- (chưa bắt đầu 3 priority chart refactor)

## Next Steps
1. Priority 1 — Split VNInvestCharts.js: extract useLocalStorageState hook, decompose rendering sub-components, tách pane chrome helpers
2. Priority 2 — Refactor renderSeries() trong DynamicChart.js: tạo SeriesRendererRegistry, chuyển 40 case switch → registry dispatcher
3. Priority 3 — Split VNInvestCharts.contract.test.js: tách 73 tests thành 4 file theo domain (core, drawingSelection, drawingCreation, drawingManipulation)
4. Verify npx tsc --noEmit, npm run build

## Key Decisions & Metrics
- VNInvestCharts.js — 1,782 dòng thực tế (user estimate 3,160). VNInvestChartsContent forwardRef (58-1745) là target chính.
- DynamicChart.js renderSeries() — 140 dòng thực tế (user estimate 700). 40 switch-case, 3 pattern lặp (line/compound/bar).
- VNInvestCharts.contract.test.js — 3,773 dòng thực tế (user estimate 8,912). 73 tests, 1 describe block, 5 nhóm domain. Đã có 35+ split test files pattern.
- renderSeries() line count: thực tế 140 dòng, không phải 700. VNInvestCharts.js: 1,782 dòng (khác user estimate 3,160).
- DynamicChart tồn tại ở cả packages/web (JS ESM) và frontend/legacy (TSX) — cần verify sync.
- SeriesRegistry.js hiện chỉ quản lý theme/style — cần mở rộng cho component binding.
