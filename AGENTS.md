# AGENTS.md

## 1. Project summary

VNInvest là workspace đầu tư chứng khoán Việt Nam với frontend React, backend Django, realtime feed, whale analytics, AI advisory và nhiều surface dashboard/workspace khác nhau.

> [!IMPORTANT]
> **QUY ĐỊNH BẮT BUỘC: PHÂN TÁCH LEGACY VÀ SAAS NATIVE**
> - **Thư mục Legacy chỉ dùng để tham khảo:** Thư mục `backend/` và `frontend/` cũ ở thư mục gốc chính thức chuyển sang trạng thái **deprecated** (không còn phát triển). Chúng chỉ được giữ lại để tham khảo nghiệp vụ và tính năng cũ.
> - **Phạm vi phát triển mới:** Mọi chức năng mới, nâng cấp, sửa đổi hoặc sửa lỗi (bug fixes) của dự án **bắt buộc** phải tuân theo kiến trúc **SaaS native** và nằm hoàn toàn trong:
>   1. Backend/API Service: `packages/core` (core-api)
>   2. Web Frontend: `packages/web`
> - **Lộ trình dọn dẹp:** Thư mục `frontend/` cũ sẽ bị xóa bỏ hoàn toàn ngay khi toàn bộ các thành phần đã được chuyển đổi hết sang SaaS.
> - **Chế tài:** Tuyệt đối cấm phát triển tính năng mới vào các thư mục `backend` và `frontend` cũ. Mọi thay đổi vi phạm sẽ bị đánh giá là Quality Gate Failure.

Feature pack hiện tại cần mọi AI session đọc trước khi làm việc là gói:

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
3. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/TASKBOARD_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
6. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
6. `quality/QUALITY.md`

Với task liên quan `Money Flow Control Center`, `Signal Control Center`, `Data Ops`, lifecycle lưu trữ whale/dark-flow, materialization/backfill/retention hoặc tối ưu cold path `whale-alerts/:symbol`, đọc thêm gói:

1. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
2. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
3. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_EXECUTION_EVIDENCE_TEMPLATE_20260501.md`
8. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
9. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
10. `docs/RUN_CODE_REVIEW_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
11. `docs/RUN_INTEGRATION_TESTS_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
12. `docs/RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`

Với task liên quan `SaaS Full Independence`, `Option B`, `proxy gateway`, `loại bỏ phụ thuộc legacy`, `legacy_proxy.py`, `B1 proxy`, `B4 portfolio cutover`, `B7 WebSocket`, `B8 decommission`, đọc gói:

1. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md`
2. `docs/IMPLEMENTATION_PLAN_SAAS_FULL_INDEPENDENCE_20260504.md`
3. `docs/TECH_SPEC_SAAS_FULL_INDEPENDENCE_20260504.md`
4. `docs/TASKBOARD_SAAS_FULL_INDEPENDENCE_20260504.md`
5. `docs/SAAS_FULL_INDEPENDENCE_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_FULL_INDEPENDENCE_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
7. `docs/SAAS_FULL_INDEPENDENCE_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
8. `docs/SAAS_FULL_INDEPENDENCE_CONFIG_OWNERSHIP_MATRIX_20260504.md`
9. `docs/SAAS_FULL_INDEPENDENCE_CODE_QUALITY_CONSTITUTION_20260504.md`
10. `docs/RUN_CODE_REVIEW_SAAS_FULL_INDEPENDENCE_20260504.md`
11. `docs/RUN_INTEGRATION_TESTS_SAAS_FULL_INDEPENDENCE_20260504.md`
12. `docs/RUN_SPEC_AUDIT_SAAS_FULL_INDEPENDENCE_20260504.md`

Với task liên quan `SaaS Production Migration`, `legacy decommission`, `domain migration`, `packages/core`, `vninvest_core`, `identity_access`, `commercial`, `signal_intelligence`, `market_serving`, `advisory`, `user_workspace`, `market_data`, `data_ingest`, đọc gói:

1. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`
2. `docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md`
3. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
4. `docs/TASKBOARD_SAAS_MIGRATION_20260504.md`
5. `docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
7. `docs/SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
8. `docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md`
9. `docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md`
10. `docs/RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md`
11. `docs/RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md`
12. `docs/RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md`

Với task liên quan `global market data matrix`, `global symbol matrix`, `market data SSOT`, `runtime data ingest control center`, `coverage gap`, `freshness gap`, `missing-only crawl planner`, `watchlist/tracked/holding promotion`, đọc gói:

1. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`
2. `docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
3. `docs/TECH_SPEC_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
4. `docs/TASKBOARD_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
5. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_TRACEABILITY_MATRIX_20260515.md`
6. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_SELF_AUDIT_AND_TEST_PROTOCOL_20260515.md`
7. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_CODE_QUALITY_CONSTITUTION_20260515.md`
8. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_EXECUTION_EVIDENCE_TEMPLATE_20260515.md`

Với task liên quan `Coordinated Parallel Scraping`, `CPS`, `daily bootstrap window`, `tier quota scheduler`, `provider bucket parallel`, `market data backfill depth`, đọc gói:

1. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_HANDOFF_MASTER_20260517.md`
2. `docs/IMPLEMENTATION_PLAN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
3. `docs/TECH_SPEC_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
4. `docs/TASKBOARD_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
5. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_TRACEABILITY_MATRIX_20260517.md`
6. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_SELF_AUDIT_AND_TEST_PROTOCOL_20260517.md`
7. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_EXECUTION_EVIDENCE_TEMPLATE_20260517.md`
8. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_CONFIG_OWNERSHIP_MATRIX_20260517.md`
9. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_CODE_QUALITY_CONSTITUTION_20260517.md`
10. `docs/FRONTEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
11. `docs/BACKEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
12. `docs/RUN_CODE_REVIEW_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
13. `docs/RUN_INTEGRATION_TESTS_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
14. `docs/RUN_SPEC_AUDIT_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`

Với task liên quan `Global Alert Center`, `unified alert center`, `alert-center feed`, `alert-center summary`, `price shock`, `stale quote`, `AI Alerts`, `AI Suggests`, `per-user alert delivery`, `alert-center cutover`, đọc gói:

1. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`
2. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
3. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
4. `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
5. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md`
6. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`
7. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_EXECUTION_EVIDENCE_TEMPLATE_20260516.md`
8. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CONFIG_OWNERSHIP_MATRIX_20260516.md`
9. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CODE_QUALITY_CONSTITUTION_20260516.md`
10. `docs/RUN_CODE_REVIEW_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
11. `docs/RUN_INTEGRATION_TESTS_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
12. `docs/RUN_SPEC_AUDIT_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`

Với task liên quan `SOC Config UI`, `Global Screener quản trị`, `PrefetchPanel`, `DataOps backfill`, `VnbrokerPanel`, `screener rule CRUD`, `admin-ops decommission`, `410 GONE`, đọc gói:

1. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_HANDOFF_MASTER_20260516.md`
2. `docs/IMPLEMENTATION_PLAN_SOC_CONFIG_UI_20260516.md`
3. `docs/TECH_SPEC_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
4. `docs/TASKBOARD_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
5. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_TRACEABILITY_MATRIX_20260516.md`
6. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`
7. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_CODE_QUALITY_CONSTITUTION_20260516.md`
8. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_EXECUTION_EVIDENCE_TEMPLATE_20260516.md`
9. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_CONFIG_OWNERSHIP_MATRIX_20260516.md`
10. `docs/RUN_CODE_REVIEW_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
11. `docs/RUN_INTEGRATION_TESTS_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
12. `docs/RUN_SPEC_AUDIT_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`

Với task liên quan `Dashboard SaaS Native Migration`, `DashboardPage`, `PackageDashboardHost`, `ModernDashboard decommission`, `useCoreDashboardData`, `coreApiAdapter portfolio analytics`, `dashboard route swap`, `dashboard parity`, đọc gói:

1. `docs/DASHBOARD_SAAS_NATIVE_MIGRATION_HANDOFF_MASTER_20260518.md`
2. `docs/IMPLEMENTATION_PLAN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
3. `docs/TECH_SPEC_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
4. `docs/TASKBOARD_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
5. `docs/DASHBOARD_SAAS_NATIVE_MIGRATION_TRACEABILITY_MATRIX_20260518.md`
6. `docs/DASHBOARD_SAAS_NATIVE_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260518.md`
7. `docs/DASHBOARD_SAAS_NATIVE_MIGRATION_CODE_QUALITY_CONSTITUTION_20260518.md`
8. `docs/DASHBOARD_SAAS_NATIVE_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260518.md`
9. `docs/FRONTEND_DESIGN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
10. `docs/BACKEND_DESIGN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
11. `docs/RUN_CODE_REVIEW_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
12. `docs/RUN_INTEGRATION_TESTS_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`
13. `docs/RUN_SPEC_AUDIT_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md`

Với task liên quan `Dashboard Information Architecture Redesign`, `/dashboard` IA redesign, `heatmap center`, `UnifiedAlertCenter`, `AIAdvisorAlertPanel`, `FactsFirstModularPositionDeck`, `triad + full-width deck`, đọc gói:

1. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_HANDOFF_MASTER_20260519.md`
2. `docs/IMPLEMENTATION_PLAN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
3. `docs/TECH_SPEC_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
4. `docs/TASKBOARD_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
5. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_TRACEABILITY_MATRIX_20260519.md`
6. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md`
7. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_EXECUTION_EVIDENCE_TEMPLATE_20260519.md`
8. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_CONFIG_OWNERSHIP_MATRIX_20260519.md`
9. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_CODE_QUALITY_CONSTITUTION_20260519.md`
10. `docs/FRONTEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
11. `docs/BACKEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
12. `docs/RUN_CODE_REVIEW_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
13. `docs/RUN_INTEGRATION_TESTS_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
14. `docs/RUN_SPEC_AUDIT_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`

