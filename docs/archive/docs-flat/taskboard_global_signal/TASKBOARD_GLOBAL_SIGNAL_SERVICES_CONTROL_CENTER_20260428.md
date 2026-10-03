# TASKBOARD - Global Signal Services Control Center

**Ngày**: 2026-04-28  
**Mục tiêu**: điều phối triển khai hai global services và admin control center theo slice có owner, required AI skill, test gate và evidence bắt buộc.

---

## A. Governance / Contract Freeze

- [x] `ARC-01` Khóa SSOT boundary giữa detection, persistence, distribution, advisory  
Owner: Tech Lead  
Required AI skill: GitHub Copilot theo repo governance  
Estimate: 2h  
DoD: Tech Spec và Handoff Master chốt rõ domain truth, không còn ambiguity.  
Test gate: PASSED - governance pack review across Handoff Master, Tech Spec, Implementation Plan và Traceability Matrix.  
Evidence: `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_HANDOFF_MASTER_20260428.md`, `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`, `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_TRACEABILITY_MATRIX_20260428.md`.

- [x] `ARC-02` Khóa `effective universe policy` và threshold policy toàn cục  
Owner: Tech Lead + Backend Lead  
Required AI skill: GitHub Copilot theo repo governance  
Estimate: 2h  
Dependency: ARC-01  
DoD: admin curated + tracked/watchlist hybrid policy được viết rõ, threshold theo user bị loại khỏi phase detect.  
Test gate: PASSED - `BE-1.1`, `BE-1.2`, `BE-1.3` and later regression bundles all use the same canonical policy helpers/resolver.  
Evidence: `docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`, `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`, `backend/portfolio/global_signal_policy_helpers.py`, `backend/portfolio/services_global_signal_universe.py`.

- [x] `ARC-03` Khóa admin IA, preview-before-apply và run safety semantics  
Owner: Frontend Lead + Product Owner  
Required AI skill: `Expert React Frontend Engineer`  
Estimate: 2h  
Dependency: ARC-01, ARC-02  
DoD: các zone, dangerous actions, preview data và permission model được chốt.  
Test gate: PASSED - control-plane APIs + `SignalControlCenter` UI landed with preview/confirm guards and legacy-whale demotion.  
Evidence: `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`, `frontend/src/components/adminops/SignalControlCenter.jsx`, `frontend/src/components/adminops/SignalControlCenter.test.jsx`.

---

## B. Backend Foundation

- [x] `BE-1.1` Tạo `GlobalSignalUniverseResolver`  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: ARC-02  
DoD: trả `effective universe snapshot` có source counts, generated_at, effective_symbols, sources; `tasks_prefetch.py` đã dùng lại service này và policy có thể đọc từ `SystemSetting(global_signal_universe_policy)`.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_signal_universe portfolio.tests.test_ticker_prefetch_task --keepdb`.  
Evidence: `backend/portfolio/services_global_signal_universe.py`, `backend/portfolio/tests/test_global_signal_universe.py`, runtime refresh log backend/celery, `module_tree_full.md` regen.  
Residual note: write-side preview/apply APIs cho admin universe policy vẫn thuộc `BE-1.2` và `BE-1.3`.

- [x] `BE-1.2` Chuẩn hóa config toàn cục trong `SystemSetting`  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 3h  
Dependency: BE-1.1  
DoD: có helper canonical dạng default/coerce/get/set cho `global_signal_services_config`, `global_signal_universe_policy`, `global_signal_retention_policy`; `SystemSetting.ensure_defaults()` seed đủ ba key và `GlobalSignalUniverseResolver` đọc universe policy qua helper chuẩn hóa thay vì parse JSON thô.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_signal_policy_helpers portfolio.tests.test_global_signal_universe portfolio.tests.test_ticker_prefetch_task --keepdb`.  
Evidence: `backend/portfolio/global_signal_policy_helpers.py`, `backend/portfolio/tests/test_global_signal_policy_helpers.py`, `backend/portfolio/system_settings.py`, `module_tree_full.md` regen.  
Residual note: preview/apply admin APIs cho các config này vẫn thuộc `BE-5.2`.

