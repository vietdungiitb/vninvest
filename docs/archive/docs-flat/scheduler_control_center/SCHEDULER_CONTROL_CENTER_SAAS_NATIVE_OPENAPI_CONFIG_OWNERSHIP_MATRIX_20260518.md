# Config Ownership Matrix - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

| Config / Control | Purpose | Owner | Writer | Runtime Surface |
|---|---|---|---|---|
| Beat task enabled flag | Bat/tat periodic scheduler job | Service Ops Lead | service_ops only | PeriodicTask |
| DataOps queue-tier runtime config | Cadence/quota scheduler theo tier | Service Ops Lead | service_ops only | ServiceConfig (matrix domain) |
| Prefetch runtime policy | Profile interval + enabled state | Core Backend Lead | service_ops only | ServiceConfig (prefetch domain) |
| Manual run trigger | Chay ngay job theo yeu cau | Operator (authorized) | service_ops endpoints | ServiceRunLog + Celery |
| Active run abort | Dung run dang queue/running | Operator (authorized) | service_ops endpoints | Celery revoke + ServiceRunLog |
| OpenAPI metadata | Contract quality and gate | Core API Lead | backend maintainers | drf-spectacular annotations |

---

## Ownership rules

1. Frontend khong duoc ghi truc tiep scheduler runtime state.
2. Moi action write phai qua endpoint co ownership guard va audit trail.
3. Override tam thoi phai co `reason`, owner, va expiry/rollback note.
4. Domain `can_apply=false` phai bi chan mac dinh, khong workaround.
