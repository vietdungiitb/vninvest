# Tenant Admin Upgrade — Audit Report 2026-06-24

## Scope

Final validation & bugfix session for Tenant Admin Upgrade (Phase 0-2):

- Phase 0: Dashboard Home (KPI metrics, usage trend chart, activity feed)
- Phase 1: Usage Meters (risk states, alert configs, quota list, audit logs)
- Phase 2: Usage History (meter selector, Recharts bar chart, day range toggle), Forecast (exhaust date prediction, confidence levels)

## Issues Found & Fixed

### 1. React #310 — Hook called conditionally (`TenantAdminUsagePage.tsx`)

**Root cause**: `useMemo(chartData)` was placed after 3 early-return guards (`!canRead`, `loading`, `error`). React enforces hook call order; a hook after a conditional return violates the rules.

**Fix**: Moved `selectedHistoryData` computation and `useMemo(chartData)` → `chartData` expression before all early returns (line 193-196).

### 2. Backend 500 — `GET /core/v1/partner/usage/alert-config/`

**Root cause**: `UsageAlertConfig` model existed in `identity_access/models.py` but migration `0014_usage_alert_config` had never been created. The view queried a non-existent table.

**Fix**:
1. Generated migration `0014_usage_alert_config.py` via `manage.py makemigrations` inside Docker container
2. Ran `manage.py migrate` to apply it
3. Copied migration file to host and committed (`70c44662`)

### 3. TypeScript — `results` property missing on type `Response`

**Root cause**: `declarations.d.ts` declared `coreGet` as returning `Promise<Response>`, but the actual transport always calls `response.json()` and returns parsed JSON. The `.results` access pattern used throughout the codebase is correct at runtime but violated the type declaration.

**Fix**: Changed return type from `Promise<Response>` → `Promise<any>` for `coreGet`, `corePost`, `corePatch`, `coreDelete` in `declarations.d.ts:68-71`.

### 4. TypeScript — Missing adapter methods

**Root cause**: `TenantAdminUsagePage.tsx` called `getAllUsageTrends()`, `getUsageForecast()`, `getAlertConfigs()` on the adapter, but these methods did not exist.

**Fix**:
- Added methods to `coreApiAdapter.js` return object (`coreApiAdapter.js:141-149`)
- Added type declarations to `coreApiAdapter.d.ts`

## Files Changed

| File | Change | Type |
|------|--------|------|
| `packages/core/backend/.../partner_urls.py` | Added routes for dashboard/alert-config/forecast/trend | modified |
| `packages/core/backend/.../views_dashboard.py` | New — partner dashboard summary + usage trend endpoints | added |
| `packages/core/backend/.../views_alert_config.py` | New — alert config CRUD for usage meters | added |
| `packages/core/backend/.../views_forecast.py` | New — usage forecast with exhaust date prediction | added |
| `packages/core/backend/.../views_usage_trend.py` | New — per-meter daily usage trend data | added |
| `packages/web/src/adapters/coreApiAdapter.js` | Added `getAllUsageTrends`, `getUsageForecast`, `getAlertConfigs` | modified |
| `packages/web/src/adapters/coreApiAdapter.d.ts` | Type declarations for 3 new methods | modified |
| `packages/web/src/declarations.d.ts` | Fixed `coreGet`/`corePost`/`corePatch`/`coreDelete` to return `Promise<any>` | modified |
| `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx` | Full i18n rewrite + hook order fix + tabs layout | modified |

## Validation

```powershell
npx tsc --noEmit  # → clean (0 errors)
npm run build     # → clean (3822 modules, built in 12.70s)
```

## Backend URLs Added

```
GET /core/v1/partner/dashboard/summary/
GET /core/v1/partner/dashboard/usage-trend/
GET /core/v1/partner/usage/alert-config/
GET /core/v1/partner/usage/alert-config/<meter_code>/
GET /core/v1/partner/usage/forecast/
GET /core/v1/partner/usage/forecast/<meter_code>/
GET /core/v1/partner/usage/trend/
GET /core/v1/partner/usage/trend/<meter_code>/
```

## Deployment

- Frontend dist rebuilt and copied to `vninvest-dev-frontend:/usr/share/nginx/html/`
- Backend view files synced from container to host source
- Dev stack running with `start_dev.ps1`

## Residual Risk

- `PartnerUsageMetersView` and `PartnerUsageQuotasView` return hardcoded/mock data (the `commercial_partner_views.py` reference implementation was not replaced with real billing data). The Meters/History/Forecast tabs will render UI correctly but show empty or placeholder data until the commercial billing service is connected.
- No E2E tests for the tenant-admin routes yet.
