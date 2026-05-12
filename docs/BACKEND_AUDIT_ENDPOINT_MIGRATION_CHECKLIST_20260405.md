# Backend Audit Endpoint Migration Checklist 2026-04-05

Status: ACTIVE
Goal: theo doi task A2/A3 toi muc endpoint-level
Related board: docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md

## 1) Checklist

Legend status:
- Todo: chua migrate
- In Progress: dang migrate/parity test
- Done: migrate xong + parity test pass + no direct provider call in legacy handler path for scoped endpoint

| ID | Endpoint | Legacy view | Refactored view | Service method | Direct provider in legacy flow | Parity test | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MKT-01 | /api/realtime/ticker/{symbol}/ | RealtimeTickerView | RealtimeTickerView | get_realtime_ticker | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-02 | /api/realtime/intraday/{symbol}/ | IntradayMatchedView | IntradayMatchedView | get_intraday_matched | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-03 | /api/realtime/price-board/{symbol}/ | PriceBoardView | PriceBoardView | get_price_board | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-04 | /api/realtime/breadth/{symbol}/ | SectorBreadthView | SectorBreadthView | get_sector_breadth | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-05 | /api/realtime/rvol/{symbol}/ | RVOLView | RVOLView | get_rvol | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-06 | /api/realtime/whale-feed/{symbol}/ | WhaleFeedView | WhaleFeedView | get_whale_feed | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-07 | /api/realtime/whale-feed/aggregate/ | WhaleFeedAggregateView | WhaleFeedAggregateView | get_whale_feed_aggregate | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-08 | /api/realtime/depth-chart/{symbol}/ | DepthChartView | DepthChartView | get_depth_chart | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-09 | /api/stock-management/stocks/{symbol}/financials/ | FinancialMetricsView | FinancialMetricsView | get_financial_metrics | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-10 | /api/stock-management/stocks/{symbol}/overview/ | StockWorkspaceOverviewView | StockWorkspaceOverviewView | get_stock_workspace_overview | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |
| MKT-11 | /api/stock-management/stocks/{symbol}/chart/ | StockWorkspaceChartView | StockWorkspaceChartView | get_stock_workspace_chart | Yes | Pass | In Progress | docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md |

## 2) Exit criteria for A2/A3

A2 done khi:
1. MKT-02,03,05,08,09 status = Done.
2. Focused tests pass tren CI.

A3 done khi:
1. MKT-10,11 status = Done.
2. Workspace overview/chart khong con import provider truc tiep trong legacy hot path da scope.

## 3) Verification commands

```powershell
# 1) Check route toggle still active
rg "_toggle_market_view\(" backend/portfolio/urls_realtime.py backend/portfolio/urls_stock.py

# 2) Scan direct provider imports in legacy views
rg "from vnbroker import Vnbroker" backend/portfolio/views.py

# 3) Run focused route tests
cd backend
python manage.py test portfolio.tests.test_api_routes
```

## 4) Notes

- Checklist nay theo doi migration theo endpoint, khong thay the board tong A1..E2.
- Moi khi doi status endpoint, phai them link evidence test/log tu ngay do.
