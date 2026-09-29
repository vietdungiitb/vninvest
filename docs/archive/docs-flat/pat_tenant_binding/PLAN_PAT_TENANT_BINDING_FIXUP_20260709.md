# PLAN: PAT Tenant Binding — Fixup & Completion
**Ngày:** 2026-07-09  
**Dựa trên:** Phân tích `docs/PLAN_PAT_TENANT_BINDING_20260709.md` + review code thực tế

---

## Trạng thái hiện tại (từ code)

Phase 1–3 trong plan gốc **đã xong**. Còn lại 5 vấn đề chưa được xử lý:

| # | Vấn đề | Severity | File / Dòng |
|---|---|---|---|
| 1 | `_assert_pat_tenant_match` fail-open khi `request.tenant is None` | **HIGH** | `permissions.py:47` |
| 2 | Double PAT DB query: middleware + DRF auth resolve độc lập | **MEDIUM** | `authentication.py:32` + `middleware.py:113` |
| 3 | Thiếu P1 security tests (webhook/member/invite cross-tenant) | **MEDIUM** | `tests/test_pat_tenant_binding.py` |
| 4 | Docstring sai về Celery trong `_assert_pat_tenant_match` | LOW | `permissions.py:51` |
| 5 | Phase 4 monitoring chưa implement | LOW | `middleware.py` |

> **Lưu ý:** Rủi ro `is_human_session` bypass qua API **KHÔNG phải lỗi thật**. `partner_issue_pat` và `issue_pat` đều hardcode `is_human_session=False` (không truyền parameter). `_reject_human_session_markers` block label/audit_reason markers. Rủi ro được mitigate ở API layer.

---

## Slice 1 — HIGH: Fix fail-open trong `_assert_pat_tenant_match`

**File:** `packages/core/backend/src/identity_access/permissions.py`

### Vấn đề

```python
# permissions.py:47 — hiện tại
def _assert_pat_tenant_match(request, credential: CorePATCredential) -> None:
    request_tenant = getattr(request, 'tenant', None)
    if request_tenant is None:
        return  # ← FAIL-OPEN: nếu middleware skip/fail → request đi qua mà không bị chặn
```

Nếu `TenantResolutionMiddleware` bị skip hoặc raise exception trước khi set `request.tenant`, permission check này **im lặng cho qua** thay vì từ chối.

### Fix

```python
import logging
logger = logging.getLogger(__name__)

def _assert_pat_tenant_match(request, credential: CorePATCredential) -> None:
    """Raise PermissionDenied nếu machine PAT tenant không khớp request.tenant.

    Defense-in-depth: primary check là TenantResolutionMiddleware.
    Check này bảo vệ thêm cho:
    - Test suites mock hoặc skip TenantResolutionMiddleware
    - Future refactors thay đổi middleware ordering
    - Middleware error conditions không set request.tenant

    Note: Celery tasks và management commands không đi qua HTTP view layer,
    nên check này không áp dụng cho các context đó.
    """
    request_tenant = getattr(request, 'tenant', None)
    if request_tenant is None:
        # request.tenant phải được set bởi TenantResolutionMiddleware.
        # Nếu None tại đây → middleware bị skip hoặc lỗi.
        # Fail closed: deny thay vì allow ngầm.
        logger.warning(
            'pat_tenant_check_no_context: request.tenant=None khi validate '
            'machine PAT prefix=%s. Denying (fail-closed).',
            getattr(credential, 'token_prefix', '?'),
        )
        raise PermissionDenied('Không thể xác định tenant context cho request này.')
    pat_tenant = credential.service_account.tenant
    if str(pat_tenant.public_id) != str(request_tenant.public_id):
        raise PermissionDenied('Token không được phép truy cập tenant này.')
```

### Test mới (thêm vào `tests/test_pat_tenant_binding.py` — class `PATScopeTenantIsolationTests`)

```python
def test_assert_pat_tenant_match_raises_when_request_tenant_missing(self):
    """_assert_pat_tenant_match raises PermissionDenied khi request.tenant=None (fail-closed)."""
    from identity_access.permissions import _assert_pat_tenant_match
    request = self.factory.get('/')
    request.auth = self.pat_a
    # Không set request.tenant — simulate middleware bị bypass
    with self.assertRaises(PermissionDenied) as ctx:
        _assert_pat_tenant_match(request, self.pat_a)
    self.assertIn('tenant context', str(ctx.exception.detail).lower())
```

**DoD:** pytest pass, không còn silent return khi `request.tenant is None`.

---

## Slice 2 — MEDIUM: Eliminate double PAT DB query

**Files:** `packages/core/backend/src/identity_access/authentication.py`

### Vấn đề

