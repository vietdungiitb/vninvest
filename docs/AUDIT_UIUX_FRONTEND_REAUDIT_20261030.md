# RE-AUDIT (DEEP, sub-agent) — Giao diện frontend (UI/UX) vninvest
## Hiện trạng chi tiết theo từng chức năng + roadmap nâng cấp chuẩn công nghiệp

> **Scope:** `packages/web` (React 19 + Vite 5 + Tailwind v4 + Radix) — toàn bộ giao diện.
> **Ngày:** 2026-10-30. **Phương pháp:** audit tĩnh sâu bằng **6 sub-agent song song** (shell/design, thị trường, danh mục/broker, settings/admin/tenant, SOC/DataOps, AI/commercial/cross-cutting) + inventory tự động (PowerShell) + chạy toàn bộ gate & build. Không chạy E2E/ảnh chụp (staging = `docker.edusuccess.vn`).
> **Supersedes:** `AUDIT_UIUX_FRONTEND_20261030.md` (Entry 417) và `AUDIT_UIUX_FRONTEND_DEEP_20261030.md` (Entry 418) — bản này là definitive, tổng hợp findings từ sub-agent.
> **Lessons áp dụng:** L-V01, L-V02, L-F03, L-F06, L-F08, L-F11, L-F12. (L-F08: màu tăng/giảm chuẩn Bloomberg — **đúng**, không báo sai. L-F03/L-F11: `soc.module.css` barrel 3 dòng; token→`soc.tokens.css`, class→`soc.components.css`.)
> **Skills dùng:** impeccable (audit/critique), archify (repository-authoring lens cho architecture map), theme-factory (lens theming consistency), project-lessons (Planning Gate).

---

## Errata 2026-10-30 (do rà soát trước khi thực thi)

> Bản definitive này có **3 lỗi số liệu/citation** đã được đính chính trong
> `docs/PLAN_UIUX_REMEDIATION_20261030.md` §3 (bảng errata đầy đủ) và
> `docs/evidence/uiux-remediation/AUDIT_PLAN_20261030.md` (audit độc lập, verdict AGREE).

1. **P0-1 "widget eager"** — SAI một phần. Widget đã `import()` động (`VNStockChartPanel.js:54`);
   `dist/index.html` không preload widget. Chỉ CSS `vninvestcharts-widget/dist/index.css` import tĩnh (`:1`).
   Hạ P0-1 → **P1** (route payload), không phải initial bundle.
2. **"100 trang prod"** → thực tế **91** (86 `.tsx` + 5 `.js`).
3. **"28 trang không `t()` / 9 trang thật"** → **18 file / 8 page có text hardcode thật**
   (`ShellOperationsCenterPage` thực có 2 `t()`).
4. **"100/100 không `alt`"** → chỉ **2** `<img>` và **cả hai đều có `alt`**.
5. **"141+ hard hex"** → **161 thô / 155 thật** (6 hex nằm trong comment CSS — bug gate).
6. **Phase A "check:light-theme (nếu có)"** → script **tồn tại** và PASS (227 màu/424 file).
7. **P0-2 "token swap"** → bị chặn bởi quyết định Owner (`ADR_THEME_LIGHT_20261020.md` §4 (a)/(b)).
8. **`PaymentReturnPage.tsx:4-31`** → đúng, chỉ thiếu đường dẫn đầy đủ: `src/pages/commercial/PaymentReturnPage.tsx`.
9. **`PageErrorBoundary`** là bản riêng của StockDetail (log `"[StockDetailPage]"`, CSS `sdp-*`, copy cứng).
10. **"19 component >500 dòng"** — audit-reported, chưa đếm lại bằng script.

Khi dùng bản này làm AC, **luôn cross-check với errata**.

---

## 0. Tóm tắt điều hành (Top 10)

1. **Bundle `widget` 2.22 MB (gzip 557 KB)** kéo eager vào StockDetail/PortfolioOverview/PortfolioAnalytics/WatchlistDetail (`StockDetailPage.tsx:20`, `PortfolioOverviewPage.tsx:15`, `PortfolioAnalyticsPage.tsx:25`) — P0 perf.
2. **i18n monolith 672 KB** (`vi.js` 358 KB + `en.js` 314 KB) bundle thành chunk `i18n` 539 KB tải cho mọi route (vite.config.ts:92) — P0.
3. **`PaymentReturnPage.tsx:4-31` tự định nghĩa `useI18n()`** trả map tiếng Việt cứng, `language: 'vi'` — không theo LangContext, không localize — P0.
4. **State coverage: 97% trang không ErrorState, 87% không Skeleton** (100 trang prod: 3 ErrorState, 13 Skeleton, 21 EmptyState) — P0 UX production-readiness.
5. **Theming: `check:tokens` FAIL** (141+ hard hex) + light-mode vá bằng override theo page (`index.css:335-445`, 69 khối) thay vì token swap — P0.
6. **Form: 0/100 trang prod dùng react-hook-form/zod** → validation tự dựng, không nhất quán — P0.
7. **A11y: chỉ 2 `<img>` có `alt`, 2 occurrences touch-target 44px** trên toàn src; 75/100 trang không có `aria-label` — P1.
8. **God-file: 19 component >500 dòng** (SocSignalsPanel 2454, WhaleBubbleChart 1849, SocVnbrokerPanel 1410, SocDataOpsMonitorSection 1073, SocDataOpsConfigSection 1026, AICommandCenterForm 1010) — P1.
9. **Responsive: 22 distinct `@media` breakpoints** (480/520/640/700/768/900/980/1024/1099/1100/1180/1279/1280) + 2160 fixed px trong CSS — P1.
10. **i18n key reuse conflicting defaults** (`cancel`, `loadError`, `retry`, `delete`, `saving`) — cùng key, nghĩa khác nhau tuỳ chỗ — P1.

---

## 1. Inventory định lượng (A)

### 1.1 Quy mô

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| Page files (.tsx/.jsx, prod) | 100 | glob `src/pages` (loại `__tests__`) |
| Page files (.tsx/.jsx, test) | 24 | glob |
| Component files (prod) | 209 | glob `src/components` |
| Component >500 dòng | 19 | agg2 |
| CSS files | 24 | glob `src/**/*.css` |
| Dòng CSS tổng | ~16.6K | css_inventory (sum) |
| CSS modules | 9 | glob `*.module.css` |
| Locale keys (leaf) | ~4800 | i18n_inventory (sum) |
| Locale namespaces | 96 | i18n_inventory |
| Locale file size | vi 358 KB / en 314 KB | wc |
| Route entries | 69 | routeCatalog.js (grep `id:`) |
| Nav groups | 6 | navigationCatalog.js |
| Chart libs (file dùng) | widget 4 · echarts 24 · recharts 12 | Select-String |
| Form libs (file dùng) | RHF 1 (non-page) · zod 0 page | Select-String |
| Radix (file dùng) | 16 | Select-String |
| A11y counts | aria-label 253 · aria-hidden 54 · aria-live 40 · aria-pressed 33 · aria-labelledby 27 · aria-busy 22 · aria-current 20 · aria-selected 18 · aria-modal 15 · aria-describedby 14 · aria-invalid 14 · role="alert" 37 · role="status" 33 · role="dialog" 5 · alt= 2 · scope= 63 | grep |

### 1.2 Ma trận trạng thái (100 trang prod)

| Trạng thái | Có | Không | % không |
|---|---|---|---|
| ShellSkeleton | 13 | 87 | 87% |
| EmptyState | 21 | 79 | 79% |
| ErrorState (PageErrorBoundary) | 3 | 97 | 97% |
| Loading keyword | 77 | 23 | 23% |
| I18n calls (t()) | 72 | 28 | 28% |
| aria-label | 25 | 75 | 75% |
| alt= | 0 | 100 | 100% |
| Table | 26 | 74 | — |
| Modal/Drawer | 25 | 75 | — |
| Chart | 18 | 82 | — |

### 1.3 Trang prod với 0 i18n calls (9 trang thật, loại test co-located)

`ShellMailConfigPage.tsx` (655d), `VipLocalControlPage.tsx` (684d), `BrokerHubPage.tsx` (269d), `TransactionsPage.tsx` (249d), `ShellAiCommandCenterPage.tsx` (235d), `ShellSettingsPage.tsx` (144d), `ShellSupportPage.tsx` (169d), `PortfolioWorkspacePage.tsx` (82d), `ShellOperationsCenterPage.tsx` (110d).

### 1.4 Bundle metrics (build 2026-10-30, vite 5.4.21, 3705 modules)

| Chunk | Size | gzip |
|---|---|---|
| `widget-BLaTiwoq.js` | **2,217 KB** | 557 KB |
| `echarts-CbTRyeDc.js` | 728 KB | 249 KB |
| `i18n-CCdYDQcA.js` | 513 KB | 167 KB |
| `xlsx-D_0l8YDs.js` | 429 KB | 143 KB |
| `react-vendor-Bde53u6k.js` | 305 KB | 97 KB |
| `generateCategoricalChart` | 277 KB | 74 KB |
| `SocDataOpsPanel` | 98 KB | 23 KB |
| `ui-C-xZ9D0n.js` | 110 KB | 36 KB |
| `index.css` | 180 KB | 27 KB |
| `widget-*.css` | 189 KB | 29 KB |

### 1.5 Top namespaces i18n (leaf keys)

soc 1261 · stockDetail 411 · adminOps 379 · watchlist 263 · screener 196 · adminCoreTenants 180 · aiAdvisory 178 · alertCenter 170 · dashboardRealtime 146 · whaleHub 138 · whaleAdvisory 123 · brokerHub 88 · portfolioWorkspace 87 · portfoliosManage 96 · transactions 73 · adminCoreAuditTrace 73 · aiCommandCenter 202 · aiUsageAnalytics 34 · aiAdvisor 25 · (96 namespaces tổng, ~4800 keys).

### 1.6 Top CSS files (dòng)

soc.components.css 4561 · StockDetailPage.css 2876 · TenantAdmin.module.css 2518 · aiSettings.module.css 1249 · ShellPageTemplate.module.css 534 · index.css 927 · PortfolioWorkspace.css 754 · WatchlistPage.css 754 · portfolioManage.css 678 · ShellMailConfigPage 655 (page) · UserSettingsPage.css 220 · soc.tokens.css 218 · AlertCenterPage.module.css 192 · brokerData.css 157 · CommercialPage.module.css 307 · DNSEConnectionPanel.css 335 · VninvestInput.module.css 132 · theme/light-theme.css 1009 · theme/tokens.css 83 · theme/theme.module.css 386 · components/soc/soc.module.css 4 · components/ui/VnvestInput.module.css 4 · AuthRegisterPage.css 8 · SmartStatsHeader.css 83.

### 1.7 God-file component (>500 dòng)

