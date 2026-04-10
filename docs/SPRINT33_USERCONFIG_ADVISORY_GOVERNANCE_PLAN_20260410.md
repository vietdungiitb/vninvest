# Sprint 33 - UserConfig Consolidation & Advisory Governance

## Status
- Proposed on 2026-04-10
- Purpose: convert current audit findings into a roadmap-aligned execution sprint

## Sprint rationale

This work is large enough to be treated as a standalone sprint rather than a loose backlog bundle because it changes:
- product behavior
- user-facing UX
- settings information architecture
- backend advisory trigger policy
- regression surface across auth, advisory, and settings persistence

It is tightly linked to Sprint 32 because Sprint 32 introduced advisory auto-generation controls, but it is broader than Sprint 32 because it also covers login UX and the consolidation of account-level configuration into a dedicated UserConfig page.

## Core goal

Create one coherent user control surface for AI/advisory behavior and remove ambiguity from both login feedback and advisory auto-trigger rules.

## Business decisions locked for this sprint

### 1. Dedicated UserConfig page is required
- Account-level settings should no longer be primarily configured inside feature pages such as Whale Advisory.
- Whale Advisory should become a usage surface, not the main policy/configuration surface.

### 2. Event-based AI advisory remains available
- Do not remove event-based AI advisory from the system.
- User must decide whether the system should auto-run advisory when market events occur.

### 3. V1 uses one shared event-based toggle
- Reuse `UserConfig.advisory_whale_signal_enabled` in V1.
- Product meaning in V1:
  - `true`: allow event-based auto advisory
  - `false`: disable event-based auto advisory
- Covered by the same V1 toggle:
  - whale event pipeline
  - dark flow merge pipeline
  - reversal advisory auto queue

### 4. Login UX must become actionable
- Generic login failures are not acceptable as the default UX.
- User must know whether the next action is:
  - retry credentials
  - verify email
  - resend verification email
  - wait/retry due to network problem

## Sprint scope

### Track A - UserConfig consolidation
- Create a dedicated UserConfig route/page in frontend.
- Move account-level settings out of Whale Advisory page.
- Keep existing backend `UserConfig` API as the primary persistence surface where possible.

### Track B - Login UX hardening
- Improve frontend mapping of backend auth errors.
- Ensure resend verification path is discoverable when email is not verified.
- Normalize fallback error messaging.

### Track C - Advisory governance
- Expose event-based auto advisory toggle in UserConfig UI.
- Keep manual refresh and periodic auto-generation controls.
- Add backend early gating before event accumulation and reversal scheduling.

### Track D - Documentation and QA
- Update user-facing advisory wording.
- Add regression tests around disabled event-based advisory.
- Record release checklist and smoke tests.

## Proposed UserConfig information architecture

### Section 1. General preferences
- Language
- Theme

### Section 2. Market monitoring
- Whale alert threshold

### Section 3. AI configuration
- Provider
- Model
- API key
- Readiness/test status

### Section 4. AI Advisory policy
- Enable periodic auto-generation
- Refresh interval hours
- Daily max auto refreshes
- Daily token budget
- Enable manual refresh
- Enable event-based auto advisory

## Technical implementation notes

### Backend
- Keep the existing final source guard in `generate_whale_advisory_task`.
- Add early exits in event-producing paths so disabled users do not generate unnecessary:
  - Redis merge state
  - Celery tasks
  - observability noise
- Reversal queue should follow the same user toggle in V1.

### Frontend
- UserConfig page becomes the canonical place to save advisory policy settings.
- Whale Advisory page should keep only workflow actions and a shortcut to UserConfig if needed.
- Advisory copy must explain generation sources correctly.

## Acceptance criteria

### UserConfig
- User can view and edit persistent settings in one place.
- Whale Advisory page is no longer the main settings page for advisory policy.

### Login UX
- Invalid credentials produce clear feedback.
- Unverified email produces verification-specific feedback.
- Resend verification is reachable from the login failure path.

### Advisory governance
- Manual refresh still works when enabled.
- Periodic auto-generation still works when enabled.
- Event-based advisory runs only when the toggle is enabled.
- If event-based advisory is disabled, whale event, dark flow, and reversal do not enqueue advisory generation work for that user.

## Estimated timeline

### Day 1
- Finalize UX/spec decisions
- Confirm field/API contract reuse
- Create route and page skeleton

### Day 2
- Build UserConfig sections and migrate settings UI out of Whale Advisory

### Day 3
- Implement login error mapping and resend verification improvements

### Day 4
- Implement backend early gating for event-based advisory

### Day 5
- Tests, i18n/copy updates, smoke QA

### Buffer
- 0.5 to 1 day for regression fixes and rollout prep

## Risks
- If Whale Advisory page still owns hidden settings state after migration, UX inconsistency will remain.
- If only the final advisory task is gated and early event producers are not gated, the system will still waste background work.
- If copy is not updated together with behavior, users will misunderstand when advisory is expected to appear.

## Suggested artifacts for follow-up
- `docs/SPRINT33_DETAILED_EXECUTION_PLAN.md`
- `docs/SPRINT33_API_DATA_CONTRACT.md`
- `docs/SPRINT33_QA_TEST_MATRIX.md`
- `docs/SPRINT33_RELEASE_RUNBOOK.md`
- `docs/SPRINT33_EXECUTION_LOG.md`
- `docs/SPRINT33_IMPLEMENTATION_CHECKLIST.md`
- `docs/SPRINT33_PR_SLICING_PLAN.md`
- `docs/SPRINT33_FRONTEND_SMOKE_CHECKLIST.md`
- `docs/SPRINT33_PRODUCTION_READINESS_20260410.md`
- `docs/SPRINT33_STAGING_EXECUTION_CHECKLIST.md`
- `docs/SPRINT33_RELEASE_NOTES_20260410.md`
- `docs/SPRINT33_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT33_TASKBOARD.csv`
- Release smoke matrix
- Auth UX edge-case matrix
- Advisory source behavior test matrix