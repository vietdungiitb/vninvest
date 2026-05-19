# Implementation Plan - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18
**Status**: Approved - Ready for execution
**Parent**: docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_HANDOFF_MASTER_20260518.md

---

## 1. Tong quan

Ke hoach gom 4 nhom:
1. Scheduler foundation va canonical contracts.
2. Runtime control actions va ownership hardening.
3. SOC UI integration cho DataOps/Prefetch.
4. Audit, test, cutover va closeout.

---

## 2. Dependency graph

```text
S01 Scheduler catalog contract
  -> S02 Job capability matrix + ownership guard
    -> S03 Control actions executor
      -> S04 Runtime status aggregator
        -> S05 OpenAPI operator endpoints
          -> S06 Frontend scheduler board (DataOps)
            -> S07 Frontend scheduler board (Prefetch)
              -> S08 Read-only rollout validation
                -> S09 Write-mode rollout + cutover runbook
```

---

## 3. Task breakdown

| Task ID | Ten | Artifact chinh | DoD |
|---|---|---|---|
| S01 | Scheduler catalog contract | service_ops/views + serializers | Co `GET plan` hop nhat beat/runtime jobs |
| S02 | Capability matrix + ownership | ownership/mixins/tests | Action map dung `can_apply`, deny paths tested |
| S03 | Control actions executor | service_ops/views/actions + tests | enable/disable/pause/resume/run_now/abort idempotent |
| S04 | Runtime status aggregator | queue metrics + run log aggregator | Co next_run/last_run/lag/freshness/inflight/error |
| S05 | OpenAPI canonical endpoints | operator routes + schema | Namespace `/core/v1/operator/...`, envelope chuan |
| S06 | SOC DataOps scheduler board | frontend DataOpsPanel + socApi | Bang schedule + controls + confirmations |
| S07 | SOC Prefetch scheduler board | frontend PrefetchPanel + socApi | Hien thi profile/interval/status + actions |
| S08 | Read-only rollout | docs/evidence/tests | Read path on dinh, khong ghi, no regressions |
| S09 | Write-mode rollout + cutover | runbook + governance | Phased enable, rollback tested, signoff complete |

---

## 4. Chi tiet task

### S01 - Scheduler catalog contract

**Muc tieu**
- Co model hop nhat cho tat ca scheduler jobs can van hanh.

**Files du kien**
- packages/core/backend/src/service_ops/views/dataops.py
- packages/core/backend/src/service_ops/views/prefetch.py
- packages/core/backend/src/vninvest_core/monitoring/queue_metrics.py

**DoD**
- Co field toi thieu: `job_key`, `domain`, `data_types`, `trigger_type`, `control_mode`, `status`, `next_run`, `last_run`, `lag_seconds`.
- Mapping ro nguon truth cua tung field.

### S02 - Capability matrix + ownership

**Muc tieu**
- Action controls khong vuot ownership boundaries.

**Files du kien**
- packages/core/backend/src/service_ops/ownership.py
- packages/core/backend/src/service_ops/views/mixins.py

**DoD**
- `can_apply=false` bi chan voi ma loi ownership chuan.
- Action whitelist theo `control_mode`.

### S03 - Control actions executor

**Muc tieu**
- Co endpoint action idempotent va auditable.

**Files du kien**
- packages/core/backend/src/service_ops/views/dataops.py
- packages/core/backend/src/service_ops/views/prefetch.py
- packages/core/backend/src/service_ops/models.py

**DoD**
- Beat jobs control qua `PeriodicTask.enabled`.
- Runtime jobs control qua `ServiceConfig`.
- Run-now/abort tao va cap nhat `ServiceRunLog` dung semantics.

### S04 - Runtime status aggregator

**Muc tieu**
- Status phan anh dung tinh trang thuc te cua service/job.

**DoD**
- Tong hop du lieu tu `ServiceHealth`, `ServiceRunLog`, `PeriodicTask`, celery inspect.
- Co stale/orphan detection signal de operator doc nhanh.

### S05 - OpenAPI canonical endpoints

**Muc tieu**
- Contract endpoint ro rang, schema day du, pass OpenAPI gate checklist.

**DoD**
- `@extend_schema` day du cho endpoint moi.
- Error envelope dong bo toan bo endpoints.

### S06/S07 - Frontend scheduler boards

**Muc tieu**
- Trien khai giao dien dieu phoi scheduler tren SOC DataOps + Prefetch.

**DoD**
- Table hien thi ke hoach + state + action.
- Action confirm modal cho thao tac rui ro.
- i18n keys day du (vi/en).

### S08/S09 - Rollout va cutover

**Muc tieu**
- Trien khai an toan theo 2 phase read-only -> write-mode.

**DoD**
- Co bang chung read-only soak.
- Co rollback runbook va incident drill.
- Co signoff truoc mo write controls rong.

---

## 5. Validation gates toan workstream

1. Backend unit + contract tests pass theo task.
2. Frontend build pass cho SOC.
3. Runtime refresh qua `./start_dev.ps1` cho moi slice runtime/code.
4. Governance docs cap nhat moi slice:
   - CODE_CHANGE_AUDIT_LEDGER.md
   - PROGRESS_DASHBOARD.md
   - MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md

---

## 6. Mandatory slice-exit gate

Moi slice Sxx chi duoc sang slice tiep theo khi:
1. Focused tests PASS.
2. Runtime refresh PASS (neu co runtime/code change).
3. Evidence template du command/output/residual risk.
4. Taskboard/plan/spec doi chieu khong conflict.
5. Governance artifacts da cap nhat.
6. Commit/push dev da hoan tat.
