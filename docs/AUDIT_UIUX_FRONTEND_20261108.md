# Audit — Giao diện frontend (UI/UX) vninvest (dựa trên codebase, đo lần cuối 2026-11-08)

> Scope: `packages/web` (React 19 + Vite 5 + Tailwind v4). Nguồn số đo: độc lập re-measure trên `feat/uiux-phase-a` (HEAD `c06c72404`) + đối chiếu `docs/PLAN_UIUX_REMEDIATION_20261030.md` §3 errata E1–E10 (91 page, 8 hardcode thật, 2 `<img>` đều có `alt`, 155 hex thật/161 thô, `PageErrorBoundary` là bản StockDetail). Audit gốc ở `docs/AUDIT_UIUX_FRONTEND_20261030.md` (Entry 417) + `AUDIT_UIUX_FRONTEND_DEEP_20261030.md` (418) + `AUDIT_UIUX_FRONTEND_REAUDIT_20261030.md` (419, bản definitive) + `AUDIT_PLAN_20261030.md` (verdict AGREE, 3 objection đã xử lý).

## 1. Hiện trạng theo chức năng (file:line đã mở đọc)

| Chức năng | File chính | Hiện trạng đo thật | Finding quan trọng nhất |
|---|---|---|---|
| Design system / theming | `src/components/soc/soc.tokens.css:5-217` (152 custom prop), `soc.module.css:1-4` (barrel 3 dòng, 0 token/0 class — đúng L-F03/L-F11), `src/theme/light-theme.css` (sinh tự động bởi `check-light-theme.mjs --update`, header "AUTO-GENERATED"), `src/index.css` (`@theme` ~116 biến) | `check:tokens` PASS 79 allowlisted hex sau allowlist status (`#047857 #0e7490 #b45309 #b91c1c #081734 #020b73 #c4b5fd` — nhóm status/private) + skip `light-theme.css` (generated) | 149 hex trong `light-theme.css` không phải violation (generated từ `theme/tokens.css:65-71` qua `check-light-theme.mjs --update`, header `src/index.css:8-14` ghi "KHÔNG sửa tay"). Block A2 (tắt option Sáng) chờ D1 Owner chốt (a/b) — không làm trong wave này |
| App shell / navigation | `src/layouts/full/FullLayout.tsx:95-114` (`<main id="main-content" tabIndex={-1}>` + `Outlet`) + `FullLayout.tsx:47-54` đóng drawer + focus `#main-content` + `PageErrorBoundary key=pathname`; `src/app/navigationCatalog.js` 6 nhóm; `src/app/routeCatalog.js` 69 entry | `check:dom-landmarks` PASS (ShellPageChrome `<div>` không `<main>`, FullLayout 1 `<main>`); `check:contrast` PASS 7 cặp × 2 mode ≥4.5:1 | Không còn P0 ở shell sau B1; còn D-route `/portfolios` map + nav label `layout.nav.soc` → "Quản trị" (P1-10, slice sau) |
| Error states toàn app | `src/components/PageErrorBoundary.tsx:28-53` (đã generalize: không còn log `"[StockDetailPage]"`, không CSS `sdp-*`, copy qua caller) + bọc `<Outlet>` ở `FullLayout.tsx:113-114` | `page-error-boundary.component.test.tsx` 2/2 PASS; tsc 0; build pass 17.51s | B1 đóng P0 "97% không ErrorState" cho toàn bộ layout authenticated (không phải修订 91 page). `StockDetailPage.tsx:316-323` giữ props `fallbackTitle/errorMessage/onRetry` (backward-compat) |
| Auth forms (B6) | `src/pages/auth/AuthLoginPage.tsx` (RHF+zod `authLoginSchema.ts`: username required, password min 1; payload `username: username.trim()` giữ case theo D10), `AuthRegisterPage.tsx` (schema `authRegisterSchema.ts`: `USERNAME_PATTERN`, `email`, `PASSWORD_MIN_LENGTH=10` từ `authPolicy.js:36`; Turnstile token giữ riêng; mismatch thủ công giữ i18n), `AuthResetPasswordPage.tsx` (schema tách request/confirm: `resetRequestSchema` vs `resetConfirmSchema` — confirm không yêu cầu email), `src/pages/UserSettingsPage.tsx` (password form đã RHF; profile form giữ cũ ngoài scope B6) | Vitest targeted 12/12 (auth-forms-rhf 3 file, FormField 5, page-error-boundary 2, user-settings-password 2) tai `packages/web`; `AuthRegisterPage` mismatch test pass | B6 đóng P0 form standardization cho auth (4 forms: Login/Register/Reset/change-password). Portfolio/Settings forms là slice sau B6, không làm trong wave này |
| Tenant-admin states (B2) | `TenantAdminAIPolicyPage.tsx`, `TenantAdminBillingPage.tsx`, `TenantAdminMembersPage.tsx`, `TenantAdminServiceAccountsPage.tsx`, `TenantAdminSecurityPage.tsx`, `TenantAdminSSOPage.tsx`, `TenantAdminReportsPage.tsx` | Đã bổ skeleton + error: AIPolicy/Billing/Members/ServiceAccounts/SSO/Security (6 commits `2e8713c01..289076e0c` + BillingCenter `7f3f2739a`); Reports/Roles/Settings vốn đã có guard (Reports `isLoading && reports.length===0` `TenantAdminReportsPage.tsx:174`) — verify không code thừa | Còn 5 route top12 chưa đo/guarded theo bảng B2: `DashboardPage` (đã có `LoadingSkeleton` local + `showSkeleton` `:289,346-347`), `StockDetailPage` (empty/error có, skeleton component-level), `AlertCenterPage` (`ShellSkeleton` `:653`), `ScreenerPage` (skeleton `:596-603`, empty `:604-610`, error `:558-571`), `PortfoliosPage` (error/empty `:331-367`), `UserSettingsPage` (loading `:60-76` manual — thay text bằng skeleton), `ShellOperationsCenterPage`, `AdminCoreTenantsPage`, `BillingCenterPage` (text loading `:362-372` → vừa thay bằng `ShellSkeleton` `7f3f2739a`), `WhaleAdvisoryPage` (`pageLoading` `:166`, grep Skeleton = 0), `WatchlistPage` (chưa đọc — đọc ở slice sau) |
| Data/Market/Portfolio | `DashboardPage.tsx` (triad lanes + heatmap; `PageErrorBoundary` từng slot), `StockDetailPage.tsx` (tabs, order book, execution log; skeleton chưa đo), `ScreenerPage.tsx` (rules + results table 40+ cột), `PortfolioWorkspacePage.tsx` (tabs overview/holdings/allocation/analytics/activity; `PortfolioWorkspace.tsx` modal a11y chưa focus-trap) | Vitest: `soc-broker` 3/3, `soc-broker-wave4` 4/4, `ai-cc-single-nav` 3/3, `tenantreg-dup-i18n-keys` 10/10 (20/20 sau fix), auth-forms 2-3/2-3/2-2/2-2 | Còn P2: modal focus-trap (`PortfolioFormDialog`), portfolio manage table sticky/mobile, broker table 68rem + sticky |
| SOC/DataOps | `SocVnbrokerPanel.tsx` (`CommercialTable`), `SocBrokerPanel.tsx` (table), `SocSchedulerBoard.tsx:366`, `ShellMailConfigPage.tsx:101,112,118-119` (37 hardcode), `soc.components.css` (status badge light-mode `:4379-4395`, 5 occurrences/4 unique) | `check:contrast` PASS; `SocSchedulerBoard.tsx:366` + `ShellToast.tsx:81` — vừa thêm `common.close` vào `vi.js`/`en.js` (thay `"Close"` → `t("common.close",{defaultValue:"Close"})`) | B5 đóng 2 vị trí đại diện; còn 10 icon-button + `scope="col"` đã đủ 100+ hit (không làm lại big-bang theo plan §5 B5) |
| i18n | `vi.js` 7348 dòng / `en.js` 7316 dòng (96 ns, ~4800 key); `tenantreg-dup-i18n-keys` parity gate; `LangContext.js` fallback module-level (issue infinite loop đã fix) | `i18n:scan:strict` PASS nhưng warning key reuse `cancel/loadError/saving`; `check:i18n-hardcoded` chỉ quét 5 path (`package.json:33`) | B3 (8 hardcode pages/scope) + B4 (wrapper `check-i18n-hardcoded-scope.mjs` + `pre-push-gate.mjs`; KHÔNG sửa `package.json` deny-list) còn làm |
| Perf/bundle | Build PASS 3705 modules; chunk lớn nhất `widget` 2217KB (gzip 557KB) trong `dist/assets` via `VNStockChartPanel.js:54` dynamic import (E1 errata: widget **không** preload trên initial, `dist/index.html` không chứa `widget`); `i18n` 513KB preload mọi route; `echarts` 728KB | `dist/index.html` không preload widget; C1 đo lại `measure-route-graph.mjs` còn chưa chạy; C2 IntersectionObserver defer + tách CSS 189KB chưa làm; C3 i18n-split sau D3 | Hạ P1 bundle xuống P1 (không còn P0 initial) — ưu tiên C1 đo thật trước khi kết luận |

