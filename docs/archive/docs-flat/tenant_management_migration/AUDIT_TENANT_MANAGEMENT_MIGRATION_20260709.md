# Audit: Tenant Management Migration — Legacy vs SaaS

**Date**: 2026-07-09
**Scope**: 3 tầng — legacy frontend (`frontend/`), SaaS frontend (`packages/web/`), backend (`packages/core/backend/src/`)
**Author**: AI audit (phản biện kèm trong tài liệu)

---

## 0. URL Building: Cách adapter build full URL

SaaS `coreApiAdapter` → `transport.js:resolveCoreApiBase()`:
```
env.CORE_API_BASE_URL → env.REACT_APP_CORE_API_BASE_URL → window.CORE_API_BASE_URL → "/core/v1" (default)
```
`coreGet(path)` gọi `fetch("${base}${path}")` → **full URL = `/core/v1${path}`**.

Backend `vninvest_core/urls.py` include chain:
```
/core/v1/operator/  ← include('vninvest_core.contracts.operator.urls')
```

**Kết luận**: Path mapping chính xác, không có sai prefix.

---

## 1. Operator Tenant Sub-resource Endpoints: Missing (P0)

### Call Site vs Registered Route

| Call site (SaaS frontend) | Full URL | Adapter method | Registered route pattern | Backend status |
|---|---|---|---|---|
| `AdminCoreTenantsPage.tsx:78` | `GET /core/v1/operator/tenants/?search=&status=` | `getCoreOperatorTenants` | `(none)` | **404** |
| `AdminCoreTenantsPage.tsx:101` | `GET /core/v1/operator/tenants/{id}/` | `getCoreOperatorTenantDetail` | `(none)` | **404** |
| `AdminCoreServiceAccountsPage.tsx:100-101` | `GET /core/v1/operator/tenants/{id}/service-accounts/` | `getCoreOperatorTenantServiceAccounts` | `(none)` | **404** |
| `AdminCorePATsPage.tsx:103-106` | `GET /core/v1/operator/tenants/{id}/pats/` | `getCoreOperatorTenantPATs` | `(none)` | **404** |

### Backend `contracts/operator/urls.py` — only has:
```
overview/  → OperatorOverviewView
health/    → OperatorHealthView
scraping/  → service_ops.operator_urls
soc/       → service_ops.urls
```

### Legacy frontend (`api/client.js:890-893`)
```
getCoreOperatorTenants          → apiClient.get('/core/v1/operator/tenants/')
getCoreOperatorTenantDetail     → apiClient.get('/core/v1/operator/tenants/${id}/')
getCoreOperatorTenantServiceAccounts → apiClient.get('/core/v1/operator/tenants/${id}/service-accounts/')
getCoreOperatorTenantPATs       → apiClient.get('/core/v1/operator/tenants/${id}/pats/')
```
**Same 404** trên backend mới. Proxy catch‑all (`/api/<path>`) không bắt `/core/v1/*`.

### Có fallback/proxy/gateway khác không?
- `urls.py` line 60: `path('api/<path:remaining>', legacy_proxy_view)` — chỉ bắt `/api/*`.
- `/core/v1/operator/*` không có fallback → **404 là kết luận chắc chắn**.

### Các endpoint khác cũng missing
- `GET /core/v1/operator/jobs/` (operator.js:61)
- `GET /core/v1/operator/audit/requests/` (operator.js:65)
- `GET /core/v1/operator/audit/requests/{id}/` (operator.js:73)

---

## 2. AdminCore* Pages: Write gated + 404 (P0–P1)

### Trạng thái

| Page | Write buttons | Read | Nguồn gốc |
|---|---|---|---|
| AdminCoreTenantsPage | N/A (không có create/update) | **404** — không tải được registry | Missing BE endpoint |
| AdminCoreServiceAccountsPage | Gated: `ability.can = false`; create SA disabled | **404** — không tải được SA list | Missing BE endpoint |
| AdminCorePATsPage | Gated: issue/rotate/revoke all disabled | **404** — không tải được PAT list | Missing BE endpoint |

### `ability = { can: (..._args) => false }`
Hardcode tại dòng 64 (ServiceAccounts) và 64 (PATs). **Chủ ý tạm thời** (feature flag), không phải permission regression — code có ghi rõ "sẽ được nối ở slice viết sau".

### Impact
- **Read bị 404 hoàn toàn** → user không thấy gì ngoài error message.
- **Write bị gate chủ ý** → issue nằm ở missing BE slice, không phải bug UI.

---

## 3. Response Shape Inconsistency

| Page | Pattern | Code evidence |
|---|---|---|
| AdminCoreTenantsPage:120-125 | `response.data` → `registry.data` (items), `registry.summary_cards` | `setRegistry(response.data)` |
| AdminCoreServiceAccountsPage:114-116 | `response.data.data` (items), `response.data.summary_cards` | `serviceAccountResponse.data.data` |
| AdminCorePATsPage:119-121 | `response.data.data` (tokens), `response.data.summary_cards` | `patResponse.data.data` |

