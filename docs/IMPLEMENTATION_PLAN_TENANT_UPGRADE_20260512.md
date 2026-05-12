# IMPLEMENTATION PLAN — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## Scope

**Trong scope:**
- 11 slices T01→T11 theo thứ tự đã định nghĩa trong Handoff Master
- Hợp nhất SSOT, per-request guard, quota enforcement, lifecycle automation, operator write API, onboarding, multi-member, audit trail

**Ngoài scope:**
- Payment gateway integration
- Email SMTP live
- Frontend UI cho tenant self-admin

---

## Phase 1: SSOT & Per-Request Guard (P0)

---

### Task T01: Hợp nhất SSOT CoreTenant

**Duration ước tính**: 4 giờ

**Mục tiêu:**
Xoá class `CoreTenant` trùng lặp trong `backend/portfolio/models.py`. Toàn bộ codebase chỉ còn một định nghĩa tại `packages/core/backend/src/identity_access/models.py`.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `backend/portfolio/models.py` | MODIFY — xoá lines 1140–~1250 |
| `backend/portfolio/views.py` | VERIFY — import CoreTenant OK |
| `backend/portfolio/views_admin_runtime.py` | VERIFY — import CoreTenant OK |
| `backend/portfolio/migrations/0067_coretenant.py` | VERIFY — không cần xoá nếu `db_table` đã trùng |

**Implementation steps:**

1. Đọc `backend/portfolio/models.py` lines 1140–1250 để xác nhận `db_table` của legacy class.
2. Verify `identity_access/migrations/0001_initial.py` dùng cùng `db_table` (`identity_access_coretenant`).
3. Thay toàn bộ class definition bằng re-export:
   ```python
   # Thay class CoreTenant(models.Model): ... bằng:
   from identity_access.models import CoreTenant  # noqa: F401
   ```
4. Chạy `python manage.py check` — fix mọi import error phát sinh.
5. Chạy targeted test suite.

**Test cases bắt buộc:**
1. `python manage.py check` PASS — 0 errors
2. `python manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb` — PASS
3. `python manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb` — PASS
4. `grep -r "class CoreTenant" backend/portfolio/` → 0 kết quả

**DoD:**
- [ ] File `backend/portfolio/models.py` không còn `class CoreTenant(models.Model):`
- [ ] `python manage.py check` PASS
- [ ] 2 test suites PASS
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` cập nhật

---

### Task T02: Refactor core_pat_auth.py — xoá raw SQL tenant queries

**Duration ước tính**: 3 giờ

**Mục tiêu:**
`backend/core_pat_auth.py` không còn raw SQL query tới `identity_access_coretenant`. Thay bằng ORM calls.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `backend/core_pat_auth.py` | MODIFY |

**Implementation steps:**

1. Đọc toàn bộ `backend/core_pat_auth.py` để map tất cả raw SQL patterns.
2. Thay từng query bằng ORM equivalent (xem Tech Spec section 9.2).
3. Đảm bảo không có string interpolation trong query parameters.
4. Chạy PAT smoke test: issue PAT → dùng PAT để authenticate.

**Test cases bắt buộc:**
1. `grep "identity_access_coretenant" backend/core_pat_auth.py` → 0 kết quả
2. `grep "SELECT.*FROM.*coretenant" backend/core_pat_auth.py` → 0 kết quả
3. PAT issue + use smoke: HTTP 201 (issue) + HTTP 200 (use) — thủ công

**DoD:**
- [ ] 0 raw SQL string trong `core_pat_auth.py` trỏ tới tenant tables
- [ ] PAT smoke test PASS
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` cập nhật

---

### Task T03: IsTenantActive permission class

**Duration ước tính**: 4 giờ