SocSignalsPanel.tsx 2454 · WhaleBubbleChart.jsx 1849 · SocVnbrokerPanel.tsx 1410 · SocDataOpsMonitorSection.tsx 1073 · SocDataOpsConfigSection.tsx 1026 · AICommandCenterForm.tsx 1010 · SocOverviewPanel.tsx 1174 · SocSchedulerBoard.tsx 803 · SocDataOpsOperationsSection.tsx 882 · ScreenerResultsTable.tsx 555 · SocScreenerPanel.tsx 569 · SocBrokerPanel.tsx 545 · ShellMailConfigPage.tsx 655 · StockDetailPage.css 2876 (CSS) · TenantAdmin.module.css 2518 (CSS) · aiSettings.module.css 1249 (CSS).

---

## 2. Shell, Navigation, Routing (deep — Agent 1)

### 2.1 Shell layout
- Providers order: `main.tsx:278-303` QueryProvider → PortfolioProvider → LangProvider → ToastProvider → ConfirmProvider → RealtimeProvider → App. LangContext dùng `usePortfolio()` (`LangContext.js:31`) ⇒ thứ tự đúng.
- Main landmark: `FullLayout.tsx:89-103` 1 `<main id="main-content" tabIndex={-1} role="main" overflow-auto>` ⇒ single-main đúng.
- Skip link: `index.html:18-22`, `index.css:777-799` clip-path (không display:none) ⇒ giữ tab order.
- Sidebar/Header: `FullLayout.tsx:61-85`. Mobile overlay `FullLayout.tsx:49-59` backdrop `bg-black/60 z-40`, click close, `aria-hidden`.
- Resize: `FullLayout.tsx:35-43` chỉ đóng mobile sidebar khi ≥1024px; không reset khi route đổi ⇒ drawer có thể còn mở sau điều hướng (P3).
- Auth pages render nested `<main>` (`AuthLoginPage.tsx:129,141`) trong FullLayout main ⇒ landmark lồng (P1).

### 2.2 Routing
- Catalog 69 entry (`routeCatalog.js`), đầy đủ schema (id, path, titleKey, group, buildTargets, requiredCapabilities, adapter, status, staffOnly, deprecated/redirectTo, externalEntry).
- Guards: `ProtectedRoute` `main.tsx:83` (auth + bootstrap error retry `:108-132`); `StaffRoute`/`TenantRoute` `StaffRoute.tsx:14,44`.
- Redirect giữ query: `RedirectPreserveQuery` `main.tsx:68-72`, `WhaleAlertsRedirect` `:74-81`.
- Deep-link portfolio tab: `main.tsx:185-189` 5 URL.
- Vấn đề: `requiredCapabilities` chỉ khai báo mô tả, không guard thật (`routeCatalog.js:296-306`); `ProtectedRoute` redirect `/login` không giữ `location.search` (`main.tsx:100`); login dùng `window.location.assign` (`AuthLoginPage.tsx:58,104`) full reload.

### 2.3 Navigation
- 6 nhóm (`navigationCatalog.js:5-48`): workspace, signals, system, admin, tenant, vip-local. Nhóm admin label `layout.nav.soc` (`:29`) chỉ 4 item (`operations-center, mail-config, advertising-admin, admin-users`, `:32`) trong khi catalog có ~30 route admin ⇒ wayfinding kém (P1-10).

### 2.4 Auth UX
- 4 trang auth (`AuthLoginPage 247d, AuthRegisterPage 400d, AuthResetPasswordPage 306d, AuthVerifyEmailPage 143d`), 0 RHF.
- Validation SSOT: `authPolicy.js` (`PASSWORD_MIN_LENGTH=10` `:36`, `USERNAME_PATTERN` `:39`, `normalizeUsername` `:52`, `scorePassword` `:65`).
- Lỗi parse: `authErrors.js` + `parseAuthError` (login `:111`, register `:131`).
- Turnstile: `TurnstileWidget.js` `resolveTurnstileSiteKey` `:51-65` — fail-loud ở prod khi thiếu key.
- Bootstrap error retry: `ProtectedRoute` `main.tsx:108-132` (role alert + retry button) — UX tốt.

### 2.5 Theming (deep)
- Token inventory: `soc.tokens.css` **152 custom prop** (`:root` + light override `:143-217`); `theme/tokens.css` ~62 biến; `index.css` @theme ~116 biến. **3 thang song song**: `--space-*` (`index.css:97-106`), `--sp-*` (`theme/tokens.css:37-42` + soc `:24-28`), `--fs-*` (`theme/tokens.css:22-30` vs soc `:74-77`).
- Light override per-page: `index.css:335-445` (advisory + dashboard) override utility theo nhóm; các trang khác dựa remap token.
- Hard-hex leakage: **143 unique hex trong CSS** (top: `light-theme.css` 347 occurrences, `index.css` 96, `soc.components.css` 95); **694 hex trong tsx/js** (top: `WatchlistTable.tsx` 61, `WhaleBubbleChart.jsx` 41, `ScreenerResultsTable.tsx` 37). `check:tokens.mjs` chỉ quét `.css` và allowlist 95 hex ⇒ gate thực chất no-op với leakage lớn (P0-2/P0-3).

### 2.6 A11y baseline
- focus-visible global (`index.css:142-145`), skip link (`index.css:777-799`, `index.html:18-22`), reduced-motion (`index.css:810-819`), touch 44px coarse (`index.css:901-926`), safe-area (`index.css:880-883`), tabular-nums (`index.css:828-831`).
- `check:dom-landmarks` PASS, `check:contrast` PASS (7 tone pairs × 2 mode ≥4.5:1).
- Thiếu: nested main landmark ở auth pages; mobile drawer không trap focus; `StaffRoute` toast lặp (`StaffRoute.tsx:28-32` useEffect deps gồm toast/noPermissionMessage).

### 2.7 Gate scripts
- `check-tokens.mjs`: hard hex ngoài `:root` vs allowlist 95 hex (`:10-26`); leakage trong tsx/js; allowlist quá rộng; không quét `.ts/.tsx`.
- `check-contrast.mjs`: 7 tone pair × 2 mode ≥4.5:1 (`:26-34`); chỉ adminTone; không đo arbitrary pairs trong pages.
- `check-dom-landmarks.mjs`: Shell không `<main>`; FullLayout đúng 1 main + overflow-auto (`:21-40`); không quét auth pages (nested main), tenant-admin.

---

## 3. Thị trường (deep — Agent 2)

### 3.1 DashboardPage (`DashboardPage.tsx`, 451d)
- Bố cục: Empty (no portfolio) L322-329; Error L331-338; Main L340-449: Heading L111-122, Stats slot L344-359 (`SmartStatsHeader` hoặc `LoadingSkeleton`), Triad grid L362-422 (alert lane L364-381 `UnifiedAlertCenter`; heatmap L383-402 `PortfolioHeatmap`; AI lane L404-421 `AIAdvisorAlertPanel`), Deck L424-446 `CoreDashboardPositionDeck`. Mỗi slot bọc `PageErrorBoundary`.
- Loading/empty/error: `showSkeleton = loading && !hasHydrated` L289; skeleton theo slot; empty/error branch. Không empty riêng cho heatmap.
- Charts: `PortfolioHeatmap` ECharts (treemap/sunburst) import tĩnh; `WhaleAnalyticsTab` lazy `FactsFirstWhaleBubbleChart` (R1.1) — tốt.
- i18n: `t()` 3 calls (L120, L129, L326); hardcoded chỉ comment.
- a11y: 0 `aria-*`, 0 `role` ở page-level; heading `h1` có. Component-level chưa kiểm sâu.
- Responsive: không media query trong page; grid `.dashboard-triad-grid` phụ thuộc CSS global (breakpoints 1279/1099px, index.css:489-526).

### 3.2 StockDetailPage (`StockDetailPage.tsx`, 397d) + Shell (`ShellStockDetailPage.js`, 39d)
- Bố cục: Shell L20-37 resolve symbol; Empty (no symbol) L237-248; Error L250-270 (retry L260-267); Main L314-395: bg glow `aria-hidden` L327-328, Header L330-339, Session witness L341-345, Workstation (feature flag) L347-355 (left chart+whale bubble L272-303, right order book+execution log L305-312), Tabs L357-380, Drawer L382-387, Toast L389-393.
- Loading: `loadingBlocking` L111 → header/chart; `loadingDeferred` L112 → tabs/witness. Không skeleton riêng.
- Charts: `VNStockChartPanel` L20, `WhaleBubbleChart` L22 import tĩnh → không lazy (P1-F1).
- i18n: `t()` 5 (L179, L190, L213, L245, L266). Hardcoded: `fallbackTitle: "Lỗi hiển thị Stock Detail"` L317 (trộn Anh-Việt), toast `✨ ${toast}` L392.
- a11y: `aria=2` (bg glow). Không `role`. `StockDetailHeader`/tabs chưa kiểm.
- Responsive: `StockDetailPage.css` media 768/1024/480 + reduced-motion + high-contrast; fixed px 524.

### 3.3 ScreenerPage (`ScreenerPage.tsx`, 762d)
- Bố cục: Header h1 L532 + subtitle L533; Ops hint L548-556; Error banner L558-571; Notice L573-585; Rule editor L588-594; Loading rules skeleton L596-603; Empty rules L604-610; Rules list L611-687; Preview banner L689-697; Job progress L698-728; Results `ScreenerResultsTable` L729-747; Templates/History/Schedule/Community L748-758.
- Loading/empty/error: loading chỉ rules; khi run trực tiếp không skeleton (chỉ spinner nút run L640-648); empty rules L604-610; error rules L167-169; run error L436-445 (429 riêng L439-441); job polling timeout 90s L416-422.
- Bảng: `ScreenerResultsTable` 40+ cột (L32-...), visibility localStorage L8-20, server sort/pagination L730-746, `fetchAllRows` L515-522. Div-based (aria 4). Column grouping by category.
- i18n: `t()` 53. Hardcoded: `✕` L23, ` · ` L24, 429 message L441, comments.
- a11y: 0 `aria-*`, 0 `role` page-level. RuleEditor có `label htmlFor="screener-rule-name"` L78 (tốt). Inputs có id/name L82-83.
- Responsive: `pageStyle` maxWidth 1200px L524-526; inline styles; không media query. Rule cards `flexWrap: wrap` L617.
- Forms: RuleEditor L44-119 (name input, filter builder, validation L52-68, save/cancel); confirm delete L224-227; share toggle L207-222.

