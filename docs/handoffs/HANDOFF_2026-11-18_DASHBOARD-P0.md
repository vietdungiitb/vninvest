# HANDOFF — Dashboard UI/UX P0 (2026-11-18)

- **Phạm vi**: 6 P0 trên `/dashboard` (Header search, Heatmap color/sizing, alert %/₫, CTA giả, first-symbol index). 5 quyết định Owner chốt 2026-11-18; scope = P0-only.
- **Branch / commit**: `feat/dash-p0-uiux` · base `dev @ 577ddf646` · `d3a779a98` (claim) · `96eee2765` (code) · `682381776` (closeout).
- **Trạng thái**: **done** (claim `dash-p0-uiux` → done; Entry 528). B3 plan audit 3 vòng NEED_REVISION → B4 **AGREE**; B8 re-audit **AGREE**, 0 blocker.

## Kết quả + evidence

| Slice | Fix | Evidence |
|---|---|---|
| S1 | Enter/chọn gợi ý `navigate({pathname, search:''})`; dropdown `getSymbolList`, Arrow/Enter/Escape; test assert pathname | `packages/web/src/layouts/full/vertical/header/Header.tsx:83-160,266-310`; `__tests__/Header.component.test.tsx` |
| S2 | HEAT_STOPS 5 mốc, 0% = `#eab308`, `NO_DATA_COLOR`, `heatmapLegendGradient()` SSOT | `packages/web/src/components/dashboard/PortfolioHeatmap.js:24-41,250-262,642`; `src/i18n/locales/{vi,en}/heatmap.js:12-16` |
| S3 | `formatAlertMetric` phân biệt price_shock/% vs VND | `packages/web/src/utils/alertCenterFormat.ts:118-155`; `UnifiedAlertCenter.js`; `AlertCard.tsx:223` |
| S4 | 2 CTA navigate thật | `packages/web/src/components/dashboard/SmartStatsHeader.js:169-186` |
| S5 | `resolveTileSize` fallback marketCap + notice | `PortfolioHeatmap.js:85-108,220-232`; 2 locale `heatmap.js` |
| S6 | `.split('|')[0]` | `packages/web/src/pages/DashboardPage.tsx:320` |

- Plan: `docs/PLAN_DASHBOARD_P0_20261118.md` · audit gốc: `docs/evidence/dashboard-uiux/AUDIT_20261118.md` · plan audit: `AUDIT_PLAN_B3.md` · re-audit: `REAUDIT_B8.md`.
- TDD: **16 RED → 35 GREEN** (6 file test) + 7 regression pass.
- Gates: tsc 0 · lint 0 errors · tokens PASS · i18n 0 · check-multi-agent PASS · `agent-sync.ps1` build OK. Chi tiết + giới hạn gate + CHƯA CHẠY: `docs/evidence/dashboard-uiux/gates.md`.

## Next steps / Owner

1. Merge PR vào `dev` (merge-commit, không squash); sau merge chạy `pwsh -File scripts/agent-cleanup.ps1 -Branch feat/dash-p0-uiux -Execute`.
2. **Bắt buộc trước khi coi UI verified**: chạy full FE suite + build + visual QA trên VPS staging (`14.225.255.47`, `bash scripts/deploy-staging.sh --verify`), **mở ảnh Heatmap ra xem** (đổi màu), E2E `/dashboard` + `/alert-center`, `check-a11y-runtime` cho dropdown. Các mục này **CHƯA CHẠY** — không báo PASS.
3. Wave P2 (chưa làm): kích hoạt popover xem nhanh Heatmap (**Owner Q4 đã chốt "kích hoạt"**), P1-1..P1-7, P2-2..P2-5.
4. Theo dõi: gate i18n-hardcoded chỉ quét 5 path (`package.json:33`) — không phải bằng chứng cho 6 file đã đổi.
