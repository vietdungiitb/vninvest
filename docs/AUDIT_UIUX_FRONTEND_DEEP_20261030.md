# AUDIT (DEEP) — Giao diện frontend (UI/UX) vninvest
## Hiện trạng chi tiết theo từng chức năng + roadmap nâng cấp chuẩn công nghiệp

> **Scope:** `packages/web` (React 19 + Vite 5 + Tailwind v4 + Radix) — toàn bộ giao diện.
> **Ngày:** 2026-10-30. **Phương pháp:** static analysis sâu trên codebase (đọc file thật, inventory tự động bằng PowerShell, grep counts, chạy toàn bộ gate + build). Không chạy E2E/ảnh chụp (staging = `docker.edusuccess.vn`).
> **Bổ sung so với** `AUDIT_UIUX_FRONTEND_20261030.md` (Entry 417): inventory định lượng từng trang/component/CSS/i18n/bundle, ma trận trạng thái, danh sách god-file, bundle metrics thực đo, deep per-feature.
> **Lessons áp dụng:** L-V01, L-V02, L-F03, L-F06, L-F08, L-F11, L-F12. (L-F08: màu tăng/giảm chuẩn Bloomberg — **đúng**, không báo sai.)
> **Skills dùng:** impeccable (audit/critique), archify (repository-authoring lens cho architecture map), theme-factory (lens theming consistency), project-lessons.

---

## 0. Tóm tắt điều hành (Top 8)

1. **Bundle: chunk `widget` 2.22 MB (gzip 557 KB)** — chunk lớn nhất, kéo vào StockDetail/PortfolioOverview/PortfolioAnalytics/WatchlistDetail (import eager của vninvestcharts-widget). P0 perf.
2. **i18n monolith 7.3K dòng** (`vi.js` 7348 / `en.js` 7316), 96 namespace, ~4800 leaf key; i18n-scan strict báo **key reuse với default khác nhau** (vd `cancel`, `loadError`, `retry`) → cùng key, nghĩa khác nhau tuỳ chỗ.
3. **State coverage rất thấp:** 100 trang prod → chỉ 13 dùng `ShellSkeleton`, 21 có EmptyState, 3 có ErrorState (`PageErrorBoundary`), 77 có LoadingKW. 97 trang **không** có ErrorState rõ ràng.
4. **A11y:** 75/100 trang không có `aria-label` nào; 100/100 trang không dùng `alt=` (ảnh qua background/CSS). 28 trang có 0 lời gọi `t()` (text hardcode).
5. **Theming:** `check:tokens` **FAIL** (141+ hard hex); light-mode vá bằng override theo page trong `index.css` (69 khối `[data-theme="light"]`) + `light-theme.css` (322 khối) thay vì token swap.
6. **Form UX:** 0/100 trang prod dùng `react-hook-form`/`zod` → validation tự dựng, không nhất quán.
7. **God-file:** 19 component >500 dòng; lớn nhất `SocSignalsPanel.tsx` 2454, `WhaleBubbleChart.jsx` 1849, `SocVnbrokerPanel.tsx` 1410, `SocDataOpsMonitorSection.tsx` 1073, `SocDataOpsConfigSection.tsx` 1026, `AICommandCenterForm.tsx` 1010.
8. **CSS phình:** 24 file CSS, ~16.6K dòng; `soc.components.css` 4561 dòng, `StockDetailPage.css` 2876, `TenantAdmin.module.css` 2518, `aiSettings.module.css` 1249.

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
| Dòng CSS tổng | ~16.6K | agg css (sum lines) |
| CSS modules | 9 | glob `*.module.css` |
| Locale keys (leaf) | ~4800 | i18n_inventory (sum) |
| Locale namespaces | 96 | i18n_inventory |
| Locale file lines | vi 7348 / en 7316 | wc |
| Route entries | ~65 | routeCatalog.js |
| Nav groups | 6 | navigationCatalog.js |
| Chart libs (file dùng) | widget 4 · echarts 24 · recharts 12 | Select-String |
| Form libs (file dùng) | RHF 1 (không phải page) · zod 0 page | Select-String |
| Radix (file dùng) | 16 | Select-String |

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
| Form | (đếm Form tag) | — | — |

