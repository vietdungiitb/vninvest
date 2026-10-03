# Holistic Advisory H1 Production Deploy Checklist (2026-04-11)

## 1) Scope

- Feature scope: component-level advisory metrics persistence + baseline reporting.
- In-scope artifacts:
  - `AdvisoryAggregateAuditLog` metrics persistence from advisory flows.
  - Baseline report command: `generate_advisory_baseline_report`.
- Environment target: production.

## 2) Preconditions

- [ ] Latest H1 commits deployed to staging and smoke tested.
- [ ] Database migrations already validated on staging.
- [ ] Production DB backup and restore drill verified for current release window.
- [ ] On-call engineer assigned for first 24h after deployment.
- [ ] Rollback owner and command path confirmed.

## 3) Deploy Steps

1. Pull latest release tag/commit to production branch.
2. Apply migrations:
   - `python backend/manage.py migrate`
3. Restart backend service (web + worker + scheduler):
   - web service
   - celery worker
   - celery beat
4. Validate health endpoints and login flow.
5. Run targeted smoke tests in production-safe mode (read-only + minimal writes).

## 4) Post-Deploy Smoke

- [ ] `ai-advisory-session` endpoint responds for one canary symbol.
- [ ] `ai-advisory-components/generate` responds for one canary symbol.
- [ ] New rows appear in `AdvisoryAggregateAuditLog` with `metadata_json.operation=component_generation`.
- [ ] Baseline command works with production user/symbol filter.
- [ ] No spike in 5xx error rate in first 15 minutes.

## 5) Rollback Plan

Trigger rollback when one of these occurs:
- sustained p95 latency > 2x baseline for 15 minutes,
- error rate > 3% for 10 minutes,
- write path failures to audit log exceed threshold,
- migration/data integrity incident.

Rollback actions:
1. Stop traffic ramp (if progressive rollout).
2. Revert to previous app image/version.
3. Restart services.
4. Validate core whale/advisory endpoints.
5. Open incident log and attach evidence.

## 6) Evidence Capture

- Deploy start/end timestamps.
- Commit hash + migration list.
- Smoke test request IDs.
- Metrics snapshot at T+15m, T+1h, T+24h.

## 7) Sign-off

- [ ] BE Lead
- [ ] QA Lead
- [ ] DevOps Lead
- [ ] Product/PM
