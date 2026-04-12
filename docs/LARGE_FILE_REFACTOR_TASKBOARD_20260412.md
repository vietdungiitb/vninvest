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
- [x] Tao module moi: backend/portfolio/views_realtime_symbol_investigation.py
- [x] Tach symbol_investigation_api khoi facade views.py theo boundary realtime
- [x] Chay smoke regression symbol-investigation routes (4 test pass)
- [x] Tao module moi: backend/portfolio/views_realtime_whale_symbol_summary.py
- [x] Tach whale_symbol_summary_api khoi facade views.py theo boundary realtime
- [x] Tao module moi: backend/portfolio/views_admin_sync.py
- [x] Tach sync_stockprofile_api + sync_market_groups_api khoi facade views.py theo boundary admin-sync
- [x] Tao module moi: backend/portfolio/views_stock_catalog.py
- [x] Tach StockProfileListView + SecuritiesGroupListView + SecuritiesItemListView khoi facade views.py theo boundary stock-catalog
- [x] Harden compatibility facade: giu patch target portfolio.views.sync_stock_profiles + generate_whale_advisory_task + detect_dark_flow sau tach module
- [x] Slice 1 test split: tach test_stock_management_groups_endpoint + test_admin_sync_stockprofile_endpoint sang backend/portfolio/tests/test_api_routes_admin_sync_groups.py
- [x] Slice 2 test split: tach 4 test symbol-investigation sang backend/portfolio/tests/test_api_routes_symbol_investigation.py
- [x] Slice 3 test split: tach test_jwt_token_obtain_endpoint + test_register_endpoint_creates_unverified_user_and_sends_verification_email sang backend/portfolio/tests/test_api_routes_auth_basic.py
- [x] Slice 4 test split: tach 8 test auth password-reset sang backend/portfolio/tests/test_api_routes_auth_password_reset.py
- [x] Slice 5 test split: tach 3 test auth verify-email/resend-verification sang backend/portfolio/tests/test_api_routes_auth_email_verification.py
- [x] Slice 6 test split: tach 8 test auth register validation/onboarding sang backend/portfolio/tests/test_api_routes_auth_register.py
- [x] Slice 7 test split: tach 3 test auth oauth-google sang backend/portfolio/tests/test_api_routes_auth_oauth_google.py
- [x] Slice 8 test split: tach 6 test auth profile/access (login gating + auth me + userconfig) sang backend/portfolio/tests/test_api_routes_auth_profile.py
- [x] Slice 9 test split: tach 4 test whale-advisory access/detail/filter sang backend/portfolio/tests/test_api_routes_whale_advisory_access.py
- [x] Slice 10 test split: tach 13 test whale-advisory refresh/auto-refresh/quota/fallback sang backend/portfolio/tests/test_api_routes_whale_advisory_refresh.py
- [x] Slice 11 test split: tach 3 test whale-advisory delete-current sang backend/portfolio/tests/test_api_routes_whale_advisory_delete_current.py
- [x] Slice 12 test split: tach 12 test stock ai-advisory-session (contract/gating/quota) sang backend/portfolio/tests/test_api_routes_stock_ai_advisory_session.py
- [x] Slice 13 test split: tach 6 test stock workspace feature-access (order-flow + advisory-components lock/admin) sang backend/portfolio/tests/test_api_routes_stock_workspace_feature_access.py
- [x] Slice 14 test split: tach 5 test ai-advisory-components chart-context validation sang backend/portfolio/tests/test_api_routes_stock_ai_advisory_components_chart_context.py
- [x] Slice 15 test split: tach 5 test stock workspace usage-tracking + component persistence sang backend/portfolio/tests/test_api_routes_stock_workspace_usage_persistence.py
- [x] Slice 16 test split: tach 5 test stock ai-advisory-trace (trace/list/filter/export) sang backend/portfolio/tests/test_api_routes_stock_ai_advisory_trace.py
- [x] Slice 17 test split: tach cum lon 115 test stock workspace + realtime + advisory components/observability sang backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py; giam monolith test_api_routes.py xuong <1500 lines
- [x] Slice 18 test split: tach 26 test trading + P1-13 smoke sang backend/portfolio/tests/test_api_routes_trading_and_p1_13.py; monolith backend/portfolio/tests/test_api_routes.py chi con base helper (0 test method)
- [x] Guardrail moi: CI fail neu backend/portfolio/tests/test_api_routes.py co them def test_ (bat buoc tao test_api_routes_*.py ngay tu dau)

### Dang lam
- [ ] Gom module realtime theo boundary domain
- [ ] Don dep helper runtime/advisory con lai trong views.py
- [x] Chia test_api_routes theo cum domain

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

- views.py lines: 666
- So file >1200 lines:
- So test patch portfolio.views.*:
- API smoke pass rate: 241/241 targeted route+ai-config; 18/18 system-ai-admin-api; 4/4 symbol-investigation
- So regression issue/sprint:
