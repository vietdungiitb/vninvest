# TASKBOARD THUC THI - LARGE FILE REFACTOR

Cap nhat: 2026-04-12

## Sprint 1 - Dang thuc hien

### Da xong
- [x] Tao guard script: scripts/quality/check_large_files.ps1
- [x] Tao workflow CI: .github/workflows/large-file-guard.yml
- [x] Tao allowlist baseline: scripts/quality/large_file_allowlist.txt
- [x] Tao module moi: backend/portfolio/views_portfolio_watchlist.py
- [x] Re-export symbol trong backend/portfolio/views.py de giu compatibility
- [x] Tao module moi: backend/portfolio/views_stock_management.py
- [x] Tach Securities + TrackedSymbol + PriceAlert khoi monolith views.py
- [x] Chay smoke test stock-management endpoint (3 test pass)
- [x] Tao module moi: backend/portfolio/views_screener.py
- [x] Tach Screener views khoi monolith views.py
- [x] Tao module moi: backend/portfolio/views_stock_workspace_admin.py
- [x] Tach Stock Workspace + AdminOps views khoi monolith views.py
- [x] Tao module moi: backend/portfolio/views_realtime_core.py
- [x] Tach Realtime core views (ticker/intraday/price-board/breadth)
- [x] Chay smoke test realtime core + stock workspace + admin_ops
- [x] Tao module moi: backend/portfolio/views_realtime_advanced.py
- [x] Tach WhaleFeedView + RVOLView khoi monolith views.py
- [x] Chay test muc tieu whale-feed + rvol (3 test pass)
- [x] Tao module moi: backend/portfolio/views_realtime_aggregate_campaigns.py
- [x] Tach WhaleFeedAggregateView + WhaleCampaignsView khoi monolith views.py
- [x] Chay test muc tieu aggregate/campaigns (9 test pass)
- [x] Tao module moi: backend/portfolio/views_realtime_depth_financial.py
- [x] Tach DepthChartView + FinancialMetricsView khoi monolith views.py
- [x] Chay test muc tieu depth/financial (4 test pass)
- [x] Tao module moi: backend/portfolio/views_ai_advisory_trace.py
- [x] Tach Advisory trace + observability APIs khoi monolith views.py
- [x] Chay test muc tieu advisory-trace/observability/session (8 test pass)
- [x] Tao module moi: backend/portfolio/views_ai_advisory_components_summary.py
- [x] Tach advisory component + summary regenerate/delete APIs khoi monolith views.py
- [x] Chay test muc tieu advisory-components/summary (10 test pass)
- [x] Tao module moi: backend/portfolio/views_ai_advisory_session.py
- [x] Tach stock_ai_advisory_session core + session-v2 helper + rollout gate helper khoi monolith views.py
- [x] Chay test muc tieu advisory-session/observability/pr3-threshold (28 test pass)
- [x] Tao module moi: backend/portfolio/views_ai_advisory_management.py
- [x] Tach whale advisory list/canonical/auto-refresh/refresh/current-delete khoi monolith views.py
- [x] Chay test muc tieu whale-advisory list-management (22 test pass)
- [x] Tao module moi: backend/portfolio/views_admin_runtime.py
- [x] Tach admin runtime KPI + system-ai-settings + vnstock runtime config + warm prefetch khoi monolith views.py
- [x] Chay test muc tieu admin-runtime/system-ai/vnstock-admin-ops (48 test pass)
- [x] Tao module moi: backend/portfolio/views_ai_runtime_stats.py
- [x] Tach ai-options/ai-config/ai-test-connection + whale-advisory-symbol-stats khoi monolith views.py
- [x] Chay test muc tieu ai-config + patch-compat (12 test pass)
- [x] Tao module moi: backend/portfolio/views_stock_news.py
- [x] Tach stock_news_api + stock_news_ai_summary_api + portfolio_news_digest_api khoi monolith views.py
- [x] Bo sung re-export helper compatibility cho sprint17/whale-feed/stock-workspace trong facade views.py
- [x] Chay regression route + ai-config (241 test pass)
- [x] Tao module moi: backend/portfolio/runtime_policy_helpers.py
- [x] Tach helper runtime policy (governance delta + prefetch runtime + prefetch time policy) khoi facade views.py
- [x] Chay smoke regression system-ai-admin-api (18 test pass)

### Dang lam
- [ ] Gom module realtime theo boundary domain
- [ ] Don dep helper runtime/advisory con lai trong views.py
- [ ] Chia test_api_routes theo cum domain

## Sprint 2 - Ke tiep

### Backlog uu tien cao
- [ ] Tach views_ai_advisory.py
- [x] Di chuyen helper runtime policy sang module rieng

### Backlog uu tien trung binh
- [ ] Chia nho frontend/src/pages/StockDetail.jsx
- [ ] Chia nho frontend/src/pages/Watchlist.jsx
- [ ] Chia nho backend/portfolio/tasks.py

## RACI de xuat

- Responsible: Backend team
- Accountable: Tech lead
- Consulted: QA + DevOps
- Informed: Frontend + Product

## KPI tracking (dien hang ngay)

- views.py lines: 843
- So file >1200 lines:
- So test patch portfolio.views.*:
- API smoke pass rate: 241/241 targeted route+ai-config; 18/18 system-ai-admin-api
- So regression issue/sprint:
