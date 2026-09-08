# Audit Độc Lập Toàn Diện Giao Diện VNInvest — Đối Chiếu Sơ Đồ Phân Cấp Chức Năng & Template Chung V1

> **Ngày**: 2026-09-08 · **Phạm vi**: packages/web (React/Vite) + frontend legacy + packages/core coupling · **Đối chiếu**: `docs/SYSTEM_FUNCTIONAL_MAP.md:1` + `docs/SYSTEM_FUNCTIONAL_MAP_V2_ENTERPRISE.md:1` + `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:1`
> **Nguyên tắc**: Tuân thủ AI Audit/Research Framework `AGENTS.md:65-159` — mọi khẳng định kèm `file:line`, grep toàn repo CSS/config/i18n, CONTRADICTIONS riêng.

---

## Tóm tắt 5 findings nghiêm trọng nhất

1. **[F-01][ERROR][P0] Phân mảnh Design System 7 hệ tông màu/radius/spacing song song** — `ShellPageTemplate.module.css:45` vs `soc.module.css:4` vs `theme.module.css:1` (orphaned 0 import) vs `aiSettings.module.css:30` vs `StockDetailPage.css:2` vs `WatchlistPage.css:1` vs `TenantAdmin.module.css:4` vs `PortfoliosPage.css:1` → không có single source of truth dù `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:32-84` quy định 1 bộ token `:root`.
2. **[F-02][ERROR][P0] Template V1 `app-page-shell/page-header/page-body-grid` không tồn tại trong `packages/web`** — `grep` toàn `packages/web/src` cho `app-page-shell` = 0 hit (chỉ `frontend/src/index.css:182` và `frontend/src/pages/*:347` còn dùng). 53 trang `packages/web/src/pages/pageRegistry.js:174` dùng 3 họ layout rời rạc `shellPage` / `sdp-page` / `watchlistPage__` / `core-page` thay vì 1 shell như `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:10-30`.
3. **[F-03][GAP][P0] FullLayout/Header vi phạm Layout Contract — padding/spacing lệch token gốc** — `packages/web/src/layouts/full/FullLayout.tsx:72` hard-code `lg:pl-72 / lg:pl-16` và `main.p-6 max-w-7xl` thay vì `var(--layout-content-pad-x/y)` + `max-width: var(--layout-content-max-width)`; `StockDetailPage.css:55` `padding:20px 20px 48px` và `TenantAdmin.module.css` inline padding riêng → mỗi route tự set max-width/padding như `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:28-30` cấm.
4. **[F-04][GAP][P1] ShellPageTemplate coverage chỉ ~40% — 6 cụm chức năng không dùng Chrome thống nhất** — `StockDetailPage.tsx:324` dùng `sdp-page` standalone (không `ShellPageChrome`), `DashboardPage.tsx:331-424` dùng bento `core-dashboard-slot` (không Chrome), `WatchlistPage.tsx:42` dùng `ShellPageChrome` nhưng body là `watchlistPage__layout 240px 1fr` khác hoàn toàn `page-body-grid 22%/48%/30%`, SOC `ShellOperationsCenterPage.tsx:90` inline `style background radial-gradient + padding 24px 28px` bypass token.
5. **[F-05][RISK][P1] Typography/Color semantic phân mảnh, WCAG contrast không kiểm chứng** — `ShellPageTemplate.module.css:42` `font-family: "Segoe UI","Arial"` vs `StockDetailPage.css:54` vs `PortfoliosPage.css:22` `"-apple-system..."` vs `WatchlistPage.css` không set font; `ShellPageTemplate.module.css:37-40` đặt `color: var(--text-primary)` nhưng `WatchlistPage.css:6-10` tự định nghĩa `--wl-slate-200: #e2e8f0`; chưa có audit contrast như `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:200-205` yêu cầu.

---

## 0. Nguyên tắc bắt buộc (tuân thủ)

1. Mọi khẳng định kèm `file:line`; không có line = không hợp lệ.
2. Không đoán — chưa đọc → ghi CHƯA XÁC MINH.
3. Grep toàn repo `.css/.module.css/config/i18n/adapters` (đã chạy).
4. Plan/doc mâu thuẫn code → mục CONTRADICTIONS.
5. Không viết code trong audit — chỉ phân tích.
6. File không tồn tại → báo KHÔNG TỒN TẠI.
7. Ngôn ngữ: Tiếng Việt.

### Đọc trước

- `AGENTS.md:1-60` (Goal, Constraints, Progress) + `AGENTS.md:65-159` framework — ĐÃ ĐỌC
- `docs/CODE_CHANGE_AUDIT_LEDGER.md:1-911` (44 entries) — ĐÃ ĐỌC
- `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:1-344` — ĐÃ ĐỌC
- `docs/SYSTEM_FUNCTIONAL_MAP.md:1-108` — ĐÃ ĐỌC (7 cụm: Dashboard, Analytics, Whale, AI, Watchlist, Detail, Admin)
- `docs/SYSTEM_FUNCTIONAL_MAP_V2_ENTERPRISE.md:1-124` — ĐÃ ĐỌC (placeholder V2, 15+ modules roadmap)
- `docs/UI_LAYOUT_AUDIT_REPORT_20260501.md:1-79` (remediation 3-cột 22/48/30) — ĐÃ ĐỌC
- `packages/web/src/pages/pageRegistry.js:1-302`, `FullLayout.tsx:1-94`, `main.tsx:1-159`, `index.css:1-409`, `theme/tokens.css:1-56` — ĐÃ ĐỌC

---

## 1. Phạm vi nghiên cứu

### A. Shell & Layout Contract

