# Implementation Plan: Tenant Management Migration Fixes

**Based on**: `docs/AUDIT_TENANT_MANAGEMENT_MIGRATION_20260709.md`
**Date**: 2026-07-09
**Target**: parity legacy-to-SaaS cho operator admin + self-service tenant-admin

---

## Audit Finding: PAT Plan Restriction Gap

PAT creation **không tuân thủ plan restriction** — free tenant có thể tạo unlimited PAT với bất kỳ scope nào.

**Root cause**: `CoreTenant` không có `max_active_pats`, `issue_for_service_account()` là pure DB insert, `QuotaRecord` không có PAT meter.

**Fix approach**: Hybrid prefix + quota enforcement + profile response.

---

## P4: Plan-based PAT enforcement

### Tổng quan

| Thay đổi | File | Mô tả |
|---|---|---|
| `max_active_pats` field | `identity_access/models.py:CoreTenant` | Giới hạn PAT theo plan default |
| Plan prefix | `_build_pat_secret()` | `vni_{plan}_` cho client offline parse |
| Pre-issue hook | `issue_for_service_account()` | Kiểm tra active count vs limit |
| Profile response | `views/profile.py` + `helpers.py` | `/auth/me` trả `max_active_pats` + `active_pat_count` |

### 4a — `max_active_pats` field

**File**: `identity_access/models.py` — thêm sau `api_calls_used`:

```python
max_active_pats = models.IntegerField(default=-1, verbose_name='Max active PATs (-1 = unlimited)')
```

Migration defaults:

| Plan | max_active_pats |
|---|---|
| free | 3 |
| starter | 10 |
| pro | 25 |
| enterprise | -1 |
| custom | -1 |
| internal | -1 |

### 4b — Plan prefix trong PAT

**File**: `identity_access/models.py`

```python
# before
def _build_pat_secret() -> str:
    return 'vni_' + secrets.token_urlsafe(48)

# after
def _build_pat_secret(plan_code: str) -> str:
    return f'vni_{plan_code}_' + secrets.token_urlsafe(48)
```

`_extract_pat_prefix()` vẫn lấy 12 ký tự đầu → prefix `vni_pro_a1b2` (11-12 chars, ≤ `max_length=12`).

Sửa caller `issue_for_service_account()`:
```python
raw_secret = _build_pat_secret(service_account.tenant.plan)
```

### 4c — Pre-issue hook

**File**: `identity_access/models.py:issue_for_service_account` — đầu method:

```python
tenant = service_account.tenant
if tenant.max_active_pats != -1:
    now = timezone.now()
    active_count = cls.objects.filter(
        service_account__tenant=tenant,
        status=cls.StatusChoices.ACTIVE,
        expires_at__gt=now,
    ).count()
    if active_count >= tenant.max_active_pats:
        raise ValidationError(
            f'Tenant đã đạt giới hạn {tenant.max_active_pats} PAT hoạt động.'
        )
```

### 4d — Profile response

**File**: `identity_access/views/helpers.py:_tenant_payload`:

```python
def _tenant_payload(tenant):
    return {
        ...
        'plan': tenant.plan,
        'max_active_pats': tenant.max_active_pats,
        ...
    }
```

**File**: `identity_access/views/profile.py:profile_view` — thêm `active_pat_count`:

```python
from ..models import CorePATCredential
from django.utils import timezone

active_pat_count = CorePATCredential.objects.filter(
    service_account__tenant=tenant,
    status='active',
    expires_at__gt=timezone.now(),
).count()

return Response({
    ...
    'plan': tenant.plan,
    'active_pat_count': active_pat_count,
    'tenant': {
        **_tenant_payload(tenant),
        'max_active_pats': tenant.max_active_pats,
        ...
    },
    ...
})
```

### 4e — Migration script

Tạo `identity_access/migrations/XXXX_max_active_pats.py`:
- Add field default -1
- Bulk update: free→3, starter→10, pro→25, còn lại -1

### 4f — i18n + plan badge hiển thị

