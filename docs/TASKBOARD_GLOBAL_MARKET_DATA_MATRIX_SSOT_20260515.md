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
| T07 | Queue tiers + schedules | ✅ DONE | Copilot | queue-tier board, runtime-config endpoints, and scheduler/worker consumers landed; runtime verification on dev stack remains blocked by stale core image until PAT auth is fixed |
| T08 | Read-path cutover | ✅ DONE | Copilot | intraday matched-trade/price endpoints + watchlist/advisory/whale/session-facts read paths are now locked to shared-layer/native reads; only the explicit seed bootstrap mutation still expands provider-backed symbol groups outside the primary read path |
| T09 | SOC Data Ops operator surface | 🔄 IN PROGRESS | Copilot | queue-tier board + runtime-config editor are live in SOC, while coverage/manual-run/history panels remain pending |
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
- `start_dev.ps1` vẫn khởi động stack healthy và `No queue drift detected`, nhưng probe runtime cho `/api/soc/matrix/providers/` trả `401` trong khi cả `/api/soc/dataops/queue-tiers/` lẫn `/api/soc/dataops/runtime-config/` đều trả `404`; điều này xác nhận core runtime hiện vẫn đang phục vụ image cũ vì build core image bị chặn bởi PAT private `vnbroker` chưa hợp lệ.

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

**Status**: 🔄 IN PROGRESS

### Checklist
- [x] runtime config panel
- [ ] coverage panel
- [x] queue tier panel
- [ ] manual run builder
- [ ] run history/audit view

**Evidence note**
- `packages/core/backend/src/service_ops/views/dataops.py` giờ có thêm `GET /api/soc/dataops/runtime-config/`, trả current config + ownership payload để UI operator surface có state bootstrap chuẩn thay vì phải suy luận từ queue snapshot.
- `frontend/src/components/soc/DataOpsPanel.jsx`, `frontend/src/pages/SOCPage.jsx`, và `frontend/src/api/socApi.js` đã nối tab `DataOps` của SOC sang market-data contract thật: queue-tier board, runtime-config JSON editor, preview/apply flow, ownership banner, và localized copy đầy đủ.
- `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py`, `frontend/src/pages/SOCPage.test.jsx`, và `frontend/src/components/soc/SOCComponents.test.jsx` đều pass trong focused validation (`4` backend tests, `12` frontend tests) cho runtime-config GET/POST contract và tab operator surface mới.
- `start_dev.ps1`, `packages/core/backend/Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, và `docker-compose.prod.yml` đã được harden để bỏ qua shell placeholder token và dùng secret-mounted build credentials; rerun runtime cho kết quả route probes `401` trên cả `matrix/providers`, `dataops/queue-tiers`, và `dataops/runtime-config`, nên T09 slice đầu tiên đã live trong dev stack.

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
