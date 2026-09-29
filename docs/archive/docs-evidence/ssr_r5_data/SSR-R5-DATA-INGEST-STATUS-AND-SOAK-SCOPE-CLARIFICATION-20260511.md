# R5 Soak Window — Data Ingest Status & Scope Clarification

**Date**: 2026-05-11  
**Finding**: Realtime data ingest NOT active in dev environment

---

## 1. Technical Finding

### Database Table Status
- ✅ `portfolio_tickersessionclose` **EXISTS** in shared DB
- ✅ All portfolio_* tables created and migrated
- ✅ Schema is HEALTHY

### Materializer Status
- ✅ Core-beat dispatches tasks on schedule (60s, 120s, 300s cadence)
- ✅ Core-worker consumes tasks successfully
- ⚠️ **Tasks return `upserted 0 rows/alerts`** — NO DATA FLOWING INTO SOURCE TABLES

### Root Cause
**Realtime market data ingest pipeline NOT ACTIVE**:
- No live broker API connection (vnbroker.ai API keys not configured)
- No real-time ticker feed flowing to `portfolio_tickersessionclose`
- No whale alert detection running
- Dashboard shows placeholder/cached data only

---

## 2. Dev Environment Constraints

| Component | Status | Notes |
|---|---|---|
| Core services (api, worker, beat) | ✅ Healthy | All services running, broker connectivity OK |
| Task scheduling | ✅ Working | Beat dispatch on cadence, worker consume/complete cycles |
| Database schema | ✅ Complete | All tables exist, migrations applied |
| **Realtime ingest** | ❌ Off | No live broker API data flowing |
| **Market data feed** | ❌ Off | Dashboard shows cached/demo data only |

---

## 3. R5 Soak Scope Clarification

### What R5.1 IS testing:
✅ Core runtime stability (services stay up)  
✅ Background job orchestration (beat→queue→worker cycle)  
✅ Schema integrity (no crashes, no query errors)  
✅ Resource utilization (memory, CPU, connections stable)  
✅ Error log cleanliness (no critical errors)

### What R5.1 IS NOT testing:
❌ Production traffic load (no real market data)  
❌ Data ingest reliability (broker connectivity, data quality)  
❌ Realtime feed performance (no ticks flowing)  
❌ Production SLA (queue latency measured against 0 traffic)

---

## 4. Soak Configuration

**Scope**: **Non-Production Load Soak** (system health check mode)

**Why valid for R5.1**:
1. R5.1 gates are runtime stability, not data throughput
2. Background job orchestration is independent of data volume
3. Schema validation is independent of data presence
4. Scheduled maintenance tasks (cleanup, retention) are covered

**Considerations for R6 (Production Cutover)**:
- R5.1 soak on dev (zero-load) is not equivalent to production soak (live traffic)
- Production migration will require separate soak with live broker connectivity
- This is documented in Phase 6 requirements

---

## 5. Continuing R5.1 as Planned

**Decision**: ✅ **Proceed with R5.1 24h soak as planned**

Rationale:
- Core runtime health is the R5.1 gate criterion
- Data ingest is operational requirement, not runtime stability requirement
- 24h zero-load soak is still valid baseline for service uptime/restart metrics

**Tracking note for later phases**:
- Document in SAAS_MIGRATION docs that R5.1 (dev) was zero-load
- Production cutover will need data-loaded soak window
- Broker API setup required before production R5 equivalent

---

## 6. Monitoring Adjustment for R5

During 24h soak, focus on:

| Metric | Threshold | Expected |
|---|---|---|
| Service uptime | 100% (no restarts) | ✅ Expected to pass |
| Queue depth | 0 (no traffic) | ✅ Expected 0 |
| API health endpoints | 200 | ✅ Expected pass |
| Error rate in logs | 0 (no failures) | ✅ Expected 0 |
| Memory trend | Stable | ✅ Expected stable |
| DB connections | <= 10 (idle) | ✅ Expected low |

**SLO thresholds remain unchanged** — we're measuring runtime resilience at zero load, which is valid for R5.1 gate.