- [x] `BE-1.3` Invalidation policy cho universe/config cache  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 2h  
Dependency: BE-1.2  
DoD: `set_global_signal_universe_policy(...)` xóa đúng `realtime:universe:snapshot`, tier caches, shard caches và shard enqueue caches; các thay đổi ở `TrackedSymbol`, `WatchlistItem`, `PriceAlertRule`, `Transaction`, `SecuritiesItem` cũng trigger cùng invalidation flow qua Django signals.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_signal_policy_helpers portfolio.tests.test_global_signal_universe portfolio.tests.test_ticker_prefetch_task --keepdb`.  
Evidence: `backend/portfolio/global_signal_policy_helpers.py`, `backend/portfolio/signals.py`, `backend/portfolio/tests/test_global_signal_policy_helpers.py`, `module_tree_full.md` regen.  
Residual note: invalidation hiện khóa universe snapshot path; preview/apply admin API và invalidation cho read-model/cache của whale/dark-flow services tương lai vẫn sẽ mở rộng ở các slice backend sau.

---

## C. Global Dark Flow Service

- [x] `BE-2.1` Refactor dark-flow detector thành detect + persist + cache  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: BE-1.1  
Anchor files: `backend/portfolio/tasks_order_flow.py`  
DoD: detector lấy symbol từ `effective universe snapshot`, persist canonical `OrderFlowSignal`, seed latest-signal hot cache, rồi chỉ enqueue downstream `distribute_order_flow_signal` thay vì tự resolve audience/websocket/advisory trong loop detect; downstream flush advisory cũng bảo toàn `source='dark_flow'` khi merge state có `dark_flow_strength`.  
Test gate: PASSED - `manage.py test portfolio.tests.test_order_flow.TestOrderFlowSignalTask portfolio.tests.test_pr1_dark_flow_severity_semantics portfolio.tests.test_whale_advisory_task.WhaleAdvisoryTaskTests.test_flush_merged_event_passes_primary_and_sources portfolio.tests.test_celery_task_names --keepdb`.  
Evidence: `backend/portfolio/tasks_order_flow.py`, `backend/portfolio/tasks_whale_advisory.py`, `backend/portfolio/tasks_advisory_helpers.py`, `backend/portfolio/tests/test_order_flow.py`, `backend/portfolio/tests/test_pr1_dark_flow_severity_semantics.py`, `module_tree_full.md` regen.  
Residual note: `BE-2.2` vẫn còn phần union audience `TrackedSymbol` + `WatchlistItem`, user-history fan-out và unified distribution service; detector hiện mới enqueue boundary downstream và giữ semantics tracked-user hiện hữu.

- [x] `BE-2.2` Tạo dark-flow distribution downstream phase  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-2.1  
DoD: resolve audience sau persist, push websocket/user history đúng union tracked/watchlist qua shared distribution service.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_signal_distribution_service portfolio.tests.test_order_flow --keepdb`.  
Evidence: `backend/portfolio/services_global_signal_distribution.py`, `backend/portfolio/tasks_order_flow.py`, `backend/portfolio/tests/test_global_signal_distribution_service.py`, websocket + `UserAlertHistory` proofs.  
Residual note: operator-facing summary/control-plane cho dark-flow được hoàn thiện ở `BE-5.1` đến `BE-5.3`, không nằm trong chính slice distribution này.

- [x] `BE-2.3` Chuẩn hóa severity mapper dark-flow  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 3h  
Dependency: BE-2.1  
DoD: severity không dùng whale threshold ratio.  
Test gate: PASSED - `manage.py test portfolio.tests.test_order_flow.TestOrderFlowSignalTask portfolio.tests.test_pr1_dark_flow_severity_semantics --keepdb`.  
Evidence: `backend/portfolio/tasks_order_flow.py`, `backend/portfolio/tests/test_order_flow.py`, `backend/portfolio/tests/test_pr1_dark_flow_severity_semantics.py`.  
Residual note: phần admin-visible summary của dark-flow được deliver qua `BE-5.1`, không cần nhồi chung vào mapper slice này.

---

## D. Global Whale Alerts Service

- [x] `BE-3.1` Tạo model `WhaleAlertEvent` và migration  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: ARC-01, ARC-02  
DoD: canonical whale event-store có deterministic `event_id`, migration vật lý và helper persistence idempotent.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_whale_alerts_service --keepdb`.  
Evidence: `backend/portfolio/models.py`, `backend/portfolio/migrations/0062_whalealertevent.py`, `backend/portfolio/services_global_whale_alerts.py`, persisted event payload proof.  
Residual note: read-path consumer migration sang canonical store vẫn tiếp tục ở `BE-3.3`.

- [x] `BE-3.2` Xây global whale detector service  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 6h  
Dependency: BE-3.1  
DoD: detect theo effective universe, persist canonical events, hot-cache latest-by-symbol và không phụ thuộc user threshold.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_whale_alerts_service --keepdb`.  
Evidence: `backend/portfolio/services_global_whale_alerts.py`, `backend/portfolio/tasks_whale_service.py`, `backend/portfolio/tests/test_global_whale_alerts_service.py`, persisted event payload + cache proof.  
Residual note: downstream fan-out canonical event được khóa ở `BE-4.1`.

