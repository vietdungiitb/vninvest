# AUDIT_TENANT_MANAGEMENT_20260709 — Cập nhật sau deep review

Đã review 9 files bổ sung:
- `permissions.py`, `security.py`, `security_utils.py`
- `views_tenant.py`, `tenant_member_views.py`, `views_auth.py`, `views_webhooks.py`
- `views/login.py`, `views/profile.py`, `views/helpers.py`
- `tasks.py`, `signals.py`
- `models.py` (cross-check), `middleware.py` (cross-check)
- `tenant_lifecycle/models.py`

---

## 1. [CRITICAL] Bug: `CorePATCredential.mark_rotating` định nghĩa 2 lần — **CONFIRMED + mở rộng**

**models.py:312** — method đầu (`grace_period_seconds` positional, updates `grace_until`)
**models.py:333** — method thứ hai (`*` keyword-only, updates `expires_at` thay vì `grace_until`)

Python ghi đè method đầu bởi method sau → method đầu là dead code. **Nhưng có semantic khác biệt quan trọng:**

| Thuộc tính | Method 1 (line 312, dead) | Method 2 (line 333, active) |
|---|---|---|
| `grace_until` | ✅ Được set | ❌ **KHÔNG được set** |
| `expires_at` | ❌ Không chạm | ✅ **Bị set = grace_until** |
| `grace_seconds=0` | Cập nhật với grace 0 | **Revoke PAT** + return None |
| `expires_at < grace_until` | Không check | **Cắt grace_until** = expires_at |

**Tác động:**
- `grace_until` field trên DB sẽ luôn là `null` sau rotate (vì method 2 không update nó)
- `expires_at` bị repurpose thành `grace_until` → token cũ bị rút ngắn expires_at
- `partner_rotate_pat` ở `views_tenant.py:444` gọi với keyword-args → dùng đúng method 2

**Khuyến nghị:**
- Xoá method đầu (line 312-318)
- Quyết định: dùng `grace_until` hay `expires_at` cho grace period tracking
- Thêm unit test edge cases: `grace_period_seconds=0`, `expires_at` < `grace_until`

---

## 2. [CRITICAL] Security design: X-Tenant-ID override trong PAT-auth — **CONFIRMED + phát hiện mới**

### Cơ chế:
1. `middleware.py:_get_user_from_pat()` — resolve user U (owner của tenant T1)
2. `middleware.py:_resolve_tenant()` — ưu tiên X-Tenant-ID header → `_resolve_by_header` kiểm tra U có phải owner/member của tenant T2 không
3. Nếu U là member của T2 → `request.tenant = T2`

**Rủi ro cốt lõi: PAT scope không được tenant-scoped.**
- PAT cấp scope `manage_tenant` cho service account ở T1
- User cũng là member của T2
- User gửi `X-Tenant-ID: T2` → `request.tenant = T2`
- Scope `manage_tenant` không bị ràng buộc với tenant nào → cho phép thao tác ở T2

### Views đã kiểm tra:

| View | Dùng `request.tenant`? | Tenant-safe? |
|---|---|---|
| `views_tenant.py:*` | ✅ `_get_request_tenant()` | ✅ OK |
| `tenant_member_views.py:*` | ✅ `_get_request_tenant()` | ✅ OK |
| `views_webhooks.py:*` | ❌ **`_get_tenant(user)` bypass** | ⚠️ Xem #3 |
| `views/login.py` | N/A (auth flow) | ✅ OK |
| `views/profile.py` | `user.core_tenant` (correct) | ✅ OK |

### ✅ Kết luận: views_tenant.py và tenant_member_views.py scoping an toàn
### ❌ views_webhooks.py bypass request.tenant (xem #3)

---

## 3. [HIGH] `views_webhooks.py` bypass `request.tenant` — **NEW**

**File:** `views_webhooks.py:34-35`
```python
def _get_tenant(user):
    return CoreTenant.objects.get(owner_user=user)  # Hardcode owner-only!
```

Tất cả webhook views dùng `_get_tenant(request.user)` thay vì `request.tenant`. Hậu quả:
- **Chỉ tenant owner** mới quản lý được webhook (members không được)
- **Bỏ qua middleware tenant context**: nếu middleware resolve tenant T2 (vì user là member), webhook views vẫn dùng T1 (vì user là owner của T1)
- Không tạo data leak (vì `_get_tenant` restrictive hơn), nhưng tạo behavior inconsistency

**Khuyến nghị:**
- Đổi `_get_tenant` thành dùng `request.tenant` (như `views_tenant.py`)
- Kiểm tra role permission (owner/admin) sau khi resolve

---

## 4. [HIGH] Tenant isolation ở view/permission layer — **KẾT LUẬN SAU REVIEW**

