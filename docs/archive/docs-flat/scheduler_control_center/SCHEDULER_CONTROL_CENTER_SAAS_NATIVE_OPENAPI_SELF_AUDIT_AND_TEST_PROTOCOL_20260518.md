# Self Audit and Test Protocol - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

## 1. Muc tieu audit

Dam bao implementation Scheduler Control Center:
1. Dung SaaS native architecture va ownership boundaries.
2. Dung OpenAPI contract governance.
3. Co scheduler status truth va control semantics nhat quan.
4. Co rollback readiness truoc write-mode rollout.

---

## 2. Checklist bat buoc

### A. Contract and architecture
- [ ] Namespace endpoint dung `/core/v1/operator/...`
- [ ] Error envelope dung chuan `{detail, code, timestamp, request_id, field_errors}`
- [ ] Khong tao compat/admin-ops route moi cho business logic

### B. Scheduler catalog
- [ ] Danh sach jobs hop nhat du nguon beat/runtime
- [ ] `next_run_at/last_run_at/lag_seconds` co semantics ro rang
- [ ] `status_reason` co gia tri cho degraded/failed

### C. Control actions
- [ ] enable/disable/pause/resume idempotent
- [ ] run_now tao run evidence
- [ ] abort_active revoke dung task khi co task_id

### D. Ownership and security
- [ ] `can_apply=false` bi chan dung ma loi
- [ ] Action write co audit trail
- [ ] Tenant-scoped constraints khong bi vo hieu hoa

### E. Frontend
- [ ] UI khong synthesize scheduler state
- [ ] Action buttons theo capability matrix
- [ ] i18n keys day du (vi/en), khong hardcoded text

### F. Governance
- [ ] start_dev run sau slice runtime/code
- [ ] CODE_CHANGE_AUDIT_LEDGER cap nhat
- [ ] PROGRESS_DASHBOARD cap nhat
- [ ] MODIFIED_FILES_AUDIT cap nhat

---

## 3. Test categories bat buoc

1. Backend unit tests: scheduler catalog builder, action executors.
2. Backend API tests: plan/health/history/actions contracts.
3. Integration tests: PeriodicTask mutation, ServiceConfig mutation, run log transitions.
4. Frontend tests: scheduler table render, action state, error handling.
5. OpenAPI tests: schema generation and required metadata checks.
6. Runtime smoke checks via `./start_dev.ps1`.

---

## 4. Block merge conditions

1. Action write path khong co ownership guard.
2. Endpoint moi thieu OpenAPI metadata.
3. UI hien thi state khac server truth.
4. Khong co evidence cho rollback drill truoc write-mode rollout.
