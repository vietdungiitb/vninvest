# EXECUTION EVIDENCE TEMPLATE — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## Hướng dẫn sử dụng

Copy template này thành file riêng cho mỗi slice:

```
docs/evidence/TENANT-T01-YYYYMMDD.md
docs/evidence/TENANT-T02-YYYYMMDD.md
...
docs/evidence/TENANT-T11-YYYYMMDD.md
```

Điền đầy đủ mọi section. Không để section trống khi đánh dấu DONE.

---

## Template: Per-Slice Evidence

---

# Slice Execution Evidence: TENANT-T[XX]

**Slice ID**: TENANT-T[XX]
**Title**: [Tên slice]
**Date Executed**: YYYY-MM-DD
**Executed By**: [Tên/alias]
**Branch**: `tenant/T[XX]-[slug]`
**Commit Hash**: [git commit hash ngắn]

---

## 1. Files Changed

| File | Change Type | Lines Changed | Notes |
|---|---|---|---|
| `path/to/file.py` | MODIFY / CREATE / DELETE | ~N lines | Brief note |
| ... | | | |

---

## 2. Command Validation Output

### 2.1 Django System Check

```
$ python manage.py check
# Paste output here
# Expected: System check identified no issues (0 silenced).
```

**PASS / FAIL**: ___

### 2.2 Targeted Test Suite

```
$ python manage.py test [app].tests.[test_module] --keepdb
# Paste full output including test counts
```

**Test count**: ___
**PASS / FAIL**: ___

### 2.3 SSOT / SQL Regression Check (T01–T02 only)

```
$ grep -r "class CoreTenant" backend/portfolio/
# Expected: 0 results

$ grep "identity_access_coretenant" backend/core_pat_auth.py
# Expected: 0 results
```

**PASS / FAIL**: ___

### 2.4 Core Regression Suite

```
$ python manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
$ python manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
$ python manage.py test portfolio.tests.test_order_flow --keepdb
# Paste output
```

**PASS / FAIL**: ___

---

## 3. Functional Verification

### 3.1 Test Cases từ IMPLEMENTATION_PLAN

| # | Test Case | Expected | Actual | PASS/FAIL |
|---|---|---|---|---|
| 1 | [test case description] | [expected] | [actual] | — |
| 2 | ... | | | |
| ... | | | | |

### 3.2 Manual Verification (nếu có)

| Scenario | Steps | Result |
|---|---|---|
| [e.g. PAT smoke test] | [steps] | [result] |

---

## 4. API Payload Snapshot (nếu slice chạm contract)

### 4.1 Request

```http
POST /api/core/v1/operator/tenants/{id}/suspend/
Authorization: Bearer [token]
Content-Type: application/json

{
  "reason": "test suspension"
}
```

### 4.2 Response

```json
{
  "tenant_id": "...",
  "status": "suspended",
  "event_id": "..."
}
```

**HTTP Status**: 200 / 201 / 204 / 403 / 404 / 409 / 429

---

## 5. Screenshot / Video (UI slices only)

*Paste screenshot link or embed image here. Bắt buộc với T07 (operator UI) và T08 (onboarding form).*

---

## 6. Migration Evidence (migration slices: T06, T09, T10)

```
$ python manage.py showmigrations [app]
# Paste output — verify latest migration is applied
```

```
$ python manage.py migrate --run-syncdb 2>&1 | tail -5
# Expected: No migrations to apply. hoặc Applying [migration]... OK
```

---

## 7. Module Tree Update (nếu có new app hoặc model)

- [ ] `module_tree_full.md` đã được regenerate
- Commit hash sau khi update module_tree: ___

---

## 8. Post-Slice Document Updates

- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` — đã thêm entry
- [ ] `PROGRESS_DASHBOARD.md` — status slice updated
- [ ] `TASKBOARD_TENANT_UPGRADE_20260512.md` — slice status = done
- [ ] Push commit to `origin/dev`

---

## 9. Residual Risk Notes

| Risk | Severity | Mitigation / Next Action |
|---|---|---|
| [e.g. queryset.update() không trigger signal] | Low | Documented limitation; lifecycle tasks dùng instance.save() |
| [other] | | |

---

## 10. Sign-Off

**Self-review by**: [Tên]
**Date**: YYYY-MM-DD
**Status**: DONE / BLOCKED / IN-REVIEW

---

---

# Ví dụ điền sẵn: TENANT-T03

---

# Slice Execution Evidence: TENANT-T03

**Slice ID**: TENANT-T03
**Title**: IsTenantActive permission class
**Date Executed**: 2026-05-XX
**Branch**: `tenant/T03-tenant-active-perm`

---

## 1. Files Changed

| File | Change Type | Lines Changed | Notes |
|---|---|---|---|
| `packages/core/backend/src/identity_access/permissions.py` | MODIFY | +45 lines | Added IsTenantActive class |
| `packages/core/backend/src/vninvest_core/settings.py` | MODIFY | +1 line | Added to DEFAULT_PERMISSION_CLASSES |

---

## 2. Command Validation Output

### 2.1 Django System Check

```
$ python manage.py check
System check identified no issues (0 silenced).
```

**PASS**

### 2.2 Targeted Test Suite

```
$ python manage.py test identity_access.tests.test_permissions --keepdb
...
Ran 5 tests in 0.123s
OK
```

**PASS**

---

## 3. Functional Verification

| # | Test Case | Expected | Actual | PASS/FAIL |
|---|---|---|---|---|
| 1 | suspended tenant → 403 | HTTP 403 | HTTP 403 | PASS |
| 2 | active tenant → 200 | HTTP 200 | HTTP 200 | PASS |
| 3 | deprovisioned → 403 | HTTP 403 | HTTP 403 | PASS |
| 4 | superuser + suspended → 200 | HTTP 200 | HTTP 200 | PASS |
| 5 | AllowAny endpoint + suspended → 200 | HTTP 200 | HTTP 200 | PASS |

---

## 9. Residual Risk Notes

| Risk | Severity | Mitigation |
|---|---|---|
| Tenant lookup adds 1 DB query per request | Low | Use `.only('status')` minimizes data transfer; acceptable overhead |
