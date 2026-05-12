# Sprint 34 Detailed Execution Plan (Dark Money Integrity & Usability Phase 1)

## 1) Sprint metadata

- Sprint ID: Sprint 34
- Theme: Dark Money Integrity & Usability (non-AI)
- Duration: 10 working days (2 weeks)
- Status: READY TO START
- Priority: P0/P1 only (correctness first)

## 2) Sprint objective

Dat muc release candidate cho tinh nang Dark Money Flow tren 3 truc:
1. Correctness: event identity, pagination consistency, severity mapping dung nghia.
2. Stability: contract nhat quan giua redis_stream/intraday_tick_db/vnbroker fallback.
3. Usability baseline: trader de xac dinh event quan trong va tin vao signal.

## 3) In-scope

### Mandatory (must deliver)
1. A1 - Deterministic event identity.
2. A2 - Pagination contract v2.
3. B1 - Dark flow severity remap (rule-based, non-AI).

### Conditional (only if capacity remains)
1. A3 - Threshold policy unification (partial).

## 4) Out-of-scope

1. C3, C4, D2 items from later phase.
2. Any AI expansion.
3. Cosmetic UI changes not tied to correctness/triage.

## 5) Work breakdown by stream

### Stream A - Data Integrity
1. Event identity specification:
- Define stable key parts by source.
- Define collision rule and timestamp normalization rule.

2. Pagination contract v2:
- has_more and next_cursor semantics.
- Deterministic tie-breaker rule.
- Backward compatibility note for FE.

3. Source parity check:
- Compare output field parity across redis_stream, db, vnbroker fallback.

### Stream B - Signal Quality
1. Dark flow severity rulebook v1:
- Input dimensions: strength, confidence, cvd_change, persistence.
- Output levels: info, warning, urgent.
- Boundary cases and tie rules.

2. Validation sample pack:
- Build manual sample set (>=30 events).
- Review with PM + QA + BE.

### Stream QA - Release gates
1. Contract test pack:
- Cursor progression tests.
- Duplicate/missing detection tests.

2. Severity regression pack:
- Before/after distribution check.
- Edge-case verification.

## 6) Day-by-day schedule

### Week 1
- Day 1:
  - Kickoff, scope freeze, owner lock.
  - Baseline KPI capture started.
- Day 2:
  - A1 spec draft + event key workshop.
- Day 3:
  - A2 cursor/contract spec draft + FE/QA review.
- Day 4:
  - B1 severity rulebook draft + sample set preparation.
- Day 5:
  - Gate G1 review (A1/A2/B1 drafts signed or rework list).

### Week 2
- Day 6:
  - Implement A1 + A2 according to approved spec.
- Day 7:
  - Implement B1 mapping and metadata traceability.
- Day 8:
  - QA regression pass 1, defect triage.
- Day 9:
  - Fix remaining critical defects, KPI re-measure.
- Day 10:
  - Gate G2 closeout + sprint report + phase 2 handoff recommendation.

## 7) Ownership model

1. BE-Lead:
- A1, A2, B1 implementation owner.

2. QA-Lead:
- Contract matrix owner, regression owner, release gate owner.

3. PM-Lead:
- Severity rulebook decision owner, scope control owner.

4. FE-Lead:
- Contract consumer alignment, pagination behavior validation.

5. DevOps-Lead:
- KPI telemetry support and dashboard verification.

## 8) KPI targets for sprint close

1. Duplicate event rate < 1% on pilot symbols.
2. Pagination consistency > 99.9% for multi-page aggregate queries.
3. Dark-flow severity distribution not collapsed into info-only profile.
4. No critical blocker open > 48h at sprint close.

## 9) Risks and mitigations

1. Scope creep risk:
- Mitigation: strict in-scope freeze until Gate G2.

2. Contract drift across sources:
- Mitigation: QA matrix sign-off required before close.

3. KPI baseline ambiguity:
- Mitigation: baseline locked by Day 2 and frozen for comparison.

## 10) Deliverables

1. Updated roadmap + backlog mapping (Sprint 34 attached).
2. Sprint 34 taskboard CSV.
3. Sprint 34 acceptance checklist.
4. End-of-sprint report with KPI comparison and next-sprint recommendation.
5. API/data contract freeze artifact.
6. PR slicing plan + implementation checklist + staging checklist.

## 11) Operational references

1. docs/SPRINT34_KICKOFF_MEETING_AGENDA.md
2. docs/SPRINT34_DEVELOPER_PLAYBOOK.md
3. docs/SPRINT34_GO_NO_GO_ONEPAGE.md
4. docs/SPRINT34_OWNER_ASSIGNMENT_SHEET.csv
5. docs/SPRINT34_API_DATA_CONTRACT.md
6. docs/SPRINT34_PR_SLICING_PLAN.md
7. docs/SPRINT34_IMPLEMENTATION_CHECKLIST.md
8. docs/SPRINT34_STAGING_EXECUTION_CHECKLIST.md
9. docs/SPRINT34_KPI_BASELINE_TEMPLATE.md
10. docs/SPRINT34_DECISION_LOG.md
11. docs/SPRINT34_KICKOFF_MINUTES_TEMPLATE.md
12. docs/SPRINT34_SIGNOFF_SHEET.md