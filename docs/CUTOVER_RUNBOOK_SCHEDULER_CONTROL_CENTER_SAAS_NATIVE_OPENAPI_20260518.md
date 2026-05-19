# Cutover Runbook - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18
**Status**: Draft for execution

---

## 1. Cutover strategy

Phase 1 - Read-only cutover:
1. Deploy scheduler plan/health/history APIs.
2. Enable scheduler boards in SOC as read-only.
3. Observe 24h soak for status correctness.

Phase 2 - Controlled write pilot:
1. Enable action endpoint for selected low-risk jobs.
2. Restrict operator group and capture evidence.
3. Expand to full job set after pass criteria.

---

## 2. Pre-cutover checklist

- [ ] Backend/Frontend tests PASS
- [ ] OpenAPI schema generated and reviewed
- [ ] Ownership matrix reviewed by Tech Lead
- [ ] Rollback command set rehearsed
- [ ] Runtime refresh via `./start_dev.ps1` PASS

---

## 3. Cutover execution steps

1. Deploy backend contracts and migrations (neu co).
2. Deploy frontend scheduler boards.
3. Verify read endpoints (`plan/health/history`).
4. Enable write pilot flag.
5. Execute pilot actions (pause/resume/run_now) and validate status transitions.
6. Collect evidence snapshots.

---

## 4. Rollback plan

Trigger rollback if:
1. Action endpoint mutation sai state.
2. False scheduler status tren production monitor.
3. Ownership bypass detect.

Rollback actions:
1. Disable write pilot flag.
2. Revert frontend action controls to read-only.
3. Revert backend action route exposure if needed.
4. Keep read-only observability online.

---

## 5. Closeout checklist

- [ ] Evidence template completed for all slices.
- [ ] Taskboard statuses updated.
- [ ] Spec audit pass signed off.
- [ ] Governance logs updated.
- [ ] Handoff note sent to delivery + ops teams.