Frontend thêm badge plan kế bên PAT (dùng prefix hoặc profile response).

---

## Overview

4 priority tiers, 7 work items.

```
P0 ── BE operator tenant endpoints  ←── unblock cả 3 AdminCore* pages
 │
P1 ── Response shape alignment      ←── fix frontend parsing inconsistency
 │    └─ Verify commercial app runtime
 │
P2 ── SaaS write flows (create SA / issue‑rotate‑revoke PAT)
 │    └─ E2E verification self-service pages
 │
P3 ── i18n AdminCore* pages
      └─ Update load test scripts
```

---

## P0: BE operator tenant endpoints

### Why
`contracts/operator/urls.py` chỉ có 4 routes (overview, health, scraping, soc). Các method
`getCoreOperatorTenants`, `getCoreOperatorTenantDetail`, `getCoreOperatorTenantServiceAccounts`,
`getCoreOperatorTenantPATs` trong `operator.js` đều 404.

### What

File mới: `packages/core/backend/src/vninvest_core/contracts/operator/operator_tenant_views.py`

Dùng pattern `permissions.IsAdminUser` + DRF `APIView` / `ListAPIView`.

| Endpoint | Frontend caller | Data shape expected (from AdminCore*.tsx) |
|---|---|---|
| `GET /operator/tenants/` | `AdminCoreTenantsPage.tsx:78` | `{ data: items[], summary_cards: [...] }` |
| `GET /operator/tenants/{id}/` | `AdminCoreTenantsPage.tsx:101` | `{ tenant: {...}, commercial_summary: {...}, security_summary: {...}, recent_operator_actions: [...] }` |
| `GET /operator/tenants/{id}/service-accounts/` | `AdminCoreServiceAccountsPage.tsx:101` | `{ data: items[], summary_cards: [...] }` |
| `GET /operator/tenants/{id}/pats/` | `AdminCorePATsPage.tsx:104` | `{ data: items[], summary_cards: [...] }` |
| `GET /operator/jobs/` | (operator.js:61) | TBD — cần confirm UI page |
| `GET /operator/audit/requests/` | (operator.js:65) | TBD — cần confirm UI page |

### Shape detail mapping

**`GET /operator/tenants/`** → `AdminCoreTenantsPage`

Item fields:
- `id`, `display_name`, `tenant_code`, `plan_code`, `status`,
  `current_usage_risk`, `updated_at`
- Summary cards: key, label, value, detail, status

Implementation: query `CoreTenant.objects.all()`, aggregate summary
cards từ tenant counts + status distribution.

**`GET /operator/tenants/{id}/`** → `AdminCoreTenantsPage` (detail panel)

Response:
```json
{
  "tenant": {
    "id": "...",
    "display_name": "...",
    "tenant_code": "...",
    "status": "active",
    "plan_code": "standard",
    "suspension_state": null,
    "current_usage_risk": "normal",
    "invoice_state": "current"
  },
  "commercial_summary": {
    "billing_cycle": "monthly",
    "next_invoice_date": "2026-08-01"
  },
  "security_summary": {
    "service_account_count": 3,
    "active_pat_count": 5,
    "rotations_due_count": 1,
    "anomaly_state": "normal",
    "latest_pat_last_used_at": "2026-07-08T10:00:00Z"
  },
  "recent_operator_actions": [
    { "action": "pat_issued", "summary": "PAT issued for SA-001", "at": "..." }
  ]
}
```

**`GET /operator/tenants/{id}/service-accounts/`** → `AdminCoreServiceAccountsPage`

Item fields:
- `id`, `name`, `status`, `environment`, `policy_ids`, `pat_count`, `active_pat_count`,
  `rotation_risk`, `last_operator_action_at`, `latest_pat_last_used_at`,
  `created_at`, `updated_at`

**`GET /operator/tenants/{id}/pats/`** → `AdminCorePATsPage`

Item fields:
- `id`, `token_prefix`, `service_account_id`, `status`, `expires_at`,
  `anomaly_state`, `last_used_at`, `scope_codes`, `grace_period_active`,
  `issuer_actor_type`, `issuer_actor_id`, `last_ip`, `last_used_ip_country`,
  `last_audit_request_id`, `revoked_at`, `created_at`, `updated_at`

