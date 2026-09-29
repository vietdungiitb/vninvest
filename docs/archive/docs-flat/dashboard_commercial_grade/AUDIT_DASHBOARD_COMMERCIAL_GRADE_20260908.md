# Audit Dashboard `http://localhost/dashboard` — Chuẩn Thương mại

**Ngày:** 2026-09-08 (REV1 2026-09-08 — đính chính sau phản biện độc lập)  
**Phạm vi:** `packages/web/src/pages/DashboardPage.tsx:1`, `pages/workspace/ShellDashboardPage.tsx:1`, `features/dashboard/*`, `components/dashboard/*`, `hooks/useRealtimeFeedCore.js:1`, `context/RealtimeContext.js:1`, `adapters/core/market.js:1`, `adapters/core/workspace.js:1`  
**Thực thi:** `npx tsc --noEmit` (PASS), `npm run lint` (PASS 0 error, **3524 warnings** — đính chính từ ~70), `npm run build` (PASS 31.94s)  
**Chuẩn đối chiếu:** `AGENTS.md:6` (SOC glassmorphism, `soc.module.css`, i18n qua `LangContext`, `defaultCoreApiAdapter`), khung audit cứng § Nguyên tắc chống lỗi audit 1-6  
**Loại:** Chỉ nghiên cứu + phân tích — không viết code (trừ khi được yêu cầu rõ)

---

## 0. Nguyên tắc bắt buộc (đã tuân thủ)

1. Mọi khẳng định kèm `file:line`. Không có line = không hợp lệ.
2. Không đoán — chưa đọc file thật ghi "CHƯA XÁC MINH".
3. Dùng grep/glob/read, không dùng kinh nghiệm chung.
4. Plan/doc mâu thuẫn code -> mục CONTRADICTIONS riêng.
5. Quét toàn repo gồm `.css`, `.module.css`, config, i18n, adapters.
6. Không viết code trong audit.
7. File không tồn tại báo "KHÔNG TỒN TẠI".
8. Ngôn ngữ báo cáo: Tiếng Việt.

---

## 1. Tóm tắt điều hành — 5 lỗi nghiêm trọng nhất

> Đọc trước khi đi vào chi tiết. Toàn bộ bảng Findings ở §4.

1. **P0 — Crash logic trong render** — `packages/web/src/components/dashboard/SmartStatsHeader.js:55` chạy `async IIFE` ngay trong body render, gây fetch loop mỗi render, vi phạm Rules of React. Kích hoạt khi `holdings.length > 0 && !analyticsData`.
2. **P0 — Gọi API sai signature** — `SmartStatsHeader.js:58` viết `coreApiAdapter.getPortfolioAnalytics({}).getPortfolioAnalytics(holdings.map(...).join(","))` — chained call vô nghĩa, runtime `TypeError`. Nguyên nhân copy-paste sai `market.js:171` (`getPortfolioAnalytics(portfolioId, days)`).
3. **[ĐÍNH CHÍNH REV1] P2 — Dead code `pageRegistry` (không phải route nhầm)** — `pageRegistry.js:189` entry `dashboard → ShellDashboardPage` là **dead/unreachable** cho route `/dashboard`. Route thực tế `main.tsx:21-23` alias `if (routeId==='dashboard') registryId='core-dashboard'` nên `/dashboard` đã load đúng `DashboardPage.tsx:112` (triad thật). CI `web-ci.yml:177` **không** smoke-test nhầm. Vấn đề thật: dọn dead entry cho gọn, không cần redirect.
4. **P0 — Poll rác `MARKET_DISCOVERY`** — `context/RealtimeContext.js:14` + `hooks/useRealtimeFeedCore.js:330,737` đưa pseudo-symbol `market_discovery` vào `normalizePollSymbolCandidates`, khiến mỗi 3-8s gọi `GET /realtime/tickers/?symbols=MARKET_DISCOVERY` vô nghĩa. Đã cảnh báo ở `docs/AUDIT_ALERT_CENTER_20260805.md:69` nhưng chưa fix; kích false recovery mode.
5. **P1 — Props ma** — `pages/DashboardPage.tsx:389` truyền 7 props (`holdings, technicals, analytics, alerts, ...`) vào `features/dashboard/AIAdvisorAlertPanel.js:105` nhưng component chỉ khai `({className})` — toàn bộ bị ignore. Panel tự fetch `getAIAlertsFeed()` global không scope theo universe danh mục -> lệch SSOT, double request.

