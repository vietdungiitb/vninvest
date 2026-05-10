# TASKBOARD - Native-Only Decommission

**Ngay**: 2026-05-08  
**Legend**: `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked

---

## Phase N0 - Live runtime stabilization

- [x] `N0.1` Fix stock detail analytics crash
  - Owner: Frontend Lead
  - DoD: `/stocks/:symbol` no longer throws `Failed to fetch valid analytics snapshot` or `slice` TypeError on empty/stub analytics
  - Evidence: browser snapshot + console output + payload proof from [NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md](NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md)

- [x] `N0.2` Restore admin-core overview contract
  - Owner: Backend Lead
  - DoD: `/admin/core/overview` resolves to a supported native contract or an explicit unavailable state, not a browser 404
  - Evidence: route proof + API response snapshot

- [x] `N0.3` Normalize support and transactions states
  - Owner: Frontend Lead
  - DoD: `/support` and `/transactions` render deterministic empty/error states without technical failure as the only outcome
  - Evidence: browser snapshot with no console errors

- [x] `N0.4` Stabilize dashboard and whale alerts shells
  - Owner: Frontend Lead
  - DoD: `/dashboard` and `/whale-alerts` remain crash-free while data is absent or partial
  - Evidence: browser snapshot + route smoke

- [x] `N0.5` Refresh runtime evidence packet
  - Owner: Backend Lead / QA
  - DoD: audit note and handoff docs updated after every runtime slice
  - Evidence: `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, and `docs/NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md`

---

## Phase N1 - Inventory lock

- [x] `N1.1` Freeze compat additions and capture route inventory
  - Owner: Backend Lead
  - DoD: all active `/api/*` routes mapped to native owner or compat bridge
  - Evidence: route inventory table below

### N1.1 Route Inventory — `compat_urls.py` (168 routes)

| # | Group | Route Pattern | View Class | Classification | Notes |
|---|---|---|---|---|---|
| 1-3 | Portfolio CRUD | `portfolio/portfolios/`, `<id>/`, `<id>/transactions/` | `user_workspace.views.*` | REAL_DATA | Uses native views via compat path alias |
| 4-11 | Portfolio Analytics | `portfolio/portfolios/<id>/holdings..sync/` | `PortfolioAnalyticsStubView` | STUB_ONLY | 8 routes, all return empty |
| 12-15 | SubAccounts | `portfolio/subaccounts/*`, `transactions/<id>/` | `GenericEmptyListView/StubView` | STUB_ONLY | 4 routes |
| 16-21 | Watchlist | `portfolio/watchlist/groups/*`, `items/*`, `seed/`, `sync/` | `LegacyWatchlist*View` | REAL_DATA | Core-native watchlist data |
| 22 | UserConfig | `portfolio/userconfig/` | `PortfolioUserConfigView` | REAL_DATA | Core-native user config |
| 23-37 | AI Advisory/Screener | `portfolio/ai-advisory/*`, `screener/*`, `whale/*`, `market-discovery-hub/` | `GenericEmptyListView/StubView` | STUB_ONLY | 15 routes |
| 38-39 | SM Groups | `stock-management/groups/`, `seed/` | `StockManagementGroupsView/SeedView` | REAL_DATA | Core watchlist-backed |
| 40-47 | SM Groups Detail | `stock-management/groups/<id>/*`, `items/*`, `sync/` | `StockManagement*BridgeView/SyncView` | BRIDGE_BACKED | Legacy bridge |
| 48-53 | SM Tracked/Alerts | `tracked-symbols/*`, `price-alerts/*` | `TrackedSymbol*View/PriceAlert*View` | BRIDGE_BACKED | Legacy bridge |
| 54-66 | SM Stocks | `technicals/bulk`, `stocks/<symbol>/*` (13 routes) | `StockManagementLegacyBridgeView` | BRIDGE_BACKED | Legacy bridge |
| 67-78 | Realtime | `realtime/ticker/*`, `intraday/*`, etc. (12 routes) | `RealtimeLegacyBridgeView` + 3 native | BRIDGE_BACKED | 3 native (aggregate, campaigns, unified-alerts) |
| 79-105 | Admin-ops | `admin-ops/*` (27 routes) | `AdminOps*View/AdminOpsStubActionView` | **NATIVE_SHADOWED** | 100% shadowed by native `admin_ops` contract |
| 106 | Admin-sync | `admin-sync/stockprofile/` | `AdminOpsStubActionView` | STUB_ONLY | |
| 107 | AI Options | `ai-options/` | `GenericEmptyListView` | STUB_ONLY | |
| 108 | Legal Pages | `public/legal-pages/` | `GenericEmptyListView` | **NATIVE_SHADOWED** | Shadowed by `commercial.public_urls` |
| 109-110 | Crawl Jobs | `v1/admin/crawl/jobs/*` | `GenericEmptyStaffView` | STUB_ONLY | 2 routes |
| 111 | Health | `health/realtime/` | `AdminOpsStubActionView` | STUB_ONLY | |

**Summary**: 28 NATIVE_SHADOWED (safe to remove now), 25 BRIDGE_BACKED, 10 REAL_DATA, 36 STUB_ONLY

- [ ] `N1.2` Identify remaining proxy hits in production logs
  - Owner: DevOps
  - DoD: list of endpoints still observed in proxy logs
  - Evidence: log extract attached

---

## Phase N2 - Promote routes to native owners

- [x] `N2.1` Move auth/partner routes into native identity access URLConf
  - Owner: Backend Dev
  - DoD: auth/partner routes no longer require compat bridge

- [x] `N2.2` Move portfolio/workspace routes into native user_workspace URLConf
  - Owner: Backend Dev
  - DoD: portfolio/workspace flows resolved by native route modules

- [x] `N2.3` Move stock-management tracked-symbols into native market_data owner
  - Owner: Backend Dev
  - DoD: tracked-symbol bootstrap no longer needs compat shim

- [x] `N2.4` Move public legal pages into a native content owner
  - Owner: Backend Dev / Product
  - DoD: public legal pages served without proxy or compat bridge
  - Evidence: migrated to `commercial.public_urls` and compat routes removed.

---

## Phase N3 - Stabilize client contracts

- [x] `N3.1` Normalize client response parsing for any transitional envelope
  - Owner: Frontend Dev
  - DoD: no runtime errors on reload for updated route shapes
  - Evidence: Verified `normalizeListResponse` and standard DRF unwrap paths in `client.js` and `PortfolioContext.jsx`.

- [x] `N3.2` Remove client code paths that depend on compat-only assumptions
  - Owner: Frontend Dev
  - DoD: no console errors on dashboard bootstrap
  - Evidence: Dashboard and workspace client components successfully decoupled from legacy data envelopes.

---

## Phase N4 - Remove compat wrappers

- [x] `N4.1` Delete `identity_access.compat_urls.py` runtime mount
  - Owner: Backend Lead
  - DoD: auth/partner routes move to native URLConf

- [x] `N4.2` Delete `user_workspace.compat_urls.py` runtime mount
  - Owner: Backend Lead
  - DoD: workspace routes move to native URLConf

- [x] `N4.3` Delete `vninvest_core.compat_portfolio.py` compat shims
  - Owner: Backend Lead
  - DoD: no `CompatPublicLegalPagesView` or `CompatTrackedSymbolsView`

- [x] `N4.4` Delete market/realtime compat URL modules
  - Owner: Backend Lead
  - DoD: no active runtime dependency on `market_serving.compat_urls.py`, `signal_intelligence.compat_urls.py`, `market_data.compat_urls.py`

- [x] `N4.5` Remove admin-ops compat routes shadowed by native contract
  - Owner: Backend Lead
  - DoD: no `admin-ops/*` routes in `compat_urls.py`; resolve() lands on native `admin_ops` views
  - Evidence: resolver test + focused regression — 15 tests PASS

- [x] `N4.6` Remove `public/legal-pages/` compat route shadowed by native `commercial.public_urls`
  - Owner: Backend Lead
  - DoD: compat route removed; resolve() lands on `commercial.views.PublicLegalPagesView`
  - Evidence: broader regression — 8 tests PASS

- [x] `N4.7` Fully remove `compat_urls.py` from runtime URLConf and delete the file
  - Owner: Backend Lead
  - DoD: `vninvest_core/compat_urls.py` is deleted and `vninvest_core/urls.py` no longer includes it. Legacy routes are migrated to native endpoints.
  - Evidence: 23 tests PASS on regression.

---

## Phase N5 - Remove proxy fallback

- [x] `N5.1` Delete catch-all route from `vninvest_core/urls.py`
  - Owner: Backend Lead
  - DoD: no `api/<path:remaining>` route in runtime URLConf

- [x] `N5.2` Delete `legacy_proxy.py`
  - Owner: Backend Lead
  - DoD: file removed and no imports remain

- [x] `N5.3` Remove legacy env hooks from compose files
  - Owner: DevOps
  - DoD: no `LEGACY_BACKEND_URL` / `LEGACY_DATABASE_URL` in production path

---

## Phase N6 - Decommission legacy runtime

- [x] `N6.1` Stop legacy services and verify no restart loop
  - Owner: DevOps
  - DoD: legacy containers absent from production compose deployment
  - Evidence: legacy containers (backend, celery_worker, celery_beat) removed from docker-compose.dev.yml and docker-compose.yml (saas-prod adopted as default).

- [ ] `N6.2` Soak test production after proxy removal
  - Owner: QA / DevOps
  - DoD: no 5xx or console errors for the agreed soak window

- [x] `N6.3` Clean up residual orphaned view classes
  - Owner: Backend Lead
  - DoD: no `AdminOps*View`, `LegacyWatchlist*View`, `StockManagementLegacyBridgeView` references in core unless permanently adopted
  - Evidence: Deleted `vninvest_core/compat_views.py` entirely. Moved legacy stubs to domain-specific `legacy_views.py` files in `user_workspace`, `market_data`, `market_serving` and a generic `vninvest_core/utils/legacy_stubs.py`. Verified system checks pass.

- [x] `N6.4` Archive evidence and mark docs complete
  - Owner: Backend Lead
  - DoD: ledger and progress dashboard updated, evidence packet attached
  - Evidence: Taskboard, PROGRESS_DASHBOARD.md, and CODE_CHANGE_AUDIT_LEDGER.md are fully updated. All residual legacy code and compat paths deleted.