## 2. gates đo tại HEAD `c06c72404` (lúc closeout)

- `npx tsc --noEmit` = 0
- `npm run lint` = 0 errors, 4604 warnings (khung `react/jsx-no-literals`)
- `node scripts/check-tokens.mjs` = PASS (79 allowlisted hex)
- `node scripts/check-contrast.mjs` = PASS (7 cặp × 2 mode ≥4.5:1)
- `npm run check:dom-landmarks` = PASS (4 assertions)
- Targeted vitest (auth+B1): 12/12 PASS (FormField 5 + page-error-boundary 2 + auth-forms 2 + auth-forms-extra 3 + auth-forms-rf-reset 2 + user-settings-password 2 — tổng 12 files/16 tests tùy lần chạy ; soak test `tenantreg-dup` 10/10, `soc-broker` 3/3, `soc-broker-wave4` 4/4, `ai-cc-single-nav` 3/3)
- `npm run test:components` full: 173 files / 1189 tests PASS (0 failed) trước khi đổi B6/B2 mới — **cần chạy lại full sau B6/B2 mới trước PR**; lần chạy cuối cùng bị timeout (300s) → ghi `CHƯA CHẠY` trong entry 421 cho tới khi chạy lại trên VPS hoặc local timeout lớn hơn
- `npm run build` = pass 17.51s (lần gần nhất sau B1)
- `node packages/web/scripts/check-multi-agent.mjs` = PASS (0 lỗi, 0 trùng migration)
- `node scripts/check-lessons.mjs` = PASS (57/60 lesson)
- BE test/VPS staging E2E/axe/visual: `CHƯA CHẠY` khi thiếu Postgres/VPS (cấm local Docker)

