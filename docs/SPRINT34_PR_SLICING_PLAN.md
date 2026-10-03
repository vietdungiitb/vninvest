# Sprint 34 PR Slicing Plan

Status: READY
Sprint: 34

## 1) PR strategy

Principles:
1. Small, verifiable slices.
2. One major risk area per PR.
3. Merge only with evidence package attached.

## 2) Planned PRs

### PR-1: A1 Deterministic Event Identity

Scope:
1. Define/implement stable event identity logic.
2. Remove reliance on request-local synthetic identifiers.
3. Add focused identity regression tests.

Exit criteria:
1. Same query repeated => same logical event identity.
2. No identity drift in fallback path sample.

### PR-2: A2 Cursor v2 Deterministic Pagination

Scope:
1. Implement deterministic cursor tie-break policy.
2. Enforce has_more/next_cursor consistency.
3. Add pagination regression tests (>=5 pages).

Exit criteria:
1. No duplicate/missing across traversal.
2. Invalid cursor returns explicit validation error.

### PR-3: B1 Dark-Flow Severity Remap

Scope:
1. Implement rulebook-based mapping (strength/confidence/cvd/persistence).
2. Add rationale metadata trace.
3. Add severity edge-case tests and baseline comparison hooks.

Exit criteria:
1. Severity not collapsed to info-only profile.
2. Sample set mapping matches approved rulebook.

### PR-4: Sprint Hardening & Closeout

Scope:
1. Resolve residual P0/P1 defects from PR-1..PR-3.
2. Refresh docs/checklists/evidence links.
3. Final gate evidence packaging.

Exit criteria:
1. Acceptance checklist pass.
2. KPI before/after report attached.

## 3) Merge order

1. PR-1 -> PR-2 -> PR-3 -> PR-4.
2. No parallel merge for dependent logic without rebase and targeted retest.

## 4) Mandatory PR template fields

1. Scope mapping to A1/A2/B1.
2. Risks and rollback notes.
3. Test evidence summary.
4. Contract impact statement.

## 5) Definition of PR done

1. CI green.
2. Required reviewers approved.
3. Evidence package updated.
4. Related sprint task status updated.
