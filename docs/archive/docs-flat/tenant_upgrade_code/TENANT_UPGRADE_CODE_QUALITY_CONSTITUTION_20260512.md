# CODE QUALITY CONSTITUTION — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## 1. Tuyên ngôn chất lượng

Mọi code trong workstream TENANT-UPGRADE phải:

1. **Không có raw SQL** — dùng ORM hoặc `RawSQL` annotate có tham số hóa đầy đủ
2. **Không có circular import** — `packages/core` không import từ `backend.*`
3. **Không có hardcode secret** — mọi secret qua biến môi trường
4. **Additive migrations** — không drop column, không rename column mà không có backward migration
5. **Signal-safe** — mọi automation dùng `instance.save()` để trigger signals, không `queryset.update()`
6. **Test-first cho security** — IsTenantActive, quota enforcement, invite token phải có unit tests trước khi merge

---

## 2. Hard Rules (vi phạm = block merge)

### 2.1 Security

| Rule | ID | Enforcement |
|---|---|---|
| Không raw SQL trong tenant-related queries | SEC-01 | `grep "cursor.execute" packages/core/` → 0 |
| Không hardcode password, token, pepper trong source | SEC-02 | Pre-commit hook + code review |
| Invite token phải dùng `secrets.token_urlsafe(48)` | SEC-03 | Code review |
| Operator endpoints phải require `IsAdminUser` | SEC-04 | Automated test |
| `IsTenantActive` chỉ bypass `is_superuser` | SEC-05 | Test case 4 |
| 429 response body không được expose internal traceback | SEC-06 | Test case 7 |
| Lifecycle event `ip_address` phải được log cho mọi operator action | SEC-07 | Code review + test |

### 2.2 Architecture

| Rule | ID | Enforcement |
|---|---|---|
| Không import từ `backend.*` trong `packages/core/**` | ARCH-01 | `grep -r "from backend" packages/core/` → 0 |
| `TenantQuotaMiddleware` phải nằm SAU `AuthenticationMiddleware` trong MIDDLEWARE list | ARCH-02 | Kiểm tra `settings.py` thứ tự |
| Tất cả Celery tasks phải có `bind=True` và `max_retries` | ARCH-03 | Code review |
| `flush_quota_counters` phải dùng `update_or_create` (idempotent) | ARCH-04 | Test case: run twice → DB value unchanged |
| Automation tasks dùng `instance.save()` không phải `queryset.update()` khi cần trigger signals | ARCH-05 | Code review |
| `TenantLifecycleEvent` là append-only — không có update method | ARCH-06 | Không có `save(update_fields=...)` trên TenantLifecycleEvent |

### 2.3 Migration

| Rule | ID | Enforcement |
|---|---|---|
| Migrations phải additive (thêm column/table, không xoá/rename) | MIG-01 | Review migration file trước merge |
| Mọi new column phải có `null=True, blank=True` để backward compat | MIG-02 | Code review |
| Không có `RunPython` với destructive operation mà không có `reverse_code` | MIG-03 | Code review |
| Chạy `python manage.py migrate --run-syncdb` trong test suite | MIG-04 | CI/CD gate |

### 2.4 Performance

| Rule | ID | Enforcement |
|---|---|---|
| `IsTenantActive.has_permission` chỉ dùng `.only('status')` | PERF-01 | Code review |
| Middleware overhead < 2ms (Redis INCR O(1)) | PERF-02 | Benchmark evidence |
| Operator list endpoint phải annotate counts tại DB, không N+1 | PERF-03 | Django Debug Toolbar hoặc test assertion |
| Lifecycle automation tasks phải dùng `bulk_create` khi tạo nhiều events | PERF-04 | Code review |

---

## 3. Soft Rules (khuyến khích, không phải block)

| Rule | Reason |
|---|---|
| Docstring cho mọi new class và public method | Tài liệu hóa hành vi cho dev sau |
| Type hints trên function signatures | IDE support + Pylance analysis |
| `select_related` / `prefetch_related` trên queryset liên quan tenant | Giảm N+1 |
| Tách `tests/test_models.py`, `tests/test_tasks.py`, `tests/test_signals.py` | Dễ debug khi fail |

---

## 4. Forbidden Patterns

