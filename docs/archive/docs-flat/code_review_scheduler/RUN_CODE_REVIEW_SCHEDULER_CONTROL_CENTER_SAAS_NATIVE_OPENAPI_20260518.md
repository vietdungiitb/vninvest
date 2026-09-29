# Run Code Review - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

## 1. Review focus

1. Scheduler catalog correctness (beat/runtime unification).
2. Action semantics correctness and idempotency.
3. Ownership and audit controls.
4. OpenAPI contract compliance.
5. Frontend action safety and state consistency.

---

## 2. Mandatory review checklist

- [ ] Scheduler job taxonomy khop spec (`trigger_type`, `control_mode`, `capabilities`)
- [ ] `run_now`/`abort_active` logic khong vo tinh gay duplicate orphans
- [ ] Ownership deny path bao toan hard rules
- [ ] OpenAPI metadata day du cho endpoints moi
- [ ] Error envelope dong nhat va test du
- [ ] Frontend button-state mapping dung capability matrix
- [ ] Governance docs duoc cap nhat

---

## 3. High-risk hotspots

1. packages/core/backend/src/service_ops/views/dataops.py
2. packages/core/backend/src/service_ops/views/prefetch.py
3. packages/core/backend/src/service_ops/tasks.py
4. packages/core/backend/src/vninvest_core/monitoring/queue_metrics.py
5. frontend/src/components/soc/DataOpsPanel.jsx
6. frontend/src/components/soc/PrefetchPanel.jsx
