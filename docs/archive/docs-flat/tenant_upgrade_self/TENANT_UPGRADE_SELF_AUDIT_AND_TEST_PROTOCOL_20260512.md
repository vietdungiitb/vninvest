# SELF AUDIT & TEST PROTOCOL — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## Mục đích

Document này định nghĩa quy trình self-audit và test protocol cho từng slice. Dev thực hiện slice phải chạy toàn bộ checklist này trước khi đánh dấu slice DONE và push PR.

---

## Protocol Level 1: Pre-Coding Gates

Trước khi viết bất kỳ dòng code nào cho slice, xác nhận:

```
- [ ] Đã đọc TECH_SPEC_TENANT_UPGRADE_20260512.md section tương ứng
- [ ] Đã đọc IMPLEMENTATION_PLAN_TENANT_UPGRADE_20260512.md task section
- [ ] python manage.py check PASS trên branch mới
- [ ] python manage.py test portfolio.tests --keepdb PASS (baseline)
```

---

## Protocol Level 2: Per-Slice Test Checklist

### TENANT-T01: SSOT CoreTenant

**Automated checks:**

```powershell
# 1. SSOT verification
grep -r "class CoreTenant" backend/portfolio/
# Expected: 0 results

# 2. Django system check
cd backend
..\.venv\Scripts\python.exe manage.py check
# Expected: 0 errors

# 3. Core test suites
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_order_flow --keepdb
# Expected: all PASS
```

**Manual checks:**
- [ ] Import `CoreTenant` từ `backend/portfolio/views.py` còn hoạt động
- [ ] Migration `showmigrations` — không có pending

---

### TENANT-T02: PAT Auth ORM Refactor

**Automated checks:**

```powershell
# 1. SQL string presence
grep -r "identity_access_coretenant" backend/core_pat_auth.py
# Expected: 0 results

grep -r "cursor.execute" backend/core_pat_auth.py
# Expected: 0 results (hoặc chỉ còn non-tenant queries)

# 2. Django check
cd backend
..\.venv\Scripts\python.exe manage.py check
```

**Manual smoke test:**
- [ ] Issue PAT via API → nhận token
- [ ] Dùng token trong Authorization header → HTTP 200
- [ ] Invalid token → HTTP 401

---

### TENANT-T03: IsTenantActive

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test identity_access.tests.test_permissions --keepdb
```

**Unit test assertions (viết trong `identity_access/tests/test_permissions.py`):**

```python
class IsTenantActiveTest(TestCase):
    def test_suspended_tenant_blocked(self):
        # tenant.status = 'suspended' → 403

    def test_active_tenant_allowed(self):
        # tenant.status = 'active' → 200

    def test_deprovisioned_blocked(self):
        # tenant.status = 'deprovisioned' → 403

    def test_superuser_bypasses_suspended(self):
        # user.is_superuser = True, tenant.status = 'suspended' → 200

    def test_public_endpoint_unaffected(self):
        # AllowAny endpoint, tenant.status = 'suspended' → 200
```

**Manual check:**
- [ ] Apply permission globally, verify existing API endpoints chưa break

---

### TENANT-T04: TenantQuotaMiddleware

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test identity_access.tests.test_middleware --keepdb
```

**Unit test assertions:**

```python
class QuotaMiddlewareTest(TestCase):
    def test_quota_exceeded_returns_429(self):
        # Tenant limit=10; send 11 requests; request 11 → 429

    def test_unlimited_quota_never_429(self):
        # limit=-1; send 1000 requests; never 429

    def test_auth_path_exempt(self):
        # POST /api/core/v1/auth/login → not counted

    def test_health_path_exempt(self):
        # GET /health → not counted

    def test_unauthenticated_not_counted(self):
        # No auth header → not counted, not blocked

    def test_superuser_not_counted(self):
        # is_superuser=True → not counted

    def test_429_response_body_format(self):
        # Response JSON has keys: error, detail, limit, used
```

**Performance check:**
```python
# Benchmark: average overhead < 2ms per request
import timeit
# Run 1000 requests through middleware, calculate mean latency
```

---

### TENANT-T05: Commercial Celery Tasks

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test commercial.tests.test_tasks --keepdb
```

**Unit test assertions:**

```python
class CommercialTasksTest(TestCase):
    def test_flush_quota_counters_writes_db(self):
        # Redis key = 50 → QuotaRecord.api_calls_used = 50

    def test_flush_quota_counters_idempotent(self):
        # Run twice → DB value not doubled

    def test_generate_monthly_invoices_creates_records(self):
        # 2 active Subscriptions → 2 Invoice rows

    def test_check_overdue_8_days_past_due(self):
        # Invoice due_date = 8 days ago, status=open → status=past_due

    def test_check_overdue_suspends_tenant(self):
        # Invoice past_due → tenant.status=suspended + lifecycle event
```

---

### TENANT-T06: tenant_lifecycle App

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test tenant_lifecycle.tests --keepdb
```

**Migration check:**
```powershell
..\.venv\Scripts\python.exe manage.py migrate --run-syncdb
..\.venv\Scripts\python.exe manage.py showmigrations tenant_lifecycle
# Expected: [X] 0001_initial
```

**Unit test assertions:**

```python
class TenantLifecycleTest(TestCase):
    def test_status_change_logs_event(self):
        # CoreTenant.status active→suspended → TenantLifecycleEvent created

    def test_no_event_if_status_unchanged(self):
        # Save with same status → no new event

    def test_trial_auto_expire(self):
        # tenant trial_ends_at=yesterday → status=suspended after task

    def test_quota_overflow_suspend(self):
        # QuotaRecord exceeded → status=suspended after task

    def test_trial_warning_enqueued(self):
        # trial_ends_at in 7 days → email task enqueued

    def test_auto_deprovision_30_days(self):
        # suspended_at = 31 days ago → status=deprovisioned

    def test_signal_not_double_log(self):
        # queryset.update() does NOT trigger signal (doc this limitation)
```

