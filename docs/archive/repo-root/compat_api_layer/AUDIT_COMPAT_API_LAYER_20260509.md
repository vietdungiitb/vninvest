# AUDIT: Legacy API Compat Layer — Fix 404 Errors
**Date:** 2026-05-09  
**Commit:** `0b7a9b61` (compat layer), `a3001eff` (module tree)  
**Branches:** `dev`, `enterprise`  
**Deploy:** `vninvest-core-api:latest` on `docker.edusuccess.vn`

---

## Vấn đề

Frontend gọi **~100+ legacy API paths** từ `backend/` Django app (đã decommission) nhưng core backend (`packages/core`) không có các routes này → 404 trên toàn bộ tính năng:

| Legacy path | HTTP status trước |
|---|---|
| `GET /api/portfolio/portfolios/` | 404 |
| `GET /api/stock-management/groups/` | 404 |
| `GET /api/stock-management/price-alerts/` | 404 |
| `GET /api/admin-ops/stats/` | 404 |
| `GET /api/realtime/ticker/VNM/` | 404 |

---

## Giải pháp

Tạo **compat layer** trong `packages/core/backend/src/vninvest_core/`:

### 1. `compat_views.py` (NEW)
Views compat map legacy API sang core views hoặc graceful stub:
- `AdminOpsStatsView` — trả dữ liệu thật từ core DB (Portfolio count, User count, v.v.)
- `AdminOpsSystemAiSettingsView` — đọc `SystemAISettings` model
- `LegacyWatchlistGroupListView / DetailView` — map sang `user_workspace.Watchlist`
- `LegacyWatchlistItemCreateView / DeleteView` — map sang `user_workspace.WatchlistItem`
- `PortfolioUserConfigView` — map sang `identity_access.UserProfile`
- `PriceAlertsView`, `TrackedSymbolsView`, `StockManagementStubView` — trả `[]` graceful
- `PortfolioAnalyticsStubView`, `GenericEmptyListView`, `GenericEmptyStaffView` — stubs

### 2. `compat_urls.py` (NEW)
80+ URL patterns maps:
- `/api/portfolio/portfolios/` → `user_workspace.PortfolioListCreateView` (real data)
- `/api/portfolio/portfolios/<id>/` → `user_workspace.PortfolioDetailView` (real data)
- `/api/portfolio/watchlist/groups/` → `LegacyWatchlistGroupListView` (real data)
- `/api/portfolio/userconfig/` → `PortfolioUserConfigView` (real data)
- `/api/admin-ops/stats/` → `AdminOpsStatsView` (real data)
- `/api/stock-management/price-alerts/` → `PriceAlertsView` (empty list graceful)
- `/api/realtime/*` → `StockManagementStubView` (empty stubs, pending realtime migration)
- `/api/admin-ops/*` → `AdminOpsStubActionView` (stubs for unimplemented features)

### 3. `urls.py` (MODIFIED)
Thêm `path('api/', include('vninvest_core.compat_urls'))` **cuối cùng** để native routes ưu tiên.

---

## Files Changed

| File | Status | Ghi chú |
|---|---|---|
| `packages/core/backend/src/vninvest_core/compat_views.py` | **NEW** | 270 dòng, compat views |
| `packages/core/backend/src/vninvest_core/compat_urls.py` | **NEW** | 160 dòng, 80+ URL patterns |
| `packages/core/backend/src/vninvest_core/urls.py` | **MODIFIED** | +1 include compat_urls |
| `module_tree_full.md` | **UPDATED** | Regenerated, 979 modules |

---

## Verification

```
portfolio/portfolios/: 401    ← route có, cần auth (trước: 404)
stock-management/groups/: 401 ← route có, cần auth (trước: 404)
stock-management/price-alerts/: 401 ← route có, cần auth (trước: 404)
realtime/ticker/VNM/: 401     ← route có, cần auth (trước: 404)
admin-ops/stats/: 401         ← route có, cần admin (trước: 404)
```

Tất cả 5 endpoints kiểm tra trả về **401 Unauthorized** (route tồn tại, đúng auth guard) thay vì **404 Not Found**.

---

## Trạng thái tính năng sau compat

| Tính năng | Status | Notes |
|---|---|---|
| Portfolios list/create/detail | ✅ Real data | map sang `user_workspace.Portfolio` |
| Portfolio transactions | ✅ Real data | map sang `user_workspace.Transaction` |
| Watchlist groups | ✅ Real data | map sang `user_workspace.Watchlist` |
| Watchlist items | ✅ Real data | map sang `user_workspace.WatchlistItem` |
| User config | ✅ Real data | map sang `identity_access.UserProfile` |
| Admin ops stats | ✅ Real data | counts từ core DB |
| Price alerts | ⚠️ Stub (empty list) | model chưa migrate sang core |
| Tracked symbols | ⚠️ Stub (empty list) | model chưa migrate sang core |
| Securities groups | ⚠️ Stub (empty list) | model chưa migrate sang core |
| Realtime ticker/whale | ⚠️ Stub (empty) | realtime engine chưa migrate |
| Portfolio analytics | ⚠️ Stub (empty) | holdings/chart/equity chưa migrate |
| AI Advisory | ⚠️ Stub (empty) | advisory engine chưa migrate |
| Admin ops signals | ⚠️ Stub | signals engine chưa migrate |

---

## Production Deploy
- Image: `ghcr.io/vietdungiitb/vninvest-core-api:latest` (86 MB)
- Server: `docker.edusuccess.vn`, user `pham`
- Deploy method: `docker save` → `scp` → `docker load` → `docker compose up --force-recreate --no-build`
- Containers restarted: `vninvest-core-api`, `vninvest-core-worker`, `vninvest-core-beat`
- All containers: **Healthy** ✅