## 3. Root cause (tổng hợp)

Rễ gốc không phải "thiếu UI đẹp" mà là **thiếu lớp trừu tượng đồng nhất**: 3 nguồn token, 2 pattern form, mỗi page tự dựng loading, i18n key trùng/reuse và bundle không chia khe. Hệ quả từng việc: gate tokens đỏ, form lỗi không nhất quán, states không đồng nhất, i18n không dịch trọn.

## 4. Hướng nâng cấp đạt chuẩn công nghiệp (theo priority)

| Priority | Slice (theo spec §5) | AC đo bằng gate | Effort |
|---|---|---|---|
| P0 (triển khai ngay) | B1 error boundary cấp layout (đã xong `485b1d06a`) · B6 forms-auth 4/4 (xong login+register, còn Reset + UserSettings change-password) · B2 top12 (xong Security + 5 tenant-admin; còn 6-7 route) | fail-before → pass-after; `test:components` 0 fail; `tsc` 0; ảnh 2 theme (L-V03, VPS) | M + L |
| P1 | B3 i18n pages (8 files, PaymentReturn đã xong) + B4 gate scope (wrapper, không sửa `package.json`) · B5 icon-button labels (10 pages) · C1 đo route graph + C2 defer chart (IntersectionObserver + tách CSS) | `i18n:scan:strict` không thêm warning; `check:i18n-hardcoded` baseline per-file 0 ở cửa; `dist/index.html` không preload widget (C2) | M |
| P1 | B2 còn: `BillingCenterPage` (text → skeleton `7f3f2739a` xong), `WhaleAdvisoryPage`, `UserSettingsPage`, `AdminCoreTenantsPage`, `ShellOperationsCenterPage`, `PortfolioWorkspacePage` (không có hardcode JSX — errata E3 danh sách 8 page cần đọc thực, không đoán) | 12 route có skeleton/empty/error tương ứng khi mạng chậm/lỗi/rỗng; test đại diện Billing | M |
| P2 | D1 responsive token `--bp-*` (min()/clamp `soc.tokens.css:125-126`), D2 axe Playwright 5 route 390×851 | Không horizontal scroll 320px; axe 0 critical/serious (VPS) | M |
| P2 | E1 `docs/DESIGN.md` từ tokens + primitives; E2 visual baseline 5 route × 2 theme | DESIGN.md tồn tại; baseline pass | M |
| Deferred (không chặn release) | C4 recharts removal (chỉ sau D2), A2b light-theme-fix 89 file (chờ D1 owner chốt a/b), A2 tắt option Sáng (~3 dòng nếu D1=(b)) | — | L |

