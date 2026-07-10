# Tech Spec: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Scope Model

### 1.1 System Boundaries
```
┌─────────────────────────────────────────────────────────────────┐
│                      DJANGO CORE BACKEND                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   /core/v1/      │  │     /api/        │  │  /api/soc/   │  │
│  │  (SaaS Native)   │  │ (Public/Compat)  │  │  (Operator)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                     │          │
│  ┌────────▼─────────────────────▼─────────────────────▼──────┐  │
│  │              vninvest_core/urls.py (Root Router)           │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (packages/web)                    │
│  REACT_APP_CORE_API_BASE_URL → /core/v1/ (target)              │
│  coreApiAdapter.baseURL → /core/v1/ (target)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Domain Apps in Scope

| App | Current Mount(s) | Target Mount | Action |
|-----|------------------|--------------|--------|
| identity_access | `/core/v1/` + `/api/` (api_urls) | `/core/v1/` only | Delete api_urls, merge routes |
| identity_access_partner | `/core/v1/` | `/core/v1/` | No change |
| user_workspace | `/core/v1/` + `/api/` (portfolio/*) | `/core/v1/` only | Remove /api/ mount + legacy stubs |
| market_data | `/core/v1/` + `/api/` (public_urls + duplicate) | `/core/v1/` (+ public_urls decision) | Remove duplicate mount, decide public_urls |
| market_serving | `/core/v1/` + `/api/` (api_urls) | `/core/v1/` only | Delete api_urls, preserve symbol-investigation |
| signal_intelligence | `/core/v1/` + `/api/` (api_urls) | `/core/v1/` only | Delete api_urls |
| commercial | `/core/v1/` + `/api/` (public_urls) | `/core/v1/` + `/api/` (public only) | No change |
| advisory | `/core/v1/` | `/core/v1/` | No change |
| ops_audit | `/core/v1/` | `/core/v1/` | No change |
| support | `/core/v1/` + `/api/support/` | `/core/v1/` only | Remove duplicate mount |
| advertising | `/core/v1/` (operator) + `/api/` (tracking) | Same | No change |
| data_ingest | `/core/v1/` | `/core/v1/` | No change |

---

## 2. Invariants (Bắt buộc tuân thủ)

| Invariant ID | Description | Enforcement |
|--------------|-------------|-------------|
| INV-01 | **Tenant isolation**: All `/core/v1/` endpoints MUST enforce `IsTenantActive` or `IsTenantOwnerOrAdmin` permission | Permission classes on views; audit via grep |
| INV-02 | **OpenAPI schema**: All `/core/v1/` endpoints MUST have complete request/response schemas for auto-doc | drf-spectacular annotations; CI check |
| INV-03 | **Error envelope**: All responses MUST use standard error envelope format | Middleware + serializer validation |
| INV-04 | **Pagination**: All list endpoints MUST implement cursor pagination | BaseListView mixin |
| INV-05 | **No duplicate routes**: Zero functional overlap between `/core/v1/` and `/api/` after cleanup | Automated route diff in CI |
| INV-06 | **Backward compat**: Singular `/operator/mail-config/` MUST coexist with plural `/operator/mail-configs/` | Both routes registered in `identity_access/urls.py` |
| INV-07 | **Health endpoints**: `/core/v1/health` and `/core/v1/capability-bootstrap` MUST remain accessible unauthenticated | Explicit permission classes `AllowAny` |
| INV-08 | **Swagger UI**: `/core/v1/schema/swagger-ui/` MUST load without errors | Smoke test |

---

## 3. API Contracts (Routing Matrix)

### 3.1 `/core/v1/` — Canonical SaaS Native Endpoints

| Domain | Namespace | Base Path | Key Endpoints |
|--------|-----------|-----------|---------------|
| identity_access | `identity_access` | `/core/v1/` | `auth/login`, `auth/me`, `auth/logout`, `access/capabilities`, `onboarding/register`, `tenant`, `service-accounts/*`, `pat/*`, `identity/profile`, `operator/mail-configs/*`, `operator/mail-config/*` |
| identity_access_partner | `identity_access_partner` | `/core/v1/partner/` | `tenant`, `service-accounts/*`, `pats/*`, `usage/meters`, `usage/quotas`, `billing/subscription`, `billing/invoices` |
| user_workspace | `user_workspace` | `/core/v1/workspace/` | `portfolios/*`, `transactions/*`, `watchlists/*`, `whale-analytics`, `ai-command-center` |
| market_data | `market_data` | `/core/v1/stock-management/` | `groups/*`, `tracked-symbols/*`, `price-alerts/*`, `stocks/*` (overview, chart, news, ai-advisory, financials, bars), `portfolio/news-digest` |
| market_serving | `market_serving` | `/core/v1/` | `symbol-snapshot/*`, `session-facts/*`, `realtime/*` (ticker, tickers, intraday, price-board, breadth, whale-feed, rvol, depth-chart, symbol-investigation) |
| signal_intelligence | `signal_intelligence` | `/core/v1/signals/` | `alert-center/*`, `ai-alerts/*`, `whale-feed`, `order-flow/*` |
| commercial | `commercial` | `/core/v1/billing/` | `subscription`, `quota`, `invoices`, `payments/*` |
| advisory | `advisory` | `/core/v1/advisory/` | `latest/<symbol>`, `refresh/<symbol>`, `history/<symbol>` |
| ops_audit | `ops_audit` | `/core/v1/` | `audit-log` |
| support | `support` | `/core/v1/` | `tickets/*`, `staff/*` |
| advertising | `advertising` | `/core/v1/operator/ads/` | `campaigns`, `analytics` |
| data_ingest | `data_ingest` | `/core/v1/data-ingest/` | `jobs`, `runs`, `backfill/*` |

### 3.2 `/api/` — Public & Compatibility (Post-Cleanup)

| Domain | Namespace | Base Path | Endpoints | Status |
|--------|-----------|-----------|-----------|--------|
| commercial_public | `commercial_public` | `/api/public/` | `legal-pages/` | **Keep** |
| market_data_public | `market_data_public` | `/api/stock-management/` | Read-only mirror of core/v1 stock-management | **Decision Pending** |
| advertising_api | `advertising_api` | `/api/v1/` | `content/display/`, `metrics/log/view/`, `metrics/log/click/<uuid>/` | **Keep** |
| service_ops | `service_ops` | `/api/soc/` | 6 ops domains | **Keep** (untouched) |

### 3.3 Deprecated / Removed

| Domain | Old Path | Replacement |
|--------|----------|-------------|
| identity_access (api_urls) | `/api/auth/*`, `/api/core/v1/*`, `/api/onboarding/*`, `/api/operator/*` | `/core/v1/` equivalents |
| signal_intelligence (api_urls) | `/api/signals/*` | `/core/v1/signals/*` |
| user_workspace (api) | `/api/portfolio/*` | `/core/v1/workspace/*` |
| market_serving (api_urls) | `/api/market/*`, `/api/realtime/*` | `/core/v1/` equivalents |
| support (api) | `/api/support/*` | `/core/v1/` equivalents |
| market_data (duplicate) | `/api/` (2nd mount) | Removed |

---

## 4. Response Shapes (Standard)

### 3.4.1 Success Envelope
```json
{
  "data": { ... },
  "meta": {
    "pagination": { "next_cursor": "abc", "has_more": true },
    "timestamp": "2026-06-16T10:30:00Z"
  }
}
```

### 3.4.2 Error Envelope
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { "field": "error detail" }
  },
  "meta": { "timestamp": "2026-06-16T10:30:00Z" }
}
```

### 3.4.3 Pagination (Cursor-based)
- Request: `?cursor=<opaque>&limit=20`
- Response: `meta.pagination.next_cursor`, `meta.pagination.has_more`

---

## 5. Observability Requirements

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| Request logging | Django middleware + structlog | Log entries per request |
| Latency metrics | Prometheus histogram `http_request_duration_seconds` | `/metrics` endpoint |
| Error rate tracking | Prometheus counter `http_requests_total{status=~"5.."}` | Alerting rule |
| Route coverage | Automated test: all `/core/v1/` routes hit in test suite | CI gate |
| Swagger spec validity | `drf-spectacular` validation on startup | Startup check |

---

## 6. Configuration Matrix

| Config | Current | Target | Owner |
|--------|---------|--------|-------|
| `REACT_APP_CORE_API_BASE_URL` | `/api/` | `/core/v1/` | Frontend |
| `coreApiAdapter.baseURL` | `/api/` | `/core/v1/` | Frontend |
| `vninvest_core/urls.py` mounts | 22 mounts | ~14 mounts | Backend |
| `identity_access/urls.py` routes | ~25 | ~35 (merged) | Backend |
| `user_workspace/urls.py` routes | ~80 | ~45 (cleaned) | Backend |

---

## 7. Migration Data Flow (Phase 1)

```
BEFORE (Phase 0 complete)                    AFTER (Phase 1 complete)
┌─────────────────────────────┐              ┌─────────────────────────────┐
│ Frontend                    │              │ Frontend                    │
│ REACT_APP_CORE_API_BASE_URL │              │ REACT_APP_CORE_API_BASE_URL │
│ = "/api/"                   │    ───►      │ = "/core/v1/"               │
└──────────────┬──────────────┘              └──────────────┬──────────────┘
               │                                            │
               ▼                                            ▼
┌─────────────────────────────┐              ┌─────────────────────────────┐
│ /api/portfolio/portfolios/  │              │ /core/v1/workspace/portfolios/│
│ /api/auth/me                │              │ /core/v1/auth/me            │
│ /api/core/v1/partner/tenant │              │ /core/v1/partner/tenant     │
└─────────────────────────────┘              └─────────────────────────────┘
               │                                            │
               ▼                                            ▼
┌─────────────────────────────┐              ┌─────────────────────────────┐
│ Backend                     │              │ Backend                     │
│ user_workspace.urls         │              │ user_workspace.urls         │
│   (mounted at /api/ AND     │              │   (mounted at /core/v1/     │
│    /core/v1/)               │              │    ONLY)                    │
│   portfolio/* + workspace/* │              │   workspace/* ONLY          │
└─────────────────────────────┘              └─────────────────────────────┘
```

---

## 8. Compatibility Matrix

| Client | Phase 0 | Phase 1 | Phase 2 |
|--------|---------|---------|---------|
| Frontend (web) | Works (uses `/api/`) | **Breaking** — must migrate | Works |
| Mobile App | Works (uses `/api/`) | **Breaking** — must migrate | Works |
| External Webhooks | Works (`/api/` compat) | Works (`/api/` compat remains) | Works |
| `/api/soc/` consumers | Unaffected | Unaffected | Unaffected |
| `/admin/` users | Unaffected | Unaffected | Unaffected |

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*