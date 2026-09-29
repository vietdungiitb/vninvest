# PLAN: Machine PAT Tenant Binding

## Problem

PAT scope `manage_tenant` không có tenant binding. Machine PAT cấp cho tenant T1 có thể dùng X-Tenant-ID để chuyển context sang tenant T2 (nếu user là member). Scope validation chỉ check string match, không kiểm tra scope đó intended cho tenant nào.

---

## 1. Architecture Decisions

### Quyết định: Middleware-layer enforcement

| Layer | Ưu | Nhược | Quyết định |
|---|---|---|---|
| **Middleware** (TenantResolutionMiddleware) | Single-point, all endpoints, earliest possible | Không có `request.auth` (DRF chưa chạy) | ✅ **Primary** — đã implement |
| **Permission** (`require_pat_scopes_or_human_session`) | Có `request.auth`, defense-in-depth | Chỉ cover 44 call sites, không cover endpoints không dùng scope check | ⚠️ **Secondary** — optional |
| **View decorator** | Explicit, visible | Phải decorate từng view | ❌ Không chọn |

### Lý do chọn Middleware

1. **Pipeline position**: Middleware chạy ở bước 8/10, sau `AuthenticationMiddleware` (7) và trước `TenantQuotaMiddleware` (9) — vị trí lý tưởng để enforce tenant binding trước khi bất kỳ view nào xử lý
2. **Coverage toàn diện**: Tất cả endpoints qua middleware đều được bảo vệ, kể cả endpoints không dùng `require_pat_scopes_or_human_session`
3. **Không cần schema change**: Dùng FK chain PAT → ServiceAccount → Tenant

### Phân biệt human session vs machine PAT

| Loại | is_human_session | Scope check | Tenant binding | Use case |
|---|---|---|---|---|
| Human session PAT | `true` | Bypass | Không bind | UI login, multi-tenant switching |
| Machine PAT | `false` | Enforced | **Bind** | API access, automation |

---

## 2. Current Pipeline State (Đã implement)

### Flow chart

```
Request → TenantResolutionMiddleware
  ├─ Exempt path? → SKIP
  ├─ _get_user_from_pat()
  │   ├─ Resolve credential
  │   ├─ Validate status (ACTIVE/ROTATING)
  │   ├─ Validate service account (ACTIVE)
  │   └─ Set request._pat_credential = credential  ← MỚI
  │
  ├─ _resolve_tenant(request, user)
  │   ├─ X-Tenant-ID header → validate membership
  │   ├─ Owner fallback
  │   └─ Member fallback
  │
  ├─ PAT tenant binding check  ← MỚI
  │   ├─ request._pat_credential exists?
  │   ├─ is_human_session? → SKIP (cho phép đa tenant)
  │   ├─ credential.service_account.tenant == resolved tenant?
  │   │   ├─ Match → ALLOW
  │   │   └─ Mismatch → 403 pat_tenant_mismatch
  │
  ├─ Tenant status check (SUSPENDED/DEPROVISIONED)
  └─ Set request.tenant + request.tenant_role
```

### Changed files

| File | Change | Status |
|---|---|---|
| `middleware.py:124-125` | Store `request._pat_credential` | ✅ Done |
| `middleware.py:69-81` | Machine PAT tenant binding check | ✅ Done |
| `views_webhooks.py:34-42` | Replace `_get_tenant(user)` with `_get_request_tenant(request)` | ✅ Done |
| `views_tenant.py:133-136` | Add staff cross-tenant audit log | ✅ Done |
| `models.py:325-339` | Fix `mark_rotating` — xoá duplicate, update `grace_until` | ✅ Done |
| `models.py:529-534` | Add `TenantInvite` UniqueConstraint | ✅ Done |

---

## 3. Remaining Work

### 3.1 Unit tests — `test_tenant_resolution_middleware.py`

Test patterns hiện tại dùng `RequestFactory` + mock middleware. Cần thêm 4 tests mới:

#### Test 1: Machine PAT + X-Tenant-ID match → 200

```python
def test_machine_pat_with_matching_tenant_header_allows(self):
    """Machine PAT with X-Tenant-ID matching credential's tenant → 200."""
    sa = CoreServiceAccount.objects.create(
        tenant=self.tenant, name='SA', status=CoreServiceAccount.StatusChoices.ACTIVE
    )
    pat, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa, scopes=['manage_tenant'],
        label='Machine PAT', audit_reason='test',
        is_human_session=False,
    )
    request = self._create_request(
        tenant_header=str(self.tenant.public_id),
        auth_header=f'Bearer {raw_token}'
    )
    response = self.middleware(request)
    self.assertEqual(response.status_code, 200)
    self.assertEqual(request.tenant, self.tenant)
```

#### Test 2: Machine PAT + X-Tenant-ID mismatch → 403