### 3.4 WatchlistPage (`WatchlistPage.tsx`, 72d) + components
- Bố cục: `WatchlistProvider` L66-69 bọc content; `ShellPageChrome` L45-61: title L48; layout L52-56 `WatchlistSidebar` + `WatchlistMainWorkspace`; `ScopedWatchlist` L59; `WatchlistDetailPanel` L60.
- Loading/empty/error: page-level không có (0); `WatchlistTable` không có loading skeleton. Empty có thể trong workspace (chưa đọc hết). Risk: không có trạng thái rỗng rõ ràng ở page.
- Bảng: `WatchlistTable.tsx` TanStack Table + `FixedSizeList` react-window L7. Client sort/filter/pagination L22-29. 20+ cột điều kiện. Global filter L26. Page size options L9. Sparkline SVG inline L7 `renderSparkline`. Action buttons aria-label L98/104/110/116. Select all checkbox aria L130. Không native table semantics (div-based virtual list) → screen reader khó.
- Charts: Sparkline SVG inline role=img L57 — tốt a11y.
- i18n: page 1 `t()`; `WatchlistTable` 65 `t()`. Hardcoded comments only.
- a11y: `WatchlistTable` aria=16 (action buttons, sparkline, select). Không `role`/table scope. Column picker dropdown L10-... click-outside L16-24 nhưng không trap focus/ESC.
- Responsive: `WatchlistPage.css` media 1024 + reduced-motion + hover:none. Fixed px 76.
- Forms: Price alert dialog L25 (state) validation L63-69; bulk delete confirm L29. Dialog accessibility chưa kiểm (focus trap/aria-modal).

### 3.5 AlertCenterPage (`AlertCenterPage.tsx`, 751d)
- Bố cục: Filters `FilterBar` L17; Layout L597: left col feed L598-747; stats panel L718-731. Feed panel L599-747: title/subtitle L600-604; actions mark-all-read/load-more/export/sort L606-643; skeleton L652-653; feed error empty L654-664; empty L665-667; virtual list L683-710; AlertCard L692-709. Stats panel L718-731: search/sort/pagination (8/page L368). Stale banner L588-595 (role=status). Summary/stats error L580-586.
- Loading/empty/error: `isInitialLoading` skeleton L652-653; background fetch banner L669-673; feed error role=alert L655, L670; empty L665-667 `soc.emptyState`; stale banner L588-595.
- Bảng: `StatsTable.tsx` native table (13 tags) với sort/pagination. Feed là virtual list (react-window) không table semantics.
- Charts: không có chart.
- i18n: `t()` 34. Hardcoded: `—` L82 (fallback), window options `5m/15m/...` (L11-16 FilterBar) label kỹ thuật (chấp nhận).
- a11y: page-level aria=3, role=6. Feed container `aria-live="polite"` + `aria-busy` L668. Empty/error `role="alert"` L655, L670. Stale `role="status"` L589. FilterBar lane buttons `aria-pressed` L74. Tốt hơn các trang khác.
- Responsive: `AlertCenterPage.module.css` media 1024 only. Fixed px 36.
- Forms: Symbol filter form (FilterBar) L32-34; session date L35-36; mute modal component. Auto-refresh toggle L93.

### 3.6 WhaleAdvisoryPage (`pages/signals/WhaleAdvisoryPage.tsx`, 568d)
- Bố cục: Header `WhaleAdvisoryBentoHeader` L338-342; fromAlert link L344-351; Loading skeleton L353-359 (aria-busy L354); Refresh info error L361-370 (role=status); Warning banner L372-384; Error banner L396-439 (role=alert, retry); Main grid L440-441 `lg:grid-cols-[minmax(0,1fr)_20rem]`: left main L442-493 (command panel, compare section aria-label L446, tabs risk/history/backtest L447-463, telemetry details L461-473); right sidebar sticky L476-492 (symbol search/pagination); Footer token quota L496-524 (aria-hidden separator L504, L514).
- Loading/empty/error: Loading L353-359 skeleton; Refresh info error L361-370; Page error L396-439 retry L431-438; Network error mapping B4 L424-428 (không hiện raw English). Không empty state riêng cho danh sách (auto-select first L268).
- Bảng: `AdvisoryCompareTable` (component) — chưa đọc sâu. Sidebar pagination client-side.
- Charts: Không có chart trực tiếp trên page (WhaleBubble ở StockDetail). Lazy? WhaleAnalyticsTab lazy chart (dashboard only).
- i18n: `t()` 22. Nhiều `defaultValue` tiếng Việt. Hardcoded comments only.
- a11y: aria=5, role=2. Compare section `aria-label` L446; tabs `aria-label` L448; footer separators `aria-hidden` L504/L514. Good. Error banner `role="alert"` L398, data-testid.
- Responsive: Grid dùng `lg` (1024) với comment giải thích shell max-width 1280 L386-395 (tốt). Sticky sidebar L476.
- Forms: Symbol search input (sidebar, component). Risk mode selector L450. Compare toggle max 5 L302-317. Delete confirm L323-334.

### 3.7 components/dashboard/* (đọc đầu 60 mỗi file)
- `SmartStatsHeader.js`: null-aware market value/day P&L (tránh "0 giả"), stale badge 15 phút. CSS bridged tokens.
- `PortfolioHeatmap.js`: ECharts treemap/sunburst, màu liên tục ±7%, lazy? không (static echarts import).
- `UnifiedAlertCenter.js`: severity rail, family labels 8 families, dedup.
- `CoreDashboardPositionDeck.tsx` + `FactsFirstModularPositionDeck.jsx`: URL state (tab/pageSize/page) deep-link, pagination. `.jsx` duplicate bridge.
- `WhaleAnalyticsTab.jsx`: lazy bubble chart (R1.1) — tốt.
- `AIAdvisorDeckPanel.jsx`, `OptimizationModal.jsx`: hardcoded English labels ("AI Advisor Optimization", "Conservative/Aggressive") — i18n chưa đầy đủ.
- `WhaleAnalyticsAdvisoryModal.jsx`: loading/error.

### 3.8 components/alert-center/* (đọc đầu 60)
- `FilterBar.tsx`: lane tabs `aria-pressed` L74; family options theo lane.
- `AlertCard.tsx`: memo, evidence expand, family labels. aria=2.
- `StatsTable.tsx`: native table (13 tags) với sort/pagination.
- `StatsPanel.tsx`, `DetailDrawer.tsx`, `MuteModal.tsx`: chưa đọc sâu.

### 3.9 pages/watchlist/components/* (đọc đầu 60)
- `WatchlistContext.tsx`: provider, load lists.
- `WatchlistSidebar.tsx`, `WatchlistDetailPanel.tsx`: chưa đọc sâu.
- `WatchlistMainWorkspace.tsx`: ColumnPicker L10-... dropdown click-outside; inline styles glassmorphism.
- `WatchlistTable.tsx`: TanStack + virtualization, aria labels tốt, sparkline role=img.

### 3.10 Findings thị trường (8)

| # | Mức | Vị trí | Evidence | Tác động | Đề xuất | Effort |
|---|---|---|---|---|---|---|
| F1 | P1 | `StockDetailPage.tsx:20,22` | Import `VNStockChartPanel`, `WhaleBubbleChart` tĩnh | Route stock detail kéo chart bundle ngay từ đầu → TTI chậm | Bọc `lazy(() => import(...))` + `<Suspense>` như `WhaleAnalyticsTab.jsx` | M |
| F2 | P1 | `components/dashboard/PortfolioHeatmap.js` | ECharts import tĩnh | Dashboard tải ECharts cho mọi user | Lazy-load `PortfolioHeatmap` trong DashboardPage slot | M |
| F3 | P2 | `pages/watchlist/components/WatchlistTable.tsx:7` | `FixedSizeList` div-based, 0 native table tags | Screen reader không đọc được bảng | Thêm `role="table/row/cell"` + `aria-rowindex` hoặc fallback non-virtual cho SR | L |
| F4 | P2 | `pages/ScreenerPage.tsx:596-603` | Skeleton chỉ rules; run trực tiếp không có skeleton kết quả | Người dùng không biết đang xử lý | Thêm skeleton/progress trong vùng results khi `running !== null` | S |
| F5 | P2 | `pages/StockDetailPage.tsx:317` | `fallbackTitle: "Lỗi hiển thị Stock Detail"` trộn Anh-Việt | Vi phạm i18n convention | Đổi thành `t("stockDetail.page.renderError", { defaultValue })` | S |
| F6 | P2 | `pages/DashboardPage.tsx:322-329` (empty) + `:331-338` (error) | Empty/error branch không có `role`/`aria-live` | SR không được thông báo | Thêm `role="status"` (empty) / `role="alert"` (error) như AlertCenterPage | S |
| F7 | P3 | `AlertCenterPage.module.css` (media 1024 only), `WatchlistPage.css` (1024), Dashboard (no media) | Breakpoint hạn chế; fixed px | Mobile (<768) layout có thể overflow | Audit responsive từng trang; thêm media 768/480 cho grid/form | M |
| F8 | P3 | `components/dashboard/OptimizationModal.jsx` | Hardcoded "AI Advisor Optimization", "Conservative/Aggressive", "Hiện tại" | Locale không nhất quán | Bọc các label bằng `t(..., { defaultValue })` | S |

### 3.11 Điểm tốt thị trường (4)
1. **AlertCenterPage a11y dẫn đầu** — `aria-live="polite"` + `aria-busy` L668, `role="alert"` L655/L670, `role="status"` L589, lane tabs `aria-pressed` L74 (`FilterBar.tsx`). Virtualization + SR-friendly nhất.
2. **WatchlistTable** — TanStack sort/filter/pagination + react-window virtualization + aria-label đầy đủ trên action buttons/sparkline/select (aria=16). Sparkline có `role="img"` + `<title>` (L57-58).
3. **StockDetailPage error/empty states đầy đủ** — empty L237-248, error có retry L250-270, bg glow `aria-hidden` L327-328; loading tách blocking/deferred L111-112.
4. **WhaleAdvisoryPage network error mapping B4** — không hiện raw "Failed to fetch" cho user (L424-428), grid breakpoint `lg` có giải thích shell max-width (L386-395), sticky sidebar (L476).

---

## 4. Danh mục / Broker / Giao dịch (deep — Agent 3)

