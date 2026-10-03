# COMPREHENSIVE CODEBASE INTEGRITY & COMPLIANCE AUDIT
**Date**: June 16, 2026  
**Auditor**: SaaS Transition Security & Compliance Team  
**Status**: DRAFT (Review-Ready)  

---

## 1. Executive Summary

### 1.1 Transition Status
The transition of VNInvest from a legacy architecture to a SaaS-native infrastructure is significantly advanced. The root `backend/` legacy directory has been successfully deprecated and disabled in Docker Compose configurations. Development has officially cut over to:
1. **Backend API Service**: `packages/core` (core-api)
2. **Web Frontend**: `packages/web`

However, this audit reveals critical functional and architectural gaps, severe security vulnerabilities, and inconsistencies with core constitutional API invariants that must be remediated prior to full production cutover. 

### 1.2 Core Audit Summary
The audit was executed by three specialized subagents across three focus areas:
- **Explorer 1**: SaaS Migration Status & Parity
- **Explorer 2**: Tenant Isolation & Security Audit
- **Explorer 3**: Constitutional Invariants Compliance Check

This synthesis combines their findings into a prioritized remediation roadmap. Key concerns include:
1. **Unmapped Routes**: Critical workspace, AI advisory, and ad-server views are imported or defined but omitted from URLs.
2. **Tenant Isolation Overrides**: Viewsets and endpoints bypass default `IsTenantActive` permission classes, leaving paid services open to suspended tenants.
3. **Severe PAT Scope/Crash Bug**: The `issue_pat` view lacks DRF decorators entirely, resulting in scope validation bypasses and application crashes.
4. **Billing Lockout Loop**: Suspended accounts are locked out of Stripe sessions, preventing self-reactivation.
5. **Operator Log Leakage**: Shadow run parity log lists are exposed to ordinary tenant users.
6. **Invariant Violations**: OpenAPI documentation gaps, non-conforming custom error responses, manual pagination/slicing, and unexempted Swagger UI paths.

---

## 2. SaaS Migration Status & Parity (Explorer 1 Synthesis)

### 2.1 Legacy Backend Decommissioning
The root legacy backend (`backend/`) has been successfully decommissioned. Its database configurations and Docker mappings have been removed from runtime compose profiles. However, legacy components in the frontend continue to make requests referencing legacy endpoints, and dead shim views remain in the repository.

### 2.2 Unmapped Backend URL Routes
Multiple newly implemented views and routes are imported but completely omitted from active Django `urlpatterns`:

#### A. Screener API Views
- **File**: `packages/core/backend/src/user_workspace/urls.py`
  - Lines 24–25 import `PortfolioScreenerRuleDetailView` and `PortfolioScreenerRuleRunView` but do not map them in `urlpatterns`.
- **File**: `packages/core/backend/src/user_workspace/views.py`
  - Class `ScreenerRuleListCreateAPIView` (lines 430–454) is defined but neither imported nor mapped in `user_workspace/urls.py`.

#### B. AI Advisory API Views
- **File**: `packages/core/backend/src/user_workspace/urls.py`
  - Lines 15–18 import the following views, but none are registered in `urlpatterns`:
    - `PortfolioAIAdvisoryCanonicalView`
    - `PortfolioAIAdvisoryCurrentView`
    - `PortfolioAIAdvisoryAutoRefreshInfoView`
    - `PortfolioAIAdvisoryRefreshView`
- **Resulting Impact**: Screener and AI Advisory features are completely unreachable, resulting in `404 Not Found` errors for clients.

#### C. Frontend Path Discrepancies
- **File**: `frontend/src/api/client.js`
  - Requests for `/portfolio/screener/rules/` and `/portfolio/ai-advisory/.../canonical/` bypass `withCoreBase()`. Consequently, they are directed to the base path `/api/portfolio/` instead of `/core/v1/workspace/` or `/core/v1/advisory/`.
  - Because `vninvest_core/urls.py` lacks an `/api/portfolio/` handler, these requests fail.