> **Kết luận:** 97% trang không có ErrorState rõ ràng; 87% không skeleton; 75% không aria-label. Đây là gap lớn nhất về UX production-readiness.

### 1.3 Trang prod với 0 i18n (text hardcode) — 9 trang thật (loại test co-located)

`ShellMailConfigPage.tsx` (655d), `VipLocalControlPage.tsx` (684d), `BrokerHubPage.tsx` (269d), `TransactionsPage.tsx` (249d), `ShellAiCommandCenterPage.tsx` (235d), `ShellSettingsPage.tsx` (144d), `ShellSupportPage.tsx` (169d), `PortfolioWorkspacePage.tsx` (82d), `ShellOperationsCenterPage.tsx` (110d).  
→ 9 trang prod **không qua `t()`** → toàn bộ text hardcode tiếng Việt, không dịch được.

### 1.4 Bundle metrics (build 2026-10-30, vite 5.4.21)

| Chunk | Size | gzip | Ghi chú |
|---|---|---|---|
| `widget-BLaTiwoq.js` | **2,217 KB** | 557 KB | vninvestcharts-widget — lớn nhất |
| `echarts-CbTRyeDc.js` | 728 KB | 249 KB | ECharts |
| `i18n-CCdYDQcA.js` | 513 KB | 167 KB | toàn bộ vi+en monolith |
| `xlsx-D_0l8YDs.js` | 429 KB | 143 KB | xlsx |
| `react-vendor-Bde53u6k.js` | 305 KB | 97 KB | React core |
| `generateCategoricalChart` | 277 KB | 74 KB | recharts |
| `SocDataOpsPanel` | 98 KB | 23 KB | SOC panel |
| `ui-C-xZ9D0n.js` | 110 KB | 36 KB | UI kit |
| `index.css` | 180 KB | 27 KB | global CSS |
| `widget-*.css` | 189 KB | 29 KB | widget CSS |

> **Perf P0:** `widget` 2.2 MB chunk được kéo vào StockDetail/PortfolioOverview/PortfolioAnalytics/WatchlistDetail vì import eager (`StockDetailPage.tsx:20`, `PortfolioOverviewPage.tsx:15`, `PortfolioAnalyticsPage.tsx:25`). Cần dynamic import.

### 1.5 Top namespaces i18n (leaf keys)

soc 1261 · stockDetail 411 · adminOps 379 · watchlist 263 · screener 196 · adminCoreTenants 180 · aiAdvisory 178 · alertCenter 170 · dashboardRealtime 146 · whaleHub 138 · whaleAdvisory 123 · brokerHub 88 · portfolioWorkspace 87 · portfoliosManage 96 · transactions 73 · adminCoreAuditTrace 73 · aiCommandCenter 202 · aiUsageAnalytics 34 · aiAdvisor 25 · (96 namespaces tổng, ~4800 keys).

---

## 2. Shell, Navigation, Routing (deep)

### 2.1 Shell layout
- `layouts/full/FullLayout.tsx`: sidebar + header + `<main id="main-content" tabIndex={-1} role="main">`, content `max-w-[80rem]`, padding `var(--sp-6,1.5rem)`. Mobile sidebar overlay với backdrop blur. Resize listener đóng mobile sidebar ở ≥1024px.
- Theme boot: `main.tsx:260-272` đọc `localStorage 'vninvest-theme'` trước paint (tránh FOUC). Light opt-in qua `data-theme="light"`.
- Providers: `QueryProvider → PortfolioProvider → LangProvider → ToastProvider → ConfirmProvider → RealtimeProvider → App` (main.tsx:278-304).
- Skip link `.skip-link` (index.css:777-799), focus-visible global (index.css:142-145), reduced-motion (index.css:810-819), touch target 44px coarse (index.css:901-926), safe-area (index.css:880-883), tabular-nums (index.css:828-831).

### 2.2 Routing
- `routeCatalog.js` ~65 entry, đầy đủ schema (id, path, titleKey, group, buildTargets, requiredCapabilities, adapter, status, staffOnly, deprecated/redirectTo, externalEntry).
- `main.tsx:142-257` khai `<Route>` thủ công + `ProtectedRoute` (auth state error + retry) + `StaffRoute`/`TenantRoute`.
- Deep-link portfolio 5 tab (S-11): mỗi tab 1 URL.
- Redirect giữ query/hash: `RedirectPreserveQuery` (whale-alerts, ai-command-center, portfolios/manage/broker).

### 2.3 Navigation
- `navigationCatalog.js`: 6 group (workspace, signals, system, admin, tenant, vip-local). Nhóm `admin` label `layout.nav.soc` chứa `operations-center, operations-center-mail-config, advertising-admin, admin-users` → **label "SOC" không phản ánh** (P1-12).
- Capability-based + build-target filtering.

### 2.4 Auth UX
- 4 trang auth (`AuthLoginPage 247d, AuthRegisterPage 400d, AuthResetPasswordPage 306d, AuthVerifyEmailPage 143d`), 0 dùng RHF.
- Turnstile widget (`@marsidev/react-turnstile`) tích hợp.
- `authPolicy.js` (3.3 KB) + `authErrors.js` (11.3 KB) — validation client-side tự dựng.
- ProtectedRoute xử lý bootstrap error với retry (main.tsx:83-135) — UX tốt.

---

## 3. Design System (deep)

### 3.1 Token architecture
- `soc.tokens.css` (218 dòng): semantic surfaces (`--text-*`, `--border-*`, `--bg-panel*`, `--accent-*`), portfolio tokens (`--pf-*`), spacing/radius/shadow/font (`--sp-*`, `--r-*`, `--fs-*`), legacy `--soc-rgb-*`/`--soc-c-*`, VNBroker tokens (`--vnb-*`), status tokens (`--soc-status-*`).
- Light override: `:root[data-theme="light"]` (dòng 143-217) remap toàn bộ token — **đúng hướng** (token swap).
- `index.css` `@theme` (dòng 19-116): Tailwind v4 color palette (primary, slate, semantic, VNInvest specific), spacing, radius, shadow, layout. Đây là **thang thứ 2** song song với soc tokens → duplication.
- `theme/tokens.css` (83 dòng) + `theme/light-theme.css` (1009 dòng, 347 hex, 322 light override) — **thang thứ 3**.

### 3.2 Theming gaps
- `check:tokens` **FAIL**: 141+ hard hex trong `soc.components.css`, `light-theme.css`, `brokerData.css`.
- Light-mode vá bằng override theo page trong `index.css` (69 khối `[data-theme="light"]`) + `light-theme.css` (322 khối) → **fragile**: class mới không được phủ.
- `neon-glass-panel`, `advisory-page`, `core-dashboard-page` có override riêng (index.css:285-445).

### 3.3 Component classes
- `soc.components.css` (4561 dòng): panel, table, button, badge, input, modal, KPI card, status badge, v.v. 95 hard hex.
- `soc.module.css` (4 dòng) — **barrel re-export**, 0 token/class (L-F03/L-F11). Import `styles from "./soc.module.css"` (SocVnbrokerPanel.tsx:13) → class có resolve qua Vite postcss-modules (đọc CSS build mới kết luận).

### 3.4 Spacing/typography duplication
- 3 thang spacing: `--space-*` (index.css @theme), `--sp-*` (soc.tokens), `--layout-*`.
- 3 thang type: Tailwind `text-xs..2xl`, `--fs-*` (soc.tokens), `--fs-2xs` (adminUi).

### 3.5 A11y baseline (tốt)
- focus-visible global (index.css:142-145), skip link (777-799), reduced-motion (810-819), touch target 44px coarse (901-926), safe-area (880-883), overscroll contain (870-876), tabular-nums (828-831).
- `check:dom-landmarks` PASS, `check:contrast` PASS (7 tone pairs × 2 mode ≥4.5:1).

---

## 4. Per-feature audit

### 4.1 Thị trường (Dashboard, StockDetail, Screener, Watchlist, AlertCenter, WhaleAdvisory)

