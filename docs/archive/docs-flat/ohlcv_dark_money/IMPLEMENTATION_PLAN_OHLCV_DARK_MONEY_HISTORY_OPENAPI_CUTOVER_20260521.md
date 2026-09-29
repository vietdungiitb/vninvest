# Implementation Plan - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Execution-ready
Reference policy:
- docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md
- docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md

---

## 1. Objectives

- Standardize core OpenAPI for historical OHLCV and dark-money-history by timeframe.
- Remove frontend dependency on legacy route layer for these two read functions.
- Reach cutover-ready status in dev environment without production shadow-run requirement.

---

## 2. Workstreams

WS1 Backend contract + route implementation
- Add native core dark-money-history endpoint.
- Normalize timeframe/period parsing and limits.
- Align status/error semantics with constitution.

WS2 Frontend adapter cutover
- Add adapter methods for both endpoints.
- Replace remaining call sites using legacy route path.
- Ensure error parser compatibility with standard envelope.

WS3 Testing and parity
- API unit/integration tests for both endpoints.
- Dev parity replay tests old vs new payload.
- Frontend adapter tests and page-level regression checks.

WS4 Governance and audit
- OpenAPI metadata completion.
- Run code review/integration/spec audit runbooks.
- Complete evidence and ledger updates.

---

## 3. Phase plan

### Phase 0 - Contract freeze and inventory
Outputs:
- Canonical parameter matrix (timeframe/interval/period/days)
- Legacy-to-core mapping matrix
- Legacy consumers list

DoD:
- Contract freeze document approved by backend + frontend owners.

### Phase 1 - Shared domain logic extraction
Outputs:
- Shared service module for dark-money-history computation
- No duplicated critical business logic between legacy and core route implementations

DoD:
- Unit tests for shared computation paths pass.

### Phase 2 - Core endpoint implementation
Outputs:
- New route: /core/v1/stock-management/stocks/{symbol}/dark-money-history/
- Full extend_schema metadata (params, responses, examples)
- Standard error envelope integration

DoD:
- Endpoint visible in /core/v1/schema/
- Mandatory HTTP semantics validated.

### Phase 3 - OHLCV endpoint normalization hardening
Outputs:
- Unified timeframe alias normalization for chart history
- 30m and lower/upper-case compatibility verified
- Strict but backward-safe parameter behavior

DoD:
- All supported timeframes pass API tests.

### Phase 4 - Frontend adapter cutover
Outputs:
- coreApiAdapter methods:
  - getStockChartHistory(...)
  - getDarkMoneyHistory(...)
- Consumer pages switched to adapter methods

DoD:
- No direct legacy route call remains for these use cases.

### Phase 5 - Dev parity and cutover readiness
Outputs:
- Parity replay report for representative symbols/timeframes
- Residual risk list with owner and due date

DoD:
- Parity threshold >= 99% on agreed fields.
- Integration regression suite pass.

### Phase 6 - Legacy replacement execution
Outputs:
- Replace legacy route usage in active code paths
- Optional deprecation response policy for legacy endpoint

DoD:
- Team sign-off for replacement.

---

## 4. Suggested schedule (dev stage)

- Day 1: Phase 0-1
- Day 2: Phase 2
- Day 3: Phase 3-4
- Day 4: Phase 5
- Day 5: Phase 6 + final audit package

---

## 5. Risks and mitigations

Risk R1: Timeframe drift between old/new endpoint semantics
- Mitigation: contract freeze + parity replay matrix

Risk R2: Frontend breakage due payload shape changes
- Mitigation: adapter-layer compatibility mapping + snapshot tests

Risk R3: Hidden regressions in dark-flow derived fields
- Mitigation: field-level assertions in integration tests

---

## 6. Exit criteria

- All gates G1..G5 pass.
- Runbooks pass without critical findings.
- Handoff evidence package completed.