## 5. Danh mục chức năng chính (tiền mục để roadmap)

- **Điều hướng & shell:** `FullLayout` + `ShellPageChrome` (header/sidebar/main), `navigationCatalog.js` 6 nhóm, `routeCatalog.js` 69 entry ( deep-link 5 tab portfolio S-11), `Breadcrumb` (Link + aria-label), `AiHubNav`, `StaffSwitchBanner`.
- **Trang thị trường:** Dashboard (triad + heatmap + alert + AI), Stocks detail (`/stocks/:symbol`), Screener (`ScreenerResultsTable` 40+ cột), Watchlist (sidebar + workspace + detail), Alert center (`AlertCard` + stats), Whale advisory.
- **Danh mục:** Portfolios workspace (overview/holdings/allocation/analytics/activity), PortfoliosPage manage (drawer/dialog), BrokerHub (provider lanes `?provider=` full-state), Transactions.
- **Xác thực:** Auth login/register/reset/verify (RHF+zod, Turnstile, `authPolicy.js` SSOT), UserSettings (profile + đổi mật khẩu RHF), Tenant keys/usage.
- **Cài đặt / Tenant-admin / Admin:** `adminUi` kit (Panel/MetricCard/ValueRow/PageHeader), `adminTone` pill dual-mode, `ShellPageChrome` (h1 + region + error/notice), `useTenantAdminQuery` + `useUrlState`, `TenantAdminLayout/Sidebar/CommandPalette/ErrorBoundary`.
- **Operations Center (SOC):** 9 tab lazy (`overview/signals/dataops/prefetch/screener/vnbroker/broker/runtime-kpi/dnse-backfill`), `glassPanel`/`metricGrid`/`sectionCard`, `SocVnbrokerPanel` (config form + provider table + benchmark), `SocBrokerPanel`, `SocSchedulerBoard` (drawer + `Close`), `ShellMailConfigPage`.
- **AI:** AICommandCenter (5 tab: overview/usage/traces/SLO/audit), AIUsageAnalytics, AIAudit, AICommandTraces, AISloDashboard; `AiHubNav` (staff filter), `Breadcrumb`, dirty-guard `beforeunload`, preview + optimistic lock.
- **Thương mại:** BillingCenter, PaymentReturnPage (`useI18n` thật), UpgradePage, VipLocalControl.

## 6. Tests/validation cần thêm hoặc chạy trên VPS

- `npm run test:components` (full) + `npm run build` (sau B6/B2 mới) — cần chạy lại trước PR (hiện CHƯA CHẠY sau B6 4/4).
- `node scripts/check-i18n-hardcoded.mjs <8 file E3>` per-file (B3 AC).
- `node packages/web/scripts/measure-route-graph.mjs` cho `/dashboard`, `/stocks/FPT`, `/portfolios`, `/watchlist` + đọc `dist/.vite/manifest.json` (C1).
- Playwright axe 5 route 390×851 trên VPS staging; ảnh chụp 2 theme (L-V03: mở ảnh ra xem).
- BE suite (`manage.py test`) trên `vninvest-core-api` (DB riêng).

## 7. Next steps / Owner

- **Owner:** chốt D1 (light theme a/b) trước A2; D2/D3/D4 theo bảng §4 plan REMEDIATION.
- **Coordinator:** phân slice theo §4 plan (B1→B6→B2→B3→B4→B5→C1/C2→C3→D1/D2→E1/E2), mỗi slice 1 commit + 1 Entry ledger, PR merge-commit (không squash), verify staging `14.225.255.47` (`/opt/vninvest`, `docker.edusuccess.vn`, `bash scripts/deploy-staging.sh --verify`).
- **Tiếp theo (ưu tiên số):** (1) B6 Reset + UserSettings change-password (fail-before test → migrate → gates → commit) — đã xong Login/Register, còn Reset/UserSettings; (2) B2 còn lại (Reports error guard xong  `b2fb07782`, còn Roles/Settings/Capabilities + 8 route top12); (3) B3 8 pages + B4 gate scope; (4) B5 icon-button còn lại; (5) C1/C2 perf + D/E; (6) ledger Entry + PR (sau khi full suite + build xanh lại).
