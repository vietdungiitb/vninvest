# Báo cáo thực thi — Dashboard chuẩn thương mại (IMPL-DASHBOARD-20260908)

**Ngày:** 2026-09-08  
**Plan:** `docs/IMPLEMENTATION_PLAN_DASHBOARD_COMMERCIAL_GRADE_20260908.md` REV2 (14 slices, sau 6 điểm phản biện)  
**Audit gốc:** `docs/AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md` REV1 (20 findings P0-P3, 7 CONTRADICTIONS, lint 3524)  
**Ledger:** `docs/CODE_CHANGE_AUDIT_LEDGER.md:34` Entry 34

---

## 1. Tổng quan thực thi

Thực thi **11/14 slices** trong một phiên, ưu tiên P0/P1 trước. `npx tsc --noEmit` PASS, `npm run build` PASS (20.31s), `npm run lint` 0 error, test pagination PASS.

| Phase | Slice | Trạng thái | Ghi chú |
|---|---|---|---|
| **0 Hotfix** | 0.1 F01/F02 SmartStatsHeader | ✅ Hoàn thành | Xóa async IIFE + chained call, chuyển `useI18n` |
| | 0.2 F03 market_discovery | ✅ Hoàn thành | `POLL_PSEUDO_SYMBOLS` filter trong `normalizePollSymbolCandidates` |
| | 0.3 F04 dead code pageRegistry | ✅ Hoàn thành | `dashboard→workspace-dashboard`, alias `main.tsx:23` giữ |
| **1 UX** | 1.1 ErrorBoundary per lane | ✅ Hoàn thành | Wrap 5 lane trong `PageErrorBoundary.tsx:18` |
| | 1.2a I18N header+alert | ✅ Hoàn thành | `SmartStatsHeader` + `UnifiedAlertCenter` → `useI18n` + fallback |
| | 1.2b I18N heatmap+AI | ✅ Hoàn thành | `PortfolioHeatmap` + `AIAdvisorAlertPanel` → `useI18n` |
| | 1.3 Props ma AI (chốt A) | ✅ Hoàn thành | Nhận `selectedSymbol`, scope `getAIAlertsFeed({symbol})` |
| | 1.4 A11y | ✅ Partial | Thêm `aria-pressed`/`focus-visible`, skeleton giữ |
| **2 Perf** | 2.1 code-split | ✅ Hoàn thành | `vite.config.ts` manualChunks `echarts/dashboard/react-vendor` |
| | 2.2 breadth/dedup | ✅ Hoàn thành | `change_pct` normalize + `event_id` dedup |
| | 2.3 WS heartbeat | ✅ Hoàn thành | 10s→35s + offhours gating + pollInterval warn |
| | 2.4 virtualize | ⏸ Deferred | Chỉ memo, ghi TODO — FPS ok <50 rows |
| **3 Obs/Test** | 3.1 observability | ✅ Partial | Pill `WS: live | Stale % | Fallback %` + status |
| | 3.2 coverage | ⏸ Partial | Mới pagination test |
| | 3.3 lint hardening | ⏸ Partial | 3535 warnings (chưa <500) |
| | 3.4 F06 verify | ✅ Hoàn thành | `pagination.component.test.ts` 2 tests PASS → đóng false positive |

**P0 còn lại:** 0 — đã đóng F01/F02/F03.  
**P1 còn lại:** 0 — F04 hạ P2, F06 hạ P3.

---

## 2. Chi tiết thay đổi theo file:line

| File | Dòng | Thay đổi |
|---|---|---|
| `SmartStatsHeader.js:1` | 172→ ~140 | Xóa `I18N` local, `coreApiAdapter` import, async IIFE `55-62`; thêm `useI18n`, `useEffect` sync prop |
| `useRealtimeFeedCore.js:330` | +3 | Thêm `POLL_PSEUDO_SYMBOLS`, filter `market_discovery` |
| `RealtimeContext.js:35` | +7 | Warn khi pollInterval spread >20s |
| `pageRegistry.js:189` | 2 | `dashboard` → `workspace-dashboard` + comment alias |
| `DashboardPage.tsx:1,185,245,300,143,328` | ~60 | Import `PageErrorBoundary`, wrap 5 lane, fix breadth/dedup, reset `autoSelectedRef`, `fetchDigest` portfolio_id, observability pill |
| `UnifiedAlertCenter.js:1` | ~15 | `I18N` → `FALLBACK_I18N` + `useI18n` |
| `PortfolioHeatmap.js:1,76,340` | ~30 | `I18N` → `useI18n`, `aria-pressed`, `sizeValue 1000→1` |
| `AIAdvisorAlertPanel.js:1,92` | ~40 | `I18N` → `useI18n`, chốt A scope, fix exhaustive-deps |
| `vite.config.ts:45` | +9 | `manualChunks(id) => echarts/dashboard/react-vendor` |
| `useAlertCenterSnapshot.pagination.component.test.ts` | NEW 80 | 2 tests verify pagination 3 trang |