**Dashboard** (`DashboardPage.tsx` 452d): bento grid 3 lane (triad) với breakpoints 1279/1099px (index.css:489-526), `PageErrorBoundary`. Charts: ECharts treemap/heatmap. i18n calls chỉ 3 (thấp). LoadingKW=1. Không Skeleton/EmptyState/ErrorState rõ.
**StockDetail** (`StockDetailPage.tsx` 398d + `ShellStockDetailPage.js`): CSS 2876 dòng (rất lớn), chart stack (widget + echarts + kline? lightweight?). Modal=1, Chart=1. i18n calls? (không trong list 0-i18n, nên có t()).
**Screener** (`ScreenerPage.tsx` 763d): Modal=1, Chart=0. CSS? không có file riêng (dùng soc). Table? không Table flag (0) — có thể dùng div grid.
**Watchlist** (`WatchlistPage.tsx` + `watchlist/components/*`): CSS 754 dòng. Components: WatchlistTable, Sidebar, MainWorkspace, DetailPanel, Context. Chart=0. i18n calls? (không 0).
**AlertCenter** (`AlertCenterPage.tsx` 752d): **duy nhất** có Skeleton+EmptyState+ErrorState (3/100). Virtualized feed (`react-window`). Modal=1, Table=0. i18n 34 calls.
**WhaleAdvisory** (`WhaleAdvisoryPage.tsx`): Chart (WhaleBubbleChart 1849d, FactsFirstWhaleBubbleChart). i18n hardcoded scan PASS (0 hardcoded trong 5 file scope).

**Findings thị trường:**
- StockDetail CSS 2876 dòng → god-file CSS; cần split theo tab.
- Dashboard i18n calls chỉ 3 → text hardcode nhiều trong JSX (đóng góp vào 4417 lint warning).
- Watchlist table virtualization? AlertCenter có, WatchlistTable chưa verify (cần đọc).
- Chart widget import eager ở StockDetail/PortfolioOverview/PortfolioAnalytics → bundle 2.2MB kéo vào route.

### 4.2 Danh mục & Broker (Portfolio, BrokerHub, Transactions)

**PortfoliosPage** (322d): Table=0, Modal=1, i18n 27. **PortfolioWorkspacePage** (82d): 0 i18n calls → text hardcode.
**Portfolio sub-pages:** Overview (156d, Chart=1), Holdings (365d, Table=1), Allocation (134d, Chart=1), Analytics (225d, Chart=1), Activity (149d).
**PortfolioManageTable** (217d, Table=1), **PortfolioManageDrawer** (549d, Modal=1, aria 5), **PortfolioFormDialog** (189d, Form=1, Modal=1).
**BrokerHubPage** (269d, 0 i18n), **BrokerAccountPage** (88d, 0 i18n), **BindingsPanel** (439d, Table=1, Modal=1).
**TransactionsPage** (249d, 0 i18n).
**PortfoliosBrokerPage** (33d).

**Findings:**
- 0 RHF/zod → form validation tự dựng (PortfolioFormDialog, auth forms, settings forms).
- BrokerHubPage 0 i18n → text hardcode.
- TransactionsPage 0 i18n → text hardcode.
- CSS: PortfolioWorkspace.css 754 dòng, portfolioManage.css 678 dòng (tokenized tốt: 177 var, 1 hex).

### 4.3 Watchlist
- `WatchlistPage.css` 754 dòng (41 hex, 97 var).
- Components: WatchlistTable, Sidebar, MainWorkspace, DetailPanel, Context.
- Widget import ở WatchlistDetailPanel → bundle.

### 4.4 Auth
- 4 trang auth, 0 RHF, validation tự dựng trong `authPolicy.js` (PASSWORD_MIN_LENGTH=10) + `authErrors.js`.
- Turnstile widget tích hợp.
- i18n calls: LoginPage 14, Register 28, Reset 20, Verify 7.
- CSS: AuthRegisterPage.css chỉ 8 dòng (gần như không style riêng — dùng Tailwind).

