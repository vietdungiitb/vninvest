# Audit: Django API Routing — `/core/v1/` vs `/api/` Endpoint Distribution

**Date:** 2026-06-15  
**Scope:** `packages/core/backend/src/vninvest_core/urls.py` + all domain app URL configs  
**Purpose:** Baseline audit before executing migration strategy from `DJANGO_API_ROUTING_AND_MIGRATION_STRATEGY_20260615.md`

---

## 1. Root URL Map (vninvest_core/urls.py)

| Prefix | Mounted Apps | Count | Purpose |
|--------|--------------|-------|---------|
| **`/core/v1/`** | identity_access, identity_access_partner, market_serving, signal_intelligence, commercial, ops_audit, operator, advisory, user_workspace, market_data, data_ingest, support, advertising | 13 | SaaS Core APIs (tenant-isolated, OpenAPI-governed) |
| **`/api/`** | commercial_public, market_data_public, market_serving_api, signal_intelligence_api, user_workspace_api, identity_access_api, market_data_api, support_api, advertising_api | 9 | Public/Bootstrap/Legacy compatibility |
| **`/api/soc/`** | service_ops | 1 | Security Operations Center (operator-only) |
| **`/admin/`** | Django Admin | 1 | Traditional admin |

---

## 2. Per-App Routing Analysis

### 2.1 identity_access — ✅ Core Ready, `/api/` Duplicated
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `identity_access` (core/v1) | `auth/login`, `auth/me`, `auth/logout`, `access/capabilities`, `onboarding/register`, `tenant`, `service-accounts/*`, `pat/*`, `identity/profile`, `operator/mail-configs/*` | **Native** |
| `identity_access_partner` (core/v1) | `partner/tenant`, `partner/service-accounts/*`, `partner/pats/*`, `partner/usage/*`, `partner/billing/*` | **Native** |
| `identity_access_api` (api/) | **Duplicates** of core/v1 auth/onboarding/operator paths + **legacy stubs**: `ai-options`, `v1/admin/crawl/*`, `health/realtime` | **Decommission candidate** |

**Finding:** `api_urls.py` is a near-complete duplicate of core/v1 routes plus dead stubs. No unique functionality.

---

### 2.2 user_workspace — ⚠️ Hybrid (Compatibility Layer Active)
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `user_workspace` (core/v1) | `workspace/portfolios/*`, `workspace/transactions/*`, `workspace/watchlists/*`, `workspace/whale-analytics`, `workspace/ai-command-center` | **Native** |
| `user_workspace_api` (api/) | **Full mirror** under `portfolio/*` prefix using **same views** + **legacy stub views**: `LegacyWatchlistGroupListView`, `LegacyWatchlistItemCreateView`, `PortfolioUserConfigView` | **Legacy compatibility** |

**Finding:** Frontend currently calls `/api/portfolio/*`. Core/v1 uses `/workspace/*`. Legacy watchlist views are stubs returning empty data.

---