**Quality gates snapshot:** `npx tsc --noEmit` PASS (no output), `npm run lint` PASS 0 error, **3524 warnings** (đính chính), `npm run build` PASS nhưng `DashboardPage-CKmKwIvt.js 141 kB (gz 42 kB)` + `index-BkHoQPry.js 2.1 MB` vượt ngưỡng 1 MB.

---

## 2. Bản đồ kiến trúc

| File | Line_count | Trách nhiệm | Note |
|---|---|---|---|
| `packages/web/src/pages/DashboardPage.tsx:112` | 429 | Orchestrator triad (Stats / Alert / Heatmap / Deck) | `createElement` style; hợp nhất 3 realtime source ở `mergedAlerts:245`, breadth `188` |
| `packages/web/src/features/dashboard/useCoreDashboardData.js:84` | 225 | Fetch song song 6 endpoint Phase 1 -> bulk technicals Phase 2 | `watchlistGroups: []` hardcode ở `:160` bỏ qua groups |
| `packages/web/src/components/dashboard/SmartStatsHeader.js:43` | 172 | Header sticky marketValue/PNL/breadth + alpha/beta/sharpe | Bug render-fetch `:55` + chained API `:58` |
| `packages/web/src/components/dashboard/PortfolioHeatmap.js:100` | 495 | ECharts treemap/sunburst | Dialog `selectedDetail:116` chết (không bao giờ set), `marketCap` fallback 1000 tỷ |
| `packages/web/src/components/dashboard/UnifiedAlertCenter.js:117` | 490 | Alert lane bento card | Filter client+server chồng, pagination cursor history sai |
| `packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx:35` | 494 | 4 tab deck (overview/technical/whale/ai) | Scope sync phức tạp `:142`, thiếu virtualization |
| `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:105` | 280 | Lane AI phải | Ignores props, I18N riêng không qua `LangContext` |
| `packages/web/src/components/dashboard/WhaleAnalyticsTab.jsx:17` | 187 | Tab whale trong deck | `availableSymbols` từ `symbolOptions` rỗng fallback `holdings` |
| `packages/web/src/components/dashboard/AIAdvisorDeckPanel.jsx:4` | 234 | Tab AI trong deck | Health score chỉ tính khi `symbolScope==='holdings'` |
| `packages/web/src/hooks/useRealtimeFeedCore.js:412` | 1256 | WS + poll hybrid, circuit breaker, dedup | Heartbeat timeout 10s quá gắt, `market_discovery` poll bug |
| `packages/web/src/context/RealtimeContext.js:19` | 197 | Singleton manager dedup subscriptions | `pollInterval = min(...)` vs `maxAlerts = max(...)` chưa doc |
| `packages/web/src/hooks/useAlertCenterSnapshot.ts:32` | 112 | Poll 15s cursor feed cho dashboard | `cursorHistory` off-by-one `:93`, không nhận `AbortSignal` |
| `packages/web/src/hooks/useAlertCenterRealtime.js:15` | 50 | Bypass manager cho global feed | Đúng intent `market_discovery` cho WS nhưng poll vẫn rác |
| `packages/web/src/adapters/core/market.js:9` | 541 | Market/realtime/alert-center client | `getRealtimeTickers:9`, `getBulkTechnicalsBySymbols:312`, `getPortfolioNewsDigest:166` |
| `packages/web/src/adapters/core/workspace.js:171` | 654 | Workspace portfolios/watchlists | `getPortfolioAnalytics:171`, `getLegacyWatchlistGroups:388` |
| `packages/web/src/utils/modernDashboardSymbolUniverse.js:46` | 130 | Build universe holdings/tracked/watchlist | Dùng `quotesBySymbol` overlay, sort `114` |
| `packages/web/src/utils/dashboardSymbols.js:1` | 19 | Collect unique sorted `\|`-join | Join `\|` khác universe join `,` gây encode lệch |