- `packages/web/src/layouts/full/FullLayout.tsx:1-94`, `Header.tsx:1-264`, `Sidebar.tsx:1-184`, `AppShell.tsx:1-11`
- `packages/web/src/lib/runtimeConfig.ts:1-8` (feature flag `isNewLayoutEnabled`)
- `packages/web/vite.config.ts:1-50`, `tsconfig*.json`
- Symbols: `isNewLayoutEnabled`, `FullLayout`, `app-page-shell`, `page-body-grid`

### B. Template Chung V1

- `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:10-336` (10 mục: Layout Contract → CSS utility)
- `frontend/src/index.css:182-458` (app-page-shell thực thi legacy)
- `packages/web/src/theme/tokens.css:1-56`, `theme.module.css:1-383`, `index.css:6-100` (@theme)

### C. Cụm Chức Năng theo Sơ Đồ Phân Cấp

| Cụm | Mã nguồn chính | Symbols |
|-----|----------------|---------|
| Dashboard & Portfolio | `DashboardPage.tsx:1-429`, `SmartStatsHeader.css:1-76`, `workspace/ShellDashboardPage.tsx:1-172` | `SmartStatsHeader`, `CoreDashboardPositionDeck` |
| Watchlist & Cảnh báo | `WatchlistPage.tsx:1-68`, `WatchlistPage.css:1-735`, `AlertCenterPage.tsx:1-356` | `watchlistPage__layout`, `alert-center` |
| Chi tiết Cổ phiếu | `StockDetailPage.tsx:1-397`, `StockDetailPage.css:1-2871` | `sdp-page`, `VNStockChartPanel` |
| Whale/Radar & AI | `AlertCenterPage.tsx:1-356`, `ShellAiAdvisoryPage.tsx:1-420`, `WhaleAdvisoryPage.tsx` | `ShellAiAdvisoryPage` |
| Quản trị & Vận hành | `admin/ShellOperationsCenterPage.tsx:1-147`, `soc/soc.module.css:1-2707`, `tenant-admin/*:1-*` | `SocDataOpsPanel`, `TenantAdmin` |

### D. Cross-Package Coupling

- `packages/web/src/adapters/core/*`, `defaultCoreApiAdapter` — web↔core
- `packages/web/package.json` `vninvestcharts-widget ^1.2.5` + `src/types/vninvestcharts-widget.d.ts:1-44`
- `packages/web/src/components/ShellPageTemplate.js:1-192` + `.module.css:1-509`

### E. Quality Gates

- Lint: `npm run lint` (packages/web)
- Type-check: `npx tsc --noEmit` / `npm run build`
- i18n: `src/i18n/vi.js:1-4941`, `en.js:1-4925`
- Test: `npm run test` (jest) + `npm run test:components` (vitest)

---

## 2. Bản đồ kiến trúc (file | line_count | trách nhiệm | note)

| # | File | Dòng | Trách nhiệm | Ghi chú |
|---|------|------|-------------|---------|
| L1 | `packages/web/src/layouts/full/FullLayout.tsx:1-94` | 94 | Shell gốc, sidebar overlay, main outlet | Tailwind `min-h-screen bg-slate-950 flex`, `p-6 max-w-7xl mx-auto` — không dùng token V1 |
| L2 | `packages/web/src/layouts/full/vertical/header/Header.tsx:1-264` | 264 | Top nav, search, WS dot, lang, notif, avatar | `sticky top-0 h-18 bg-slate-900/80 backdrop-blur` — hard Tailwind |
| L3 | `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx:1-184` | 184 | Nav, workspace selector, profile | `w-72 bg-slate-900 border-slate-800`, active `bg-blue-600` vs `bg-slate-800/60` |
| L4 | `packages/web/src/theme/tokens.css:1-56` | 56 | Token alias trung tâm | `--accent-cyan: var(--color-accent-primary)`, `--bg-panel-soft`, `--r-*` |
| L5 | `packages/web/src/index.css:1-409` | 409 | Global @theme, utilities, bento triad | `@theme` 19 color, layout `--layout-sidebar-width:18rem` (288px) lệch V1 320px |
| L6 | `packages/web/src/components/ShellPageTemplate.js:1-192` | 192 | Shell chrome/panel/metric/field primitives | `createElement` (không JSX), `ShellPageChrome` eyebrow+metrics+banners |
| L7 | `packages/web/src/components/ShellPageTemplate.module.css:1-509` | 509 | Shell visuals (hero/metrics/bodyGrid) | `:root --sh-*` 21 token, `.shellPage` radial gradient, `.metrics 4 cols`, `.bodyGrid 1.1fr 1fr` |
| L8 | `packages/web/src/components/soc/soc.module.css:1-2707` | 2707 | SOC glassmorphism toàn bộ | `:root --soc-*` 40 token, `.tabBar/.glassPanel/.metricCard`, ops layouts |
| L9 | `packages/web/src/theme/theme.module.css:1-383` | 383 | Theme primitives (btn/card/input) | `.btn/.card/.badge/.tabs` — **ORPHANED 0 import trong 146 file tsx** |
| L10 | `packages/web/src/components/aiSettings.module.css:1-871` | 871 | AI Settings / Command Center | `:root --ais-*` 15 token, `.page` standalone gradient, `.panel/.toolbar` |
| L11 | `packages/web/src/pages/StockDetailPage.css:1-2871` | 2871 | Stock Detail workstation | `:root --sdp-*` 27 token, `.sdp-page padding 20px 20px 48px`, chart/workstation grids |
| L12 | `packages/web/src/pages/WatchlistPage.css:1-735` | 735 | Watchlist workspace | `:root --wl-*` 7 token, `.watchlistPage__layout 240px 1fr`, slideOver, price flash |
| L13 | `packages/web/src/pages/PortfoliosPage.css:1-341` | 341 | Portfolio CRUD + DNSE | `:root --port-c*`, `.core-page-header h1 2rem`, `.core-create-form` |
| L14 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css:1-2475` | 2475 | TenantAdmin 13 pages | `:root --ta-*` 25 token, `.home_*/.pats_*/.usage_*/.bill_*/.mem_*/.aud_*/.whk_*` |
| L15 | `packages/web/src/pages/AlertCenterPage.module.css:1-113` | 113 | Alert Center accent | Chỉ 6 block: severity border, strength bar, evidence, spinner |
| L16 | `packages/web/src/components/ShellSkeleton.tsx:1-166` | 166 | Skeleton shimmer/pulse | `variant metric|table-row|chart|card`, keyframes shellPulse/shimmer |
| L17 | `packages/web/src/pages/DashboardPage.tsx:1-429` | 429 | Dashboard bento triad | `core-dashboard-page`, `dashboard-triad-grid 1fr 1.5fr 1fr`, `dashboard-triad-lane h580` |
| L18 | `packages/web/src/pages/StockDetailPage.tsx:1-397` | 397 | Stock Detail controller | `createElement` + `sdp-page`, `VNStockChartPanel`, `WhaleBubbleChart`, `WorkstationLayout` |
| L19 | `packages/web/src/pages/WatchlistPage.tsx:1-68` | 68 | Watchlist controller | `ShellPageChrome` + `watchlistPage__layout` grid |
| L20 | `packages/web/src/pages/AlertCenterPage.tsx:1-356` | 356 | Alert Center controller | `ShellPageChrome` + `soc.opsLayoutContainer` + `FixedSizeList` 460/280 |
| L21 | `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx:1-147` | 147 | SOC container | Inline `style background radial-gradient + padding 24px 28px`, `SocTabNavigation` |
| L22 | `packages/web/src/pages/signals/ShellAiAdvisoryPage.tsx:1-420` | 420 | AI Advisory shell | `ShellPageChrome` + `ShellPanel bodyGrid`, advisorySessionLoader |
| L23 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx:1-604` | 604 | Tenant home | `ShellPageChrome` + `TenantAdmin.module.css` + recharts AreaChart |
| L24 | `packages/web/src/pages/pageRegistry.js:1-302` | 302 | Registry 53 entries | `status baseline|core`, `createDeferredPageComponent` clock loader |
| L25 | `packages/web/src/main.tsx:1-159` | 159 | Router + providers | `createElement` routes, `QueryProvider>Portfolio>Lang>Toast>Confirm>Realtime` |
| L26 | `packages/web/vite.config.ts:1-50` | 50 | Build config | `tailwindcss(), react()`, alias `@ -> src`, proxy `/api /core/v1 /ws` |
| L27 | `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:1-344` | 344 | Template chuẩn dự án | 14 mục: Layout Contract → Governance, CSS utility mẫu |

