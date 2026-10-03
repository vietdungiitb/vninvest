# Kế hoạch triển khai — Dashboard chuẩn thương mại

**Mã:** `IMPL-DASHBOARD-20260908`  
**Nguồn audit:** `docs/AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md` (patch 2026-09-08-REV1 sau phản biện độc lập)  
**Phạm vi:** `packages/web` — `/dashboard` (alias `core-dashboard`) và toàn bộ triad `SmartStatsHeader / UnifiedAlertCenter / PortfolioHeatmap / CoreDashboardPositionDeck / AIAdvisorAlertPanel` + realtime hybrid  
**Ràng buộc cứng (`AGENTS.md:6`):** SOC glassmorphism + `soc.module.css` tokens, i18n qua `LangContext` (`useI18n`), API qua `defaultCoreApiAdapter` cast `as unknown as {…}`, nhãn tiếng Việt có dấu, `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi slice  
**Báo cáo phản biện đã hợp nhất:** F04/C05 route `/dashboard` **đã đúng** qua `main.tsx:21-23` alias `dashboard→core-dashboard` (entry `pageRegistry.js:189` là dead code); F06 off-by-one **CHƯA XÁC MINH** → hạ P1→P3 + yêu cầu test trước khi fix; lint thực tế `3524 warnings` (không phải ~70)

---

## 0. Mục tiêu & DoD tổng

**Mục tiêu:** Đưa `/dashboard` đạt chuẩn phần mềm thương mại: không crash P0, không poll rác, không dead code/props ma, a11y WCAG AA, bundle < 1 MB vendor split, coverage dashboard ≥60%, E2E triad xanh.

**DoD tổng (Definition of Done):**
- [ ] `npx tsc --noEmit` PASS (0 error) sau mỗi slice
- [ ] `npm run lint` 0 error (warning chấp nhận giảm dần; target Phase 3 < 500 warning dashboard scope)
- [ ] `npm run build` PASS, `DashboardPage-*` < 120 kB gz, `index-*` < 800 kB gz sau Phase 2
- [ ] Không còn P0/P1 open; P2/P3 còn lại có issue theo dõi
- [ ] E2E `dashboard-triad.spec.ts` PASS 3 viewport (desktop/tablet/mobile)
- [ ] i18n: không còn local `I18N` dict trong dashboard, `npm run i18n:scan` PASS

---

## 1. Phân rã Slice

> Mỗi slice là một PR focus, ≤ 4 file chạm, có thể review độc lập. Thứ tự phản ánh dependency.

### Phase 0 — Hotfix P0 (1–2 ngày) — chặn crash & poll rác

#### Slice 0.1 — F01+F02: Sửa `SmartStatsHeader` crash render
- **ID findings:** F01 `SmartStatsHeader.js:55`, F02 `SmartStatsHeader.js:58`
- **Files:** `packages/web/src/components/dashboard/SmartStatsHeader.js:1`, `packages/web/src/adapters/core/market.js:130` (tham chiếu), `packages/web/src/features/dashboard/useCoreDashboardData.js:84` (đối chiếu)
- **Yêu cầu đạt:**
  - Xóa `if (!analyticsData && holdings?.length) { (async()=>{})(); }` trong body render; chuyển sang `useEffect([holdings, analytics, portfolioId])` + `AbortController` cleanup
  - Xóa chained `getPortfolioAnalytics({}).getPortfolioAnalytics(...)`; nhận `analytics` từ prop `analytics`/`summary` của `DashboardPage` (đã có từ `useCoreDashboardData`), hoặc nếu cần refresh thì gọi đúng `defaultCoreApiAdapter.getPortfolioAnalytics(String(portfolioId),30)` qua cast
  - Không còn `useState` fetch trong render; không còn `TypeError` khi `holdings.length>0`
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS
  - `npm run build` PASS
  - Manual: mở `/dashboard` với portfolio có holdings → header hiện `Giá trị danh mục / Lãi lỗ` không crash console; chuyển portfolio khác không fetch storm (Network: 1 call/30s)
  - Test: thêm `SmartStatsHeader.component.test.tsx` — render với `holdings=[{symbol:"VCI"}]` không gọi `getPortfolioAnalytics` trong render (mock + `jest.spyOn`)
- **Rủi ro:** Thấp. Fallback giữ `analytics` từ parent nếu effect chưa chạy.

#### Slice 0.2 — F03: Lọc `market_discovery` khỏi poll
- **ID findings:** F03 `RealtimeContext.js:14` + `useRealtimeFeedCore.js:330,737`
- **Files:** `packages/web/src/hooks/useRealtimeFeedCore.js:330`, `packages/web/src/context/RealtimeContext.js:19`, `packages/web/src/hooks/useAlertCenterRealtime.js:15`
- **Yêu cầu đạt:**
  - `normalizePollSymbolCandidates(symbols, ...)` loại `market_discovery` trước khi phân `staleOrMissing/fresh` (VD `symbols.filter(s=>normalizeSymbol(s)!=="MARKET_DISCOVERY")`)
  - WS subscribe vẫn giữ `market_discovery` (đã đúng ở `useRealtimeFeedCore.js:1014` + `useAlertCenterRealtime.js:17`)
  - Không còn request `GET /realtime/tickers/?symbols=MARKET_DISCOVERY` trong Network 2 phút idle
- **Tiêu chí đánh giá:**
  - `npm run lint` PASS
  - `npm run build` PASS
  - Manual: DevTools Network filter `tickers` → không có `MARKET_DISCOVERY`; `fallbackRatioPct` không tăng giả ngoài giờ
  - Test: unit `normalizePollSymbolCandidates(['market_discovery'],{},true) → symbols:[]`; `['market_discovery','VCI'] → ['VCI']`; mock `getRealtimeTickers` không được gọi với `market_discovery`
- **Rủi ro:** Thấp. Đã có audit `AUDIT_ALERT_CENTER_20260805.md:69` mô tả fix.

#### Slice 0.3 — Dead code `pageRegistry` + tài liệu — **DoR: chốt giữ/xóa ShellDashboardPage**
- **ID findings:** F04/C05 (đính chính: không phải bug route, là dead code)
- **Files:** `packages/web/src/pages/pageRegistry.js:189`, `packages/web/src/main.tsx:21`, `docs/AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md:84`, `.github/workflows/web-ci.yml:177` (không đổi, chỉ xác minh)
- **DoR:** Chốt trước khi code: giữ `ShellDashboardPage` cho route nội bộ `workspace-dashboard` (đổi `routeId`) hay xóa hẳn. Quyết định này tránh quay lại sửa sau Phase 1 (phản biện #6).
- **Yêu cầu đạt:**
  - Xóa hoặc annotate `makePageEntry("dashboard", "baseline", ShellDashboardPage)` là dead cho route `/dashboard`; hoặc đổi `routeId` thành `"workspace-dashboard"` nếu chốt giữ; thêm comment `// DEAD for /dashboard — use core-dashboard via main.tsx:23 alias`
  - Sửa audit doc §1/§4/§7/§8: xóa khuyến nghị "thêm redirect `/dashboard→/core-dashboard`", thay bằng "dọn dead entry"
  - Xác minh `web-ci.yml:177` hit `/dashboard` đúng triad (không đổi)
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS
  - `grep -n "getPageComponent('dashboard')" src/` → 0 ngoài `pageRegistry` định nghĩa; `resolvePageComponent('dashboard')` vẫn alias đúng
  - Manual: `/dashboard` vẫn render triad; `/workspace-dashboard` (nếu giữ) render shell
