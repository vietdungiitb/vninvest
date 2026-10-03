# Taskboard — Global Market Data Matrix SSOT
**Ngày**: 2026-05-15  
**Status**: Active  
**Parent**: `docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`

---

## Trạng thái tổng quan

| Task | Tên | Status | Assignee | Note |
|------|-----|--------|----------|------|
| T01 | Governance hardening | ✅ DONE | Copilot | Doc/governance pack created |
| T02 | Global registry models | ✅ DONE | Copilot | Registry/demand/coverage models + migration landed |
| T03 | Demand-source promotion flows | ✅ DONE | Copilot | admin/system source promotion landed; `vn100` canonicalization validated with legacy `top100` alias cleanup |
| T04 | Coverage + freshness inventory | ✅ DONE | Copilot | coverage inventory service + summary/detail helpers landed with focused tests |
| T05 | Missing-only planner | ✅ DONE | Copilot | preview + execution contract landed with parent/child run-log audit trail and async/sync queue handoff |
| T06 | Ingest task refactor | ✅ DONE | Copilot | daily history, price-board, and intraday hydration paths now consume plan items with inserted/updated/skipped-existing metrics |
| T07 | Queue tiers + schedules | ✅ DONE | Copilot | queue-tier board, runtime-config endpoints, and scheduler/worker consumers landed; empty-registry self-heal + live warm-tier backlog are now verified on the refreshed dev stack |
| T08 | Read-path cutover | ✅ DONE | Copilot | intraday matched-trade/price endpoints + watchlist/advisory/whale/session-facts read paths are now locked to shared-layer/native reads; only the explicit seed bootstrap mutation still expands provider-backed symbol groups outside the primary read path |
| T09 | SOC Data Ops operator surface | ✅ DONE | Copilot | queue-tier board, runtime-config editor, coverage panel, manual-run builder, and run-history panel are all live in SOC with focused tests and runtime verification |
| T10 | Tests + audit evidence | ⬜ NOT STARTED | TBD | |
| T11 | Shadow validation | ⬜ NOT STARTED | TBD | |
| T12 | Final rollout docs | ⬜ NOT STARTED | TBD | |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ DONE | ❌ BLOCKED

---

## T01 — Governance hardening

**Status**: ✅ DONE

### Checklist
- [x] Hard rules được ghi vào `AGENTS.md`
- [x] Hard rules được ghi vào `docs/AI_CODING_REGULATION.md`
- [x] Handoff master được tạo
- [x] Implementation plan được tạo
- [x] Tech spec được tạo
- [x] Taskboard được tạo
- [x] Traceability matrix được tạo
- [x] Self audit/test protocol được tạo
- [x] Code quality constitution được tạo
- [x] Execution evidence template được tạo

---

## T02 — Global registry models

**Status**: ✅ DONE

### Checklist
- [x] `GlobalSymbolRegistry` model created
- [x] `GlobalSymbolDemandSource` model created
- [x] `GlobalSymbolCoverage` model created
- [x] migrations applied cleanly
- [x] unique/index constraints audited

---

## T03 — Demand-source promotion flows

**Status**: ✅ DONE

### Checklist
- [x] watchlist events promote into global registry
- [x] tracked symbol events promote into global registry
- [x] holdings events promote into global registry
- [x] alert events promote into global registry
- [x] admin/system sources promote into global registry

**Evidence note**
- `market_data.tests.test_global_symbol_registry`, `market_data.tests.test_stock_management_native_api`, `tests.test_global_symbol_registry_workspace_integration`, `service_ops.tests.test_soc_matrix`, và `service_ops.tests.test_soc_api_domain` đều pass trong focused regression suite (`46` tests, `1` skipped).
- `vn100` hiện là canonical group id; legacy edge `system_default:top100` được deactivate đúng cách khi sync canonical `vn100`.

---

## T04 — Coverage + freshness inventory

**Status**: ✅ DONE

### Checklist
- [x] dataset coverage schema defined
- [x] freshness states defined
- [x] stale/missing calculation implemented
- [x] summary endpoints or service helpers available