- [x] `BE-3.3` Read-model/cache cho whale global  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-3.2  
DoD: global consumers có cache/read-model không cần re-filter raw ticks trên read-path chính.  
Test gate: PASSED - `manage.py test portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_whale_feed_aggregate_prefers_canonical_whale_event_store_when_available portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements --keepdb`.  
Evidence: `backend/portfolio/market_data_service.py`, `backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py`, aggregate response proof `source='canonical_event_store'`.  
Residual note: aggregate/global main path đã canonicalized; single-symbol `get_whale_feed(...)` vẫn raw-source-based vì canonical payload hiện chưa đủ field để thay thế an toàn toàn bộ contract.

---

## E. Distribution / Retention / Jobs

- [x] `BE-4.1` Tạo `GlobalSignalDistributionService` dùng chung  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: BE-2.2, BE-3.2  
DoD: whale và dark-flow dùng cùng audience resolution policy, cùng websocket/user-history delivery contract.  
Test gate: PASSED - `manage.py test portfolio.tests.test_global_signal_distribution_service portfolio.tests.test_global_whale_alerts_service --keepdb`.  
Evidence: `backend/portfolio/services_global_signal_distribution.py`, `backend/portfolio/tasks_whale_service.py`, `backend/portfolio/tests/test_global_signal_distribution_service.py`, event fan-out matrix tracked + watchlist.  
Residual note: mute/backpressure policy riêng cho distribution vẫn cần follow-up nếu product muốn vượt ra ngoài registry/runtime foundation hiện tại.

- [x] `BE-4.2` Tạo run registry thống nhất cho signals  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-2.1, BE-3.2  
DoD: admin control center có thể xem manual/scheduled runs whale + dark flow ở cùng registry `SignalServiceRun`.  
Test gate: PASSED - `manage.py test portfolio.tests.test_signal_service_run_registry portfolio.tests.test_order_flow.TestOrderFlowSignalTask portfolio.tests.test_global_whale_alerts_service portfolio.tests.test_celery_task_names --keepdb`.  
Evidence: `backend/portfolio/models.py`, `backend/portfolio/migrations/0063_signalservicerun.py`, `backend/portfolio/services_signal_run_registry.py`, `backend/portfolio/tests/test_signal_service_run_registry.py`, job payload samples.  
Residual note: legacy `WhaleServiceJob` vẫn còn tồn tại cho backoffice/transition, nhưng control center mới đọc registry thống nhất này làm SSOT vận hành.

- [x] `BE-4.3` Retention preview và canonical safety gate  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-3.3  
DoD: purge raw tick chỉ được chạy sau preview rõ impacted rows và canonical safety.  
Test gate: PASSED - `manage.py test portfolio.tests.test_signal_admin_api portfolio.tests.test_global_signal_policy_helpers --keepdb`.  
Evidence: `backend/portfolio/views_signal_admin.py`, `frontend/src/components/adminops/SignalControlCenter.jsx`, retention preview payloads and dry-run-safe control plane.  
Residual note: destructive purge path chưa được expose cho operator; preview-safe gate hiện là barrier an toàn hiện hành.

---

## F. Admin Backend Control Plane

- [x] `BE-5.1` Summary API cho Signal Control Center  
Owner: Backend Lead  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: BE-4.2  
DoD: UI có summary health đủ whale/dark-flow/universe/cache/run state và celery health.  
Test gate: PASSED - `manage.py test portfolio.tests.test_signal_admin_api --keepdb`.  
Evidence: `backend/portfolio/views_signal_admin.py`, `backend/config/urls.py`, `backend/portfolio/tests/test_signal_admin_api.py`, summary payload snapshot.  
Residual note: stale-worker/degraded semantics hiện đang bám `_is_celery_worker_available()` cơ bản; nếu cần richer health grading sẽ là follow-up observability slice.

