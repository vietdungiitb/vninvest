# IMPLEMENTATION PLAN - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15  
**Status**: APPROVED FOR EXECUTION  
**Goal**: hand off a complete SaaS-native plan for backend contracts, frontend runtime config/admin, and audit-ready OpenAPI closure.

---

## 1. Scope

### In scope

1. Canonicalize backend routes and payloads under the SaaS-native OpenAPI contract.
2. Keep `market_data.vnbroker_adapter` as the only broker access SSOT.
3. Keep `service_ops` as the operator control plane for scraping/runtime planning.
4. Materialize and retain market facts long enough for chart/advisory reads.
5. Add a frontend runtime config/admin layer for operators to preview, update, and audit runtime controls.
6. Provide test, audit, traceability, and evidence templates.

### Out of scope

1. Adding new broker providers.
2. Reintroducing direct provider imports outside the adapter.
3. Building a new user-specific market data silo.
4. Making 10m candle a new canonical timeframe in this slice.
5. Changing unrelated product surfaces that do not consume these contracts.

---

## 2. Architecture notes

1. Raw ingest is transient; derived facts are the product truth.
2. OpenAPI is the source of contract truth for backend/frontend alignment.
3. Runtime config must be readable and writable through controlled operator surfaces, not hidden in ad hoc env hacks.
4. Frontend must go through the adapter layer only.
5. Admin/operator actions must be permission-aware and auditable.

---

## 3. Workstream phases

### Phase A - Contract freeze

- Inventory active routes and identify the canonical SaaS-native namespace.
- Freeze request/response envelope shape and error semantics.
- Define runtime config ownership and frontend admin UX boundaries.

### Phase B - Backend contract hardening

- Finalize market-data and operator endpoint groups.
- Add schema examples, pagination, 409/429 semantics, and error envelope coverage.
- Lock runtime config/admin APIs and audit history endpoints.

### Phase C - Materialization and retention

- Keep raw tick on a short hot retention window.
- Keep canonical events and SessionFacts as long-lived facts.
- Ensure read paths prefer facts/snapshots over raw scans.

### Phase D - Frontend adapter + admin/runtime surface

- Update the adapter to call only canonical endpoints.
- Add runtime config/admin panel for operators.
- Keep selected-session truth for charts and advisory.

### Phase E - Validation and cutover evidence

- Run focused backend tests and frontend smoke tests.
- Refresh runtime stack after changes.
- Capture payload proof, screenshots, and residual risk notes.

---

## 4. Task breakdown

| Task ID | Name | Main artifact | DoD |
|---|---|---|---|
| P01 | Freeze route and config ownership | docs bundle + route inventory | canonical route map and runtime config ownership are explicit |
| P02 | Harden backend OpenAPI contracts | backend views/serializers/schema | request/response schema, examples, errors, and pagination are complete |
| P03 | Lock operator/runtime config APIs | backend admin/runtime endpoints | operators can preview/update/audit config through API |
| P04 | Materialize durable facts | materializers and retention jobs | facts-first reads work without raw tick primary scans |
| P05 | Build frontend adapter layer | frontend API adapter | no direct fetch bypass on new flows |
| P06 | Add runtime config/admin UI | frontend admin surface | operators can view and control runtime config from UI |
| P07 | Keep selected-session chart truth | whale/chart consumers | chart/advisory/tape remain session-consistent |
| P08 | Add tests and audit artifacts | tests + docs | all required protocols and evidence templates exist |
| P09 | Refresh runtime and capture smoke proof | dev runtime | latest code is loaded and verified |

---

## 5. Dependency graph

P01 -> P02 -> P03 -> P08 -> P09
P01 -> P04 -> P07 -> P08
P01 -> P05 -> P06 -> P08 -> P09

---

## 6. Validation gates

1. Backend focused tests for route resolution, permissions, status semantics, and OpenAPI metadata.
2. Frontend focused tests for adapter usage, runtime config/admin rendering, and session truth.
3. Runtime smoke against dev stack after rebuild/restart.
4. Evidence update in audit ledger and progress dashboard.
5. No new direct provider import or direct fetch bypass.

---

## 7. Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Contract drift between backend and frontend | M | keep the OpenAPI and frontend design docs in the same bundle |
| Runtime config hidden in env-only workflow | M | require explicit operator UI + audited API |
| Facts not materialized in time for chart path | H | keep raw retention short but materialization jobs on a reliable cadence |
| New direct fetch bypass in frontend | M | route all calls through the adapter and add regression tests |
| Scope creep into unrelated UI features | M | keep non-goals explicit and treat them as separate slices |
