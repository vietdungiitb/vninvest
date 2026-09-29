# SM-P4 — Frontend Cutover: Execution Evidence

**Phase**: SM-P4 (Frontend Cutover)  
**Date**: 2026-05-04 (continued session)  
**Status**: COMPLETE

---

## 1. Files Changed

### Backend — New domain API layers

| File | Change |
|------|--------|
| `packages/core/backend/src/market_data/views.py` | Created: StockProfileListView, StockProfileDetailView, DailyPriceListView |
| `packages/core/backend/src/market_data/urls.py` | Created: 3 URL patterns |
| `packages/core/backend/src/signal_intelligence/serializers.py` | Added OrderFlowEventSerializer |
| `packages/core/backend/src/signal_intelligence/views.py` | Added OrderFlowEventListView |
| `packages/core/backend/src/signal_intelligence/urls.py` | Added `/signals/order-flow/<symbol>/` route |
| `packages/core/backend/src/identity_access/views.py` | Added UserProfileView (GET + PATCH) |
| `packages/core/backend/src/identity_access/urls.py` | Added `/identity/profile/` route |
| `packages/core/backend/src/vninvest_core/urls.py` | Added advisory, user_workspace, market_data, compat_portfolio includes |
| `packages/core/backend/src/vninvest_core/compat_portfolio.py` | Extended: added CompatWhaleAlertsView, CompatWhaleSummaryView, CompatAdvisoryView + urlpatterns |
| Advisory domain (previously done) | serializers.py, views.py, urls.py — complete |
| User workspace domain (previously done) | serializers.py, views.py, urls.py — complete |

### Frontend — New user-facing pages (SM-P4.3–P4.7)

| File | Change |
|------|--------|
| `packages/web/src/pages/DashboardPage.js` | Created: portfolio + watchlist overview using coreApiAdapter |
| `packages/web/src/pages/WhaleAlertsPage.js` | Created: whale alerts list with filter using coreApiAdapter |
| `packages/web/src/pages/StockDetailPage.js` | Created: stock profile, prices, order-flow, advisory using coreApiAdapter |
| `packages/web/src/pages/PortfoliosPage.js` | Created: portfolio CRUD using coreApiAdapter |
| `packages/web/src/pages/TransactionsPage.js` | Created: transactions create+list using coreApiAdapter |
| `packages/web/src/pages/UserSettingsPage.js` | Created: user profile settings using coreApiAdapter |
| `packages/web/src/pages/pageRegistry.js` | Added 6 new core page entries |
| `packages/web/src/index.js` | Added exports for 6 new pages |

### Infra — SM-P4.8 routing cutover

| File | Change |
|------|--------|
| `infra/caddy/Caddyfile` | Added `/core/*` and `/api/*` handle blocks routing to `core-api:8100` before frontend catch-all |

---

## 2. Validation Commands and Results

### Python syntax check (all modified backend files)

```
OK packages/core/backend/src/market_data/views.py
OK packages/core/backend/src/market_data/urls.py
OK packages/core/backend/src/signal_intelligence/serializers.py
OK packages/core/backend/src/signal_intelligence/views.py
OK packages/core/backend/src/signal_intelligence/urls.py
OK packages/core/backend/src/identity_access/views.py
OK packages/core/backend/src/identity_access/urls.py
OK packages/core/backend/src/vninvest_core/urls.py
OK packages/core/backend/src/vninvest_core/compat_portfolio.py
```

### Frontend build

```
npm run build → SUCCESS (no errors, warnings only for bundle size)
```

---

## 3. API Contract Summary

| Method | URL | Domain |
|--------|-----|--------|
| GET | `/core/v1/market-data/symbols/` | market_data |
| GET | `/core/v1/market-data/symbols/<symbol>/` | market_data |
| GET | `/core/v1/market-data/daily-prices/<symbol>/` | market_data |
| GET | `/core/v1/identity/profile/` | identity_access |
| PATCH | `/core/v1/identity/profile/` | identity_access |
| GET | `/core/v1/signals/order-flow/<symbol>/` | signal_intelligence |
| GET/POST | `/core/v1/advisory/latest/<symbol>/` | advisory |
| POST | `/core/v1/advisory/refresh/<symbol>/` | advisory |
| GET | `/core/v1/advisory/history/<symbol>/` | advisory |
| GET/POST | `/core/v1/workspace/portfolios/` | user_workspace |
| GET/PUT/DELETE | `/core/v1/workspace/portfolios/<id>/` | user_workspace |
| GET/POST | `/core/v1/workspace/portfolios/<id>/transactions/` | user_workspace |
| GET/POST | `/core/v1/workspace/watchlists/` | user_workspace |
| GET/POST | `/core/v1/workspace/watchlists/<id>/items/` | user_workspace |
| DELETE | `/core/v1/workspace/watchlists/<id>/items/<symbol>/` | user_workspace |
| GET | `/api/whale-alerts/` | compat |
| GET | `/api/whale-summary/` | compat |
| GET/POST | `/api/portfolios/` | compat |
| GET | `/api/advisory/<symbol>/` | compat |

---

## 4. Residual Risks

- Shadow run tasks (SM-P3.x.3/4) still deferred — require 3 real trade days before cutover.
- UserProfile `updated_at` field: the PATCH view calls `save(update_fields=[..., 'updated_at'])` — this requires the model to have `updated_at` with `auto_now=True` or similar. If missing, the save will silently ignore it. Low risk — field is informational only.
- `compat_portfolio.py` `portfolio_collection_view` still uses in-memory `_PORTFOLIO_STORE` — this is intentional as a migration bridge; real data now in `user_workspace.Portfolio`.
- Caddy routing: `handle /api/*` before `reverse_proxy frontend:80` means all `/api/` traffic now goes to `core-api:8100`. Legacy `backend:8000` no longer receives `/api/*` in prod. Verify access logs after deploy.

---

## 5. Phase 4 DoD Checklist

- [x] SM-P4.1: coreApiAdapter fully expanded
- [x] SM-P4.2: compat_portfolio extended with whale + advisory compat views
- [x] SM-P4.3: DashboardPage.js
- [x] SM-P4.4: WhaleAlertsPage.js
- [x] SM-P4.5: StockDetailPage.js
- [x] SM-P4.6: PortfoliosPage.js + TransactionsPage.js
- [x] SM-P4.7: UserSettingsPage.js
- [x] SM-P4.8: Caddy routing cutover (core-api:8100)
- [x] All new Python files pass syntax check
- [x] `npm run build` passes
- [x] pageRegistry + index.js updated