**Mục tiêu:**
Tạo `IsTenantActive` permission class và apply vào `DEFAULT_PERMISSION_CLASSES`. Tenant `suspended`/`deprovisioned` nhận `403` ngay lập tức.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/identity_access/permissions.py` | MODIFY — thêm class |
| `packages/core/backend/src/vninvest_core/settings.py` | MODIFY — thêm vào DEFAULT_PERMISSION_CLASSES |

**Implementation steps:**

1. Đọc `identity_access/permissions.py` hiện tại — tìm hiểu classes đang có.
2. Thêm `IsTenantActive` theo spec tại Tech Spec section 4.1.
3. Thêm vào `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` (Tech Spec 4.2).
4. Verify public endpoints vẫn dùng `permission_classes = [AllowAny]` override — không bị ảnh hưởng.
5. Viết unit tests.

**Test cases bắt buộc:**
1. User với `tenant.status = 'suspended'` gọi `GET /api/signals/whale-feed/` → `403`
2. User với `tenant.status = 'active'` gọi endpoint → `200` bình thường
3. User với `tenant.status = 'deprovisioned'` → `403`
4. Superuser với `is_superuser=True` và `tenant.status = 'suspended'` → `200` (bypass)
5. Endpoint `GET /api/public/legal-pages/` (AllowAny) vẫn trả `200` khi tenant suspended

**DoD:**
- [ ] Class `IsTenantActive` tồn tại trong `permissions.py`
- [ ] Đã thêm vào `DEFAULT_PERMISSION_CLASSES`
- [ ] 5 test cases PASS
- [ ] `python manage.py test identity_access.tests --keepdb` PASS

---

## Phase 2: Commercial Enforcement (P1)

---

### Task T04: TenantQuotaMiddleware + Redis metering

**Duration ước tính**: 6 giờ

**Mục tiêu:**
Mỗi authenticated API request được đếm per-tenant vào Redis. Khi vượt `api_calls_limit` → `429 Too Many Requests`.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/identity_access/middleware.py` | CREATE |
| `packages/core/backend/src/vninvest_core/settings.py` | MODIFY — thêm vào MIDDLEWARE list |

**Implementation steps:**

1. Tạo `middleware.py` theo spec tại Tech Spec section 5.1.
2. Thêm `'identity_access.middleware.TenantQuotaMiddleware'` vào `MIDDLEWARE` sau `AuthenticationMiddleware`.
3. Verify Redis cache backend đang configured (dùng `django.core.cache`).
4. Viết unit tests với mock Redis.

**Test cases bắt buộc:**
1. Tenant `api_calls_limit = 100` — gọi 101 requests → request 101 trả `429`
2. Tenant `api_calls_limit = -1` (unlimited) — gọi 1000 requests → không bao giờ `429`
3. Path `/api/core/v1/auth/login` → không bị đếm (exempt)
4. Path `/health` → không bị đếm (exempt)
5. Unauthenticated request → không bị đếm, không bị block
6. Superuser request → không bị đếm, không bị block
7. Middleware overhead: benchmark average < 2ms per request

**DoD:**
- [ ] `middleware.py` tồn tại đúng path
- [ ] Đã thêm vào `MIDDLEWARE` list đúng vị trí
- [ ] 6 test cases functional PASS
- [ ] Benchmark overhead documented trong evidence

---

### Task T05: Celery tasks — billing và quota flush

**Duration ước tính**: 8 giờ

**Mục tiêu:**
Tạo `commercial/tasks.py` với 3 Celery tasks: flush quota counters từ Redis → DB, generate monthly invoices, check overdue invoices.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/commercial/tasks.py` | CREATE |
| `packages/core/backend/src/vninvest_core/settings.py` hoặc `celery_app.py` | MODIFY — beat schedule |

**Implementation steps:**

1. Đọc `commercial/models.py` để hiểu `QuotaRecord` và `Invoice` schemas.
2. Tạo `commercial/tasks.py` theo spec tại Tech Spec section 6.1.
3. Thêm 3 beat schedule entries vào settings (Tech Spec section 6.3).
4. Viết unit tests (mock Redis + DB).

**Test cases bắt buộc:**
1. `flush_quota_counters.delay()` — Redis key `quota:api_calls:TID:DATE` = 50 → `QuotaRecord.api_calls_used` = 50
2. `generate_monthly_invoices.delay()` — 2 active Subscriptions → 2 Invoice rows created với đúng amount
3. `check_overdue_invoices.delay()` — Invoice `due_date = 8 ngày trước, status=open` → `status=past_due` + tenant suspended
4. Invoice đã `status=paid` không bị xử lý bởi `check_overdue_invoices`
5. `flush_quota_counters` là idempotent — chạy 2 lần liên tiếp, DB value không tăng đôi

**DoD:**
- [ ] `commercial/tasks.py` tồn tại với 3 tasks
- [ ] Beat schedule thêm 3 entries
- [ ] 5 unit tests PASS
- [ ] `python manage.py test commercial.tests --keepdb` PASS

---

## Phase 3: Lifecycle Automation (P1)

---

### Task T06: Django app tenant_lifecycle

**Duration ước tính**: 10 giờ

**Mục tiêu:**
Tạo Django app mới `tenant_lifecycle` với `TenantLifecycleEvent` model, signals, và 4 Celery automation tasks.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/tenant_lifecycle/__init__.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/apps.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/models.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/signals.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/tasks.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/admin.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/migrations/0001_initial.py` | CREATE |
| `packages/core/backend/src/tenant_lifecycle/tests/` | CREATE |
| `packages/core/backend/src/vninvest_core/settings.py` | MODIFY — thêm `tenant_lifecycle` vào INSTALLED_APPS + beat schedule |