### 4.1 Per-cụm
- **PortfoliosPage** (322d): ShellPageChrome → toolbar (tạo/sort/search/count/broker/watchlist/reload) → KPI → state → table → pager → dialog/drawer. Loading/empty/error đủ 4 nhánh (L225-266) + `noMatch` (L259). Pager luôn render dù không có dữ liệu (L284-301) — affordance thừa. Bảng 8 cột, `min-width: 68rem`, `overflow-x:auto` (portfolioManage.css:189-200). Sticky header (L213-216). Sort client-side có chú thích phạm vi. Form dialog `role="dialog" aria-modal`, Escape đóng, `aria-invalid`/`aria-describedby` đúng ô (PortfolioFormDialog L93-126). Thiếu focus trap (tab có thể thoát modal). Drawer có focus trap + restore focus đầy đủ (PortfolioManageDrawer L195-227) — điểm mạnh.
- **PortfolioWorkspace** (116d) + Page (82d): 5 tab qua `TABS` khai một chỗ, `aria-current="page"` (L90-100). Picker `<select>` labeled visually-hidden (L57-60). Error hiển thị raw `error` trong `<code>` (L103-108) — kỹ thuật lộ cho user. Mỗi tab con tự quản loading/error/empty.
- **Holdings** (365d): 13 cột theo spec (L5-10), sort số đúng (L189-200), filter search/sector, URL deep-link (L109-121). Hành động "Chi tiết" **disabled vĩnh viễn** (L351) — affordance chết, không giải thích. Banner aggregate/unknown kind (L241-262) — fail-closed hợp lý.
- **Analytics/Allocation/Activity/Overview**: Analytics 12 số thật + reason (L114-145), không bịa 0 (D7). Allocation 4 mode + group by sector (L88-128). Activity timeline + pager local (L97-143). Overview 8 thẻ, 4 thẻ "—" có lý do (L92-113). Activity timeline grid cố định `110px 80px 80px 100px 1fr auto` (PortfolioWorkspace.css:647) — không breakpoint mobile ⇒ tràn ngang.
- **Broker**: Hub 3 tile lane, badge capability từ BE (L70-92), `?provider=` full-state (L118-123), form chung chỉ lane schema-driven (L248-262). Dùng `styles from soc.module.css` (L12) — barrel 3 dòng re-export (AGENTS cảnh báo). BindingsPanel confirm 2 bước inline (L393-431), kind fail-closed (L344-351). Empty candidate tái dùng cùng chuỗi "Chưa gộp..." (L296-297 vs L253) — gây nhầm. BrokerAccountPage fail-closed khi thiếu accountId (L68-72).
- **Commercial**: BillingCenter inline `<style>{BILLING_CUSTOM_STYLES}</style>` 7KB mỗi render (L382), plan card là `<div onClick>` không keyboard (L562-579), eyebrow hardcoded "SaaS Commerce System" (L377). Form amount disabled (L582-592). PaymentReturnPage tự định nghĩa `useI18n` với map hardcoded (L9-31) — bypass LangContext, bỏ qua ngôn ngữ người dùng; `useEffect([], …)` gọi `t` stale. UpgradePage `t("upgrade.currentPlan")` không `defaultValue` (L56) ⇒ có thể leak key; chỉ link điều hướng, không CTA nâng cấp thật.

### 4.2 Findings danh mục/broker (8)

| ID | Mức | Vị trí | Evidence | Tác động | Đề xuất | Effort |
|---|---|---|---|---|---|---|
| F1 | P0 | `PaymentReturnPage.tsx:9-31` | `function useI18n()` tự trả map hardcoded 18 key | Ngôn ngữ không đổi theo LangContext | Dùng `useI18n()` thật + thêm key i18n | S |
| F2 | P0 | `TransactionsPage.tsx:194-247` | Toàn bộ chuỗi hardcode VN, `Number(form.quantity)` có thể NaN gửi API (L160-169), không validate | Gửi NaN → 400; không i18n; bảng không overflow wrapper | Validate trước submit; bọc table `overflow-x:auto`; i18n keys | M |
| F3 | P1 | `BillingCenterPage.tsx:562-579` | Plan card là `<div onClick>` không `role="button"/tabIndex/keyboard` | A11y: không chọn bằng bàn phím | Đổi thành `<button>` hoặc thêm role+onKeyDown | S |
| F4 | P1 | `PortfolioHoldingsPage.tsx:351` | `<button type="button" disabled>Chi tiết</button>` vĩnh viễn | Affordance chết | Wire handler hoặc xoá cột | S |
| F5 | P1 | `PortfolioFormDialog.tsx:86-92` | Modal overlay đóng khi `!busy`, nhưng không focus trap | WCAG 2.2 modal | Thêm trap như drawer (L195-222) | S |
| F6 | P2 | `PortfolioWorkspace.css:647` | `.pf-timeline__item { grid-template-columns: 110px 80px 80px 100px 1fr auto }` không media query | Tràn ngang mobile | Thêm `@media (max-width:640px)` stack | S |
| F7 | P2 | Money format rải rác | `toLocaleString("vi-VN")` (Overview L42, Holdings L57-70, Activity L46) vs `formatVnd`/`formatMoney` (manage/format.ts) | Số thập phân/đơn vị không nhất quán | Chuẩn hoá về helper manage/format | M |
| F8 | P3 | `UpgradePage.tsx:56` | `t("upgrade.currentPlan")` / `t("upgrade.upgradeTo")` không `defaultValue` | Leak key nếu thiếu dictionary | Thêm defaultValue; thêm CTA thanh toán | S |

### 4.3 Điểm tốt danh mục/broker (4)
1. **PortfolioManageDrawer** focus trap + restore focus (L195-227, L224-227) — modal chuẩn WCAG.
2. **Holdings** sort số + URL state deep-link + codec an toàn (L75-86, L189-200) — tránh injection sortKey.
3. **KPI partial state** trung thực: thiếu giá ⇒ "Tạm tính" + reason (PortfolioManageKpi L35-38, L83-92) — không bịa 0.
4. **Empty/loading/error states** nhất quán across tab con và manage table (L225-266 PortfoliosPage).

### 4.4 Ghi chú responsive/a11y tổng quan
- Sticky header table tốt (portfolioManage.css:213-216). Mobile: manage toolbar collapse (L661-669), drawer full-width (L656-659), KPI 1 cột (L652-654). Nhưng `.pf-table` min-width 68rem + `.pf-holdings` overflow OK; timeline không.
- Hardcoded: TransactionsPage (toàn bộ), PaymentReturnPage (map), BillingCenterPage eyebrow, UpgradePage thiếu default.

---

## 5. Settings / Tenant-admin / Platform admin (deep — Agent 4)

### 5.1 Phân loại primitive vs tự dựng
- **Platform admin (`pages/admin`):** Dùng `adminUi` (AdminPageHeader/AdminPanel/AdminMetricCard/AdminEmptyState): **13/15** trang. Tự dựng: **2/15** — `ShellOperationsCenterPage.tsx` (SOC tab shell, lazy-load panel), `ShellMailConfigPage.tsx` (form-heavy, dùng `ShellPageChrome`).
- **Tenant-admin (`pages/tenant-admin`):** Dùng `ShellPageChrome`/`ShellPanel`/`ShellSkeleton`/`ShellEmptyState`: **16/16** trang. Không trang nào import `adminUi` (đúng thiết kế: tenant-admin là subsystem riêng).

### 5.2 Mẫu chung (bố cục / states / table / form / a11y / i18n)
- **Bố cục:** tenant-admin nhất quán `ShellPageChrome` (h1 + eyebrow + metrics + notice/error + children) (`ShellPageTemplate.js:90-149`). Platform admin chia 2 nhóm: fleet (4 trang analytics: Analytics/Audit/Billing/Usage) dùng `AdminPageHeader` + `AdminEmptyState`; Core* (8 trang tenant-scoped) dùng `AdminPanel` + `AdminMetricCard` + `AdminValueRow` + h1 tự viết `text-3xl`.
- **States:** tenant-admin dùng react-query (`useTenantAdminQuery`) với `.isLoading`/`.error`; admin Core* dùng state tay `useState(true)` + `useEffect` fetch. Loading chủ yếu text trong `AdminEmptyState`/`ShellSkeleton`.
- **Table:** admin 9 bảng (`<table className="min-w-full…">`) đều không có `scope` trên `<th>`; tenant-admin 5 bảng (`<table className={ta.*}>`) cũng không có `scope`.
- **Form:** tenant-admin dùng `ShellField`/`ShellSelectField` (label+input liên kết qua `htmlFor`/`id`) — tốt a11y. Admin fleet dùng input/select thô với `aria-label` (`AdminAuditPage:115-123`).
- **a11y:** tenant-admin icon lucide có `aria-label` (`HomePage:114-121`). Admin buttons icon-only hầu như không có `aria-label` (ngoại trừ input filter). Heading h1 có ở mọi trang.
- **i18n:** tất cả labels qua `t(...)` với `defaultValue` tiếng Việt; không có hardcoded English trong UI (trừ "OPERATIONS CENTER"/"LIVE" ở `ShellOperationsCenterPage:98-100` và "Healthy" ở `AdminCoreOverviewPage:20`).

### 5.3 A11y tổng hợp (admin + tenant-admin)

| Tiêu chí | Admin (15) | Tenant-admin (16) |
|---|---|---|
| h1 mỗi route | 13 qua AdminPageHeader + 2 qua ShellPageChrome | 16 qua ShellPageChrome (`ShellPageTemplate.js:122`) |
| Landmark (region/header) | AdminPanel `<section>` + header div | ShellPageChrome `role="region"` + `<header>` |
| Table `<th scope>` | 0/9 bảng có | 0/5 bảng có |
| Button/input `aria-label` | filters có (`AdminAuditPage:115-123`, `AdminBillingFleetPage:137-149`); icon button hầu như không | inputs có (`Members:294`, `SSO:245-349`); icon lucide có |

### 5.4 Loading / error state — 10 trang thiếu
Thiếu skeleton (không import ShellSkeleton): `TenantAdminAIPolicyPage`, `TenantAdminBillingPage`, `TenantAdminCapabilitiesPage`, `TenantAdminMembersPage`, `TenantAdminSecurityPage`, `TenantAdminServiceAccountsPage`, `TenantAdminSSOPage`.
Thiếu error rendering (không render `error &&`/`configError`): `TenantAdminAIPolicyPage`, `TenantAdminCapabilitiesPage`, `TenantAdminReportsPage`, `TenantAdminRolesPage`, `TenantAdminSecurityPage`, `TenantAdminServiceAccountsPage`, `TenantAdminSettingsPage`, `TenantAdminHomePage` (chỉ pass `error` prop cho chrome — partial).
→ 10 trang union: **AIPolicy, Billing, Capabilities, Members, Reports, Roles, Security, ServiceAccounts, Settings, SSO**.

### 5.5 Findings settings/admin/tenant (8)