#### D. Ad Server Public Endpoints
- **File**: `packages/core/backend/src/vninvest_core/urls.py`
  - Line 47 includes only the operator endpoints:
    ```python
    path('core/v1/', include(('advertising.urls', 'advertising'), namespace='advertising')),
    ```
  - The public routes defined in `packages/core/backend/src/advertising/api_urls.py` (e.g., `ContentDisplayView`, `MetricsLogViewView`, and `MetricsLogClickView`) are completely omitted from the root URL router and unreachable.

### 2.3 Ad Server Integration Gaps
The new Ad Server has not been integrated into the system settings, Celery task runner, or web client.
- **Django Settings**: `packages/core/backend/src/vninvest_core/settings.py` lacks the `CORE_AD_SIGNING_SECRET` environment variable/setting, breaking ad click signature verification.
- **Celery Gaps**: Background tasks `aggregate_ad_metrics` and `rebuild_ads_cache_index` are missing from `CELERY_BEAT_SCHEDULE` in `settings.py`, meaning ad click/view logs will never be materialized or aggregated.
- **Frontend Gaps**: No ad adapters exist under `packages/web/src/adapters/core/`, and no components are defined in the SaaS frontend to render ads.

### 2.4 Candidates for Decommissioning
The following dead or redundant files are safe to delete:
1. **Backend**:
   - `packages/core/backend/src/user_workspace/legacy_views.py`: Contains compat shims (e.g., `PortfolioAnalyticsStubView`) that are never imported.
   - `packages/core/backend/src/market_data/public_urls.py`: Defines legacy `/stock-management/` rules that have been replaced by native Core views.
2. **Frontend** (in `frontend/src/`):
   - `pages/StockDetail.jsx` (superseded by `StockDetailPageHost.jsx`).
   - `pages/PortfolioManagement.jsx` (unused).
   - `pages/ResetPassword.jsx` and `VerifyEmail.jsx` (superseded by packages under `@vninvest/web`).
   - In `App.jsx`, `WhaleAlertsDashboard` is imported but never routed.

---

## 3. Tenant Isolation & Security Audit (Explorer 2 Synthesis)

### 3.1 DRF Default Permission Structure
In `vninvest_core/settings.py` (lines 194–203), DRF is configured with default permission classes requiring authentication and active tenant status:
```python
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        'identity_access.permissions.IsTenantActive',
    ],
    ...
}
```

### 3.2 View-Level Bypasses of `IsTenantActive`
Multiple paid domain views override `permission_classes` with `[permissions.IsAuthenticated]` or `[IsAuthenticated]`, completely removing the default `IsTenantActive` safety check. This allows suspended or deprovisioned tenants to access paid services:

| Affected Module | File Path | View / Endpoint Class |
| :--- | :--- | :--- |
| **Advisory** | `advisory/views.py` | `AdvisoryLatestView` (Line 131)<br>`AdvisoryRefreshView` (Line 157)<br>`AdvisoryHistoryView` (Line 416) |
| **Data Ingest** | `data_ingest/views.py` | `UserBackfillTriggerView` (Line 480) |
| **DNSE Creds** | `identity_access/dnse_credential_views.py` | `DNSECredentialView` (Line 34) |
| **Market Data** | `market_data/views.py` | `StockProfileListView`, `StockProfileDetailView`, `DailyPriceListView`, `StockChartView`, `TrackedSymbolsView`, `IntradayPricesView`, `IntradayTapeView` |
| **Market Data (Native)**| `market_data/stock_mgmt_native_views.py` | `StockManagementStockListView`, `StockManagementTechnicalsView`, `StockManagementItemDetailView` |
| **Market Serving** | `market_serving/views.py` | `SymbolSnapshotListView`, `SymbolSnapshotDetailView`, `SessionFactsListView`, `SessionFactsDetailView`, `SessionFactsCvdView` |
| **Signal Intel** | `signal_intelligence/views.py` | All 16 views (e.g., `AlertCenterFeedView`, `AIAlertsFeedView`, `AlertCenterSummaryView`) |
| **Workspace DNSE** | `user_workspace/views_dnse.py` | All views (e.g., `dnse_config_api`, `dnse_sync_accounts_api`, etc.) |

