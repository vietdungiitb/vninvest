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

## Open Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LE cert for beta.edusuccess.vn | HTTPS unavailable | Force renewal or wait 3600s |
| Orphan container warnings | Noise in logs | Acceptable — not harmful |
| nginx-proxy generated config | Port parsing edge case | Fixed: VIRTUAL_PORT heredoc mangling |
