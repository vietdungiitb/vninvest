# Backend Spec: Middleware Implementation (Part 1/2)

> **Status:** `PROPOSED` — Chờ Sign-off
> **Phase:** 1 (Foundation)
> **Related:** `01-ARCHITECTURE-DECISIONS.md` (ADR-001, 002, 004), `02-DATA-MIGRATION.md`, `05-CONSTANTS-ENUMS.md`, `07-TEST-SPEC/01-unit-test-cases.md`

---

## 1. TenantResolutionMiddleware

### 1.1. File Location
`core/middleware/tenant_resolution.py`

### 1.2. Class Signature
```python
class TenantResolutionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # Compile regex for UUID validation once
        self.uuid_regex = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

    def __call__(self, request):
        # Logic here
        return self.get_response(request)
```

### 1.3. Header Name Constant
```python
TENANT_HEADER = 'HTTP_X_TENANT_ID'  # Django meta key for 'X-Tenant-ID'
```

### 1.4. Processing Logic (Pseudocode)

```python
def __call__(self, request):
    # 1. Chỉ áp dụng cho API Tenant Admin paths
    if not request.path.startswith('/api/core/v1/partner/'):
        return self.get_response(request)

    # 2. Exception: List tenants endpoint không cần header
    if request.path == '/api/core/v1/partner/tenants/' and request.method == 'GET':
        return self.get_response(request)

    # 3. Lấy tenant_id từ header
    tenant_id_str = request.META.get(TENANT_HEADER)
    if not tenant_id_str:
        return self._error_response(request, 'TENANT_HEADER_MISSING', 'Header X-Tenant-ID is required', 400)

    # 4. Validate UUID format
    if not self.uuid_regex.match(tenant_id_str):
        return self._error_response(request, 'TENANT_ID_INVALID', 'X-Tenant-ID must be a valid UUID', 400)

    tenant_id = UUID(tenant_id_str)

    # 5. Feature Flag check (deployment safety)
    if not getattr(settings, 'TENANT_RESOLUTION_MIDDLEWARE_ENABLED', True):
        # Fallback legacy behavior (optional, for rollback window)
        return self.get_response(request)

    # 6. Fetch Tenant + Membership in ONE query (select_related)
    try:
        tenant = CoreTenant.objects.select_related('owner_user').get(id=tenant_id)
    except CoreTenant.DoesNotExist:
        return self._error_response(request, 'TENANT_NOT_FOUND', 'Tenant not found', 404)

    # 7. Check Tenant Status (Gate)
    if tenant.status != CoreTenant.StatusChoices.ACTIVE:
        code = 'TENANT_SUSPENDED' if tenant.status == 'SUSPENDED' else 'TENANT_DEPROVISIONED'
        msg = 'Tenant is suspended' if tenant.status == 'SUSPENDED' else 'Tenant has been deprovisioned'
        return self._error_response(request, code, msg, 403)

    # 8. Resolve Membership & Role
    # Anonymous user check (should be caught by AuthMiddleware first, but defense in depth)
    if not request.user or not request.user.is_authenticated:
        return self._error_response(request, 'AUTHENTICATION_REQUIRED', 'Authentication required', 401)

    try:
        membership = TenantMember.objects.select_related('user').get(
            tenant=tenant,
            user=request.user,
            status=TenantMember.StatusChoices.ACTIVE
        )
    except TenantMember.DoesNotExist:
        return self._error_response(request, 'MEMBERSHIP_REQUIRED', 'You are not an active member of this tenant', 403)

    # 9. Attach to request
    request.tenant = tenant
    request.tenant_role = membership.role  # String: 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'
    request.tenant_membership = membership  # Full object if needed

    # 10. Structured Logging (JSON)
    logger.info('tenant_resolved', extra={
        'tenant_id': str(tenant.id),
        'user_id': request.user.id,
        'role': membership.role,
        'path': request.path,
        'method': request.method,
    })

    return self.get_response(request)

def _error_response(self, request, code, message, status):
    # Standard error format per 05-CONSTANTS-ENUMS.md
    return JsonResponse({
        'error': {
            'code': code,
            'message': message,
            'request_id': getattr(request, 'id', None),  # If request ID middleware exists
        }
    }, status=status)
```

### 1.5. Settings Integration
```python
# settings/base.py
MIDDLEWARE = [
    # ...
    'django.contrib.auth.middleware.AuthenticationMiddleware',  # MUST be before
    'core.middleware.tenant_resolution.TenantResolutionMiddleware',
    'core.middleware.tenant_quota.TenantQuotaMiddleware',       # MUST be after
    # ...
]

# Feature flag for safe rollout
TENANT_RESOLUTION_MIDDLEWARE_ENABLED = env.bool('TENANT_RESOLUTION_MIDDLEWARE_ENABLED', default=True)
```