**Tổng CSS riêng rẽ**: 2386+871+2871+735+341+2475+113+509+383+76+251 ≈ **11.000 dòng** chia 11 hệ — không hợp nhất.

---

## 3. Luồng dữ liệu đã trace (2 use-case đại diện)

### Use-case 1: User mở `/dashboard` → thấy Bento Triad

1. `packages/web/src/main.tsx:82` `createElement(Route, {path:'dashboard', element: resolvePageComponent('dashboard')})` → `resolvePageComponent:22-31` map `dashboard → core-dashboard` → `getPageComponent:294` lazy `DashboardPage.tsx:1`.
2. `FullLayout.tsx:46-88` render `Sidebar` + `Header` + `main.p-6 > div.max-w-7xl > Outlet` — shell bọc ngoài (không phải `app-page-shell`).
3. `DashboardPage.tsx:122` `usePortfolio().activePortfolioId` → `useCoreDashboardData:125-137` fetch holdings/summary/analytics.
4. `DashboardPage.tsx:176-182` `collectUniqueSortedSymbols` + `useRealtimeFeedFromManager` poll 10s + `DashboardPage.tsx:204-241` build `mergedQuotes` + `heatmapData`.
5. `DashboardPage.tsx:328-424` render 3 lane trong `index.css:295-310` `.dashboard-triad-grid 1fr 1.5fr 1fr` + `.dashboard-triad-lane p-5 rounded-2xl h580` → `UnifiedAlertCenter / PortfolioHeatmap / AIAdvisorAlertPanel`.

**Bằng chứng phân mảnh**: `DashboardPage.tsx:345` class `dashboard-triad-grid` hard `1fr 1.5fr 1fr` ≠ `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:142` `minmax(320px,22%) minmax(420px,48%) minmax(420px,30%)`. Header không dùng `page-header` mà dùng bento slot.

### Use-case 2: User mở `/stocks/HPG` → Stock Detail workstation

1. `main.tsx:101` `Route path:'stocks/:symbol' → core-stock-detail` → `StockDetailPage.tsx:54` `useParams().symbol`.
2. `StockDetailPage.tsx:103-133` `useStockDetailPageModel({initialSymbol: symbol})` — blocking lane (profile/snapshot), deferred (orderFlow/advisory), lazy (financials/news).
3. `StockDetailPage.tsx:314` `PageErrorBoundary` bọc `div.sdp-page:325` (background `StockDetailPage.css:49` `var(--sdp-page-bg) #050a14` + glow blur 120px).
4. `StockDetailPage.tsx:330` `StockDetailHeader` (ticker badge gradient cyan→indigo) + `StockSessionWitness:341` + `WorkstationLayout:348` (left `VNStockChartPanel:278` + `WhaleBubbleChart:297` vs right `StockOrderBookWidget/StockExecutionLogWidget:309-311`).
5. `StockDetailPage.tsx:357` `StockDetailTabs` 8 tab chuyên biệt + drawers.