**Implementation steps:**

1. Tạo cấu trúc thư mục app (xem Tech Spec section 10).
2. Tạo `models.py` theo Tech Spec section 3.4.
3. Tạo `signals.py` theo Tech Spec section 7.
4. Tạo `apps.py` với `ready()` hook đăng ký signals.
5. Tạo `tasks.py` theo Tech Spec section 6.2.
6. Tạo migration: `python manage.py makemigrations tenant_lifecycle`.
7. Thêm 4 beat schedule entries (Tech Spec section 6.3).
8. Viết tests cho models, tasks, signals.

**Test cases bắt buộc:**
1. `TenantLifecycleEvent` migration: `python manage.py migrate` PASS
2. Signal: `CoreTenant.status` thay đổi từ `active` → `suspended` → `TenantLifecycleEvent(event_type=STATUS_CHANGED)` được tạo tự động
3. `auto_expire_trials.delay()` — tenant `status=trial, trial_ends_at = yesterday` → `status=suspended` + lifecycle event
4. `auto_suspend_quota_overflow.delay()` — tenant vượt quota → `status=suspended` + lifecycle event
5. `send_trial_expiry_warning.delay()` — tenant trial còn 7 ngày → email task enqueued (mock)
6. `auto_deprovision_stale.delay()` — tenant `suspended_at = 31 ngày trước` → `status=deprovisioned`
7. Signals không trigger nếu `status` không thay đổi (no-op guard)

**DoD:**
- [ ] App tồn tại tại đúng path với đủ files
- [ ] Migration PASS
- [ ] 7 unit test cases PASS
- [ ] `python manage.py test tenant_lifecycle.tests --keepdb` PASS
- [ ] `module_tree_full.md` regenerated

---

## Phase 4: Operator Write API (P1)

---

### Task T07: Operator action endpoints

**Duration ước tính**: 6 giờ

**Mục tiêu:**
Admin có thể suspend/activate/change-plan tenant qua REST API. Mọi action đều log `TenantLifecycleEvent`.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `backend/portfolio/views_admin_runtime.py` | MODIFY — thêm 5 write views |
| `backend/config/urls.py` | MODIFY — thêm 5 URL patterns |

**Implementation steps:**

1. Đọc `views_admin_runtime.py` để hiểu pattern hiện tại (đã có read views).
2. Thêm 5 endpoints theo spec tại Tech Spec section 8.1.
3. Mỗi write action phải:
   - Validate `tenant_id` tồn tại
   - Dùng `tenant._set_status()` (hoặc gọi `save()` với `update_fields`) để trigger signals
   - Trả về tenant snapshot

**Test cases bắt buộc:**
1. `POST /api/core/v1/operator/tenants/{id}/suspend/` với valid `tenant_id` → `200`, `tenant.status = suspended`
2. `POST .../activate/` sau khi suspended → `200`, `tenant.status = active`
3. `POST .../change-plan/` với `plan = "pro"` → `200`, `tenant.plan = pro`
4. Non-admin user gọi suspend → `403`
5. Invalid `tenant_id` → `404`
6. Mỗi action tạo `TenantLifecycleEvent` với đúng `actor_user` và `actor_type = 'operator'`