## 2. Read-first quality docs

Trước mọi thay đổi có liên quan feature này, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
3. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
5. `quality/RUN_CODE_REVIEW.md`
6. `quality/RUN_INTEGRATION_TESTS.md`
7. `quality/RUN_SPEC_AUDIT.md`

Trước mọi thay đổi liên quan `Money Flow Control Center` hoặc lifecycle lưu trữ whale/dark-flow, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
3. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
8. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
9. `docs/RUN_CODE_REVIEW_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
10. `docs/RUN_INTEGRATION_TESTS_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
11. `docs/RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`

Trước mọi thay đổi liên quan `SaaS Production Migration`, `packages/core`, `legacy decommission`, hoặc domain migration, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`
3. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
4. `docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md`
5. `docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md`
7. `docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md`
8. `docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
9. `docs/RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md`
10. `docs/RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md`
11. `docs/RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md`

Trước mọi thay đổi liên quan `SaaS Full Independence`, `Option B`, `proxy gateway`, `B1-B8 phases`, hoặc `loại bỏ phụ thuộc legacy`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md`
3. `docs/TECH_SPEC_SAAS_FULL_INDEPENDENCE_20260504.md`
4. `docs/IMPLEMENTATION_PLAN_SAAS_FULL_INDEPENDENCE_20260504.md`
5. `docs/SAAS_FULL_INDEPENDENCE_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_FULL_INDEPENDENCE_CONFIG_OWNERSHIP_MATRIX_20260504.md`
7. `docs/SAAS_FULL_INDEPENDENCE_CODE_QUALITY_CONSTITUTION_20260504.md`
8. `docs/SAAS_FULL_INDEPENDENCE_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
9. `docs/RUN_CODE_REVIEW_SAAS_FULL_INDEPENDENCE_20260504.md`
10. `docs/RUN_INTEGRATION_TESTS_SAAS_FULL_INDEPENDENCE_20260504.md`
11. `docs/RUN_SPEC_AUDIT_SAAS_FULL_INDEPENDENCE_20260504.md`

Trước mọi thay đổi liên quan `OpenAPI`, `API contract`, `serializer schema`, `response envelope`, `status code semantics`, `rate limit`, `tenant isolation`, hoặc chuẩn hóa endpoint trong `core-api`, đọc theo thứ tự:

1. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
2. `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
3. `docs/CORE_API_REMEDIATION_PROPOSAL_20260513.md`
4. `docs/CORE_API_FIX_CHECKLIST_20260513.md`
5. `docs/CORE_API_OPENAPI_STANDARDIZATION_HANDOFF_MASTER_20260513.md`
6. `docs/IMPLEMENTATION_PLAN_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
7. `docs/TECH_SPEC_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
8. `docs/TASKBOARD_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
9. `docs/CORE_API_OPENAPI_STANDARDIZATION_TRACEABILITY_MATRIX_20260513.md`
10. `docs/CORE_API_OPENAPI_STANDARDIZATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260513.md`
11. `docs/RUN_CODE_REVIEW_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
12. `docs/RUN_INTEGRATION_TESTS_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
13. `docs/RUN_SPEC_AUDIT_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`

Trước mọi thay đổi liên quan `global market data matrix`, `global symbol matrix`, `market data SSOT`, `coverage gap`, `freshness gap`, `missing-only crawl planner`, `watchlist/tracked/holding promotion`, hoặc `SOC Data Ops` cho dữ liệu thị trường, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`
3. `docs/TECH_SPEC_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
4. `docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
5. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_TRACEABILITY_MATRIX_20260515.md`
6. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_CODE_QUALITY_CONSTITUTION_20260515.md`
7. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_SELF_AUDIT_AND_TEST_PROTOCOL_20260515.md`