### Register routes

Sửa `contracts/operator/urls.py`:

```python
path('tenants/', OperatorTenantListView.as_view(), name='operator-tenant-list'),
path('tenants/<str:tenant_id>/', OperatorTenantDetailView.as_view(), name='operator-tenant-detail'),
path('tenants/<str:tenant_id>/service-accounts/', OperatorTenantServiceAccountListView.as_view(), name='operator-tenant-sa-list'),
path('tenants/<str:tenant_id>/pats/', OperatorTenantPATListView.as_view(), name='operator-tenant-pat-list'),
```

### Models to use
- `identity_access.models.CoreTenant` — tenant registry
- `identity_access.models.CoreServiceAccount` — service accounts (foreign key → CoreTenant)
- `identity_access.models.CorePATCredential` — PAT credentials (foreign key → CoreServiceAccount)
- `ops_audit.models.AuditEvent` — audit trail cho operator actions
- `identity_access.serializers.CoreTenantSerializer`, `CoreServiceAccountSerializer`, `CorePATCredentialSerializer`

### Models to verify
- `CoreTenant.plan` → `plan_code` mapping (trong serializers không có `plan_code` field, chỉ có `plan`)
- `rotation_risk` logic: cần tính từ thời gian last_rotated_at với policy threshold
- `anomaly_state` logic: cần tính từ last_used_at, số lần failed auth gần đây

---

## P1: Response shape alignment

### Problem
- `AdminCoreTenantsPage.tsx:120-125` đọc `response.data` → `registry.data` / `registry.summary_cards`
- `AdminCoreServiceAccountsPage.tsx:114-116` đọc `response.data.data`
- `AdminCorePATsPage.tsx:119-121` đọc `response.data.data`

### Decision
Chọn 1 convention: **DRF `ListAPIView` paginated response** hoặc **Custom envelope**.

Option A (recommended): Chuẩn DRF pagination
```json
{
  "count": 42,
  "next": "...",
  "previous": null,
  "results": [...]
}
```
→ sửa frontend đọc `response.results` thay `response.data` / `response.data.data`.

Option B: Custom envelope đã dùng ở operator health
```json
{
  "object": "operator_tenant_snapshot",
  "generated_at": "...",
  "summary_cards": [...],
  "data": [...]
}
```
→ sửa frontend ServiceAccounts + PATs về `response.data`.

### Action
Chốt Option B (custom envelope) để align với `OperatorOverviewView`:
- `AdminCoreServiceAccountsPage.tsx:114`: `response.data.data` → `response.data`
- `AdminCorePATsPage.tsx:119`: `response.data.data` → `response.data`
- Xóa wrapper parse `response.data?.data` bất cứ nơi nào có.

---

## P1: Verify commercial app runtime

### Why
Các view `commercial_partner_views.py` fallback `[]` nếu commercial app chưa imported.
Cần xác nhận trên sandbox / production:
- `commercial.models.UsageMeter`, `QuotaRecord`, `Invoice`, `QuotaHistory` đã migrated chưa?
- If chưa: Usage/Billing/History pages hiển thị "No data" — có fallback UI không?

### Action
- SSH vào sandbox, gọi `from commercial.models import UsageMeter` trong django shell
- Nếu ImportError → commercial chưa migrate → ưu tiên migrate hoặc thêm graceful UI message

---

## P2: SaaS write flows

### What
Các AdminCore* pages hiện có `ability = { can: (...) => false }` tooltip "sẽ được nối ở slice viết sau".

### Steps
1. Sau khi P0 hoàn thành (BE endpoints có), **bỏ hardcode ability**.
2. Import `usePortfolio()` hook (self-service pages đã dùng pattern này) để lấy real ability từ auth profile.
3. Implement form modal/dialog cho:
   - **Create SA**: `POST /core/v1/partner/service-accounts/` (đã có)
   - **Issue PAT**: `POST /core/v1/partner/pats/issue/` (đã có)
   - **Rotate PAT**: `POST /core/v1/partner/pats/{pat_id}/rotate/` (đã có)
   - **Revoke PAT**: `POST /core/v1/partner/pats/{pat_id}/revoke/` (đã có)

