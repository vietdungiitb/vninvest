# Sprint 34 Acceptance Checklist

Status update (2026-04-10): IN PROGRESS (A1/A2/B1 code + core regression done)

Evidence snapshot:
1. Migration applied: portfolio.0035_sprint34_orderflowsignal_event_id_severity.
2. Core test suite pass: python backend/manage.py test portfolio.tests.test_order_flow -> 42/42 PASS.
3. New correctness tests include:
- 5-page cursor traversal no duplicate/missing.
- Cursor replay consistency.
- Deterministic event_id persistence + dedup behavior.

## A. Scope acceptance

1. [x] A1 completed (deterministic event identity).
2. [x] A2 completed (pagination contract v2).
3. [x] B1 completed (dark flow severity remap).
4. [x] Out-of-scope items were not included without approval.

## B. Correctness acceptance

1. [x] No duplicate/missing events across 5-page cursor traversal.
2. [x] Cursor replay in short interval returns consistent ordering.
3. [ ] Source parity for key fields is validated.

## C. Signal quality acceptance

1. [ ] Severity rulebook is documented and approved by PM + QA.
2. [ ] Manual sample review (>=30 events) completed.
3. [ ] Dark-flow severity profile is no longer info-collapsed.

## D. QA/release gate acceptance

1. [x] Contract regression suite passed (order_flow scope).
2. [x] Severity regression checks passed (rule-based mapping + tests).
3. [x] No critical blocker older than 48h.

## E. KPI acceptance

1. [ ] Duplicate event rate < 1%.
2. [ ] Pagination consistency > 99.9%.
3. [ ] KPI before/after report is published.

## F. Handoff acceptance

1. [ ] Sprint closeout note completed.
2. [ ] Recommendation for next sprint scope is attached.
3. [ ] Roadmap status updated with Sprint 34 outcome.