Trước mọi thay đổi liên quan `Coordinated Parallel Scraping`, `CPS`, `daily bootstrap`, `tier quota scheduler`, `provider bucket parallel` hoặc mở rộng `market data backfill depth`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_HANDOFF_MASTER_20260517.md`
3. `docs/TECH_SPEC_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
4. `docs/IMPLEMENTATION_PLAN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
5. `docs/TASKBOARD_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
6. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_TRACEABILITY_MATRIX_20260517.md`
7. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_CONFIG_OWNERSHIP_MATRIX_20260517.md`
8. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_CODE_QUALITY_CONSTITUTION_20260517.md`
9. `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_SELF_AUDIT_AND_TEST_PROTOCOL_20260517.md`
10. `docs/FRONTEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
11. `docs/BACKEND_DESIGN_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
12. `docs/RUN_CODE_REVIEW_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
13. `docs/RUN_INTEGRATION_TESTS_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`
14. `docs/RUN_SPEC_AUDIT_COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_20260517.md`

Trước mọi thay đổi liên quan `Global Alert Center`, `unified alert center`, `price shock`, `stale quote`, `AI Alerts`, `AI Suggests`, `per-user alert delivery`, `alert-center summary`, `alert-center cutover`, hoặc chuẩn hóa native alert feed trong `core-api`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`
3. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
4. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
5. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md`
6. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CONFIG_OWNERSHIP_MATRIX_20260516.md`
7. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CODE_QUALITY_CONSTITUTION_20260516.md`
8. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`
9. `docs/RUN_CODE_REVIEW_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
10. `docs/RUN_INTEGRATION_TESTS_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
11. `docs/RUN_SPEC_AUDIT_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`

Trước mọi thay đổi liên quan `SOC Config UI`, `Global Screener quản trị`, `PrefetchPanel`, `DataOps backfill`, `VnbrokerPanel`, `screener rule CRUD`, `admin-ops decommission`, hoặc `410 GONE`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_HANDOFF_MASTER_20260516.md`
3. `docs/TECH_SPEC_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
4. `docs/IMPLEMENTATION_PLAN_SOC_CONFIG_UI_20260516.md`
5. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_TRACEABILITY_MATRIX_20260516.md`
6. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_CONFIG_OWNERSHIP_MATRIX_20260516.md`
7. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_CODE_QUALITY_CONSTITUTION_20260516.md`
8. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`
9. `docs/RUN_CODE_REVIEW_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
10. `docs/RUN_INTEGRATION_TESTS_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
11. `docs/RUN_SPEC_AUDIT_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`

Trước mọi thay đổi liên quan `/dashboard`, `Dashboard Information Architecture Redesign`, `heatmap center`, `alert lane`, `AI lane`, `FactsFirstModularPositionDeck` full-width, hoặc route swap giữa `ModernDashboard` và `PackageDashboardHost`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_HANDOFF_MASTER_20260519.md`
3. `docs/TECH_SPEC_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
4. `docs/IMPLEMENTATION_PLAN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
5. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_TRACEABILITY_MATRIX_20260519.md`
6. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_CODE_QUALITY_CONSTITUTION_20260519.md`
7. `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md`
8. `docs/FRONTEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
9. `docs/BACKEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
10. `docs/RUN_CODE_REVIEW_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
11. `docs/RUN_INTEGRATION_TESTS_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`
12. `docs/RUN_SPEC_AUDIT_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md`

## 3. Hard constraints for this feature pack

1. `whale-alerts/:symbol` phải dùng KLineChart làm surface trung tâm.
2. `CVD chuẩn hóa` phải nằm ở pane CVD riêng; `Buy Strength` và `Institutional Strength` phải nằm ở pane strength riêng, vẫn cùng trục X và cùng selected-session truth.
3. Heatmap giai đoạn này chỉ theo `time bucket`, chưa làm footprint theo giá x thời gian.
4. Bubble chart của modern dashboard là source bất biến; chỉ copy sang whale route, không sửa trực tiếp.
5. Icon cá mập phải áp dụng cho top 10% nến đang hiển thị trong viewport, không phải toàn dataset.
6. Bubble/advisory phải bám selected session từ KLineChart.
7. `OrderFlowRadarPanel` phải được chuyển xuống dưới KLineChart ở Stock Detail.
8. Các text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu.
9. `Money Flow Control Center` là operator surface thống nhất; không tạo parallel writer ngoài `global_signal_policy_helpers.py`, `runtime_policy_helpers.py` và whale mission-control SSOT.
10. `global_signal_universe_policy` là SSOT cho detection universe; runtime `intraday_universe_group_ids` chỉ là ingest/warm-tier hint.
11. `IntradayTick` là short-lived staging/recovery input; long-term storage ưu tiên canonical events, bucket facts, session summaries và selective forensic windows.
12. Sau lifecycle upgrade, `whale-alerts/:symbol` phải ưu tiên facts-first selected-session path, không full-scan raw ticks trên primary path.

## 4. Current anchor files

### Frontend (legacy — reference only)

- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- `frontend/src/pages/StockDetail.jsx`
- `frontend/src/components/KLineChartPanel.jsx`
- `frontend/src/components/OrderFlowRadarPanel.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx` (immutable source)
- `frontend/src/components/WhaleAnalyticsTab.jsx` (immutable source)
- `frontend/src/components/modern/ModularPositionDeck.jsx` (immutable source)

### Frontend (SaaS native — packages/web)

- `packages/web/src/pages/pageRegistry.js` (route config)
- `packages/web/src/pages/admin/AdminCore*Page.tsx` (8 Admin Core pages — all converted)
- `packages/web/src/adapters/coreApiAdapter.js` (single API adapter)
- `packages/web/tests/visual/login.spec.ts` (Playwright E2E)
- `packages/web/tests/visual/watchlist.spec.ts` (Playwright E2E)

### Backend (legacy — reference only)

- `frontend/src/api/client.js` for current route contracts
- `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`
- `backend/portfolio/tests/test_whale_analytics_snapshot_flow_series.py`
- `backend/portfolio/tests/test_whale_orders_ssot_parity.py`
- `backend/portfolio/tests/test_order_flow.py`
- `backend/portfolio/tests/test_order_flow_source_parity.py`

### Infrastructure

- `docker-compose.yml` (production stack — do not modify)
- `docker-compose.beta.yml` (beta overlay — VIRTUAL_HOST: beta.edusuccess.vn)

## 5. Build and test commands

### Frontend build

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### Backend focused suites

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

### packages/web frontend build (SaaS native)

```powershell
Push-Location ./packages/web
npm run build
Pop-Location
```

### TypeScript check (packages/web)

```powershell
Push-Location ./packages/web
npx tsc --noEmit
Pop-Location
```

### Beta deployment (on docker.edusuccess.vn)

```bash
# Build beta image (standalone — no production compose needed)
docker compose -f docker-compose.beta.yml build frontend-beta