- **Rủi ro:** Thấp. Chỉ doc + dead code.

---

### Phase 1 — UX thương mại & i18n (5–7 ngày)

#### Slice 1.1 — ErrorBoundary per lane
- **ID:** F15 `DashboardPage.tsx:312,320,328`
- **Files:** `packages/web/src/pages/DashboardPage.tsx:328`, `packages/web/src/components/PageErrorBoundary.tsx` (tái dùng — đã có tại `src/components/PageErrorBoundary.tsx:18`, đang dùng ở `AlertCenterPage.tsx:5` và `StockDetailPage.tsx:21`), `packages/web/src/components/ShellSkeleton.tsx`
- **Yêu cầu:**
  - Wrap mỗi lane (`SmartStatsHeader`, `UnifiedAlertCenter`, `PortfolioHeatmap`, `AIAdvisorAlertPanel`, `CoreDashboardPositionDeck`) trong `ErrorBoundary` riêng với `fallback` + `onRetry=refresh`
  - `showSkeleton` giữ; `error` toàn trang chỉ khi `!hasHydrated && error` (giữ `320` nhưng không sập khi 1 lane lỗi)
- **Tiêu chí:**
  - Test: mock `PortfolioHeatmap` throw → các lane khác vẫn hiện; nút Retry gọi `refresh`
  - Manual: tắt network cho `getBulkTechnicals` → chỉ lane technical lỗi, header vẫn live

#### Slice 1.2a — Xóa local I18N dict (header + alert)
- **ID:** F16 `SmartStatsHeader.js:8`, `UnifiedAlertCenter.js:12` + C01
- **Files:** `packages/web/src/components/dashboard/SmartStatsHeader.js:8`, `packages/web/src/components/dashboard/UnifiedAlertCenter.js:12`, `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`
- **Yêu cầu:**
  - Xóa `const I18N = {vi,en}` + `resolveLocale/createTranslator` trong 2 file; thay bằng `const {t}=useI18n()` (import từ `context/LangContext.js`)
  - Thêm keys `dashboard.smartStats.*`, `dashboard.alert.*` vào `vi.js`/`en.js` (đầy đủ dấu)
  - CSS chuyển từ `bg-slate-900/60` hardcode sang `soc.module.css` tokens nơi có token tương ứng
- **Tiêu chí:**
  - `npm run i18n:scan` PASS 0 hardcoded cho 2 file
  - `npm run lint` không tăng warning dashboard scope
  - Manual: đổi ngôn ngữ → header + alert lane đổi ngay

#### Slice 1.2b — Xóa local I18N dict (heatmap + AI)
- **ID:** F16 `PortfolioHeatmap.js:20`, `AIAdvisorAlertPanel.js:7` + C01
- **Files:** `packages/web/src/components/dashboard/PortfolioHeatmap.js:20`, `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:7`, `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`
- **Yêu cầu:**
  - Xóa `const I18N` + `resolveLocale/createTranslator` trong 2 file; thay bằng `const {t}=useI18n()`
  - Thêm keys `dashboard.heatmap.*`, `dashboard.aiAdvisor.*` vào `vi.js`/`en.js`
  - Đồng bộ CSS sang `soc.module.css` tokens
- **Tiêu chí:** Như 1.2a; `npx tsc --noEmit` PASS sau mỗi sub-slice
- **Ghi chú tách slice:** Tách để giữ ≤4 file/slice (quy tắc §1), giảm conflict `vi.js`/`en.js` khi review song song; có thể gộp nếu reviewer chấp nhận 5-6 file nhưng khuyến nghị giữ tách

#### Slice 1.3 — Sửa props ma `AIAdvisorAlertPanel` — **ĐÃ CHỐT phương án A**
- **ID:** F05 `AIAdvisorAlertPanel.js:105` + `DashboardPage.tsx:389`
- **Files:** `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:105`, `packages/web/src/pages/DashboardPage.tsx:389`
- **DoR (Definition of Ready) — phải chốt trước kickoff:** PO/Arch xác nhận AI lane là **portfolio-scoped** (theo universe danh mục), không phải global. Nếu muốn giữ global, phải đổi slice này thành "xóa props thừa" và cập nhật audit §8.2.
- **Yêu cầu (chốt A, xóa B):**
  - Đổi `AIAdvisorAlertPanel` nhận đúng props `{holdings, technicals, analytics, alerts, loading, selectedSymbol, ... , className}` và scope `getAIAlertsFeed({symbols: universe.join(",")})` nếu BE hỗ trợ `symbols` filter; bỏ fetch global khi đã có props (hoặc giữ fetch nhưng có `symbols` + cache key `tenant+universe`)
  - Xóa nhánh B khỏi PR; nếu sau này cần global lane thì tạo slice riêng `1.3b`