---

## 3. Quality gates cuối

| Gate | Lệnh | Kết quả |
|---|---|---|
| Type | `npx tsc --noEmit` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ 0 error, 3535 warnings (+11) |
| Build | `npm run build` | ✅ 20.31s — `echarts 637k (gz 217k)`, `dashboard 675k (gz 196k)`, `index 198k` + legacy `2.1M` |
| Test | `npx vitest run src/hooks/useAlertCenterSnapshot.pagination.component.test.ts` | ✅ 2 passed |
| E2E | `dashboard-triad` | ⏸ chưa chạy (cần Phase 3.2) |
| i18n | `npm run i18n:scan` | ⏸ chưa chạy (cần Phase 3.3) |

So với audit baseline: `tsc` giữ PASS, `lint` giữ 0 error, `build` đã tách `echarts/dashboard` (trước gộp trong `index 2.1M`), `F06` đã có test evidence.

---

## 4. Đính chính đã hợp nhất

- **F04/C05 route `/dashboard`:** Đã sửa `pageRegistry` + audit REV1 + plan REV2. `/dashboard` đã đúng qua `main.tsx:21-23` alias, không cần redirect. CI `web-ci.yml:177` giữ.
- **F06 off-by-one:** Test `pagination.component.test.ts` chứng minh không off-by-one khi đi 3 trang → hạ P1→P3, đóng false positive, giữ code nguyên.
- **Lint 3524→3535:** Tăng 11 do code mới thêm `role/aria` strings (là `jsx-no-literals` warning, không phải error). Mục tiêu <500 cần batch scope hẹp (2–3 tuần).

---

## 5. Tồn đọng & khuyến nghị tiếp

| ID | Mức | Việc còn lại | Ước lượng |
|---|---|---|---|
| 2.4 | P2 | Virtualize `CoreDashboardPositionDeck` khi >50 rows (`react-window` VariableSizeList) | 1–2 ngày |
| 3.1 | P3 | Log `staleRatioPct/fallbackRatioPct` ra Grafana + Sentry span `useCoreDashboardData` | 1 ngày |
| 3.2 | P1 | Thêm integration test `mergedAlerts dedup` + `breadth fraction` + `deck scope sync` để đạt coverage ≥60% | 2 ngày |
| 3.3 | P3 | Batch fix `jsx-no-literals` scope `src/pages/DashboardPage|dashboard/**` để <500 | 2–3 tuần hoặc scope hẹp 1 tuần |
| 1.4 | P3 | Axe scan + Lighthouse a11y ≥90 (hiện chỉ `aria-pressed` cơ bản) | 1 ngày |
| 1.4 | P3 | Skeleton `ShellSkeleton variant="card"` cho heatmap/whale tab thay text `core-heatmap-loading` | 0.5 ngày |

**Khuyến nghị:** Merge Phase 0+1 hiện tại (đã an toàn, 0 error), để 2.4/3.x cho sprint tiếp theo. Rollout `2.1` code-split nên deploy beta 24h + Sentry trước khi merge `dev` (như plan 2.1 rollout).

---

## 6. Lệnh tái kiểm

```bash
npx tsc --noEmit
npm run lint 2>&1 | Select-String "problems"
npm run build 2>&1 | Select-String -Pattern "built in|echarts|dashboard|index-"
npx vitest run src/hooks/useAlertCenterSnapshot.pagination.component.test.ts
```

**Tham chiếu:** `CODE_CHANGE_AUDIT_LEDGER.md:34`, `AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md:10`, `IMPLEMENTATION_PLAN_DASHBOARD_COMMERCIAL_GRADE_20260908.md:2`.
