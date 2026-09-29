# Tech Spec - Core API OpenAPI Standardization

Date: 2026-05-13
Status: Approved baseline spec

---

## 1. Scope

Ap dung cho API trong cac domain core:
- identity_access
- market_data
- market_serving
- signal_intelligence
- advisory
- user_workspace
- commercial
- admin_ops

---

## 2. Canonical contract model

### 2.1 Request schema
- Input schema via serializer/schema class.
- Field constraints: type/required/nullable/min/max/pattern/enum.
- Validation errors must return 400 with field_errors.

### 2.2 Response schema
- Structured response object with explicit fields and examples.
- Timestamps in ISO8601.
- Nullability explicitly declared.

### 2.3 Error envelope

```json
{
  "detail": "Human-readable error",
  "code": "error_code_slug",
  "timestamp": "2026-05-13T15:30:00Z",
  "request_id": "req_xxx",
  "field_errors": {
    "field": ["message"]
  }
}
```

---

## 3. HTTP semantics

- 200: read success
- 201: create success
- 204: delete/no body success
- 400: request validation failed
- 401: unauthenticated
- 403: unauthorized
- 404: resource not found
- 409: conflict/state violation
- 429: rate limit exceeded
- 500: internal server error

Forbidden:
- 200 for business errors
- 400 for rate-limit

---

## 4. Mandatory behavior policies

### 4.1 Pagination
- List endpoint requires pagination.
- Must define default_page_size and max_page_size.
- No full unbounded list payload.

### 4.2 Rate limiting
- Auth-sensitive endpoints: IP + user scoped limits.
- Public endpoints: abuse guard.
- Return 429 with standard envelope.

### 4.3 Tenant isolation
- Tenant-scoped query must filter by tenant id.
- Missing/invalid tenant context must fail safely.

### 4.4 Exception handling
- No swallow exceptions.
- Log with request_id and endpoint context.
- Return stable error envelope to client.

---

## 5. Backend design pattern

- View/controller only orchestration.
- Validation in serializer/schema layer.
- Domain business logic in service layer.
- Data access isolated in repository/query helpers.
- Contract snapshot tests for endpoint output.

---

## 6. Frontend design pattern

- All API calls via centralized adapter.
- Runtime response validation where needed for critical flows.
- Unified error parser consuming standard error envelope.
- Feature components must not call fetch directly for core APIs.

---

## 7. Test design

### 7.1 Unit tests (backend)
- Serializer validation matrix.
- Service logic behavior matrix.

### 7.2 API integration tests
- Endpoint happy path.
- Negative auth/permission/tenant/rate-limit cases.
- Response schema contract snapshots.

### 7.3 Frontend integration tests
- Adapter contract tests.
- UI error rendering tests for standardized error envelope.

---

## 8. CI enforcement design

Required checks:
- OpenAPI schema lint.
- Contract-policy checks (status/error/pagination/rate-limit).
- No swallow exception grep/AST checks.
- Required test suites pass.

---

## 9. Migration strategy

- Stage 1: endpoint-by-endpoint conformance patch.
- Stage 2: metadata sync.
- Stage 3: frontend adapter sync.
- Stage 4: enforcement activation.
- Stage 5: cleanup of temporary compatibility layers.

---

## 10. Non-goals

- Khong doi business feature scope ngoai contract normalization.
- Khong optimize architecture lon ngoai cac diem lien quan OpenAPI hard rules.