- **Tiêu chí:**
  - `npx tsc --noEmit` PASS (nếu thêm TS types)
  - Manual: chọn portfolio khác → AI lane đổi theo universe, không double request
  - Test: spy `getAIAlertsFeed` gọi 1 lần với `symbols` param

#### Slice 1.4 — A11y & skeleton
- **ID:** F15 (tiếp), lint `3524 warnings` (đính chính)
- **Files:** `PortfolioHeatmap.js:213,360`, `UnifiedAlertCenter.js:221`, `CoreDashboardPositionDeck.tsx:244`, `ShellSkeleton.tsx`
- **Yêu cầu:**
  - Heatmap treemap: `tabIndex`, `role="button"`, `aria-label="${symbol} ${changePct}%"`, keyboard Enter/Space → dialog/navigate
  - Severity pills: `aria-pressed`, `aria-label`, focus-visible ring `soc`
  - Skeleton: thay `core-heatmap-loading` text bằng `ShellSkeleton variant="card"` cho heatmap/whale tab
  - Contrast audit `bg-slate-900/60` trên `text-slate-500` đạt WCAG AA (hoặc tăng lên `text-slate-400`)
- **Tiêu chí:**
  - Axe scan 0 critical
  - Keyboard: Tab qua triad, Enter mở dialog heatmap
  - Lighthouse a11y ≥90

---

### Phase 2 — Hiệu năng & Realtime (5–7 ngày)

#### Slice 2.1 — Code-split `echarts` + `DashboardPage`
- **Yêu cầu:** `vite.config.ts` `manualChunks: { echarts:['echarts','echarts-for-react'], dashboard:['pages/DashboardPage'] }` hoặc `React.lazy` cho `PortfolioHeatmap`/`WhaleAnalyticsTab`
- **Rollout an toàn (bổ sung):** Deploy beta trước (`beta.edusuccess.vn`) → theo dõi Sentry + console error 24h (FOUC, chunk load error) → mới merge `dev`; rollback plan: revert `vite.config.ts` single chunk
- **Tiêu chí:** `npm run build` `index-*` < 800 kB gz, `DashboardPage-*` < 120 kB gz, `WhaleBubbleChart-*` tách riêng; `tsc` PASS; E2E không FOUC; Sentry 24h không có `ChunkLoadError`

#### Slice 2.2 — Sửa breadth & dedup alerts
- **ID:** F11 `DashboardPage.tsx:184`, F05 dedup key
- **Files:** `DashboardPage.tsx:184,245`, `hooks/useRealtimeFeedCore.js:103` (reuse `normalizeChangePct`)
- **Yêu cầu:**
  - `calculatedBreadth` đọc `change_pct` đã normalize từ `mergedQuotes` (đã qua `mergeQuote`) thay vì `Number(change_value||change_pct||change)` thô
  - Dedup `mergedAlerts` chuẩn `event_id` (fallback `symbol-ts-side`) khớp `useAlertCenterRealtime.js:27`
- **Tiêu chí:** Test breadth với feed fraction `0.01` → đếm `up` đúng; dedup không trùng khi WS + snapshot cùng event

#### Slice 2.3 — Tune WS heartbeat & poll policy
- **ID:** F09 `useRealtimeFeedCore.js:1021`, F14 `RealtimeContext.js:30`
- **Yêu cầu:**
  - Timeout 10s → 30-45s, chỉ force reconnect khi `market_phase` live (`open/continuous`) và `data_semantic !== last_session_close`
  - Doc rõ `RealtimeContext` policy `pollInterval = min(...)` vs `maxAlerts = max(...)`, log warn khi conflict > 20s
- **Tiêu chí:** Ngoài giờ không còn `close(4000)` liên tục; log warn xuất hiện khi 2 consumer xin interval lệch >20s

