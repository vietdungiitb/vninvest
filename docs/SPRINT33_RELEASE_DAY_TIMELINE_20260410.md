# Sprint 33 Release-Day Timeline

Date: 2026-04-10
Window type: Controlled deployment
Primary goal: ship Sprint 33 safely with fast go/no-go checkpoints

## Roles

- Release Commander: drives timeline, makes hold/go calls.
- Backend Owner: deploy backend, migrations, Celery validation.
- Frontend Owner: deploy frontend and validate route/UI smoke.
- QA Owner: execute smoke checklist and evidence capture.
- PM Owner: business-facing go decision and communication.

## Timeline

## T-30 min: Preflight

Owner: Release Commander + BE + FE

Actions:
- Confirm release branch and commit SHA.
- Confirm production env vars are set for security flags.
- Confirm operator docs are open:
  - `docs/SPRINT33_GO_LIVE_COMMAND_SHEET.md`
  - `docs/SPRINT33_LIVE_EVIDENCE_TEMPLATE_20260410.md`

Checkpoint:
- GO if all owners are present and preflight checks are complete.
- HOLD if any env/security prerequisite is missing.

## T-20 min: Infrastructure readiness

Owner: BE

Actions:
- Verify Docker and compose status.
- Ensure db/redis are healthy.

Checkpoint:
- GO if core infra is healthy.
- HOLD if db/redis/service health is unstable.

## T-15 min: Backend deploy

Owner: BE

Actions:
- Deploy backend service.
- Restart celery-worker and celery-beat.
- Run migrate and collectstatic.
- Run deploy check.

Checkpoint:
- GO if backend is healthy and deploy check has no blocking errors.
- HOLD/ROLLBACK if startup loop, migration failure, or critical deploy check error.

## T-10 min: Frontend deploy

Owner: FE

Actions:
- Deploy frontend assets/service.
- Verify route accessibility for authenticated users.

Checkpoint:
- GO if `/settings` and WhaleAdvisory load correctly.
- HOLD if routing/auth regression appears.

## T-05 min: Core smoke (P0)

Owner: QA + FE + BE

Actions:
- Execute P0 smoke from staging checklist:
  - login mapping
  - UserConfig persistence
  - event toggle OFF blocks enqueue
  - event toggle ON allows enqueue

Checkpoint:
- GO if all P0 pass.
- HOLD if any P0 fails.

## T+00 min: Go-live decision

Owner: Release Commander + PM

Actions:
- Review evidence template status.
- Confirm FE/BE/QA sign-off.
- PM confirms business go-live.

Decision:
- GO LIVE when all sign-offs are PASS.
- HOLD RELEASE if any sign-off is HOLD.

## T+15 min: Hypercare wave 1

Owner: BE + FE + QA

Actions:
- Monitor backend, celery, and frontend logs.
- Check login errors, API 5xx, queue spikes.
- Run quick user journey sanity.

Checkpoint:
- Continue if stable.
- Trigger rollback if critical incident threshold is reached.

## T+30 min: Hypercare wave 2

Owner: BE + QA

Actions:
- Re-check advisory queue behavior for OFF/ON cohorts.
- Validate no unexpected auth/session regressions.

Checkpoint:
- Continue if stable.
- Investigate and mitigate anomalies immediately.

## T+60 min: Release closure

Owner: Release Commander + PM

Actions:
- Finalize evidence template.
- Publish closure note in execution log and release channel.
- Record follow-up tasks if any minor issues remain.

## Hold/Rollback triggers

- Login flow unusable for majority of users.
- UserConfig route inaccessible for authenticated users.
- Event-based toggle behavior violates policy (OFF still enqueues).
- Sustained backend 5xx spike or celery failure loop.

## References

- `docs/SPRINT33_GO_LIVE_COMMAND_SHEET.md`
- `docs/SPRINT33_STAGING_EXECUTION_CHECKLIST.md`
- `docs/SPRINT33_LIVE_EVIDENCE_TEMPLATE_20260410.md`
- `docs/SPRINT33_RELEASE_RUNBOOK.md`