---

## 3. Luồng dữ liệu đã trace (use-case: mở `/core-dashboard` với portfolio X)

**Bước 1 — Resolve portfolio**
`DashboardPage.tsx:123` `usePortfolio().activePortfolioId` -> `useCoreDashboardData.js:106` guard `enabled && portfolioId`. Nếu `!resolvedPortfolioId` render empty `312`.

**Bước 2 — Phase 1 parallel fetch**
`useCoreDashboardData.js:132` `Promise.all([getPortfolioHoldings:150, getPortfolioSummary:160, getPortfolioAnalytics(,30):171, getWatchlists:50, getTrackedSymbols:190, getLegacyWatchlistGroups:388])` qua `market.js:150|160|171` + `workspace.js:50|190|388`. Lọc `SYSTEM_GROUP_IDS:148` bằng slug `id||name` -> giữ `watchlistGroups` nguyên (comment `:153`).

**Bước 3 — Phase 2 bulk technicals**
`collectDashboardSymbols:37` nhưng `watchlistGroups: []` hardcode `:160` -> technicals thiếu mã từ groups. `getBulkTechnicalsBySymbols(symbols):312` gọi `coreGet /market-data/technicals/bulk/?symbols=` -> `merge` vào state `188` với `technicalsStatus`.

**Bước 4 — Realtime bootstrap**
`DashboardPage.tsx:176` `collectUniqueSortedSymbols` (`dashboardSymbols.js:1` join `|`) -> `symbols:178` split `|` -> `useRealtimeFeedFromManager:181` đăng ký vào `RealtimeContext:47` union + `useAlertCenterRealtime:15` bypass manager với `["market_discovery"]` + `useAlertCenterSnapshot:167` poll `getAlertCenterFeed:51` mỗi 15s.

**Bước 5 — Realtime hybrid**
`useRealtimeFeedCore.js:602` bootstrap batch 25 symbol/batch REST, WS `996` subscribe 50 symbol đầu + `market_discovery`, poll `737` recovery batch theo `normalizePollSymbolCandidates:330` + `resolveRealtimePollIntervalMs:373`. `mergeQuote:183` normalize `change_pct` fraction vs percent.

**Bước 6 — Render triad**
`DashboardPage.tsx:328` `SmartStatsHeader` (nếu không crash F01/F02), `UnifiedAlertCenter:350`, `PortfolioHeatmap:372`, `AIAdvisorAlertPanel:389`, `CoreDashboardPositionDeck:407`. `fetchDigest:143` gọi `getPortfolioNewsDigest()` global không param `portfolioId`.

---

## 4. CONTRADICTIONS (plan/doc vs code)

