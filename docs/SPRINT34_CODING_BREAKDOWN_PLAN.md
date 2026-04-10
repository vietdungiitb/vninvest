# Sprint 34 - Coding Breakdown Plan

Status: READY FOR IMPLEMENTATION
Date: 2026-04-10
Scope: A1 + A2 + B1 (mandatory), A3 partial (conditional)
Primary objective: lock correctness cho dark money flow truoc khi mo rong UX/ops

Related docs:
- docs/SPRINT34_DETAILED_EXECUTION_PLAN.md
- docs/SPRINT34_ACCEPTANCE_CHECKLIST.md
- docs/SPRINT34_TASKBOARD.csv
- docs/AUDIT_DARK_MONEY_FLOW_DEEP_20260410.md

## 1) Pre-coding gates (must pass truoc Day 1)

1. Gate P0 - Scope lock
- In-scope chi gom A1, A2, B1.
- Mọi item ngoai scope can PM approve bang thay doi chinh thuc.

2. Gate P1 - Contract freeze
- Cursor v2 semantics freeze:
  - has_more
  - next_cursor
  - deterministic ordering
- Field parity matrix freeze cho 3 source.

3. Gate P2 - KPI baseline freeze
- Chot baseline truoc thay doi:
  - duplicate event rate
  - pagination consistency
  - dark-flow severity distribution

## 2) Architecture delta for Sprint 34

1. Event identity khong phu thuoc synthetic id theo request lifecycle.
2. Pagination cursor deterministic va replayable trong cua so ngan.
3. Dark-flow severity mapping duoc tach khoi whale threshold ratio.
4. Metadata trace phai cho phep audit tai sao severity duoc gan.

## 3) File-level implementation map (expected)

### 3.1 Backend (core)
1. backend/portfolio/market_data_service.py
- deterministic cursor tie-break
- source parity handling

2. backend/portfolio/realtime/compute.py
- event identity normalization (neu can)

3. backend/portfolio/tasks.py
- dark-flow severity mapping and metadata trace

4. backend/portfolio/domain_constants.py (neu can)
- enum/threshold constants for severity rules

5. backend/portfolio/tests/*
- contract + paging + severity regression tests

### 3.2 Frontend (contract alignment only)
1. frontend/src/api/client.js
- cursor v2 parsing compatibility

2. frontend/src/pages/WhaleAlertsHub.jsx
- ensure pagination behavior aligns with contract v2

3. frontend/src/pages/WhaleAdvisory.jsx
- ensure severity rendering does not assume old mapping behavior

## 4) Story-by-story coding breakdown

### S34-01 - A1 deterministic event identity (1.5d)
1. Define stable event key spec.
2. Normalize source-specific id formation.
3. Add duplicate detection regression tests.

Deliverable code:
- event identity stable across repeated fetch paths.

### S34-02 - A2 pagination contract v2 (2d)
1. Implement deterministic ordering tie-break.
2. Standardize has_more/next_cursor semantics.
3. Validate parity for redis_stream/db/vnstock fallback.

Deliverable code:
- 5-page traversal shows no duplicate/missing events.

### S34-03 - B1 dark-flow severity remap (1.5d)
1. Implement rulebook-based mapper:
- strength
- confidence
- cvd_change
- persistence
2. Add metadata trace for rationale.
3. Regression tests for representative edge cases.

Deliverable code:
- severity distribution no longer collapsed into info-heavy profile.

### S34-04 - QA stabilization and defect closure (2d)
1. Run contract and paging regression.
2. Run severity before/after comparison.
3. Fix P0/P1 defects.

Deliverable artifact:
- sprint gate evidence pack ready for closeout.

## 5) PR slicing strategy (recommended)

1. PR-1 (S34-01)
- event identity + tests
- gate: deterministic id behavior

2. PR-2 (S34-02)
- cursor v2 + contract parity + tests
- gate: pagination consistency

3. PR-3 (S34-03)
- severity remap + metadata trace + tests
- gate: severity quality

4. PR-4 (S34-04)
- regression + fixes + closeout docs
- gate: sprint acceptance checklist pass

## 6) Coding checklist per PR

1. Update docs:
- docs/SPRINT34_TASKBOARD.csv
- docs/SPRINT34_ACCEPTANCE_CHECKLIST.md
- docs/SPRINT_EXECUTION_LOG.md

2. Verification mandatory:
- focused backend tests for contract/paging/severity
- frontend build validation
- staging smoke for aggregate pagination

3. QA mandatory:
- compare before/after KPI snapshots for sprint targets

## 7) Risks and fallback decisions

1. Risk: cursor drift persists under fallback source
- Fallback: force conservative tie-break and document source-specific constraints.

2. Risk: severity remap introduces noisy urgent events
- Fallback: apply guard bands and cap by confidence.

3. Risk: FE parser assumptions break with cursor v2
- Fallback: temporary backward compatibility parser path for one sprint.

## 8) Definition of coding completion

1. PR-1..PR-4 merged with green regression evidence.
2. A1/A2/B1 acceptance criteria all pass.
3. KPI delta report attached to sprint closeout.
4. Sprint 34 marked complete in roadmap status with references.