**Evidence note**
- `packages/core/backend/src/market_data/global_symbol_coverage.py` cung cấp coverage inventory service cho `daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts` và đồng bộ summary về `GlobalSymbolRegistry`.
- `market_data.tests.test_global_symbol_coverage`, `market_data.tests.test_global_symbol_registry`, và `market_data.tests.test_stock_management_native_api` đều pass trong focused validation suite (`18` tests).
- Follow-up production writeback: `packages/core/backend/src/data_ingest/tasks.py` giờ gọi `refresh_global_symbol_coverage()` ngay sau `ingest_daily_prices`, `fetch_and_upsert_price_board`, và `warm_intraday_universe`; `data_ingest.tests.test_tasks` pass (`7` tests) để khóa coverage materialization path thật thay vì chỉ test helper đơn lẻ.
- Live compose-backed smoke cho planner sync một symbol (`A32`) hiện đã tạo `5` rows trong `GlobalSymbolCoverage` (`daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts`), xác nhận coverage writeback không còn là test-only behavior.

---

## T05 — Missing-only planner

**Status**: ✅ DONE

### Checklist
- [x] planner preview contract defined
- [x] planner execution contract defined
- [x] default policy = missing-only
- [x] force-refresh requires explicit override

**Evidence note**
- `packages/core/backend/src/market_data/global_symbol_coverage.py` hiện đã có `build_global_planner_preview()` để sinh explicit plan items từ `GlobalSymbolCoverage`, bao gồm `provider_chain`, `requested_window`, `reason`, `overwrite_existing`, `coverage_before`, `skipped`, và `summary`.
- `packages/core/backend/src/market_data/global_symbol_planner.py` và `data_ingest.tasks.run_global_market_data_planner` hiện nối planner preview sang audited run payload, tạo parent run log trên `matrix_cycle_coordinator`, fan-out child run log `vnbroker_history`, `vnbroker_price_board`, và `vnbroker_intraday_tape`, rồi trả summary chuẩn `planned_items/inserted/updated/skipped_existing/failed/repaired_conflicts`.
- `market_data.tests.test_global_symbol_coverage`, `market_data.tests.test_global_symbol_planner`, và `data_ingest.tests.test_tasks` đều pass trong focused validation suite hiện tại (`16` tests), khóa missing-only preview semantics và sync/async planner execution handoff cho `daily_prices`, `price_board_snapshot`, `intraday_ticks`, và `intraday_bars`.

---

## T06 — Ingest task refactor

**Status**: ✅ DONE

### Checklist
- [x] daily history path consumes plan items
- [x] price-board path consumes plan items
- [x] intraday hydration path consumes plan items
- [x] output metrics include skipped-existing semantics

**Evidence note**
- `packages/core/backend/src/data_ingest/tasks.py` hiện cho phép cả `ingest_daily_prices()/backfill_daily_prices()` lẫn `fetch_and_upsert_price_board()` nhận explicit `plan_items`, giới hạn execution theo subset symbols thay vì quét toàn bộ universe.
- `packages/core/backend/src/market_serving/vnbroker_materializer.py` giờ materialize snapshot theo `symbols` explicit và phân biệt được `inserted`, `updated`, `skipped_existing`, `failed_count` thay vì blind overwrite mọi snapshot row.
- `packages/core/backend/src/data_ingest/tasks.py` hiện cũng cho phép `warm_intraday_universe()` nhận explicit `plan_items`, hydrate canonical `IntradayTick` và aggregate `IntradayBar` cho subset symbols, rồi ghi lại `tick_counts`/`bar_counts` vào `ServiceRunLog`.
- `packages/core/backend/src/data_ingest/tests/test_tasks.py` và `packages/core/backend/src/market_data/tests/test_global_symbol_planner.py` có thêm regression chứng minh daily-history, price-board, và intraday plan items không overwrite mù dữ liệu đang đúng, đồng thời giữ đúng run-log summary cho subset execution.