| Layer | Kết quả |
|---|---|
| `permissions.py` | ✅ `IsTenantActive` chỉ check tenant status, không filter data |
| `views_tenant.py` | ✅ **Mọi queryset đều filter** `filter(tenant=tenant)` hoặc `service_account__tenant=tenant` |
| `tenant_member_views.py` | ✅ **Mọi queryset đều filter** `filter(tenant=tenant)` |
| `views_webhooks.py` | ❌ **Bypass request.tenant** — dùng `_get_tenant(user)` (owner-only) |
| `views/login.py` | ✅ Auth flow không cần tenant scoping |
| `views/profile.py` | ✅ Chỉ đọc user's own tenant(s) |
| `signals.py` | ✅ Dùng instance tenant từ model — chính xác |
| `tasks.py` | ✅ Dùng model instance — chính xác |

**Rủi ro thực tế về tenant bypass:** Thấp. Hầu hết views đều filter đúng. `views_webhooks.py` bypass nhưng restrictive hơn, không gây data leak.

---

## 5. [HIGH] Exempt path whitelist — **CONFIRMED, không active exploit**

Đã audit từng path exempt:
- `/admin/`, `/static/`, `/health`, `/core/v1/schema/` — không trả data tenant ✅
- `/api/core/v1/auth/`, `/core/v1/auth/` — auth endpoints tạo/verify token, có truy cập tenant data nhưng qua `user.core_tenant` chứ không qua request.tenant ✅

**Không phát hiện endpoint exempt nào trả data tenant-scoped. An toàn với implementation hiện tại.**

---

## 6. [MEDIUM] `TenantInvite` thiếu unique constraint — **CONFIRMED**

`tenant_member_views.py:148-154` có service-layer check để ngăn duplicate invite. Race condition vẫn có thể xảy ra.

**Khuyến nghị:** Thêm unique constraint DB:
```python
UniqueConstraint(fields=['tenant', 'invited_email'], condition=Q(status='pending'), name='unique_pending_invite')
```

---

## 7. [MEDIUM] Quota metering cache dependency — **CONFIRMED**

Không đổi.

---

## 8. [LOW] `TenantLifecycleEvent.actor_user` không ràng buộc thuộc tenant — **CONFIRMED**

Audit logging, không ảnh hưởng data security.

---

## 9. [MEDIUM] `_get_request_tenant` hot-fix cho staff — **NEW FINDING**

**views_tenant.py:122-132:**
```python
if user.is_staff:
    service_account_id = request.data.get('service_account_id')
    if service_account_id:
        sa = CoreServiceAccount.objects.select_related('tenant').get(public_id=service_account_id)
        tenant = sa.tenant
```

Staff user có thể resolve tenant từ **bất kỳ service_account_id nào** (không cần là member). Đây là admin convenience feature, nhưng tạo ra:
- No audit trail khi staff access cross-tenant
- Nếu attacker có staff access → có thể access bất kỳ tenant nào

**Khuyến nghị:**
- Log audit event khi staff dùng hot-fix để resolve tenant
- Xem xét giới hạn staff tenant access bằng permission policy

---

## 10. [MEDIUM] Token scope không tenant-scoped — **NEW FINDING**

PAT scope check (`require_pat_scopes_or_human_session`) kiểm tra scope string nhưng không kiểm tra tenant context scope đó áp dụng cho tenant nào.

**Impact:**
- PAT issued for T1 with scope `manage_tenant`
- X-Tenant-ID = T2 (user là member của T2)
- Scope check PASS (vì scope string match)
- Action áp dụng lên T2

**Khuyến nghị:**
- Khi issue PAT, gắn tenant_id vào scope record
- Hoặc validate rằng scope operation được thực hiện trong đúng tenant context

---

## Impact summary (updated)

| Level | Finding | Status |
|---|---|---|
| CRITICAL | `mark_rotating` duplicate + semantic mismatch | **Confirmed + mở rộng** |
| CRITICAL | X-Tenant-ID override trong PAT-auth (scope tenant isolation gap) | **Confirmed** |
| HIGH | `views_webhooks.py` bypass `request.tenant` | **NEW** |
| HIGH | Tenant isolation ở view/permission layer | **Confirmed safe** (trừ webhooks) |
| HIGH | Exempt path whitelist | **Confirmed safe** |
| MEDIUM | `_get_request_tenant` hot-fix cho staff có thể bypass membership check | **NEW** |
| MEDIUM | Token scope không tenant-scoped | **NEW** |
| MEDIUM | TenantInvite thiếu unique constraint | **Confirmed** |
| MEDIUM | Quota metering cache atomic dependency | **Confirmed** |
| LOW | `TenantLifecycleEvent.actor_user` không ràng buộc tenant | **Confirmed** |

---

## Kết luận

**So với audit lần trước:**
- Bug `mark_rotating`: thực tế còn nặng hơn — không chỉ duplicate mà còn semantic khác biệt (grace_until vs expires_at)
- Security design gap: confirmed — thêm phát hiện về token scope không tenant-scoped
- Tenant isolation: an toàn cho `views_tenant.py` và `tenant_member_views.py`; **phát hiện mới** `views_webhooks.py` bypass request.tenant
- 2 findings mới: staff hot-fix bypass membership check, token scope không tenant-scoped