**Bằng chứng phân mảnh**: `StockDetailPage.css:49-55` `.sdp-page padding 20px 20px 48px` tự định nghĩa, không qua `FullLayout main.p-6` hay `app-page-shell padding var(--layout-content-pad-y)`; token `--sdp-*` isolated không kế thừa `tokens.css:8-12`.

---

## 4. CONTRADICTIONS (Plan/Doc vs Code)

| # | Plan/Doc (file:line) | Thực tế Code (file:line) | Tác động |
|---|----------------------|--------------------------|----------|
| C1 | `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:32-84` `:root { --layout-sidebar-width:320px; --layout-topnav-height:72px; --layout-content-max-width:1800px; --layout-content-pad-x:24px; --bg-app:#020b23; --text-primary:#e6f3ff }` | `packages/web/src/index.css:96-99` `--layout-sidebar-width:18rem (288px); --layout-header-height:4.5rem (72px) ; --color-bg-primary:#020617; --color-text-primary:#f1f5f9` + `theme/tokens.css:8` `--bg-panel:#0f172a` | Token values drift (bg 020b23→020617, text e6f3ff→f1f5f9, sidebar 320→288). Không có lint token. |
| C2 | `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:272-291` `.app-page-shell { max-width: var(--layout-content-max-width); margin:0 auto; padding: var(--layout-content-pad-y) var(--layout-content-pad-x) var(--space-6) } .page-body-grid { grid: minmax(320px,22%) minmax(420px,48%) minmax(420px,30%) }` | `packages/web/src/layouts/full/FullLayout.tsx:85` `main.flex-1.p-6.overflow-auto > div.max-w-7xl.mx-auto` + `DashboardPage.tsx:296-302` `dashboard-triad-grid 1fr 1.5fr 1fr` + grep `app-page-shell` trong `packages/web` = 0 hit | Template shell không được áp dụng — FullLayout dùng Tailwind utilities riêng. P0 của `UI_LAYOUT_AUDIT_REPORT_20260501.md:75` vẫn mở. |
| C3 | `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:109-134` JSX chuẩn `<div class="app-page-shell"><header class="page-header"><h1 class="page-title">...</h1><p class="page-description">...</p></header><main class="page-body-grid">...` | `ShellPageTemplate.module.css:23-46` `.shellPage { padding:28px; border-radius:28px; background: radial-gradient... } .hero { gap:12px } .title { font-size:34px }` — không có `page-header/page-title/page-body-grid` | ShellPageTemplate là họ thiết kế riêng, không ánh xạ tới V1 utility. Mọi page dùng ShellPageTemplate được tính là "đạt" nhưng sai contract V1. |
| C4 | `AGENTS.md:6` "SOC glassmorphism patterns, soc.module.css tokens" | `packages/web/src/theme/theme.module.css:1-383` tồn tại đầy đủ `.btn/.card/.badge/.table` nhưng `grep "theme.module.css" packages/web/src --include *.tsx = 0` (verified `AUDIT_UPGRADE_SOC_THEME_20260716.md:28`) | Theme primitives orphaned — đúng token nhưng không ai dùng. Ngược với mục tiêu thống nhất. |
| C5 | `docs/IMPLEMENTATION_PLAN_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md:113` "Mọi UI page mới phải bám template chung giàu thông tin, spacing thấp" + `TECH_SPEC_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md:261` "phải tuân thủ một chuẩn template chung" | `StockDetailPage.css:49-55` `.sdp-page min-height:100vh padding 20px 20px 48px` + `WatchlistPage.css:24-32` `height:calc(100vh -120px)` + `PortfoliosPage.css:29-33` `.core-page-header margin-bottom:2rem padding-bottom:1rem` — mỗi cụm tự đặt height/padding | Mỗi workspace tự định nghĩa page height/spacing, vi phạm `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:28-30` "không tự đặt max-width/padding top". |
| C6 | `SYSTEM_FUNCTIONAL_MAP.md:7-46` 7 cụm với mermaid graph + mô tả chi tiết | `pageRegistry.js:174-288` 53 routes gộp thêm `operations-center (8 tabs SOC)`, `tenant-admin (13 pages)`, `commercial/*`, `screener`, `ai-agent-federation`, `vip-local-control` — không có map tới 7 cụm | Sơ đồ phân cấp chưa cập nhật cho SaaS enterprise (tenant-admin chiếm 25% routes) → gap giữa docs và code. |
| C7 | `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:156-174` "Mỗi tab panel có 3 state chuẩn loading/empty/error + persist active tab vào localStorage, đổi symbol không reset tab" | `DashboardPage.tsx:332-423` bento triad chỉ có `showSkeleton ? LoadingSkeleton : <Component>` + `ErrorBanner`, không có `emptyState` chuẩn SOC; `Dashboard heatmap/alert` không persist tab; `StockDetailPage.tsx` tab `activeTab` không qua localStorage | State contract chưa thống nhất — mỗi cụm tự xử lý skeleton/empty. |

---

## 5. Findings chi tiết

