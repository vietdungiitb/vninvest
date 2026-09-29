# Implementation Plan - Core API OpenAPI Standardization

Date: 2026-05-13
Status: Execution-ready
Reference constitution: docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md

---

## 1. Objectives

- Chuyen tat ca endpoint API ve mot chuan contract va behavior nhat quan.
- Dong bo backend implementation, frontend consumption, test suites, va audit governance.
- Dat co che block merge/deploy neu vi pham hard rules.

---

## 2. Workstreams

### WS1 - Backend contract conformance
- Chuan hoa serializer input/output.
- Chuan hoa status code semantics.
- Chuan hoa error envelope.
- Pagination/rate-limit/tenant isolation enforcement.

### WS2 - Frontend contract conformance
- Dong bo API adapters theo metadata.
- Chuan hoa error handling theo error envelope.
- Typed contract alignment cho response parsing.

### WS3 - Test and quality gates
- Unit + integration + regression contracts.
- Negative tests cho authz/rate-limit/tenant boundaries.
- Coverage threshold and unstable endpoint watchlist.

### WS4 - CI/CD governance
- OpenAPI lint and policy checks.
- PR mandatory checklist enforcement.
- Branch protection and exception governance.

---

## 3. Phase plan and DoD

### Phase A (Week 1): Critical cleanup
DoD:
- Xoa swallow exception trong API paths.
- Fix status code mismatches tren endpoint uu tien.
- Error envelope co cau truc thong nhat cho endpoints uu tien.

### Phase B (Week 2): Security semantics
DoD:
- Auth endpoints co rate-limit policy.
- Tenant-scoped endpoints co query-level tenant filters.
- Co test cross-tenant denied.

### Phase C (Week 3): Contract completion
DoD:
- OpenAPI metadata cover toan bo endpoint active.
- Request/response examples du day.
- Contract drift report = 0 blocker.

### Phase D (Week 4): Performance + observability
DoD:
- List endpoints co pagination policy.
- Hot endpoints anti-N+1 applied.
- Request_id and error telemetry visible.

### Phase E (Week 5): Enforcement activation
DoD:
- CI gates bat mandatory.
- PR template mandatory section active.
- Merge block khi vi pham hard rules.

### Phase F (Week 6): Acceptance audit
DoD:
- Run code review, integration test, spec audit pass.
- KPI acceptance signed by Tech Lead + QA Lead.

---

## 4. Implementation sequence

1. Inventory all API endpoints and owners.
2. Prioritize by risk (auth, billing, tenant, trading, realtime).
3. Apply backend conformance patches by domain.
4. Update frontend adapters for changed/strict contracts.
5. Add/expand tests per policy.
6. Enable CI policy gates.
7. Execute audits and close residual risks.

---

## 5. Risk controls

- Risk: Breaking frontend due strict contract.
  - Control: Adapter compatibility layer + staged rollout.
- Risk: Incomplete metadata.
  - Control: Coverage gate in CI.
- Risk: Hidden tenant leak.
  - Control: Mandatory cross-tenant negative tests.

---

## 6. Deliverable checklist

- [ ] Backend code conformance patches.
- [ ] Frontend API adapter updates.
- [ ] OpenAPI metadata completion.
- [ ] Test suite updates.
- [ ] CI policy gates enabled.
- [ ] Audit reports and evidence package.

---

## 7. Exit criteria

- 100% mandatory PR gates enforced.
- 0 critical/high unresolved contract violations.
- Governance docs and runbooks signed off.
