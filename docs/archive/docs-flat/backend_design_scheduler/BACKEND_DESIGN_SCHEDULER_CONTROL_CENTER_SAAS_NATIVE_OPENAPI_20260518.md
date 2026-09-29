# Backend Design - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

## 1. Muc tieu backend

1. Xay control-plane scheduler thong nhat tren service_ops.
2. Giu dung ownership, audit, va tenant-safe boundaries.
3. Chuan hoa contract OpenAPI cho read/control paths.

---

## 2. Kien truc backend

### 2.1 Scheduler catalog layer
- Build read model hop nhat tu:
  - `CELERY_BEAT_SCHEDULE`
  - `django_celery_beat.PeriodicTask`
  - `ServiceConfig` domain runtime
  - `ServiceRunLog` latest runs

### 2.2 Action execution layer
- Endpoint action router theo `control_mode`:
  - beat_enabled -> mutate `PeriodicTask.enabled`
  - runtime_enabled -> mutate typed `ServiceConfig`
  - dispatch_quota -> mutate runtime tier config

### 2.3 Status aggregation layer
- Lag/freshness/queue-drift tu monitoring helpers.
- Inflight truth tu celery inspect + run logs.
- Degraded reason surfaced as structured field.

---

## 3. API design

1. `GET /core/v1/operator/scraping/dataops/scheduler/plan/`
2. `GET /core/v1/operator/scraping/dataops/scheduler/health/`
3. `GET /core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/history/`
4. `POST /core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/actions/`

All responses:
- OpenAPI schema annotated.
- Error envelope standardized.

---

## 4. Reliability patterns

1. Idempotent actions with `no_op` response for repeated state.
2. Atomic writes for config/action state changes.
3. Audit logging for every write.
4. Safe abort path with terminal-state guard.
5. Stale/orphan run recovery signals in status API.

---

## 5. Security and governance

1. Ownership guard before any action write.
2. No route bypass to legacy admin-ops for scheduler business logic.
3. Role-based permissions at API view layer.
4. Traceability: request_id propagated in errors and audits.

---

## 6. Test requirements

1. Unit tests: catalog mapping, capability derivation, idempotency.
2. API tests: status codes, payload contract, error envelope.
3. Integration tests: PeriodicTask/ServiceConfig mutation and ServiceRunLog transitions.
4. OpenAPI schema checks in CI.
