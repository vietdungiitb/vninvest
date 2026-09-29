# TECH SPEC - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15  
**Status**: APPROVED BASELINE FOR EXECUTION

---

## 1. Canonical layering

### 1.1 Layer model

1. **L0 Raw ingest**
   - IntradayTick, intraday bar raw slices, live tape, provider payloads.
   - Retention: short hot window, default 7 days in Postgres hot storage.

2. **L1 Canonical events**
   - WhaleAlertCanonical, OrderFlowEvent, signal lifecycle truth.
   - Retention: long-lived, partitioned if needed.

3. **L2 Derived facts**
   - SessionFacts, SessionFactsBucket, bucket series, selected-session summaries.
   - Retention: long-lived, facts-first read path.

4. **L3 Serving snapshots**
   - Redis/cache snapshots, chart payloads, advisory payloads, runtime previews.
   - Retention: ephemeral, regenerable.

5. **L4 Operator control plane**
   - service_ops, runtime config/admin APIs, run logs, audit history.
   - Retention: durable audit and control history.

---

## 2. Backend contract rules

1. Every API must have request schema, response schema, examples, and explicit status codes.
2. Validation failures return 400 with `field_errors`.
3. State conflicts return 409.
4. Rate limit returns 429.
5. List endpoints must be paginated.
6. No swallow exceptions in API paths.
7. Tenant or operator-scoped endpoints must filter at the query layer and have cross-scope tests.
8. OpenAPI metadata must match real runtime behavior.

### Error envelope

```json
{
  "detail": "Human-readable error",
  "code": "error_code_slug",
  "timestamp": "2026-05-15T12:00:00Z",
  "request_id": "req_xxx",
  "field_errors": {}
}
```

---

## 3. Backend route families

### 3.1 Market data

- `/core/v1/market-data/intraday-prices/{symbol}/`
- `/core/v1/market-data/intraday-tape/{symbol}/`
- `/core/v1/market-data/session-facts/{symbol}/cvd/`
- `/core/v1/market-data/session-facts/{symbol}/strength/`
- `/core/v1/market-data/symbol-snapshot/{symbol}/`

### 3.2 Operator / scraping

- `/core/v1/operator/scraping/*`
- matrix cycle and run-history endpoints
- provider health and queue-tier observability endpoints

### 3.3 Runtime config / admin

- `/core/v1/operator/runtime-config/`
- `/core/v1/operator/runtime-config/preview/`
- `/core/v1/operator/runtime-config/audit/`
- `/core/v1/operator/runtime-config/{section}/`

These endpoints power the frontend admin runtime panel.

---

## 4. Data source priority

1. Use materialized facts first.
2. Use canonical events to back facts.
3. Use raw tick only for recent ingest, replay, or forensic windows.
4. Never full-scan raw tick on the primary read path if a facts-first path exists.

### Materialization cadence baseline

- symbol snapshot: 60s
- session facts: 5m
- unified alerts: 2m
- realtime prefetch: 3s
- daily backfill: after market close, via scheduled job

---

## 5. Frontend contract rules

1. Frontend must call backend through the adapter layer only.
2. Direct fetch to backend routes is not allowed for new flows.
3. Selected-session truth must drive chart, advisory, bubble, and tape surfaces.
4. Runtime config/admin controls must be visible and permission-aware.
5. UI text added in this workstream must be Vietnamese with full diacritics in the product surfaces.

---

## 6. Runtime config/admin contract

The frontend admin surface must support:

1. read current config,
2. preview pending config changes,
3. save config with audit trail,
4. view config history,
5. see effective runtime state for providers, schedules, and retention,
6. see disabled/read-only state when permissions are missing.

The backend must expose matching operations with audit records and explicit permission checks.

---

## 7. Retention rules

| Data class | Target retention | Notes |
|---|---|---|
| IntradayTick | 7 days hot | short-lived, recovery/replay use |
| IntradayBar | 7 days hot | daily/weekly/monthly can be rolled up |
| WhaleAlertCanonical | long-lived | canonical event history |
| OrderFlowEvent | long-lived | canonical signal history |
| SessionFacts | long-lived | chart/advisory serving truth |
| SessionFactsBucket | long-lived | CVD/strength per bucket |
| Runtime snapshots | ephemeral | cache only |
| Audit history | long-lived | operator traceability |

---

## 8. Observability and audit

1. Every materializer run must emit run log and status.
2. Every runtime config change must emit audit history.
3. Every API contract change must appear in OpenAPI examples and tests.
4. Every frontend control action must have a visible success/error state.
5. Every slice must leave an evidence trail in ledger and progress docs.
