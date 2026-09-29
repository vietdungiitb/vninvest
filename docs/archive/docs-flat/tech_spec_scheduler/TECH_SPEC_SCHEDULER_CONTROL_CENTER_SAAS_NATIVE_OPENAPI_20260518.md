# Technical Spec - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18
**Version**: 1.0

---

## 1. Scope ky thuat

Spec nay mo ta:
1. Scheduler catalog read model hop nhat.
2. Control action semantics va idempotency.
3. Runtime status aggregation model.
4. OpenAPI contract + error envelope + ownership constraints.

---

## 2. Domain model

### 2.1 SchedulerJob (read model)

Field bat buoc:
- `job_key` (unique)
- `domain` (`dataops|prefetch|market_data|retention|materialization`)
- `data_types` (list)
- `trigger_type` (`cron|interval|policy_driven`)
- `control_mode` (`beat_enabled|runtime_enabled|dispatch_quota`)
- `status` (`enabled|paused|disabled|running|idle|degraded|failed`)
- `queue`
- `next_run_at`
- `last_run_at`
- `lag_seconds`
- `freshness_state` (`fresh|warm|stale|missing`)
- `capabilities` (`enable/disable/pause/resume/run_now/abort_active`)

### 2.2 SchedulerActionRequest

```json
{
  "action": "pause",
  "reason": "operator_maintenance_window",
  "requested_by": "ops_user"
}
```

### 2.3 SchedulerActionResponse

```json
{
  "ok": true,
  "job_key": "market-data-queue-tier-scheduler-30s",
  "action": "pause",
  "previous_status": "enabled",
  "current_status": "paused",
  "audit_id": 123,
  "request_id": "..."
}
```

---

## 3. Action semantics

### 3.1 beat_enabled jobs
- `enable/disable` -> mutate `PeriodicTask.enabled`.
- `pause/resume` -> alias to disable/enable unless explicit pause state added.
- `run_now` -> queue mapped task via celery.
- `abort_active` -> revoke active task if task_id available.

### 3.2 runtime_enabled jobs
- Mutate domain `ServiceConfig` effective flags.
- Must keep config schema valid via typed config validator.

### 3.3 dispatch_quota jobs
- `pause` can map to `enabled=false` in runtime config, or fallback `max_dispatch_per_cycle=0`.
- `resume` restores previous quota snapshot.

### 3.4 Idempotency
- Repeating same action on same terminal status returns success with `no_op=true`.
- All actions must be safe under retry.

---

## 4. Runtime status aggregation

Status builder input sources:
1. `CELERY_BEAT_SCHEDULE` + `PeriodicTask` (expected vs actual queue, next due).
2. `ServiceRunLog` latest + inflight runs.
3. `ServiceHealth` snapshot.
4. Celery inspect (`active/reserved/scheduled`) for live-task truth.
5. Queue drift/freshness metrics from monitoring.

Output constraints:
1. `next_run_at` nullable but explicit.
2. `lag_seconds` computed from `last_run_at` + schedule cadence.
3. `status_reason` required for degraded/failed states.

---

## 5. OpenAPI endpoints (canonical)

Namespace:
- `/core/v1/operator/scraping/dataops/scheduler/...`

Minimum endpoints:
1. `GET /scheduler/plan/` - scheduler catalog list.
2. `GET /scheduler/health/` - global scheduler health snapshot.
3. `GET /scheduler/jobs/{job_key}/history/` - paginated run/action history.
4. `POST /scheduler/jobs/{job_key}/actions/` - execute control action.

All endpoints:
- Must use `@extend_schema`.
- Must return standardized error envelope.

---

## 6. Security and governance

1. Ownership guard via `build_ownership_matrix_from_db` before any write action.
2. Tenant scoped data must keep query-layer tenant filters.
3. No direct fetch from packages/web bypassing adapter lane.
4. Every write action must create audit artifact (`ConfigChangeAudit` and/or `ServiceRunLog`).

---

## 7. Frontend contract notes

1. Frontend khong synthesize scheduler states; chi render server truth.
2. Action buttons derive from `capabilities` + `can_apply`.
3. Risky actions require confirm modal + reason field.
4. i18n mandatory for all added strings.

---

## 8. Acceptance criteria

1. Co bang scheduler plan hop nhat tren SOC cho DataOps + Prefetch.
2. Action controls tac dong dung backend state va co audit evidence.
3. OpenAPI schema day du cho endpoints moi.
4. Test suites pass va runtime smoke pass sau rollout.