### 4.5 Settings (UserSettingsPage)
- 220 dòng CSS (31 hex, 18 var) — tokenization kém (31 hex).
- Manual loading (setLoading, error string) — không ShellSkeleton.
- Theme apply: `applyUserTheme()` set `data-theme` + persist localStorage + DB.
- i18n calls? (không trong 0-i18n list → có t()).

### 4.6 Tenant-admin (14 trang)
- `TenantAdmin.module.css` 2518 dòng (24 hex, 216 var).
- Trang lớn: TenantAdminPATsPage 809d, TenantAdminWebhooksPage 538d, TenantAdminSecurityPage 332d, TenantAdminBillingPage 639d, TenantAdminServiceAccountsPage 356d, TenantAdminReportsPage 340d.
- Primitives: TenantAdminLayout, Sidebar, CommandPalette, ErrorBoundary.
- i18n: TenantKeysPage 0 i18n (test+prod?), TenantUsageSummaryPage có t().

### 4.7 Platform admin (15 trang)
- `adminUi.tsx` (102d): AdminPageHeader, AdminPanel, AdminMetricCard, ValueRow — chuẩn hoá 12 fleet page.
- `adminTone.ts`: tone classes cho status pill (contrast gate verify).
- Trang lớn: AdminCorePATsPage 532d, AdminCoreServiceAccountsPage 461d, AdminCoreJobsPage 487d, AdminCoreTenantsPage 496d, AdminCoreAuditTracePage 578d.
- CSS: không có file riêng (dùng Tailwind + adminUi).
- i18n calls: 24-89 mỗi trang (tốt).

### 4.8 Operations Center (SOC) — DataOps
- `ShellOperationsCenterPage.tsx` (110d) chứa các panel.
- Soc panels: SocOverviewPanel 1174d, SocSignalsPanel 2454d, SocVnbrokerPanel 1410d, SocBrokerPanel 545d, SocScreenerPanel 569d, SocDataOpsConfigSection 1026d, SocDataOpsMonitorSection 1073d, SocDataOpsOperationsSection 882d, SocSchedulerBoard 803d, SocDnseBackfillPanel, SocAnomalyGuardPanel, SocPrefetchPanel, SocParityGatesPanel, SocRetentionHealthPanel, SocRuntimeKpiPanel, SocUsersPanel.
- `soc.components.css` 4561 dòng (SOC-specific classes).
- `soc.tokens.css` 218 dòng.
- Tests: soc-*.component.test.tsx (nhiều, ~20 file).
- **God-file risk:** SocSignalsPanel 2454 dòng, SocOverviewPanel 1174, SocDataOpsMonitorSection 1073, SocDataOpsConfigSection 1026, SocDataOpsOperationsSection 882, SocSchedulerBoard 803, SocVnbrokerPanel 1410.

### 4.9 AI surfaces
- `AICommandCenterPage.tsx` (473d) + `AICommandCenterForm.tsx` (1010d) — god-file. Lazy-load AIAuditLogsPanel.
- `AIUsageAnalyticsPage.tsx` (25d — stub?), `AIAuditPage.tsx` (175d), `AICommandTracesPage.tsx` (290d), `AISloDashboardPage.tsx` (216d).
- `AiHubNav.tsx`, `Breadcrumb.tsx`.
- i18n: aiCommandCenter 202 keys, aiAdvisory 178 keys, aiUsageAnalytics 34, aiAdvisor 25.
- `aiSettings.module.css` 1249 dòng (27 hex, 243 var).
- Tests: ai-cc-*.component.test (nhiều contract test).

### 4.10 Commercial (Billing, PaymentReturn, Upgrade)
- `BillingCenterPage.tsx` (604d, Table=1, Modal=1, i18n 36).
- `PaymentReturnPage.tsx` (290d, i18n 17).
- `UpgradePage.tsx` (VipLocalControlPage 684d).
- `CommercialPage.tsx` + primitives (CommercialToolbar/Table/State/Meta) — template chuẩn.