### Note
Các write endpoints đã tồn tại trong `identity_access/partner_urls.py` và `views_tenant.py`.
Chỉ cần nối frontend → adapter → BE.

### Files to modify
- `AdminCoreServiceAccountsPage.tsx`: line 64 remove `{ can: () => false }`, import real ability, wire create form
- `AdminCorePATsPage.tsx`: line 64 same, wire issue/rotate/revoke forms

---

## P2: E2E verification self-service pages

### Scope
All pages under `packages/web/src/pages/tenant-admin/`:
- HomePage (dashboard summary)
- MembersPage (invite, list, remove)
- ServiceAccountsPage (list, create, detail)
- PATsPage (list, issue, rotate, revoke, detail)
- UsagePage (meters, quotas, forecast, trend, alert-config)
- UsageHistoryPage
- BillingPage (subscription, invoices, cost-trend, upgrade)
- SSOPage (config read/write)
- SecurityPage (login-activity, sessions)
- WebhooksPage (CRUD, test, retry)
- CapabilitiesPage (plan/quota summary)

### What to check
1. API gọi đúng endpoint (qua `defaultCoreApiAdapter`)
2. Response shape match frontend expectations
3. Auth/permission scoping: tenant user chỉ thấy data của tenant mình
4. Empty/loading/error states render đúng
5. Mutations (create, issue, revoke, rotate) return feedback + refresh list

### How
- Manual: log network requests, check response JSON vs UI output
- Unit: add contract tests matching each adapter call to BE response

---

## P3: i18n AdminCore* pages

Wrap hardcoded strings trong `AdminCoreTenantsPage.tsx`, `AdminCoreServiceAccountsPage.tsx`,
`AdminCorePATsPage.tsx` qua `useI18n()` hook (LangContext).

### Pattern
```tsx
const { t } = useI18n();
// {'Danh sách tenant'} → {t('adminCoreTenants.title')}
```

### Keys needed (ước lượng)
~30 keys: titles, descriptions, filter labels, table headers, button labels, error messages.

---

## P3: Update load test scripts

### Files
`infra/load-tests/api-load.js` — 5 references to `/api/admin-ops/`.

### Action
Replace with `/api/soc/` equivalents (nếu có) hoặc remove nếu SOC không có same contract.
Hiện `/api/admin-ops/*` → 410 GONE.

---

## Implementation Order

```
Week 1: P0 ── BE operator tenant views (ước ~300 dòng Python)
  ├── OperatorTenantListView + OperatorTenantDetailView
  ├── OperatorTenantServiceAccountListView
  ├── OperatorTenantPATListView
  └── urlpatterns update + tsc check

Week 1-2: P1 ── Response shape alignment (ước ~20 dòng TS)
  └── Frontend parsing fix

Week 2: P1 ── Verify commercial app runtime (kiểm tra 30 phút)
  └── Django shell hoặc API call

Week 2-3: P2 ── SaaS write flows (ước ~200 dòng TS)
  ├── Un-gate ability
  └── Form modals (create SA, issue/rotate/revoke PAT)

Week 3: P2 ── E2E verification (ước 1-2 ngày)
  └── 10 self-service pages × edge cases

Week 4: P3 ── i18n + load test scripts (ước ~100 dòng)
  ├── AdminCore* i18n keys
  └── api-load.js patch
```

---

## Verification

Sau mỗi sub-step:
1. `npx tsc --noEmit` (cho frontend)
2. `npm run build` (cho web package)
3. Gọi API thử với curl hoặc Postman
4. Kiểm tra UI render không lỗi

Cuối step:
- `npx tsc --noEmit` (monorepo)
- `npm run build` (monorepo)
- Test operator endpoint → response shape đúng
- Test self-service page load → data xuất hiện