| ID | Mức | Vị trí | Evidence | Tác động | Đề xuất | Effort |
|---|---|---|---|---|---|---|
| F1 | P1 | `pages/admin` + `pages/tenant-admin` tables | grep `scope=` = 0 kết quả. Ví dụ `AdminCoreTenantsPage.tsx:281`, `AdminCorePATsPage.tsx:391`, `TenantAdminMembersPage.tsx:308-334`, `TenantAdminWebhooksPage.tsx:347-353` | Screen reader không liên kết header với cell; WCAG 1.3.1 | Thêm `scope="col"` (và `scope="row"` cho cột đầu). Effort S (sed-level, ~14 bảng) | S |
| F2 | P1 | 8 trang tenant-admin | grep `error &&` chỉ 9 match ở 8 trang (Billing, Members, AuditLogs, PATs, UsageHistory, Usage, Webhooks, SSO); AIPolicy, Capabilities, Reports, Roles, Security, ServiceAccounts, Settings không match | Khi API fail, trang giữ skeleton/blank hoặc dữ liệu cũ, user không biết | Thêm block `if (error) return <ShellPageChrome …><ShellEmptyState …/></ShellPageChrome>` như `TenantAdminAuditLogsPage.tsx:142` | M |
| F3 | P1 | 8 trang Core* admin | `<h1 className="text-3xl font-semibold tracking-tight">` (AdminCoreJobsPage:190, AdminCoreBillingPage:95, AdminCoreAuditTracePage:253, AdminCoreOverviewPage:89, AdminCorePATsPage:182, AdminCoreServiceAccountsPage:152, AdminCoreUsagePage:126, AdminCoreTenantsPage:176) vs fleet `AdminPageHeader` → `<h1 className="text-2xl font-bold …">` (`adminUi.tsx:24`) | Cùng app 2 kích thước h1; hierarchy thị giác lệch | Chuẩn hoá về `AdminPageHeader` (đã có) hoặc đổi Core* về `text-2xl` | S |
| F4 | P2 | 7 trang tenant-admin | Không import `ShellSkeleton`. Ví dụ `TenantAdminAIPolicyPage.tsx:96` chỉ render `<p>{t("common.loading")}</p>` | Không có affordance loading; layout shift | Thay text loading bằng `<ShellSkeleton variant="card" count={…} />` như `TenantAdminSettingsPage.tsx:111` | S |
| F5 | P2 | `TenantAdminCapabilitiesPage.tsx:26-37` | `CAP_CSS` với `.capProgress { background: rgba(255,255,255,0.06) }` và `.capCard { background: var(--bg-shell-surface) }`; không có `dark:` pair | Trên theme sáng, progress track gần như vô hình | Chuyển sang class shell token hoặc thêm dark pair | S |
| F6 | P2 | 15 trang admin | Không dùng skeleton, chỉ text trong `AdminEmptyState` (`AdminAnalyticsPage:108` `loading ? t('adminAnalytics.loading') : …`); tenant-admin có `ShellSkeleton` | Trải nghiệm loading khác nhau giữa 2 khu vực cùng app | Chuẩn hoá admin về skeleton (tạo `AdminSkeleton`?) hoặc chấp nhận text — cần quyết định | M |
| F7 | P2 | `SupportPage.tsx` | grep `<h1\|<h2` = 0 kết quả | User-facing support page thiếu heading cho screen reader / landmark | Thêm `<h1>` (hoặc dùng ShellPageChrome) bọc SupportPage | S |
| F8 | P3 | `ShellOperationsCenterPage.tsx:98-100`, `AdminCoreOverviewPage.tsx:20` | Render literal "OPERATIONS CENTER"/"LIVE", "Healthy" | Không i18n | Chuyển sang `t(...)` với default | S |

### 5.6 Điểm tốt settings/admin/tenant (4)
1. **adminTone.ts** (`pages/admin/adminTone.ts:13-48`) là SSOT tone pill dual-mode (light+dark) — giải quyết contrast 1.3:1 → 4.5:1; tất cả admin dùng chung.
2. **adminUi.tsx** kit (`pages/admin/adminUi.tsx:16-101`) gom Panel/MetricCard/ValueRow/EmptyState, giảm drift; doc rõ "new admin UI must compose from this kit".
3. **Tenant-admin ShellPageChrome** (`ShellPageTemplate.js:90-149`) render h1 + `aria-labelledby` + error/notice banner với `role="alert"/"status"` + `aria-live` — a11y tốt.
4. **URL state sync** (`useUrlState`) nhất quán ở admin Core* và tenant-admin (filters/page deep-link), ví dụ `AdminCorePATsPage.tsx:43-54`, `TenantAdminMembersPage.tsx:14-30`.

---

## 6. SOC / DataOps (deep — Agent 5)

### 6.1 Topology
- Entry: `ShellOperationsCenterPage.tsx` (109d) — 9 tab lazy-load qua `React.lazy` + `Suspense` (dòng 7-15, 52-75): overview, signals, dataops, prefetch, screener, vnbroker, broker, runtime-kpi, dnse-backfill. Tab state đồng bộ URL `?tab=` (dòng 41-50).
- DataOps sub-tab: 5 tab (inventory/operations/monitor/scheduler/config) — `SocDataOpsPanel.tsx:13-19`.
- Signals sub-tab: 7 (overview/job-console/materialization/config/detection/retention/rules) — `SocSignalsPanel.tsx:277`.
- Pattern chung: `createElement` (không JSX), `useI18n` cast `as unknown as { t; localeTag }`, adapter cast `defaultCoreApiAdapter as unknown as {...}` (đúng convention AGENTS).

### 6.2 Bố cục tổng thể SOC
- **Shell**: `ShellPageChrome` title/description (ShellOperationsCenterPage.tsx:89-94) + eyebrow "OPERATIONS CENTER · LIVE" (dòng 96-101) + `SocTabNavigation` (dòng 102-106).
- **Panel layout**: `glassPanel` (bg rgba 081734 0.4 + blur 8px) → header eyebrow/title/description → `metricGrid` (KPI cards) → `sectionCard` (form/bảng) → pagination/empty/error. CSS: `soc.components.css:108-120` (glassPanel), `:591-596` (metricGrid), `:123-129` (sectionCard).
- **KPI cards**: Overview 7 metric (total/healthy/degraded/critical/maintenance/unknown/disabled) — `SocOverviewPanel.tsx:97-105`. DataOps hero 4 (totalRows/queuePending/running/failed) — `SocDataOpsPanel.tsx:21-26`. Vnbroker KPI 4 (primary/fallback/ready/breaker).
- **Bảng**: `coverageTable` (DataOps), `CommercialTable` (Vnbroker/Broker), audit table (Config). Phân trang client-side + URL sync (`useUrlState`).
- **Form**: Vnbroker config form (timeout/retry/rate-limit/circuit-breaker) với `htmlFor` labels đầy đủ; DataOps config form với `NumberInput` + `SocQueueTierFieldSet`; Screener config form.
- **Modal**: `SocConfigPreviewModal` (dialog role, before/after diff JSON), toggle confirm modal (Overview), ActionConfirmModal (Scheduler), Mute modal (Signals), Rule modal (Signals/Screener).

### 6.3 God-file — Top 8 panel theo số dòng
| # | File | Dòng | Lý do lớn |
|---|------|------|-----------|
| 1 | `soc.components.css` | 4061 | Toàn bộ CSS SOC (không tách module) |
| 2 | `SocSignalsPanel.tsx` | 2330 | 7 sub-tab + feed/trieage/rules/materialization trong 1 file |
| 3 | `SocVnbrokerPanel.tsx` | 1335 | Config form + provider table + benchmark + observation |
| 4 | `SocOverviewPanel.tsx` | 1118 | KPI + filter + grid + pagination + modal |
| 5 | `SocDataOpsMonitorSection.tsx` | 1028 | Matrix + coverage + gaps + queue depth + parity/retention/anomaly |
| 6 | `SocDataOpsConfigSection.tsx` | 971 | Config form + audit trail + revert + export |
| 7 | `SocDataOpsOperationsSection.tsx` | 845 | Backfill form + planner + run logs |
| 8 | `SocSchedulerBoard.tsx` | 759 | Health strip + table + confirm modal + history drawer |

`SocSignalsPanel` là god-file nghiêm trọng nhất (2330 dòng, 189 `t()` calls).

### 6.4 i18n
- soc namespace ~1261 key (vi.js/en.js). Top panel theo `t()` calls: SocSignalsPanel 189, SocVnbrokerPanel 111, SocDataOpsMonitorSection 94, SocDataOpsConfigSection 85, SocOverviewPanel 80, SocDataOpsOperationsSection 62, SocBrokerPanel 56, SocSchedulerBoard 54, SocScreenerPanel 45.
- Hardcoded/fallback text ví dụ:
  - `SocOverviewPanel.tsx:570` aria-label `t(...,{defaultValue:"Retry"})` nhưng dòng 573 button label `t(...,{defaultValue:"Thử lại"})` — cùng nút 2 default khác nhau.
  - `SocSchedulerBoard.tsx:366` nút đóng drawer `aria-label: "Close"` (hardcoded English, không i18n).
  - `SocDataOpsMonitorSection.tsx:950,961,966` filter dropdown default `"All datasets"` / `"All states"` / `"Clear"` (English fallback).
  - `SocDataOpsMonitorSection.tsx:339-340` stream status label `"Live"` / `"Connecting"` / `"Reconnecting"` / `"Polling"` (English).
  - `SocBrokerPanel.tsx:141,149-157` helper `wv()` dùng default tiếng Việt trực tiếp (vd `"Lần chạy cuối"`, `"Chưa có lần chạy nào trong 24h."`).
  - `ShellOperationsCenterPage.tsx:107` Suspense fallback `"Loading..."` hardcoded.

### 6.5 Accessibility (a11y)
- Tổng: 86 `aria-*`, 45 `role:`, chỉ **2 `scope:`** trên toàn bộ SOC → đa số `<th>` không có `scope="col"`.
- Bảng thiếu scope: `SocBrokerPanel.tsx:519-525` (5 `<th>` audit table), `SocDataOpsMonitorSection.tsx:873-881` (coverage matrix th), `SocSchedulerBoard.tsx:655-665` (8 th).
- Form label tốt: Vnbroker dùng `htmlFor` đầy đủ (dòng 897-1106); Screener manual scan input **không** có `aria-label` (`SocScreenerPanel.tsx:438-446`).
- SocConfigPreviewModal tốt: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus vào confirm, Escape đóng, focus restore (dòng 86-90, 59-74).
- SocVnbrokerPanel tốt: `aria-required`, `aria-invalid`, `aria-describedby`, `aria-live` regions (dòng 1106-1148).
- Drawer close button hardcoded `"Close"` (a11y label không dịch).

### 6.6 Theming
- Tokens: `soc.tokens.css` 211 dòng — `:root` (dòng 5-140) + `:root[data-theme="light"]` override (dòng 143-217). Status tokens `--soc-status-*` (dòng 135-139). Light override remap đầy đủ (muted/badge xanh/đỏ).
- Hard hex trong TSX: 61 occurrences, phần lớn là fallback trong `var(--token, #hex)` (pattern chấp nhận được). Standalone đáng chú ý:
  - `SocOverviewPanel.tsx:160` `color: "#000"` trong `<mark>` highlight.
  - `SocOwnershipBadge.tsx:31-38` hardcoded `rgba(16,185,129,0.2)` / `rgba(239,68,68,0.2)` thay vì token.
  - `SocConfigPreviewModal.tsx:225` confirm button `background: rgba(22,215,160,0.2)`.
- Màu tăng (xanh) / giảm (đỏ) Bloomberg đúng (token `--pf-gain`/`--pf-loss` + comment Owner 2026-10-13, soc.tokens.css:40-44).