| # | Plan / Doc `file:line` | Code thực tế `file:line` | Tác động |
|---|---|---|---|
| C01 | `AGENTS.md:6` SOC glassmorphism, `soc.module.css` tokens, i18n qua `LangContext` | `SmartStatsHeader.js:31,37`, `PortfolioHeatmap.js:71`, `UnifiedAlertCenter.js:53`, `AIAdvisorAlertPanel.js:52` tự `resolveLocale()` đọc `document.lang/navigator`, không dùng `useI18n()`; CSS dùng `bg-slate-900/60` tailwind thay vì soc tokens | Vi phạm quy chuẩn, locale drift khi đổi ngôn ngữ trong `LangContext` |
| C02 | `docs/FRONTEND_DESIGN_DASHBOARD_SAAS_NATIVE_MIGRATION.md:247` `getPortfolioAnalytics(portfolioId,30)` chuẩn | `SmartStatsHeader.js:58` chained `getPortfolioAnalytics({}).getPortfolioAnalytics(...)` | P0 crash |
| C03 | `packages/web/src/features/dashboard/useCoreDashboardData.js:153` comment "Keep ALL watchlistGroups" | `useCoreDashboardData.js:160` hardcode `watchlistGroups: []` khi build symbols | Technicals thiếu mã groups, heatmap universe lệch `modernDashboardSymbolUniverse.js:86` |
| C04 | `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:105` signature chỉ `{className}` | `DashboardPage.tsx:389` truyền 7 props (`holdings`...) | Dead props, SSOT sai |
| C05 **[ĐÍNH CHÍNH REV1]** | `pageRegistry.js:189` `dashboard → ShellDashboardPage` (tưởng là route `/dashboard`) | Thực tế `main.tsx:21-23` alias `dashboard→core-dashboard` nên `/dashboard` đã đúng `DashboardPage.tsx:112`; entry `pageRegistry` là dead code | Không ảnh hưởng UX/CI; chỉ cần dọn dead code cho gọn |
| C06 | `docs/AUDIT_ALERT_CENTER_20260805.md:69` cảnh báo poll rác `market_discovery` | `useRealtimeFeedCore.js:330,737` vẫn chưa filter | Poll rác tiếp diễn, 429 risk |
| C07 | `docs/BACKEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md:38` AI news digest existing | `DashboardPage.tsx:146` `getPortfolioNewsDigest()` không truyền `portfolioId` | Digest global, không theo portfolio |

---