# Deploy beta (production unaffected)
docker compose -f docker-compose.beta.yml up -d

# View beta logs
docker logs -f vninvest-frontend-beta

# Check beta health
curl https://beta.edusuccess.vn

# Stop beta (does NOT stop production)
docker compose -f docker-compose.beta.yml down
```

### Playwright E2E tests (packages/web)

```bash
# Local (dev server)
npx playwright test

# Against beta
PLAYWRIGHT_BASE_URL=https://beta.edusuccess.vn npx playwright test
```

### Runtime refresh for UI/runtime slices

```powershell
.\start_dev.ps1
```

## 6. Required operating discipline for AI sessions

1. Làm theo slice nhỏ, focused, không mở rộng bề mặt ngoài task hiện tại.
2. Sau edit thực chất đầu tiên phải chạy focused validation ngay.
3. Không đánh dấu xong nếu chưa cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.
4. Với slice runtime/UI phải rebuild hoặc restart stack bị ảnh hưởng để final auditor kiểm tra được ngay.
5. Không dùng workaround làm sai ngữ cảnh selected session, tooltip bucket, heatmap semantics hoặc whale marker viewport rule.
6. Sau mỗi lần sửa code, bắt buộc refresh dev runtime qua entrypoint chuẩn `./start_dev.ps1` để đảm bảo env bootstrap, token bootstrap, build, healthcheck và smoke checks đều chạy đúng chuẩn; không được mặc định gọi thẳng `docker compose ... up/build` thay cho script này.
7. `docker compose` trực tiếp cho dev stack chỉ được dùng khi đang debug chính `start_dev.ps1` hoặc cần forensic đặc biệt; mọi trường hợp lệch khỏi `./start_dev.ps1` phải được ghi rõ lý do trong evidence/audit.
8. **QUY ĐỊNH CỨNG**: Kết thúc mọi thay đổi mã nguồn, bắt buộc phải thực hiện rebuild lại và khởi động lại Docker stack bằng script `./start_dev.ps1` để đảm bảo code mới được biên dịch đầy đủ và có hiệu lực thực tế cho người sử dụng. Không được kết thúc phiên làm việc mà không chạy kiểm tra thực tế trên container dev.
9. **QUY ĐỊNH CỨNG**: Khi tạo bộ tài liệu bàn giao cho đội code (handoff doc pack), bắt buộc dùng skill `.copilot/skills/handoff-doc-pack-generator/SKILL.md`; nếu cần khởi tạo khung nhanh thì chạy `.copilot/skills/handoff-doc-pack-scaffold/SKILL.md` trước rồi mới dùng generator để điền đầy đủ nội dung. Không được tạo doc pack thủ công ngoài workflow skill này.

## 7. Evidence obligations

Mỗi slice phải có:

1. danh sách file đổi,
2. command validation và kết quả,
3. screenshot/video nếu là UI,
4. payload snapshot nếu chạm contract,
5. residual risk note nếu còn.

Template chuẩn nằm tại:

- `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_EXECUTION_EVIDENCE_TEMPLATE_20260428.md`
- `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_EXECUTION_EVIDENCE_TEMPLATE_20260501.md`
- `docs/SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`

## 8. Hard constraints for SaaS Migration

1. **Không ghi vào legacy DB từ core containers** — `CoreRouter` phải block; không workaround.
2. **Shadow run bắt buộc** trước mọi Celery task cutover — tối thiểu 3 ngày trade thật.
3. **Parity gate >= 99%** trên mọi domain migration trước khi cutover.
4. **7 pre-decommission gates** (A-G) phải PASS và có Tech Lead sign-off trước khi xoá legacy code.
5. **Không có default passwords** trong prod compose — dùng `${VAR:?error}` syntax.
6. **PAT hash phải dùng HMAC với pepper** — tuyệt đối không plain SHA-256.
7. **ALLOWED_HOSTS** và **CORS** không được wildcard/DEBUG-gated trong production.
8. **Tất cả API calls từ packages/web** phải qua `coreApiAdapter.js` — không direct fetch.
9. **Text mới trong packages/web** phải qua i18n tiếng Việt đầy đủ dấu.
10. **Immutable production builds** — không source mount, không runtime pip install.
11. **Legacy deprecation**: Thư mục `backend/` và `frontend/` cũ ở gốc hoàn toàn chỉ là thư mục để tham khảo tính năng. Mọi chức năng mới bắt buộc phải theo kiến trúc SaaS native và nằm trong `packages/core` (core-api) và `packages/web`.

## 9. Hard constraints for SaaS Full Independence (Option B)

1. **Proxy route phải là route cuối** trong `urls.py` — các native routes không bao giờ bị shadow.
2. **Hop-by-hop headers phải bị strip** trong `legacy_proxy.py` — tuyệt đối không forward `Connection`, `Keep-Alive`, `Transfer-Encoding`.
3. **Timeout proxy**: connect 5s, read 120s (file upload 300s) — không dùng default httpx timeout.
4. **Port 8000 không được exposed** trong bất kỳ compose file nào sau B1.
5. **frontend không được depends_on backend** sau B1 — phải depends_on core-api.
6. **B4 portfolio cutover bắt buộc shadow run >= 3 ngày** với parity_score >= 0.99 trên từng ngày.
7. **Proxy route phải bị xóa hoàn toàn** trước B8 decommission — không để lại dead code.
8. **`legacy_proxy.py` không được log request body** — chỉ log method + path + status code.
9. **WebSocket symbol parameter phải được sanitize** trước khi dùng làm Redis channel key.
10. **LEGACY_BACKEND_URL phải là biến môi trường** — không hardcode trong source.

## 10. Hard constraints for OpenAPI standardization

1. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` là SSOT bắt buộc cho thiết kế endpoint OpenAPI.
2. Mọi PR chạm API contract phải pass đầy đủ `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`.
3. Không merge nếu thiếu cập nhật OpenAPI metadata tương ứng khi thay đổi request/response contract.
4. Không merge nếu endpoint list không có pagination hoặc endpoint auth không có rate limit policy.
5. Tuyệt đối cấm `except: pass` và `except Exception: pass` trong API path.
6. Error response phải dùng đúng khung chuẩn (detail/code/timestamp/request_id/field_errors).
7. Endpoint tenant-scoped bắt buộc có filter tenant ở query layer và test chặn cross-tenant access.
8. Mọi exception khỏi hard rule phải có ticket, owner, expiry; quá hạn thì block merge.

