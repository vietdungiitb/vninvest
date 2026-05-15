# SELF AUDIT AND TEST PROTOCOL - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15  
**Purpose**: checklist for the executor and the reviewer before marking the slice done.

---

## 1. Preflight checklist

- [ ] Bundle docs exist and are internally consistent.
- [ ] Backend route families are enumerated.
- [ ] Frontend runtime config/admin requirement is reflected in the design.
- [ ] Raw retention, canonical retention, and facts retention are explicit.
- [ ] OpenAPI constitution is referenced.
- [ ] No scope drift into unrelated product work.

---

## 2. Backend test matrix

| Area | Test type | Expected |
|---|---|---|
| Route resolution | API/URL tests | canonical routes resolve |
| Auth/permission | API tests | unauthorized and forbidden paths behave correctly |
| Validation | API tests | invalid input returns 400 with field errors |
| Conflict | API tests | stale version or conflicting state returns 409 |
| Pagination | API tests | list endpoints never return unbounded datasets |
| Error envelope | API tests | detail/code/timestamp/request_id/field_errors are stable |
| Runtime config | API tests | read/preview/save/audit operations work |
| Materialization | task tests | facts are materialized and refreshed idempotently |

---

## 3. Frontend test matrix

| Area | Test type | Expected |
|---|---|---|
| Adapter usage | unit test | new flows call the adapter only |
| Runtime config/admin | component/integration | view, preview, update, audit, readonly state all render |
| Chart session truth | integration | selected-session truth remains stable |
| Permission handling | component | disabled/readonly UI is visible when needed |
| i18n | snapshot or render check | new labels are Vietnamese with full diacritics |

---

## 4. OpenAPI audit checklist

1. Request schemas are present for all changed endpoints.
2. Response schemas and examples are present for all changed endpoints.
3. Status semantics match actual runtime behavior.
4. List endpoints have pagination metadata and limits.
5. Error envelope is the same across endpoints.
6. Rate limits are explicit where needed.
7. Tenant or operator scoping is test-proven.

---

## 5. Runtime smoke checklist

- [ ] Rebuild the impacted dev runtime.
- [ ] Verify the latest code is loaded.
- [ ] Open the runtime config/admin panel and confirm it shows current state.
- [ ] Run a smoke request for at least one market-data endpoint.
- [ ] Run a smoke request for at least one operator/runtime endpoint.
- [ ] Capture payload snapshot and/or screenshot proof.

---

## 6. Residual risk notes

Document any of the following before closing the slice:

1. endpoint still bridged or partially degraded,
2. config change path missing preview or audit,
3. frontend control missing permission guard,
4. materializer cadence still incomplete,
5. retained raw data still required longer than the default hot window,
6. any unresolved OpenAPI mismatch.

---

## 7. Completion rule

Do not mark the slice complete until:

1. backend tests pass,
2. frontend checks pass,
3. runtime smoke passes,
4. audit/progress docs are updated,
5. residual risks are explicitly written.