---

## T07 — Queue tiers + schedules

**Status**: ✅ DONE

### Checklist
- [x] queue tier policy defined
- [x] schedule policy defined
- [x] symbol priority score mapping defined
- [x] decay window semantics defined
- [x] scheduler/worker consumers use runtime policy

**Evidence note**
- `packages/core/backend/src/service_ops/domain_configs/market_data.py` định nghĩa typed runtime config cho `hot_user_demand`, `warm_liquid_market`, `cold_full_market`, `recovery_backlog`, kèm `decay_days`, validation cadence/batch-size, và support partial override từ `ServiceConfig` hiện hành.
- `packages/core/backend/src/service_ops/views/dataops.py` thêm `GET /api/soc/dataops/queue-tiers/` để quan sát phân bổ symbol theo queue tier + cadence hiện hành, đồng thời thêm `POST /api/soc/dataops/runtime-config/` để apply config mới theo flow audit/ownership chuẩn.
- `packages/core/backend/src/service_ops/ownership.py` mở rộng ownership matrix với domain `dataops_market_data`, giữ write path của market-data SSOT nằm trong SOC/service_ops thay vì phát sinh parallel writer.
- `packages/core/backend/src/service_ops/dataops_market_data.py`, `service_ops.tasks.run_market_data_queue_tier_scheduler`, `vninvest_core.queue_policy`, và `vninvest_core.settings.CELERY_BEAT_SCHEDULE` hiện đã nối queue-tier runtime config sang scheduler consumer thực tế: task chạy mỗi `30s`, chống dispatch trùng qua `ServiceRunLog`, chọn symbol theo tier, và phát planner runs sang `realtime_prefetch`, `enrichment_offhours`, hoặc `manual_on_demand` theo policy.
- `service_ops.tests.test_soc_domain_configs`, `service_ops.tests.test_soc_ownership`, `service_ops.tests.test_soc_api_domain`, `service_ops.tests.test_soc_tasks`, và `market_data.tests.test_global_symbol_planner` đều pass trong focused validation suite cuối cùng (`55` tests), khóa default/override config, ownership payload, queue-tier distribution, runtime-config apply audit trail, scheduler consumer, và planner queue/context handoff.
- Follow-up runtime recovery: `packages/core/backend/src/service_ops/dataops_market_data.py` giờ còn ưu tiên plannable coverage gaps trong từng tier và tự bootstrap `system_default:vn30/vn100` khi active registry rỗng; `service_ops.tests.test_soc_tasks` pass (`18` tests) để khóa cả gap-priority lẫn empty-universe self-heal.
- Follow-up baseline expansion: helper scheduler hiện còn chọn provider listing lớn nhất đang sống (`KBS` hiện trả `1535` mã, vượt xa `VCI` fallback `60`) để sync `system_default:listed_market`, và làm việc này cả khi registry đang ở trạng thái partial chứ không đợi rơi về zero.
- `service_ops.tests.test_soc_tasks` hiện pass (`19` tests), khóa thêm invariant partial-registry phải được backfill baseline listing, không giữ mãi `vn30/vn100` như một baseline cố định.
- `start_dev.ps1` hiện build lại core/frontend thành công; live core-api inspection cuối cùng xác nhận `GlobalSymbolRegistry` đang có `1536` active symbols, tất cả nằm ở `warm` tier, và `system_default:listed_market` đang có `1535` active demand edges.
- Warm-tier planner cũ bị orphan sau restart đã được operator recovery: mark `matrix_cycle_coordinator#1` và `vnbroker_history#2` sang `failed`, rồi rerun scheduler để tạo warm-tier run mới `matrix_cycle_coordinator#4` với `planned_items=200` (`100` symbols đầu tiên x `daily_prices` + `price_board_snapshot`) trên baseline listing mở rộng.
- Follow-up orphan guard: `packages/core/backend/src/service_ops/tasks.py` hiện thêm stale-timeout fallback, Celery liveness probe, grace window `60s`, và guard bảo vệ active child runs; `service_ops.tests.test_soc_tasks` pass (`22` tests) để khóa recent inflight skip, immediate orphan recovery, stale fallback, và child-aware protection.
- Runtime admin provisioning cho dev validation đã sẵn sàng: superuser `admin` trong compose-backed DB đã được tạo với email `admin@local.test` để test chế độ quản trị.
- Live runtime sau guard cuối cùng cho thấy `DailyPrice` đã materialize một phần (`157` rows / `65` active symbols) nhưng `GlobalSymbolCoverage` vẫn đang `0`; proof hydrate hoàn chỉnh vẫn còn mở.
- Live scheduler probe trên deploy cuối giữ `warm_liquid_market` ở `inflight` thay vì tiếp tục fail-loop parent run khi child `vnbroker_history` đã tồn tại; current parent `matrix_cycle_coordinator#18` và child `vnbroker_history#19` vẫn đang `running`, còn các failed warm parents `#12/#14/#16` là artifact từ runtime trước khi child-aware guard được deploy.
- Follow-up admin/auth fix: compose-backed `admin` hiện đã có `CoreTenant(plan=internal,status=active)`, active `CoreServiceAccount`, và `UserProfile.tenant`; in-process `login_view` probe trả `200`, nên blocker `No tenant associated with this account.` đã được đóng.
- Follow-up stale child cleanup: `packages/core/backend/src/service_ops/tasks.py` hiện cleanup luôn inline child runs khi stale parent queue-tier bị recover; `service_ops.tests.test_soc_tasks` pass (`23` tests) để khóa nhánh này mà không phá invariant “recent child vẫn giữ inflight”.
- Runtime backlog cũ đã được dọn: orphan child history runs `#5/#7/#9/#11/#13/#15/#17/#19` đã được mark `failed`, snapshot cuối cùng cho thấy `remaining_orphans=[]`, còn current live pair `matrix_cycle_coordinator#25` / `vnbroker_history#26` phản ánh execution mới chứ không phải orphan residue.
- Follow-up warm-batch hardening: `packages/core/backend/src/service_ops/domain_configs/market_data.py` giảm default `warm_liquid_market.max_batch_size` từ `100` xuống `50`; `service_ops.tests.test_soc_domain_configs` pass (`8` tests) để khóa invariant này ở runtime-config schema layer.
- Follow-up ingest lifecycle truth: `packages/core/backend/src/data_ingest/tasks.py` giờ stamp `ingest_run_id` lên child `ServiceRunLog.output_summary` ngay khi ingest bắt đầu; `data_ingest.tests.test_tasks` pass (`7` tests) và assert link này đã xuất hiện trong lúc backfill còn đang chạy.
- Follow-up linked cleanup: `packages/core/backend/src/service_ops/tasks.py` hiện fail luôn `IngestRun` linked khi stale child bị recover và ghi `recovered_ingest_run_id` lên child summary; `service_ops.tests.test_soc_tasks` giữ `23` tests xanh sau khi mở rộng nhánh này.
- Runtime restart reconciliation sau deploy cuối đã mark stale `matrix_cycle_coordinator#25`, `vnbroker_history#26`, và stale `IngestRun #1-#9/#11` sang `failed`, rồi manual scheduler kick tạo warm-tier run `matrix_cycle_coordinator#27` với đúng `50` symbols (`100` plan items) thay vì `100` symbols như trước.
- Follow-up worker-stability fix: `docker-compose.dev.yml` hiện chạy `core-worker-realtime-prefetch` ở `CELERY_POOL=solo` + `CELERY_CONCURRENCY=1` trên dev; sau `start_dev.ps1`, container inspection xác nhận worker mới lên với `RestartCount=0` thay vì restart-loop như batch trước.
- Runtime cleanup sau khi phát hiện worker restart đã mark `matrix_cycle_coordinator#27`, `vnbroker_history#28`, và `IngestRun#12` sang `failed`, rồi rerun scheduler để tạo warm-tier batch mới `matrix_cycle_coordinator#29` trên worker ổn định.
- Current live snapshot sau subslice mới nhất: `matrix_cycle_coordinator#29` đã `success` với `planned_items=100`, child `vnbroker_history#30` `success` với `ingest_run_id=13` + `coverage_refreshed_symbols=50`, child `vnbroker_price_board#31` `success` với `coverage_refreshed_symbols=50`, runtime có `GlobalSymbolCoverage=250` rows (`50` mỗi dataset), `dailyprice_active_symbol_count=86`, và `snapshot_active_symbol_count=49`.
- Residual observability gap còn lại của T07: child price-board hiện vẫn ra `output_summary.ingest_run_id=null` khi planner path không truyền `job_id`, nên lifecycle linkage hiện đã tốt ở daily ingest nhưng chưa đối xứng hoàn toàn ở snapshot path.
- Follow-up price-board lifecycle symmetry: `packages/core/backend/src/market_data/global_symbol_planner.py` hiện reuse `core-price-board-prefetch` job và pass `job_id` vào `fetch_and_upsert_price_board`; `market_data.tests.test_global_symbol_planner` pass (`5` tests) để khóa planner-level propagation, còn `data_ingest.tests.test_tasks` pass (`7` tests) để khóa task-level `IngestRun` creation/linkage.
- Live planner smoke sau `start_dev.ps1` cho batch `md-run-45` trả về `success`; child `vnbroker_history#46` có `output_summary.ingest_run_id=19`, `job_name=daily-price-ingest`, `job_source=vnbroker_price_board`, còn child `vnbroker_price_board#47` có `output_summary.ingest_run_id=20`, `job_name=core-price-board-prefetch`, `job_source=vnbroker_price_board`, và cả hai `IngestRun` đều `success`.
- Recovery follow-up: sau khi `core-worker` vẫn còn prefork và `WorkerLostError/SIGKILL` tiếp diễn sau refresh, worker này đã được hạ xuống `solo/1`; stale helper đã fail sạch `matrix_cycle_coordinator#75`, `vnbroker_price_board#77`, và `IngestRun #41`; sau `start_dev.ps1`, `core-worker` lên với `restart=0` / `oom=false`, và scheduler đã tiếp tục đến `md-run-90` thành công với child `vnbroker_history#91` (`ingest_run_id=50`) và `vnbroker_price_board#92` (`ingest_run_id=51`). Final stable snapshot hiện là `active_registry_count=1536`, `dailyprice_active_symbol_count=204`, `dailyprice_total_rows=1794`, `snapshot_active_symbol_count=163`, `snapshot_total_rows=163`, `coverage_total_rows=1065`.
- Residual risk còn lại chỉ là tính nhất quán của các snapshot callers ad-hoc trong tương lai: nếu mở thêm đường chạy mới, chúng nên reuse cùng `core-price-board-prefetch` job contract để giữ lifecycle truth đối xứng với planner/admin warm path. Ngoài ra, dù `core-worker` đã được harden, mọi forced refresh giữa batch vẫn có thể để lại orphan rows và cần stale-run recovery.