## 11. Hard constraints for VnBroker data access (SSOT)

1. **`market_data/vnbroker_adapter.py` là SSOT duy nhất** cho mọi truy cập dữ liệu thị trường từ vnbroker — bao gồm giá realtime, lịch sử OHLCV, intraday tape, và snapshot bảng giá.
2. **Tuyệt đối cấm import trực tiếp** `vnbroker.explorer.vci.quote.Quote`, `Vnbroker()`, hoặc bất kỳ class/module nội bộ nào của thư viện `vnbroker` từ ngoài `vnbroker_adapter.py`. Mọi caller phải dùng hàm public của adapter.
3. **Các hàm SSOT trong `market_data/vnbroker_adapter.py`** hiện tại bao gồm:
   - `fetch_realtime_price(symbol)` — giá live hôm nay (close/open/high/low/volume)
   - `fetch_daily_history(symbol, days)` — lịch sử OHLCV ngày
   - `fetch_price_board_snapshot(symbols)` — snapshot bảng giá cho nhiều symbol
   - `fetch_intraday_tape(symbol, page_size)` — tape giao dịch intraday
   - `fetch_listing_symbols()` — danh sách mã niêm yết
4. **`market_serving/vnbroker_materializer.py`** và mọi Celery task chạm dữ liệu giá phải import từ `market_data.vnbroker_adapter`, không gọi vnbroker API trực tiếp.
5. **Mock/random data** trong adapter bị cấm tuyệt đối trong production path — chỉ được dùng trong test fixtures với decorator `@patch`.
6. **Fallback logic** (DailyPrice DB khi vnbroker fail) phải nằm trong adapter, không nằm ở caller.
7. **Mọi PR thêm hàm fetch mới từ vnbroker** phải đặt vào `vnbroker_adapter.py` và có ít nhất một unit test với mock.
8. Mọi exception khỏi hard rule phải có ticket, owner, expiry; quá hạn thì block merge.

