# Sprint 21 - Market Data endpoint inventory (S21-05)

Trang thai: COMPLETED

## Muc tieu

Lap bang mapping endpoint Market Data legacy trong views.py sang boundary moi Views -> Services -> Adapters, kem rule auth/cache/fallback.

## Endpoint inventory

| Endpoint | Legacy view | Refactored view | Service method | Auth | Query params chinh | Cache/fallback notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| /api/realtime/ticker/{symbol}/ | views.RealtimeTickerView | market_views.RealtimeTickerView | market_data_service.get_realtime_ticker | JWT | none | uu tien cache/db, fallback provider |
| /api/realtime/intraday/{symbol}/ | views.IntradayMatchedView | market_views.IntradayMatchedView | market_data_service.get_intraday_matched | JWT | page_size | uu tien stream/db, fallback vnstock |
| /api/realtime/price-board/{symbol}/ | views.PriceBoardView | market_views.PriceBoardView | market_data_service.get_price_board | JWT | none | cache key theo symbol, fallback vnstock |
| /api/realtime/breadth/{symbol}/ | views.SectorBreadthView | market_views.SectorBreadthView | market_data_service.get_sector_breadth | JWT | none | cache + fallback list groups |
| /api/realtime/rvol/{symbol}/ | views.RVOLView | market_views.RVOLView | market_data_service.get_rvol | JWT | none | cache + DB aggregation |
| /api/realtime/whale-feed/{symbol}/ | views.WhaleFeedView | market_views.WhaleFeedView | market_data_service.get_whale_feed | JWT + entitlements | threshold tu UserConfig | source uu tien redis stream -> intraday tick DB -> vnstock |
| /api/realtime/whale-feed/aggregate/ | views.WhaleFeedAggregateView | market_views.WhaleFeedAggregateView | market_data_service.get_whale_feed_aggregate | JWT + entitlements | symbols, watchlist_group_ids, sort, limit, cursor | cursor pagination contract v1.1; fallback source chain nhu whale-feed |
| /api/realtime/depth-chart/{symbol}/ | views.DepthChartView | market_views.DepthChartView | market_data_service.get_depth_chart | JWT | none | cache + exchange band fallback |
| /api/stock-management/stocks/{symbol}/financials/ | views.FinancialMetricsView | market_views.FinancialMetricsView | market_data_service.get_financial_metrics | JWT | none | cache 6h + provider parse guard |
| /api/stock-management/stocks/{symbol}/overview/ | views.StockWorkspaceOverviewView | market_views.StockWorkspaceOverviewView | market_data_service.get_stock_workspace_overview | JWT | none | cache short TTL + profile/watchlist enrichment |
| /api/stock-management/stocks/{symbol}/chart/ | views.StockWorkspaceChartView | market_views.StockWorkspaceChartView | market_data_service.get_stock_workspace_chart | JWT | days | DB series + technical calc trong service |

## Toggle routing

- Realtime routes: backend/portfolio/urls_realtime.py su dung toggle ENABLE_NEW_MARKET_VIEWS.
- Stock-management market routes: backend/portfolio/urls_stock.py su dung toggle ENABLE_NEW_MARKET_VIEWS.

## Regression evidence

- Contract toggle tests cho cac endpoint tren nam trong backend/portfolio/tests/test_api_routes.py.
- Regression whale-feed fallback va aggregate cursor/source da co test pass.
