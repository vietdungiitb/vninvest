# BACKEND DESIGN - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15  
**Purpose**: detailed backend handoff for implementation without follow-up questions.

---

## 1. Responsibility split

| Layer | Responsibility | Must not do |
|---|---|---|
| `market_data.vnbroker_adapter` | provider access SSOT, retries, timeout, fallback policy | direct provider imports elsewhere |
| `data_ingest` | scheduled ingest, warmup, backfill, persistence | bypass adapter or invent a second control plane |
| `service_ops` | operator planner, queue tiers, run logs, runtime config/admin | act like a product read service |
| `signal_intelligence` | canonical whale/order-flow facts | synthesize random production data |
| `market_serving` | facts-first chart and session serving | full-scan raw tick on primary reads |

---

## 2. API families

### 2.1 Market-data

1. intraday prices - OHLCV bars
2. intraday tape - tick trade list
3. session facts - CVD and strength series
4. symbol snapshot - cached serving snapshot

### 2.2 Operator / scraping

1. matrix cycles and cells
2. provider roster and queue-tier state
3. run history and recovery state
4. manual planner run controls

### 2.3 Runtime config / admin

1. read current config
2. preview config change
3. apply config change with audit
4. list config history
5. show effective state and disabled reasons

---

## 3. Canonical backend contract rules

1. Validate all input at the boundary.
2. Return 400 with field errors for invalid request fields.
3. Return 409 for state conflict or stale version writes.
4. Return 429 for rate-limited calls.
5. Paginate all list endpoints.
6. Provide examples in OpenAPI for each active route.
7. Keep error envelope stable and structured.
8. Keep tenant or operator scope enforced in the query layer.
9. Do not swallow exceptions.

---

## 4. Data source priority

1. Materialized facts and snapshots first.
2. Canonical events second.
3. Raw tick only for hot retention, replay, and forensic windows.
4. External provider access only through the adapter.

### Default retention choices

- raw tick: 7 days hot
- intraday bars: 7 days hot
- canonical whale/order-flow events: long-lived
- SessionFacts and SessionFactsBucket: long-lived
- runtime snapshots: cache only

---

## 5. Runtime config/admin backend design

The backend must provide a permission-aware operator API for runtime control.

### Capabilities

1. get current config by section,
2. preview proposed changes before save,
3. save with audit trail and versioning,
4. return effective config and disabled/read-only reasons,
5. list history and change authors,
6. expose run-state indicators for operator decisions.

### Source of truth

- runtime policy helpers and service config models remain the backend SSOT.
- the UI is a view/controller layer only.
- changes must be write-through to the canonical config store, not copied into a second config system.

---

## 6. Materialization and scheduling

Recommended baseline cadence for this bundle:

- `materialize_symbol_snapshot`: 60s
- `materialize_session_facts`: 5m
- `materialize_unified_alerts`: 2m
- realtime prefetch: 3s
- daily price backfill: after market close

Materializers must be idempotent and must invalidate or refresh affected serving snapshots after recompute.

---

## 7. Query and performance rules

1. Use SQL-first filtering and projection for selection.
2. Use Pandas/vectorized compute only when batch derivation is needed.
3. Keep hot chart reads on precomputed or indexed tables.
4. Avoid N+1 on any endpoint consumed by the frontend admin/runtime panels.
5. Keep cache keys explicit and traceable in evidence.

---

## 8. Backend file anchors for implementation

- `packages/core/backend/src/market_data/vnbroker_adapter.py`
- `packages/core/backend/src/service_ops/tasks.py`
- `packages/core/backend/src/service_ops/views/matrix.py`
- `packages/core/backend/src/service_ops/dataops_market_data.py`
- `packages/core/backend/src/vninvest_core/settings.py`
- `packages/core/backend/src/market_serving/materializers.py`
- `packages/core/backend/src/signal_intelligence/materializers.py`
- `packages/core/backend/src/market_serving/session_facts_engine.py`
- `packages/core/backend/src/market_serving/views.py`

---

## 9. Backend DoD

1. Canonical routes are declared and documented.
2. Runtime config/admin backend API exists and is permission-aware.
3. Facts-first path exists for chart and signal reads.
4. OpenAPI metadata is aligned with actual payloads.
5. Retention policy is explicit and testable.
6. Focused backend tests pass.