```python
def test_machine_pat_with_wrong_tenant_header_blocks(self):
    """Machine PAT with X-Tenant-ID different from credential's tenant → 403."""
    other_tenant = CoreTenant.objects.create(
        public_id='other_tenant', tenant_code='other',
        display_name='Other Tenant', owner_user=self.owner_user,
        status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.FREE,
    )
    TenantMember.objects.create(tenant=other_tenant, user=self.owner_user, role='viewer')

    sa = CoreServiceAccount.objects.create(
        tenant=self.tenant, name='SA', status=CoreServiceAccount.StatusChoices.ACTIVE
    )
    pat, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa, scopes=['manage_tenant'],
        label='Machine PAT', audit_reason='test',
        is_human_session=False,
    )
    request = self._create_request(
        tenant_header=str(other_tenant.public_id),
        auth_header=f'Bearer {raw_token}'
    )
    response = self.middleware(request)
    self.assertEqual(response.status_code, 403)
    self.assertEqual(_parse_json_response(response)['error'], 'pat_tenant_mismatch')
```

#### Test 3: Human session PAT + X-Tenant-ID override → 200

```python
def test_human_session_pat_allows_tenant_switch(self):
    """Human session PAT can still switch tenants via X-Tenant-ID."""
    other_tenant = CoreTenant.objects.create(
        public_id='other_tenant', tenant_code='other',
        display_name='Other Tenant', owner_user=self.owner_user,
        status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.FREE,
    )
    TenantMember.objects.create(tenant=other_tenant, user=self.owner_user, role='admin')

    sa = CoreServiceAccount.objects.create(
        tenant=self.tenant, name='SA', status=CoreServiceAccount.StatusChoices.ACTIVE
    )
    pat, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa, scopes=['manage_tenant'],
        label='login:test', audit_reason='core login',
        is_human_session=True,
    )
    request = self._create_request(
        tenant_header=str(other_tenant.public_id),
        auth_header=f'Bearer {raw_token}'
    )
    response = self.middleware(request)
    self.assertEqual(response.status_code, 200)
    self.assertEqual(request.tenant, other_tenant)
```

#### Test 4: Machine PAT, no X-Tenant-ID → fallback to credential's tenant → 200

```python
def test_machine_pat_without_header_falls_back_to_owner_tenant(self):
    """Machine PAT without X-Tenant-ID → fallback to owner tenant → 200."""
    sa = CoreServiceAccount.objects.create(
        tenant=self.tenant, name='SA', status=CoreServiceAccount.StatusChoices.ACTIVE
    )
    pat, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa, scopes=['manage_tenant'],
        label='Machine PAT', audit_reason='test',
        is_human_session=False,
    )
    request = self._create_request(auth_header=f'Bearer {raw_token}')
    response = self.middleware(request)
    self.assertEqual(response.status_code, 200)
    self.assertEqual(request.tenant, self.tenant)
```

### 3.2 Defense-in-depth: `require_pat_scopes_or_human_session`

Optional secondary check. Thêm tenant context validation vào `permissions.py:35-45`:

```python
def require_pat_scopes_or_human_session(request, *required_scopes: str) -> None:
    auth = getattr(request, 'auth', None)
    if not isinstance(auth, CorePATCredential) or auth.is_human_session:
        return

    # Defense-in-depth: validate machine PAT tenant binding
    _assert_pat_tenant_match(request, auth)

    granted = set(_normalize_scope_codes(auth.scopes))
    missing_scopes = [scope for scope in required_scopes if scope not in granted]
    if missing_scopes:
        raise PermissionDenied(
            'PAT thiếu scope bắt buộc: ' + ', '.join(missing_scopes) + '.'
        )

def _assert_pat_tenant_match(request, credential: CorePATCredential) -> None:
    """Raise PermissionDenied if machine PAT tenant doesn't match request.tenant."""
    request_tenant = getattr(request, 'tenant', None)
    if request_tenant is None:
        return
    pat_tenant = credential.service_account.tenant
    if str(pat_tenant.public_id) != str(request_tenant.public_id):
        raise PermissionDenied('Token không được phép truy cập tenant này.')
```

**Rationale**: Middleware check là primary control. Permission check là defense-in-depth cho trường hợp:
- Code bypasses middleware (Celery tasks, management commands)
- Test suite mock không chạy middleware
- Future refactor thay đổi middleware ordering

**Decision**: Có implement, nhưng không blocking — có thể làm sau middleware check.

### 3.3 Error response format standardization

Middleware hiện tại dùng `{'error': 'code', 'detail': 'msg'}` — khác với DRF `StandardErrorEnvelope`. Cần thống nhất.

**Option A: Đổi middleware sang StandardErrorEnvelope format**

```python
from vninvest_core.exceptions import StandardErrorEnvelope
return JsonResponse(
    StandardErrorEnvelope(
        detail='Token không được phép truy cập tenant này.',
        code='pat_tenant_mismatch',
    ).to_dict(),
    status=403,
)
```

