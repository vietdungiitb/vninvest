# VNInvest — Progress Dashboard

> **Central progress board** for SaaS migration and feature delivery.

---

## Final Sprint: Legacy Admin JSX → TSX Conversion

| Phase | Status | Details |
|-------|--------|---------|
| 8 AdminCore JSX → TSX | ✅ Done | All 8 TSX files in `packages/web/src/pages/admin/`. Named exports, `coreApiAdapter` cast pattern, inline Vietnamese text. |
| `pageRegistry.js` routes | ✅ Done | 8 `admin-core-*` entries with `status: 'core'` and lazy imports. |
| TypeScript check | ✅ Pass | `tsc --noEmit` — zero errors. |
| Production build | ✅ Pass | `npm run build` — 3161 modules, 0 errors, 10s build. |
| Playwright E2E specs | ✅ Written | `login.spec.ts` (4 tests), `watchlist.spec.ts` (4 tests). |
| Beta deploy (docker-compose.beta.yml) | ✅ Deployed | Container `vninvest-frontend-beta` running on `docker.edusuccess.vn`. |
| Beta HTTP access | ✅ Active | HTTP 200 → 301 redirect, pages verified and responsive. |
| Beta HTTPS cert | ✅ Active | Let's Encrypt SSL active, UI Tailwind v4 styles verified. |
| Shadow run (3 days) | ⏳ In Progress | Started shadow test suite, layout styling fixed and live. |
| Legacy frontend archive | ⏳ Pending | After Pre-Decommission Gates A–G satisfied. |

### Beta Access
- URL: `https://beta.edusuccess.vn`
- Deploy command: `docker compose -f docker-compose.beta.yml up -d`
- Logs: `docker logs -f vninvest-frontend-beta`

---

## Dashboard Migration (2026-06-22)

| Component | Status | Details |
|-----------|--------|---------|
| `runtimeConfig.ts` | ✅ Done | localStorage feature flag `isNewLayoutEnabled()` |
| FullLayout.tsx (sidebarCollapsed removed) | ✅ Done | Desktop sidebar always expanded; `closeMobileSidebar` no longer collapses desktop |
| Sidebar.tsx (always w-72, new active style) | ✅ Done | `bg-blue-600 rounded-lg text-white`; no `collapsed`/`onToggle` props |
| Header.tsx (desktop toggle removed) | ✅ Done | Only mobile hamburger remains |
| `useAlertCenterSnapshot.ts` | ✅ Done | Cursor-based pagination for alert center history |
| `CoreDashboardPositionDeck.tsx` | ✅ Done | Native TSX replacement for immutable `FactsFirstModularPositionDeck.jsx` |
| DashboardPage.tsx (snapshot + heatmap) | ✅ Done | Integrated 3 alert sources + heatmap data build |
| E2E tests (dashboard-ui-fixes.spec.ts) | ✅ Done | 5 new tests: sidebar, active style, header, alerts |
| TypeScript check | ✅ Pass | 0 errors |
| Build | ✅ Pass | 3240 modules |
| Beta deploy | ✅ Done | Container running, HTTP 200 |
| Audit #1: Code committed (was not pushed) | ✅ Done | FullLayout/Header/Sidebar/DashboardPage committed |
| Audit #2: Heatmap missing tracked+watchlist | ✅ Done | Added `heatmapSymbols` + `heatmapData` memo merging holdings, trackedSymbols, watchlistGroups, watchlists |
| Audit #3: Pagination UI missing | ✅ Done | Added prev/next buttons in UnifiedAlertCenter, fixed prop name mapping in DashboardPage |
| Audit #4: E2E test timeout / loop | ✅ Done | Resolved infinite loop in `useAlertCenterSnapshot` and fixed selectors/isolation in Playwright tests |

---

## Legacy Decommission Gates

| Gate | Condition | Status |
|------|-----------|--------|
| A: All SaaS pages live | All 8 AdminCore TSX deployed, routes registered | ✅ |
| B: No legacy fetch in SaaS | All pages use `coreApiAdapter` | ✅ |
| C: Parity score >= 99% | Shadow run (3 days) | ⏳ |
| D: Legacy read-only | Legacy `frontend/` git archived | ⏳ |
| E: Zero legacy deps | No JS imports from `frontend/` | ⏳ |
| F: CI passes without legacy | Build passes after `frontend/` moved | ⏳ |
| G: Sign-off | Tech Lead sign-off | ⏳ |

---

## Core Migration Metrics

