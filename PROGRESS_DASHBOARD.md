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
