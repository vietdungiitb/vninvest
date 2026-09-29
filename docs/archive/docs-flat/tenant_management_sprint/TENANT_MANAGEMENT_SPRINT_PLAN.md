# Tenant Management Upgrade — Sprint Plan

> **Ngày tạo:** 2026-07-18
> **Tham chiếu:** `docs/TENANT_MANAGEMENT_AUDIT_AND_UPGRADE_PLAN.md` (audit findings)
> **Framework:** AGENTS.md AI Audit/Research Framework (quy định cứng)
> **Mục tiêu:** Chi tiết từng sprint slice, đủ để đội code thực hiện tự động mà không cần hỏi lại

---

## Table of Contents

1. [Quality Gates —通用 (Universal)](#1-quality-gates--通用-universal)
2. [Sprint 1: Fix Critical Bugs & Deduplicate Code](#2-sprint-1-fix-critical-bugs--deduplicate-code)
3. [Sprint 2: Email & Invitation System](#3-sprint-2-email--invitation-system)
4. [Sprint 3: Tenant Settings Page](#4-sprint-3-tenant-settings-page)
5. [Sprint 4: Custom RBAC Roles](#5-sprint-4-custom-rbac-roles)
6. [Sprint 5: Real SAML SSO](#6-sprint-5-real-saml-sso)
7. [Sprint 6: UX Improvements](#7-sprint-6-ux-improvements)
8. [Sprint 7: Data Archival & Compliance](#8-sprint-7-data-archival--compliance)
9. [Sprint 8: Testing & Hardening](#9-sprint-8-testing--hardening)
10. [Auto-Update Protocol](#10-auto-update-protocol)
11. [Ledger Update Template](#11-ledger-update-template)

---

## 1. Quality Gates — 通用 (Universal)

Mọi sprint PHẢI pass tất cả quality gates trước khi merge. Không có exception.

### 1.1 Frontend Quality Gates

```bash
# Bắt buộc sau MỖI sub-step
cd packages/web
npx tsc --noEmit                           # Type-check: 0 errors
npm run lint                               # ESLint: 0 errors (warnings OK)

# Bắt buộc cuối mỗi sprint
npm run build                              # tsc + vite build: PASS
npm run test                               # Jest: all pass
npm run i18n:scan                          # Không có hardcoded strings mới
```

### 1.2 Backend Quality Gates

```bash
# Bắt buộc sau MỖI sub-step
cd packages/core/backend
python manage.py test identity_access --verbosity=2    # Django tests pass
python manage.py test tenant_lifecycle --verbosity=2   # Lifecycle tests pass

# Bắt buộc cuối mỗi sprint
python manage.py test --verbosity=2                    # Toàn bộ tests pass
python manage.py check --deploy                        # Deployment check: 0 CRITICAL
```

### 1.3 Audit Checklist (Mỗi Sprint)

| # | Check | Command | Pass Criteria |
|---|-------|---------|---------------|
| A1 | Type-check | `npx tsc --noEmit` | 0 errors |
| A2 | Lint | `npm run lint` | 0 errors |
| A3 | Build | `npm run build` | PASS |
| A4 | Unit test (FE) | `npm run test` | All pass |
| A5 | Unit test (BE) | `python manage.py test` | All pass |
| A6 | i18n scan | `rg -n '"[A-ZÀ-Ỹ]' packages/web/src/pages/tenant-admin/ -g '*.tsx' -g '*.ts'` (PowerShell: dùng `rg` thay `grep`) | 0 hardcoded VN strings mới |
| A7 | File reference | grep mọi `file:line` trong doc → xác nhận tồn tại | 0 phantom references |
| A8 | Cross-border | Kiểm tra adapter calls giữa web↔core match API contract | 0 contract mismatches |
| A9 | No console.error | Dev server load page → console không có error mới | 0 new errors |
| A10 | Visual regression | Playwright screenshot tests pass | No regressions |

### 1.4 Definition of Done (DoD) — Mỗi Sprint

- [ ] Tất cả sub-steps hoàn thành theo thứ tự
- [ ] Quality gates A1-A10 pass
- [ ] Không có finding mới severity P0/P1 từ self-audit
- [ ] CODE_CHANGE_AUDIT_LEDGER.md đã cập nhật
- [ ] AGENTS.md Progress section đã cập nhật
- [ ] Demo được trên dev server (http://localhost:3000)

---

## 2. Sprint 1: Fix Critical Bugs & Deduplicate Code

**Duration:** 2-3 ngày | **Effort:** ~11.5h | **Priority:** P0

### Mục tiêu
Deduplicate code trùng lặp, fix role enforcement, enforce member limit.

### Sub-steps

#### Step 1.1: Extract `_get_request_tenant()` → shared utility (2h)

**Backend files cần sửa:**

| File | Action |
|------|--------|
| NEW `packages/core/backend/src/identity_access/utils/resolve_tenant.py` | Tạo utility function |
| `packages/core/backend/src/identity_access/views_tenant.py:120` | Xóa `_get_request_tenant`, import từ utils |
| `packages/core/backend/src/identity_access/tenant_member_views.py:31` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_webhooks.py:34` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views/sso.py:20` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_dashboard.py:20` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_security.py:20` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_alert_config.py:15` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_usage.py:23` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_usage_trend.py:18` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_forecast.py:19` | Xóa, import từ utils |

**Spec cho `resolve_tenant.py`:**

```python
def resolve_tenant(request) -> 'CoreTenant':
    """
    Single source of truth for tenant resolution.
    Priority: request.tenant → X-Tenant-ID header → owner match → first TenantMember.
    Staff users can cross-tenant via service_account_id in request.data.
    Raises: PermissionDenied if no tenant found.
    """
```

**Acceptance Criteria:**
- [ ] `resolve_tenant.py` tồn tại và có đúng 1 hàm `resolve_tenant(request)`
- [ ] Tất cả 9 view files import từ utils, không còn local definition
- [ ] `rg "def _get_request_tenant" packages/core/` trả về 1 kết quả duy nhất
- [ ] `python manage.py test identity_access --verbosity=2` PASS
- [ ] `python manage.py test tenant_lifecycle --verbosity=2` PASS

#### Step 1.2: Extract `_require_tenant_role()` → shared utility (1h)

**Backend files cần sửa:**

| File | Action |
|------|--------|
| NEW/MERGE `packages/core/backend/src/identity_access/utils/permissions.py` | Tạo hoặc merge vào resolve_tenant.py |
| `packages/core/backend/src/identity_access/tenant_member_views.py:95` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views_tenant.py:200` | Xóa, import từ utils |
| `packages/core/backend/src/identity_access/views/sso.py:38` | Xóa, import từ utils |

**Spec:**

```python
def require_tenant_role(request, *allowed_roles: str) -> None:
    """
    Check if request.user has one of allowed_roles in the tenant.
    Raises: PermissionDenied if not.
    """
```

**Acceptance Criteria:**
- [ ] `rg "def _require_tenant_role" packages/core/` trả về 1 kết quả
- [ ] Tất cả call sites import từ utils
- [ ] Tests pass

#### Step 1.3: Extract `_get_request_tenant_role()` → shared utility (0.5h)

**Backend files:**

| File | Action |
|------|--------|
| MERGE vào `utils/permissions.py` | Thêm hàm `get_tenant_role(request)` |
| `packages/core/backend/src/identity_access/tenant_member_views.py:68` | Xóa |
| `packages/core/backend/src/identity_access/views/sso.py:29` | Xóa |
| `packages/core/backend/src/identity_access/views_tenant.py:173` | Xóa |

**Acceptance Criteria:**
- [ ] `rg "def _get_request_tenant_role" packages/core/` trả về 1 kết quả
- [ ] Tests pass

#### Step 1.4: Enforce editor/viewer roles (3h)

**Backend files cần sửa:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/utils/permissions.py` | N/A | `require_tenant_role` hỗ trợ 'editor' và 'viewer' |
| `packages/core/backend/src/identity_access/views_tenant.py` | 223,234,240,251,297,308,398,430,481,569,610,646 | Owner/admin only cho destructive ops; editor cho write ops |
| `packages/core/backend/src/identity_access/views_usage.py` | all | Viewer: read only; Editor+: write |
| `packages/core/backend/src/identity_access/views_webhooks.py` | all | Owner/admin only cho webhook CRUD |
| `packages/core/backend/src/identity_access/views/sso.py` | 55,64 | Owner/admin only cho SSO config |

**Role Permission Matrix:**

| Operation | Owner | Admin | Editor | Viewer |
|-----------|-------|-------|--------|--------|
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| View members | ✅ | ✅ | ✅ | ✅ |
| Invite/remove members | ✅ | ✅ | ❌ | ❌ |
| Manage SAs/PATs | ✅ | ✅ | ✅ (own) | ❌ |
| SSO config | ✅ | ✅ | ❌ | ❌ |
| Webhooks | ✅ | ✅ | ❌ | ❌ |
| Billing | ✅ | ✅ | ❌ | ❌ |
| View usage | ✅ | ✅ | ✅ | ✅ |
| Edit alert configs | ✅ | ✅ | ✅ | ❌ |
| Audit logs | ✅ | ✅ | ✅ (read) | ✅ (read) |
| Reports | ✅ | ✅ | ✅ | ❌ |
| Tenant settings | ✅ | ✅ | ❌ | ❌ |

**Acceptance Criteria:**
- [ ] `rg "require_tenant_role.*owner.*admin" packages/core/` — mỗi call site có đúng role tuple
- [ ] Test: editor user không thể invite/remove members → 403
- [ ] Test: viewer user không thể edit alert configs → 403
- [ ] Test: editor user có thể view dashboard → 200
- [ ] `python manage.py test identity_access --verbosity=2` PASS

#### Step 1.5: Enforce member limit per plan (2h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/tenant_member_views.py` | 126 (post) | Thêm limit check trước khi create invite |
| `packages/core/backend/src/identity_access/tenant_member_views.py` | ~200 (accept) | Thêm limit check trước khi accept invite |

**Spec:**

```python
# Trong TenantInvitesCombinedView.post():
PLAN_MEMBER_LIMITS = {'free': 3, 'starter': 5, 'pro': 25, 'enterprise': None}
current_count = TenantMember.objects.filter(tenant=tenant).count()
pending_count = TenantInvite.objects.filter(tenant=tenant, status='pending').count()
limit = PLAN_MEMBER_LIMITS.get(tenant.plan)
if limit is not None and (current_count + pending_count) >= limit:
    return Response({'detail': f'Member limit reached for {tenant.plan} plan.'}, status=403)
```

**Acceptance Criteria:**
- [ ] Free plan: invite thứ 4 → 403 "Member limit reached"
- [ ] Starter plan: invite thứ 6 → 403
- [ ] Enterprise plan: không có limit
- [ ] Test cases added to `test_tenant_member_views.py`
- [ ] Tests pass

#### Step 1.6: Fix hardcoded Vietnamese strings (1h)

**Frontend files:**

| File | Lines | Fix |
|------|-------|-----|
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | 559 | `+ Tạo Service Account` → `t("tenantPats.createSAAction")` |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | 727 | `Không có quyền hạn` → `t("tenantPats.noScopes")` |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | 741-743 | `30 ngày`/`90 ngày`/`1 năm` → `t("tenantPats.expiry30d")` etc. |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | 784 | `✓ Hết hạn vào:` → `t("tenantPats.expiresAt")` |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | 788 | `⚠ Hoạt động vô thời hạn...` → `t("tenantPats.noExpiryWarning")` |
| `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx` | 303,327 | `tenantPats.copySuccess` → `tenantSSO.copySuccess` |

**i18n files:**

| File | Action |
|------|--------|
| `packages/web/src/i18n/vi.js` | Thêm keys: `tenantPats.createSAAction`, `tenantPats.noScopes`, `tenantPats.expiry30d`, `tenantPats.expiry90d`, `tenantPats.expiry1y`, `tenantPats.expiresAt`, `tenantPats.noExpiryWarning`, `tenantSSO.copySuccess` |
| `packages/web/src/i18n/en.js` | Thêm English translations |

**Acceptance Criteria:**
- [ ] `rg '"[A-ZÀ-Ỹ]' packages/web/src/pages/tenant-admin/ -g '*.tsx'` trả về 0 kết quả
- [ ] `npm run i18n:scan` pass
- [ ] Dev server: switch language EN → tất cả strings render bằng English

#### Step 1.7: Add ErrorBoundary (1h)

**Frontend files:**

| File | Action |
|------|--------|
| NEW `packages/web/src/components/TenantAdminErrorBoundary.tsx` | Tạo ErrorBoundary component |
| `packages/web/src/components/TenantAdminLayout.tsx` | Wrap children với ErrorBoundary |

**Spec:**

```tsx
class TenantAdminErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

**Acceptance Criteria:**
- [ ] Component tồn tại với proper error UI
- [ ] Wrap trong TenantAdminLayout
- [ ] Test: throw error trong 1 page → ErrorBoundary catch, hiển thị fallback
- [ ] `npx tsc --noEmit` PASS

#### Step 1.8: Fix `activeTenantId` reactivity (1h)

**Frontend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/web/src/context/PortfolioContext.js` | 298 | Wrap `localStorage.getItem("tenant_id")` trong `useState` + `useEffect` sync |

**Spec:**

```javascript
const [activeTenantId, setActiveTenantId] = React.useState(() => {
  return typeof window !== "undefined" ? window.localStorage.getItem("tenant_id") : null;
});

React.useEffect(() => {
  const handleStorage = () => {
    setActiveTenantId(window.localStorage.getItem("tenant_id"));
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}, []);
```

**Acceptance Criteria:**
- [ ] `activeTenantId` reactive — sidebar dropdown sync without full reload
- [ ] `npx tsc --noEmit` PASS
- [ ] Dev server: switch tenant → sidebar update ngay lập tức

### Sprint 1 — Final Checklist

- [ ] A1-A10 pass
- [ ] `rg "def _get_request_tenant" packages/core/` → 1 result
- [ ] `rg "def _require_tenant_role" packages/core/` → 1 result
- [ ] `rg "def _get_request_tenant_role" packages/core/` → 1 result
- [ ] `rg '"[A-ZÀ-Ỹ]' packages/web/src/pages/tenant-admin/ -g '*.tsx'` → 0 results
- [ ] Free plan invite limit enforced (test: 4th invite → 403)
- [ ] Editor cannot invite/remove members (test: 403)
- [ ] Viewer cannot edit alert configs (test: 403)
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 3. Sprint 2: Email & Invitation System

**Duration:** 3-4 ngày | **Effort:** ~14h | **Priority:** P1

### Mục tiêu
Wire welcome email + invite email, thêm throttle.

### Sub-steps

#### Step 2.1: Create email infrastructure (4h)

**Backend files:**

| File | Action |
|------|--------|
| NEW `packages/core/backend/src/identity_access/email_tasks.py` | Celery tasks for email |
| NEW `packages/core/backend/src/identity_access/email_templates/` | HTML templates |
| `packages/core/backend/src/identity_access/onboarding_views.py:29-36` | Replace stub with real call |

**Spec cho `email_tasks.py`:**

```python
@shared_task(bind=True, max_retries=3)
def send_welcome_email(self, user_id: int, tenant_id: str):
    """Send welcome email to new tenant owner."""
    # Load user, tenant from DB
    # Render HTML template
    # Send via Django email backend (or SystemMailConfig)
    pass

@shared_task(bind=True, max_retries=3)
def send_invite_email(self, invite_id: int):
    """Send invitation email to invitee."""
    # Load TenantInvite from DB
    # Generate invite link: /invite/{token}
    # Render HTML template with invite link
    # Send via Django email backend
    pass
```

**Templates:**
- `welcome.html` — Welcome to tenant, get started guide
- `invite.html` — You've been invited, accept link

**Acceptance Criteria:**
- [ ] `email_tasks.py` có 2 tasks: `send_welcome_email`, `send_invite_email`
- [ ] Templates tồn tại với proper HTML
- [ ] `onboarding_views.py` gọi `send_welcome_email.delay()`
- [ ] `python manage.py test identity_access --verbosity=2` PASS

#### Step 2.2: Wire invite email (4h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/tenant_member_views.py` | 156-165 | Thêm `send_invite_email.delay(invite.id)` sau khi tạo invite |

**Acceptance Criteria:**
- [ ] Tạo invite → Celery task `send_invite_email` được enqueue
- [ ] Email content chứa accept link: `/core/v1/tenant-members/invites/{token}/accept/`
- [ ] Dev server: tạo invite → check Celery logs → email sent
- [ ] Tests pass

#### Step 2.3: Add invite throttle (1h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/tenant_member_views.py` | 126 | Thêm DRF throttle |

**Spec:**

```python
from rest_framework.throttling import UserRateThrottle

class InviteThrottle(UserRateThrottle):
    scope = 'tenant_invite'
    rate = '10/hour'

# Trong TenantInvitesCombinedView:
throttle_classes = [InviteThrottle]
```

**Acceptance Criteria:**
- [ ] >10 invites/giờ → 429 Too Many Requests
- [ ] Tests pass

#### Step 2.4: Add member count limit on accept (2h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/tenant_member_views.py` | ~200 (accept view) | Thêm limit check |

**Acceptance Criteria:**
- [ ] Accept invite khi member limit đã reached → 403
- [ ] Tests pass

### Sprint 2 — Final Checklist

- [ ] A1-A10 pass
- [ ] Welcome email: tạo tenant mới → email received (test with mailpit at localhost:1025)
- [ ] Invite email: tạo invite → email received with accept link
- [ ] Invite throttle: >10/hour → 429
- [ ] Member limit enforced on both invite AND accept
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 4. Sprint 3: Tenant Settings Page

**Duration:** 3-4 ngày | **Effort:** ~15h | **Priority:** MEDIUM

### Mục tiêu
Tạo Tenant Settings page với name, logo, timezone, theme.

### Sub-steps

#### Step 3.1: Add TenantSettings model (3h)

**Backend files:**

| File | Action |
|------|--------|
| NEW migration | `000X_tenantsettings.py` |
| `packages/core/backend/src/identity_access/models.py` | Thêm model TenantSettings |

**Spec cho model:**

```python
class TenantSettings(models.Model):
    tenant = models.OneToOneField(CoreTenant, on_delete=models.CASCADE, related_name='settings')
    logo_url = models.URLField(blank=True, null=True)
    timezone = models.CharField(max_length=64, default='Asia/Ho_Chi_Minh')
    locale = models.CharField(max_length=10, default='vi')
    theme = models.CharField(max_length=20, default='dark', choices=[('dark', 'Dark'), ('light', 'Light')])
    custom_domain = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**Acceptance Criteria:**
- [ ] Migration created và applied
- [ ] Model registered in Django admin
- [ ] `python manage.py test identity_access --verbosity=2` PASS

#### Step 3.2: Add settings API (3h)

**Backend files:**

| File | Action |
|------|--------|
| Existing `partner_urls.py` — thêm route | `path('partner/settings/', ...)` |
| NEW view | `PartnerTenantSettingsView` |

**Endpoints:**
- `GET /core/v1/partner/settings/` — Get tenant settings
- `PUT /core/v1/partner/settings/` — Update tenant settings

**Acceptance Criteria:**
- [ ] GET → returns current settings
- [ ] PUT → updates settings, returns updated
- [ ] Owner/admin only
- [ ] Tests pass

#### Step 3.3: Create TenantAdminSettingsPage.tsx (5h)

**Frontend files:**

| File | Action |
|------|--------|
| NEW `packages/web/src/pages/tenant-admin/TenantAdminSettingsPage.tsx` | Settings form |
| `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | Thêm CSS tokens |
| `packages/web/src/i18n/vi.js` | Thêm `tenantSettings.*` keys |
| `packages/web/src/i18n/en.js` | Thêm English translations |

**UI Components:**
- Form: display name, timezone dropdown, theme toggle, logo upload
- Save button with loading state
- Success/error toast

**Acceptance Criteria:**
- [ ] Page renders với proper form
- [ ] Form submit → API call → success toast
- [ ] Form validation (name required, timezone valid)
- [ ] Responsive design (mobile/desktop)
- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run build` PASS

#### Step 3.4: Add to sidebar + routing (1h)

**Frontend files:**

| File | Action |
|------|--------|
| `packages/web/src/components/TenantAdminSidebar.tsx` | Thêm nav item "Settings" |
| `packages/web/src/main.tsx` | Thêm route `/tenant-admin/settings` |
| `packages/web/src/pages/pageRegistry.js` | Thêm lazy import |

**Acceptance Criteria:**
- [ ] Sidebar hiện "Settings" link (chỉ owner/admin)
- [ ] Click → navigate到 settings page
- [ ] URL `/tenant-admin/settings` hoạt động

#### Step 3.5: Logo upload endpoint (3h)

**Backend files:**

| File | Action |
|------|--------|
| NEW view | `PartnerTenantLogoUploadView` |

**Spec:**
- `POST /core/v1/partner/settings/logo/` — Upload logo image
- Accept multipart/form-data with image file
- Store in media/tenant_logos/{tenant_id}/
- Return URL

**Acceptance Criteria:**
- [ ] Upload image → returns logo_url
- [ ] Old logo replaced
- [ ] File size limit (5MB)
- [ ] Accepted formats: jpg, png, svg
- [ ] Tests pass

### Sprint 3 — Final Checklist

- [ ] A1-A10 pass
- [ ] TenantSettings page accessible via sidebar
- [ ] Form submit → settings saved
- [ ] Logo upload → displays in UI
- [ ] Timezone/theme changes persisted
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 5. Sprint 4: Custom RBAC Roles

**Duration:** 4-5 ngày | **Effort:** ~19h | **Priority:** HIGH

### Mục tiêu
Cho phép tenant tạo custom roles với permission matrix.

### Sub-steps

#### Step 4.1: Add TenantCustomRole model (3h)

**Backend files:**

| File | Action |
|------|--------|
| NEW migration | `000X_tenantcustomrole.py` |
| `packages/core/backend/src/identity_access/models.py` | Thêm model |

**Spec:**

```python
class TenantCustomRole(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='custom_roles')
    name = models.CharField(max_length=64)
    permissions = models.JSONField(default=list)  # ['member:read', 'member:write', 'usage:read', ...]
    is_system = models.BooleanField(default=False)  # True for owner/admin/editor/viewer
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tenant', 'name')
```

**Permission tokens:**
- `member:read`, `member:write`, `member:delete`
- `sa:read`, `sa:write`, `sa:delete`
- `pat:read`, `pat:write`, `pat:delete`
- `usage:read`, `usage:write`
- `billing:read`, `billing:write`
- `sso:read`, `sso:write`
- `webhook:read`, `webhook:write`, `webhook:delete`
- `audit:read`
- `report:read`, `report:write`
- `settings:read`, `settings:write`

**Acceptance Criteria:**
- [ ] Migration created
- [ ] System roles (owner/admin/editor/viewer) seeded
- [ ] Tests pass

#### Step 4.2: Add roles API (4h)

**Backend files:**

| File | Action |
|------|--------|
| Existing `partner_urls.py` — thêm routes | CRUD routes for roles |
| NEW view | `PartnerRoleListCreateView`, `PartnerRoleDetailView` |

**Endpoints:**
- `GET /core/v1/partner/roles/` — List roles
- `POST /core/v1/partner/roles/` — Create custom role
- `GET /core/v1/partner/roles/{id}/` — Get role
- `PATCH /core/v1/partner/roles/{id}/` — Update role
- `DELETE /core/v1/partner/roles/{id}/` — Delete role (only non-system)

**Acceptance Criteria:**
- [ ] CRUD operations work
- [ ] Cannot delete system roles
- [ ] Cannot create duplicate role names
- [ ] Owner/admin only
- [ ] Tests pass

#### Step 4.3: Create TenantAdminRolesPage.tsx (6h)

**Frontend files:**

| File | Action |
|------|--------|
| NEW `packages/web/src/pages/tenant-admin/TenantAdminRolesPage.tsx` | Roles management page |
| `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | Thêm CSS tokens |
| `packages/web/src/i18n/vi.js` | Thêm `tenantRoles.*` keys |
| `packages/web/src/i18n/en.js` | English translations |

**UI Components:**
- Role list table (name, permissions count, member count, actions)
- Create role modal with permission matrix (checkboxes grouped by category)
- Edit role modal
- Delete confirmation (only non-system roles)
- System roles shown with lock icon

**Acceptance Criteria:**
- [ ] Page renders with role list
- [ ] Create role → appears in list
- [ ] Edit role → permissions updated
- [ ] Delete role → removed (non-system only)
- [ ] Permission matrix UI clear và intuitive
- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run build` PASS

#### Step 4.4: Update permissions system (3h)

**Backend files:**

| File | Change |
|------|--------|
| `packages/core/backend/src/identity_access/utils/permissions.py` | `require_tenant_role` resolve custom roles |
| All view files | Update role checks to use permission tokens |

**Acceptance Criteria:**
- [ ] Custom role với `member:write` → can invite members
- [ ] Custom role without `sso:write` → cannot access SSO config
- [ ] Tests pass

#### Step 4.5: Update member invite form (2h)

**Frontend files:**

| File | Change |
|------|--------|
| `packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx` | Add custom role selector in invite form |

**Acceptance Criteria:**
- [ ] Invite form shows custom roles in dropdown
- [ ] Can assign custom role to invite
- [ ] Role appears in member list

#### Step 4.6: Add role assignment on accept (1h)

**Backend files:**

| File | Change |
|------|--------|
| `packages/core/backend/src/identity_access/tenant_member_views.py` | Accept view uses assigned role |

**Acceptance Criteria:**
- [ ] Accept invite → member created with assigned role
- [ ] Role visible in member list
- [ ] Tests pass

### Sprint 4 — Final Checklist

- [ ] A1-A10 pass
- [ ] Custom role CRUD works
- [ ] Permission matrix UI functional
- [ ] Custom role enforced in API
- [ ] Member invite shows custom roles
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 6. Sprint 5: Real SAML SSO

**Duration:** 5-6 ngày | **Effort:** ~22h | **Priority:** HIGH (Enterprise feature)

### Mục tiêu
Replace mock SSO với real SAML integration.

### Sub-steps

#### Step 5.1: Integrate python3-saml (6h)

> **⚠️ Deviation (2026-07-18):** `python3-saml` was NOT added. `lxml>=5.0,<6.0` used instead.
> **Rationale:** `python3-saml` requires `xmlsec1` native library which fails on Windows dev
> environments. lxml-based implementation covers 95% of protocol (AuthnRequest, Response
> parsing, Conditions, SubjectConfirmation, Metadata). Signature verification is a no-op stub
> by default; set `SAML_SIGNATURE_VERIFICATION_MODE=strict` to enforce (requires python3-saml).
> See `docs/AUDIT_SPRINT5_SAML_SSO_INDEPENDENT_REVIEW_20260718.md` finding F2 for details.

**Backend files:**

| File | Action |
|------|--------|
| `requirements.txt` | Thêm `python3-saml>=1.15.0` |
| NEW `packages/core/backend/src/identity_access/saml_service.py` | SAML helper service |

**Spec:**

```python
class SAMLService:
    def __init__(self, sso_config: TenantSSOConfig):
        self.config = sso_config
        self.settings = self._build_settings()

    def _build_settings(self) -> dict:
        """Build python3-saml settings dict from TenantSSOConfig."""
        pass

    def create_authn_request(self) -> str:
        """Generate SAML AuthnRequest URL."""
        pass

    def process_response(self, saml_response: str) -> dict:
        """Parse and validate SAML Response. Returns user attributes."""
        pass

    def get_metadata(self) -> str:
        """Generate SP metadata XML."""
        pass
```

**Acceptance Criteria:**
- [ ] `python3-saml` installed
- [ ] `SAMLService` class functional
- [ ] Unit tests for AuthnRequest generation
- [ ] Unit tests for Response parsing

#### Step 5.2: Rewrite SSOLoginInitiateView (4h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/views/sso.py` | 74-118 | Replace mock with real AuthnRequest |

**Spec:**
- Generate real SAML AuthnRequest
- Return redirect URL to IdP
- Include RelayState with tenant_id

**Acceptance Criteria:**
- [ ] Returns valid SAML AuthnRequest URL
- [ ] Redirect works in browser
- [ ] Tests pass

#### Step 5.3: Rewrite SSOCallbackView (6h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/views/sso.py` | 121-223 | Replace mock with real SAML Response parsing |

**Spec:**
- Parse SAML Response
- Verify signature against IdP certificate
- Extract email, name, groups from attributes
- Create/update user with email verification
- Create TenantMember if not exists
- Issue PAT

**Acceptance Criteria:**
- [ ] Valid SAML Response → user created, PAT issued
- [ ] Invalid signature → 403
- [ ] Expired Response → 403
- [ ] Email verified on user creation
- [ ] Tests pass

#### Step 5.4: Add SSO metadata endpoint (2h)

**Backend files:**

| File | Action |
|------|--------|
| NEW endpoint | `GET /core/v1/auth/sso/metadata/` |

**Spec:**
- Generate SP metadata XML
- Include SP entity ID, ACS URL, certificate

**Acceptance Criteria:**
- [ ] Returns valid SP metadata XML
- [ ] Can be imported into IdP

#### Step 5.5: Add SSO connection test (2h)

**Backend files:**

| File | Change |
|------|--------|
| `packages/core/backend/src/identity_access/views/sso.py` | Add test endpoint |

**Spec:**
- `POST /core/v1/partner/sso/test/` — Test SSO connection
- Validate IdP config (URL reachable, cert valid)
- Return success/failure with details

**Acceptance Criteria:**
- [ ] Valid config → success response
- [ ] Invalid URL → error with details
- [ ] Invalid cert → error with details

#### Step 5.6: Update frontend SSO page (2h)

**Frontend files:**

| File | Change |
|------|--------|
| `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx` | Update test connection flow |

**Acceptance Criteria:**
- [ ] Test connection button works with real SAML
- [ ] Error messages clear
- [ ] Loading states proper

### Sprint 5 — Final Checklist

- [ ] A1-A10 pass
- [ ] Real SAML flow works end-to-end (with test IdP)
- [ ] SP metadata downloadable
- [ ] Signature verification working
- [ ] User created on SSO login
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 7. Sprint 6: UX Improvements

**Duration:** 4-5 ngày | **Effort:** ~20h | **Priority:** MEDIUM

### Mục tiêu
No-reload tenant switching, React Query caching, loading skeletons.

### Sub-steps

#### Step 6.1: Tenant switching without reload (4h)

**Frontend files:**

| File | Change |
|------|--------|
| `packages/web/src/context/PortfolioContext.js` | `switchTenant()` → state update + refetch |
| `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx` | Remove full reload |
| All tenant admin pages | Refetch data on tenant change |

**Spec:**

```javascript
const switchTenant = useCallback(async (tenantId) => {
  localStorage.setItem("tenant_id", tenantId);
  setActiveTenantId(tenantId);
  // Refetch all tenant-scoped data
  window.dispatchEvent(new CustomEvent('tenant-changed', { detail: { tenantId } }));
}, []);
```

**Acceptance Criteria:**
- [ ] Switch tenant → no page reload
- [ ] All data refetched for new tenant
- [ ] Sidebar updates immediately
- [ ] No stale data from previous tenant

#### Step 6.2: Add React Query (8h)

**Frontend files:**

| File | Change |
|------|--------|
| NEW `packages/web/src/providers/QueryProvider.tsx` | QueryClient provider (`@tanstack/react-query` đã có sẵn trong package.json) |
| `packages/web/src/main.tsx` | Wrap app với QueryProvider |
| All 13 `TenantAdmin*.tsx` pages | Replace `useState`+`useEffect` với `useQuery` |

**Spec:**
- QueryClient with staleTime: 30s, cacheTime: 5min
- Each page uses `useQuery` với proper query keys
- Mutations use `useMutation` với invalidation

**Acceptance Criteria:**
- [ ] All 13 pages use React Query
- [ ] No more raw `useState`+`useEffect` for data fetching
- [ ] Cache working: navigate away → back → instant load
- [ ] Background refetch on window focus
- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run build` PASS

#### Step 6.3: Add loading skeletons (4h)

**Frontend files:**

| File | Change |
|------|--------|
| All 13 `TenantAdmin*.tsx` pages | Add skeleton loading states |

**Spec:**
- Each page có skeleton component
- Skeleton matches layout thực tế
- Smooth transition skeleton → content

**Acceptance Criteria:**
- [ ] All pages show skeleton while loading
- [ ] Skeleton matches final layout
- [ ] No layout shift

#### Step 6.4: Convert createElement to JSX (1h)

**Frontend files:**

| File | Change |
|------|--------|
| `packages/web/src/components/TenantAdminLayout.tsx` | `createElement` → JSX |
| `packages/web/src/components/TenantAdminSidebar.tsx` | `createElement` → JSX |

**Acceptance Criteria:**
- [ ] No `createElement` in layout components
- [ ] `npx tsc --noEmit` PASS

#### Step 6.5: Add toast notifications (3h)

**Frontend files:**

| File | Change |
|------|--------|
| All pages with mutations | Add success/error toasts |

**Acceptance Criteria:**
- [ ] Every mutation shows toast
- [ ] Success: green, auto-dismiss 3s
- [ ] Error: red, manual dismiss
- [ ] Consistent positioning

### Sprint 6 — Final Checklist

- [ ] A1-A10 pass
- [ ] Tenant switching: no reload, data refetched
- [ ] React Query: all 13 pages migrated
- [ ] Loading skeletons: all pages
- [ ] No `createElement` in layouts
- [ ] Toast notifications on all mutations
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 8. Sprint 7: Data Archival & Compliance

**Duration:** 4-5 ngày | **Effort:** ~17h | **Priority:** MEDIUM

### Mục tiêu
Complete deprovision cleanup, data export, audit retention.

### Sub-steps

#### Step 7.1: Complete deprovision cleanup (3h)

**Backend files:**

| File | Lines | Change |
|------|-------|--------|
| `packages/core/backend/src/identity_access/tasks.py` | 420-451 | Thêm cleanup cho SAs, audit logs, reports, alert configs |

**Spec:**

```python
# Thêm vào deprovision_tenant_async:
from identity_access.models import CoreServiceAccount, UsageAlertConfig, ScheduledReport, PATAuditLog

# Cleanup Service Accounts
sa_ids = list(CoreServiceAccount.objects.filter(tenant=tenant).values_list('id', flat=True))
if sa_ids:
    _, sa_stats = CoreServiceAccount.objects.filter(id__in=sa_ids).delete()
    removed['service_accounts'] = sa_stats

# Cleanup UsageAlertConfigs
_, alert_stats = UsageAlertConfig.objects.filter(tenant=tenant).delete()
removed['alert_configs'] = alert_stats

# Cleanup ScheduledReports
_, report_stats = ScheduledReport.objects.filter(tenant=tenant).delete()
removed['scheduled_reports'] = report_stats

# Cleanup PATAuditLogs (via PATs)
_, audit_stats = PATAuditLog.objects.filter(pat__service_account__tenant=tenant).delete()
removed['pat_audit_logs'] = audit_stats
```

**Acceptance Criteria:**
- [ ] Deprovision cleans up ALL related data
- [ ] No orphaned records
- [ ] Tests pass

#### Step 7.2: Add data export endpoint (5h)

**Backend files:**

| File | Action |
|------|--------|
| NEW endpoint | `GET /core/v1/partner/export/` |
| NEW Celery task | `export_tenant_data` |

**Spec:**
- Export all tenant data as JSON
- Include: members, PATs, SAs, webhooks, audit logs, settings
- Generate downloadable ZIP file
- Async generation for large tenants

**Acceptance Criteria:**
- [ ] GET → starts export, returns task ID
- [ ] Download ZIP with all data
- [ ] Format: JSON per collection
- [ ] Async for large datasets

#### Step 7.3: Add audit log retention config (3h)

**Backend files:**

| File | Change |
|------|--------|
| `packages/core/backend/src/identity_access/models.py` | Thêm `audit_log_retention_days` to TenantSettings |
| Cleanup task | Update to respect retention config |

**Acceptance Criteria:**
- [ ] Configurable per plan (default: free=7, starter=30, pro=90, enterprise=365)
- [ ] Cleanup task respects config
- [ ] API to update retention

#### Step 7.4: Add pending_activation workflow (2h)

**Backend files:**

| File | Change |
|------|--------|
| `packages/core/backend/src/identity_access/views_tenant.py` | Activate workflow |
| `packages/core/backend/src/tenant_lifecycle/tasks.py` | Auto-activate task |

**Acceptance Criteria:**
- [ ] New tenant → pending_activation
- [ ] Email verification → active
- [ ] Auto-activate after 24h if no verification

#### Step 7.5: Add webhook payload inspection (3h)

**Frontend files:**

| File | Change |
|------|--------|
| `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx` | Add payload viewer in delivery log |

**Acceptance Criteria:**
- [ ] Click delivery → view request/response body
- [ ] JSON formatted
- [ ] Truncated if >10KB

#### Step 7.6: Add deprovision lifecycle event (1h)

**Backend files:**

| File | Change |
|------|--------|
| `packages/core/backend/src/identity_access/views_webhooks.py:222-234` | Add TenantLifecycleEvent before status change |

**Acceptance Criteria:**
- [ ] Deprovision creates lifecycle event
- [ ] Event logged with actor, timestamp, details

### Sprint 7 — Final Checklist

- [ ] A1-A10 pass
- [ ] Deprovision cleans up ALL data
- [ ] Data export works
- [ ] Audit retention configurable
- [ ] Deprovision logged as lifecycle event
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated

---

## 9. Sprint 8: Testing & Hardening

**Duration:** 5-6 ngày | **Effort:** ~25h | **Priority:** HIGH (final sprint)

### Mục tiêu
Unit tests, integration tests, security tests, E2E tests.

### Sub-steps

#### Step 8.1: Unit tests for tenant admin pages (8h)

**Frontend files:**

| File | Action |
|------|--------|
| NEW `packages/web/src/pages/tenant-admin/__tests__/TenantAdminHomePage.test.tsx` | Dashboard tests |
| NEW `packages/web/src/pages/tenant-admin/__tests__/TenantAdminMembersPage.test.tsx` | Members tests |
| NEW `packages/web/src/pages/tenant-admin/__tests__/TenantAdminPATsPage.test.tsx` | PATs tests |
| NEW `packages/web/src/pages/tenant-admin/__tests__/TenantAdminBillingPage.test.tsx` | Billing tests |
| NEW `packages/web/src/pages/tenant-admin/__tests__/TenantAdminWebhooksPage.test.tsx` | Webhooks tests |
| NEW `packages/web/src/pages/tenant-admin/__tests__/TenantAdminAuditLogsPage.test.tsx` | Audit logs tests |

**Test patterns per page:**
- Renders loading state
- Renders empty state
- Renders data
- Handles error
- Calls API on mount
- Handles user interactions (click, submit)

**Acceptance Criteria:**
- [ ] All 6 pages have unit tests
- [ ] `npm run test` PASS
- [ ] Coverage >80% for tenant admin pages

#### Step 8.2: API integration tests (6h)

**Backend files:**

| File | Action |
|------|--------|
| NEW `packages/core/backend/tests/test_partner_api.py` | Partner endpoint tests |
| NEW `packages/core/backend/tests/test_tenant_roles_api.py` | Roles API tests |

**Test cases:**
- CRUD operations for all partner endpoints
- Permission checks (owner/admin/editor/viewer)
- Member limit enforcement
- Custom role assignment
- SSO flow (mock SAML)

**Acceptance Criteria:**
- [ ] All partner endpoints tested
- [ ] Permission matrix verified
- [ ] `python manage.py test --verbosity=2` PASS

#### Step 8.3: Security tests (4h)

**Backend files:**

| File | Action |
|------|--------|
| NEW `packages/core/backend/tests/test_tenant_security.py` | Security tests |

**Test cases:**
- Cross-tenant data access → 403
- Role escalation (viewer → admin) → 403
- Invite flood → 429
- Invalid SAML Response → 403
- Expired PAT → 401
- Deprovision data cleanup verified

**Acceptance Criteria:**
- [ ] All security scenarios tested
- [ ] No false positives
- [ ] Tests pass

#### Step 8.4: E2E tests (6h)

**Frontend files:**

| File | Action |
|------|--------|
| `packages/web/tests/visual/tenant-admin.spec.ts` | Update existing |
| NEW `packages/web/tests/e2e/tenant-invite.spec.ts` | Invite flow E2E |
| NEW `packages/web/tests/e2e/tenant-settings.spec.ts` | Settings flow E2E |

**Test flows:**
- Invite member → accept → verify role
- Create custom role → assign to member
- Update tenant settings → verify persistence
- Tenant switching → data refetched

**Acceptance Criteria:**
- [ ] E2E tests pass
- [ ] Visual regression tests updated
- [ ] No flaky tests

#### Step 8.5: i18n scan hardening (1h)

**Frontend files:**

| File | Action |
|------|--------|
| `packages/web/package.json` | Update `i18n:scan` script |

**Spec:**
- Scan all `.tsx`/`.ts` files in `pages/tenant-admin/`
- Detect hardcoded Vietnamese strings
- Report with file:line

**Acceptance Criteria:**
- [ ] `npm run i18n:scan` → 0 hardcoded strings
- [ ] CI can run this check

### Sprint 8 — Final Checklist

- [ ] A1-A10 pass
- [ ] Unit tests: all 6 pages covered
- [ ] API tests: all partner endpoints
- [ ] Security tests: all scenarios
- [ ] E2E tests: critical flows
- [ ] i18n scan: 0 hardcoded strings
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] AGENTS.md Progress section updated
- [ ] All sprints 1-7 verified

---

## 10. Auto-Update Protocol

Sau khi hoàn thành mỗi sprint, AI PHẢI tự cập nhật:

### 10.1 Files Cần Update

| File | Section | Content |
|------|---------|---------|
| `CODE_CHANGE_AUDIT_LEDGER.md` | Thêm entry mới | Problem, Changes, Verification, Modified Files |
| `AGENTS.md` | `Progress > Done` | Thêm sprint completion entry |
| `docs/TENANT_MANAGEMENT_AUDIT_AND_UPGRADE_PLAN.md` | Phase section | Đánh dấu completed |

### 10.2 Ledger Entry Format

```markdown
# YYYY-MM-DD | Tenant Management Sprint X: [Tên Sprint] ✅

## Problem Solved
- [Mô tả vấn đề được giải quyết]

## Changes
1. **[File]**: [Mô tả thay đổi]
2. **[File]**: [Mô tả thay đổi]

## Verification Results
- [Kết quả kiểm tra]
- Quality gates A1-A10: PASS

## Modified Files
| File | Change |
|------|--------|
| `[file]` | [description] |
```

### 10.3 AGENTS.md Update Format

```markdown
### Done (YYYY-MM-DD)
- **Sprint X: [Tên Sprint]**: [Mô tả ngắn]. [Kết quả quan trọng].
```

### 10.4 Trigger Points

AI tự động update khi:
1. Tất cả sub-steps trong sprint hoàn thành
2. Quality gates A1-A10 pass
3. Không có P0/P1 findings mới từ self-audit
4. Demo được trên dev server

---

## 11. Ledger Update Template

Copy template này vào `CODE_CHANGE_AUDIT_LEDGER.md` sau mỗi sprint:

```markdown
---

# YYYY-MM-DD | Tenant Management Sprint X: [Tên] ✅

## Problem Solved
- Sprint X hoàn thành: [mô tả]

## Changes (list từng file)
1. `path/to/file` — [change description]

## Verification Results
- tsc: 0 errors
- lint: 0 errors
- build: PASS
- tests: all pass
- i18n scan: 0 hardcoded strings
- A1-A10: all PASS

## Modified Files
| File | Change |
|------|--------|
| `file` | change |
```

---

## Appendix: Sprint Dependencies

```
Sprint 1 (Bugs) ──────────────────────────────────────┐
                                                       │
Sprint 2 (Email) ── shared member-limit logic w/ S1.5 ┤
                                                       │
Sprint 3 (Settings) ── independent ───────────────────┤
                                                       │
Sprint 4 (RBAC) ── depends on Sprint 1 (roles utils) ─┤
                                                       │
Sprint 5 (SSO) ── independent (self-contained role) ──┤
                                                       │
Sprint 6 (UX) ── independent ─────────────────────────┤
                                                       │
Sprint 7 (Archival) ── depends on Sprint 1 ──────────┤
                                                       │
Sprint 8 (Testing) ── depends on Sprint 1-7 ──────────┘
```

**Parallel execution possible:**
- Sprint 3 (Settings) + Sprint 6 (UX) — independent, chạy song song
- Sprint 2 (Email) + Sprint 4 (RBAC) + Sprint 5 (SSO) — sau Sprint 1, chạy song song
- Sprint 7 (Archival) — sau Sprint 1, song song với Sprint 2-6

**Critical path:** Sprint 1 → {Sprint 2, Sprint 4, Sprint 5 song song} → Sprint 8

**Note:** Sprint 5 (SSO) self-contained — `views/sso.py` define `_require_tenant_role` riêng, hardcoded `('owner','admin')`, không import RBAC. Sprint 4 chỉ enhance SSO sau này bằng custom roles, không block.

---

## Appendix: Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SSO integration complex | Use python3-saml well-documented library; test with SimpleSAMLphp |
| React Query migration large | Do page-by-page; keep fallback to old pattern if needed |
| Custom RBAC breaking existing flows | Keep system roles immutable; custom roles additive only |
| Email delivery in dev | Use mailpit (localhost:1025) for dev testing |
| Data export performance | Async Celery task; chunk large datasets |
| Visual regression tests flaky | Pin viewport sizes; use stable test data |
