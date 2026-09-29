# Scheduler Control Center SaaS Native OpenAPI - Handoff Master
**Ngay**: 2026-05-18
**Status**: Approved for planning and execution
**Scope**: Quan tri lich chay va runtime controls cho backfill/prefetch services tren SOC theo kien truc SaaS native, contract OpenAPI canonical, va ownership/audit governance.

---

## 1. Muc tieu

1. Co bang ke hoach chay thong nhat cho cac service nen (backfill, prefetch, queue-tier scheduler, retention jobs).
2. Co runtime controls ro rang: enable/disable, pause/resume, run_now, abort_active theo capability matrix.
3. Co runtime status trung thuc: next run, last run, lag, freshness, inflight, error state, queue drift.
4. Giu dung kien truc SaaS native: SOC la single operator surface, khong tao parallel writer.
5. Tat ca API moi theo namespace canonical `/core/v1/operator/` va pass OpenAPI gate.

---

## 2. Hard decisions da khoa

1. **SOC la operator surface duy nhat** cho scheduler controls; khong mo route admin-ops moi.
2. **Global matrix SSOT bat buoc** cho market data scheduler universe; cam per-user crawl silo.
3. **Control actions phai ownership-guarded** (`can_apply`) va co audit trail bat buoc.
4. **No client-side orchestration logic**: frontend chi render + invoke server truth.
5. **OpenAPI-first**: endpoint moi phai co `@extend_schema`, error envelope chuan (`detail/code/timestamp/request_id/field_errors`).
6. **Facts-first status**: read path uu tien `ServiceRunLog`, `ServiceHealth`, `PeriodicTask`, live celery inspect; cam suy dien bang hardcoded UI heuristics.
7. **Runtime refresh discipline**: slice runtime/code phai refresh qua `./start_dev.ps1`.

---

## 3. Deliverables doc-pack

| # | Tai lieu | Duong dan |
|---|---|---|
| 1 | Handoff Master | docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_HANDOFF_MASTER_20260518.md |
| 2 | Implementation Plan | docs/IMPLEMENTATION_PLAN_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 3 | Technical Spec | docs/TECH_SPEC_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 4 | Taskboard | docs/TASKBOARD_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 5 | Traceability Matrix | docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_TRACEABILITY_MATRIX_20260518.md |
| 6 | Self Audit and Test Protocol | docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_SELF_AUDIT_AND_TEST_PROTOCOL_20260518.md |
| 7 | Execution Evidence Template | docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_EXECUTION_EVIDENCE_TEMPLATE_20260518.md |
| 8 | Config Ownership Matrix | docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_CONFIG_OWNERSHIP_MATRIX_20260518.md |
| 9 | Code Quality Constitution | docs/SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_CODE_QUALITY_CONSTITUTION_20260518.md |
| 10 | Frontend Design | docs/FRONTEND_DESIGN_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 11 | Backend Design | docs/BACKEND_DESIGN_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 12 | Run Code Review | docs/RUN_CODE_REVIEW_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 13 | Run Integration Tests | docs/RUN_INTEGRATION_TESTS_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 14 | Run Spec Audit | docs/RUN_SPEC_AUDIT_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |
| 15 | Cutover Runbook and Closeout | docs/CUTOVER_RUNBOOK_SCHEDULER_CONTROL_CENTER_SAAS_NATIVE_OPENAPI_20260518.md |

---

## 4. Kien truc muc tieu (tom tat)

```text
CELERY_BEAT_SCHEDULE + PeriodicTask + ServiceConfig
  -> Scheduler Catalog Builder (canonical read model)
  -> Ownership Guard + ConfigApply/Audit
  -> Scheduler Action Executor (enable/disable/pause/resume/run_now/abort)
  -> ServiceRunLog + ServiceHealth + Queue Metrics + Celery Inspect
  -> OpenAPI Operator Endpoints (/core/v1/operator/scraping/dataops/...)
  -> SOC DataOps/Prefetch Panels (read-only first, controlled write rollout)
```

---

## 5. Dinh nghia thanh cong

1. Operator co 1 bang thong nhat cho schedule + status + control actions.
2. Action controls tac dong dung vao backend truth (`PeriodicTask`, `ServiceConfig`, `ServiceRunLog`).
3. Khong co regression ownership/tenant isolation/openapi envelope.
4. Co test evidence va runbook rollback ro rang truoc cutover write-mode.