| Metric | Current | Target |
|--------|---------|--------|
| SaaS pages (core) | 8 (AdminCore) + 26+ existing | All legacy replaced |
| TS/TSX files converted | 34+ | All |
| Build errors | 0 | 0 |
| TypeScript errors | 0 | 0 |
| Beta HTTP status | 200 | 200/301 |
| Beta HTTPS status | 200 | 200 |

---

---

## Tenant Lifecycle & Order Flow Fix (2026-06-23)

| Fix | Status | Details |
|-----|--------|---------|
| `TenantLifecycleView` in `views_tenant.py` | ✅ Done | Returns `plan`/`status`/`tenant_id`/`tenant_code`/`display_name` via `_get_request_tenant()` |
| Route `/tenant/lifecycle/` in `urls.py` | ✅ Done | Both `/tenant/lifecycle/` and `/tenant/lifecycle` registered |
| `authTokenStorage` fallback in `coreApiAdapter.js` | ✅ Done | `getToken: getToken ?? (() => authTokenStorage.getAccessToken())` — fixes 401 when adapter created without explicit token |
| Python syntax check | ✅ Pass | Both `views_tenant.py` and `urls.py` |
| TypeScript check | ✅ Pass | `npx tsc --noEmit` — 0 errors |
| Dev build | ✅ Done | `./start_dev.ps1` — all core images rebuilt, frontend building |
| Audit ledger | ✅ Done | Entry 10 added to `CODE_CHANGE_AUDIT_LEDGER.md` |
---

## Heatmap Drill-down Fix & Symbol Dialog (2026-06-23)

| Fix / Feature | Status | Details |
|---|---|---|
| `nodeClick: false` on Treemap/Sunburst | ✅ Done | Disables ECharts native drill-down to prevent leaf node canvas crashes |
| Custom Info Dialog Overlay | ✅ Done | Premium glass-strong card showing stock metadata (Symbol, Company, Industry, Price, Change %, Vol, Market Cap, Volatility) |
| SVG Sparkline Trend | ✅ Done | Lightweight SVG `<path>` plotting 24H price trend data |
| `coreApiAdapter` API Integrations | ✅ Done | `getStockChartHistory(symbol, { timeframe: '1H', days: 1 })` |
| i18n support | ✅ Done | Fully localized Vietnamese/English text keys mapped to `I18N` |
| Navigation on Click | ✅ Done | Clicking symbol name in dialog navigates to `/stocks/SYMBOL` |
| TypeScript verification | ✅ Pass | `tsc --noEmit` on web packages has 0 errors |
| Build verification | ✅ Pass | `npm run build` compiled 3244 modules successfully in ~12s |

---

## Stock Details Page Normal Mode Cutover (2026-06-23)

| Fix / Feature | Status | Details |
|---|---|---|
| Route Redirection | ✅ Done | Swapped route mapping in `pageRegistry.js` for `"core-stock-detail"` to import `./StockDetailPage.tsx` directly instead of `./market/ShellStockDetailPage.tsx` |
| URL Parameter Resolution | ✅ Done | Updated `StockDetailPage.tsx` to resolve `symbol` using useParams() from react-router-dom when mounted directly as a route component without symbol props |
| TypeScript check | ✅ Pass | `npx tsc --noEmit` — 0 errors |
| Build verification | ✅ Pass | `npm run build` compiled 3243 modules successfully |

---

---

## Tenant Admin Console Migration (2026-06-23)

| Fix / Feature | Status | Details |
|---|---|---|
| `response.ok` → direct JSON in 7 TSX pages | ✅ Done | Home, Members, ServiceAccounts, PATs, Usage, Billing, AuditLogs — all fixed |
| `localStorage` → `sessionStorage` for `tenant_id` | ✅ Done | `transport.js`: `tenantIdStorage` helper (get/set/clear) via `sessionStorage` |
| `coreApiAdapter.js` re-export | ✅ Done | `tenantIdStorage` exported for consumer access |
| `coreApiAdapter.d.ts` method signatures | ✅ Done | Added `coreGet`/`corePost`/`corePut`/`corePatch`/`coreDelete` + `TenantIdStorage` interface |
| `TenantAdminSSOPage.tsx` port | ✅ Done | New 331-line TSX, `createElement`, Enterprise plan gate, SSO test section, endpoint `/core/v1/partner/sso/` |
| Route registration | ✅ Done | `pageRegistry.js` + `main.tsx` (`tenant-admin/sso`) |
| i18n keys (vi/en) | ✅ Done | 28 keys per locale in `tenantSSO` block |
| TypeScript check | ✅ Pass | `npx tsc --noEmit` — 0 errors |
| Build | ✅ Pass | 3244 modules, `TenantAdminSSOPage.js` 8.68 kB |
| Dev stack refresh | ✅ In Progress | `./start_dev.ps1` building |