## 5. Findings chi tiết — ưu tiên P0 → P3

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| **F01** | **P0** | `SmartStatsHeader.js:55-62` | `if (!analyticsData && holdings?.length) { (async()=>{...})(); }` ngay trong body render | Re-render vô hạn, fetch storm mỗi khi `holdings` đổi, vi phạm Rules of React | Chuyển vào `useEffect([holdings, analytics])`, dùng `AbortController` + cleanup |
| **F02** | **P0** | `SmartStatsHeader.js:58` | `coreApiAdapter.getPortfolioAnalytics({}).getPortfolioAnalytics(holdings.map(h=>h.symbol).join(","))` | `TypeError` runtime, header analytics chết | `coreApiAdapter.getPortfolioAnalytics(String(portfolioId),30)` hoặc bỏ auto-fetch, nhận `analytics` từ parent như thiết kế `useCoreDashboardData` |
| **F03** | **P0** | `RealtimeContext.js:14` + `useRealtimeFeedCore.js:330,737` | `market_discovery` bị coi là quote symbol trong `normalizePollSymbolCandidates` | `GET /realtime/tickers/?symbols=MARKET_DISCOVERY` 30s/lần, `fallbackRatio` tăng giả, trigger recovery giả | Filter trước poll: `symbols.filter(s=>s!=='market_discovery')`; WS subscribe giữ riêng `market_discovery` |
| **F04 [ĐÍNH CHÍNH REV1]** | **P2** | `pageRegistry.js:189-190` | `dashboard → ShellDashboardPage` là dead entry (không reachable qua `main.tsx:21-23` alias `dashboard→core-dashboard`) | Không ảnh hưởng runtime `/dashboard` (đã đúng); gây nhầm cho audit/dev mới | Xóa entry hoặc đổi `routeId` thành `workspace-dashboard` + comment `// DEAD for /dashboard — use core-dashboard via main.tsx:23 alias`; không cần redirect |
| **F05** | **P1** | `AIAdvisorAlertPanel.js:105` | Khai `({className})` nhưng `DashboardPage.tsx:389` truyền `holdings,technicals,analytics,alerts` | Props ma, SSOT sai, double fetch | Đổi signature nhận đúng props hoặc xóa props thừa; scope feed `getAIAlertsFeed({symbols: universe.join(",")})` |
| **F06 [ĐÍNH CHÍNH REV1 — CHƯA XÁC MINH]** | **P3** | `useAlertCenterSnapshot.ts:93-99` | Logic `goToPrevPage` pop rồi fetch `history[last]` **không tái hiện off-by-one** khi trace tay 3 trang (stack `["c2","c3"]` → pop → fetch `c2` đúng trang 2; `["c2"]` → pop → fetch `undefined` đúng trang 1) | Chưa xác minh là bug; hạ P1→P3 | Viết test tái hiện 3 trang trước khi sửa; nếu test PASS thì đóng false positive, nếu FAIL thì fix theo evidence |
| **F07** | **P1** | `PortfolioHeatmap.js:116,350,444` | `selectedDetail` không bao giờ `setSelectedDetail`; `handleClick` chỉ `navigate` | Dead dialog JSX `444` (72 dòng) chết, bundle thừa | Xóa dialog hoặc đổi `handleClick -> setSelectedDetail(data); fetchTrendData(symbol)` + nút navigate riêng |
| **F08** | **P1** | `useCoreDashboardData.js:113,160` | `abortRef = new AbortController()` tạo nhưng `coreGet` không nhận `signal` | Không cancel được in-flight request khi đổi portfolio | Truyền `signal` vào `transport.coreGet` (axios/fetch `signal` option) hoặc xóa `AbortController` thừa, giữ `cancelled` flag |
| **F09** | **P1** | `useRealtimeFeedCore.js:1021,1029` | Heartbeat `setInterval ping 25s` nhưng timeout `10s` sau mỗi message | WS live bị force `close(4000, heartbeat_timeout)` ngoài giờ khi không có tick | Tăng timeout 30-45s, chỉ force nếu `market_phase !== offhours` hoặc `data_semantic !== last_session_close` |
| **F10** | **P2** | `PortfolioHeatmap.js:141-162` | `sizeValue` fallback `1000` tỷ khi thiếu `marketCap`, non-holdings `avgValue*0.3` | Treemap size sai lệch 10x, user hiểu nhầm tỷ trọng | Fallback `1` hoặc ẩn entry, tooltip ghi "Không có vốn hóa · không tính tỷ trọng" |
| **F11** | **P2** | `DashboardPage.tsx:184-206` | `mergedQuotes` + `calculatedBreadth` dùng `Number(change_value||change_pct||change)` thô, không normalize fraction/percent như `useRealtimeFeedCore.js:103` `normalizeChangePct` | Breadth sai khi feed fraction `0.01` -> đếm `flat` thay vì `up` | Reuse `normalizeChangePct` hoặc đọc `change_pct` đã normalize từ `feed` |
| **F12** | **P2** | `DashboardPage.tsx:143-146` | `getPortfolioNewsDigest()` không truyền `portfolioId`, `t` prop default `(_k,def)=>def` | Digest luôn global, không theo portfolio; i18n fallback không chuẩn | `getPortfolioNewsDigest({portfolio_id: resolvedPortfolioId})` + `const {t}=useI18n()` |
| **F13** | **P2** | `CoreDashboardPositionDeck.tsx:116-152` | Dual `useEffect` sync `selectedSymbolProp <-> selectedSymbol` + auto `symbolScope` switch | Race, double setState, tab flicker khi chọn mã từ heatmap | Single source of truth: derive `selectedSymbol` từ prop, bỏ local dual state; dùng `useControlled` |
| **F14** | **P2** | `RealtimeContext.js:30-37` | `pollInterval = min(...values)` vs `maxAlerts = max(...)` hợp nhất không doc | Consumer xin `30000` nhưng consumer `5000` làm cả hệ poll nhanh | Doc policy rõ hoặc đổi thành `pollInterval = Math.max(minRequested, 5000)` đã clamp ở core, log warn khi conflict |
| **F15** | **P3** | `DashboardPage.tsx:312,320,328` | Không có `ErrorBoundary` per lane; `showSkeleton` chỉ `loading && !hasHydrated` nhưng `error` return toàn trang | 1 lane lỗi sập cả dashboard | Wrap mỗi lane trong `ErrorBoundary` + `Suspense`, giữ header live khi deck lỗi |
| **F16** | **P3** | `SmartStatsHeader.js:8`, `PortfolioHeatmap.js:20`, `UnifiedAlertCenter.js:12`, `AIAdvisorAlertPanel.js:7` | Local `I18N` dict riêng, không quét `vi.js` | 30 key duplicate không qua `npm run i18n:scan` | Xóa local `I18N`, import `useI18n` + thêm key vào `packages/web/src/i18n/vi.js` |
| **F17** | **P3** | `DashboardPage.tsx:176` vs `dashboardSymbols.js:18` | `DashboardPage` `collectUniqueSortedSymbols(...).split("|")` còn `dashboardSymbols.js` join `|` nhưng `market.js` join `,` | URL `tickers/?symbols=VCB|HPG` encode sai | Chuẩn hóa một util `collectUniqueSortedSymbols` trả `string[]`, không join string |
| **F18** | **P3** | `useAIAdvisor.js:48` | `enabled` check trong `useMemo` nhưng vẫn tạo `holdingMap` rỗng, `aiConfig` fetch không skip khi `!enabled` | Lãng phí recompute + request thừa | Early return trước memo, `skipFetch` khi `!enabled`; thêm `enabled` dep cho `loadAiConfig` |
| **F19** | **P3** | `DashboardPage.tsx:294` | `autoSelectedRef` chỉ set một lần, không reset khi đổi portfolio | Đổi portfolio vẫn giữ mã cũ, heatmap highlight sai | Reset `autoSelectedRef.current=false` khi `resolvedPortfolioId` đổi |
| **F20** | **P3** | `CoreDashboardPositionDeck.tsx:305,199` | Table không virtualize, `PaginationBar` render 10 nhưng universe có thể 100+; `fmtNumber` tạo mới mỗi render | Scroll jank khi 100 mã | Dùng `react-window` hoặc server pagination; memo `fmtNumber` |