---

### 3.3 Critical Vulnerability: `issue_pat` View Omission
- **Location**: `packages/core/backend/src/identity_access/views_tenant.py` (Line 235)
- **Code**:
  ```python
  def issue_pat(request, service_account_id):
      """Issue a new PAT for a service account (legacy endpoint)."""
      _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
      _require_tenant_role(request, 'owner', 'admin')
      ...
      return Response(_serialize_partner_pat(credential, secret=raw_token), status=status.HTTP_201_CREATED)
  ```
- **Vulnerability**: This function lacks the `@api_view(['POST'])` and `@permission_classes(...)` decorators. Because it is mapped to a URL route in `identity_access/urls.py` (Line 30), it behaves as a vanilla Django view.
- **Risks**:
  1. **DRF Authentication Bypass**: DRF's authentication classes are not executed. The incoming bearer token is not parsed, and `request.auth` remains `None`. Scope checking helpers like `_validate_requested_pat_scopes` fail to run or raise false positives.
  2. **Render Crash**: It returns a DRF `Response` object directly to Django's WSGI handler without content negotiation or renderer initialization. This causes a server rendering crash (`AttributeError` / `AssertionError`) on execution.

---

### 3.4 Stripe Billing Portal Lockout
- **Location**: `identity_access/commercial_partner_views.py`
- **Views**: `PartnerStripeCheckoutSessionView` (Line 136) and `PartnerStripePortalSessionView` (Line 158) enforce `TENANT_PERMISSION_CLASSES` (which contains `IsTenantActive`).
- **Impact**: If a tenant's subscription is suspended for non-payment, their tenant status is set to `suspended`. This permission blocks them from creating a Stripe checkout session or accessing the customer billing portal. They are locked out from paying their invoice to reactivate their account.
- **Contrast**: The underlying views in `commercial/views.py` (`StripeCheckoutSessionView` and `StripePortalSessionView`) correctly override permissions with `[permissions.IsAuthenticated]` to permit reactivating accounts.

---

### 3.5 Operator Audit Log Leakage
- **Location**: `packages/core/backend/src/ops_audit/views_parity.py`
- **Views**: `ParityStatusView` (Line 31), `ParityReportListView` (Line 117), and `ParityLogListView` (Line 162) do not override `permission_classes`.
- **Vulnerability**: By failing to override permission classes, they fall back to the default `[IsAuthenticated, IsTenantActive]`.
- **Impact**: Any authenticated user with an active tenant can query system-wide shadow-run parity reports and logs. Since parity logs contain full HTTP request URIs, query parameters, and execution metadata belonging to *all tenants*, this represents a severe cross-tenant data leakage vulnerability.

---