### 4.11 i18n infrastructure
- Custom (không i18next runtime? Actually i18next-scanner dùng để scan; runtime dùng `createTranslator` trong `i18n/index.js`). `LangContext.js` quản lý locale + format functions.
- 96 namespace, ~4800 leaf key, vi/en monolith (7.3K dòng).
- i18n-scan strict: cảnh báo key reuse với default khác nhau (`cancel`, `loadError`, `retry`, `delete`, `saving`) → cùng key, nghĩa khác nhau tuỳ chỗ → **bug tiềm ẩn**: nếu key bị dedup, nghĩa sai.
- `check:i18n-hardcoded` chỉ quét 5 file → coverage hẹp, nhưng 5 file đó pass (0 hardcoded).

### 4.12 Responsive & mobile
- Breakpoints: Tailwind sm/md/lg/xl + custom @media (index.css 510-526: 1279/1099px; dashboard triad).
- Touch target 44px coarse (index.css:901-926).
- Safe-area insets (index.css:880-883).
- Overscroll contain (870-876).
- Fixed min-width: `--vnb-tile-min: 260px`, `--vnb-kpi-min: 150px` (soc.tokens.css:125-126) → rủi ro overflow 320px.
- `max-w-[80rem]` content (FullLayout:102).

### 4.13 Performance & bundle
- (xem §1.4) widget 2.2MB, echarts 728KB, i18n 513KB, xlsx 429KB, react-vendor 305KB, generateCategoricalChart 277KB.
- Code-splitting: pageRegistry deferred (dynamic import) → routes lazy. Nhưng widget import eager ở 4 component → chunk kéo vào route đó.
- `lazy()` dùng ở AICommandCenterPage (AIAuditLogsPanel) — pattern tốt, cần mở rộng.
- eval in widget dist (security/perf warning).
- 3705 modules transformed.

---

## 5. Findings tổng hợp (P0/P1/P2/P3)

### P0 — Blocking
| ID | Issue | Location | Impact/Standard | Fix | Effort |
|---|---|---|---|---|---|
| P0-1 | Bundle `widget` 2.2MB eager | `StockDetailPage.tsx:20`, `PortfolioOverviewPage.tsx:15`, `PortfolioAnalyticsPage.tsx:25`, `WatchlistDetailPanel.tsx` | TTI chậm, mobile data | Dynamic import widget; lazy-load chart component | M |
| P0-2 | Theming = override theo page + 141+ hard hex | `index.css:335-445`, `soc.components.css`, `light-theme.css`, `brokerData.css` | Light mode vỡ; WCAG 1.4.3 | Token swap thật sự; migrate hex → token; `check:tokens` xanh | L |
| P0-3 | `check:tokens` FAIL | gate 2026-10-30 | Gate UI không xanh | Allowlist chỉ status/chart/private; migrate còn lại | M |
| P0-4 | Form không chuẩn hoá (0 RHF/zod trên 100 trang) | grep counts | Validation không nhất quán | RHF+zod cho form mới + shared FormField; migrate auth/portfolio/settings | L |
| P0-5 | i18n monolith (7.3K dòng) + key reuse conflicting defaults | `vi.js`/`en.js`, i18n-scan strict warnings | Merge conflict, nghĩa sai | Split namespace; dedup key; fix conflicting defaults | L |
| P0-6 | State coverage: 97% không ErrorState, 87% không Skeleton | §1.2 ma trận | UX production chưa sẵn sàng | Chuẩn hoá ShellSkeleton/ShellEmptyState/PageErrorBoundary trên mọi trang | L |