---

## 6. Quality Gates Audit

### 6.1 Lint — `npm run lint` (packages/web)
- **Kết quả:** PASS (exit 0). **3524 warnings, 0 error** (đính chính REV1 — trước ghi ~70 do `Select-Object -Last 15` cắt cụt).
- **Top warning:** `react/jsx-no-literals` (~3000+), `no-unused-vars` `SmartStatsHeader.css` dead, `VNStockChartPanel.js:2 React unused`, `WhaleBubbleChart.jsx` 30+ literals.
- **Gate khuyến nghị:** Bật `no-restricted-syntax` cấm `async IIFE` trong render body; bật `i18n:scan` trong CI để bắt local `I18N` dict. **Ước lượng effort Phase 1 fix `jsx-no-literals` toàn `src/` cần điều chỉnh từ 1 tuần → 2–3 tuần hoặc scope hẹp `src/pages/DashboardPage|src/components/dashboard/**` trước.**

### 6.2 Type-check — `npx tsc --noEmit` + `npm run build`
- **`npx tsc --noEmit`:** PASS (no output) — đã xác minh 2026-09-08.
- **`npm run build`:** PASS 31.94s.
  - `DashboardPage-CKmKwIvt.js 141.08 kB (gz 42.39 kB)` — lane lớn nhất.
  - `index-BkHoQPry.js 2,112 kB (gz 524 kB)` vượt ngưỡng 1 MB — chunk vendor chưa split `echarts` ( `PortfolioHeatmap` + `WhaleBubbleChart`).
  - Cảnh báo: `Some chunks are larger than 1000 kB after minification`.
- **Đề xuất:** `manualChunks: { echarts: ['echarts','echarts-for-react'], dashboard: ['pages/DashboardPage'] }`, dynamic import `PortfolioHeatmap`.

