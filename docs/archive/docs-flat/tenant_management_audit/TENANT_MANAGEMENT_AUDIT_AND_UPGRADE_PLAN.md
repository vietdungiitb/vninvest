# Tenant Management — Audit & Upgrade Plan

> **Ngày:** 2026-07-18
> **Phạm vi:** packages/web (frontend) + packages/core (backend)
> **Mục tiêu:** Đánh giá toàn diện tính năng Tenant Management, tìm bug/gap, đề xuất nâng cấp đạt chuẩn SaaS thương mại

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Bugs & Technical Issues](#3-bugs--technical-issues)
4. [Security Gaps](#4-security-gaps)
5. [Feature Gaps vs SaaS Standards](#5-feature-gaps-vs-saas-standards)
6. [Quality Observations](#6-quality-observations)
7. [Upgrade Plan](#7-upgrade-plan)
8. [Timeline Summary](#8-timeline-summary)

---

## 1. Executive Summary

Tenant management system đã có nền tảng vững với **13 sub-pages frontend**, **~44 partner API endpoints**, Stripe billing integration, webhook system, audit logging, và lifecycle automation. Tuy nhiên, phân tích phát hiện **15 bugs**, **8 security gaps**, và **12+ feature deficiencies** so với chuẩn SaaS thương mại (Stripe, WorkOS, Auth0, Firebase).

**Ưu tiên:**
- **P0 (5 bugs):** Code duplication nghiêm trọng (_get_request_tenant ×9), role enforcement bị vô hiệu hóa, member limit không enforced
- **P1 (5 bugs):** Invite email không gửi, tenant switching gây reload, hardcoded strings
- **S1 (Critical):** SSO là mock, không có SAML library

---

## 2. System Architecture Overview

### 2.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, CSS Modules |
| Backend | Django 5.x, DRF, Celery + Redis |
| Database | PostgreSQL 16 |
| Auth | JWT (SimpleJWT) + PAT (Personal Access Tokens) |
| Billing | Stripe |
| Queue | Redis (Celery broker) |

### 2.2 File Inventory

#### Frontend — Tenant Admin Pages (13 pages)

| # | File | Lines | Feature |
|---|------|-------|---------|
| 1 | `TenantAdminHomePage.tsx` | 604 | Dashboard: KPI cards, health gauge, onboarding checklist, recent activity, deprovision modal |
| 2 | `TenantAdminMembersPage.tsx` | 411 | Member list + invites: role-filtered table, invite form, cancel invite, remove member |
| 3 | `TenantAdminServiceAccountsPage.tsx` | 365 | Service accounts CRUD: table, create modal, toggle status, delete |
| 4 | `TenantAdminPATsPage.tsx` | 830 | PATs (API tokens): list, create, rotate, revoke, usage analytics, secret reveal |
| 5 | `TenantAdminUsagePage.tsx` | 704 | Usage meters/quotas: meters tab, history tab, forecast tab, analytics tab |
| 6 | `TenantAdminUsageHistoryPage.tsx` | 326 | Dedicated usage history: area/bar chart toggle, meter selector, date range |
| 7 | `TenantAdminBillingPage.tsx` | 599 | Billing: subscription, cost trend, invoices, payment method, plan comparison, upgrade |
| 8 | `TenantAdminCapabilitiesPage.tsx` | 192 | Capabilities/entitlements: plan overview, quota caps, ability map |
| 9 | `TenantAdminAuditLogsPage.tsx` | 420 | Audit logs: filterable, pie chart, daily activity, expandable timeline, cursor pagination |
| 10 | `TenantAdminSSOPage.tsx` | 395 | SAML SSO: IdP config form, SP metadata, ACS URL, test connection |
| 11 | `TenantAdminSecurityPage.tsx` | 340 | Security: login activity chart, failures list, active sessions, revoke |
| 12 | `TenantAdminWebhooksPage.tsx` | 537 | Webhooks CRUD: create/edit, event checkboxes, delivery log, test, retry |
| 13 | `TenantAdminReportsPage.tsx` | 353 | Scheduled reports: create/delete/pause/resume/test, type, schedule, format |

#### Frontend — Supporting Files

| File | Responsibility |
|------|---------------|
| `TenantAdminLayout.tsx` | Shell layout: sidebar + main content area |
| `TenantAdminSidebar.tsx` | Collapsible sidebar with 13 nav items, permission-gated |
| `TenantAdmin.module.css` | CSS tokens for all 13 pages (2475 lines) |
| `PortfolioContext.js` | State: `userTenants`, `switchTenant()`, `activeTenantId`, `ability` |
| `adapters/core/operator.js` | Operator endpoints: tenant CRUD, per-tenant SA/PATs, dashboard |
| `adapters/core/auth.js` | Auth endpoints: tenant lifecycle, login, register, profile |
| `adapters/core/transport.js` | Transport: `tenantIdStorage`, `X-Tenant-ID` header injection |
| `main.tsx` (lines 101-116) | Route definitions: `/tenant-admin` parent with 13 child routes |
| `pageRegistry.js` (lines 258-283) | Lazy-loaded page entries |
| `sidebaritems.ts` (line 46) | Main sidebar entry |

#### Backend — Models

| Model | File | Responsibility |
|-------|------|---------------|
| `CoreTenant` | `identity_access/models.py:42` | Tenant entity: plan, status, Stripe fields, quotas |
| `TenantMember` | `identity_access/models.py:472` | Tenant-user membership: role (owner/admin/editor/viewer) |
| `TenantInvite` | `identity_access/models.py:536` | Invitation: email, token, role, expiry |
| `CoreServiceAccount` | `identity_access/models.py:135` | Service accounts: name, status, scopes |
| `CorePATCredential` | `identity_access/models.py:193` | API tokens: label, token hash, expiry, CIDR |
| `TenantSSOConfig` | `identity_access/models.py:995` | SAML SSO config: IdP URL, cert, ACS URL |
| `TenantWebhookConfig` | `identity_access/models.py:1237` | Webhook: URL, HMAC secret, events, retry |
| `TenantLifecycleEvent` | `tenant_lifecycle/models.py:5` | Audit trail: plan/status changes, member events |
| `UsageAlertConfig` | `identity_access/models.py:1021` | Per-tenant alert thresholds |
| `ScheduledReport` | (in identity_access) | Scheduled report configs |
| `PATAuditLog` | `identity_access/models.py:351` | Per-PAT request audit log |
| `UserProfile` | `identity_access/models.py:407` | User profile: display_name, language, theme |

#### Backend — API Endpoints

| Namespace | Count | Purpose |
|-----------|-------|---------|
| `/core/v1/onboarding/*` | ~3 | Tenant creation (self-service) |
| `/core/v1/tenant-members/*` | ~6 | Member management |
| `/core/v1/partner/*` | ~44 | Tenant self-admin (dashboard, billing, usage, webhooks, etc.) |
| `/core/v1/operator/tenants/*` | ~5 | Super-admin cross-tenant management |
| `/core/v1/auth/sso/*` | ~3 | SSO login/callback/metadata |

#### Backend — Permission Model

| Permission | Scope | Usage |
|-----------|-------|-------|
| `IsCoreOperator` | `is_staff` or `is_superuser` | Operator admin endpoints |
| `IsTenantActive` | Blocks suspended/deprovisioned | All partner endpoints |
| `TenantScopePermission` | Resolves `request.tenant` | User workspace views |
| `_require_tenant_role()` | `owner`/`admin` only | Member, SSO, webhook management |
| `require_pat_scopes_or_human_session()` | PAT scope check | All partner endpoints |

---

## 3. Bugs & Technical Issues

### 3.1 P0 — Critical Bugs

#### B1: `_get_request_tenant()` duplicated 9 times

**Severity:** Critical
**Files:**
- `views_tenant.py:120`
- `tenant_member_views.py:31`
- `views_webhooks.py:34`
- `views/sso.py:20`
- `views_dashboard.py:20`
- `views_security.py:20`
- `views_alert_config.py:15`
- `views_usage.py:23`
- `views_forecast.py:19`

**Impact:** Each implementation has slightly different fallback logic. `views_tenant.py` supports staff cross-tenant access via `service_account_id` in request data. Others do not. This creates inconsistent behavior across endpoints and is a maintenance nightmare.

**Recommendation:** Extract to a single shared utility `resolve_tenant.py` and import everywhere.

---

#### B2: `_require_tenant_role()` duplicated 3 times

**Severity:** Critical
**Files:**
- `tenant_member_views.py:95`
- `views/sso.py:38`
- `views_tenant.py:200`

**Impact:** Same function reimplemented with minor differences.

---

#### B3: `_get_request_tenant_role()` duplicated 3 times

**Severity:** High
**Files:**
- `tenant_member_views.py:68`
- `views/sso.py:29`
- `views_tenant.py:173`

---

#### B4: Editor/Viewer roles NOT enforced

**Severity:** Critical
**Evidence:** All 24 calls to `_require_tenant_role()` only pass `'owner', 'admin'`:

```
tenant_member_views.py:109  → _require_tenant_role(request, 'owner', 'admin')
tenant_member_views.py:129  → _require_tenant_role(request, 'owner', 'admin')
tenant_member_views.py:182  → _require_tenant_role(request, 'owner', 'admin')
tenant_member_views.py:265  → _require_tenant_role(request, 'owner', 'admin')
tenant_member_views.py:304  → _require_tenant_role(request, 'owner', 'admin')
views_tenant.py:223,234,240,251,297,308,398,430,481,569,610,646 → all 'owner', 'admin'
views/sso.py:55,64 → all 'owner', 'admin'
```

**Impact:** An `editor` member has the same API access as `admin` for most operations. The `viewer` role is effectively ignored. Role system is broken.

---

#### B5: Member limit per plan NOT enforced

**Severity:** Critical
**Files:**
- `views_webhooks.py:195-200` — `features_map` defines per-plan member limits
- `tenant_member_views.py:126-165` — `TenantInvitesCombinedView.post()` (invite endpoint, no limit check)

**Evidence:** `PreviewPlanChangeView` at `views_webhooks.py:195` defines limits:
```python
features_map = {
    'free': {'api_calls': 1000, 'members': 3, ...},
    'starter': {'api_calls': 10000, 'members': 5, ...},
    'pro': {'api_calls': 50000, 'members': 25, ...},
    'enterprise': {'api_calls': None, 'members': None, ...},
}
```

But the invite endpoint (`TenantInvitesCombinedView.post()` at `tenant_member_views.py:126`) does NOT check `members` limit before creating invite. Free plan user can invite unlimited members.

---

### 3.2 P1 — Medium Bugs

#### B6: `activeTenantId` not reactive

**Severity:** Medium
**File:** `PortfolioContext.js:298`

```javascript
activeTenantId: typeof window !== "undefined" && window.localStorage
  ? window.localStorage.getItem("tenant_id")
  : null
```

Reads from `localStorage` on every render, not wrapped in state. Only works because `switchTenant()` calls `window.location.reload()`.

---

#### B7: Tenant switching causes full page reload

**Severity:** Medium
**File:** `PortfolioContext.js` — `switchTenant()`

```javascript
switchTenant = (tenantId) => {
  localStorage.setItem("tenant_id", tenantId);
  window.location.reload();  // Full page refresh
};
```

**Impact:** Loses all React state, causes white flash, poor UX.

---

#### B8: Welcome email is a stub

**Severity:** Medium
**File:** `onboarding_views.py:29-36`

```python
def _enqueue_welcome_email(user, tenant):
    # TODO(T08-follow-up): Wire to actual mail queue task when available
    pass
```

New tenants never receive a welcome email.

---

#### B9: Invite email not sent

**Severity:** High
**File:** `tenant_member_views.py:156-165`

Invite record is created with a token, but no email is sent. Invitee has no way to know about the invite unless the token is shared out-of-band.

---

#### B10: Hardcoded Vietnamese strings bypass i18n

**Severity:** Medium
**Files:**
- `TenantAdminPATsPage.tsx:559` — `+ Tạo Service Account`
- `TenantAdminPATsPage.tsx:727` — `Không có quyền hạn`
- `TenantAdminPATsPage.tsx:741-743` — `30 ngày`, `90 ngày`, `1 năm`
- `TenantAdminPATsPage.tsx:784` — `✓ Hết hạn vào:`
- `TenantAdminPATsPage.tsx:788` — `⚠ Hoạt động vô thời hạn...`
- `TenantAdminSSOPage.tsx:303,327` — Reuses `tenantPats.copySuccess` instead of `tenantSSO.*`

---

### 3.3 P2 — Code Quality

| # | Issue | File |
|---|-------|------|
| B11 | Duplicate `Interface ApiUsageAnalyticsResponse` declaration | `TenantAdminUsagePage.tsx:61-72` |
| B12 | SSO page reuses `tenantPats.*` i18n keys for copy button | `TenantAdminSSOPage.tsx:303,327` |
| B13 | Security page reuses `tenantHome.*` i18n keys for timeAgo | `TenantAdminSecurityPage.tsx:61-67` |
| B14 | No error logging in deprovision catch block | `TenantAdminHomePage.tsx:169-181` |
| B15 | `createElement` used instead of JSX in layout components | `TenantAdminLayout.tsx`, `TenantAdminSidebar.tsx` |

---

## 4. Security Gaps

### S1: SSO is a mock — CRITICAL

**File:** `views/sso.py:74-223` (`SSOLoginInitiateView` at line 74, `SSOCallbackView` at line 121-223)

The SSO implementation does NOT use any SAML library:
- `SSOLoginInitiateView` just returns the IdP SSO URL without generating an AuthnRequest
- `SSOCallbackView` expects `email` and `domain` in the POST body directly — no SAML Response parsing, no signature verification

```python
# Build SAML AuthnRequest redirect URL (simplified - in production use python3-saml)
# For now, return the IdP SSO URL for frontend to redirect
return Response({
    'sso_url': sso_config.idp_sso_url,
    ...
})
```

```python
class SSOCallbackView(APIView):
    def post(self, request):
        # In production, parse SAML Response here using python3-saml
        # For now, mock implementation expecting email in request body
        email = request.data.get('email', '').strip().lower()
```

**Impact:** Anyone can POST to the callback with any email to gain access. Enterprise SSO is non-functional.

---

### S2: SSO callback creates users without email verification — HIGH

**File:** `views/sso.py:167-173`

```python
user, created = User.objects.get_or_create(
    email=email,
    defaults={
        'username': email.split('@')[0],
        'email': email,
    }
)
```

- No email verification
- `username=email.split('@')[0]` can collide with existing users
- User is created with default permissions

---

### S3: No MFA/2FA management — HIGH

No UI or API for enforcing or managing multi-factor authentication. Enterprise tenants cannot require MFA for their members.

---

### S4: No IP allowlisting — MEDIUM

Security page shows login activity and active sessions, but there is no IP whitelist/firewall configuration for tenant-level access control.

---

### S5: No throttle on invite creation — MEDIUM

**File:** `tenant_member_views.py:126`

An admin can flood the system with thousands of invites without rate limiting.

---

### S6: PAT authentication mutates User object in-memory — LOW

**File:** `authentication.py:57-58`

```python
owner.is_staff = False
owner.is_superuser = False
```

This mutates the Django User object in-memory during the request. While not persisted to DB, it could affect other code on the same request.

---

### S7: Deprovision doesn't create lifecycle event — LOW

**File:** `views_webhooks.py:231-232`

```python
tenant.status = CoreTenant.StatusChoices.DEPROVISIONED
tenant.save(update_fields=['status'])
```

Status is set directly without creating a `TenantLifecycleEvent` record. The async task cleans up data but doesn't log the event.

---

### S8: Webhook secret regenerate doesn't revoke old secret — LOW

When regenerating a webhook secret, the old secret remains valid until the next delivery. No grace period or immediate revocation mechanism.

---

## 5. Feature Gaps vs SaaS Standards

### 5.1 Comparison Matrix

| Feature | vninvest | Stripe | WorkOS | Auth0 | Firebase |
|---------|----------|--------|--------|-------|----------|
| Tenant CRUD | Partial | Full | Full | Full | Full |
| Tenant settings (name/logo/timezone) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ✅ | ✅ | ✅ | ✅ |
| Custom RBAC roles | ❌ Fixed 4 | ✅ | ✅ | ✅ | ✅ |
| Member limit enforcement | ❌ | ✅ | ✅ | ✅ | ✅ |
| Invite email | ❌ Stub | ✅ | ✅ | ✅ | ✅ |
| Welcome email | ❌ Stub | ✅ | ✅ | ✅ | ✅ |
| Bulk member operations | ❌ | ✅ CSV | ✅ | ✅ | ❌ |
| Tenant switching (no reload) | ❌ Full reload | N/A | ✅ | ✅ | ✅ |
| React Query caching | ❌ Raw useState | N/A | N/A | N/A | N/A |
| SSO (real SAML) | ❌ Mock | N/A | ✅ | ✅ | ❌ |
| MFA/2FA | ❌ | N/A | ✅ | ✅ | ✅ |
| IP allowlisting | ❌ | ✅ | ✅ | ✅ | ❌ |
| Data export before delete | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tenant branding/themes | ❌ | ✅ | ✅ | ❌ | ❌ |
| Error boundary | ❌ | N/A | N/A | N/A | N/A |
| Unit tests | ❌ Only visual | N/A | N/A | N/A | N/A |
| Audit log retention config | ❌ Hardcoded | ✅ | ✅ | ✅ | ✅ |
| Webhook payload inspection | ❌ Only status | ✅ | ✅ | ✅ | ❌ |
| Deprovision data archival | ❌ | ✅ | ✅ | ✅ | ✅ |
| Plan feature gates | Partial (defined, not enforced) | ✅ | ✅ | ✅ | ✅ |

### 5.2 Missing Features Detail

| Gap | Severity | Notes |
|-----|----------|-------|
| **No tenant creation UI** | MEDIUM | Tenants created via backend/onboarding only. No admin UI to create tenants. |
| **No tenant settings page** | MEDIUM | No dedicated page for name, logo, timezone, custom domain. SSO page is closest. |
| **No custom RBAC** | HIGH | Roles fixed to owner/admin/editor/viewer. No custom role creation or permission matrix editor. |
| **No bulk member ops** | LOW | No bulk invite, bulk remove, or CSV import for members. |
| **No tenant deletion (self-service)** | LOW | Deprovision exists but is destructive nuclear option, not soft-delete or trial cancellation. |
| **No tenant branding** | LOW | No custom domain, logo upload, or color theme for tenant console. |
| **No webhook payload inspection** | LOW | Delivery log shows status/response code but no raw request/response body viewer. |
| **No per-member activity log** | LOW | Audit logs exist but no per-member activity timeline. |
| **No IP allowlisting** | MEDIUM | Security page shows sessions but no IP whitelist configuration. |
| **No MFA/2FA** | HIGH | No UI for enforcing or managing multi-factor authentication. |
| **No tenant-level API key scoping** | LOW | PATs scoped to service accounts; no additional tenant-wide API key restrictions. |
| **Alert config UI read-only** | LOW | `getAlertConfigs()` called but no UI to edit warning/critical thresholds. |

---

## 6. Quality Observations

### 6.1 Strengths

- **Consistent architecture:** All 13 pages follow `ShellPageChrome` + `ShellPanel` pattern with consistent error/loading/empty states
- **Full i18n coverage:** ~200+ Vietnamese translation keys for tenant admin
- **Ability-gated UI:** Every page and sidebar item checks permissions before rendering
- **Visual regression tests:** Playwright screenshot tests across 3 viewports for 8 routes
- **Responsive design:** CSS media queries for mobile/tablet/desktop
- **Type safety:** TypeScript interfaces for all major data shapes
- **Strong tenant isolation:** Explicit FK on all models, middleware enforcement, 15+ isolation tests
- **Comprehensive audit logging:** Lifecycle events + PAT audit logs + webhook signals
- **Complete webhook system:** CRUD, HMAC signing, async delivery, retry
- **Full lifecycle automation:** Trial expire, quota suspend, deprovision

### 6.2 Areas for Improvement

- **No React Query/SWR:** Every page fetches data on mount with raw `useState` + `useEffect`. No caching, no deduplication, no optimistic updates, no background refetch.
- **No unit tests for tenant pages:** Only visual regression tests exist. No unit/component tests for Members, PATs, Webhooks, etc.
- **Inline styles:** Heavy use of inline styles alongside CSS module tokens. Many style objects are constructed in JSX.
- **`createElement` in layout:** `TenantAdminLayout.tsx` and `TenantAdminSidebar.tsx` use `createElement` instead of JSX.
- **Tenant switching requires full reload:** `switchTenant()` calls `window.location.reload()`.
- **No ErrorBoundary:** No `ErrorBoundary` wrapping the tenant admin subtree.

---

## 7. Upgrade Plan

### Phase 1 — Fix Critical Bugs & Security (Week 1-2)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 1.1 | Extract `_get_request_tenant()` → single shared utility `resolve_tenant.py` | New `resolve_tenant.py` + update 9 view files | 2h |
| 1.2 | Extract `_require_tenant_role()` → single shared utility in `permissions.py` | New `permissions.py` + update 3 view files | 1h |
| 1.3 | Extract `_get_request_tenant_role()` → shared utility | New `permissions.py` + update 2 view files | 0.5h |
| 1.4 | Enforce editor/viewer roles — editor: write, viewer: read only | `views_tenant.py`, `views_webhooks.py`, `views_usage.py`, etc. | 3h |
| 1.5 | Enforce member limit per plan before invite/accept | `tenant_member_views.py` (invite + accept views) | 2h |
| 1.6 | Fix hardcoded Vietnamese strings → i18n keys | `TenantAdminPATsPage.tsx`, `TenantAdminSSOPage.tsx` | 1h |
| 1.7 | Add ErrorBoundary for tenant admin subtree | New `TenantAdminErrorBoundary.tsx` + wrap in `TenantAdminLayout.tsx` | 1h |
| 1.8 | Fix `activeTenantId` reactivity — use state + localStorage sync | `PortfolioContext.js` | 1h |

**Total Phase 1: ~11.5h**

---

### Phase 2 — Email & Invitation System (Week 2-3)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 2.1 | Wire welcome email — replace stub with Celery email task | `onboarding_views.py`, new `email_tasks.py` | 4h |
| 2.2 | Create email templates (HTML) for welcome + invite | New `templates/email/` directory | 3h |
| 2.3 | Wire invite email — send invite link with token | `tenant_member_views.py`, `email_tasks.py` | 4h |
| 2.4 | Add invite throttle (max 10/hour per tenant) | `tenant_member_views.py` + DRF throttle | 1h |
| 2.5 | Add member count limit check on invite accept | `tenant_member_views.py` accept view | 2h |

**Total Phase 2: ~14h**

---

### Phase 3 — Tenant Settings & Branding (Week 3-4)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 3.1 | Add `TenantSettings` model (name, logo_url, timezone, locale, theme) | New migration, `models.py` | 3h |
| 3.2 | Add `GET/PUT /partner/settings/` API | New view + serializer | 3h |
| 3.3 | Create `TenantAdminSettingsPage.tsx` — form for name, timezone, logo upload | New page + route + CSS | 5h |
| 3.4 | Add tenant settings to sidebar navigation | `TenantAdminSidebar.tsx`, `sidebaritems.ts`, `main.tsx` | 1h |
| 3.5 | Add logo upload endpoint with image processing | New view + storage backend | 3h |

**Total Phase 3: ~15h**

---

### Phase 4 — Custom RBAC (Week 4-5)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 4.1 | Add `TenantCustomRole` model (name, permissions JSON array) | New migration, `models.py` | 3h |
| 4.2 | Add `GET/POST/PATCH/DELETE /partner/roles/` API | New views + serializers | 4h |
| 4.3 | Create `TenantAdminRolesPage.tsx` — role CRUD with permission matrix UI | New page + components | 6h |
| 4.4 | Update `_require_tenant_role()` to resolve custom roles | `permissions.py` | 3h |
| 4.5 | Update member invite form to support custom role selection | `TenantAdminMembersPage.tsx` | 2h |
| 4.6 | Add role assignment on member accept | `tenant_member_views.py` accept view | 1h |

**Total Phase 4: ~19h**

---

### Phase 5 — Real SAML SSO (Week 5-6)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 5.1 | Integrate `python3-saml` library | `requirements.txt`, new `saml_service.py` | 6h |
| 5.2 | Rewrite `SSOLoginInitiateView` — generate real AuthnRequest with redirect | `views/sso.py` | 4h |
| 5.3 | Rewrite `SSOCallbackView` — parse SAML Response, verify signature, extract attributes | `views/sso.py` | 6h |
| 5.4 | Add SSO metadata endpoint (`/core/v1/auth/sso/metadata/`) | New view | 2h |
| 5.5 | Add email verification on SSO user creation | `views/sso.py` | 2h |
| 5.6 | Add SSO connection test API (validate IdP config) | New endpoint in `views/sso.py` | 2h |

**Total Phase 5: ~22h**

---

### Phase 6 — UX Improvements (Week 6-7)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 6.1 | Tenant switching without page reload — use React state + refetch | `PortfolioContext.js`, `Sidebar.tsx` | 4h |
| 6.2 | Add React Query for tenant admin data fetching (all 13 pages) | All `TenantAdmin*.tsx` pages | 8h |
| 6.3 | Add loading skeletons for all tenant admin pages | All `TenantAdmin*.tsx` pages | 4h |
| 6.4 | Convert `createElement` to JSX in layout components | `TenantAdminLayout.tsx`, `TenantAdminSidebar.tsx` | 1h |
| 6.5 | Add toast notifications for all mutations (invite, remove, rotate, etc.) | All pages with mutations | 3h |

**Total Phase 6: ~20h**

---

### Phase 7 — Data Archival & Compliance (Week 7-8)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 7.1 | Complete deprovision cleanup — add SA, audit logs, reports, alert configs | `tasks.py:420` | 3h |
| 7.2 | Add data export before deprovision (`GET /partner/export/`) | New view + Celery task | 5h |
| 7.3 | Add audit log retention config per plan | `CoreTenant` model + settings API | 3h |
| 7.4 | Add `pending_activation` status workflow | `views_tenant.py`, lifecycle tasks | 2h |
| 7.5 | Add webhook payload inspection (raw request/response body) | `TenantAdminWebhooksPage.tsx` + new endpoint | 3h |
| 7.6 | Add deprovision lifecycle event logging | `views_webhooks.py` DeprovisionView | 1h |

**Total Phase 7: ~17h**

---

### Phase 8 — Testing & Hardening (Week 8-9)

| Step | Task | Files to Modify | Effort |
|------|------|-----------------|--------|
| 8.1 | Unit tests for all tenant admin pages (RTL) | New `__tests__/` directories | 8h |
| 8.2 | API integration tests for partner endpoints | New test files in `backend/tests/` | 6h |
| 8.3 | Security tests: cross-tenant isolation, role bypass attempts | New security test files | 4h |
| 8.4 | E2E tests: invite flow, SSO flow, billing flow | Playwright tests | 6h |
| 8.5 | Update i18n scan to catch hardcoded strings | `npm run i18n:scan` config | 1h |

**Total Phase 8: ~25h**

---

## 8. Timeline Summary

| Phase | Weeks | Effort (hours) | Deliverable |
|-------|-------|----------------|-------------|
| Phase 1: Fix Critical Bugs & Security | 1-2 | ~11.5h | All P0 bugs fixed, code deduplication, role enforcement |
| Phase 2: Email & Invitation System | 2-3 | ~14h | Welcome email + invite email working |
| Phase 3: Tenant Settings & Branding | 3-4 | ~15h | Settings page, logo upload, timezone config |
| Phase 4: Custom RBAC | 4-5 | ~19h | Custom roles, permission matrix |
| Phase 5: Real SAML SSO | 5-6 | ~22h | python3-saml integration, real SSO flow |
| Phase 6: UX Improvements | 6-7 | ~20h | No-reload switching, React Query, loading skeletons |
| Phase 7: Data Archival & Compliance | 7-8 | ~17h | Full deprovision, data export, audit retention |
| Phase 8: Testing & Hardening | 8-9 | ~25h | Unit/integration/security/E2E tests |
| **TOTAL** | **9 weeks** | **~143.5h** | Production-ready tenant management |

---

## Appendix A: Plan Features Map (Reference)

```python
PLAN_FEATURES = {
    'free':       {'api_calls': 1000,   'members': 3,   'sso': False, 'webhooks': False, 'audit_days': 7},
    'starter':    {'api_calls': 10000,  'members': 5,   'sso': False, 'webhooks': False, 'audit_days': 7},
    'pro':        {'api_calls': 50000,  'members': 25,  'sso': True,  'webhooks': True,  'audit_days': 30},
    'enterprise': {'api_calls': None,   'members': None, 'sso': True,  'webhooks': True,  'audit_days': 90},
}
```

---

## Appendix B: Tenant Status Lifecycle

```
                    ┌─────────────────┐
                    │ pending_activation│
                    └────────┬────────┘
                             │ activate
                             ▼
┌─────────┐  trial_expire  ┌────────┐  quota_exceed  ┌────────────┐
│  trial   │──────────────▶│ active │───────────────▶│ suspended  │
└─────────┘                └────────┘                └─────┬──────┘
                             ▲                             │
                             │     30 days stale           │
                             └─────────────────────────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │deprovisioned │
                                                    └──────────────┘
```

---

## Appendix C: i18n Keys Reference (Tenant Admin)

| Namespace | Pages |
|-----------|-------|
| `tenantHome.*` | Dashboard, onboarding checklist, status, deprovision |
| `tenantMembers.*` | Member list, invite form, role labels |
| `tenantServiceAccounts.*` | SA CRUD, status, policies |
| `tenantPats.*` | PAT list, create, rotate, revoke, usage |
| `tenantUsage.*` | Meters, quotas, history, forecast, analytics |
| `tenantUsageHistory.*` | History charts, date range |
| `tenantBilling.*` | Subscription, invoices, plans, Stripe |
| `tenantCapabilities.*` | Entitlements, quota caps |
| `tenantAuditLogs.*` | Event types, filters, timeline |
| `tenantSSO.*` | SAML config, test connection |
| `tenantSecurity.*` | Login activity, sessions, revoke |
| `tenantWebhooks.*` | CRUD, events, delivery logs |
| `tenantReports.*` | Scheduled reports, type, schedule |