## 12. Hard constraints for Global Market Data Matrix SSOT

1. **`global symbol matrix` / `global symbol registry` là SSOT duy nhất** cho toàn bộ dữ liệu thị trường dùng chung của hệ thống; tuyệt đối không tạo matrix riêng theo user.
2. **Global matrix phải là hợp nhất persistent của mọi demand source hợp lệ**: mặc định hệ thống, nhóm global do quản trị viên quyết định, holdings, watchlists, tracked symbols, alerts, và các nguồn global đã được phê duyệt.
3. **User không sở hữu bản sao dữ liệu thị trường riêng**; user chỉ sở hữu membership hoặc metadata riêng, còn mọi giá/history/intraday/facts/snapshots phải đọc từ shared global data layer.
4. **Watchlist/tracked/holding/alert events chỉ được promote demand vào global matrix**; tuyệt đối cấm tạo silo crawl riêng theo từng user hoặc theo từng workspace cá nhân.
5. **`ScrapeMatrix` và mọi run-state chỉ là execution tracking**, không được dùng làm persistent universe SSOT thay cho global registry.
6. **Mọi product read path phải ưu tiên global facts/snapshots/history/materialized data**; cấm per-user recrawl nếu đã tồn tại shared facts-first path hợp lệ.
7. **Planner cào dữ liệu bắt buộc coverage-gap và freshness-gap driven trên global registry**; cấm chạy ad hoc theo yêu cầu user kiểu full-scan hoặc overwrite mù quáng.
8. **Một mã chỉ được hạ ưu tiên hoặc rời active crawl set khi toàn bộ demand sources hết hiệu lực và qua decay window vận hành**, không được drop ngay vì một user bỏ theo dõi.
9. **Thứ tự ưu tiên khi có trade-off**: giữ đúng shared SSOT trước, tránh crawl lặp sau, rồi mới tối ưu UX/SLA/chi phí.
10. Mọi exception khỏi hard rule phải có ticket, owner, expiry; quá hạn thì block merge.

## 13. Hard constraints for Global Alert Center SaaS OpenAPI Cutover