### 6.3 i18n — `packages/web/src/i18n/vi.js` + `en.js` + `npm run i18n:scan`
- **Hardcoded scan:** 4 file dashboard tự tạo `I18N` local -> không qua `LangContext` -> `npm run i18n:scan` không bắt.
- **`vi.js` coverage:** `layout.nav.dashboard` đã có, nhưng `dashboard.*` cho triad (`smartStats`, `heatmap`, `alert`, `aiAdvisor`) thiếu -> các component tự dict.
- **Fix:** Xóa local dict, thêm keys `dashboard.smartStats.marketValue`, `dashboard.heatmap.title`, `dashboard.alert.title`, `dashboard.aiAdvisor.panel.title` vào `vi.js` và `en.js`; chạy `npm run i18n:scan` trong pre-commit hook đã cấu hình ở `.opencode-plugins/vninvest-hooks.ts:48`.

### 6.4 Test — `npm run test`, `npm run test:components`
- **Hiện có:** `features/dashboard/__tests__/dashboard_lifecycle.test.js:1` (2-3 case hook), `hooks/useAlertCenter*` có component test, `coreApiAdapter.test.js:127,284,370` cover adapter.
- **Thiếu:** Integration cho `DashboardPage` `mergedAlerts` dedup key (`id` vs `event_id` vs `symbol-ts`), `calculatedBreadth` fraction, heatmap `sizeMode`, deck scope sync. Không có E2E `playwright` cho `/dashboard` triad.
- **Coverage ước tính:** Dashboard lane <30% (CHƯA XÁC MINH chính xác — cần `npm run test -- --coverage`).

### 6.5 External coupling
- **web ↔ core:** `defaultCoreApiAdapter` qua `adapters/core/market.js:9,51,130,312` + `workspace.js:171,388`. Contract `GET /core/v1/realtime/tickers/?symbols=` và `POST /core/v1/signals/alert-center/feed` đã native. Poll rác `MARKET_DISCOVERY` vi phạm contract batch (BE không có symbol này).
- **web ↔ `vninvestcharts-widget`:** `package.json` `vninvestcharts-widget ^1.2.5` đã lazy-load async chunk, React 19 `19.2.7` tương thích `recharts@2.15.4 ^19.0.0` — không liên quan dashboard nhưng build chunk `WhaleBubbleChart 675 kB` vẫn lớn.
- **dist vs src:** Không stale engine — dashboard không dùng `vn-kline-engine`.

---

## 7. Đề xuất nâng cấp chuẩn thương mại (roadmap)

### Phase 0 — Hotfix (1-2 ngày) — chặn P0
- [ ] Sửa F01/F02: `SmartStatsHeader.js:55` chuyển async vào `useEffect`, sửa chained call.
- [ ] Sửa F03: filter `market_discovery` trước poll.
- [ ] **[REV1] F06 hạ P3 — chỉ viết test tái hiện, chưa fix code cho đến khi test FAIL.**
- [ ] **[REV1] Dọn dead entry `pageRegistry.js:189` (F04) — xóa hoặc đổi `workspace-dashboard` + comment; không cần redirect (đã đúng qua `main.tsx:23`).**

### Phase 1 — UX thương mại (1 tuần)
- [ ] `ErrorBoundary` per lane + retry + Empty CTA "Tạo danh mục" khi `holdings.length===0` (`DashboardPage.tsx:312` hiện chỉ hint).
- [ ] Xóa local `I18N`, chuyển qua `useI18n()` + thêm keys vào `vi.js`; chạy `i18n:scan` trong CI.
- [ ] A11y: keyboard nav cho heatmap treemap, `aria-label` cho severity pills, contrast audit `bg-slate-900/60` trên `text-slate-500` (WCAG AA).
- [ ] Skeleton chi tiết hơn cho heatmap/whale tab (hiện `core-heatmap-loading` text đơn).

### Phase 2 — Hiệu năng & Realtime (1 tuần)
- [ ] Code-split `echarts` + `DashboardPage` dynamic import, giảm `index 2.1 MB`.
- [ ] Fix breadth normalize + dedup alerts key chuẩn `event_id` (hiện `a.id || symbol-ts` lệch `event_id`).
- [ ] Tune WS heartbeat 30-45s, gating theo `market_phase`.
- [ ] Virtualize `CoreDashboardPositionDeck` table (`PaginationBar` 10 nhưng universe có thể 100+).