#### Slice 2.4 — Virtualize deck table + memo
- **ID:** F20 `CoreDashboardPositionDeck.tsx:305`, F13 `116`
- **Yêu cầu:**
  - Virtualize `filteredOverviewRows` bằng `react-window` khi `>50` rows hoặc server pagination; memo `fmtNumber/fmtSignedPercent`
  - Gộp dual `useEffect` sync `selectedSymbolProp` thành `useControlled` single source
- **Tiêu chí:** 100 mã scroll không jank (FPS ≥55); chọn mã từ heatmap không flicker scope

---

### Phase 3 — Quan sát, test & chuẩn hóa (3–5 ngày)

#### Slice 3.1 — Observability
- **Files:** `hooks/useRealtimeFeedCore.js:448`, `pages/DashboardPage.tsx:328` (status pill)
- **Yêu cầu:** Expose `metrics.connectionState.transport/lastLatencyMs/fallbackRatioPct/staleRatioPct` lên header status pill; `Sentry` span cho `useCoreDashboardData` phase 1/2
- **Tiêu chí:** UI hiện `WS: live / polling (fallback 2%)`; Grafana log `staleRatioPct` khi >20%

#### Slice 3.2 — Test & coverage
- **Yêu cầu:**
  - Unit: `SmartStatsHeader` không fetch trong render, `normalizePollSymbolCandidates` filter, breadth fraction
  - Integration: `DashboardPage` mergedAlerts dedup, deck scope sync
  - E2E: `tests/visual/dashboard-triad.spec.ts` 3 viewport (mock `tickers`, `alert-center/feed`, `technicals/bulk`)
- **Tiêu chí:** `npm run test -- --coverage` dashboard scope ≥60%; `npx playwright test dashboard-triad` PASS

#### Slice 3.3 — Lint & i18n hardening
- **Yêu cầu:** Giảm `3524 warnings` dashboard scope: bật `no-restricted-syntax` cấm `async IIFE` trong render, fix `react/jsx-no-literals` theo batch (không block build); `npm run i18n:scan` vào CI
- **Tiêu chí:** `npm run lint` dashboard scope < 500 warnings; `i18n:scan` PASS

#### Slice 3.4 — F06 verification (hạ P1→P3)
- **ID:** F06 `useAlertCenterSnapshot.ts:93` — **CHƯA XÁC MINH**
- **Yêu cầu:** Viết test tái hiện pagination 3 trang trước khi sửa; nếu test PASS (không off-by-one) thì đóng F06 là false positive; nếu fail thì fix theo test
- **Tiêu chí:** Test `goToNextPage`×2 rồi `goToPrevPage`×2 về đúng trang 1; quyết định giữ/sửa có evidence

---

## 2. Ma trận phụ thuộc (REV2 — sửa #3)

```
0.1 + 0.2 ──> 1.1 ─> 1.2a ─> 1.2b ─> 1.3 ─> 1.4
                    │
                    └─> 2.1 (độc lập, có thể song song 1.x) ─> 2.2 ─> 2.3 ─> 2.4
                                                    │
                                                    └─> 3.1 ─> 3.2 ─> 3.3
0.3 (độc lập — dọn dead code pageRegistry, không chặn 1.1; có thể làm bất kỳ lúc nào, kể cả sau merge) ─┘
3.4 (độc lập — verify F06, chạy song song 0.x, trước 1.x)
```

