# Sprint 33 PR Slicing Plan

Status: READY
Date: 2026-04-10

## 1) Goal

Split Sprint 33 into reviewable PR batches with low merge risk and clear rollback boundaries.

## 2) Branching model

- Base branch: current sprint integration branch.
- Feature branch prefix: `s33/`.
- Suggested branches:
  - `s33/backend-event-gating`
  - `s33/frontend-login-ux`
  - `s33/frontend-userconfig-page`
  - `s33/frontend-advisory-settings-migration`
  - `s33/regression-tests-and-docs`

## 3) PR sequence

### PR-1 Backend early-gating foundation
Scope:
- Advisory producer early exits for whale/dark/reversal when event-based toggle is disabled.
- Keep existing final task guard.

Files likely:
- `backend/portfolio/tasks.py`
- backend advisory tests

Review focus:
- Behavior correctness
- Side-effect reduction
- No regressions to manual/periodic paths

### PR-2 Login UX message mapping
Scope:
- Frontend login error mapping and resend verification CTA.

Files likely:
- `frontend/src/components/LoginModal.jsx`
- `frontend/src/context/PortfolioContext.jsx`
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

Review focus:
- User actionability
- Security-safe messaging
- i18n consistency

### PR-3 Dedicated UserConfig page and route
Scope:
- Introduce page, route, and layout entry.

Files likely:
- `frontend/src/App.jsx`
- `frontend/src/pages/UserConfig.jsx`
- related API/context integration

Review focus:
- Route guard
- Data loading resilience
- Section IA completeness

### PR-4 Migrate settings ownership from WhaleAdvisory
Scope:
- Move account-level settings out of WhaleAdvisory page.
- Add navigation shortcut to UserConfig.

Files likely:
- `frontend/src/pages/WhaleAdvisory.jsx`
- i18n label updates

Review focus:
- No hidden old state path
- Workflow continuity for users

### PR-5 Regression tests, docs, and release prep
Scope:
- Add/update tests and finalize sprint docs/runbook evidence.

Files likely:
- backend test files
- docs artifacts and execution log

Review focus:
- Coverage on P0 behavior
- Release readiness evidence

## 4) Merge and verification policy

- Each PR must pass focused tests before merge.
- PR-1 should merge before PR-4 to avoid semantic mismatch.
- PR-2 and PR-3 can run in parallel if no route conflicts.
- PR-5 merges last as release gate package.

## 5) Rollback boundaries by PR

- PR-1 rollback: restore previous event producer behavior.
- PR-2 rollback: restore previous login message handling.
- PR-3 rollback: disable route/menu entry while keeping API unchanged.
- PR-4 rollback: temporarily restore old settings panel in WhaleAdvisory.
- PR-5 rollback: docs/test-only, no runtime rollback required.

## 6) Ready-to-merge checklist per PR

- [ ] Scope aligned to one PR objective.
- [ ] Acceptance criteria mapped to checklist item.
- [ ] Test evidence attached in PR description.
- [ ] i18n and copy changes reviewed where applicable.
- [ ] No unrelated formatting churn.