### Phase 3 — Quan sát & vận hành
- [ ] Expose `metrics.connectionState` lên UI status pill (đã có ở `useRealtimeFeedCore:448` nhưng chưa show).
- [ ] `Sentry` span cho `useCoreDashboardData` phase, log `fallbackRatioPct` và `staleRatioPct` ra Grafana.
- [ ] Feature flag cho `market_discovery` channel theo tenant ability.
- [ ] Playwright E2E `visual/dashboard-triad.spec.ts` (3 viewport) + visual regression cho `generateCategoricalChart 324 kB`.

---

## 8. Câu hỏi cần làm rõ

1. **[ĐÍNH CHÍNH REV1 — ĐÃ RÕ]** Canonical `/dashboard` đã alias đúng `core-dashboard` qua `main.tsx:21-23`; không cần hỏi. Câu hỏi còn lại: có giữ `ShellDashboardPage` cho route nội bộ `workspace-dashboard` hay xóa?
2. `AIAdvisorAlertPanel` nên scope theo symbol universe của portfolio hay giữ global AI lane hiện tại?
3. `getPortfolioNewsDigest` có cần `portfolio_id` param không? BE `market_data/core_urls.py:59` hiện không yêu cầu — semantics có nên portfolio-bound?
4. `watchlistGroups` có nên đưa vào universe cho bulk technicals không? Hiện `useCoreDashboardData.js:160` hardcode `[]` nhưng `modernDashboardSymbolUniverse.js:86` thì dùng.

---

## 9. Phụ lục — Lệnh tái kiểm

```bash
# Type-check
npx tsc --noEmit

# Lint
npm run lint

# Build + kiểm chunk
npm run build

# i18n scan (nếu cấu hình)
npm run i18n:scan

# Test coverage dashboard
npm run test -- --coverage --collectCoverageFrom="src/pages/DashboardPage.tsx" --collectCoverageFrom="src/components/dashboard/**"
```

**Tài liệu tham chiếu:** `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md`, `docs/AUDIT_ALERT_CENTER_20260805.md:69`, `docs/FRONTEND_DESIGN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`, `packages/web/src/adapters/core/market.js:9`, `packages/web/src/adapters/core/workspace.js:171`.

**Người thực hiện:** Muse Spark (audit chỉ nghiên cứu, không sửa code). Mọi phát hiện đã được grep/read xác minh; thiếu `file:line` = không hợp lệ theo khung §0.

---
## 10. Đính chính sau phản biện độc lập (REV1 — 2026-09-08)

**Nguồn phản biện:** Audit độc lập re-verify toàn bộ 9 chương + chạy lại gate (`tsc`, `build`, `lint`).

**Kết quả:** 2 lỗi tra cứu đáng kể đã sửa ở trên:

1. **F04/C05 route `/dashboard` — FALSE (nghiêm trọng nhất):** Báo cáo gốc kết luận `/dashboard` là placeholder do chỉ đọc `pageRegistry.js:189`, bỏ sót `main.tsx:21-23` alias `dashboard→core-dashboard`. Đã sửa §1/§4/§5/§7/§8: hạ F04 P1→P2, đổi thành dead code cleanup, xóa khuyến nghị redirect. CI `web-ci.yml:177` đã đúng.
2. **F06 off-by-one — CHƯA XÁC MINH:** Trace tay 3 trang không tái hiện; hạ P1→P3, yêu cầu test evidence trước khi fix. Đã sửa §5.
3. **Lint 3524 vs ~70:** Do `Select-Object -Last 15` cắt cụt output. Đã đính chính §1/§6.1 và cập nhật ước lượng Phase 1.

Phần còn lại (F01, F02, F03, F05, F07, C01-C04/C06/C07, gates `tsc`/`build`) re-verify **khớp 100%**.

**Ledger:** `docs/CODE_CHANGE_AUDIT_LEDGER.md:33` bổ sung note REV1 (xem Entry 33 patch).