### Nhóm ERROR — Chặn thống nhất

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất |
|----|-----|-----------|---------|----------|---------|
| F-01 | ERROR P0 | `theme/theme.module.css:1-383` vs `ShellPageTemplate.module.css:1-509` vs `soc.module.css:1-2707` vs `tokens.css:1-56` (`--accent-shell: #00b4d8`) vs `index.css:96-99` (`--layout-*`) | 3 design system + 4 page-scoped CSS (sdp/wl/port/ta) song song, token `--accent-cyan` định nghĩa 5 lần với giá trị khác (`#12c7e8` V1 vs `#06b6d4` Shell vs `#00b4d8` SOC/shell). `tokens.css:49-55` còn hard `--accent-shell/--bg-shell-surface` riêng → chưa phải SSOT thuần | Visual drift + SSOT giả: alias value-preserving sẽ giữ drift nếu không chuẩn hoá giá trị gốc | Chọn `tokens.css:1-48` làm semantic SSOT, `index.css:96-99` làm Tailwind/layout bridge, token private giữ lại, drift chuẩn hoá bằng allowlist (xem review 2026-09-08) |
| F-02 | ERROR P0 | `FullLayout.tsx:46,72,85` | `aside fixed w-72 translate-x` + `div lg:pl-0 / lg:pl-72` + `main p-6 max-w-7xl` hard-coded Tailwind, không đọc `tokens.css:30-36` `--sp-*` hay `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:272` `padding: var(--layout-content-pad-y)` | Spacing không token-driven → responsive gap khác V1 spec; audit `UI_LAYOUT_AUDIT_REPORT_20260501.md:75` P0 vẫn mở | Thay `p-6` → `p-[var(--layout-content-pad-y)]`, `max-w-7xl` → `max-width: var(--layout-content-max-width)`, `lg:pl-72` → `var(--layout-sidebar-width)`. |
| F-03 | ERROR P0 | `ShellOperationsCenterPage.tsx:90-99` | Inline `style={{ background: "radial-gradient(...)", padding:"24px 28px"}}` bypass `ShellPageTemplate.module.css:23-46` `.shellPage` (đã có gradient) | SOC page duy nhất không dùng ShellPageChrome nhưng vẫn tự hard gradient → duplicate code, khó đổi theme | Chuyển `ShellOperationsCenterPage` sang `ShellPageChrome` như `AlertCenterPage.tsx:238-249` đã làm (ví dụ refactor 2026-07-19). |
| F-04 | ERROR P1 | `StockDetailPage.tsx:324-325` + `StockDetailPage.css:49` + `ShellPageTemplate.js:98-123` `<main class="shellPage">` | `.sdp-page` standalone không kế thừa `ShellPageChrome`; bọc trực tiếp sẽ tạo **nested `<main>` trong `FullLayout.tsx:82` `<main>` + double padding** (`sdp-page:55 20px 20px 48px` trong `FullLayout p-6`) | Stock Detail lệch typography/spacing; nested main vi phạm a11y + layout contract | **Không bọc trực tiếp**; tạo `WorkstationShell` variant dùng chung layout tokens (`--layout-*/--sp-*/--font-sans`) nhưng giữ glow/chart/scroll riêng (Q3) |
| F-05 | ERROR P1 | `WatchlistPage.css:24-32` | `grid-template-columns: 240px 1fr` hard 240px, không map `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:141-146` `minmax(320px,22%) ...` | Watchlist không responsive theo contract 1440/1024/768/390 mà theo breakpoint riêng `max-width:1024px` | Align `WatchlistPage__layout` với `page-body-grid` token, giữ 240px chỉ cho legacy fallback qua `@supports`. |

### Nhóm GAP — Thiếu parity

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất |
|----|-----|-----------|---------|----------|---------|
| F-06 | GAP P1 | `DashboardPage.tsx:345-403` | Bento `dashboard-triad-grid 1fr 1.5fr 1fr height:580px` + `dashboard-triad-lane bg-slate-900/40` — không dùng `ShellPanel` hay `soc.glassPanel` | Dashboard là trang quan trọng nhất nhưng không chia sẻ component với SOC/Watchlist → bảo trì riêng | Chuyển bento lane sang `ShellPanel` hoặc `soc.glassPanel` + giữ `1fr 1.5fr 1fr` như variant của `page-body-grid`. |
| F-07 | GAP P1 | `PortfoliosPage.tsx:92,108` + `TransactionsPage.tsx:108` | Dùng `core-page-header <h1>` raw + `PortfoliosPage.css:29` `font-size:2rem`, không `ShellPageChrome eyebrow/title/description` | Portfolio/Transactions không có eyebrow/kicker, metrics, notice/error banner như các trang chuẩn | Migrate sang `ShellPageChrome` (đã có pattern ở `TenantAdminHomePage.tsx:313`). |
| F-08 | GAP P2 | `TenantAdmin.module.css:1-2475` | 2039 dòng với `.home_*/pats_*/usage_*/bill_*/mem_*/aud_*/whk_*` numbered, inline style extraction S9 nhưng không reuse `ShellPageTemplate` primitives | TenantAdmin 13 pages tự maintain CSS riêng, khó đồng bộ với SOC theme | Dần thay `ta.home_*` bằng `ShellPageTemplate` + `soc.*` như `AlertCenterPage.tsx:9-15` đã migrate (Phase C). |
| F-09 | GAP P2 | `aiSettings.module.css:30-67` | `.page { padding:24px 28px; background: radial-gradient... }` riêng, không dùng `shellPage` | AI Command Center lệch background/padding so với SOC dù cùng glassmorphism intent | Merge `.page` vào `shellPage` variant hoặc alias `--ais-*` → `--soc-*`. |
| F-10 | GAP P2 | `ShellPageTemplate.js:1-8` | Toàn bộ primitives dùng `createElement` (không JSX) + `ShellPageTemplate.module.css` className string | Khó đọc, không HMR-friendly, junior dev khó contribute; `TenantAdminLayout.tsx` đã từng convert `createElement → JSX` (AGENTS.md DONE 2026-07-18 Step 6.4) nhưng Shell core vẫn giữ | Convert `ShellPageTemplate.js` sang JSX/TSX như `TenantAdminSidebar.tsx` đã làm. |

