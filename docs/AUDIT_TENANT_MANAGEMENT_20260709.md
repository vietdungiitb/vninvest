# AUDIT_TENANT_MANAGEMENT_20260709

## 1. Scope
Audit tính năng **tenant management** dựa trên các file đã review trong repo:
- `packages/core/backend/src/identity_access/models.py`
- `packages/core/backend/src/tenant_lifecycle/models.py`
- `packages/core/backend/src/identity_access/middleware.py`

> Ghi chú: Các kết luận về “bypass tenant thật sự” cần thêm review ở permission/view/service layer (chưa đọc toàn bộ).

---

## 2. Architecture snapshot (nhìn từ code)
### Tenant entities
- `CoreTenant`: tenant public id (`public_id`), owner (`owner_user`), plan/status, quota fields…
- `TenantMember`: membership user↔tenant, role.
- `TenantInvite`: invite token, role, expiry…

### Credential / auth
- `CoreServiceAccount` → `CorePATCredential` (PAT secret không lưu thẳng, lưu `token_secret_hash` bằng HMAC + lookup theo prefix).

### Request scoping
- `TenantResolutionMiddleware`:
  - Exempt một số path.
  - Nếu authenticated user (session) hoặc PAT → resolve user/tenant.
  - Ưu tiên header `X-Tenant-ID` (nếu có) để resolve tenant và validate membership.
  - Gán `request.tenant` và `request.tenant_role`.

- `TenantQuotaMiddleware`:
  - Exempt các path tương tự.
  - Nếu không superuser thì metering quota theo tenant (từ `request.tenant` hoặc resolve fallback).

---

## 3. Findings

### [CRITICAL] Bug: `CorePATCredential.mark_rotating` bị định nghĩa 2 lần
**File:** `packages/core/backend/src/identity_access/models.py`

- Có 2 method cùng tên `mark_rotating` trong `CorePATCredential`.
- Python sẽ ghi đè method trước bởi method sau → hành vi khi gọi có thể sai signature/behavior.
- Risk:
  - rotate PAT không đúng logic (revoke/grace/expires_at/audit_reason)
  - gây lỗi runtime nếu call theo signature method bị ghi đè

**Recommendation**
- Xoá 1 method trùng.
- Chuẩn hoá signature & logic chỉ còn 1 implementation.
- Thêm unit tests cho rotate edge cases:
  - `grace_period_seconds=0`
  - `reason` keyword/positional
  - `expires_at` nhỏ hơn grace_until

---

### [CRITICAL] Security design: cho phép `X-Tenant-ID` override trong PAT-auth flow
**File:** `packages/core/backend/src/identity_access/middleware.py`

- `_get_user_from_pat()` resolve owner tenant từ PAT secret.
- Tuy nhiên `_resolve_tenant()` sẽ **ưu tiên `X-Tenant-ID` header** nếu header tồn tại, và chỉ validate “user thuộc tenant đó”.
- Risk dạng thiết kế:
  - Với PAT-auth, tenant ngữ cảnh được quyết định từ PAT nhưng vẫn cho phép override bằng header.
  - Nếu về sau có endpoint/service/permission **không dùng `request.tenant`** triệt để, có thể dẫn tới tenant confusion/bypass.

**Recommendation (fail-closed)**
- Khi request xác thực bằng PAT:
  - **cấm dùng `X-Tenant-ID` override**, hoặc
  - bắt buộc match tenant từ PAT với tenant từ header (nếu lệch → 403).
- Chuẩn hoá rule trong middleware và test cho các endpoint nhạy.

---

### [HIGH] Tenant isolation phụ thuộc view/permission layer “lọc theo request.tenant”
**File:** `identity_access/middleware.py` (context exist), nhưng **chưa đủ bằng chứng** ở permission/view/service layer trong audit hiện tại.

- Middleware gán `request.tenant`, nhưng nếu bất kỳ endpoint nào:
  - dùng tenant_id từ request body/query,
  - hoặc query DB không filter theo `request.tenant`,
  - hoặc allow cross-tenant access qua serializer
→ sẽ tạo lỗ hổng data isolation.

**Recommendation**
- Rà soát toàn bộ `identity_access/permissions.py` và các `views_*` liên quan tenant:
  - assert mọi queryset đều filter theo `tenant=request.tenant`
  - assert mọi “object lookup by id” đều kèm điều kiện tenant ownership

---

### [HIGH] Exempt path whitelist có thể gây bypass scoping/quota ngoài ý muốn
**File:** `TenantResolutionMiddleware.EXEMPT_PATH_PREFIXES` và `TenantQuotaMiddleware.QUOTA_EXEMPT_PATH_PREFIXES`

- Exempt gồm: `/admin/`, `/api/core/v1/auth/`, `/api/public/`, `/core/v1/schema/*`, `/static/`, `/health`...
- Nếu endpoint chứa dữ liệu theo tenant nằm trong whitelist này:
  - không có `request.tenant` context
  - không có quota metering

**Recommendation**
- Audit URL mapping:
  - xác định endpoint nào exempt
  - đảm bảo endpoint exempt **không trả data theo tenant**, hoặc có scoping riêng

---

### [MEDIUM] `TenantInvite` thiếu unique/constraint nghiệp vụ → spam invites / inconsistent state
**File:** `identity_access/models.py`

- `TenantInvite` chỉ unique `token`.
- Không có `unique_together` cho `(tenant, invited_email, status)`.

**Recommendation**
- Thêm constraint hoặc service rule:
  - tối thiểu: unique pending invite theo `(tenant, invited_email, status=PENDING)`
  - hoặc limit mỗi email/tenant trong thời gian X

---

### [MEDIUM] Quota metering phụ thuộc cache backend atomic semantics
**File:** `identity_access/middleware.py`

- Dùng `cache.add()` và `cache.incr()`.
- Nếu cache backend không hỗ trợ tương thích Redis atomic increment:
  - quota sai
  - hoặc runtime lỗi cạnh tranh

**Recommendation**
- Xác nhận cache backend là Redis / hỗ trợ `incr` đúng.
- Thêm test concurrency quota nếu có điều kiện.

---

### [LOW/MEDIUM] Audit integrity: `TenantLifecycleEvent.actor_user` không ràng buộc thuộc tenant
**File:** `tenant_lifecycle/models.py`

- `actor_user` là FK User null.
- Không đảm bảo actor thuộc tenant tương ứng event.

**Recommendation**
- Validate actor tenant ở service khi tạo event
- Nếu cần chặt hơn: thêm trường actor_tenant hoặc enforce business rule.

---

## 4. Impact summary
- **High risk security**: override `X-Tenant-ID` trong PAT-auth flow (tenant confusion potential).
- **Guaranteed functional bug**: duplicate `mark_rotating` method gây lỗi rotate semantics.
- **Probable data isolation risk**: cần xác nhận ở permission/view/service layer.

---

## 5. Recommendation checklist (next review)
Để chốt “bypass tenant có thật hay không”, cần đọc thêm:
- `packages/core/backend/src/identity_access/permissions.py`
- `packages/core/backend/src/identity_access/security.py`
- `packages/core/backend/src/identity_access/security_utils.py`
- `packages/core/backend/src/identity_access/views_tenant.py`
- `packages/core/backend/src/identity_access/tenant_member_views.py`
- `packages/core/backend/src/identity_access/views_auth.py`
- `packages/core/backend/src/identity_access/views_webhooks.py`
- các nơi tạo/resolve tenant trong `tasks.py`, `signals.py`

---

## 6. Conclusion
Audit hiện tại xác định:
1) Có **bug chắc chắn** (duplicate `mark_rotating`).
2) Có **security design gap** (PAT-auth vẫn cho phép `X-Tenant-ID` override).
3) Có **nguy cơ tenant isolation** phụ thuộc view/permission scoping (chưa xác minh đầy đủ).
