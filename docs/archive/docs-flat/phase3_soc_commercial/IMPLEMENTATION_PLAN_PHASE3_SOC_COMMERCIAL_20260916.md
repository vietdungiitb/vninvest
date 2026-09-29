# Implementation Plan — SOC Phase 3 Commercial

**Source**: `AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md` §Phase 3 (lines 308-313)
**Date**: 2026-09-16
**Scope**: P2-P3 commercial items — SLO/SLI, Alerting, Export, CSS cleanup
**Target**: 92% → 98% (ngang thương mại Datadog/Grafana)

---

## Current State Summary

| Component | Status | Key Files |
|-----------|--------|-----------|
| ServiceHealth model | Snapshot only (status + consecutive_failures + avg_response_ms) — no SLO fields | `service_ops/models.py:101-137` |
| ServiceRunLog | Full execution history (started_at, finished_at, duration_seconds, status) | `service_ops/models.py:140-178` |
| UnifiedAlert | Symbol-centric (whale/dark_flow/signal/system) — no domain-level health alerts | `signal_intelligence/models.py:15-73` |
| Health alert fn | Only retention: `_upsert_retention_health_alert` (tasks.py:1087) | domain-locked to `market_data_parity_retention` |
| soc.module.css | 2405 lines — monolithic CSS module | `soc.module.css` |
| Adapter health | `getSocHealthStatus()` + `getSocServiceHealth(key)` exist | `soc.js:42,56` |
| Frontend SLO | None — only `status healthy/degraded` badge | SOC Overview panels |

---

## Steps

### Step 1 — CSS Split (Tech debt, P3, ~0.5d)
**Goal**: Break `soc.module.css` (2405 lines) into logical tokens + components files.
**Files**: `soc.module.css` → `soc.tokens.css` + `soc.components.css` + `soc.module.css` (re-exports)

- **1a**: Create `soc.tokens.css` — extract CSS custom properties (`--soc-*`), color tokens, spacing tokens, typography, glassmorphism vars, tone functions
- **1b**: Create `soc.components.css` — extract all `.className` rules (panels, tabs, grids, accordions, forms, metrics, buttons, badges, alerts, etc.)
- **1c**: Update `soc.module.css` to `@import './soc.tokens.css'` + `@import './soc.components.css'` so all existing imports continue to work unchanged
- **Verify**: `npx tsc --noEmit` + `npm run build` + `npm run lint` — zero new errors

### Step 2 — SLO Model (P2, ~1d)
**Goal**: Add SLO/SLI fields to `ServiceHealth` + create history table for uptime computation.
**Files**: `service_ops/models.py`, new migration

- **2a**: Add fields to `ServiceHealth`: `slo_target` (float, default 0.999 = 99.9%), `error_budget_remaining` (float), `uptime_30d` (float, computed from history), `burn_rate_1h` (float)
- **2b**: Create `ServiceHealthCheckLog` model — timestamped history records: `service FK`, `status`, `response_ms`, `checked_at` — enables rolling window uptime calculation
- **2c**: Migration `0017_*`
- **Verify**: `python manage.py migrate --check` + BE tests

### Step 3 — SLO Computation (P2, ~1d)
**Goal**: Compute uptime percentage, burn-rate from `ServiceHealthCheckLog` history.
**Files**: `service_ops/tasks.py`, `service_ops/views/overview.py`

- **3a**: Add `_compute_uptime_slo(service_key, window_days=30)` — queries `ServiceHealthCheckLog` for window, computes `uptime_pct = success_checks / total_checks`, `burn_rate_1h = failure_rate / budget_rate`
- **3b**: Call from `probe_service_health()` (tasks.py) after each probe — writes results back to `ServiceHealth` fields
- **3c**: Add `SocSloOverviewView` — returns per-service SLO summary: `service_key, uptime_30d, slo_target, error_budget_remaining, burn_rate_1h, status`
- **3d**: Wire URL: `/operator/soc/slo-overview/`
- **Verify**: BE tests for uptime computation, burn-rate formula

### Step 4 — SLO Frontend (P2, ~1d)
**Goal**: Show SLO badges + burn-rate sparkline in SOC Overview.
**Files**: `soc.js` adapter, `SocOverviewPanel.tsx`, `SocRuntimeKpiPanel.tsx`

- **4a**: Add `getSocSloOverview()` to adapter (`soc.js`) — calls `GET /operator/soc/slo-overview/`
- **4b**: Overview panel — add SLO badge next to each service: `uptime_30d%` with color (green ≥ target, yellow > budget_remaining 50%, red ≤)
- **4c**: RuntimeKpi panel — add burn-rate sparkline (mini bar chart from last 24h of `ServiceHealthCheckLog`)
- **4d**: i18n keys: `soc.slo.*`
- **Verify**: `npx tsc --noEmit` + `npm run build`

### Step 5 — Alerting Extension (P2, ~1d)
**Goal**: Auto-create `UnifiedAlert` when service transitions `degraded→unhealthy`. Extend to all domains.
**Files**: `service_ops/tasks.py`, `service_ops/models.py`

- **5a**: Create `_upsert_service_health_alert(service_key, old_status, new_status, health_data)` — generic version of `_upsert_retention_health_alert`, creates `SYSTEM` alert for any domain when status degrades
- **5b**: Hook into `probe_service_health()` — compare old vs new status, call alert fn on transition
- **5c**: Add `SOC_ALERT_COOLDOWN_HOURS` setting (default 4h) to prevent alert storms — uses `source_ref` uniqueness
- **5d**: Log alert creation in `ServiceHealth.detail['last_alert']`
- **Verify**: BE tests for transition detection, dedup/cooldown

### Step 6 — Export CSV (P2, ~0.5d)
**Goal**: Export `ConfigChangeAudit` + `ServiceRunLog` as CSV download.
**Files**: `service_ops/views/`, `soc.js` adapter, frontend buttons

- **6a**: `SocExportConfigAuditsView` — returns CSV of ConfigChangeAudit (last 500 rows, filtered by date/domain)
- **6b**: `SocExportRunLogsView` — returns CSV of ServiceRunLog (last 500 rows)
- **6c**: Adapter methods `exportSocConfigAudits(params)` + `exportSocRunLogs(params)`
- **6d**: Frontend buttons in DataOps Monitor section — "Export CSV" triggers `window.open()` to CSV URL
- **6e**: i18n keys: `soc.export.*`
- **Verify**: `npx tsc --noEmit` + `npm run build`

---

## Verification (End of Phase 3)

- `npx tsc --noEmit` → 0
- `npm run build` → PASS
- `npm run lint` → 0 errors
- `npm run test:components` → PASS
- `npm test` → soc.test.js PASS
- `python manage.py test service_ops` → PASS
- Migration applies cleanly

---

## What We're NOT Doing (Deferred)

- **Dependency graph** (ServiceDependency visual like Grafana) — requires new model + complex FE, defer to Phase 4
- **Webhook/Email delivery** (Slack/Email for alerts) — requires Celery task for HTTP webhook + email service config, defer
- **RBAC gate** for SOC pages — depends on existing tenant-admin RBAC patterns, defer (already partially gated)
- **Forecast sparkline** — requires time-series data + ML, defer

## Notes

- `soc.module.css` at 2405 lines is manageable — not 2707 as audit estimated (may have been before P2-B cleanup)
- `ServiceRunLog` has `duration_seconds` and `started_at/finished_at` — sufficient for capacity sparkline without new model
- `UnifiedAlert.source_ref` unique constraint already provides dedup — cooldown logic is additive
- SLO computation must handle edge case: no `ServiceHealthCheckLog` records yet (cold start → return null, not 0%)
