# AUDIT REPORT — SAAS Native OpenAPI Migration Status (CORRECTED & AUDITED)

**Ngày audit:** 2026-05-20  
**Auditor:** Antigravity (Advanced Agentic AI)  
**Mục tiêu:** Xác định chính xác tỷ lệ chuyển đổi sang kiến trúc SAAS native OpenAPI và phân loại các thành phần theo 3 bucket: Core native direct, Core native compat alias, True legacy backend.

---

## 1. Phân loại 3 Bucket

### 1.1 Định nghĩa

| Bucket | Mô tả | Owner thực tế |
|---|---|---|
| **Core native direct** | Route trực tiếp trong packages/core, không qua bridge, dùng `/core/v1/` prefix | `packages/core/backend/src/` |
| **Core native compat alias** | Route mount trong core nhưng dùng `/api/` prefix để đảm bảo tương thích với frontend | `packages/core/` (native views nhưng `/api` prefix) |
| **True legacy backend** | Route xử lý bởi backend monolith cũ | `backend/portfolio/` |

### 1.2 Tổng quan URL Surface

```
/core/v1/           → Core native direct (packages/core/)
/api/              → Dual: core native compat alias + true legacy backend
```

---

## 2. Core Native Direct (packages/core/backend/src/)

Các route trực tiếp sử dụng `/core/v1/` prefix, được định nghĩa trong `packages/core/backend/src/` và xử lý hoàn toàn bằng native views.

### 2.1 identity_access (urls.py & partner_urls.py)

Tất cả các view trong phân hệ này thực tế là **Function-based Views** trong `views_auth.py` và `onboarding_views.py` (không phải Class-based Views):

| Route | View | File |
|---|---|---|
| `/core/v1/auth/login` | `views_auth.login_view` | `identity_access/urls.py` |
| `/core/v1/auth/profile` | `views_auth.profile_view` | `identity_access/urls.py` |
| `/core/v1/auth/me` \| `/core/v1/auth/me/` | `views_auth.profile_view` (alias) | `identity_access/urls.py` |
| `/core/v1/auth/logout` | `views_auth.logout_view` | `identity_access/urls.py` |
| `/core/v1/access/capabilities` \| `.../` | `views_auth.capabilities_view` | `identity_access/urls.py` |
| `/core/v1/onboarding/register` \| `.../` | `onboarding_views.register_tenant_view` | `identity_access/urls.py` |
| `/core/v1/tenant` | `TenantDetailView` | `identity_access/urls.py` |
| `/core/v1/service-accounts` | `ServiceAccountListView` | `identity_access/urls.py` |
| `/core/v1/service-accounts/<str:service_account_id>` | `ServiceAccountDetailView` | `identity_access/urls.py` |
| `/core/v1/service-accounts/<str:service_account_id>/pat/issue` | `issue_pat` | `identity_access/urls.py` |
| `/core/v1/pat` | `PATListView` | `identity_access/urls.py` |
| `/core/v1/identity/profile/` | `UserProfileView` | `identity_access/urls.py` |
| `/core/v1/partner/tenant` \| `/core/v1/partner/tenant/` | `TenantDetailView` | `identity_access/partner_urls.py` |
| `/core/v1/partner/service-accounts` \| `.../` | `ServiceAccountListView` | `identity_access/partner_urls.py` |
| `/core/v1/partner/pats` \| `.../` | `PATListView` | `identity_access/partner_urls.py` |
| `/core/v1/partner/pats/issue` \| `.../` | `partner_issue_pat` | `identity_access/partner_urls.py` |
| `/core/v1/partner/pats/<str:pat_id>/rotate/` | `partner_rotate_pat` | `identity_access/partner_urls.py` |
| `/core/v1/partner/pats/<str:pat_id>/revoke/` | `partner_revoke_pat` | `identity_access/partner_urls.py` |
| `/core/v1/partner/usage/meters` \| `.../` | `PartnerUsageMetersView` | `identity_access/partner_urls.py` |
| `/core/v1/partner/usage/quotas` \| `.../` | `PartnerUsageQuotasView` | `identity_access/partner_urls.py` |
| `/core/v1/partner/billing/subscription` \| `.../` | `PartnerBillingSubscriptionView` | `identity_access/partner_urls.py` |
| `/core/v1/partner/billing/invoices` \| `.../` | `PartnerBillingInvoicesView` | `identity_access/partner_urls.py` |

### 2.2 market_data (urls.py & core_urls.py)

Phân hệ market data được mount dưới `/core/v1/` chia thành hai nhóm chính:

#### 2.2.1 market-data family (urls.py)
*Namespace:* `market_data`

| Route | Actual View | Ghi chú |
|---|---|---|
| `/core/v1/market-data/symbols/` | `views.StockProfileListView` | Lấy danh sách các mã CK |
| `/core/v1/market-data/symbols/<str:symbol>/` | `views.StockProfileDetailView` | Lấy thông tin chi tiết một mã |
| `/core/v1/market-data/daily-prices/<str:symbol>/` | `views.DailyPriceListView` | Lấy lịch sử giá ngày |
| `/core/v1/market-data/intraday-prices/<str:symbol>/` | `views.IntradayPricesView` | Lấy lịch sử giá trong ngày |
| `/core/v1/market-data/intraday-tape/<str:symbol>/` | `views.IntradayTapeView` | Lấy lịch sử khớp lệnh tape |
| `/core/v1/market-data/technicals/bulk/` | `StockManagementTechnicalsView` | Lấy chỉ số kỹ thuật bulk |

#### 2.2.2 stock-management family (core_urls.py)
*Namespace:* `market_data`

| Route | View |
|---|---|
| `/core/v1/stock-management/groups/` | `StockManagementGroupsView` |
| `/core/v1/stock-management/groups/<int:group_id>/` | `StockManagementGroupDetailView` |
| `/core/v1/stock-management/groups/<int:group_id>/items/` | `StockManagementGroupItemsView` |
| `/core/v1/stock-management/stocks/<str:symbol>/` | `StockManagementDetailView` |
| `/core/v1/stock-management/stocks/<str:symbol>/overview/` | `StockManagementOverviewView` |
| `/core/v1/stock-management/stocks/<str:symbol>/chart/` | `StockManagementChartView` |
| `/core/v1/stock-management/stocks/<str:symbol>/order-flow/` | `StockManagementOrderFlowView` |
| `/core/v1/stock-management/stocks/<str:symbol>/news/` | `StockManagementNewsView` |
| `/core/v1/stock-management/stocks/<str:symbol>/news/ai-summary/` | `StockManagementNewsAISummaryView` |
| `/core/v1/stock-management/stocks/<str:symbol>/financials/` | `StockManagementFinancialsView` |
| `/core/v1/stock-management/tracked-symbols/` | `StockManagementTrackedSymbolsView` |

### 2.3 signal_intelligence (urls.py)
*Namespace:* `signal_intelligence`

| Route | View |
|---|---|
| `/core/v1/signals/alert-center/feed` | `AlertCenterFeedView` |
| `/core/v1/signals/alert-center/summary` | `AlertCenterSummaryView` |
| `/core/v1/signals/ai-alerts/feed` | `AIAlertsFeedView` |
| `/core/v1/signals/ai-alerts/summary` | `AIAlertsSummaryView` |
| `/core/v1/whale-feed` | `WhaleFeedAggregateView` |
| `/core/v1/signals/order-flow/<str:symbol>/` | `OrderFlowEventListView` |

### 2.4 user_workspace (urls.py)
*Namespace:* `user_workspace`

Các models cốt lõi đã có đầy đủ tại `user_workspace/models.py`:
- `Portfolio` (Dòng 17)
- `Transaction` (Dòng 56)
- `Watchlist` (Dòng 112)
- `WatchlistItem` (Dòng 150)
- `TrackedSymbol` (Dòng 175)
- `PriceAlert` (Dòng 245)
- `SubAccount` (Dòng 328)
- `DNSECredential` (Dòng 393)

Các endpoint trực tiếp `/core/v1/workspace/*`:

| Route | View |
|---|---|
| `/core/v1/workspace/portfolios/` | `views.PortfolioListCreateView` |
| `/core/v1/workspace/portfolios/<int:portfolio_id>/` | `views.PortfolioDetailView` |
| `/core/v1/workspace/portfolios/<int:portfolio_id>/transactions/` | `views.TransactionListCreateView` |
| `/core/v1/workspace/portfolios/<int:portfolio_id>/holdings/` | `PortfolioHoldingsView` |
| `/core/v1/workspace/portfolios/<int:portfolio_id>/summary/` | `PortfolioSummaryView` |
| `/core/v1/workspace/portfolios/<int:portfolio_id>/analytics/` | `PortfolioAnalyticsView` |
| `/core/v1/workspace/portfolios/<int:portfolio_id>/technicals/` | `PortfolioTechnicalsView` |
| `/core/v1/workspace/transactions/<int:transaction_id>/` | `views.TransactionDetailView` |
| `/core/v1/workspace/watchlists/` | `views.WatchlistListCreateView` |
| `/core/v1/workspace/watchlists/<int:watchlist_id>/items/` | `views.WatchlistItemListCreateView` |
| `/core/v1/workspace/watchlists/<int:watchlist_id>/items/<str:symbol>/` | `views.WatchlistItemDeleteView` |
| `/core/v1/workspace/whale-analytics/<str:symbol>/` | `PortfolioWhaleAnalyticsView` |