### 6.7 States (loading / empty / error)
- Loading skeleton: Overview (dòng 512-561), Vnbroker (dòng 668-674, 881-886), DataOps monitor (dòng 441-447), DataOps inventory.
- Empty state: 38 occurrences `emptyState` (vd Overview dòng 886-894, Screener dòng 376-379, 468-469, 501-502).
- Error banner: 56 occurrences `inlineError` (vd Overview dòng 563-575, 866-873).
- Inconsistent: `SocDataOpsConfigSection.tsx:633-635` loading chỉ trả `<p emptyState>` text (không skeleton). `SocBrokerPanel.tsx:297-299` loading chỉ text `"soc.broker.loading"`. `SocDataOpsPanel.tsx:124` error banner dùng `bannerNotice` (màu xanh) thay vì `inlineError` (đỏ) — семантика sai cho lỗi.

### 6.8 Findings SOC (8)

| ID | Mức | File:line | Evidence | Impact | Đề xuất | Effort |
|----|-----|-----------|----------|--------|---------|--------|
| F-01 | P1 | `SocBrokerPanel.tsx:519-531`, `SocSchedulerBoard.tsx:655-665`, `SocDataOpsMonitorSection.tsx:873-881` | Chỉ 2 `scope:` toàn repo SOC; `<th>` không có `scope="col"` | Screen reader không liên kết header/cell; WCAG 1.3.1 | Thêm `scope="col"` vào mọi `<th>` trong 3 bảng | S |
| F-02 | P2 | `SocOverviewPanel.tsx:570,573` | Cùng nút Retry: aria-label default "Retry" (EN) nhưng label default "Thử lại" (VI) | i18n scan + UX ngôn ngữ lẫn lộn | Thống nhất default "Thử lại" | XS |
| F-03 | P2 | `SocSchedulerBoard.tsx:366` | `aria-label: "Close"` hardcoded | Không dịch, a11y label sai locale | `t("soc.actions.close")` | XS |
| F-04 | P2 | `SocDataOpsMonitorSection.tsx:950,961,966` | Filter dropdown default `"All datasets"`/`"All states"`/`"Clear"` | UI tiếng Việt hiện English nếu key thiếu | Đổi default sang tiếng Việt hoặc bảo đảm key tồn tại | S |
| F-05 | P2 | `SocDataOpsMonitorSection.tsx:339-340` | Stream status label `"Live"`/`"Connecting"`/`"Reconnecting"`/`"Polling"` hardcoded | Không dịch | Map sang `t("soc.dataops.stream_*")` | S |
| F-06 | P1 | `SocSignalsPanel.tsx` (2330 dòng), `SocVnbrokerPanel.tsx` (1335) | God-file, 7/4 sub-tab trong 1 component | Maintainability, test coverage khó | Tách sub-tab thành component riêng theo pattern DataOpsPanel | L |
| F-07 | P3 | `SocOwnershipBadge.tsx:31-38`, `SocConfigPreviewModal.tsx:225` | Hardcoded rgba green/red/emerald thay vì token | Light-mode mismatch, không đồng bộ theme | Dùng `var(--soc-rgb-10b981)` / `var(--accent-emerald)` | S |
| F-08 | P3 | `ShellOperationsCenterPage.tsx:107` | Suspense fallback `"Loading..."` hardcoded | Không dịch | `t("common.loading")` | XS |

Bonus: `SocDataOpsPanel.tsx:124` error banner dùng `bannerNotice` (xanh) thay vì `inlineError` (đỏ) — семантика sai, nên sửa cùng F-07.

### 6.9 Điểm tốt SOC (4)
1. `SocConfigPreviewModal.tsx:86-90,59-74` — dialog semantics chuẩn (role/aria-modal/labelledby, focus trap, Escape, focus restore).
2. `SocVnbrokerPanel.tsx:1106-1148` — form a11y đầy đủ (aria-required/invalid/describedby, aria-live regions).
3. `SocOverviewPanel.tsx:512-561` — skeleton loading + empty + error states đầy đủ; URL state sync qua `useUrlState`.
4. `soc.tokens.css:143-217` — light-mode override toàn diện; color semantics tăng=xanh/giảm=đỏ Bloomberg đúng (Owner chốt 2026-10-13).

---

## 7. AI surfaces / Commercial / Cross-cutting (deep — Agent 6)

### 7.1 AI surfaces
- `AICommandCenterPage.tsx:205-472` bọc trong `AISettingsErrorBoundary` (title i18n qua createTranslator từ localStorage — fallback an toàn khi không có Provider, `AISettingsErrorBoundary.tsx:41-46`).
- Header `h1` + desc (`:211-218`), `Breadcrumb` (`:222`), `AiHubNav` (`:232`) ⇒ 5 tab route: Tổng quan/Usage/Traces/SLO/Audit (staff-only).
- `AiHubNav.tsx:68-114` filter tab theo `isStaff` từ `userIdentity` (cùng nguồn với `StaffRoute`) ⇒ nhất quán. Tab preserve filter qua `pickKeys` (`:37-46`) và snapshot audit (`:16-35`).
- `AIUsageAnalyticsPage.tsx:16-23` **không** có `ShellPanel`/header container riêng, chỉ `div.page` + Breadcrumb + AiHubNav + h1 + dashboard ⇒ bố cục không đồng nhất với Command Center (thiếu overview shell).
- `AIAuditPage.tsx:39` staff guard kép (route + local `isStaff`), empty/error qua `useRetryableAsync`.
- `AICommandTracesPage.tsx` + `AISloDashboardPage.tsx` đều import `AiHubNav` + `Breadcrumb` ⇒ navigation nhất quán.
- Form & dirty-guard: `AICommandCenterForm.tsx:154-251` quản lý 12+ state; dirty qua `fieldsDirty` + `externalDirty` (promptConfig) (`:179-180, 122`). `AICommandCenterPage.tsx:93-100` đăng ký `beforeunload` khi `promptConfigDirty || formFieldsDirty` ⇒ guard rời trang. `shouldSendPromptConfig(promptConfig, dirty)` (`:42-47`) pure export — chỉ gửi prompt config khi drawer dirty ⇒ tránh ghi đè âm thầm. Preview trước lưu + conflict 409 (`AICommandCenterForm.tsx:183-191`) ⇒ UX an toàn. Optimistic lock qua `lastUpdatedAt`/`config_updated_at` (`:182, 290-292`).
- Empty states có `data-testid` (`system-prompt-empty`, `prompt-history-empty`) và `—` cho null (SLO `dash()`: `AISloDashboardPage.tsx:56-59`). Notice auto-clear 3s với cleanup unmount (`AICommandCenterPage.tsx:83-90`). i18n keys dùng namespace `aiCommandCenter.*` thống nhất; `AIAuditPage` dùng `formatDate`.
- A11y trong AI: `AiHubNav.tsx:125` set `aria-current="page"` cho tab active ⇒ tốt. `AICommandCenterPage.tsx:271` `aria-busy` trên metric grid; checkbox toggle có `<label htmlFor>` (`:295`) ⇒ accessible name đúng. `Breadcrumb.tsx:96-98` nav không có `aria-label` ⇒ screen reader không biết là breadcrumb; link dùng `<a href>` thay vì router `Link` ⇒ full reload khi click breadcrumb. `AISettingsErrorBoundary.tsx:50` button retry không có `aria-live`/focus management; fallback không announce. `AICommandCenterPage.tsx:370-375` quota bar là `div` với width %, không có `role="progressbar"`/`aria-valuenow` ⇒ không đọc được tiến trình.
- Consistency giữa 5 trang: Tất cả dùng `aiSettings.module.css` + `ShellPanel`? `AIUsageAnalyticsPage` không dùng ShellPanel (chỉ div.page) ⇒ style không đồng nhất. `AIAuditPage`/`Traces`/`SLO` đều có `useRetryableAsync` (retry + loading) ⇒ nhất quán; `AICommandCenterPage` tự quản loading qua form. Staff gating: AiHubNav ẩn tab audit cho non-staff; `AIAuditPage` local guard; SLO/Traces không staff-gate ⇒ đúng theo thiết kế.
- `AIUsageAnalyticsPage.tsx:20` dùng `t("routes.aiUsageAnalytics")` cho title (khác pattern `aiCommandCenter.title`) ⇒ không đồng nhất naming giữa các trang.

### 7.2 Commercial
- `BillingCenterPage.tsx:1-120` inject CSS qua template string `BILLING_CUSTOM_STYLES`; responsive breakpoints tự khai báo `@media (max-width: 1024px)` và `640px` (`:15-32`) ⇒ không dùng token. Dùng `ShellPageChrome/ShellPanel/ShellField` ⇒ nhất quán với app. Plan card `.plan-card` hover transform `translateY(-3px)` (`:50`) không respect `prefers-reduced-motion`.
- `PaymentReturnPage.tsx:4-31` tự định nghĩa `useI18n` trả map tiếng Việt cứng, `language: 'vi'` ⇒ trang kết quả thanh toán không bao giờ theo locale EN; toàn bộ chuỗi đã hardcode trong component, vi phạm i18n SSOT và lệch với `LangContext`. Dùng `ShellPageChrome, ShellPanel` ⇒ layout nhất quán. Icon status 72×72 (`:43-44`) không có alt/text alternative.
- `UpgradePage.tsx:18-49` `PLAN_DEFS` rebuild mỗi render với `t(..., { defaultValue })` ⇒ key có thể không tồn tại trong vi/en (fallback luôn tiếng Việt). Dùng Tailwind classes hardcoded (`border-slate-700 bg-slate-900/70` `:21`) ⇒ theme không theo token; dark-only. `Link` to dashboard/watchlist ⇒ CTA rõ.

### 7.3 Cross-cutting i18n
- Cơ chế runtime: `LangContext.js:19-29` init từ `localStorage('lang')`, sync với `userConfig.language` (`:34-46`), `setLanguage` persist + updateUserConfig (`:48-68`). `i18n/index.js:1-21` dictionary {vi,en}, `normalizeLocale` fallback vi. `createTranslator` nested get + defaultValue (`:31-54`). Fallback constant `I18N_FALLBACK` (`LangContext.js:113-131`) là module-level const ⇒ tránh identity change mỗi render (đã document). `AISettingsErrorBoundary` dùng `createTranslator(normalizeLocale(localStorage))` (`:42-46`) ⇒ class component không hook được, hợp lý.
- Namespace split đề xuất: Hiện tại 1 file `vi.js`/`en.js` monolith (358/314 KB) chứa mọi namespace phẳng. Đề xuất: split theo route/feature (`ai.*`, `commercial.*`, `soc.*`, `common.*`) và load lazy theo route; nhưng đang dùng static import ⇒ cần refactor loader. Effort lớn.
- Key reuse / conflicting defaults: i18n scanner config `i18next-scanner.config.cjs:7-21` quét `src/**/*.{js,jsx,ts,tsx}` trừ test/i18n/node_modules/dist/vninvestcharts. `i18n:scan:strict` (`scripts/i18n-scan-strict.mjs`) chỉ bắt parse error `Unable to parse` ⇒ không bắt key thiếu hay default conflict. Scanner output có cảnh báo "different default value" nhưng không fail. `check:i18n-hardcoded` chỉ quét 5 path (`package.json:33`) ⇒ coverage hẹp; 242 file khác chứa tiếng Việt có dấu (grep count) không được kiểm.
- Hardcoded scan coverage: Grep tiếng Việt có dấu ngoài `i18n/`+tests: 242 file, 4118 matches ⇒ phạm vi hardcode lớn, gate hiện tại không cover.