```python
# ❌ FORBIDDEN: raw SQL tenant query
cursor.execute("SELECT * FROM identity_access_coretenant WHERE id = %s", [id])

# ✅ CORRECT: ORM
tenant = CoreTenant.objects.get(pk=id)

# ❌ FORBIDDEN: hardcode pepper
PEPPER = "my_secret_pepper_123"

# ✅ CORRECT: env var
PEPPER = os.environ["PAT_HMAC_PEPPER"]

# ❌ FORBIDDEN: queryset.update() khi cần trigger signal
CoreTenant.objects.filter(status='trial').update(status='suspended')

# ✅ CORRECT: use instance.save() hoặc custom manager method
for tenant in CoreTenant.objects.filter(status='trial', trial_ends_at__lt=now):
    tenant._actor_type = 'system'
    tenant.status = 'suspended'
    tenant.save(update_fields=['status', 'updated_at'])

# ❌ FORBIDDEN: import từ backend.* trong packages/core
# File: packages/core/backend/src/identity_access/models.py
from backend.portfolio.models import UserPortfolio  # FORBIDDEN

# ❌ FORBIDDEN: wildcard on AllowAny for operator endpoints
@api_view(['POST'])
@permission_classes([AllowAny])  # FORBIDDEN trên operator endpoint
def operator_tenant_suspend_api(request, tenant_id):
    ...

# ❌ FORBIDDEN: expose traceback trong 429
return JsonResponse({
    "error": "quota_exceeded",
    "traceback": traceback.format_exc()  # FORBIDDEN
}, status=429)
```

---

## 5. Commit Convention

```
TENANT-T01: remove duplicate CoreTenant from backend/portfolio/models.py
TENANT-T02: replace raw SQL in core_pat_auth.py with ORM
TENANT-T03: add IsTenantActive permission class and apply globally
TENANT-T04: add TenantQuotaMiddleware with Redis INCR
TENANT-T05: add commercial/tasks.py - quota flush, invoicing, overdue check
TENANT-T06: create tenant_lifecycle Django app with lifecycle automation
TENANT-T07: add operator write API - suspend, activate, change-plan, provision
TENANT-T08: add self-service onboarding endpoint with trial activation
TENANT-T09: add TenantMember and TenantInvite models with CRUD API
TENANT-T10: data isolation audit and tenant FK migration top 3 models
TENANT-T11: complete audit trail signals and operator lifecycle-events endpoint
```

Không merge commit không theo format trên.

---

## 6. Code Review Gate — Reviewer Checklist

```
Before approving any TENANT-UPGRADE PR, verify:

Security:
- [ ] SEC-01: 0 raw SQL in modified files
- [ ] SEC-02: 0 hardcoded secrets
- [ ] SEC-03: invite token uses secrets.token_urlsafe(48)
- [ ] SEC-04: operator endpoints require IsAdminUser
- [ ] SEC-05: IsTenantActive only bypasses is_superuser (test case 4)
- [ ] SEC-06: 429 body has no traceback
- [ ] SEC-07: operator actions log ip_address

Architecture:
- [ ] ARCH-01: 0 cross-package imports (packages/core → backend.*)
- [ ] ARCH-02: middleware order is correct in settings.py
- [ ] ARCH-03: Celery tasks have bind=True and max_retries
- [ ] ARCH-04: flush task is idempotent
- [ ] ARCH-05: automation uses instance.save() not queryset.update()
- [ ] ARCH-06: TenantLifecycleEvent has no update path

Migration:
- [ ] MIG-01: migration is additive
- [ ] MIG-02: new columns are nullable
- [ ] MIG-03: no destructive RunPython without reverse_code

Tests:
- [ ] All test cases from IMPLEMENTATION_PLAN for this slice PASS
- [ ] Core regression suite PASS (whale analytics, order flow)
- [ ] python manage.py check PASS

Post-merge:
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] PROGRESS_DASHBOARD.md updated
- [ ] TASKBOARD_TENANT_UPGRADE_20260512.md slice = done
- [ ] module_tree_full.md regenerated (if new app/model)
- [ ] Pushed to origin/dev
```

---

## 7. Anti-Patterns từ kinh nghiệm project

| Pattern | Vấn đề | Cách xử lý |
|---|---|---|
| `queryset.update()` trong automation task | Không trigger `pre_save`/`post_save` signals → lifecycle event không được tạo | Dùng `instance.save()` trong loop |
| `IsTenantActive` lookup không dùng `.only()` | Fetch toàn bộ CoreTenant row mỗi request → overhead tích lũy | Luôn dùng `.only('status')` |
| Redis quota key không set TTL | Key tồn tại mãi mãi, tích lũy memory | Set TTL 48h, reset khi count = 1 |
| Invite token dùng UUID4 | Entropy thấp hơn `secrets.token_urlsafe(48)` | Dùng `secrets.token_urlsafe(48)` |
| Signal đăng ký trong `models.py` thay vì `apps.py.ready()` | Signal có thể bị duplicate khi Django reload | Luôn import signals trong `AppConfig.ready()` |
| Beat schedule entry không có unique name | Duplicate execution | Task name phải unique trong CELERY_BEAT_SCHEDULE |