---

## 3. Core Native Compat Alias (/api/ prefixed nhưng native views)

Các route bắt đầu bằng `/api/` để tương thích ngược với frontend, nhưng được định tuyến trực tiếp vào core và xử lý bởi native views (không thông qua bridge sang monolith cũ).

### 3.1 identity_access.api_urls

Các view thực tế là Function-based Views trong `views_auth.py`:

| Route | View |
|---|---|
| `/api/auth/login/` \| `/api/auth/login` | `views_auth.login_view` |
| `/api/auth/token/` | `views_auth.login_view` |
| `/api/auth/token/refresh/` | `views_auth.refresh_token_view` |
| `/api/auth/me/` | `views_auth.profile_view` |
| `/api/auth/profile/` | `views_auth.profile_view` |
| `/api/auth/logout/` | `views_auth.logout_view` |
| `/api/auth/register/` | `views_auth.register_view` |
| `/api/core/v1/access/capabilities/` | `views_auth.capabilities_view` |

### 3.2 market_data.public_urls

| Route | View |
|---|---|
| `/api/stock-management/groups/` | `StockManagementGroupsView` |
| `/api/stock-management/stocks/<str:symbol>/` | `StockManagementDetailView` |
| `/api/stock-management/stocks/<str:symbol>/overview/` | `StockManagementOverviewView` |
| `/api/stock-management/stocks/<str:symbol>/chart/` | `StockManagementChartView` |
| `/api/stock-management/stocks/<str:symbol>/order-flow/` | `StockManagementOrderFlowView` |
| `/api/stock-management/stocks/<str:symbol>/news/` | `StockManagementNewsView` |
| `/api/stock-management/stocks/<str:symbol>/financials/` | `StockManagementFinancialsView` |
| `/api/stock-management/tracked-symbols/` | `StockManagementTrackedSymbolsView` |

### 3.3 market_serving.api_urls

| Route | View | Ghi chú |
|---|---|---|
| `/api/realtime/ticker/<str:symbol>/` | `RealtimeTickerView` | **NATIVE** |
| `/api/realtime/tickers/` | `RealtimeTickerListView` | **NATIVE** |
| `/api/realtime/intraday/<str:symbol>/` | `RealtimeIntradayView` | **NATIVE** |
| `/api/realtime/price-board/<str:symbol>/` | `RealtimePriceBoardView` | **NATIVE** |
| `/api/realtime/breadth/<str:symbol>/` | `RealtimeBreadthView` | **NATIVE** |
| `/api/realtime/whale-feed/<str:symbol>/` | `RealtimeWhaleFeedView` | **NATIVE** |
| `/api/realtime/unified-alerts/` | `RealtimeUnifiedAlertsView` | **NATIVE** |

### 3.4 signal_intelligence.api_urls

| Route | View |
|---|---|
| `/api/signals/alert-center/feed/` | `AlertCenterFeedView` |
| `/api/signals/alert-center/summary/` | `AlertCenterSummaryView` |
| `/api/signals/ai-alerts/feed/` | `AIAlertsFeedView` |
| `/api/signals/whale-feed/` | `WhaleFeedAggregateView` |
| `/api/signals/order-flow/<str:symbol>/` | `OrderFlowEventListView` |

### 3.5 user_workspace.urls (Legacy Frontend Aliases)

| Route | View | Ghi chú |
|---|---|---|
| `/api/portfolio/portfolios/` | `views.PortfolioListCreateView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/holdings/` | `PortfolioHoldingsView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/summary/` | `PortfolioSummaryView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/chart/` | `PortfolioChartView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/equity-curve/` | `PortfolioEquityCurveView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/allocation/` | `PortfolioAllocationView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/analytics/` | `PortfolioAnalyticsView` | **NATIVE** |
| `/api/portfolio/portfolios/<int:portfolio_id>/technicals/` | `PortfolioTechnicalsView` | **NATIVE** |
| `/api/portfolio/watchlist/groups/` | `LegacyWatchlistGroupListView` | **NATIVE** (Real DB data) |
| `/api/portfolio/watchlist/groups/<int:group_id>/items/` | `LegacyWatchlistItemCreateView` | **NATIVE** (Real DB data) |
| `/api/portfolio/watchlist/items/<int:pk>/` | `LegacyWatchlistItemDeleteView` | **NATIVE** (Real DB data) |
| `/api/portfolio/userconfig/` | `PortfolioUserConfigView` | **NATIVE** (Real DB data) |
| `/api/portfolio/whale/analytics/<str:symbol>/` | `PortfolioWhaleAnalyticsView` | **NATIVE** |
| `/api/portfolio/whale/backtest-stats/` | `PortfolioWhaleBacktestStatsView` | **NATIVE** |