---

## TenantAdminHomePage Redesign — Frontend Review (2026-06-23)

| Fix / Feature | Status | Details |
|---|---|---|
| i18n via `useI18n()` | ✅ Done | All text through `t()` keys (`tenantHome.*`, `plans.*`, `common.*`) |
| Permission gating via `ability.can()` | ✅ Done | Nav links filtered + `readAccess` metric card |
| User identity display | ✅ Done | Username/email/plan from `usePortfolio().userIdentity` / `userPlan` |
| Quota caps display | ✅ Done | API calls, AI regenerations, whale symbols, exports/day from `userEntitlements.quota` |
| SPA navigation (`<Link>` instead of `<a>`) | ✅ Done | Client-side transitions via react-router-dom |
| No-tenant context state | ✅ Done | Graceful i18n message when `activeTenantId` is null |
| Metric cards (plan, ability, quota, access) | ✅ Done | 4 `renderShellMetric` cards in hero section |
| Identity summary card | ✅ Done | `renderSummaryCard` with username, email, plan |
| Quota summary card | ✅ Done | `renderSummaryCard` with 4 quota values + unlimited support |
| ShellPageTemplate CSS classes | ✅ Done | `ShellPageChrome`, `ShellPanel`, `shellPage__surfaceCard`, etc. |
| TypeScript check | ✅ Pass | `npx tsc --noEmit` — 0 errors |
| Build | ✅ Pass | 3244 modules, 0 errors, chunk 3.85 kB |
| Dev stack refresh | ✅ Done | `./start_dev.ps1` — all services built, healthy, smoke checks pass |
| Audit ledger | ✅ Done | Entry 13 added to `CODE_CHANGE_AUDIT_LEDGER.md` |
| Remaining pages need i18n & permission gating | ⏳ Deferred | Members, ServiceAccounts, PATs, Usage, Billing, AuditLogs, Capabilities, SSO |

---

---

## SaaS Full Independence B1-B2 (2026-06-24)

| Item | Status | Details |
|------|--------|---------|
| B1: Proxy Gateway (`legacy_proxy.py`) | ✅ Done | `httpx.Client`, hop-by-hop stripped, 5s connect / 120s read / 30s write / 5s pool timeout, 502 JSON on backend down |
| B1: Proxy route last in `urls.py` | ✅ Done | Native routes take priority (no explicit exclusion list needed) |
| B1: `LEGACY_BACKEND_URL` env | ✅ Done | `settings.py` env var, default `http://backend:8000` |
| B2.1: Email backend config | ✅ Done | EMAIL_HOST/PORT/USE_TLS from env in `settings.py` |
| B2.2: Native register endpoint | ✅ Done | 3-layer spam shield + transactional outbox + email verification |
| B2.3: Native verify/resend email | ✅ Done | POST `/api/auth/verify-email/` + `/api/auth/resend-verification/` |
| B2.4: Native password reset | ✅ Done | DB-backed tokens, rate-limited, POST `/api/auth/password-reset/` + `/password-reset/confirm/` |
| B2.5: User migration script | ✅ Done | `scripts/migrate_users_to_core.py`, idempotent, `--dry-run`, reads `LEGACY_DATABASE_URL` |
| B2.6: Auth compat routes | ✅ Done | `identity_access/api_urls.py` with `/api/auth/*` → native views, included BEFORE proxy |
| Model/DB alignment | ✅ Fixed | Added `allowed_symbols`, `features` to `CoreServiceAccount`, `gateway_rate_tier_override` to `CoreTenant`; migration 0018 faked |
| Register endpoint | ✅ Verified | POST `/api/auth/register/` → 201 with correct Vietnamese response |
| Native auth routes | ✅ Verified | OPTIONS/POST `/api/auth/token/` → 200/401 (native, not proxied) |
| Proxy catch-all preserved | ✅ Verified | `/api/nonexistent-route` → 502 `LEGACY_BACKEND_DOWN` |
| Audit ledger | ✅ Done | Entries 14-18 added to `CODE_CHANGE_AUDIT_LEDGER.md` |

## Open Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LE cert for beta.edusuccess.vn | HTTPS unavailable | Force renewal or wait 3600s |
| Orphan container warnings | Noise in logs | Acceptable — not harmful |
| nginx-proxy generated config | Port parsing edge case | Fixed: VIRTUAL_PORT heredoc mangling |