Mỗi PAT request hiện tại thực hiện **2 lần SELECT** trên `CorePATCredential`:

1. `middleware._get_user_from_pat()` → `CorePATCredential.resolve_from_raw_secret(raw)` → set `request._pat_credential`
2. `CorePATAuthentication.authenticate()` → lại gọi `CorePATCredential.resolve_from_raw_secret(raw)` → set `request.auth`

Hai object là độc lập nhau dù cùng DB row.

### Fix

`token_prefix` = 12 ký tự đầu của raw_secret (xem `models.py:_extract_pat_prefix`).

```python
# authentication.py — trong hàm authenticate()
def authenticate(self, request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '').strip()
    if not auth_header or not auth_header.startswith(f'{self.keyword} '):
        return None

    raw_secret = auth_header[len(self.keyword) + 1:].strip()
    if not raw_secret:
        return None

    # Reuse credential đã resolved bởi TenantResolutionMiddleware
    # để tránh SELECT thứ 2 cho cùng token trong cùng request lifecycle.
    # Verify prefix match (12 chars) để đảm bảo đúng token.
    cached_credential = getattr(request, '_pat_credential', None)
    if (
        cached_credential is not None
        and str(getattr(cached_credential, 'token_prefix', ''))[:12] == raw_secret[:12]
    ):
        credential = cached_credential
    else:
        credential = CorePATCredential.resolve_from_raw_secret(raw_secret)

    if credential is None:
        raise AuthenticationFailed('Invalid or revoked PAT.')

    # ... phần còn lại của hàm giữ nguyên (status check, CIDR check, return)
```

### Test mới (thêm vào `tests/test_pat_tenant_binding.py`)

```python
def test_drf_auth_reuses_middleware_credential_avoids_double_query(self):
    """DRF auth reuses request._pat_credential nếu prefix match — không gọi DB lần 2."""
    from identity_access.authentication import CorePATAuthentication
    from unittest.mock import patch

    pat, raw_token = self._create_machine_pat(self.tenant1)
    request = self.factory.get('/')
    request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
    request._pat_credential = pat  # Simulate đã set bởi middleware

    auth_backend = CorePATAuthentication()
    with patch.object(CorePATCredential, 'resolve_from_raw_secret') as mock_resolve:
        user, cred = auth_backend.authenticate(request)
        mock_resolve.assert_not_called()
    self.assertEqual(cred, pat)

def test_drf_auth_falls_back_to_db_when_credential_not_cached(self):
    """DRF auth gọi DB khi request._pat_credential chưa được set."""
    from identity_access.authentication import CorePATAuthentication

    pat, raw_token = self._create_machine_pat(self.tenant1)
    request = self.factory.get('/')
    request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
    # Không set request._pat_credential

    auth_backend = CorePATAuthentication()
    user, cred = auth_backend.authenticate(request)
    self.assertEqual(cred.pk, pat.pk)
```

**DoD:** Test pass với mock chứng minh không gọi `resolve_from_raw_secret` lần 2 khi credential đã cached.

---

## Slice 3 — MEDIUM: Thêm P1 security tests còn thiếu

**File:** `packages/core/backend/src/identity_access/tests/test_pat_tenant_binding.py`

Thêm vào cuối class `PATScopeTenantIsolationTests` một helper và 4 tests:

```python
# --- Helper ---

def _assert_middleware_blocks_cross_tenant(self, path, method='get'):
    """Assert middleware trả 403 pat_tenant_mismatch khi PAT T_A cố truy cập T_B."""
    from identity_access.middleware import TenantResolutionMiddleware
    mw = TenantResolutionMiddleware(get_response=lambda r: JsonResponse({'status': 'ok'}))
    factory_method = getattr(self.factory, method)
    request = factory_method(path)
    request.META['HTTP_X_TENANT_ID'] = str(self.tenant_b.public_id)
    request.META['HTTP_AUTHORIZATION'] = f'Bearer {self.pat_a_token}'
    request.user = self.owner_a
    response = mw(request)
    self.assertEqual(response.status_code, 403,
        msg=f'Expected 403 for {method.upper()} {path} with cross-tenant PAT')
    self.assertEqual(_parse_json_response(response)['error'], 'pat_tenant_mismatch')

# --- Security tests ---

def test_machine_pat_t1_cannot_access_webhooks_in_t2(self):
    """PAT T_A với manage_tenant scope không được list webhooks của T_B."""
    self._assert_middleware_blocks_cross_tenant('/api/core/v1/partner/webhooks/')

def test_machine_pat_t1_cannot_list_members_in_t2(self):
    """PAT T_A với manage_tenant scope không được list members của T_B."""
    self._assert_middleware_blocks_cross_tenant('/api/core/v1/partner/tenant/members/')

def test_machine_pat_t1_cannot_invite_user_into_t2(self):
    """PAT T_A với manage_tenant scope không được invite user vào T_B."""
    self._assert_middleware_blocks_cross_tenant('/api/core/v1/partner/tenant/invite/', method='post')

def test_machine_pat_t1_cannot_issue_pat_for_t2(self):
    """PAT T_A không được issue PAT mới trong context T_B."""
    self._assert_middleware_blocks_cross_tenant('/api/core/v1/partner/pats/', method='post')
```

