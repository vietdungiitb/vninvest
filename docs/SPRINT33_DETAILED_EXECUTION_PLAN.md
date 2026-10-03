# Sprint 33 Detailed Execution Plan

Status: READY FOR CODE EXECUTION
Sprint: 33
Date baseline: 2026-04-10

## 1) Sprint objective

Deliver a coherent user-control model for advisory behavior while improving login feedback clarity and consolidating account-level settings into a dedicated UserConfig page.

## 2) Scope boundaries

In scope:
- Dedicated UserConfig route/page for persistent settings.
- Login error mapping and resend verification UX.
- Event-based advisory as user-controlled toggle.
- Backend early gating for event accumulation and reversal queue.
- Regression tests and release checklist.

Out of scope:
- Full auth redesign.
- New billing policy changes.
- V2 granular advisory toggles split by event type.

## 3) Architecture decisions

### D1. Reuse existing field for V1
- Keep `UserConfig.advisory_whale_signal_enabled`.
- Product meaning in Sprint 33:
  - true: event-based advisory enabled
  - false: event-based advisory disabled

### D2. Event scope covered by V1 toggle
- Whale event accumulation path.
- Dark flow accumulation path.
- Reversal auto queue path.

### D3. Defense in depth
- Keep final guard in `generate_whale_advisory_task`.
- Add early guard at event producer stage to avoid unnecessary work.

## 4) Workstreams and milestones

### M1 - UX and contract freeze (0.5 day)
Deliverables:
- Final login error taxonomy.
- UserConfig section contract.
- Advisory policy wording freeze (vi/en).

Exit criteria:
- FE and BE agree on message keys, payload shape, and toggle semantics.

### M2 - UserConfig route and layout foundation (0.5 day)
Deliverables:
- New route for UserConfig page.
- Initial page scaffold and navigation entry.

Exit criteria:
- Authenticated users can open UserConfig page.

### M3 - Move account settings to UserConfig (1.0 day)
Deliverables:
- AI provider/model/key controls moved.
- Advisory schedule and policy controls moved.
- Whale threshold, language, theme grouped on UserConfig.

Exit criteria:
- Whale Advisory page no longer owns primary settings state.

### M4 - Login UX hardening (0.5 day)
Deliverables:
- Explicit mapping for invalid credentials, unverified email, network errors.
- Resend verification call-to-action integrated in failure path.

Exit criteria:
- User gets actionable next step in all common login failure states.

### M5 - Backend early gating (1.25 day)
Deliverables:
- Early exit before `_accumulate_user_advisory_event` for disabled users.
- Early exit before reversal queue for disabled users.
- Preserve final source check inside advisory task.

Exit criteria:
- No advisory enqueue side-effects for disabled users across covered event paths.

### M6 - QA and release prep (1.0 day)
Deliverables:
- Backend regression tests for toggle ON/OFF behavior.
- Frontend smoke for login and settings persistence.
- Release notes and runbook sign-off.

Exit criteria:
- All P0 checklist items pass.

## 5) File-level implementation map

Backend likely touchpoints:
- `backend/portfolio/tasks.py`
- `backend/portfolio/models.py` (label/help text alignment only if needed)
- `backend/portfolio/serializers.py`
- `backend/portfolio/views.py`
- `backend/portfolio/tests/test_whale_advisory_task.py`
- `backend/portfolio/tests/test_api_routes.py`

Frontend likely touchpoints:
- `frontend/src/App.jsx`
- `frontend/src/components/LoginModal.jsx`
- `frontend/src/context/PortfolioContext.jsx`
- `frontend/src/pages/WhaleAdvisory.jsx`
- `frontend/src/pages/UserConfig.jsx` (new)
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

Documentation and operations:
- `docs/SPRINT33_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT33_QA_TEST_MATRIX.md`
- `docs/SPRINT33_RELEASE_RUNBOOK.md`

## 6) Risks and mitigations

R1. Hidden coupling from Whale Advisory page to old settings logic.
- Mitigation: enforce one-way source of truth through UserConfig page and context update hooks.

R2. Early-gating misses one producer path.
- Mitigation: add test cases per trigger family and validate queue behavior via logs/counters.

R3. Copy mismatch with behavior.
- Mitigation: i18n update in same merge set as policy code changes.

R4. Existing users surprised by default toggle behavior.
- Mitigation: explicit product decision and release note communication.

## 7) Definition of ready to code

Code-ready gate is considered met when:
- All docs in this list are present and linked.
- API/data contract for UserConfig and auth error mapping is frozen.
- Taskboard and acceptance checklist are aligned.
- Owner assignments are set in execution board.

Referenced artifacts:
- `docs/SPRINT33_API_DATA_CONTRACT.md`
- `docs/SPRINT33_QA_TEST_MATRIX.md`
- `docs/SPRINT33_RELEASE_RUNBOOK.md`
- `docs/SPRINT33_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT33_TASKBOARD.csv`
