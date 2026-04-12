# KE HOACH THUC THI CHI TIET - LARGE FILE REFACTOR

Ngay cap nhat: 2026-04-12
Pham vi: backend/portfolio/views.py va cac diem phu thuoc truc tiep

## 1) Tong ket hien trang da xac minh

- File backend/portfolio/views.py ~6839 dong, la risk maintainability muc do Critical.
- File backend/portfolio/models.py ~1913 dong, dang o muc can canh bao.
- Namespace portfolio.views dang bi patch/import rat nhieu trong tests va admin.
- urls.py hien map nhieu endpoint vao views monolith, mot so endpoint da co toggle qua trading_views.

Ket luan: Khong the tach nong theo kieu move code hang loat trong 1 PR. Can chay theo lo trinh co lop tuong thich de khong vo test va API contract.

## 2) Muc tieu ky thuat (Definition of Done)

Muc tieu bat buoc:
- Khong doi API contract (URL + payload + status code) voi frontend/mobile.
- Khong downtime, khong yeu cau data migration cho split views.
- Giam kich thuoc backend/portfolio/views.py xuong <1500 dong trong 3 sprint.
- Them guardrail CI de ngan no ky thuat tai phat.

KPI do duoc:
- So dong views.py theo tung sprint.
- So conflict tren backend/portfolio/views.py trong git history theo tuan.
- Time-to-review trung binh cho PR co backend endpoints.
- Ty le test regression lien quan API routes.

## 3) Guardrail da trien khai ngay

Da them:
- scripts/quality/check_large_files.ps1
- scripts/quality/large_file_allowlist.txt
- .github/workflows/large-file-guard.yml

Quy uoc threshold:
- Warning: >= 800 dong
- Fail CI: >= 1200 dong

Ghi chu: Neu can danh sach allowlist tam thoi cho file legacy, se bo sung o sprint 1 de tranh block toan bo pipeline.
Cap nhat: Allowlist baseline da duoc mo rong theo hien trang file legacy >1200 dong de chi chan vi pham moi, khong lam do pipeline vi no cu.

## 4) Dependency map can quan ly khi tach