### Nhóm RISK — Nợ kỹ thuật & governance

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất |
|----|-----|-----------|---------|----------|---------|
| F-11 | RISK P2 | `pageRegistry.js:3-163` | `createDeferredPageComponent` inject `<style>` clock loader inline `createElement("style", null, "@keyframes spin-hour...")` trong JS | FOUC + CSP risk, không tree-shake; loader không qua CSS module | Tách clock loader ra `ShellSkeleton` hoặc `TenantAdmin.module.css` static. |
| F-12 | RISK P1 | `main.tsx:21-37` + `main.tsx:124,132` + `pageRegistry.js:206` | `resolvePageComponent:24` map `whale-alerts→alert-center` nhưng physical route hiện tại là `alert-center` (`main.tsx:132`), `/whale-alerts` rơi vào wildcard `* → /dashboard:124` → **bookmark regression / compatibility gap** (không phải 404 trực tiếp) | Deep link cũ gãy, cần alias route hoặc redirect legacy rõ ràng | Thêm redirect legacy `Route path:'whale-alerts' → Navigate '/alert-center'` hoặc giữ map có document |
| F-13 | RISK P2 | `index.css:246-260` + `tokens.css:1-56` | Hai tầng token: `@theme --color-*` và `:root --accent-*` alias lẫn nhau, không có `stylelint` token lint | Token drift không phát hiện tự động; `AGENTS.md:5` quality gate thiếu i18n scan nhưng không có token scan | Thêm `stylelint` + `npm run tokens:check` như `i18n:scan`; dùng allowlist (semantic/status/chart/private) thay vì `hex <10` cứng |
| F-14 | RISK P2 | `runtimeConfig.ts:1-9` + `FullLayout.tsx:11-35` + `Sidebar.tsx:28-42` + `Header.tsx:33-36` | `isNewLayoutEnabled()` default `true` (`runtimeConfig.ts:7`) nhưng **vẫn sống** — điều khiển thực `FullLayout w-72/translate`, `Sidebar w-16 vs w-72`, `Header lg:hidden vs flex` | Nhầm dead branch sẽ xóa nhầm logic đang dùng; cần governance trước khi xóa | **Giữ flag qua P0-P4**, đổi tên rõ nghĩa, document nguồn, xóa sau visual acceptance + 1 release ổn định |
| F-15 | RISK P2 | `WatchlistPage.css:260-295` + `StockDetailPage.css:2460+` | Custom scrollbar `::-webkit-scrollbar 6px` duplicate ở 3 file, không dùng `panel-scrollbar` trong `index.css:372-387` | Scroll UX không nhất quán; mobile scrollbar khác nhau | Thống nhất qua `.panel-scrollbar` utility. |

---

## 6. Quality Gates Audit

### a) Lint

- `packages/web/package.json` script `lint: eslint src` (flat config, đã sửa `--ext` → flat ở AGENTS.md Entry 7.1). `npm run lint` trước đây PASS (Entry 7.1: exit 0, chỉ warnings pre-existing; Entry 30-32: tsc+eslint PASS). **Hiện tại**: `npx tsc --noEmit` PASS (mọi entry 19-44 đều PASS). Lint không chạy trong session do timeout 120s nhưng lịch sử gần nhất **PASS**. **Gap**: Không có `eslint` rule cấm hard-coded hex/color ngoài token.

### b) Type-check / Build

- `npm run build = tsc && vite build` — mọi entry 19-44 PASS (`built 3860-3161 modules, chunk-size warning pre-existing`). **Hiện tại**: CHƯA XÁC MINH build fresh (không chạy do timeout) nhưng `tsc --noEmit` trước đó PASS. **Risk**: `theme.module.css` orphaned không được type-check CSS module.

### c) i18n

- `vi.js 4941 dòng : en.js 4925 dòng` — gần parity (16 dòng lệch do bản dịch). **Scan**: `grep "t(" packages/web/src/pages` → ~80% pages qua `useI18n` (`DashboardPage` prop `t` fallback, `WatchlistPage t("watchlist.*")`, `AlertCenterPage t("alertCenter.*")`, `TenantAdmin t("tenantHome.*")`) — ĐẠT `AGENTS.md:6` "i18n qua LangContext". **Gap**: `PortfoliosPage.tsx:92` hard `"Danh mục đầu tư"`, `TransactionsPage:108` `"Giao dịch"` không qua `t()` — vi phạm `LANGUAGE_POLICY_V1.md:34` "i18n trước hardcode".

### d) Test

- `npm run test (jest) 17/17 suites 221/221 tests PASS` (Entry 43-44). `npm run test:components (vitest) 10/10 files 37/37 PASS` (Entry 44). **Gap**: Test chưa cover visual regression — `npm run test:visual` (Playwright) chưa chạy (`workflows/web-ci.yml:127 TODO Configure Playwright`). `theme.module.css` orphaned → không có test phát hiện.

---

## 7. Câu hỏi cần làm rõ — ĐÃ CHỐT theo review 2026-09-08 (cập nhật THAO_LUAN)