### 7.4 A11y tổng hợp (grep counts trên src) — xem §1.1 (aria-label 253, alt= 2, scope= 63, min-height 44/48px 2 occurrences).

Gaps chính: icon-only button thiếu `aria-label` nhất quán; progress bar quota không có role; breadcrumb không có `aria-label`/`aria-current`; error boundary không announce.

### 7.5 Responsive
- Breakpoints phân mảnh: 480, 520, 640, 700, 768, 900, 980, 1024, 1099, 1100, 1180, 1279, 1280 (22 distinct media queries).
- `@media (prefers-reduced-motion: reduce)` = 6 occurrences ⇒ animation hover transform chưa được guard đồng bộ.
- `@media (pointer: coarse)` = 2 ⇒ touch detection có nhưng ít.
- Fixed px: 2160 occurrences trong CSS, nhiều giá trị arbitrary (13px, 11px...) ⇒ không theo spacing token.
- Safe-area: `index.css:837-882` xử lý safe-area cho body/header/sidebar ⇒ tốt, nhưng chỉ ở shell level.
- Touch target min-height 44px chỉ 2 chỗ ⇒ mobile ergonomics yếu.

### 7.6 Performance / bundle
- `dist/assets` chunks: `widget` 2171 KB, `echarts` 712 KB, `i18n` 539 KB, `xlsx` 419 KB, `react-vendor` 298 KB.
- `vite.config.ts:49-103` manualChunks tách nhóm; `widget`/`echarts`/`xlsx` lazy-ish qua route? `xlsx` không lazy (import trực tiếp?) cần kiểm.
- Lazy components: 13 `lazy()` trong src (SOC panels, Whale chart, Prompt drawer, Audit logs, widget chart) ⇒ code-split tốt cho admin/SOC.
- `Suspense` chỉ 1 occurrence (`AICommandCenterPage.tsx:465`) ⇒ các lazy khác có thể thiếu Suspense boundary? Need verify.
- `i18n` chunk 539 KB tải mọi route ⇒ bottleneck lớn nhất cho first load.
- `chunkSizeWarningLimit: 1000` (`vite.config.ts:48`) che warning cho widget 2171 KB.

### 7.7 Findings AI/commercial/cross-cutting (top 10)

| # | Mức | File:line | Evidence | Impact | Đề xuất | Effort |
|---|---|---|---|---|---|---|
| F1 | P0 | `PaymentReturnPage.tsx:4-31` | Tự định nghĩa `useI18n()` trả map vi cứng, `language:'vi'` | Kết quả thanh toán không localize; EN user thấy vi | Dùng `useI18n` từ LangContext + key trong vi/en | S |
| F2 | P0 | `i18n/vi.js` (358KB) + `en.js` (314KB) | dist chunk i18n 539KB | Mọi route tải 539KB dictionary | Split namespace + lazy load theo route | L |
| F3 | P1 | `src` (grep `alt=` = 2) | Chỉ 2 `<img>` có alt | Screen reader không đọc icon/image | Audit icon-only buttons, thêm aria-label/alt | M |
| F4 | P1 | `src` CSS (min-height 44/48px = 2) | Touch target <44px phổ biến | Mobile ergonomics yếu | Chuẩn hóa min-height 44px cho interactive | M |
| F5 | P1 | `src` (22 distinct @media) | Breakpoints phân mảnh | Inconsistent responsive | Định nghĩa breakpoint tokens trong soc.tokens.css/index.css | M |
| F6 | P1 | `UpgradePage.tsx:18-49` | `t(...,{defaultValue})` trong render loop | Key thiếu không bị phát hiện; en fallback vi | Dời t() ra ngoài + thêm key vào vi/en | S |
| F7 | P1 | `Breadcrumb.tsx:96-117` | `<a href>` thay vì Link; nav không aria-label | Full reload; SR không biết breadcrumb | Dùng Link + aria-label/aria-current | S |
| F8 | P2 | `AIUsageAnalyticsPage.tsx:16-23` | Không ShellPanel, title dùng `routes.aiUsageAnalytics` | Bố cục/i18n không đồng nhất với CC | Bọc ShellPanel + dùng `aiCommandCenter.tabUsage` | S |
| F9 | P2 | `AICommandCenterPage.tsx:370-375` | Quota bar div width %, không role | SR không đọc tiến trình | Thêm role="progressbar" + aria-valuenow/min/max | S |
| F10 | P2 | `vite.config.ts:48` | `chunkSizeWarningLimit: 1000` | Che warning chunk >1MB (widget 2171KB) | Hạ limit hoặc tách widget lazy theo route | S |
| F11 | P3 | `BillingCenterPage.tsx:7-32` | CSS template string + breakpoints tùy ý | Style không theo token | Move CSS vào module + token breakpoints | M |
| F12 | P3 | `check:i18n-hardcoded` (package.json:33) | Chỉ quét 5 path | 242 file hardcode vi không bị gate | Mở rộng scope scan toàn src (trừ test/i18n) | M |

### 7.8 Điểm tốt AI/commercial/cross-cutting (5)
1. **Dirty-guard + beforeunload + preview/conflict 409** trong `AICommandCenterForm`/Page ⇒ UX an toàn cho config.
2. **Lazy code-split** cho SOC panels + widget chart + audit logs ⇒ admin bundle không tải chart nếu không cần.
3. **Staff gating nhất quán** qua `userIdentity` ở AiHubNav + AIAuditPage + system prompt panel.
4. **Safe-area + touch-action manipulation** ở `index.css:837-882` ⇒ mobile shell handled.
5. **i18n fallback identity stable** (module-level const) ⇒ tránh infinite effect loop (documented).

---

## 8. Consolidated findings (P0–P3) — tổng hợp từ 6 sub-agent

### P0 — Blocking (6)

| ID | Issue | Location | Impact/Standard | Fix | Effort |
|---|---|---|---|---|---|
| P0-1 | Bundle `widget` 2.2MB eager | `StockDetailPage.tsx:20`, `PortfolioOverviewPage.tsx:15`, `PortfolioAnalyticsPage.tsx:25`, `WatchlistDetailPanel.tsx` | TTI chậm, mobile data | Dynamic import widget; lazy-load chart component | M |
| P0-2 | Theming = override theo page + 141+ hard hex | `index.css:335-445`, `soc.components.css`, `light-theme.css`, `brokerData.css` | Light mode vỡ; WCAG 1.4.3 | Token swap thật sự; migrate hex → token; `check:tokens` xanh | L |
| P0-3 | `check:tokens` FAIL | gate 2026-10-30 | Gate UI không xanh | Allowlist chỉ status/chart/private; migrate còn lại | M |
| P0-4 | Form không chuẩn hoá (0 RHF/zod trên 100 trang) | grep counts | Validation không nhất quán | RHF+zod cho form mới + shared FormField; migrate auth/portfolio/settings | L |
| P0-5 | i18n monolith (672 KB) + key reuse conflicting defaults | `vi.js`/`en.js`, i18n-scan strict warnings | Merge conflict, nghĩa sai | Split namespace; dedup key; fix conflicting defaults | L |
| P0-6 | State coverage: 97% không ErrorState, 87% không Skeleton | §1.2 ma trận | UX production chưa sẵn sàng | Chuẩn hoá ShellSkeleton/ShellEmptyState/PageErrorBoundary trên mọi trang | L |

### P1 — Major (17)

| ID | Issue | Location | Impact/Standard | Fix | Effort |
|---|---|---|---|---|---|
| P1-7 | 9 trang prod 0 i18n calls | §1.3 | Text hardcode | Migrate text → t() | M |
| P1-8 | 75/100 trang không aria-label; 100/100 không alt; chỉ 2 `<img>` alt | §1.1, §7.4 | Screen reader | axe scan + thêm aria-label/alt | M |
| P1-9 | i18n hardcoded scan chỉ 5 file | `package.json:33` | Coverage hẹp | Mở rộng scan sang src/pages + src/components | S |
| P1-10 | Navigation label `layout.nav.soc` chứa admin-users/advertising | `navigationCatalog.js:28-33` | Wayfinding sai | Đổi label "Quản trị", tách Operations Center | S |
| P1-11 | God-file component (>500 dòng) ×19 | §1.7 | Maintainability | Split theo seam (giữ re-export shim) | L |
| P1-12 | CSS god-file (StockDetail 2876, TenantAdmin 2518, aiSettings 1249, soc.components 4561) | css_inventory | Maintainability | Split theo feature/tab | M |
| P1-13 | Fixed min-width rủi ro overflow mobile | `soc.tokens.css:125-126` | Horizontal scroll 320px | `min()`/`clamp()`; test 390px | S |
| P1-14 | i18n key reuse conflicting defaults | i18n-scan strict warnings | Nghĩa sai tuỳ chỗ | Dedup + rename key | M |
| P1-15 | Light-mode override theo class page | `index.css:335-445` | Class mới không được phủ | Override theo nhóm utility + checklist | M |
| P1-16 | Widget chunk eval warning | build output | Security/perf | Kiểm tra widget source / thay thế | S |
| P1-17 | Lazy-load chưa đồng bộ (chỉ AICommandCenterPage) | `AICommandCenterPage.tsx:20-22` | TTI | Mở rộng `lazy()` cho chart heavy | M |
| P1-18 | Nested `<main>` landmark ở auth pages | `AuthLoginPage.tsx:129,141` | a11y landmark count >1 | Đổi `<main>` → `<div role="region">`/`<section>` | S |
| P1-19 | Hard-hex leakage 694 trong tsx/js không bị gate | `WatchlistTable.tsx:61`, `WhaleBubbleChart.jsx:41` | Light mode vỡ, drift | Mở rộng `check:tokens` quét `.tsx/.js` + siết allowlist | L |
| P1-20 | Admin nav chỉ expose 4/30 route | `navigationCatalog.js:28-33` | Wayfinding kém | Nhóm admin items đầy đủ hoặc submenu | M |
| P1-21 | 3 thang spacing/type song song | `index.css:97-106`, `theme/tokens.css:22-42`, soc `:24-77` | Không nhất quán, drift | Unify alias | M |
| P1-22 | Login full reload | `AuthLoginPage.tsx:58,104` `window.location.assign` | Mất SPA state | `useNavigate` | S |
| P1-23 | Table `<th>` không có `scope="col"` (admin + tenant-admin + SOC) | grep `scope=` = 63 (SOC chỉ 2); ví dụ `AdminCoreTenantsPage.tsx:281`, `SocBrokerPanel.tsx:519-525` | WCAG 1.3.1 | Thêm `scope="col"` (~14 bảng admin + 3 bảng SOC) | S |

### P2 — Minor (12)

| ID | Issue | Location | Fix | Effort |
|---|---|---|---|---|
| P2-24 | 28 distinct breakpoints phân mảnh | src CSS (22 distinct @media) | Định nghĩa breakpoint tokens | M |
| P2-25 | Touch target <44px phổ biến (chỉ 2 occurrences 44/48px) | src CSS | Chuẩn hóa min-height 44px cho interactive | M |
| P2-26 | Fixed px 2160 occurrences trong CSS | src CSS | Migrate arbitrary px → spacing token | L |
| P2-27 | `StaffRoute` toast có thể lặp | `StaffRoute.tsx:28-32` | Guard bằng ref `hasToasted` | S |
| P2-28 | Mobile drawer không đóng khi điều hướng | `FullLayout.tsx:14,35-43` | `useLocation` close on change | S |
| P2-29 | Form validation tự dựng (PortfolioFormDialog, auth, settings) | 0 RHF/zod | RHF+zod + shared FormField | L |
| P2-30 | Money format rải rác (`toLocaleString` vs `formatVnd`) | Overview L42, Holdings L57-70, Activity L46 vs manage/format.ts | Chuẩn hoá về helper | M |
| P2-31 | Activity timeline grid cố định không responsive | `PortfolioWorkspace.css:647` | Thêm `@media (max-width:640px)` stack | S |
| P2-32 | Affordance chết "Chi tiết" disabled vĩnh viễn | `PortfolioHoldingsPage.tsx:351` | Wire handler hoặc xoá cột | S |
| P2-33 | Modal không focus trap (PortfolioFormDialog) | `PortfolioFormDialog.tsx:86-92` | Thêm trap như drawer (L195-222) | S |
| P2-34 | Plan card `<div onClick>` không keyboard | `BillingCenterPage.tsx:562-579` | Đổi thành `<button>` hoặc thêm role+onKeyDown | S |
| P2-35 | UpgradePage `t()` không defaultValue | `UpgradePage.tsx:56` | Thêm defaultValue; thêm CTA thanh toán | S |

### P3 — Polish (8)

| ID | Issue | Location | Fix |
|---|---|---|---|
| P3-36 | SOC panels dùng `soc.module.css` barrel — verify class resolve | `SocVnbrokerPanel.tsx:13` | Đọc CSS build (L-F11) trước khi kết luận; migrate sang soc.components class |
| P3-37 | Skip link trong index.html chưa verify | `index.css:777-799` | Verify `<a class="skip-link" href="#main-content">` |
| P3-38 | `ShellStockDetailPage.css` 2876 dòng | CSS file | Split theo tab |
| P3-39 | `SocSignalsPanel.tsx` 2330 dòng, `SocVnbrokerPanel.tsx` 1335 dòng | God-file | Tách sub-tab thành component riêng theo pattern DataOpsPanel |
| P3-40 | `SocDataOpsPanel.tsx:124` error banner dùng `bannerNotice` (xanh) thay vì `inlineError` (đỏ) | семантика sai | Đổi class |
| P3-41 | `SocOverviewPanel.tsx:570,573` cùng nút Retry default "Retry" vs "Thử lại" | i18n default khác nhau | Thống nhất default "Thử lại" |
| P3-42 | `SocSchedulerBoard.tsx:366` `aria-label: "Close"` hardcoded | Không dịch | `t("soc.actions.close")` |
| P3-43 | `ShellOperationsCenterPage.tsx:107` Suspense fallback `"Loading..."` hardcoded | Không dịch | `t("common.loading")` |

---

## 9. Positive findings (tổng hợp)

1. **A11y baseline tốt**: focus-visible global (`index.css:142-145`), skip link clip-path (`index.css:777-799`), reduced-motion global (`index.css:810-819`), touch 44px coarse (`index.css:901-926`), safe-area (`index.css:880-883`), tabular-nums (`index.css:828-831`).
2. **AlertCenterPage a11y dẫn đầu**: `aria-live="polite"` + `aria-busy` L668, `role="alert"` L655/L670, `role="status"` L589, lane tabs `aria-pressed` L74 (`FilterBar.tsx`).
3. **WatchlistTable**: TanStack sort/filter/pagination + react-window virtualization + aria-label đầy đủ (aria=16). Sparkline `role="img"` + `<title>` (L57-58).
4. **StockDetailPage error/empty states đầy đủ**: empty L237-248, error có retry L250-270, bg glow `aria-hidden` L327-328; loading tách blocking/deferred L111-112.
5. **WhaleAdvisoryPage network error mapping B4**: không hiện raw "Failed to fetch" (L424-428), grid breakpoint `lg` có giải thích shell max-width (L386-395), sticky sidebar (L476).
6. **PortfolioManageDrawer** focus trap + restore focus (L195-227, L224-227) — modal chuẩn WCAG.
7. **Holdings** sort số + URL state deep-link + codec an toàn (L75-86, L189-200) — tránh injection sortKey.
8. **KPI partial state** trung thực: thiếu giá ⇒ "Tạm tính" + reason (PortfolioManageKpi L35-38, L83-92) — không bịa 0.
9. **Empty/loading/error states** nhất quán across tab con và manage table (L225-266 PortfoliosPage).
10. **adminTone.ts** (`pages/admin/adminTone.ts:13-48`) SSOT tone pill dual-mode — giải quyết contrast 1.3:1 → 4.5:1.
11. **adminUi.tsx** kit (`pages/admin/adminUi.tsx:16-101`) gom Panel/MetricCard/ValueRow/EmptyState, giảm drift.
12. **Tenant-admin ShellPageChrome** (`ShellPageTemplate.js:90-149`) render h1 + `aria-labelledby` + error/notice banner với `role="alert"/"status"` + `aria-live` — a11y tốt.
13. **URL state sync** (`useUrlState`) nhất quán ở admin Core* và tenant-admin.
14. **SocConfigPreviewModal** dialog semantics chuẩn (role/aria-modal/labelledby, focus trap, Escape, focus restore).
15. **SocVnbrokerPanel** form a11y đầy đủ (aria-required/invalid/describedby, aria-live regions).
16. **SocOverviewPanel** skeleton loading + empty + error states đầy đủ; URL state sync qua `useUrlState`.
17. **soc.tokens.css:143-217** light-mode override toàn diện; color semantics tăng=xanh/giảm=đỏ Bloomberg đúng (Owner chốt 2026-10-13).
18. **Dirty-guard + beforeunload + preview/conflict 409** trong `AICommandCenterForm`/Page ⇒ UX an toàn cho config.
19. **Lazy code-split** cho SOC panels + widget chart + audit logs ⇒ admin bundle không tải chart nếu không cần.
20. **Staff gating nhất quán** qua `userIdentity` ở AiHubNav + AIAuditPage + system prompt panel.
21. **Safe-area + touch-action manipulation** ở `index.css:837-882` ⇒ mobile shell handled.
22. **i18n fallback identity stable** (module-level const) ⇒ tránh infinite effect loop (documented).
23. **Auth validation SSOT + Turnstile fail-loud prod** (`authPolicy.js`, `TurnstileWidget.js:51-65`) + bootstrap retry (`main.tsx:108-132`).

---

## 10. Roadmap nâng cấp chuẩn công nghiệp (phased, có AC)

### Phase A — Foundation (1-2 sprint)
- Đóng `check:tokens` xanh (migrate hard hex).
- Gom light-mode overrides vào `soc.tokens.css :root[data-theme="light"]`.
- Chạy `check:contrast` + `check:light-theme` (nếu có) xanh.
- **AC:** `npm run check:tokens` exit 0; `npm run check:contrast` pass; build pass.
- **Gate:** tsc 0 + lint 0 errors + check:shell xanh.

### Phase B — Consistency (2-3 sprint)
- Form standard (RHF+zod + `FormField` primitive); migrate auth/portfolio/settings.
- States (ShellSkeleton/ShellEmptyState/PageErrorBoundary) trên mọi trang.
- icon-button aria-label; table th scope.
- **AC:** 100% trang prod có ErrorState; 100% form dùng RHF; aria-label coverage ≥80%.
- **Gate:** lint warnings giảm <1000; a11y scan pass.

### Phase C — Performance & bundle (1-2 sprint)
- Dynamic import widget; lazy-load chart heavy; split i18n namespace.
- Đo bundle trước/sau bằng build output.
- **AC:** initial bundle <500KB gzip; widget không trong initial chunk.
- **Gate:** `npm run build` pass; Lighthouse perf ≥80.

### Phase D — A11y & responsive (1-2 sprint)
- axe scan trên 5 route (login, register, dashboard, settings, operations-center) ở 390×851.
- Keyboard nav audit; `min()`/`clamp()` cho fixed widths.
- **AC:** 0 critical a11y violations; không horizontal scroll ở 320px.

### Phase E — Polish & SSOT (1 sprint)
- Sinh `DESIGN.md` từ code (tokens + components) làm SSOT.
- Extract design system; visual regression baseline (Playwright) trên staging.
- **AC:** DESIGN.md tồn tại; Playwright visual baseline pass trên staging.

Mỗi phase: claim `docs/CLAIMS.md`, gate `check-multi-agent`, PR qua `agent-pr.ps1`, verify staging `deploy-staging.sh --verify`.

---

## 11. Tests / validation cần thêm

- `check:tokens` xanh (gate).
- Mở rộng `check:i18n-hardcoded` sang `src/pages` + `src/components`.
- A11y: Playwright axe scan trên route công khai + bảo vệ ở viewport 390×851.
- Visual regression: cập nhật baseline sau đổi theme (L-V03 review ảnh trước commit).
- Contrast: thêm pair cho SOC status badge light mode.
- Form: unit test validation cho login/register/reset/password-change.
- Bundle: thêm budget check (widget chunk <500KB) vào CI.

---

## 12. Owner / next steps

- **Owner:** chốt câu hỏi §6 của audit trước (light-mode priority, gỡ recharts).
- **Coordinator:** phân slice theo Phase A→E, claim trong `docs/CLAIMS.md`.
- **Agent FE:** bắt đầu Phase A (P0-2, P0-3).
- **Verify:** staging VPS `14.225.255.47` (`/opt/vninvest`, branch `dev`) qua `bash scripts/deploy-staging.sh --verify`.

---

*Re-audit này tổng hợp findings từ 6 sub-agent song song + inventory định lượng + bundle metrics thực đo. Mọi số đo chưa chạy (test/components) đã ghi "CHƯA CHẠY".*