---

## T08 — Read-path cutover

**Status**: ✅ DONE

### Checklist
- [x] stock detail + legacy dashboard intraday matched-trade path reads from shared `IntradayTick` layer
- [x] core intraday price/tape APIs read shared `IntradayBar`/`IntradayTick` layers
- [x] watchlist manual sync routes through the global planner instead of provider fetch
- [x] watchlist reads from shared global data
- [x] AI advisory / alerts read from shared global data
- [x] no per-user provider crawl remains in primary path

**Evidence note**
- `packages/core/backend/src/market_serving/native_views.py` giờ phục vụ `/api/realtime/intraday/<symbol>/` từ latest-session `IntradayTick` rows thay vì gọi `vnbroker` trong request path; cùng pattern cutover được áp dụng cho `/core/v1/market-data/intraday-tape/<symbol>/` ở `packages/core/backend/src/market_data/views.py`.
- `packages/core/backend/src/market_serving/tests/test_native_views.py` và `packages/core/backend/src/market_data/tests/test_intraday_tape_api.py` đều pass trong focused validation suite (`4` tests) và khóa invariant không còn `market_data.vnbroker_adapter.fetch_intraday_tape()` trong request path.
- `packages/core/backend/src/market_data/views.py` cũng đã cắt `/core/v1/market-data/intraday-prices/<symbol>/` sang canonical `IntradayBar` reads thay vì `fetch_intraday_ohlcv()`; `packages/core/backend/src/market_data/tests/test_intraday_prices_api.py` pass (`4` tests cùng `test_intraday_tape_api`) và khóa invariant không còn provider fetch trong core intraday price/tape APIs.
- `packages/core/backend/src/market_data/stock_mgmt_native_views.py` giờ route `POST /api/stock-management/sync/` sang `create_global_planner_run(... datasets=['price_board_snapshot'], mode='missing_only', execution_mode='async', planner_queue='manual_on_demand')` thay vì `fetch_price_board_snapshot()` trực tiếp; `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py` pass (`11` tests) và khóa invariant không còn provider fetch trong watchlist/manual sync path.
- Semantic audit của các consumer còn lại cho thấy `getRealtimeTickers -> RealtimeTickerListView -> SymbolSnapshot`, `getStockWorkspaceOverview/getStockPriceChart -> StockManagementOverviewView/StockManagementChartView -> DailyPrice/IntradayBar`, `getWhaleFeed -> RealtimeWhaleFeedView -> UnifiedAlert`, và `getSessionFacts -> SessionFactsDetailView/SessionFactsCvdView -> SessionFacts/SessionFactsBucket` đều đọc shared canonical tables hoặc cache read-through thay vì recrawl provider trong request path.
- `packages/core/backend/src/market_data/stock_mgmt_native_views.py` cũng delegate `StockManagementAIAdvisorySessionView -> AdvisoryLatestView -> AdvisoryRecord` và `StockManagementAIAdvisoryComponentsGenerateView` / `StockManagementAIAdvisorySummaryRegenerateView` -> `AdvisoryRefreshView`, nên advisory compat surface đọc native advisory rows hoặc tạo pending native advisory triggers thay vì recrawl provider; regression mới trong `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py` pass (`13` tests) và assert các helper `fetch_realtime_price()`, `fetch_daily_history()`, `fetch_price_board_snapshot()`, `fetch_intraday_tape()` không bị gọi trên advisory request path.
- Semantic audit cuối cùng trên product-facing `*views.py` chỉ còn `fetch_symbol_group_members()` trong `StockManagementSeedView`, đây là bootstrap mutation cho hành động seed explicit từ operator/user chứ không phải primary read path; vì vậy invariant “không còn per-user provider crawl trong primary path” được coi là đã khóa cho `T08`.
- `frontend/src/i18n/vi.js` và `frontend/src/i18n/en.js` đã đổi watchlist sync success copy sang semantics hàng đợi planner thay vì nói như đã sync trực tiếp từ provider.
- `start_dev.ps1` hiện đã bỏ qua shell placeholder token, build core runtime thành công lại qua private `vnbroker`, và probe `/api/soc/matrix/providers/`, `/api/soc/dataops/queue-tiers/`, `/api/soc/dataops/runtime-config/` đều trả `401`; điều này xác nhận runtime dev hiện đã phục vụ image mới thay vì core image stale.

---

## T09 — SOC Data Ops operator surface

**Status**: ✅ DONE

### Checklist
- [x] runtime config panel
- [x] coverage panel
- [x] queue tier panel
- [x] manual run builder
- [x] run history/audit view

**Evidence note**
- `packages/core/backend/src/service_ops/views/dataops.py` giờ có thêm `GET /api/soc/dataops/runtime-config/`, trả current config + ownership payload để UI operator surface có state bootstrap chuẩn thay vì phải suy luận từ queue snapshot.
- `packages/core/backend/src/service_ops/views/dataops.py` giờ cũng expose `GET /api/soc/dataops/coverage/` từ `build_global_coverage_summary()`, trả dataset freshness counts + top gaps để coverage panel dùng lại trực tiếp coverage SSOT thay vì tự aggregate ở UI; `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py` pass (`5` tests) và khóa contract mới này.
- `frontend/src/components/soc/DataOpsPanel.jsx`, `frontend/src/pages/SOCPage.jsx`, và `frontend/src/api/socApi.js` đã nối tab `DataOps` của SOC sang market-data contract thật: queue-tier board, runtime-config JSON editor, coverage board, manual planner builder, run-history table, ownership banner, và localized copy đầy đủ.
- `frontend/src/components/soc/DataOpsPanel.jsx`, `frontend/src/components/soc/SOCComponents.test.jsx`, `frontend/src/i18n/vi.js`, và `frontend/src/i18n/en.js` giờ render đủ coverage dataset cards + priority gaps list + manual planner preview/run + paginated run-history table ngay trong tab `DataOps`; focused frontend suites vẫn pass (`12` tests) sau khi hoàn tất T09 UI.
- `packages/core/backend/src/service_ops/views/dataops.py`, `packages/core/backend/src/service_ops/urls.py`, và `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py` giờ cũng expose `POST /api/soc/dataops/planner/preview/` + `POST /api/soc/dataops/planner/run/`; owner suite `DataOpsDomainApiTestCase` pass (`7` tests) và khóa missing-only preview semantics cùng audited `manual_on_demand` run creation.
- `frontend/src/api/socApi.js`, `frontend/src/components/soc/DataOpsPanel.jsx`, `frontend/src/components/soc/SOCComponents.test.jsx`, `frontend/src/i18n/vi.js`, và `frontend/src/i18n/en.js` hiện đã thêm manual run builder cho operator: nhập symbol scope, chọn executable datasets, preview plan items/skips, rồi gửi planner run có audit metadata ngay trong SOC thay vì phải gọi API thủ công.
- `packages/core/backend/src/service_ops/views/dataops.py`, `packages/core/backend/src/service_ops/urls.py`, và `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py` hiện cũng expose `GET /api/soc/dataops/run-logs/`, chuẩn hóa planner parent runs về `run_id/status/mode/reason/summary`; owner suite `DataOpsDomainApiTestCase` pass (`8` tests) và khóa invariant chỉ parent `matrix_cycle_coordinator` runs xuất hiện trong operator history.
- `start_dev.ps1`, `packages/core/backend/Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, và `docker-compose.prod.yml` đã được harden để bỏ qua shell placeholder token và dùng secret-mounted build credentials; rerun runtime mới nhất build lại cả core/frontend thành công, smoke checks `Core API health` + `Frontend health` đều `OK`, và direct probes cho `/core/v1/health`, `/api/soc/dataops/coverage/`, `/api/soc/dataops/queue-tiers/`, `/api/soc/dataops/runtime-config/`, `/api/soc/dataops/run-logs/`, `/api/soc/dataops/planner/preview/`, `/api/soc/dataops/planner/run/` lần lượt trả `200/401/401/401/401/401/401`, nên toàn bộ operator surface `T09` hiện đã live trong dev stack.

---

## T10 — Tests + audit evidence

**Status**: ⬜ NOT STARTED

### Checklist
- [ ] unit tests for registry/demand/coverage
- [ ] integration tests for promotion flows
- [ ] planner missing-only tests
- [ ] anti-duplicate crawl tests

---

## T11 — Shadow validation

**Status**: ⬜ NOT STARTED

### Checklist
- [ ] run old/new path in shadow
- [ ] compare universe counts
- [ ] compare freshness distributions
- [ ] compare queue volume and duplicate suppression

---

## T12 — Final rollout docs

**Status**: ⬜ NOT STARTED

### Checklist
- [ ] evidence template populated
- [ ] progress dashboard updated
- [ ] audit ledger updated
- [ ] residual risks documented