- 0.1 và 0.2 song song, cùng chặn 1.1.
- **0.3 độc lập hoàn toàn** (chỉ dead code, không đổi runtime `/dashboard`) — không chặn 1.1, có thể làm sau cùng để tránh block Phase 1 (sửa #3 phản biện).
- 1.2 tách thành 1.2a→1.2b tuần tự (chung `vi.js`/`en.js`, tránh conflict).
- 2.1 có thể song song 1.x (chỉ `vite.config.ts`).
- 3.4 chạy ngay từ đầu để xác minh F06.

---

## 3. Tiêu chí đánh giá chung (áp dụng mọi slice) + DoR

**DoR (Definition of Ready) — phải đủ trước khi dev bắt đầu slice:**
- [ ] Slice 0.3: chốt giữ `ShellDashboardPage` cho `workspace-dashboard` hay xóa hẳn (cùng lúc dọn dead code, tránh quay lại sửa sau Phase 1) — **DoR cho #6 phản biện**
- [ ] Slice 1.3: chốt phương án A (portfolio-scoped AI lane) — đã chốt ở slice 1.3, không để dev tự chọn A/B

| Gate | Lệnh | Tiêu chí PASS |
|---|---|---|
| Type | `npx tsc --noEmit` (packages/web) | 0 error |
| Lint | `npm run lint` (packages/web) | 0 error; warning không tăng ngoài scope slice |
| Build | `npm run build` (packages/web) | PASS; chunk dashboard < 120 kB gz sau 2.1 |
| Test | `npm run test` + `npm run test:components` | Liên quan slice PASS; coverage dashboard ≥60% sau 3.2 |
| E2E | `npx playwright test dashboard-triad` | PASS 3 viewport sau 3.2 |
| i18n | `npm run i18n:scan` (nếu có) | 0 hardcoded dashboard sau 1.2b |
| Manual | Checklist từng slice | Đạt mục "Tiêu chí đánh giá" của slice |
| Ledger | `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Mỗi slice 1 entry, ghi `Validation` đủ 3 gate |

---

## 4. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Sửa `SmartStatsHeader` làm mất analytics header | Giữ fallback `analytics` từ parent; feature flag `VITE_DASHBOARD_HEADER_FETCH=0` |
| Filter `market_discovery` làm mất alert global | Chỉ filter ở poll REST, WS vẫn subscribe `market_discovery` (`useAlertCenterRealtime` giữ) |
| Code-split gây FOUC | `Suspense` với `ShellSkeleton`, preload khi hover `/dashboard`; rollout beta 24h + Sentry (2.1) |
| i18n batch lớn gây conflict | **Đã chẻ 1.2→1.2a+1.2b** (≤4 file/slice), giữ tách cứng thay vì tùy nghi |

---

## 5. Ước lượng & nhân sự (đề xuất)

| Phase | Effort | Người |
|---|---|---|
| Phase 0 (0.1+0.2+0.3) | 1–2 ngày | 1 FE (0.3 có thể làm sau, không block) |
| Phase 1 (1.1 + 1.2a+1.2b +1.3+1.4) | 6–8 ngày | 1 FE + 1 QA a11y (tăng 1 ngày do tách 1.2) |
| Phase 2 (2.1–2.4) | 5–7 ngày | 1 FE (+ beta rollout 24h cho 2.1) |
| Phase 3 (3.1–3.4) | 3–5 ngày | 1 FE + 1 QA E2E |
| **Tổng** | **15–22 ngày** | |

---

## 6. Checklist phát hành

- [ ] Tất cả slice Phase 0 merge, tag `dashboard-hotfix-20260908`
- [ ] Phase 1–2 merge, `npm run build` chunk < 800 kB gz, axe 0 critical
- [ ] E2E `dashboard-triad` xanh trên `beta.edusuccess.vn`
- [ ] `docs/AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md` patch REV1 applied (đã xong: F04/C05 đính chính, F06 hạ P3, lint 3524)
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đủ entry 34–46 (mỗi slice 1 entry)

---

## 7. Phụ lục — Lệnh tái kiểm nhanh

```bash
# Gate
npx tsc --noEmit
npm run lint 2>&1 | Select-String "problems"
npm run build 2>&1 | Select-String -Pattern "built in|DashboardPage|index-.*\.js"

# Test
npm run test -- --coverage --collectCoverageFrom="src/pages/DashboardPage.tsx" --collectCoverageFrom="src/components/dashboard/**"

# E2E (sau 3.2)
npx playwright test tests/visual/dashboard-triad.spec.ts --project=chromium

# i18n
npm run i18n:scan
```

**Tham chiếu:** `packages/web/src/main.tsx:21`, `pageRegistry.js:189`, `SmartStatsHeader.js:55`, `useRealtimeFeedCore.js:330`, `useAlertCenterSnapshot.ts:93`, `CODE_CHANGE_AUDIT_LEDGER.md:33`.