- [x] `BE-5.2` Config read/write + preview APIs  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 4h  
Dependency: ARC-03, BE-1.2  
DoD: write action luôn có preview path tương ứng cho services/universe/retention config.  
Test gate: PASSED - `manage.py test portfolio.tests.test_signal_admin_api --keepdb`.  
Evidence: `backend/portfolio/views_signal_admin.py`, `backend/portfolio/tests/test_signal_admin_api.py`, config diff payload + preview payload.  
Residual note: frontend confirmation/modal semantics cho operator được khóa tiếp ở `FE-6.2` đến `FE-6.4`.

- [x] `BE-5.3` Recent events / universe preview / retention preview APIs  
Owner: Backend Dev  
Required AI skill: GitHub Copilot (GPT-5.4)  
Estimate: 5h  
Dependency: BE-5.1, BE-5.2  
DoD: UI có đủ data để vận hành không cần mở raw Django admin table.  
Test gate: PASSED - `manage.py test portfolio.tests.test_signal_admin_api --keepdb`.  
Evidence: `backend/portfolio/views_signal_admin.py`, `backend/portfolio/tests/test_signal_admin_api.py`, endpoint payload snapshots cho universe preview/apply, jobs, recent events và retention preview.  
Residual note: purge execution path vẫn chưa được mở; phase hiện tại mới dừng ở preview-safe control plane.

---

## G. Admin Frontend Control Center

- [x] `FE-6.1` Tạo shell `SignalControlCenter` và route/tab chính thức  
Owner: Frontend Lead  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 4h  
Dependency: ARC-03, BE-5.1  
DoD: có page shell và tab `signals` rõ ràng trong `AdminOps`.  
Test gate: PASSED - `Push-Location ./frontend; npm run build; Pop-Location`; PASSED - `Push-Location ./frontend; $env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/components/adminops/SignalControlCenter.test.jsx; Pop-Location`.  
Evidence: `frontend/src/pages/AdminOps.jsx`, `frontend/src/components/adminops/SignalControlCenter.jsx`, `frontend/src/components/adminops/SignalControlCenter.test.jsx`, route/tab smoke proof.  
Residual note: screenshot/video browser chưa được capture trong terminal session này; dev runtime sẽ được refresh để auditor mở trực tiếp.

- [x] `FE-6.2` Dựng `Overview` và `Universe` panels  
Owner: Frontend Dev  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 5h  
Dependency: FE-6.1, BE-5.1, BE-5.3  
DoD: summary cards, universe preview/apply flow và confirmation states đã hoạt động trong control center.  
Test gate: PASSED - `Push-Location ./frontend; npm run build; Pop-Location`; PASSED - `Push-Location ./frontend; $env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/components/adminops/SignalControlCenter.test.jsx; Pop-Location`.  
Evidence: `frontend/src/components/adminops/SignalControlCenter.jsx`, `frontend/src/api/client.js`, `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js`, preview/apply UI proof.  
Residual note: browser video/modal capture chưa thu trong terminal session; confirmation hiện dùng native confirm guard cho universe apply.

- [x] `FE-6.3` Dựng `Whale Service` và `Dark Flow Service` panels  
Owner: Frontend Lead  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 6h  
Dependency: FE-6.1, BE-5.2  
DoD: config, manual run, state badges, error states và recent event highlights đã có cho cả whale và dark flow trên cùng surface.  
Test gate: PASSED - `Push-Location ./frontend; npm run build; Pop-Location`; PASSED - `Push-Location ./frontend; $env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/components/adminops/SignalControlCenter.test.jsx; Pop-Location`.  
Evidence: `frontend/src/components/adminops/SignalControlCenter.jsx`, `frontend/src/components/adminops/SignalControlCenter.test.jsx`, `frontend/src/api/client.js`, service/operator UI proof.  
Residual note: panel được hợp nhất vào một control center thay vì tách component con theo domain; đây là quyết định IA để tránh phân mảnh route/panel.

- [x] `FE-6.4` Dựng `Distribution`, `Retention`, `Jobs and Audit` panels  
Owner: Frontend Dev  
Required AI skill: `Expert React Frontend Engineer` + `react19-source-patterns`  
Estimate: 6h  
Dependency: FE-6.3, BE-4.2, BE-4.3, BE-5.3  
DoD: operator xem được audience logic, retention preview, jobs registry và audit-oriented recent events trên cùng surface.  
Test gate: PASSED - `Push-Location ./frontend; npm run build; Pop-Location`; PASSED - `Push-Location ./frontend; $env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/components/adminops/SignalControlCenter.test.jsx; Pop-Location`.  
Evidence: `frontend/src/components/adminops/SignalControlCenter.jsx`, `frontend/src/components/adminops/SignalControlCenter.test.jsx`, jobs/recent-events/retention UI proof.  
Residual note: follow-up pagination đã hoàn tất ở `2026-04-29a`; jobs registry và recent canonical events hiện dùng shared `PaginationBar` với page size `5/10/15/20` và backend paged contract `page/page_size`.