**DoD:**
- [ ] 5 endpoints hoạt động
- [ ] 6 test cases PASS
- [ ] Mỗi action tạo lifecycle event

---

## Phase 5: Self-Service Onboarding (P2)

---

### Task T08: Onboarding endpoint + trial activation

**Duration ước tính**: 5 giờ

**Mục tiêu:**
User đã authenticated có thể POST để khởi tạo tenant trial của mình.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/identity_access/onboarding_views.py` | CREATE |
| `packages/core/backend/src/identity_access/urls.py` | MODIFY |

**Implementation steps:**

1. Tạo `onboarding_views.py` với view `RegisterTenantView`.
2. Logic: kiểm tra không có CoreTenant tồn tại → tạo mới với `status=trial`, `trial_ends_at = now() + 14 days`.
3. Enqueue welcome email task (Celery — không cần SMTP thật, chỉ cần task được enqueue).
4. Tạo `TenantLifecycleEvent(TRIAL_STARTED)`.
5. Thêm route vào `urls.py`.

**Test cases bắt buộc:**
1. User chưa có tenant → POST `{ "display_name": "Test Co" }` → `201`, `status=trial`, `trial_ends_at = now + 14d`
2. User đã có tenant → `409 Conflict`
3. `display_name` bỏ trống → `400 Bad Request`
4. `TenantLifecycleEvent(TRIAL_STARTED)` được tạo
5. Welcome email task được enqueue (verify với mock)

**DoD:**
- [ ] Endpoint `POST /api/core/v1/onboarding/register/` hoạt động
- [ ] 5 test cases PASS

---

### Task T09: TenantMember + TenantInvite

**Duration ước tính**: 8 giờ

**Mục tiêu:**
Owner có thể invite member vào tenant. Member accept invite qua token. Có thể xoá member.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/identity_access/models.py` | MODIFY — thêm TenantMember, TenantInvite |
| `packages/core/backend/src/identity_access/serializers.py` | MODIFY — thêm serializers |
| `packages/core/backend/src/identity_access/views.py` | MODIFY — thêm member views |
| `packages/core/backend/src/identity_access/urls.py` | MODIFY |
| Migration mới | CREATE |

**Implementation steps:**

1. Thêm `TenantMember` và `TenantInvite` models theo Tech Spec section 3.2–3.3.
2. Tạo migration: `python manage.py makemigrations identity_access`.
3. Thêm serializers, views, urls theo spec tại Tech Spec section 8.3.
4. Viết tests cho invite flow.

**Test cases bắt buộc:**
1. Owner POST invite → `TenantInvite` được tạo với `token` hợp lệ (64 chars)
2. Accept invite với valid token → `TenantMember` được tạo, `invite.status=accepted`
3. Accept invite đã accepted → `409`
4. Accept invite đã expired → `410`
5. Non-owner/admin POST invite → `403`
6. DELETE member → `TenantMember` removed, `TenantLifecycleEvent(MEMBER_REMOVED)` logged
7. `unique_together(tenant, user)` constraint — duplicate member → `400`

**DoD:**
- [ ] Models, migrations PASS
- [ ] 4 endpoints hoạt động
- [ ] 7 test cases PASS
- [ ] `module_tree_full.md` regenerated

---

## Phase 6: Data Isolation & Audit Trail (P2–P3)

---

### Task T10: Data isolation audit + FK migration (top 3 models)

**Duration ước tính**: 6 giờ

**Mục tiêu:**
Xác định models critical cần tenant isolation. Fix top 3 models bằng cách thêm `tenant` FK. Backfill existing rows.

**Files bị ảnh hưởng:**

Xác định sau audit, nhưng candidate chính:

| File | Model | Ghi chú |
|---|---|---|
| `backend/portfolio/models.py` | `UserPortfolio` | user FK, cần tenant scope |
| `backend/portfolio/models.py` | `WatchlistItem` | user FK, cần tenant scope |
| `packages/core/backend/src/user_workspace/models.py` | Workspace models | verify |

**Implementation steps:**