### P1 — Major
| ID | Issue | Location | Fix | Effort |
|---|---|---|---|---|
| P1-7 | 9 trang prod 0 i18n calls | §1.3 | Migrate text → t() | M |
| P1-8 | 75/100 trang không aria-label; 100/100 không alt | §1.2 | axe scan + thêm aria-label/alt | M |
| P1-9 | i18n hardcoded scan chỉ 5 file | `package.json:33` | Mở rộng scan sang src/pages + src/components | S |
| P1-10 | Navigation label `layout.nav.soc` chứa admin-users/advertising | `navigationCatalog.js:28-33` | Đổi label "Quản trị", tách Operations Center | S |
| P1-11 | God-file component (>500 dòng) ×19 | §1.1 / component list | Split theo seam (giữ re-export shim) | L |
| P1-12 | CSS god-file (StockDetail 2876, TenantAdmin 2518, aiSettings 1249, soc.components 4561) | css_inventory | Split theo feature/tab | M |
| P1-13 | Fixed min-width rủi ro overflow mobile | `soc.tokens.css:125-126` | `min()`/`clamp()`; test 390px | S |
| P1-14 | i18n key reuse conflicting defaults | i18n-scan strict warnings | Dedup + rename key | M |
| P1-15 | Light-mode override theo class page | `index.css:335-445` | Override theo nhóm utility + checklist | M |
| P1-16 | Widget chunk eval warning | build output | Kiểm tra widget source / thay thế | S |
| P1-17 | Lazy-load chưa đồng bộ (chỉ AICommandCenterPage) | `AICommandCenterPage.tsx:20-22` | Mở rộng `lazy()` cho chart heavy | M |

### P2 — Minor
| ID | Issue | Location | Fix | Effort |
|---|---|---|---|---|
| P2-18 | 3 thang spacing song song | index.css @theme, soc.tokens, layout | Consolidate | M |
| P2-19 | 3 thang type song song | soc.tokens, adminUi, Tailwind | Consolidate | M |
| P2-20 | Status color định nghĩa 2 nơi | index.css semantic + soc-status-* | 1 nguồn | S |
| P2-21 | `UserSettingsPage.css` tokenization kém (31 hex/18 var) | `UserSettingsPage.css` | Migrate → token | S |
| P2-22 | `brokerData.css` tokenization kém (8 hex/3 var) | `brokerData.css` | Migrate → token | S |

### P3 — Polish
| ID | Issue | Location | Fix |
|---|---|---|---|
| P3-23 | SOC panels dùng `soc.module.css` barrel — verify class resolve | `SocVnbrokerPanel.tsx:13` | Đọc CSS build (L-F11) trước khi kết luận; migrate sang soc.components class |
| P3-24 | Skip link trong index.html chưa verify | `index.css:777-799` | Verify `<a class="skip-link" href="#main-content">` |
| P3-25 | `ShellStockDetailPage.css` 2876 dòng | CSS file | Split theo tab |

---

## 6. Roadmap nâng cấp chuẩn công nghiệp (phased, có AC)

### Phase A — Foundation (1-2 sprint)
- Đóng `check:tokens` xanh (migrate hard hex).
- Gom light-mode overrides vào `soc.tokens.css :root[data-theme="light"]`.
- Chạy `check:contrast` + `check:light-theme` (nếu có) xanh.
- **AC:** `npm run check:tokens` exit 0; `npm run check:contrast` pass; build pass.
- **Gate:** tsc 0 + lint 0 errors + check:shell xanh.

### Phase B — Consistency (2-3 sprint)
- Form standard (RHF+zod + FormField primitive); migrate auth/portfolio/settings.
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

## 7. Tests / validation cần thêm

- `check:tokens` xanh (gate).
- Mở rộng `check:i18n-hardcoded` sang `src/pages` + `src/components`.
- A11y: Playwright axe scan trên route công khai + bảo vệ ở viewport 390×851.
- Visual regression: cập nhật baseline sau đổi theme (L-V03 review ảnh trước commit).
- Contrast: thêm pair cho SOC status badge light mode.
- Form: unit test validation cho login/register/reset/password-change.
- Bundle: thêm budget check (widget chunk <500KB) vào CI.

---

## 8. Owner / next steps

- **Owner:** chốt câu hỏi §6 của audit trước (light-mode priority, gỡ recharts).
- **Coordinator:** phân slice theo Phase A→E, claim trong `docs/CLAIMS.md`.
- **Agent FE:** bắt đầu Phase A (P0-2, P0-3).
- **Verify:** staging VPS `14.225.255.47` (`/opt/vninvest`, branch `dev`) qua `bash scripts/deploy-staging.sh --verify`.

---

*Deep audit này bổ sung inventory định lượng + bundle metrics thực đo so với `AUDIT_UIUX_FRONTEND_20261030.md`. Mọi số đo chưa chạy (test/components) đã ghi "CHƯA CHẠY".*