1. `Global symbol matrix` là foundation SSOT duy nhất cho detection universe của alert-center.
2. Detection chạy toàn cục; delivery phải lọc theo holdings/watchlists/tracked/preferences của từng user.
3. Main alert feed chỉ chứa `whale`, `dark_flow`, `price_shock`, `stale_quote`, `system`; `AI Alerts / AI Suggests` là lane riêng mặc định.
4. Mọi API contract mới của alert-center phải nằm ở `/core/v1/` và có OpenAPI metadata đầy đủ.
5. `packages/web` chỉ được gọi alert-center qua `coreApiAdapter.js`; cấm direct fetch hoặc adapter song song.
6. Browser-side synthesis cho `price_shock`, `stale_quote` hoặc audience truth là cấm; client chỉ render server truth.
7. Không tạo compat route hoặc proxy route business logic mới cho alert-center.
8. Không được bypass shadow/parity/soak gates khi cutover hoặc legacy sunset; mọi yêu cầu lệch chuẩn phải bị block mặc định.
9. Không xóa legacy alert code trước khi shadow run, parity evidence và rollback path đã được xác nhận.

Với task liên quan `DNSE backfill`, `lịch sử tape DNSE`, `UserDNSECredential`, `system backfill`, `user self-serve backfill`, `backfill whale/dark flow`, `Fernet encrypt credential`, `backfill_intraday_tick_system`, `backfill_intraday_tick_user`, đọc gói:

1. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_HANDOFF_MASTER_20260519.md`
2. `docs/IMPLEMENTATION_PLAN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
3. `docs/TECH_SPEC_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
4. `docs/TASKBOARD_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
5. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_TRACEABILITY_MATRIX_20260519.md`
6. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md`
7. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_EXECUTION_EVIDENCE_TEMPLATE_20260519.md`
8. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_CONFIG_OWNERSHIP_MATRIX_20260519.md`
9. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_CODE_QUALITY_CONSTITUTION_20260519.md`
10. `docs/FRONTEND_DESIGN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
11. `docs/BACKEND_DESIGN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
12. `docs/RUN_CODE_REVIEW_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
13. `docs/RUN_INTEGRATION_TESTS_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
14. `docs/RUN_SPEC_AUDIT_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`

## 2. Read-first quality docs (DNSE Backfill additions)

Trước mọi thay đổi liên quan `DNSE backfill`, `UserDNSECredential`, `Fernet encrypt credential`, `backfill_intraday_tick_system`, `backfill_intraday_tick_user`, `user self-serve backfill`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_HANDOFF_MASTER_20260519.md`
3. `docs/TECH_SPEC_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
4. `docs/IMPLEMENTATION_PLAN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
5. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_TRACEABILITY_MATRIX_20260519.md`
6. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_CONFIG_OWNERSHIP_MATRIX_20260519.md`
7. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_CODE_QUALITY_CONSTITUTION_20260519.md`
8. `docs/DNSE_BACKFILL_WHALE_DARK_FLOW_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md`
9. `docs/RUN_CODE_REVIEW_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
10. `docs/RUN_INTEGRATION_TESTS_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`
11. `docs/RUN_SPEC_AUDIT_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`

## Hard constraints for DNSE Backfill (§14)

1. **`fetch_intraday_tape_history()` trong `market_data/vnbroker_adapter.py` là SSOT duy nhất** cho mọi truy cập tape lịch sử DNSE — tuyệt đối không import `DNSEQuote` từ ngoài adapter.
2. **Credentials tuyệt đối không được log, serialize vào response, hay truyền qua Celery args dưới dạng plain text** — Celery task chỉ nhận `user_id: int`.
3. **`UserDNSECredential` phải dùng Fernet encryption** từ `DNSE_CREDENTIAL_FERNET_KEY` env var — không plaintext, không SHA-256 alone.
4. **System backfill phải abort ngay** khi `get_system_provider_credentials()` trả về None — không fallback env var.
5. **Presence check `IntradayTick.filter(symbol, date).exists()`** là bắt buộc trước mọi `bulk_create` trong backfill tasks.
6. **`is_system_provider=True` chỉ admin (`is_staff`) mới được set** — enforce tại view layer, không tự set trong code.
7. **User backfill ghi vào shared `IntradayTick` table** — tuyệt đối không tạo per-user data silo.
8. **`days_back` user clamp max 180** tại view layer trước khi đưa vào task.
9. **Rate limit `UserBackfillThrottle`** phải được đăng ký trong `settings.py` và enforce tại endpoint — không bypass.
10. Mọi exception khỏi hard rule phải có ticket, owner, expiry; quá hạn thì block merge.

## Tool Usage Notes

### File Writing Strategy
- **For new files**: Use `write_file` tool (not `edit`) — `edit` requires both `old_string` and `new_string` parameters and cannot create new files
- **For existing files**: Use `edit` tool with both `old_string` and `new_string` parameters
- **For reading files**: Use `read_file` tool
- **For data files (CSV, JSON, XLSX, etc.)**: Use `read_data_file` tool