### 1.6. Error Codes (Reference `05-CONSTANTS-ENUMS.md`)
| Code | HTTP | Message | When |
|------|------|---------|------|
| `TENANT_HEADER_MISSING` | 400 | Header X-Tenant-ID is required | Header absent |
| `TENANT_ID_INVALID` | 400 | X-Tenant-ID must be a valid UUID | Malformed UUID |
| `TENANT_NOT_FOUND` | 404 | Tenant not found | UUID not in DB |
| `TENANT_SUSPENDED` | 403 | Tenant is suspended | Tenant.status=SUSPENDED |
| `TENANT_DEPROVISIONED` | 403 | Tenant has been deprovisioned | Tenant.status=DEPROVISIONED |
| `AUTHENTICATION_REQUIRED` | 401 | Authentication required | No user / anonymous |
| `MEMBERSHIP_REQUIRED` | 403 | You are not an active member of this tenant | No TenantMember or status!=ACTIVE |

---

## 2. TenantQuotaMiddleware (Part 2 - Next File)

> **See:** `03-BACKEND-SPEC/01-middleware-spec-part2.md` (separate file for quota middleware)

---

## 3. Unit Test Requirements (Reference `07-TEST-SPEC/01-unit-test-cases.md`)

### 3.1. Test Class: `TestTenantResolutionMiddleware`
```python
class TestTenantResolutionMiddleware(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantResolutionMiddleware(lambda r: JsonResponse({'ok': True}))
        self.user = UserFactory()
        self.tenant = CoreTenantFactory(status='ACTIVE')
        TenantMemberFactory(tenant=self.tenant, user=self.user, role='OWNER', status='ACTIVE')

    def _request(self, path, tenant_id=None, user=None):
        req = self.factory.get(path)
        req.user = user or AnonymousUser()
        if tenant_id:
            req.META['HTTP_X_TENANT_ID'] = str(tenant_id)
        # Add session/auth middleware simulation if needed
        return req

    # Test Cases (Must Pass):
    def test_valid_header_resolves_tenant_and_role(self): ...
    def test_missing_header_returns_400(self): ...
    def test_invalid_uuid_returns_400(self): ...
    def test_nonexistent_tenant_returns_404(self): ...
    def test_suspended_tenant_returns_403(self): ...
    def test_deprovisioned_tenant_returns_403(self): ...
    def test_non_member_user_returns_403(self): ...
    def test_inactive_membership_returns_403(self): ...
    def test_anonymous_user_returns_401(self): ...
    def test_tenants_list_endpoint_bypasses_middleware(self): ...
    def test_non_partner_api_paths_bypass_middleware(self): ...
    def test_feature_flag_disabled_bypasses_middleware(self): ...
    def test_request_attributes_set_correctly(self): ...
    def test_structured_logging_emitted(self): ...
```

### 3.2. Test Class: `TestMiddlewareOrder`
```python
class TestMiddlewareOrder(TestCase):
    def test_tenant_resolution_after_auth(self):
        middleware_classes = [m for m in settings.MIDDLEWARE if 'TenantResolution' in m or 'AuthenticationMiddleware' in m]
        auth_idx = middleware_classes.index('django.contrib.auth.middleware.AuthenticationMiddleware')
        tenant_idx = middleware_classes.index('core.middleware.tenant_resolution.TenantResolutionMiddleware')
        self.assertLess(auth_idx, tenant_idx, 'AuthenticationMiddleware must run before TenantResolutionMiddleware')

    def test_tenant_resolution_before_quota(self):
        # Similar check for TenantQuotaMiddleware
        ...
```

---

## 4. Performance Considerations

- **DB Queries:** 1 query (`CoreTenant` + `owner_user`) + 1 query (`TenantMember` + `user`). Total 2 queries per request.
- **Optimization:** Cache `TenantMember` lookup per request? Not needed (request-scoped). Redis cache for tenant status? Only if high traffic on suspended tenants.
- **Index Usage:** `TenantMember` indexes on `(tenant, status)` and `(user, status)` cover the lookup.

---

## 5. Definition of Done (Middleware Spec)

- [ ] `core/middleware/tenant_resolution.py` implemented per spec.
- [ ] Added to `settings.MIDDLEWARE` in correct order.
- [ ] Feature flag `TENANT_RESOLUTION_MIDDLEWARE_ENABLED` added to settings.
- [ ] All unit tests in `TestTenantResolutionMiddleware` pass.
- [ ] `TestMiddlewareOrder` passes in CI.
- [ ] Error response format matches `05-CONSTANTS-ENUMS.md`.
- [ ] Structured logging integrated (JSON format).
- [ ] Code reviewed & approved.