### Gốc rễ
Không có **single source of truth** cho response envelope:
- Nếu BE trả `{ data: [...], summary_cards: [...] }` thì TenantsPage đúng, hai page kia sai.
- Nếu BE trả `{ results: [...], summary: [...] }` (DRF pagination default) thì cả 3 đều sai.

Hiện tại chưa có request thật để xác nhận shape BE trả về. Cần:
1. Kiểm tra adapter `coreApiAdapter` có transform middleware không (xem `transport.js` lines 357–371: `coreGet` trả raw `response.json()`, không transform).
2. Xác nhận BE serializer output cho operator endpoints (hiện không tồn tại → không thể verify).

---

## 4. Self-service Tenant Admin Pages (partner/) — Routes & Views Exist, Data Pending (P2)

### Backend
`identity_access/partner_urls.py`: **141 lines, 40+ routes**. `identity_access/commercial_partner_views.py`: **gateway views** delegate đến commercial app models.

### Tiêu chí verification

| Tiêu chí | Status | Evidence |
|---|---|---|
| Routes registered (`/core/v1/partner/*`) | ✅ | `partner_urls.py` — full list |
| Backend views exist | ✅ | `views_tenant.py`, `commercial_partner_views.py`, `views_*.py` |
| Auth/permission scoping | ✅ | `TENANT_PERMISSION_CLASSES`, `require_pat_scopes_or_human_session` |
| Data return (non‑stub) | ⚠️ Partial | Xem phân tích bên dưới |
| SaaS frontend calls BE correctly | ⚠️ Not verified | Chưa test end-to-end |
| DB tables exist + populated | ❓ Unknown | Phụ thuộc commercial app migration status |

### Analysis: data sourcing

| View | Data source | Fallback on ImportError | Trạng thái |
|---|---|---|---|
| `PartnerDashboardSummaryView` | `CoreTenant`, `CorePATCredential`, `CoreServiceAccount`, `TenantLifecycleEvent` | `[]` | **Real query** |
| `PartnerUsageMetersView` | `commercial.models.UsageMeter` | `[]` | **Real query** nếu commercial app loaded |
| `PartnerUsageQuotasView` | `commercial.models.QuotaRecord` | `[]` | **Real query** nếu commercial app loaded |
| `PartnerBillingSubscriptionView` | `commercial.models.Subscription` | Graceful `{status: 'none'}` | **Real query** nếu commercial app loaded |
| `PartnerBillingInvoicesView` | `commercial.models.Invoice` | `[]` | **Real query** nếu commercial app loaded |
| `PartnerUsageHistoryView` | `commercial.models.QuotaHistory` | `[]` | **Real query** nếu commercial app loaded |
| `PartnerCostTrendView` | `commercial.views_analytics.PartnerCostTrendView` | `{'monthly': []}` | Delegation |

**Kết luận**: Không phải stub. Các view có `try/except ImportError` fallback an toàn. Nếu commercial app chưa migrated, data trả về `[]`, cần check runtime behavior.

### SaaS frontend end‑to‑end (P2)
Chưa kiểm tra các page self‑service gọi đúng endpoint qua adapter. Cần chạy thử hoặc review imports từng page.

---

## 5. Usage meters: Không phải stub

Sửa từ bản gốc: `PartnerUsageMetersView` **không** return `[]` cố định. Code:
```python
try:
    from commercial.models import UsageMeter
    ...
    return Response(UsageMeterSerializer(qs, many=True).data)
except ImportError:
    return Response([])
```
Nếu `commercial.models.UsageMeter` import được (commercial app đã migrate), view trả data thật từ DB.

### UX impact (phụ thuộc runtime)
- Nếu commercial app **chưa migrate**: 4 partner views (meters, quotas, invoices, history) trả `[]` → UI Usage page hiển thị "0" hoặc "No data". Cần kiểm tra UI có empty state message không.
- Nếu commercial app **đã migrate**: data sẽ hiển thị.

---

## 6. Route path khác biệt: usage/history vs usage-history

| Legacy | SaaS |
|---|---|
| `/tenant-admin/usage/history` (nested under usage) | `/tenant-admin/usage-history` (flat) |

### Phân tích
- `packages/web/src/main.tsx:100`: `createElement(Route, { path: 'usage-history', ... })`
- `packages/web/src/components/TenantAdminSidebar.tsx:22`: `{ path: 'usage-history', ... }`
- `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx:190`: `{ to: "/tenant-admin/usage-history", ... }`

**Không có alias, redirect, hoặc route nesting** → path khác biệt là **chủ đích** (SaaS chọn flat routing), không phải migration gap. Legacy nested path sẽ không tồn tại trong SaaS router.

---

## 7. i18n

- AdminCore* pages: **hardcoded Vietnamese labels** (`{'Danh sách tenant'}`, `{'Registry'}`, v.v.)
- Không có contract phase requirement bắt buộc dùng LangContext ở admin core pages.
- Nếu migration P0 cần end-user flow → i18n là P3/P4, không phải blocker.

---

## 8. /api/admin-ops/ → 410 GONE