---

## 4. True Legacy Backend (backend/portfolio/)

Các route thực tế vẫn do monolith backend cũ đảm nhiệm xử lý (hoặc core chỉ định nghĩa stubs rỗng).

### 4.1 Routes vẫn thuộc legacy backend thực sự

| Route | File thực tế | View xử lý thực tế | Ghi chú |
|---|---|---|---|
| `/api/portfolio/portfolios/` | `backend/portfolio/urls.py:34` | `PortfolioListCreateView` | Mono backend |
| `/api/portfolio/subaccounts/` | `backend/portfolio/urls.py:47` | `SubAccountListCreateView` | Mono backend |
| `/api/portfolio/subaccounts/{id}/transactions/` | `backend/portfolio/urls.py:51` | `TransactionListCreateView` | Mono backend |
| `/api/portfolio/watchlist/groups/` | `backend/portfolio/urls.py:66` | `WatchlistGroupListCreateView` | Mono backend |
| `/api/portfolio/watchlist/items/<id>/` | `backend/portfolio/urls.py:69` | `WatchlistItemDeleteView` | Mono backend |
| `/api/portfolio/watchlist/seed/` | `backend/portfolio/urls.py:70` | `WatchlistSeedView` | Mono backend |
| `/api/portfolio/watchlist/sync/` | `backend/portfolio/urls.py:71` | `WatchlistSyncView` | Mono backend |
| `/api/support/tickets/` | `backend/support/urls.py` | `TicketListCreateView` | Mono backend |

### 4.2 core/backend user_workspace stubs
Khi gọi sang Core qua prefix `/api/`, một số route được định nghĩa stubs rỗng (trả về kết quả rỗng):
- `/api/portfolio/subaccounts/` → `GenericEmptyListView` (trong `user_workspace/urls.py:79`)
- `/api/portfolio/subaccounts/<int:pk>/` → `GenericEmptyListView` (trong `user_workspace/urls.py:80`)
- `/api/portfolio/subaccounts/<int:pk>/transactions/` → `GenericEmptyListView` (trong `user_workspace/urls.py:81`)

Điều này xác thực rằng: **Các lệnh gọi tiểu khoản thực tế từ Frontend vẫn bắt buộc đi qua Monolith legacy backend (port 8000), Core API chưa thể đáp ứng.**

---

## 5. Frontend Integration Status

### 5.1 Stock Management - ĐÃ CUTOVER (client.js:484-494)

Tất cả các call của stock-management trong frontend đã chuyển sang core base thông qua helper `withCoreBase()`:
```javascript
export const getSecuritiesGroups = () => apiClient.get('/stock-management/groups/', withCoreBase());
export const getStockProfile = (symbol) => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/`, withCoreBase());
export const getStockWorkspaceOverview = (symbol) => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/overview/`, withCoreBase());
export const getStockPriceChart = (symbol, days = 180, timeframe = '1H') => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/chart/`, withCoreBase({...}));
```

### 5.2 Stock Management Write - ĐÃ CUTOVER (client.js:794)

```javascript
export const addTrackedSymbol = (symbol, sourceGroupId = null, whaleAlertThresholdMillion = null) =>
  apiClient.post('/stock-management/tracked-symbols/', {
    symbol,
    source_group_id: sourceGroupId,
    whale_alert_threshold_million: whaleAlertThresholdMillion,
  }, withCoreBase());
```

### 5.3 coreApiAdapter Usage (coreApiAdapter.js)

Đối chiếu chính xác số dòng thực tế của các hàm trong `coreApiAdapter.js` (gói `@vninvest/web`):

| Tên hàm thực tế | Dòng code thực tế | Chức năng |
|---|---|---|
| `getPortfolioNewsDigest` | **Dòng 360** | Lấy tin tức tổng hợp của danh mục |
| `getPortfolioHoldings` | **Dòng 723** | Lấy danh sách mã đang nắm giữ |
| `getPortfolioSummary` | **Dòng 733** | Lấy tổng quan NAV, lãi lỗ danh mục |
| `getPortfolioAnalytics` | **Dòng 744** | Lấy hiệu suất danh mục |
| `getPortfolioTechnicals` | **Dòng 754** | Lấy tín hiệu kỹ thuật holdings |
| `getWhaleAnalyticsSnapshot` | **Dòng 778** | Lấy snapshot cá mập (CVD/Strength) |
| `getTrackedSymbols` | **Dòng 799** | Lấy danh sách mã cá nhân đang theo dõi |
| `getLegacyWatchlistGroups` | **Dòng 808** | Lấy nhóm watchlist cũ |

### 5.4 Whale Feed - VẪN DÙNG COMPAT ALIAS

Whale feed per-symbol hiện vẫn gọi qua compat route:
- Frontend: `client.js:540` → `/realtime/whale-feed/{symbol}/`
- Compat view trong Core: `market_serving/api_urls.py:39` → `RealtimeWhaleFeedView`

---

## 6. Tổng kết theo 3 Bucket

### 6.1 Core Native Direct (~50%)
- Auth: `/core/v1/auth/*`
- Market Data: `/core/v1/market-data/*`
- Stock Management: `/core/v1/stock-management/*`
- Signals: `/core/v1/signals/*`
- Operator: `/core/v1/operator/*`
- Workspace: `/core/v1/workspace/*`

### 6.2 Core Native Compat Alias (~30%)
- Stock Management: `/api/stock-management/*` (native views)
- Realtime: `/api/realtime/*` (native views)
- Alert Center: `/api/signals/alert-center/*` (native views)
- Native Portfolios: `/api/portfolio/portfolios/*` (native views)

### 6.3 True Legacy Backend (~20%)
- SubAccount CRUD: `/api/portfolio/subaccounts/*`
- SubAccount Transactions: `/api/portfolio/subaccounts/{id}/transactions/*`
- Support Tickets: `/api/support/tickets/*`

---

## 7. Các vấn đề còn tồn tại (Architecture Gaps)

### 7.1 Khoảng trống ở SubAccount Layer
- Models của `SubAccount` đã được chuyển đổi hoàn chỉnh sang Core SAAS (`user_workspace/models.py:328`) có trường `tenant` cô lập.
- Tuy nhiên, API layer thực tế chưa được xây dựng: `/core/v1/workspace/subaccounts/` chưa hề tồn tại trong `user_workspace/urls.py`. Các endpoint compat alias chỉ là stubs rỗng (`GenericEmptyListView`).
- Frontend vẫn buộc phải gọi về monolith legacy backend (`:8000/api/portfolio/subaccounts/`).

### 7.2 Thiếu hụt Native Whale Feed per-symbol
- Chưa có native route `/core/v1/signals/whale-feed/{symbol}/` trong app `signal_intelligence`.
- Frontend vẫn phụ thuộc vào compat route `/api/realtime/whale-feed/{symbol}/` (xử lý trong app `market_serving`).

### 7.3 Watchlist CRUD chưa Cutover hoàn chỉnh
- Các models `Watchlist` và `WatchlistItem` đã nằm trong Core.
- Nhưng frontend vẫn đang tạo/sửa/xóa bằng các cuộc gọi legacy `/api/portfolio/watchlist/*` (xử lý qua các lớp tương thích ngược `LegacyWatchlist*` view).

---

## 8. Khuyến nghị hành động (Recommendations)

### Priority 1: Triển khai SubAccount & Transaction Native APIs
1. Expose các API endpoint `/core/v1/workspace/subaccounts/` và `/core/v1/workspace/subaccounts/<id>/transactions/` trong app `user_workspace` của Core backend.
2. Xây dựng các view xử lý tương đương từ model `SubAccount` và `Transaction` SAAS.
3. Di chuyển frontend gọi trực tiếp sang các API native này để có thể decommission hoàn chỉnh phần subaccounts của legacy backend.

### Priority 2: Đồng bộ hóa Watchlist sang Native API
1. Chuyển đổi toàn bộ các call trong frontend (`createWatchlistGroup`, `updateWatchlistGroup`, v.v.) từ path compat `/api/portfolio/watchlist/` sang native `/core/v1/workspace/watchlists/`.
2. Dọn dẹp hoàn toàn các compat view cũ `LegacyWatchlist*` trong Core.

### Priority 3: Bổ sung Native Whale Feed per-symbol
1. Bổ sung route `/core/v1/signals/whale-feed/{symbol}/` vào `signal_intelligence/urls.py`.
2. Di chuyển frontend từ `/api/realtime/whale-feed/{symbol}/` sang route native mới này.