1. Grep tất cả models có `models.ForeignKey(User` nhưng không có `tenant` FK — liệt kê vào evidence.
2. Chọn top 3 theo mức độ exposure (user data, advisory data).
3. Tạo migration additive: `tenant = ForeignKey(CoreTenant, null=True, blank=True, ...)`.
4. Viết Celery backfill task: `backfill_tenant_from_user` — fill `tenant` từ `owner_user`.
5. Chạy backfill với `--dry-run` trước.

**Test cases bắt buộc:**
1. Migration PASS (additive, không drop column)
2. Backfill task: 0 orphan rows sau khi chạy
3. Query `UserPortfolio.objects.filter(tenant=tenant)` trả đúng subset

**DoD:**
- [ ] Danh sách đầy đủ models cần isolation trong evidence file
- [ ] Top 3 models có `tenant` FK
- [ ] Backfill PASS với 0 orphans

---

### Task T11: TenantLifecycleEvent audit trail + operator history endpoint

**Duration ước tính**: 4 giờ

**Mục tiêu:**
Hoàn thiện signal hooks để capture tất cả state transitions. Thêm operator endpoint xem history.

**Files bị ảnh hưởng:**

| File | Loại |
|---|---|
| `packages/core/backend/src/tenant_lifecycle/signals.py` | MODIFY — thêm plan_changed signal |
| `backend/portfolio/views_admin_runtime.py` | MODIFY — thêm lifecycle-events endpoint |
| `backend/config/urls.py` | MODIFY |

**Implementation steps:**

1. Thêm signal cho `plan_changed` (khi `CoreTenant.plan` thay đổi).
2. Thêm `GET /api/core/v1/operator/tenants/{tenant_id}/lifecycle-events/` endpoint.
3. Paginate bằng cursor pagination chuẩn (limit/starting_after).

**Test cases bắt buộc:**
1. Plan change → `TenantLifecycleEvent(PLAN_CHANGED, old_value={plan:free}, new_value={plan:pro})`
2. Operator GET lifecycle-events → paginated list đúng thứ tự `created_at DESC`
3. Non-admin GET lifecycle-events → `403`

**DoD:**
- [ ] Plan change signal hoạt động
- [ ] Operator history endpoint PASS
- [ ] 3 test cases PASS

---

## Dependency Graph

```
T01 ──► T02 ──► T03
                 │
                 ▼
                T04 ──► T05
                         │
                         ▼
                        T06 ──► T07
                                 │
                         ┌───────┴───────┐
                         ▼               ▼
                        T08             T09
                         │               │
                         └───────┬───────┘
                                 ▼
                        T10 ──► T11
```

---

## Validation Gates Toàn Workstream

| Gate | Command | Pass Condition |
|---|---|---|
| V1 | `python manage.py check` | 0 errors |
| V2 | `python manage.py test identity_access --keepdb` | 100% PASS |
| V3 | `python manage.py test commercial.tests --keepdb` | 100% PASS |
| V4 | `python manage.py test tenant_lifecycle.tests --keepdb` | 100% PASS |
| V5 | `grep -r "class CoreTenant" backend/portfolio/` | 0 kết quả |
| V6 | `grep "identity_access_coretenant" backend/core_pat_auth.py` | 0 kết quả |
| V7 | Suspended tenant → 403 | Thủ công hoặc test |
| V8 | 101 requests > limit=100 → 429 | Automated |
| V9 | Trial auto-expire smoke | Automated |
| V10 | `docker compose -f docker-compose.dev.yml up -d --build backend` | Healthy |

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| T01 migration gây FK broken | Chạy `--keepdb` test trước khi xoá; verify `db_table` match |
| `TenantQuotaMiddleware` overhead > 2ms | Benchmark trước deploy; nếu > 2ms dùng async increment |
| Middleware block auth endpoints | Whitelist `/api/core/v1/auth/` trong QUOTA_EXEMPT_PATH_PREFIXES |
| Celery beat schedule duplicate task | Task names unique; test với `apply_async` trước beat |
| `pre_save` signal không capture nếu dùng `queryset.update()` | Tất cả automation tasks phải dùng `instance.save()` để trigger signals |
| Multi-member `OneToOneField` → `ForeignKey` owner breakage | Giữ nguyên `owner_user` OneToOneField, chỉ thêm `TenantMember` riêng |