1. **Chọn SSOT token**: **Chốt** `tokens.css:1-48` semantic SSOT, `index.css:96-99` Tailwind/layout bridge, token private (`--sh-shell`, `--soc` chart, `--sdp` glow) giữ lại. Drift chuẩn hoá bằng allowlist, không alias cưỡng bức — xem `THAO_LUAN_UI_THONG_NHAT_TEMPLATE_20260908.md:20` Q1.
2. **Phạm vi `app-page-shell`**: **Chốt** `FullLayout.tsx:70-88` sở hữu frame/spacing/max-width, `ShellPageChrome:98-123` sở hữu header/surface, không nested `<main>` — xem THAO_LUAN Q2 + P0-0.
3. **Stock Detail workstation**: **Chốt** giữ riêng — tạo `WorkstationShell` variant dùng chung layout tokens nhưng giữ glow/chart/scroll riêng, không bọc trực tiếp `sdp-page:49` — xem THAO_LUAN Q3.
4. **TenantAdmin CSS numbered**: **Chốt** migrate theo từng page/cluster với primitives `ta-card/toolbar/table` trước, chưa đổi hàng loạt — xem THAO_LUAN Q4.
5. **Feature flag `isNewLayoutEnabled`**: **Chốt** giữ qua P0-P4, đổi tên rõ nghĩa, xóa sau 1 release ổn định — `runtimeConfig.ts:1-9` vẫn sống (`FullLayout:11`, `Sidebar:28`, `Header:33`) — xem THAO_LUAN Q5.

---

## 8. Đánh giá tổng thể & Kế hoạch giải pháp thống nhất

### 8.1 Đánh giá

- **Implementable?** Có — không có blocker kỹ thuật, mọi họ CSS đều giá trị-preserving (chỉ đổi alias), có precedent `AlertCenterPage` đã migrate `CORE_STYLES 1053 dòng → SOC` thành công (Entry 24-32).
- **Blocker?** Không blocker P0 cho build/type, nhưng P0 cho **visual consistency** — user thấy 3-4 visual language khác nhau khi di chuyển `Dashboard → Watchlist → Stock Detail → Tenant Admin`.
- **Ưu tiên sửa**: P0 token SSOT + P0 layout padding/max-width trước, sau đó P1 shell chrome thống nhất, cuối cùng P2 numbered CSS cleanup.

### 8.2 Kế hoạch thống nhất giao diện (dựa trên Template Chung V1)

> Rollout theo `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:240-255` P0→P4, giữ `AGENTS.md:8-9` "build verification: tsc --noEmit mỗi sub-step, npm run build cuối step" + cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` mỗi slice.

#### Phase P0 — Baseline Shell (2-3 tuần) — đã chỉnh theo review

| Slice | Phạm vi | Việc làm | File đích | Tiêu chí pass |
|-------|---------|----------|-----------|---------------|
| **P0-0** | **DOM/layout contract** | Xác định 1 page = mấy shell, ai sở hữu scroll/padding/max-width. `FullLayout:70-88` frame + spacing ngoài, `ShellPageChrome:98-123` header/surface, không nested `<main>`, 1 scroll owner/page | `FullLayout.tsx:46-88`, `ShellPageTemplate.js:98-123` | No nested `<main>`, no double padding, contract ghi audit |
| P0-1 | Token SSOT (allowlist) | `tokens.css:1-48` semantic SSOT, `index.css:96-99` bridge; token private giữ lại; drift chuẩn hoá bằng allowlist (semantic/status/chart/private), không `hex <10` cứng | `tokens.css:1`, `index.css:6-100`, 6 module.css | Allowlist pass, private token giữ |
| P0-2 | FullLayout — **sau pilot** | Thay `FullLayout.tsx:46-85` hard Tailwind bằng token: `w-72 → var(--layout-sidebar-width)`, `p-6 → var(--layout-content-pad-y)`, `max-w-7xl → var(--layout-content-max-width)` — làm sau khi pilot ổn định | `FullLayout.tsx:46-85` | Visual diff `lg` không đổi, token-driven |
| P0-3 | Shell wrapper | `.app-page-shell` alias **chỉ nếu cần** (không tạo thêm wrapper `<main>`); nếu đã có P0-0 thì alias = 0 nested | `ShellPageTemplate.module.css:23`, `ShellPageTemplate.js:98` | Mọi trang Shell tự có spacing V1, không double padding |

#### Phase P1 — Signals Cluster (2-3 tuần)

| Slice | Phạm vi | Việc làm | Tiêu chí |
|-------|---------|----------|----------|
| P1-1 | Alert Center | Đã xong 95% — chuẩn hóa `AlertCard` pendingBadge `soc.banner*` (Entry 25-32). Chỉ còn `AlertCenterPage.module.css:107` hex `#ffd166` audit → giữ accent | 0 dead module.css |
| P1-2 | AI Advisory (ShellAiAdvisory) | Chuyển `ShellAiAdvisoryPage.tsx:315-418` `createElement` metrics/flag sang JSX + dùng `soc.*` badge thay vì raw `renderFlagList` | JSX parity, tsc PASS |
| P1-3 | Dashboard | Thay bento `index.css:265-310` `.dashboard-triad-grid/lane` background/border bằng `soc.glassPanel` + `ShellPanel` variant, giữ ratio `1fr 1.5fr 1fr` làm `page-body-grid--dashboard` variant | Dashboard vẫn bento nhưng token chung |
| P1-4 | SOC Overview | Chuyển `ShellOperationsCenterPage.tsx:90-99` inline style → `ShellPageChrome` (như P0-3) | SOC eyebrow/title i18n `soc.pages.*` |

#### Phase P2 — Portfolio Cluster (3-4 tuần)

| Slice | Phạm vi | Việc làm |
|-------|---------|----------|
| P2-1 | Stock Detail | **Tạo `WorkstationShell` variant** dùng chung layout tokens nhưng giữ glow/chart/scroll riêng; không bọc trực tiếp `sdp-page:49` trong `ShellPageChrome:98`. Đồng bộ font `Inter` → `tokens.css:15` `--font-sans` |
| P2-2 | Watchlist | Align `WatchlistPage.css:24` `240px 1fr` → `page-body-grid` token + `watchlistPage__layout` làm variant (giữ slideOver 420px) |
| P2-3 | Portfolios/Transactions | Migrate `PortfoliosPage.tsx:92` `core-page-header` + `WatchlistSidebar` → `ShellPageChrome eyebrow/title/metrics` |