**Option B: Giữ nguyên format (đã tồn tại cho tenant_not_found, tenant_suspended)**

**Decision**: Option B — giữ nguyên format vì:
- Các error code khác của middleware (`tenant_not_found`, `tenant_suspended`, `quota_exceeded`) đều dùng format này
- Frontend đã xử lý format này từ trước
- Format inconsistency là pre-existing issue, không thuộc scope của task này

### 3.4 Integration tests với view layer

Test full stack: middleware + DRF auth + permission → response.

```python
class MachinePATTenantBindingIntegrationTests(TestCase):
    def test_machine_pat_wrong_tenant_cannot_access_partner_endpoint(self):
        """Machine PAT for T1 cannot access /partner/tenant/ when X-Tenant-ID=T2."""
        # Setup 2 tenants, PAT for T1
        # GET /core/v1/partner/tenant/ with X-Tenant-ID=T2
        # Expect 403
```

---

## 4. Testing Strategy

### Unit tests (middleware layer)

| Test | Expected | Priority |
|---|---|---|
| Machine PAT + matching X-Tenant-ID | 200 | P0 |
| Machine PAT + wrong X-Tenant-ID | 403 `pat_tenant_mismatch` | P0 |
| Human PAT + wrong X-Tenant-ID | 200 (đa tenant vẫn hoạt động) | P0 |
| Machine PAT, no header | 200, fallback to credential tenant | P0 |
| Machine PAT + superuser | 200 (superuser bypass middleware) | P1 |
| Machine PAT + exempt path | 200 (bypass middleware) | P1 |

### Integration tests (view layer)

| Test | Expected | Priority |
|---|---|---|
| PAT scope validation with tenant context | Scope check pass/fail đúng tenant | P1 |
| partner_rotate_pat cross-tenant | 403 | P1 |
| partner_issue_pat cross-tenant | 403 | P1 |

### Security tests

| Test | Expected | Priority |
|---|---|---|
| PAT from T1 with `manage_tenant` scope cannot create webhooks in T2 | 403 | P1 |
| PAT from T1 with `manage_tenant` scope cannot list members in T2 | 403 | P1 |
| PAT from T1 with `manage_tenant` scope cannot invite users in T2 | 403 | P1 |

---

## 5. Rollout Plan

### Phase 1: Middleware check (Đã xong)
- `middleware.py:69-81` — machine PAT tenant binding
- `middleware.py:124-125` — store credential

### Phase 2: Tests (Đã xong)
- 4 unit tests cho middleware layer (`test_tenant_resolution_middleware.py`)
- 6 integration tests + 4 security tests (`test_pat_tenant_binding.py`)

### Phase 3: Defense-in-depth (Đã xong)
- `permissions.py:40-65` — secondary check trong `require_pat_scopes_or_human_session`
- `_assert_pat_tenant_match` — validate tenant context tại permission layer

### Phase 4: Monitoring
- Add metric counter cho `pat_tenant_mismatch` errors
- Monitor xem có false positives không (legit use cases bị chặn)

---

## 6. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Break existing machine PATs that legitimately switch tenants | Medium | Low (machine PATs are scoped to one tenant by design) | Human sessions unaffected; monitor logs |
| False positives from middleware ordering change | High | Low | Integration tests cover full stack |
| Frontend không handle `pat_tenant_mismatch` error code | Medium | Low (frontend handles 403 generically) | Add to error code registry if exists |

---

## 7. File Change Summary

| File | What | Status | Lines |
|---|---|---|---|
| `middleware.py` | Store credential + tenant binding check | ✅ Done | +17 lines |
| `permissions.py` | Defense-in-depth `_assert_pat_tenant_match` | ✅ Done | +15 lines |
| `test_tenant_resolution_middleware.py` | Add 4 unit tests | ✅ Done | +120 lines |
| `test_pat_tenant_binding.py` | Integration + security tests | ✅ Done | +200 lines |
| `views_webhooks.py` | Replace `_get_tenant(user)` | ✅ Done | +10/-5 lines |
| `views_tenant.py` | Staff audit logging | ✅ Done | +7 lines |
| `models.py` | Fix mark_rotating + TenantInvite constraint | ✅ Done | +10/-10 lines |

---

## 8. References

- Audit report: `docs/AUDIT_TENANT_MANAGEMENT_20260709.md` (Finding #2)
- Audit update: `docs/AUDIT_TENANT_MANAGEMENT_20260709_UPDATE.md` (Finding #2, #10)
- Middleware flow: `packages/core/backend/src/identity_access/middleware.py` (lines 39-94)
- Scope validation: `packages/core/backend/src/identity_access/permissions.py` (lines 35-45)
- PAT authentication: `packages/core/backend/src/identity_access/authentication.py` (lines 10-59)