Nguon phu thuoc quan trong:
- backend/portfolio/urls.py import truc tiep views
- backend/portfolio/urls_admin_sync.py va urls_realtime.py, urls_stock.py co import views
- backend/portfolio/admin.py import helper function tu views
- backend/portfolio/tests/* patch namespace portfolio.views.* rat nhieu

Y nghia:
- Bat buoc tao lop compatibility (re-export) trong portfolio/views.py trong suot qua trinh tach.
- Khong doi ten symbol public trong giai doan 1-2.

## 5) Ke hoach thuc thi chi tiet theo sprint

### Sprint 0 (1-2 ngay) - On dinh va do luong

Hang muc:
- Bat workflow large-file-guard cho PR/push dev-main-deploy.
- Chot baseline metrics: line count, API smoke, test pass rate.
- Chot naming convention cho module views moi.

Deliverables:
- Bao cao baseline metrics trong docs.
- Rule review: endpoint moi khong duoc add vao monolith views.py.

### Sprint 1 (3-5 ngay) - Tach nhom it rui ro

Muc tieu: di chuyen endpoint CRUD don gian, it side effects.

Tach thanh module:
- backend/portfolio/views_portfolio.py
  - PortfolioListCreateView
  - PortfolioDetailView
  - SubAccountListCreateView
  - SubAccountDetailView
  - TransactionListCreateView
  - TransactionDetailView
  - UserConfigView
  - HoldingsView, SummaryView, ChartDataView, EquityCurveView, AllocationView, PortfolioAnalyticsView, SyncPricesView
- backend/portfolio/views_watchlist.py
  - WatchlistGroup* + WatchlistItem* + WatchlistSeedView + WatchlistSyncView
  - TrackedSymbol* + PriceAlertRule*

Ky thuat migration:
- Move code sang file moi.
- Tai portfolio/views.py giu import re-export de symbol cu van ton tai.
- urls.py giu nguyen path va ten view trong sprint 1.

Test gating:
- Chay test_api_routes subset lien quan portfolio/watchlist.
- Chay smoke endpoints GET/POST chinh.

### Sprint 2 (5-7 ngay) - Tach realtime va stock workspace

Tach thanh module:
- backend/portfolio/views_realtime.py
  - RealtimeTickerView, IntradayMatchedView, PriceBoardView, SectorBreadthView
  - WhaleFeedView, RVOLView, WhaleFeedAggregateView, WhaleCampaignsView, DepthChartView
- backend/portfolio/views_stock_workspace.py
  - StockWorkspaceOverviewView, StockWorkspaceChartView, StockProfile*.
  - FinancialMetricsView, stock_order_flow_api

Dieu kien bat buoc:
- Theo doi latency P95 va cache hit truoc/sau tach de xac nhan khong regression.

### Sprint 3 (7-10 ngay) - Tach AI advisory + admin ops (rui ro cao)

Tach thanh module:
- backend/portfolio/views_ai_advisory.py
  - WhaleAdvisoryListView + toan bo stock_ai_advisory_* + trace + observability
  - ai_advisory_canonical_symbol_api, refresh/delete/current stats
- backend/portfolio/views_admin_runtime.py
  - admin_runtime_kpi_*, admin_system_ai_*, admin_vnstock_runtime_config_*
  - prefetch/governance runtime policy helpers

Luu y ky thuat:
- Day la nhom co nhieu shared helper + patch tests; can tach theo pattern:
  - helper functions -> view_helpers.py hoac module helper chuyen biet
  - endpoint wrappers giu trong portfolio/views.py de backward compatibility tam thoi

### Sprint 4 (2-3 ngay) - Don dep legacy

Hang muc:
- Rut gon portfolio/views.py con import va wrapper toi thieu.
- Cap nhat tests patch den module moi (portfolio.views_xxx.*) theo lot.
- Cap nhat docs architecture map.

Exit criteria:
- views.py <1500 dong
- khong test fail do import path cu
- khong route regression

## 6) Ke hoach PR slices (de tranh Big Bang)

PR-1:
- Tao module moi + move nhom portfolio CRUD
- Giu re-export trong portfolio/views.py

PR-2:
- Move watchlist + tracked symbol + price alert

PR-3:
- Move realtime core

PR-4:
- Move stock workspace

PR-5:
- Move admin runtime

PR-6:
- Move AI advisory

PR-7:
- Test patch path migration + cleanup wrappers

Moi PR:
- <= 800 lines changed neu co the
- Co rollback note
- Co test subset mapping ro rang

## 7) Rollback strategy

- Vi routes va symbol public giu nguyen, rollback chu yeu la revert PR theo thu tu nguoc.
- Neu co incident production:
  - Revert PR moi nhat
  - Restart backend workers
  - Chay smoke endpoints quan trong

## 8) Risk register cap nhat

Risk 1: Vo test do patch namespace portfolio.views
- Muc do: Cao
- Giam thieu: re-export compatibility + migrate patch path theo lot

Risk 2: Route regression khi doi import
- Muc do: Cao
- Giam thieu: giu urlpatterns va name cu, chi doi module noi bo

Risk 3: Side-effect helper bi di chuyen sai module
- Muc do: Trung binh-Cao
- Giam thieu: move kem unit tests helper + smoke test endpoint

## 9) Phan cong de xuat (co the dieu chinh)

- Backend Lead: tach module + compatibility layer
- QA/API owner: smoke test va regression checklist
- DevOps: monitor CI large-file-guard va release gate
- Tech Lead: review boundary va acceptance KPI

## 10) Bao cao tien do hang ngay (template ngan)

- Da xong:
- Dang lam:
- Blocker:
- KPI hien tai (views.py lines, test pass rate):
- Ke hoach 24h tiep theo:

---

Trang thai hien tai: DA BAT DAU THUC THI (guardrail CI + execution plan).
Tien do moi nhat:
- Da hoan tat PR-1 ky thuat: tach Portfolio + Watchlist sang module backend/portfolio/views_portfolio_watchlist.py.
- Da giu compatibility bang re-export symbol tai backend/portfolio/views.py.
- Da hoan tat PR-2 ky thuat: tach Securities + TrackedSymbol + PriceAlert sang module backend/portfolio/views_stock_management.py.
- Da hoan tat PR-2b ky thuat: tach Screener sang module backend/portfolio/views_screener.py.
- Da hoan tat PR-2c ky thuat: tach Stock Workspace + Admin Ops sang module backend/portfolio/views_stock_workspace_admin.py.
- Da hoan tat PR-3a ky thuat: tach Realtime core (ticker/intraday/price-board/breadth) sang module backend/portfolio/views_realtime_core.py.
- Da hoan tat PR-3b (phan 1): tach WhaleFeedView + RVOLView sang module backend/portfolio/views_realtime_advanced.py.
- Da hoan tat PR-3b (phan 2): tach WhaleFeedAggregateView + WhaleCampaignsView sang module backend/portfolio/views_realtime_aggregate_campaigns.py.
- Da giam backend/portfolio/views.py tu ~6839 dong xuong ~4694 dong.

Buoc tiep theo de code refactor: Sprint 1, PR-3c (ai-advisory trace split) va tach helper/runtime khoi monolith views.py.
