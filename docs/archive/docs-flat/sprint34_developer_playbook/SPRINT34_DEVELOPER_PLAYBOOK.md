# Sprint 34 Developer Playbook

Status: Operational
Sprint: 34
Scope: A1 + A2 + B1

## 1) Working rules

1. Correctness over speed: no shortcut that weakens contract determinism.
2. One-source-of-truth for scope: only Sprint34 artifacts.
3. Small PR slices with regression evidence per slice.
4. No scope expansion without PM approval.

## 2) Branch and PR strategy

1. Use short-lived branches per PR slice:
- sprint34-pr1-a1-identity
- sprint34-pr2-a2-cursor
- sprint34-pr3-b1-severity
- sprint34-pr4-qa-closeout

2. PR template mandatory sections:
- What changed
- Why changed
- Acceptance criteria mapping
- Test evidence
- Risk and rollback note

## 3) Daily execution rhythm

1. Start-of-day (15 min)
- Pull latest sprint board status.
- Confirm current task and dependency state.

2. Mid-day checkpoint
- Update blocker status.
- Sync quickly with dependent owner if blocked.

3. End-of-day
- Update task status and evidence links.
- Add log note to sprint execution log.

## 4) Evidence package per PR

1. Contract/paging test output summary.
2. Severity sample validation summary.
3. KPI snapshot impact note.
4. Known limitation list (if any).

## 5) Regression focus by stream

1. A1 identity regression
- Verify stable event identity across repeated fetches.

2. A2 cursor regression
- Verify 5-page traversal no duplicate/missing.
- Verify invalid cursor behavior follows contract.

3. B1 severity regression
- Verify mapping edges and confidence guard bands.
- Verify severity distribution no longer info-collapsed.

## 6) Blocker handling protocol

1. If blocker > 4h:
- Notify owner chain (BE/QA/PM as relevant).

2. If blocker > 24h:
- Escalate in daily meeting and trigger scope/risk review.

3. If blocker threatens gate:
- Trigger mini go/no-go discussion same day.

## 7) Merge policy

1. No merge without acceptance mapping.
2. No merge if critical regression unresolved.
3. No merge if evidence package incomplete.

## 8) Sprint closeout requirements

1. All in-scope tasks done or explicitly deferred with reason.
2. KPI before/after comparison published.
3. Acceptance checklist signed.
4. Roadmap status updated with final sprint outcome.

## 9) Code-ready gate (must be true before Day 1 coding)

1. API/data contract frozen:
- docs/SPRINT34_API_DATA_CONTRACT.md

2. PR slicing frozen:
- docs/SPRINT34_PR_SLICING_PLAN.md

3. Implementation checklist prepared:
- docs/SPRINT34_IMPLEMENTATION_CHECKLIST.md

4. Staging execution checklist prepared:
- docs/SPRINT34_STAGING_EXECUTION_CHECKLIST.md

5. Owner assignment filled (named owners, not role-only placeholders):
- docs/SPRINT34_OWNER_ASSIGNMENT_SHEET.csv

6. Go/No-Go criteria visible to all leads:
- docs/SPRINT34_GO_NO_GO_ONEPAGE.md

7. KPI baseline capture template ready and assigned:
- docs/SPRINT34_KPI_BASELINE_TEMPLATE.md

8. Decision log ready for sprint-level scope/contract decisions:
- docs/SPRINT34_DECISION_LOG.md

9. Kickoff minutes and sign-off forms ready:
- docs/SPRINT34_KICKOFF_MINUTES_TEMPLATE.md
- docs/SPRINT34_SIGNOFF_SHEET.md