### 3.6 Multi-Tenant Resolution Header Mismatch
- **Mismatch**:
  - `TenantScopePermission` in `user_workspace/permissions.py` resolves tenant context using the `X-Tenant-Code` header (or `tenant_code`/`tenant` query parameters).
  - `TenantResolutionMiddleware` in `identity_access/middleware.py` resolves tenant context using the `X-Tenant-ID` header (linked to the tenant's `public_id`).
- **Impact**: When a multi-tenant client requests workspace resources using the standard `X-Tenant-ID` header, the middleware resolves it correctly. However, `TenantScopePermission` ignores this header, failing to find `X-Tenant-Code`, and falls back to the user's primary tenant. This results in the client silently receiving data from the wrong tenant.

---

## 4. Constitutional Invariants Check (Explorer 3 Synthesis)

### 4.1 OpenAPI Schema customisation/documentation (Q1)
- **Status**: Gaps identified across critical business domains. Because custom views inherit from `APIView` without defining `serializer_class` or query parameter mappings, `drf-spectacular` generates empty schema descriptions.
- **Affected Views**:
  - `advisory/views.py` (`AdvisoryLatestView`, `AdvisoryRefreshView`, `AdvisoryHistoryView`).
  - `user_workspace/views.py` (`PortfolioListCreateView`, `TransactionListCreateView`, `WatchlistListCreateView`, `WatchlistItemListCreateView`).
  - All views under `identity_access/views/*.py` (onboarding, login, registration, tenant members).
  - `commercial/views.py` (`CreateVNPayPaymentView`, `StripeCheckoutSessionView`, `QuotaListView`, `InvoiceListView`).
  - `data_ingest/views.py` (`IngestJobViewSet`, `IngestRunViewSet`, `SystemBackfillTriggerView`, `UserBackfillTriggerView`).

---

### 4.2 Error Envelope Format Compliance (Q2)
- **Standard Envelope**: Defined in `vninvest_core/exceptions.py` as `StandardErrorEnvelope` which returns `{detail, code, timestamp, request_id}`.
- **Bypasses**: Multiple views bypass `core_api_exception_handler` by returning direct `Response` objects containing custom dictionaries instead of raising exceptions:
  - **`market_data/stock_mgmt_native_views.py`**:
    - Lines 2441, 2450, 2452, 2463, 2467, 2469, etc. return `Response({'ok': False, 'message': '...'}, status=...)`.
  - **`user_workspace/portfolio_analytics_views.py`**:
    - Lines 553, 555, and 571 return `Response({'ok': False, 'message': '...'}, status=400)`.
  - **`identity_access/tenant_member_views.py`**:
    - Line 82 returns `Response(serializer.errors, status=400)`.
    - Lines 93 and 105 return `Response({'error': '...'}, status=409)`.
- **Impact**: Clients receive raw validation errors and custom payloads lacking the required `code`, `timestamp`, and `request_id` tracking fields.

---

### 4.3 Cursor Pagination Compliance (Q3)
- **Setting**: `vninvest_core/settings.py` sets `CursorPagination` as the default.
- **Violations**:
  1. **Page-Number Overrides**: Several views explicitly override the default with `StandardPageNumberPagination`:
     - `data_ingest/views.py` (`IngestJobViewSet`, `IngestRunViewSet`).
     - `user_workspace/views.py` (`PortfolioListCreateView`, `TransactionListCreateView`, `WatchlistListCreateView`, `WatchlistItemListCreateView`, `SubAccountTransactionsAPIView`).
     - `support/views.py` (`SupportTicketViewSet`, `SupportMessageViewSet`).
  2. **Manual Query Slicing**: Several list views bypass the pagination framework entirely and execute manual offset/limit calculations:
     - `advisory/views.py` (`AdvisoryHistoryView` on line 435: `qs[offset: offset + self._PAGE_SIZE]`).
     - `market_data/views.py` (`StockProfileListView` and `DailyPriceListView`).
     - `market_data/stock_mgmt_native_views.py` (`StockManagementStockListView`).
     - `service_ops/views/scheduler.py` (Celery log list).

---

### 4.4 Swagger UI Accessibility (Q4)
- **Exemption Omission**:
  - The OpenAPI schema path `/core/v1/schema/` and Swagger UI `/core/v1/schema/swagger-ui/` are NOT included in the `EXEMPT_PATH_PREFIXES` in `TenantResolutionMiddleware` or `QUOTA_EXEMPT_PATH_PREFIXES` in `TenantQuotaMiddleware`.
- **Impact**:
  1. Authenticated users belonging to suspended tenants are blocked from viewing API documentation.
  2. Successful documentation requests by active tenants increment their daily API quota counter, causing them to exceed limits.
- **CDN Dependency**: Swagger UI settings lack offline asset paths (e.g. `SWAGGER_UI_DIST`), meaning Swagger UI will fail to load in air-gapped production environments.

---

## 5. Actionable Remediation Plan

### 5.1 Prioritized Remediation Matrix

| Issue ID | Description | Severity | Affected Component | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `issue_pat` missing DRF decorators | **Critical** | `identity_access` | Apply `@api_view(['POST'])` and `@permission_classes` decorators. |
| **SEC-02** | Operator Parity logs and status open to all active tenants | **High** | `ops_audit` | Set `permission_classes = [permissions.IsAuthenticated, IsCoreOperator]` on parity views. |
| **SEC-03** | Suspended accounts billing lockout loop | **High** | `identity_access` | Override `permission_classes` to `[permissions.IsAuthenticated]` on Stripe views. |
| **SEC-04** | Header mismatch resolving tenant context | **High** | `user_workspace` | Update `TenantScopePermission` to read resolved `request.tenant` or fallback to `X-Tenant-ID`. |
| **SEC-05** | View-level default bypass of `IsTenantActive` | **Medium**| Multiple | Refactor views overriding `permission_classes` to include `IsTenantActive`. |
| **INV-01** | Custom responses bypassing exception envelope | **Medium**| Multiple | Raise custom subclasses of `CoreAPIException` instead of returning raw dict responses. |
| **INV-02** | Page-number overrides and manual queryset slicing | **Medium**| Multiple | Remove overrides and replace manual queryset slicing with `CoreCursorPagination`. |
| **INV-03** | Schema endpoints blocked by middleware / quota | **Medium**| `vninvest_core` | Exempt `/core/v1/schema/` in `TenantResolution` and `TenantQuota` middleware. |
| **INV-04** | OpenAPI documentation gaps | **Low** | Multiple | Decorate undocumented views with `@extend_schema`. |
| **INV-05** | Swagger UI CDN asset dependencies | **Low** | `vninvest_core` | Configure spectacular to load assets offline (e.g. `drf-spectacular-sidecar`). |

---

### 5.2 Specific Code Snippets and Middleware Adjustments

#### Fix 1: Decorate `issue_pat` in `identity_access/views_tenant.py`
Add standard DRF decorations to ensure token validation is executed and response serialization does not crash:
```python
# location: packages/core/backend/src/identity_access/views_tenant.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from identity_access.permissions import IsTenantActive

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsTenantActive])
def issue_pat(request, service_account_id):
    """Issue a new PAT for a service account (legacy endpoint)."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_role(request, 'owner', 'admin')
    sa = _resolve_issue_target_service_account(request=request, service_account_id=service_account_id)
    
    scopes = _normalize_scope_codes(request.data.get('scope_codes', []))
    expires_at = request.data.get('expires_at')
    label = str(request.data.get('display_name') or request.data.get('label') or '').strip()
    audit_reason = str(request.data.get('audit_reason', '')).strip()
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
    scopes = _validate_requested_pat_scopes(request, sa, scopes)

    credential, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes,
        expires_at=expires_at,
        label=label,
        audit_reason=audit_reason,
    )
    return Response(_serialize_partner_pat(credential, secret=raw_token), status=status.HTTP_201_CREATED)
```

#### Fix 2: Secure Parity Views in `ops_audit/views_parity.py`
Harden parity status and log list views to prevent cross-tenant request metadata leakage:
```python
# location: packages/core/backend/src/ops_audit/views_parity.py
from rest_framework import permissions
from identity_access.permissions import IsCoreOperator

class ParityStatusView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]
    # ...

class ParityReportListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]
    # ...

class ParityLogListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]
    # ...
```

#### Fix 3: Resolve Stripe Billing Lockout loop
Allow suspended tenants to initiate checkout and access the portal by removing the strict `IsTenantActive` requirement:
```python
# location: packages/core/backend/src/identity_access/commercial_partner_views.py
class PartnerStripeCheckoutSessionView(APIView):
    # Allow suspended accounts to initiate payment checkout
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        # ...

class PartnerStripePortalSessionView(APIView):
    # Allow suspended accounts to manage subscriptions
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        # ...
```

#### Fix 4: Standardize Tenant Context Resolution in `TenantScopePermission`
Modify `TenantScopePermission` to read the already resolved `request.tenant` provided by `TenantResolutionMiddleware` or fallback to checking the `X-Tenant-ID` header to align with middleware behavior:
```python
# location: packages/core/backend/src/user_workspace/permissions.py
class TenantScopePermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # 1. Use already resolved middleware context if available
        if getattr(request, 'tenant', None):
            return True

        # 2. Otherwise, look for matching headers (supporting both Code and ID formats)
        tenant_code_hint = (
            request.headers.get('X-Tenant-Code')
            or request.headers.get('X-Tenant-ID')
            or request.query_params.get('tenant_code')
            or request.query_params.get('tenant')
        )
        
        tenant = _resolve_tenant(request.user, tenant_code_hint=tenant_code_hint)
        if not tenant:
            return False
        request.tenant = tenant
        return True
```

#### Fix 5: Replace Raw Dict Returns with `CoreAPIException` Subclasses
Refactor custom helper returns (e.g., in `market_data/stock_mgmt_native_views.py` and `portfolio_analytics_views.py`) to raise standard exceptions. This routes errors through `core_api_exception_handler` to preserve the unified envelope format:

```python
# Instead of returning:
# return Response({'ok': False, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

# Use:
from vninvest_core.exceptions import ValidationErrorException
raise ValidationErrorException(
    detail="advisory_id không hợp lệ.",
    code="invalid_advisory_id"
)

# Instead of returning:
# return Response({'error': 'User is already a member'}, status=status.HTTP_409_CONFLICT)

# Use:
from vninvest_core.exceptions import ConflictErrorException
raise ConflictErrorException(
    detail="User is already a member",
    code="user_already_member"
)
```

#### Fix 6: Exempt Schema Paths in Middleware
Update both the resolution and quota middleware to exempt spectacular/swagger endpoints from tenant blocks and daily usage limits:
```python
# location: packages/core/backend/src/identity_access/middleware.py

class TenantResolutionMiddleware:
    EXEMPT_PATH_PREFIXES = (
        '/health',
        '/api/core/v1/auth/',
        '/core/v1/auth/',
        '/api/public/',
        '/admin/',
        '/static/',
        '/core/v1/schema/',  # Added to prevent documentation access blocks
    )

class TenantQuotaMiddleware:
    QUOTA_EXEMPT_PATH_PREFIXES = (
        '/health',
        '/api/core/v1/auth/',
        '/core/v1/auth/',
        '/api/public/',
        '/admin/',
        '/static/',
        '/core/v1/schema/',  # Added to prevent Swagger page requests depleting tenant quota
    )
```

#### Fix 7: Standardize Cursor Pagination
Replace manual query slicing with standardized cursor pagination components. Example for `AdvisoryHistoryView`:
```python
# location: packages/core/backend/src/advisory/views.py
from vninvest_core.pagination import CoreCursorPagination

class AdvisoryHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTenantActive] # Hardened permission
    pagination_class = CoreCursorPagination
    
    def get(self, request, symbol):
        symbol = _validate_symbol(symbol)
        qs = (
            AdvisoryRecord.objects
            .filter(symbol=symbol, status='generated')
            .order_by('-generated_at', '-pk')
        )
        session_date = request.query_params.get('session_date')
        if session_date:
            qs = qs.filter(session_date=session_date)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AdvisoryRecordSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
            
        serializer = AdvisoryRecordSerializer(qs, many=True)
        return Response(serializer.data)
```
