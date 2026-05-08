# TASKBOARD - Native-Only Decommission

**Ngay**: 2026-05-08  
**Legend**: `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked

---

## Phase N1 - Inventory lock

- [ ] `N1.1` Freeze compat additions and capture route inventory
  - Owner: Backend Lead
  - DoD: all active `/api/*` routes mapped to native owner or compat bridge
  - Evidence: route inventory section in traceability matrix

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

- [ ] `N2.4` Move public legal pages into a native content owner
  - Owner: Backend Dev / Product
  - DoD: public legal pages served without proxy or compat bridge

---

## Phase N3 - Stabilize client contracts

- [ ] `N3.1` Normalize client response parsing for any transitional envelope
  - Owner: Frontend Dev
  - DoD: no runtime errors on reload for updated route shapes

- [ ] `N3.2` Remove client code paths that depend on compat-only assumptions
  - Owner: Frontend Dev
  - DoD: no console errors on dashboard bootstrap

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

- [ ] `N6.1` Stop legacy services and verify no restart loop
  - Owner: DevOps
  - DoD: legacy containers absent from production compose deployment

- [ ] `N6.2` Soak test production after proxy removal
  - Owner: QA / DevOps
  - DoD: no 5xx or console errors for the agreed soak window

- [ ] `N6.3` Archive evidence and mark docs complete
  - Owner: Backend Lead
  - DoD: ledger and progress dashboard updated, evidence packet attached