### Backend
```python
re_path(r'^api/admin-ops/.*$', admin_ops_gone)
```
Tất cả `/api/admin-ops/*` routes trả `{'detail': '...', 'code': 'ADMIN_OPS_GONE'}` + HTTP 410.

### Contract views tồn tại nhưng DEACTIVATED
Thư mục `contracts/admin_ops/` có 28 views + URL conf đầy đủ (60 routes). Không được include trong `vninvest_core/urls.py`. Chỉ test backend sử dụng qua `urls_test_admin_ops.py`.

### Downstream dependencies

| Caller | Path | Tác động |
|---|---|---|
| `infra/load-tests/api-load.js:279,308,337,347,428` | `/api/admin-ops/prefetch/warm/`, `/api/admin-ops/runtime-kpi/`, `/api/admin-ops/prefetch/offpeak-ingest/` | Load test scripts — cần cập nhật URL mới (đề xuất `/api/soc/`) |
| SaaS frontend (`packages/web/src/`) | (none) | ✅ Không có reference |
| Legacy frontend (`frontend/src/`) | (none) | ✅ Không có reference (đã được migrate trước đó) |

**Kết luận**: Chỉ load test scripts bị ảnh hưởng. End-user UIs không dùng admin-ops.

---

## Priority Action Items

| Priority | Item | File(s) | Effort |
|---|---|---|---|
| **P0** | Implement BE operator tenant endpoints (tenants list/detail, SAs, PATs, jobs, audit) | `views_operator.py` + `contracts/operator/urls.py` | Medium |
| **P1** | Fix response shape inconsistency — chọn 1 convention (DRF default hoặc custom envelope) | `AdminCore*.tsx` + BE serializer | Small |
| **P1** | Confirm commercial app migration status → verify Usage/Billing views return data | Runtime test trên sandbox | Small |
| **P2** | Un-gate ability + implement write flows (create SA, issue/rotate/revoke PAT) | `AdminCoreServiceAccountsPage.tsx`, `AdminCorePATsPage.tsx` | Medium |
| **P2** | Test SaaS self-service tenant-admin pages end-to-end với backend thật | All pages under `packages/web/src/pages/tenant-admin/` | Medium |
| **P3** | i18n cho AdminCore* pages | `AdminCore*.tsx` | Small |
| **P3** | Update load test scripts để dùng `/api/soc/` thay `/api/admin-ops/` | `infra/load-tests/api-load.js` | Small |

---

## File Reference Map

### SaaS Frontend (toàn bộ tenant-admin + admin core)
- `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminUsageHistoryPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminSecurityPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx`
- `packages/web/src/pages/tenant-admin/TenantAdminCapabilitiesPage.tsx`
- `packages/web/src/pages/admin/AdminCoreTenantsPage.tsx`
- `packages/web/src/pages/admin/AdminCoreServiceAccountsPage.tsx`
- `packages/web/src/pages/admin/AdminCorePATsPage.tsx`
- `packages/web/src/adapters/core/operator.js`
- `packages/web/src/adapters/coreApiAdapter.js`
- `packages/web/src/adapters/core/transport.js`

### Legacy Frontend
- `frontend/src/pages/admin/tenant/TenantAdminHome.jsx`
- `frontend/src/pages/admin/tenant/TenantAdminMembers.jsx`
- `frontend/src/pages/admin/tenant/TenantAdminServiceAccounts.jsx`
- `frontend/src/pages/admin/tenant/TenantAdminPATs.jsx`
- `frontend/src/pages/admin/tenant/TenantAdminUsage.jsx`
- `frontend/src/pages/admin/tenant/TenantAdminBilling.jsx`
- `frontend/src/pages/admin/tenant/TenantAdminSSOPage.jsx`
- `frontend/src/pages/admin/tenant/TenantCapabilities.jsx`
- `frontend/src/pages/AdminCoreTenants.jsx`
- `frontend/src/pages/admin/core/TenantDetail.jsx`
- `frontend/src/api/client.js`

### Backend
- `packages/core/backend/src/vninvest_core/urls.py`
- `packages/core/backend/src/vninvest_core/contracts/operator/urls.py`
- `packages/core/backend/src/vninvest_core/contracts/operator/views.py`
- `packages/core/backend/src/vninvest_core/contracts/admin_ops/urls.py`
- `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py`
- `packages/core/backend/src/identity_access/urls.py`
- `packages/core/backend/src/identity_access/partner_urls.py`
- `packages/core/backend/src/identity_access/views_tenant.py`
- `packages/core/backend/src/identity_access/tenant_member_views.py`
- `packages/core/backend/src/identity_access/views_operator.py`
- `packages/core/backend/src/identity_access/commercial_partner_views.py`
- `packages/core/backend/src/identity_access/views_dashboard.py`
- `packages/core/backend/src/identity_access/views_alert_config.py`
- `packages/core/backend/src/identity_access/views_forecast.py`
- `packages/core/backend/src/identity_access/views_usage_trend.py`
- `packages/core/backend/src/identity_access/views_reports.py`
- `packages/core/backend/src/identity_access/views_security.py`
- `packages/core/backend/src/identity_access/views_webhooks.py`