### 2.3 market_data — ⚠️ Hybrid (Public Mirror + Duplicate Mount)
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `market_data` (core/v1) | `stock-management/*` (groups, tracked-symbols, price-alerts, stocks/*, ai-advisory-*, portfolio/news-digest) + admin ops | **Native** |
| `market_data_public` (api/) | **Near-identical** `stock-management/*` read routes | **Public read mirror** |
| `market_data_api` (api/) | **Duplicate mount** of `market_data.urls` (registered twice in root urls.py: lines 47 & 54) | **Bug: double registration** |

**Finding:** `public_urls.py` mirrors core read endpoints for unauthenticated access. Root urls.py mounts `market_data.urls` twice under `/api/`.

---

### 2.4 signal_intelligence — ⚠️ Hybrid (Exact Duplicate)
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `signal_intelligence` (core/v1) | `signals/alert-center/*`, `signals/ai-alerts/*`, `whale-feed`, `signals/order-flow/*` | **Native** |
| `signal_intelligence_api` (api/) | **Identical paths** with trailing slashes | **Duplicate (slash normalization only)** |

**Finding:** Zero functional difference. `/api/` version only adds trailing slashes.

---

### 2.5 commercial — ✅ Clean Separation
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `commercial` (core/v1) | `billing/subscription`, `billing/quota`, `billing/invoices`, `payments/*` | **Tenant-scoped** |
| `commercial_public` (api/) | `public/legal-pages/` | **Truly public (no auth)** |

**Finding:** Good boundary. `/api/` only has genuinely public endpoint.

---

### 2.6 market_serving — ⚠️ Hybrid (Legacy + Native Mix)
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `market_serving` (core/v1) | `symbol-snapshot/*`, `session-facts/*`, `realtime/*` (8 native views) | **Native** |
| `market_serving_api` (api/) | `market/*` (duplicate) + `realtime/*` (legacy bridge views + native views) | **Mixed** |

**Finding:** `/api/` contains both deprecated `RealtimeWhaleFeedAggregateView`, `RealtimeWhaleCampaignsView`, `RealtimeUnifiedAlertsView` AND native views. Core/v1 is clean native only.

---

### 2.7 advisory — ✅ Fully Migrated
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `advisory` (core/v1) | `advisory/latest/<symbol>`, `advisory/refresh/<symbol>`, `advisory/history/<symbol>` | **Native** |
| `/api/` | Not mounted | — |

---

### 2.8 ops_audit — ✅ Fully Migrated
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `ops_audit` (core/v1) | `audit-log` | **Native** |
| `/api/` | Not mounted | — |

---

### 2.9 support — ✅ Core Ready, `/api/` Duplicate
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `support` (core/v1) | `tickets/*`, `staff/*` | **Native** |
| `support_api` (api/) | **Same paths** mounted at `/api/support/` | **Duplicate mount** |

---

### 2.10 advertising — ⚠️ Reasonable Separation
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `advertising` (core/v1) | `operator/ads/campaigns`, `operator/ads/analytics` (DRF router) | **Operator-only** |
| `advertising_api` (api/) | `v1/content/display/`, `v1/metrics/log/view/`, `v1/metrics/log/click/` | **Public ad tracking** |

**Finding:** Logical split — operator management under `/core/v1/`, public impression/click logging under `/api/`.

---

### 2.11 data_ingest — ✅ Fully Migrated
| Namespace | Key Paths | Status |
|-----------|-----------|--------|
| `data_ingest` (core/v1) | `data-ingest/jobs`, `data-ingest/runs`, `data-ingest/backfill/*` | **Native** |
| `/api/` | Not mounted | — |

---

## 3. Critical Issues Summary

| # | Issue | Severity | Location | Action |
|---|-------|----------|----------|--------|
| 1 | **Duplicate mount** of `market_data.urls` under `/api/` | High | `vninvest_core/urls.py` lines 47 & 54 | Remove line 54 |
| 2 | **Full route duplication** — `identity_access.api_urls` | High | `identity_access/api_urls.py` | Delete file + remove mount |
| 3 | **Full route duplication** — `signal_intelligence.api_urls` | High | `signal_intelligence/api_urls.py` | Delete file + remove mount |
| 4 | **Duplicate mount** — `support.urls` under `/api/support/` | Medium | `vninvest_core/urls.py` line 56 | Remove mount |
| 5 | **Legacy compatibility layer** — `user_workspace` `/api/portfolio/*` mirror | Medium | `user_workspace/urls.py` + root mount | Phase 1: frontend cutover → remove |
| 6 | **Public mirror** — `market_data.public_urls` mirrors core read endpoints | Medium | `market_data/public_urls.py` | Decide: keep as public read or remove |
| 7 | **Mixed legacy/native** — `market_serving.api_urls` has dead bridge views | Medium | `market_serving/api_urls.py` | Remove legacy views, then remove mount |
| 8 | **Dead stubs** in `identity_access.api_urls` | Low | `identity_access/api_urls.py` | Part of #2 cleanup |

---

## 4. Migration Readiness by Phase (per Strategy Doc)

| Domain | Phase | `/core/v1/` Ready? | `/api/` Cleanup Effort | Blocker |
|--------|-------|-------------------|------------------------|---------|
| identity_access | 1 | ✅ Yes | **High** (delete api_urls) | None |
| user_workspace | 1 | ✅ Yes | **Medium** (frontend uses `/portfolio/`) | Frontend migration |
| market_data | 2 | ✅ Yes | **Medium** (public_urls decision) | Product decision on public read |
| signal_intelligence | 2 | ✅ Yes | **High** (delete api_urls) | None |
| advisory | 3 | ✅ Yes | None | None |
| commercial | — | ✅ Yes | **Low** (keep public/legal-pages) | None |
| market_serving | 2 | ✅ Yes | **Medium** (clean api_urls) | None |
| ops_audit | — | ✅ Yes | None | None |
| support | — | ✅ Yes | **Low** (remove duplicate mount) | None |
| advertising | — | ✅ Yes | **Low** (keep api_urls for tracking) | None |
| data_ingest | — | ✅ Yes | None | None |

---

## 5. Recommended Action Plan

### Immediate (No Frontend Changes Required)
1. **Remove duplicate mount** — Delete line 54 in `vninvest_core/urls.py` (`market_data.urls` mounted twice)
2. **Delete `identity_access/api_urls.py`** — Remove mount from root urls.py
3. **Delete `signal_intelligence/api_urls.py`** — Remove mount from root urls.py
4. **Remove `support` mount** under `/api/support/` — Remove line 56 in root urls.py

### Phase 1 — Identity & Workspace (Requires Frontend Coordination)
1. Update frontend `coreApiAdapter` base URL to `/core/v1/`
2. Migrate frontend calls: `/api/portfolio/*` → `/core/v1/workspace/*`
3. Migrate frontend calls: `/api/auth/*` → `/core/v1/auth/*`
4. Remove `user_workspace` mount from `/api/` (line 51 in root urls.py)
5. Remove legacy watchlist stub views from `user_workspace/urls.py`

### Phase 2 — Market Data & Signals
1. **Decision:** Keep or remove `market_data.public_urls` (public read access)
2. Remove `market_data_public` mount from `/api/` if not needed
3. Clean `market_serving/api_urls.py` — remove legacy bridge views
4. Remove `market_serving_api` mount from `/api/`
5. Remove `signal_intelligence_api` mount (already covered by #3)

### Phase 3 — Advisory
- Already clean. No action needed.

---

## 6. Open Questions for Discussion

1. **`market_data.public_urls`** — Is unauthenticated public read access to stock-management data a product requirement? If yes, keep under `/api/` with clear "public" naming. If no, remove.

2. **`advertising.api_urls`** — Public ad tracking endpoints (`v1/content/display`, `v1/metrics/log/*`) are correctly placed under `/api/`. Confirm no migration needed.

3. **`commercial.public_urls`** — Only `public/legal-pages/`. Confirm this is the only truly public endpoint needed.

4. **Frontend migration timeline** — What is the target sprint for switching `packages/web` to `/core/v1/` base URL? This gates Phase 1 cleanup.

5. **Shadow rollout period** — Per strategy doc, how long to run both `/api/` and `/core/v1/` in staging before decommission? (Recommended: 1 sprint cycle)

---

## 7. Appendix: Files to Modify/Delete

### Delete Entirely
- `packages/core/backend/src/identity_access/api_urls.py`
- `packages/core/backend/src/signal_intelligence/api_urls.py`

### Modify (Remove Mounts)
- `packages/core/backend/src/vninvest_core/urls.py` — Lines 47, 51, 54, 56, 57, 58, 59, 60, 61

### Modify (Clean Legacy Code)
- `packages/core/backend/src/user_workspace/urls.py` — Remove legacy watchlist stub routes (lines 63-78)
- `packages/core/backend/src/market_serving/api_urls.py` — Remove legacy bridge view imports/routes
- `packages/core/backend/src/market_data/public_urls.py` — **Decision pending**

---

*Generated by audit on 2026-06-15. Use as baseline for migration execution.*