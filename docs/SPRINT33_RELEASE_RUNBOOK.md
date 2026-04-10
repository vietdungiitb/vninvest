# Sprint 33 Release Runbook

Status: READY WITH MANUAL GATES
Date: 2026-04-10

## 1) Purpose

Provide a controlled release sequence for Sprint 33 changes across auth UX, UserConfig consolidation, and advisory governance.

## 2) Change summary

- UserConfig page becomes central settings surface.
- Login feedback messages are remapped to actionable states.
- Event-based advisory generation is user-controlled via existing toggle semantics.
- Backend event producers apply early gating for disabled users.

## 3) Pre-deploy checklist

- [ ] All P0 items in acceptance checklist pass.
- [ ] Backend tests for advisory gating pass.
- [ ] Frontend build and smoke pass.
- [ ] i18n copy review signed off.
- [ ] Release notes drafted.

## 4) Deployment sequence

1. Deploy backend changes.
2. Restart backend web and Celery worker/beat.
3. Deploy frontend changes.
4. Clear stale frontend cache if needed.
5. Run smoke matrix for auth and advisory behavior.

## 5) Post-deploy validation

### Auth checks
- Invalid credentials produce expected message.
- Unverified email produces verification guidance and resend path.

### UserConfig checks
- User can open settings page and persist changes.
- Event-based toggle value is reflected after reload.

### Advisory behavior checks
- Toggle OFF: event-based advisory not enqueued.
- Toggle ON: event-based advisory can enqueue.
- Manual and periodic paths still function.

## 6) Rollback strategy

### Trigger conditions
- P0 auth regression in login path.
- Advisory policy misbehavior causing unexpected queue spikes.
- UserConfig page hard failure for majority of users.

### Rollback actions
1. Roll back frontend bundle to previous stable release.
2. Roll back backend service to previous stable image.
3. Restart services and verify health endpoints.
4. Re-run minimal smoke for login and advisory.

## 7) Observability watch list (first 24h)

- Login failure rate and distribution by error category.
- Advisory queue volume before and after toggle OFF cohorts.
- Error rate for UserConfig GET and PUT.
- Celery task throughput and failure spikes in advisory-related tasks.

## 8) Communication plan

- Notify support team on login messaging changes and new settings location.
- Notify product and QA on event-based advisory toggle semantics.
- Publish short change note to internal release channel.

## 9) References

- `docs/SPRINT33_DETAILED_EXECUTION_PLAN.md`
- `docs/SPRINT33_API_DATA_CONTRACT.md`
- `docs/SPRINT33_QA_TEST_MATRIX.md`
- `docs/SPRINT33_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT33_FRONTEND_SMOKE_CHECKLIST.md`
- `docs/SPRINT33_PRODUCTION_READINESS_20260410.md`
- `docs/SPRINT33_STAGING_EXECUTION_CHECKLIST.md`
- `docs/SPRINT33_RELEASE_NOTES_20260410.md`
- `docs/SPRINT33_GO_LIVE_COMMAND_SHEET.md`
- `docs/SPRINT33_LIVE_EVIDENCE_TEMPLATE_20260410.md`
- `docs/SPRINT33_RELEASE_DAY_TIMELINE_20260410.md`