**App structure check:**
```powershell
ls packages/core/backend/src/tenant_lifecycle/
# Expected: __init__.py, apps.py, models.py, signals.py, tasks.py, admin.py, migrations/, tests/
```

---

### TENANT-T07: Operator Write API

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_operator_write_api --keepdb
```

**Unit test assertions:**

```python
class OperatorWriteAPITest(APITestCase):
    def test_suspend_tenant(self):
        # POST /operator/tenants/{id}/suspend/ → 200, tenant.status=suspended

    def test_activate_tenant(self):
        # POST /operator/tenants/{id}/activate/ → 200, tenant.status=active

    def test_change_plan(self):
        # POST /operator/tenants/{id}/change-plan/ {plan:pro} → 200, tenant.plan=pro

    def test_non_admin_forbidden(self):
        # Regular user → 403

    def test_invalid_tenant_id_404(self):
        # Non-existent ID → 404

    def test_action_logs_lifecycle_event(self):
        # Suspend → TenantLifecycleEvent with actor_user=admin
```

---

### TENANT-T08: Onboarding

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test identity_access.tests.test_onboarding --keepdb
```

**Unit test assertions:**

```python
class OnboardingTest(APITestCase):
    def test_register_creates_trial_tenant(self):
        # POST /onboarding/register/ → 201, status=trial, trial_ends_at set

    def test_duplicate_register_409(self):
        # User already has tenant → 409

    def test_empty_display_name_400(self):
        # display_name="" → 400

    def test_lifecycle_event_created(self):
        # TenantLifecycleEvent(TRIAL_STARTED) created

    def test_welcome_email_enqueued(self):
        # Email Celery task enqueued (mock)
```

---

### TENANT-T09: TenantMember + TenantInvite

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test identity_access.tests.test_member_invite --keepdb
```

**Migration check:**
```powershell
..\.venv\Scripts\python.exe manage.py showmigrations identity_access
# Latest migration exists and applied
```

**Unit test assertions:**

```python
class TenantMemberInviteTest(APITestCase):
    def test_invite_creates_token(self):
        # POST invite → 201, token 64 chars

    def test_accept_valid_invite(self):
        # GET /invites/accept/?token=X → 200, TenantMember created

    def test_accept_already_accepted_409(self):
    def test_accept_expired_410(self):
    def test_non_owner_cannot_invite_403(self):
    def test_delete_member_removes_record(self):
    def test_duplicate_member_400(self):
```

---

### TENANT-T10: Data Isolation

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_data_isolation --keepdb
```

**Orphan check:**

```python
class DataIsolationTest(TestCase):
    def test_zero_orphan_portfolios(self):
        # UserPortfolio.objects.filter(tenant__isnull=True).count() == 0 after backfill

    def test_tenant_filter_scopes_data(self):
        # UserPortfolio.objects.filter(tenant=tenant).exclude(user__in=tenant_users) == 0

    def test_migration_additive(self):
        # No dropped columns in migration file
```

---

### TENANT-T11: Audit Trail Complete

**Automated checks:**

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test tenant_lifecycle.tests.test_audit --keepdb
```

**Unit test assertions:**

```python
class AuditTrailTest(APITestCase):
    def test_plan_change_logs_event(self):
        # tenant.plan changed → TenantLifecycleEvent(PLAN_CHANGED, old_value, new_value)

    def test_operator_lifecycle_history_paginated(self):
        # GET /operator/tenants/{id}/lifecycle-events/ → paginated list DESC

    def test_non_admin_history_forbidden(self):
        # Regular user → 403
```

---

## Protocol Level 3: Integration Smoke Test (post all slices)

Chạy sau khi hoàn thành toàn bộ T01→T11:

```powershell
# Full backend test suite
cd backend
..\.venv\Scripts\python.exe manage.py test portfolio.tests --keepdb
..\.venv\Scripts\python.exe manage.py test identity_access.tests --keepdb
..\.venv\Scripts\python.exe manage.py test commercial.tests --keepdb
..\.venv\Scripts\python.exe manage.py test tenant_lifecycle.tests --keepdb

# SSOT assertion
grep -r "class CoreTenant" backend/portfolio/
# → 0 results

grep -r "identity_access_coretenant" backend/core_pat_auth.py
# → 0 results

# System check
..\.venv\Scripts\python.exe manage.py check
# → 0 errors
```

**Docker stack smoke:**

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
# Wait 30s, then:
curl http://localhost:8000/health
# → {"status": "ok"}

# Suspended tenant smoke (manual):
# 1. Authenticate as test user with suspended tenant
# 2. Call GET /api/signals/whale-feed/ → 403
# 3. Call GET /health → 200
```

---

## Protocol Level 4: Regression Guard

Sau mỗi slice, chạy core regression để đảm bảo không break feature hiện tại:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_order_flow --keepdb
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_order_flow_source_parity --keepdb
```

Nếu bất kỳ suite nào FAIL sau slice mới, **không push PR** — phải fix trước.

---

## Failure Escalation Protocol

| Failure Type | Action |
|---|---|
| `manage.py check` error | Fix immediately, không merge |
| Core regression FAIL | Revert slice, investigate, redo |
| Migration conflict | Squash hoặc re-generate migration |
| 429 không trigger đúng | Check Redis connection + MIDDLEWARE order |
| Signal không trigger | Check `apps.py ready()` imports signals |
| Lifecycle event không được tạo | Check signal registration + `update_fields` |