**DoD:** 4 tests mới pass, coverage cho P1 security scenarios đầy đủ.

---

## Slice 4 — LOW: Sửa docstring sai (Celery rationale)

**File:** `packages/core/backend/src/identity_access/permissions.py`

Thay docstring hiện tại của `_assert_pat_tenant_match`:

```python
# TRƯỚC (sai)
"""
...
This secondary check protects against:
- Code paths that bypass middleware (Celery tasks, management commands)
- Test suites that mock middleware
- Future refactors that change middleware ordering
"""

# SAU (đúng)
"""
...
This secondary check protects against:
- Test suites that mock hoặc skip TenantResolutionMiddleware
- Future refactors that change middleware ordering
- Middleware error conditions that allow through without setting request.tenant

Note: Celery tasks và management commands không đi qua HTTP view layer,
nên check này không áp dụng cho các context đó.
"""
```

---

## Slice 5 — LOW: Phase 4 monitoring (structured logging)

**File:** `packages/core/backend/src/identity_access/middleware.py`

Thêm logger và log event khi block `pat_tenant_mismatch`. Dùng structured logging thay vì counter riêng để không phụ thuộc infra mới (ELK/Loki/CloudWatch có thể alert từ log pattern này).

```python
import logging
logger = logging.getLogger(__name__)

# Trong hàm __call__, block pat_tenant_mismatch (dòng ~75):
if str(pat_tenant.public_id) != str(tenant.public_id):
    logger.warning(
        'pat_tenant_mismatch: prefix=%s attempted_tenant=%s '
        'credential_tenant=%s path=%s method=%s',
        getattr(pat_credential, 'token_prefix', '?'),
        str(tenant.public_id),
        str(pat_tenant.public_id),
        request.path,
        request.method,
    )
    return JsonResponse(
        {
            'error': 'pat_tenant_mismatch',
            'detail': 'Token không được phép truy cập tenant này.',
        },
        status=403,
    )
```

**DoD:** Log xuất hiện khi chạy test mismatch scenarios.

---

## Thứ tự thực hiện

```
Slice 1 (HIGH)    → pytest → commit "fix: fail-closed assert_pat_tenant_match when request.tenant missing"
      ↓
Slice 2 (MEDIUM)  → pytest → commit "perf: reuse cached PAT credential in DRF auth to avoid double query"
      ↓
Slice 3 (MEDIUM)  → pytest → commit "test: add P1 cross-tenant security tests for webhook/member/invite/pat"
      ↓
Slice 4+5 (LOW)   → pytest → commit "fix: correct docstring and add structured logging for pat_tenant_mismatch"
```

**Lệnh test sau mỗi slice:**

```bash
python -m pytest packages/core/backend/src/identity_access/tests/test_pat_tenant_binding.py -v
python -m pytest packages/core/backend/src/identity_access/tests/test_tenant_resolution_middleware.py -v
```

---

## Files bị thay đổi

| File | Slice | Loại thay đổi | Ước tính |
|---|---|---|---|
| `identity_access/permissions.py` | 1, 4 | Fix fail-open + sửa docstring | +12 dòng |
| `identity_access/authentication.py` | 2 | Reuse cached credential | +8 dòng |
| `identity_access/middleware.py` | 5 | Add structured logging | +8 dòng |
| `tests/test_pat_tenant_binding.py` | 1, 2, 3 | +7 tests mới | +80 dòng |

---

## References

- Plan gốc: `docs/PLAN_PAT_TENANT_BINDING_20260709.md`
- Audit nguồn: `docs/AUDIT_TENANT_MANAGEMENT_20260709.md` (Finding #2)
- Code chính: `packages/core/backend/src/identity_access/`
  - `middleware.py` — `TenantResolutionMiddleware.__call__:69-81`, `_get_user_from_pat:99-135`
  - `permissions.py` — `_assert_pat_tenant_match:47-57`, `require_pat_scopes_or_human_session:33-44`
  - `authentication.py` — `CorePATAuthentication.authenticate:17-63`
  - `models.py` — `_extract_pat_prefix:31-33` (PREFIX_LENGTH = 12)
