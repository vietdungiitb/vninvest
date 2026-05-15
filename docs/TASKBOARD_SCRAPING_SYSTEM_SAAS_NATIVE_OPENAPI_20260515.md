# TASKBOARD - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15  
**Legend**: `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked

---

## Phase A - Freeze contract and ownership

- [ ] `SOA-T01` Freeze route map and runtime config ownership
  - Artifact: `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_HANDOFF_MASTER_20260515.md`
  - DoD: canonical route families and config ownership are explicit

- [ ] `SOA-T02` Inventory backend endpoints in scope
  - Artifact: `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
  - DoD: market-data, operator, and runtime-config routes are listed

---

## Phase B - Backend contract hardening

Progress note 2026-05-15:
- Canonical DataOps aliases now mount under `/core/v1/operator/scraping/dataops/*` for `coverage`, `run-logs`, `planner/preview`, `planner/run`, `queue-tiers`, and `runtime-config`.
- Canonical DataOps views now expose `drf-spectacular` summaries, request/response schema, examples, and a focused schema regression; `REST_FRAMEWORK` no longer uses `NamespaceVersioning` because that setting was collapsing `/core/v1/schema/` to `paths: {}`.
- `CorePATAuthentication` now has an explicit `CorePATBearer` OpenAPI auth extension, and the canonical DataOps schema regression now locks route-level `security` plus `components.securitySchemes`.
- `service_ops/views/overview.py` now exposes explicit OpenAPI serializers/summaries for the overview/service catalog/health-check surface, and `OverviewDomainApiTestCase` locks both emitted schema and queue behavior for the touched routes.
- `service_ops/views/vnbroker.py` now exposes explicit OpenAPI serializers/summaries for VNBroker config/preview/health/test-connection/providers/circuit-breaker/ownership, and `VnbrokerDomainApiTestCase` now locks both emitted schema and health fallback behavior for the domain.
- `service_ops/views/prefetch.py` now exposes explicit OpenAPI serializers/summaries for Prefetch config/profiles/cache-status/purge-cache/warm-now/universe-groups/task-schedule/ownership, and `PrefetchDomainApiTestCase` now locks both emitted schema and the stable default config fallback contract.
- `service_ops/views/signals.py` now exposes explicit OpenAPI serializers/summaries for Signals config/preview/apply-block, summary, whale, dark-pool, screener, retention, materialization, universe, jobs, and performance endpoints, and `test_soc_api_signals.py` now locks representative emitted schema plus request bodies for the domain.
- `service_ops/views/screener.py` now exposes explicit OpenAPI serializers/summaries for Screener config/rules/results/alert-history/manual-scan/rules-run/ownership, and `ScreenerDomainApiTestCase` now locks emitted schema plus the stable default config fallback contract.
- `service_ops/views/matrix.py` now exposes explicit OpenAPI serializers/summaries for matrix cycles/detail/start/cells/abort/providers/monitor, `MatrixDomainApiTestCase` now locks emitted `/api/soc/matrix/*` schema paths plus auth/request-body semantics, and the adjacent `PrefetchWarmNowView` now declares `request=None` so `service_ops` no longer logs serializer guessing for that endpoint.

- [~] `SOA-T03` Add/align OpenAPI request and response schema
  - Artifact: backend serializers/views/schema metadata
  - DoD: examples, status codes, and error envelope are complete

- [ ] `SOA-T04` Add pagination, 409, 429, and field_errors semantics
  - Artifact: backend API implementation
  - DoD: list endpoints paginated; validation and conflict semantics correct

- [ ] `SOA-T05` Lock runtime config/admin API shape
  - Artifact: backend operator/runtime-config endpoints
  - DoD: read, preview, save, and audit operations are available

---

## Phase C - Data lifecycle and materialization

- [ ] `SOA-T06` Keep raw tick hot and short-lived
  - Artifact: retention job or policy doc
  - DoD: 7-day hot retention is documented and enforceable

- [ ] `SOA-T07` Keep canonical events and SessionFacts long-lived
  - Artifact: materializer/retention policy
  - DoD: derived facts are the primary read path for charts and advisory

- [ ] `SOA-T08` Preserve facts-first read path
  - Artifact: market-serving read path and tests
  - DoD: primary reads do not require full raw tick scans

---

## Phase D - Frontend adapter and admin/runtime surface

Progress note 2026-05-15:
- `frontend/src/api/socApi.js` now routes all DataOps calls to the canonical operator namespace instead of the legacy `/api/soc/dataops/*` alias.

- [ ] `SOA-T09` Route frontend API calls through adapter only
  - Artifact: `frontend/src/api/client.js` or adapter equivalent
  - DoD: no new direct fetch bypass on the in-scope flows

- [ ] `SOA-T10` Add runtime config/admin panel
  - Artifact: frontend admin surface
  - DoD: operators can view, preview, update, and audit runtime settings

- [ ] `SOA-T11` Keep selected-session truth on chart/advisory/tape
  - Artifact: chart and whale consumers
  - DoD: UI consumes one session truth for all related surfaces

---

## Phase E - Test and audit closure

- [~] `SOA-T12` Add backend focused regression tests
  - Artifact: API/unit tests
  - DoD: route, auth, permission, pagination, and schema tests exist

- [ ] `SOA-T13` Add frontend focused regression tests
  - Artifact: frontend tests
  - DoD: adapter, runtime config/admin, and session-truth tests exist

- [ ] `SOA-T14` Add traceability and evidence docs
  - Artifact: docs bundle
  - DoD: traceability matrix, audit protocol, and evidence template are present

- [ ] `SOA-T15` Refresh runtime and capture smoke proof
  - Artifact: dev runtime + screenshots/payload snapshots
  - DoD: latest code is loaded and verified

---

## Gate summary

- Gate A: route map and owner boundaries frozen
- Gate B: OpenAPI contract hardening complete
- Gate C: data lifecycle and retention rules locked
- Gate D: frontend adapter and admin/runtime surface complete
- Gate E: test, audit, and runtime proof complete
