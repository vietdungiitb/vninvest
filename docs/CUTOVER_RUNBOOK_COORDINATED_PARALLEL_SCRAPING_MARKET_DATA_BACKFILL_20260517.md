# Cutover Runbook and Closeout - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17
**Status**: Ready
**Scope**: P08 closeout for CPS market-data backfill workstream

---

## 1. Muc tieu

1. Chot trinh tu cutover van hanh cho CPS market-data backfill.
2. Chot rollback playbook va incident triage/escalation.
3. Chot dieu kien GO/NO-GO de Tech Lead signoff.

---

## 2. GO/NO-GO gates

### Gate A - Functional readiness
- P01-P06 da hoan tat va co evidence.
- DataOps observability endpoint/UI hoat dong (`backlog`, `fail_rates`, `starvation`).

### Gate B - Shadow and parity
- Shadow window 72h da co evidence trong P07.
- Parity sample gate dat `fresh_or_warm >= 0.99`.

### Gate C - Rollback readiness
- Rollback drill da pass qua abort flow test:
  - `test_planner_run_abort_endpoint_revokes_queued_task_and_marks_run_skipped`
- Co san route abort planner run cho operator:
  - `/core/v1/operator/scraping/dataops/planner/run/{run_id}/abort/`

### Gate D - Runtime health
- Core API health `ok`.
- Frontend health `ok`.
- Queue drift check pass sau runtime refresh.

---

## 3. Cutover sequence

1. Verify health and drift
```powershell
Set-Location "c:/Mujoco Projects/vninvest"
./start_dev.ps1
Invoke-RestMethod http://localhost:8001/core/v1/health | ConvertTo-Json -Depth 5
```

2. Verify operator observability contract
```powershell
Invoke-RestMethod http://localhost:8001/core/v1/operator/scraping/dataops/observability/ | ConvertTo-Json -Depth 8
```

3. Verify planner control plane and run-history
```powershell
Invoke-RestMethod http://localhost:8001/core/v1/operator/scraping/dataops/run-logs/?page=1 | ConvertTo-Json -Depth 8
```

4. Verify rollback path readiness (dry drill via focused test)
```powershell
Set-Location "c:/Mujoco Projects/vninvest/packages/core/backend"
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test service_ops.tests.test_soc_api_domain.DataOpsDomainApiTestCase.test_planner_run_abort_endpoint_revokes_queued_task_and_marks_run_skipped --keepdb
```

5. Announce cutover window and monitor
- Monitor fail-rate 1h/24h and starvation indicators in DataOps monitor.
- Keep watch on run-log failures and queue-tier throughput.

---

## 4. Rollback playbook

### Triggers
1. Fail-rate window 1h vuot nguong van hanh da thong nhat.
2. Starvation lien tuc tren hot tier khong duoc giai toa trong cua so giam sat.
3. Planner runs bi fail lặp lai va backlog tang nhanh.

### Steps
1. Abort active manual planner runs qua endpoint abort.
2. Reduce dispatch pressure bang runtime config (`max_dispatch_per_cycle`, `max_batch_size`).
3. Hold aggressive datasets (intraday tiers) neu can, uu tien daily stabilization.
4. Re-run health checks and observability payload checks.
5. Ghi log incident + thay doi config vao audit artifacts.

---

## 5. Incident escalation

1. L1 Operator
- Xac nhan health, fail-rate, starvation, run logs.
- Kich hoat rollback step 1-2 neu can.

2. L2 Oncall Backend
- Danh gia scheduler/worker queue pressure.
- Dieu chinh runtime config va rollback depth policy.

3. L3 Tech Lead
- Quyet dinh GO/NO-GO tiep tuc cutover.
- Signoff closeout hoac yeu cau quay lai hardening slice.

---

## 6. Closeout and signoff

### Closeout checklist
- [x] P01-P07 evidence da cap nhat.
- [x] P08 cutover runbook va rollback playbook da ban hanh.
- [x] Taskboard, progress, ledger, modified-files da dong bo.
- [x] Spec audit checklist da doi chieu R1-R8.

### Signoff note
- CPS workstream du dieu kien closeout theo gate `fresh_or_warm parity >= 0.99`.
- Neu to chuc ap strict-fresh parity gate, can mo tiep hardening slice truoc khi final production signoff.