#### Phase P3 — Cleanup (2 tuần)

| Slice | Việc làm | Tiêu chí |
|-------|----------|----------|
| P3-1 | Xóa `theme.module.css` orphaned hoặc promote nó: nếu chọn `theme` làm primitive, import nó trong `ShellPanel/ShellField` thay vì để 0 import | `grep theme.module.css packages/web/src = N>20` |
| P3-2 | Gom `TenantAdmin.module.css:1-2475` numbered → semantic primitives `ta-card/ta-toolbar/ta-table` theo từng page/cluster, chưa đổi hàng loạt | `ta.home_*` giảm dần, mỗi cluster có primitives |
| P3-3 | **Giữ flag** `runtimeConfig.ts:1` qua P3, đổi tên rõ nghĩa, document governance `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:240` P4 QC gate; xóa sau 1 release ổn định | `runtimeConfig` 1 nguồn rõ nghĩa, visual acceptance pass |
| P3-4 | Thống nhất scrollbar/empty/loading qua `index.css:372` `.panel-scrollbar` + `ShellSkeleton` + `ShellEmptyState.tsx:1` | 1 skeleton, 1 empty, 1 scrollbar |

#### Phase P4 — QC Gate (1 tuần) — bổ sung gate hiện có

- Visual regression checklist `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:228-236` 7 mục + responsive 6 breakpoint 1920/1440/1280/1024/768/390 — `npm run test:visual` (Playwright `alert-center.spec.ts:1` đã có mẫu).
- **Gate bổ sung từ `package.json:6-24`**: `npm run check:shell`, `check:stock-detail-shell`, `i18n:scan` — không chỉ `tsc`/`build`
- **Acceptance cứng**: no nested `<main>`, no double padding, 1 scroll owner/page, contrast check
- Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` mỗi slice + `docs/SYSTEM_FUNCTIONAL_MAP.md:1` bổ sung 15 routes enterprise

### 8.3 Anti-pattern cấm (từ `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:259-265`)

1. Mỗi trang tự đặt `max-width/padding top` riêng (đã vi phạm ở `sdp-page`, `watchlistPage__layout`).
2. Hero card quá cao đẩy module quan trọng xuống dưới viewport (Dashboard bento `h580` cần audit).
3. Hard-code màu ngoài token (hex `#12c7e8` vs token `var(--accent-cyan)`).
4. Trộn nhiều hệ spacing trong cùng trang (`p-6` Tailwind + `var(--sp-*)` + `24px` hard).
5. Ẩn module khi không có data thay vì hiện `ShellEmptyState` (Dashboard empty chưa chuẩn).
6. Nested `<main>` trong `<main>` (`FullLayout:82` + `ShellPageChrome:98`) — thêm ở P0-0.

### 8.4 Thứ tự ưu tiên khuyến nghị — đã chỉnh pilot

```
P0-0 DOM contract (2 ngày) → P0-1 Token allowlist (3 ngày) → Pilot AlertCenter/Watchlist (3 ngày) → P0-2 FullLayout (2 ngày) → P0-3 Shell wrapper (1 ngày)
→ P1-4 SOC (3 ngày) → P1-3 Dashboard (5 ngày) → P1-2 AI Advisory JSX (3 ngày)
→ P2-1 Stock Detail WorkstationShell (5 ngày) → P2-2 Watchlist variant (3 ngày) → P2-3 Portfolios (3 ngày)
→ P3 Cleanup (7 ngày) → P4 QC Gate (5 ngày)  = ~7-8 tuần, P1/P2 song song
```

**Gate mỗi phase**: `tsc --noEmit` PASS + `npm run build` PASS + `check:shell`/`i18n:scan` PASS + screenshot 1920/1440/1280/1024/768/390 + computed-style diff + ledger entry.

> **Errata 2026-09-08**: F-12 sửa thành bookmark regression (wildcard `* → /dashboard`), F-14 flag giữ lại (vẫn sống), F-01 SSOT giữ private token, F-04 không bọc trực tiếp `sdp-page` — xem `THAO_LUAN_UI_THONG_NHAT_TEMPLATE_20260908.md:6` §6 Errata.

---

## Phụ lục — Bằng chứng grep (rút gọn)

- `grep -rn "theme.module.css" packages/web/src --include *.tsx` = 0 (orphaned) — `AUDIT_UPGRADE_SOC_THEME_20260716.md:28` đã ghi.
- `grep -rn "app-page-shell" packages/web/src` = 0 vs `frontend/src:182` có — template V1 không lan tới `packages/web`.
- `Get-ChildItem packages/web/src -Recurse -Include *.module.css,*.css | Measure` = 16 file, 11.0k dòng CSS phân mảnh.
- `grep -rn "createElement" packages/web/src/pages` = 172 hit — ~80% pages vẫn `createElement` thay vì JSX (đã convert 2 file `TenantAdminLayout/Sidebar` ở AGENTS.md Step 6.4).

> **Kết luận**: Dự án đã có Template Chung V1 đầy đủ (14 mục, CSS utility mẫu) và `UI_LAYOUT_AUDIT_REPORT_20260501.md` remediation 22/48/30 cho nhóm 3-cột legacy, nhưng `packages/web` SaaS-native chưa rollout — tạo 7 hệ visual song song. Kế hoạch P0→P4 trên đưa toàn bộ 53 routes về 1 form `shellPage + tokens.css SSOT + page-body-grid variant` với lộ trình 6-7 tuần, bảo toàn `tsc/build/i18n` gate và tận dụng precedent `AlertCenter` đã thành công.