- [x] `FE-6.5` Deprecate panel whale cũ và tránh phân mảnh UI mới  
Owner: Frontend Lead  
Required AI skill: `Expert React Frontend Engineer`  
Estimate: 3h  
Dependency: FE-6.4  
DoD: whale ops cũ không còn là surface điều hành chính; user flow thống nhất vào tab `Signals`, còn tab whale được gắn nhãn legacy và có CTA quay về control center mới.  
Test gate: PASSED - `Push-Location ./frontend; npm run build; Pop-Location`.  
Evidence: `frontend/src/pages/AdminOps.jsx`, `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js`, before/after navigation map.  
Residual note: panel legacy vẫn còn tồn tại cho forensic/backoffice transition; chưa bị xoá vật lý khỏi codebase ở phase này.

---

## H. QA / Evidence / Ops

- [x] `QA-7.1` Backend regression suites  
Owner: QA Lead  
Required AI skill: `quality-playbook`  
Estimate: 5h  
Dependency: BE-5.3  
DoD: universe, detect, dedupe, fan-out, retention preview tests pass.  
Test gate: PASSED - `Push-Location ./backend; & "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test portfolio.tests.test_global_signal_universe portfolio.tests.test_global_signal_policy_helpers portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_whale_feed_aggregate_prefers_canonical_whale_event_store_when_available portfolio.tests.test_global_signal_distribution_service portfolio.tests.test_global_whale_alerts_service portfolio.tests.test_signal_service_run_registry portfolio.tests.test_signal_admin_api --keepdb; Pop-Location`.  
Evidence: backend QA bundle log + `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_EXECUTION_EVIDENCE_20260428w.md`.

- [x] `QA-7.2` Frontend regression suites  
Owner: QA Engineer  
Required AI skill: `quality-playbook` + `Expert React Frontend Engineer`  
Estimate: 5h  
Dependency: FE-6.5  
DoD: shell, preview/apply, dangerous action guards, pagination, i18n tests pass.  
Test gate: PASSED - `Push-Location ./frontend; $env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/components/adminops/SignalControlCenter.test.jsx; Pop-Location`; PASSED - `Push-Location ./frontend; npm run build; Pop-Location`.  
Evidence: `frontend/src/components/adminops/SignalControlCenter.test.jsx`, build log, `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_EXECUTION_EVIDENCE_20260428w.md`.  
Residual note: pagination regression đã được bổ sung cho jobs registry và recent canonical events; không còn cap cứng 10 rows ở operator lists.

- [x] `QA-7.3` Integration matrix + evidence template cho từng slice  
Owner: QA Lead  
Required AI skill: `quality-playbook`  
Estimate: 4h  
Dependency: QA-7.1, QA-7.2  
DoD: mỗi slice có evidence pack riêng.  
Test gate: PASSED - evidence checklist completed for slice `2026-04-28w`.  
Evidence: `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_EXECUTION_EVIDENCE_20260428w.md`.

- [x] `OPS-7.4` Rebuild / restart stack và runtime smoke  
Owner: DevOps Lead  
Required AI skill: GitHub Copilot theo ops guardrails  
Estimate: 2h  
Dependency: QA-7.3  
DoD: stack sẵn cho final auditor.  
Test gate: PASSED - `docker compose -f .\docker-compose.dev.yml up -d --build frontend backend celery_worker celery_beat`; PASSED - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health/`.  
Evidence: runtime rebuild log, backend health smoke payload, browser route smoke to `/admin-ops` redirecting to `/login` without auth.

- [x] `DOC-7.5` Walkthrough / closure docs và sync governance  
Owner: Slice Owner  
Required AI skill: `quality-playbook`  
Estimate: 2h  
Dependency: OPS-7.4  
DoD: walkthrough, closure, ledger, progress hoàn tất.  
Test gate: PASSED - docs audit review across taskboard, ledger, progress dashboard, and filled evidence file.  
Evidence: `docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_EXECUTION_EVIDENCE_20260428w.md`.