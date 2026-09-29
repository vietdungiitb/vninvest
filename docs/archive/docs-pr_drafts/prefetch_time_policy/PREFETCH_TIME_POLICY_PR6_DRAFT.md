# [PR-6] Test suite hardening + rollout/rollback documentation

## 1) Summary

Finalize quality gate and production rollout package for time-based prefetch policy.

## 2) Scope

In scope:
- Consolidate backend and frontend tests.
- Publish manual QA matrix.
- Publish rollout and rollback runbook.
- Update docs and changelog references.

Out of scope:
- New product features beyond readiness scope.

## 3) Files touched

- backend tests files
- frontend tests files
- docs/PREFETCH_TIME_POLICY_ADMIN_PLAN_20260412.md
- docs/PREFETCH_TIME_POLICY_EXECUTION_BOARD_20260412.md
- docs/PREFETCH_TIME_POLICY_TASK_TRACKER_20260412.md
- backend/CHANGELOG.md

## 4) Rollout plan

- Canary deploy 24-48h.
- Monitor 429, cooldown, freshness, p95 latency.
- Expand rollout only when KPI thresholds are healthy.
- Follow release gates checklist:
	- docs/PREFETCH_TIME_POLICY_RELEASE_GATES_20260412.md

## 5) Rollback plan

- Reapply safe default policy.
- Disable runtime policy effect if needed.
- Verify service health and freshness recovery.

## 6) Test plan

Automated:
- Full critical tests pass.

Manual:
- pre_open, market_open, lunch_break, pre_close, post_close, weekend scenarios.

## 7) Checklist

- [ ] Test evidence attached.
- [ ] KPI dashboard links included.
- [ ] Rollout gate decisions documented.
- [ ] Rollback drill verified.

## 8) Evidence

- Test report:
- Canary KPI snapshot:
- Rollback drill notes:
