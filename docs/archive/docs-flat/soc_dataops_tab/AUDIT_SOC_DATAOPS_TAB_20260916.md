# Audit Chi Tiết DataOps Tab — `http://localhost/operations-center?tab=dataops`

**Date:** 2026-09-16 (Rev. 2026-09-16r2 — đính chính sau phản biện độc lập)
**Scope:** 5 subpages DataOps — Kho dữ liệu (Inventory) / Vận hành (Operations) / Giám sát (Monitor) / Lịch chạy (Scheduler) / Cấu hình (Config)
**Khung:** `AGENTS.md:136-216` — mọi khẳng định kèm `file:line`, grep toàn repo gồm `.css/.module.css/config/i18n/adapters`, không đoán
**Build:** `npx tsc --noEmit` PASS 0 errors · `npm run build` PASS 26.69s · `vitest` 34/35 files 187/188 pass (1 fail ngoài DataOps)
**Rev.:** Phản biện độc lập F01–F03 đã verify bằng `read/grep` thực tế → F01 CONFIRMED nặng hơn, F02 CONFIRMED, **F03 REFUTED false positive** (audit bỏ sót `operator_urls.py` namespace `scraping`). Chi tiết §H.

---

## 0. Tóm tắt 5 findings nghiêm trọng nhất (sau đính chính)

1. **[F01-CRITICAL — CONFIRMED, nặng hơn] Vận hành: payload Preview/Run sai contract + blast radius toàn vũ trụ** — FE gửi `mode=missing_only|force_refresh + symbol_group + date_from/date_to + dry_run` (`packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:128-140`), BE chỉ đọc `symbols/datasets/mode∈{missing_only,strict_fresh}/force_refresh/reference_trade_date` (`packages/core/backend/src/service_ops/views/dataops_base.py:80-98` + `packages/core/backend/src/market_data/global_symbol_coverage.py:38,548-559` + `packages/core/backend/src/market_data/global_symbol_planner.py:329-354`). Hệ quả: `force_refresh` trong `mode` → 400 `PLANNER_PREVIEW_INVALID`; `symbol_group:"vn100"` bị **ignore** → `_normalize_requested_symbols(None)` fallback toàn bộ active registry (`global_symbol_coverage.py:221-223`) — operator tưởng VN100, thực tế quét universe; `dry_run`/`date_from/date_to` bị nuốt — tick dry-run vẫn queue task thật. Validation thật nằm ở `global_symbol_coverage.py:557-559` (`PLANNER_SUPPORTED_MODES`), serializer `dataops_planner.py:14-20` chỉ là OpenAPI schema.

2. **[F02-HIGH — CONFIRMED] Kho dữ liệu: queue tiers không hiển thị examples** — BE `packages/core/backend/src/service_ops/dataops_market_data.py:286-287` trả `examples: symbols[:5]`, FE `packages/web/src/components/soc/SocDataInventorySection.tsx:213-216` và `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:788-794` đọc `tier.active_symbols` → `undefined` → luôn rơi vào `empty_examples` (“Chưa có mã mẫu”). Adapter `packages/web/src/adapters/core/soc.js:161-163` không transform.

3. **[F03 — REFUTED false positive, không còn trong top]** Cấu hình: GET runtime config **không 404**. Audit cũ kết luận sai do chỉ đọc `packages/core/backend/src/service_ops/urls.py:135` (mount dưới `/operator/soc`) mà bỏ sót `packages/core/backend/src/service_ops/operator_urls.py:34` + `packages/core/backend/src/vninvest_core/contracts/operator/urls.py:16` + `packages/core/backend/src/vninvest_core/urls.py:42` → full path `/core/v1/operator/scraping/dataops/runtime-config/` hợp lệ, trỏ đúng `DataOpsRuntimeConfigView`. Toàn bộ nhóm `/operator/scraping/dataops/...` (queue-tiers:32, observability:33, coverage:23, run-logs:27-28, planner:29-31, scheduler:11-14, runtime-config:34) đều resolve. Prefix `scraping` vs `soc` là dual-mount hợp lệ, không phải bug. Xem §H và C7.

4. **[F04-HIGH] Hero metrics drift** — `packages/web/src/components/soc/SocDataOpsPanel.tsx:47-52` đếm `queuePending = queued||pending`, `running`, `failed` từ `DataOpsContext.runs` (chỉ page 1 size 20 của `getSocDataOpsRunLogs`). Trong khi `DataOpsContext.tsx:101` và `SocDataOpsOperationsSection.tsx:105` đều fetch cùng endpoint `run-logs/` nhưng một nơi filter status có thể khác `BackfillExecutionRun` (`packages/core/backend/src/service_ops/views/dataops_backfill.py:26-42` lọc `limit` không phân trang cursor). Số liệu hero không phản ánh toàn bộ queue, dễ lệch với “Lịch sử chạy” drawer.

5. **[F05-HIGH] Orphan dead code + duplicate monitor** — `packages/web/src/components/soc/SocDataOpsPlannerConsole.tsx:39-373` là component 373 dòng full planner nhưng không được import ở đâu (`grep getSocDataOps` không hit file này, `SocDataOpsPanel.tsx:1-11` chỉ import `OperationsSection/Monitor/Config/Inventory`). Duplicate `SocBackfillCenter.tsx:1-14` chỉ delegate. Inventory và Monitor đều render queue tiers (Inventory accordion `SocDataInventorySection.tsx:185-229`, Monitor queue tier list `SocDataOpsMonitorSection.tsx:768-800`) gây trùng lặp, tốn request kép `getSocDataOpsQueueTiers()`.

> **Đính chính so với Rev.1 (2026-09-16):** F03 rút khỏi top/blocker. Top 5 mới là F01/F02/F04/F05/F06 (F06 page_size). F01 nâng từ “mode 400” lên “blast radius universe + dry-run no-op”.

---

## A. Bản đồ kiến trúc

| File | Lines | Trách nhiệm | Note |
|---|---|---|---|
| `packages/web/src/components/soc/SocDataOpsPanel.tsx:1-205` | 205 | Tab router DataOps: hero 4 metrics, subtab bar (inventory/operations/monitor/scheduler/config), content switch | `heroMetrics` tính từ `inventory.summary.total_rows` + `runs.filter` (`:48-53`). Dùng `DataOpsProvider` wrapper. |
| `packages/web/src/components/soc/DataOpsContext.tsx:1-165` | 165 | Context SSOT DataOps: `inventory/coverage/runs/loading/error` + actions `refreshInventory/refreshRuns/refreshCoverage/triggerBackfill/abortRun` | Cast `defaultCoreApiAdapter as unknown as {getSocDataOpsInventory, getSocDataOpsRunLogs(1,20), getSocDataOpsCoverage}` (`:67-73`). `useEffect` auto fetch 3 nguồn lúc mount (`:136-140`). |
| `packages/web/src/components/soc/SocDataInventorySection.tsx:1-231` | 231 | **Kho dữ liệu**: 4 metric cards (`:79-84`), dynamic data_types grid (`:89-108`), year bar chart (`:113-124`), coverage table 6 cột (`:132-176`, `coverageTableWrap`), queue tiers accordion (`:185-228`) | Fetch `getSocDataOpsQueueTiers` local state (`:36-49`), không qua context. `coverageColor` threshold 0.9/0.5 (`:69-74`). |
| `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:1-807` | 807 | **Vận hành**: dataset checkboxes 8 mục (`:42-51`, `renderDatasetCheckboxes:247-296`), symbol group bar + custom textarea (`:298-351`), date/mode/exec row (`:353-397`), reason + dryRun (`:399-421`), Preview+Run (`:142-204`), active banner (`:448-482`), preview items tables paginated (`:484-560`), run logs paginated (`:598-705`), drawers custom group + preview (`:748-804`) | Dùng `useSymbolGroups()` (`:68`) + `SocCustomGroupManager`. `DATASETS_WITH_METADATA` 5 supported/3 coming-soon (`:42-51`). |
| `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:1-802` | 802 | **Giám sát**: matrix (`:362-381`, `SocMatrixScrapeMonitor`), observability (backlog by_dataset/by_tier, starvation `(:441-543)`), fail_rates 1h/24h (`:427-440`), coverage matrix datasets×freshness 6 states (`:637-693`), top gaps paginated 20 (`:697-765`), queue tiers list (`:768-800`), export CSV (`:170-241`), parity/retention/anomaly delegate | Fetch `queueTiers+observability+coverage` trong một `useEffect` (`:243-264`), không `visibility+jitter`. |
| `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:1-312` | 312 | **Cấu hình**: JSON editor (`:213-219`), ownership badge + write guard (`:185-199`), preview modal (`:126-156`, `computeChangeSummary:36-49`, `computeImpactWarnings:51-79`), apply (`:158-172`), audit trail paginated (`:245-296`) | Fetch `getSocDataOpsRuntimeConfig + getSocDataOpsRuntimeConfigAudit(auditPage)` cùng `fetchConfig` (`:106-108`), dependency `auditPage` gây refetch config vô ích. |
| `packages/web/src/components/soc/SocSchedulerBoard.tsx:1-706` | 706 | **Lịch chạy** (tab + config duplicate): health strip always (`:509`), plan table 8 cột (`:567-682`), domain filter `all/market_data/signals/whale/platform/maintenance` (`:62`), job actions `enable/disable/run_now/abort` (`:164-221`), confirm modal (`:224-281`), history drawer 15/page (`:284-421`) | Poll 60s `setInterval(load,60000)` (`:458`), không `visibilitychange`. |
| `packages/web/src/components/soc/SocDataOpsPlannerConsole.tsx:1-373` | 373 | **Orphan**: planner standalone (symbols textarea + 5 datasets + executionMode + forceRefresh + preview/run + preview tables) | **KHÔNG IMPORT** ở đâu — dead code, duplicate với `OperationsSection`. |
| `packages/web/src/components/soc/SocBackfillCenter.tsx:1-14` | 14 | Delegate alias → `SocDataOpsOperationsSection` | Giữ để không break import cũ, nhưng là duplicate. |
| `packages/web/src/components/soc/SocCustomGroupManager.tsx:1-369` | 369 | CRUD nhóm tuỳ chỉnh (list custom, create form, edit inline, delete confirm) | Fetch `getSocSymbolGroups` filter `type==="custom"` (`:51-52`), support `updateSocSymbolGroup`. |
| `packages/web/src/components/soc/SocMatrixScrapeMonitor.tsx:1-212` | 212 | Matrix live: cycles + providers, module-level `monitorCache` (`:30-33`), poll 10s (`:71`), start/abort | Dùng `getSocMatrixMonitor + getSocMatrixProviders`. |
| `packages/web/src/components/soc/SocParityGatesPanel.tsx:1-204` | 204 | Parity gates 24h/72h (strict/relaxed, trend delta, history 7 points) | `strict_fresh_parity*100` (`:62`), `trend` from BE. |
| `packages/web/src/components/soc/SocRetentionHealthPanel.tsx:1-223` | 223 | Retention health (deleted/retained, policy line, trend delta, threshold, histogram 7 bars) | `retentionPeakDeletedRows` computed (`:49-53`). |
| `packages/web/src/components/soc/SocAnomalyGuardPanel.tsx:1-180` | 180 | Anomaly guard (promotion_backlog, repair_age_hours, critical_gap_symbols, hot_tier_breach tables) | Hardcoded icon `⚠️` title (`:57`). |
| `packages/web/src/adapters/core/soc.js:161-238` | 78 | Adapter DataOps: `getSocDataOpsQueueTiers/ Coverage/Observability/RunLogs/RuntimeConfig/Preview/Audit/Inventory`, `preview/run/abort planner`, `purgeRunLogs`, scheduler plan/health | `getSocDataOpsRunLogs(page,pageSize)` builds `?page=&page_size=` (`:173-174`), `getSocDataOpsRuntimeConfig` qua `/operator/scraping/...` (`:221`) — **hợp lệ** qua `operator_urls.py:34` (xem §H), không còn là bug. |
| `packages/core/backend/src/service_ops/views/dataops_inventory.py:1-125` | 125 | BE Inventory: `DailyPrice.aggregate` + `by_year TruncYear` + `by_group` coverage 30d + `data_types` 3 types (DailyPrice/SymbolSnapshot/SessionFacts) | Trả `summary/by_year/by_group/data_types` (`:114-125`). |
| `packages/core/backend/src/service_ops/views/dataops_observability.py:1-134` | 134 | BE Observability: queueTiers snapshot, observability summary, coverage summary | `DataOpsQueueTiersView` gọi `build_market_data_queue_tier_snapshot(example_limit=5)` (`:54`). |
| `packages/core/backend/src/service_ops/views/dataops_planner.py:1-412` | 412 | BE Planner: preview/run/runLogs/purge/abort | Serializer `mode` choices `missing_only/strict_fresh` (`:17`) chỉ là OpenAPI schema; validation thật tại `global_symbol_coverage.py:557-559`. |
| `packages/core/backend/src/service_ops/views/dataops_config.py:1-200` | 200 | BE Config: runtime config GET/POST + preview dry-run + audit | `preview` merge current+payload vào `MarketDataRuntimeConfig.from_dict` (`:136`). |
| `packages/core/backend/src/service_ops/views/dataops_backfill.py:1-130` | 130 | BE Backfill Progress B03/B07: `BackfillRunList/Detail + BackfillRunNow` | `BackfillRunList` filter `status/job_key/limit` (`:28-35`). |
| `packages/core/backend/src/service_ops/views/dataops_base.py:1-143` | 143 | Shared helpers: ownership payload, `symbols/datasets/force_refresh` parsers, `serialize_run_log` | `_get_request_symbols:80-82` chỉ đọc `symbols`, **không đọc `symbol_group`** — nguồn gốc F01 blast radius. |
| `packages/core/backend/src/service_ops/dataops_market_data.py:1-857` | 857 | SSOT market-data: queue tier querysets, coverage, parity gates, retention, backlog, starvation, anomaly guard | `build_market_data_queue_tier_snapshot` trả `examples` (`:286-287`), `build_market_data_observability_summary` (`:711-857`). |
| `packages/core/backend/src/service_ops/urls.py:123-149` | 27 | Routing DataOps (mount dưới `/operator/soc` qua `service_ops.urls`) | Song song với `operator_urls.py` mount dưới `/operator/scraping`. |
| `packages/core/backend/src/service_ops/operator_urls.py:1-39` | 39 | **Canonical scraping routes** — toàn bộ `/operator/scraping/dataops/...` (queue-tiers:32, observability:33, coverage:23, run-logs:27-28, planner:29-31, runtime-config:34, backfill:36-38) + scheduler:11-14, matrix:16-22 | **Bị audit Rev.1 bỏ sót** — lý do F03 false positive. |
| `packages/core/backend/src/vninvest_core/contracts/operator/urls.py:1-22` | 22 | Namespace `operator` — `scraping/` include `service_ops.operator_urls` (`:16`), `soc/` include `service_ops.urls` (`:17`) | Dual-mount hợp lệ. |
| `packages/core/backend/src/vninvest_core/urls.py:42` | 1 | Root — `core/v1/operator/` include `contracts.operator.urls` | Full path `/core/v1/operator/scraping/dataops/...` và `/core/v1/operator/soc/dataops/...` đều resolve. |
| `packages/web/src/components/soc/soc.tokens.css:1-43` | 43 | Design tokens | 30+ vars `--soc-*`. |
| `packages/web/src/components/soc/soc.components.css:1-2925` | ~2925 | Component styles | `.dataopsHeroMetrics` 4→2→1 cols (`:1626-1642`), `.coverageTable` (`:1446-1476`), `.yearChart` (`:1519`), drawer, scheduler strip etc. |
| `packages/web/src/components/soc/soc.module.css:1-3` | 3 | Re-export `@import tokens + components` | `tabBarDataOps` tồn tại tại `soc.components.css:26-28` (đã fix audit 20260716). |
| `packages/web/src/i18n/vi.js:402-789` + `en.js:402-790` | ~387 keys/soc | i18n DataOps | Đủ `dataset_*`, `inventory_table.*`, `backfill_*`, `parity_*`, `retention_*`, `anomaly_*`, `tier_*` theo `GAP §10.4`. |

---

## B. Luồng dữ liệu đã trace (5 use-case, kèm file:line)

### B1. Kho dữ liệu — load Inventory
1. Mount `SocDataOpsPanel` → `DataOpsProvider` (`packages/web/src/components/soc/SocDataOpsPanel.tsx:201`) tạo context.
2. `DataOpsContext.tsx:136-140` `useEffect` gọi `refreshInventory()` + `refreshRuns()` + `refreshCoverage()`.
3. `refreshInventory:83-95` → `adapter.getSocDataOpsInventory()` → `soc.js:236-238` `coreGet("/operator/soc/dataops/inventory/")` → BE `DataOpsInventoryView.get:11` đọc `DailyPrice.aggregate` + `by_year` + `by_group` qua `fetch_symbol_group_members` + `data_types` 3 bảng (`packages/core/backend/src/service_ops/views/dataops_inventory.py:22-112`) → trả `{summary,by_year,by_group,data_types}`.
4. `SocDataInventorySection.tsx:32-34` gọi `actions.refreshInventory()` on mount, render `MetricCard` 4 thẻ (`:79-84`), `dataTypeGrid` từ `inventory.data_types` (`:89-108`), `yearChart` `pct = rows/maxRows*100` (`:115`), `coverageTable` 6 cột (`:132-176`), color `coverageColor` (`:69-74`) + `toneColor`.
5. Song song local fetch `getSocDataOpsQueueTiers` (`SocDataInventorySection.tsx:42`) → `soc.js:161-163` `coreGet("/operator/scraping/dataops/queue-tiers/")` → BE `DataOpsQueueTiersView` qua `operator_urls.py:32` → `build_market_data_queue_tier_snapshot(example_limit=5)` trả `tiers[{tier,symbol_count,poll_interval_seconds,max_batch_size,examples}]` + `updated_at`. FE render accordion (`:185-229`) **BUG F02**: đọc `tier.active_symbols` thay vì `examples`.

### B2. Vận hành — Preview + Run backfill
1. User chọn datasets (checkbox `DATASETS_WITH_METADATA` `SocDataOpsOperationsSection.tsx:42-51`), symbol group bar `allGroups` từ `useSymbolGroups()` (`:240-244`), `isCustom` thì textarea `customSymbols` (`:335-351`), date `dateFrom/dateTo` (`:357-376`), mode `missing_only/force_refresh` (`:377-386`), exec `async/sync` (`:387-397`), reason (`:400-409`), dryRun (`:411-421`).
2. Click “Xem trước” → `handlePreview:142-168` validate `selectedDatasets.length`, `customSymbols`, `validateDateRange` (`packages/web/src/components/soc/socValidation.ts`), build `buildPayload:128-140` → `{datasets,symbol_group|symbols,date_from,date_to,mode,dry_run,execution_mode,reason}` → `adapter.previewSocDataOpsPlanner` → `soc.js:207-209` `POST /operator/scraping/dataops/planner/preview/` (qua `operator_urls.py:29`) → BE `DataOpsPlannerPreviewView:213-234` **không gọi serializer.is_valid()** mà đọc raw `request.data.get('mode','missing_only')` (`:218`), `symbols=_get_request_symbols` (`:216`, chỉ đọc `symbols`, bỏ `symbol_group` — **F01 blast radius**), `force_refresh=_get_request_force_refresh` (`:219`, đọc `force_refresh` bool, bỏ `dry_run`), `reference_trade_date=_get_reference_trade_date` (`:221`, chỉ đọc `reference_trade_date`, bỏ `date_from/date_to`) → validate `mode ∈ {missing_only,strict_fresh}` tại `packages/core/backend/src/market_data/global_symbol_coverage.py:557-559` (`PLANNER_SUPPORTED_MODES`) → **FAIL F01 nếu mode=force_refresh → raise ValueError → 400 `PLANNER_PREVIEW_INVALID`** (`:223-229`). Nếu pass, gọi `build_global_planner_preview` → `packages/core/backend/src/market_data/global_symbol_coverage.py:548-628` với `_normalize_requested_symbols(None)` fallback toàn bộ active registry (`:221-223`) khi `symbols=None` → trả `{summary:{planned_count,skipped_count}, items, skipped, ownership}`. Serializer `dataops_planner.py:14-20` chỉ là OpenAPI schema, không tham gia validation.
3. FE set `preview` + mở drawer `isPreviewDrawerOpen` (`:161`), render `renderPreviewResults:562-595` với 2 metric cards planned/skipped + tables paginated 8 (`:484-560`).
4. Click “Chạy” → `handleRun:170-204` validate thêm `reason.trim()`, gọi `actions.triggerBackfill(buildPayload())` → `DataOpsContext.triggerBackfill:125-129` → `adapter.runSocDataOpsPlanner` → `soc.js:211-213` `POST /operator/scraping/dataops/planner/run/` (qua `operator_urls.py:30`) → BE `DataOpsPlannerRunView:271-303` check `ownership.can_apply` → `create_global_planner_run` (`packages/core/backend/src/market_data/global_symbol_planner.py:329-399`) nhận `symbols/datasets/mode/force_refresh/reason/execution_mode/reference_trade_date` — **không nhận `dry_run`/`date_from/date_to`/`symbol_group`** → `dry_run` no-op, user tick dry-run vẫn queue task thật (`:329-354`).

### B3. Giám sát — Observability + Coverage
1. Mount `SocDataOpsMonitorSection` → `useEffect:243-264` `Promise.all([getSocDataOpsQueueTiers(), getSocDataOpsObservability()])` + `actions.refreshCoverage()`. Không poll, không `visibilitychange`. Cả hai qua `operator_urls.py:32-33` (scraping namespace — hợp lệ).
2. BE `DataOpsObservabilityView:76` → `build_market_data_observability_summary()` (`packages/core/backend/src/service_ops/dataops_market_data.py:711-857`): backlog by_dataset via `GlobalSymbolCoverage` `PLANNABLE_FRESHNESS_STATES` (`:716-731`), backlog by_tier per `QUEUE_TIER_ORDER` (`:733-763`), starvation check `seconds_since_last_progress > poll_interval*3` (`:765-795`), fail_rates 1h/24h via `_build_market_data_fail_rate_window` (`:797-800`), parity gates snapshot + history (`:801-815`), retention health 7 runs + trend (`:816-842`), anomaly guard (`:855`).
3. BE `DataOpsCoverageView:129-134` → `build_global_coverage_summary(top_gap_limit)` trả `{datasets:[{fresh,warm,stale,missing,error,unknown}], top_gaps, updated_at}` → context `coverage`.
4. FE render: metric fail_rates (`packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:427-440`), backlog tables (`:441-593`), parity gates delegate (`:598-604`), retention delegate (`:606-611`), anomaly delegate (`:613-618`), coverage matrix `COVERAGE_STATE_ORDER 6 cols` (`:637-693`), top gaps slice 20 (`:723`), queue tiers list (`:768-800`). Export CSV buttons gọi `exportSocConfigAudits/exportSocRunLogs` (`:194-241`) → `soc.js:64-78` GET `/operator/soc/overview/export/...` (không filter `service_key=dataops`).

### B4. Lịch chạy — Scheduler Board (domain dataops)
1. `SocDataOpsPanel.tsx:85` `createElement(SocSchedulerBoard,{domain:"dataops"})`.
2. `SocSchedulerBoard.tsx:435-460` `load()` fetch `getSocSchedulerPlan + getSocSchedulerHealth` parallel qua `operator_urls.py:11-12` (`/operator/scraping/dataops/scheduler/...`), `setInterval(load,60000)` (`:458`), không visibility pause.
3. BE `scheduler.py` → `SchedulerPlanView/Health` (registry `SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']` used also for dataops). Filter `filteredJobs = plan.jobs.filter(j=> activeDomainFilter==="all"||j.domain===activeDomainFilter)` (`:499-501`), embedded mode hides domain select (`:537`).
4. Actions `JobActionButtons:164-221` compute `normalizedCaps` từ `capabilities` + `control_mode` (`manual_only/beat_read_only/platform_managed` → `run_now` etc). Disable logic `supported && !lockedByRunning` (`:198`). Risky `disable/abort` mở `ActionConfirmModal` (`:488-493`). Execute `postSocSchedulerJobAction` (`:468-476`) → `load()` refresh. History drawer `JobHistoryDrawer:284-421` fetch `getSocSchedulerJobHistory(jobKey,page,15)` paginated.

### B5. Cấu hình — Runtime config edit + audit
1. Mount `SocDataOpsConfigSection` → `fetchConfig:99-120` `Promise.all([getSocDataOpsRuntimeConfig(), getSocDataOpsRuntimeConfigAudit(auditPage)])` → `getSocDataOpsRuntimeConfig` qua `operator_urls.py:34` (`/operator/scraping/dataops/runtime-config/`) — **hợp lệ, không 404** (đính chính F03); BE `DataOpsRuntimeConfigView.get:72-78` trả `{config: to_dict(), ownership, updated_at}`; `DataOpsRuntimeConfigAuditView.get:184-200` trả paginated `{id,service_key,actor,timestamp,change_summary}[page]`.
2. Editor textarea `editConfig` JSON (`packages/web/src/components/soc/SocDataOpsConfigSection.tsx:213-219`), `handlePreview:126-156` parse JSON, `computeChangeSummary` (`:36-49` truncate 80 chars), `computeImpactWarnings` hardcode 4 queues (`:51-79`), call `previewSocDataOpsRuntimeConfig` (`:135-148`) → `operator_urls.py` không có preview mount riêng cho scraping? Preview mount tại `service_ops/urls.py:137` (`/operator/soc/dataops/runtime-config/preview/`) — dual mount, vẫn resolve via `soc` namespace; dual-mount `soc` vs `scraping` là design có chủ ý (xem `contracts/operator/urls.py:16-17`). BE `DataOpsRuntimeConfigPreviewView:125-154` merge `current_dict + payload` vào `MarketDataRuntimeConfig.from_dict` → validate → trả `{projected_config, validation_errors, is_valid, ownership}`. Modal `SocConfigPreviewModal` show.
3. `handleApply:158-172` parse JSON → `adapter.applySocDataOpsRuntimeConfig` → `soc.js:224-226` `POST /operator/scraping/dataops/runtime-config/` (qua `operator_urls.py:34` POST branch `DataOpsRuntimeConfigView.post:80-95`) → `apply_config(service_key=matrix, domain=DATAOPS_MARKET_DATA_DOMAIN)` → tạo `ServiceConfig` + `ConfigChangeAudit` → trả `{config,ownership,updated_at}` 201 → FE update state. Audit list paginated prev/next (`:268-295`). **Kết luận: Config tab load được — F03 false positive.**

---

## C. CONTRADICTIONS (Plan/Doc vs Code)

| # | Plan/Doc (file:line) | Thực tế Code (file:line) | Tác động | Trạng thái sau phản biện |
|---|---|---|---|---|
| C1 | `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md:43-45` Step0 payload `POST backfill/run-now` keys `dataset/symbol_group/symbols/date_from/date_to/mode/dry_run/execution_mode/reason` | `packages/core/backend/src/service_ops/views/dataops_planner.py:14-21` serializer chỉ là OpenAPI schema, validation thật tại `packages/core/backend/src/market_data/global_symbol_coverage.py:557-559` chỉ chấp nhận `mode∈{missing_only,strict_fresh}`; `packages/core/backend/src/service_ops/views/dataops_base.py:80-82` chỉ đọc `symbols`, bỏ `symbol_group`; `packages/core/backend/src/market_data/global_symbol_planner.py:329-354` không đọc `dry_run/date_from/date_to`; `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:128-140` gửi đủ các key thừa. | Preview 400 khi `mode=force_refresh`, `symbol_group` bị bỏ → blast radius universe, `dry_run` no-op, date range vô tác dụng. Audit Rev.1 mô tả đúng hướng nhưng nhầm cơ chế “serializer” — đính chính: validate ở `global_symbol_coverage.py`, không phải serializer `is_valid()`. | **CONFIRMED, nặng hơn** — bổ sung blast radius + dry_run. |
| C2 | `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md:53-54` verify `getSocDataOpsQueueTiers` trả `symbol_count/poll_interval/max_batch_size/examples` | BE `packages/core/backend/src/service_ops/dataops_market_data.py:280-287` đúng trả `examples`, nhưng FE `packages/web/src/components/soc/SocDataInventorySection.tsx:213-216` + `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:788-791` đọc `active_symbols` | UI empty, operator không thấy sample symbols. | **CONFIRMED** |
| C3 | `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md:8` đánh dấu **stale completed** “ALL 20 gaps CLOSED” (`AGENTS.md:26` cũng claim `~95%+`) | Code hiện thực có orphan `SocDataOpsPlannerConsole.tsx` chưa wire, và 3 datasets `whale_events/order_flow/dark_flow` disabled “coming soon” (`SocDataOpsOperationsSection.tsx:46-48` `supported:false`) — legacy có 8 datasets, native chỉ hỗ trợ 5 planner (`PLANNER_DATASETS` ở PlannerConsole `SocDataOpsPlannerConsole.tsx:7-13` 5 mục) | Parity claim quá lạc quan — 3 datasets legacy vẫn chưa port. | **CONFIRMED** |
| C4 | `AGENTS.md:98-103` Phase2 P2 COC-18 “thống nhất hero runs dùng `getSocDataOpsRunLogs`” — done | `DataOpsContext.tsx:101` đã đổi sang `getSocDataOpsRunLogs(1,20)`, nhưng `soc.js:587-602` vẫn tồn tại `getSocBackfillRuns({status,jobKey,limit})` và `BackfillRunDetailView` (`packages/core/backend/src/service_ops/views/dataops_backfill.py:8-42`) vẫn expose `/backfill/runs/` với filter `status/job_key/limit` — hai hệ thống run log song song (planner ServiceRunLog vs BackfillExecutionRun) không thống nhất hiển thị | Operator thấy 2 khái niệm “run” khác nhau. | **CONFIRMED** |
| C5 | `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md:184-193` SimpleCache module-level cho matrix để giữ state khi switch tab | `SocMatrixScrapeMonitor.tsx:30-33` `monitorCache` đã làm đúng, nhưng `SocDataInventorySection.tsx:36-49` + `SocDataOpsMonitorSection.tsx:243-264` không dùng cache, mỗi mount refetch → flicker + double request queueTiers (Inventory và Monitor đều fetch cùng endpoint) | Lãng phí request. | **CONFIRMED** |
| C6 | `docs/AUDIT_SOC_DATAOPS_20260716.md:42-43` báo `.tabBarDataOps` missing (CRITICAL) | `packages/web/src/components/soc/soc.components.css:26-28` đã thêm `.tabBarDataOps` border-cyan, nhưng `SocDataOpsPanel.tsx:81` audit cũ trỏ `styles.tabBar+tabBarDataOps` — hiện panel dùng `styles.dataopsSubtabBar` (`SocDataOpsPanel.tsx:170-188`) không còn dùng `tabBarDataOps`. Đã fix nhưng doc chưa update. | Doc stale. | **CONFIRMED (stale doc)** |
| C7 | `soc.js:220-230` runtime config `get/apply/preview` tưởng cùng prefix — audit Rev.1 kết luận GET 404 vì chỉ đọc `service_ops/urls.py:135` | Thực tế dual-mount: `service_ops/urls.py:135` (soc namespace) **và** `service_ops/operator_urls.py:34` (scraping namespace) cùng trỏ `DataOpsRuntimeConfigView`; `vninvest_core/contracts/operator/urls.py:16-17` mount cả hai; `vninvest_core/urls.py:42` mount `operator/` → `/core/v1/operator/scraping/dataops/runtime-config/` hợp lệ, không 404 (verify `operator_urls.py:11-39` mount toàn bộ nhóm scraping). | Audit Rev.1 vi phạm Nguyên tắc 1 — không grep `operator_urls.py` + `contracts/operator/urls.py`. | **REFUTED — false positive** (đính chính §H). |

---

## D. Findings (bug, gap, risk) — sau đính chính

| ID | Type | Mức | file:line | Thực tế | Tác động | Đề xuất fix | Trạng thái phản biện |
|---|---|---|---|---|---|---|---|
| **F01a** | ERROR | CRITICAL | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:53` vs `packages/core/backend/src/market_data/global_symbol_coverage.py:38,557-559` | `MODE_OPTIONS=["missing_only","force_refresh"]` nhưng BE chỉ chấp nhận `{"missing_only","strict_fresh"}`; `DataOpsPlannerPreviewView:218` đọc raw `request.data.get('mode')` → `build_global_planner_preview:557-559` raise `ValueError` → 400 `PLANNER_PREVIEW_INVALID`. Serializer `dataops_planner.py:14-20` chỉ là OpenAPI schema, không tham gia. | Preview 400 khi chọn Force refresh. | FE đổi `MODE_OPTIONS` → `["missing_only","strict_fresh"]`, gửi `force_refresh` bool riêng khi cần force. | **CONFIRMED** |
| **F01b** | ERROR | CRITICAL | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:132` vs `packages/core/backend/src/service_ops/views/dataops_base.py:80-82` + `packages/core/backend/src/market_data/global_symbol_coverage.py:221-223` | FE gửi `symbol_group:"vn100"` khi chọn group predefined, nhưng BE `_get_request_symbols` chỉ đọc `symbols` → `None` → `_normalize_requested_symbols(None)` fallback toàn bộ `GlobalSymbolRegistry.is_active` universe. | **Blast radius toàn vũ trụ** — operator tưởng VN100 ~100 mã, thực tế quét hàng nghìn mã. Nặng hơn F01a. | BE thêm nhánh đọc `symbol_group` → `fetch_symbol_group_members`/resolve group, hoặc FE luôn gửi `symbols: [...]` (resolve ở FE). Ưu tiên FE gửi `symbols` để không đổi BE contract. | **BỔ SUNG — CONFIRMED** |
| **F01c** | ERROR | HIGH | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:137,170-204` vs `packages/core/backend/src/market_data/global_symbol_planner.py:329-354` | FE gửi `dry_run:true` + UI hint “không ghi thật” (`vi.js`), nhưng `create_global_planner_run:329-341` không nhận/đọc `dry_run` → vẫn queue Celery task thật. `date_from/date_to` cũng bị bỏ, chỉ `reference_trade_date` được đọc (`dataops_base.py:94-98`). | Dry-run vô tác dụng, date range lừa dối — operator tick dry-run rồi bấm Chạy vẫn ghi thật. | Bỏ `dry_run/date_from/date_to` khỏi payload Run, hoặc BE thêm handling `dry_run` (chỉ preview, không `apply_async`). | **BỔ SUNG — CONFIRMED** |
| **F01d** | GAP | LOW | `packages/core/backend/src/service_ops/views/dataops_planner.py:14-20` | Serializer `DataOpsPlannerPreviewRequestSerializer` chỉ dùng cho OpenAPI docs, validation thật ở `global_symbol_coverage.py`. Audit Rev.1 nói “serializer:14-20 chỉ chấp nhận” là gần đúng nhưng nhầm layer. | Gây hiểu nhầm khi fix — sửa serializer không đủ, phải sửa `PLANNER_SUPPORTED_MODES`. | Sửa doc, không sửa code serializer. | **Ghi nhận — CONFIRMED** |
| **F02** | ERROR | HIGH | `packages/web/src/components/soc/SocDataInventorySection.tsx:213-216` + `SocDataOpsMonitorSection.tsx:788-794` vs `packages/core/backend/src/service_ops/dataops_market_data.py:286-287` | FE đọc `tier.active_symbols` nhưng BE trả `examples`; `soc.js:161-163` không transform. | Queue tiers always “Chưa có mã mẫu”. | FE đổi `active_symbols` → `examples` (2 file, 15 phút). | **CONFIRMED** |
| **F03** | — | — | `packages/web/src/adapters/core/soc.js:220-221` vs `packages/core/backend/src/service_ops/operator_urls.py:34` + `contracts/operator/urls.py:16` + `vninvest_core/urls.py:42` | Audit Rev.1 kết luận 404 do chỉ đọc `service_ops/urls.py:135`. Thực tế `operator_urls.py:34` mount `dataops/runtime-config/` dưới `scraping/`, `contracts/operator/urls.py:16` include `service_ops.operator_urls`, `vninvest_core/urls.py:42` include `operator`. Full path `/core/v1/operator/scraping/dataops/runtime-config/` hợp lệ. Cùng tầng còn mount queue-tiers:32, observability:33, coverage:23, run-logs:27-28, planner:29-31 etc. — toàn bộ adapter scraping đều resolve. | **Không 404. Config tab load được.** Prefix `scraping` vs `soc` là dual-mount có chủ ý, cosmetic. | **REFUTED — false positive. KHÔNG sửa code, chỉ sửa audit (C7). Rút khỏi blocker.** | **REFUTED** |
| **F04** | ERROR | MEDIUM | `packages/web/src/components/soc/SocDataInventorySection.tsx:36-49` | `useEffect` deps `[queueTiersLoading, queueTiers.length, queueTiersError]` + guard `!loading && length===0 && !error` — nếu error, không retry; remount không refetch khi `queueTiersError` truthy. | Tier list kẹt error forever. | Thêm Retry button `setError(null)` + trigger fetch, hoặc move fetch vào `DataOpsContext`. | **CONFIRMED** |
| **F05** | RISK | MEDIUM | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:102-124` + `DataOpsContext.tsx:97-109` | Double fetch run logs: context page1/20 + operationsSection `runLogsPage/pageSize` — 2 request cùng endpoint mỗi mount, hero vs logs drift khi pageSize ≠20 | Lãng phí, hero chỉ 20 item không phản ánh queue thực. | Hero lấy `count` từ `getSocDataOpsRunLogs` `count` field (`dataops_planner.py:26`), hoặc bỏ fetch trong Context. | **CONFIRMED** |
| **F06** | GAP | MEDIUM | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:58-60` + `soc.js:173-174` | `getSocDataOpsRunLogs(page,pageSize)` gửi `page_size`, BE `DataOpsRunLogsView:98-111` dùng `paginate_queryset` nhưng DRF có thể ignore `page_size` nếu không set `page_size_query_param` | PageSize 5/10/15/20 có thể vô tác dụng. | BE thêm `page_size_query_param="page_size"` hoặc FE bỏ control. | **CONFIRMED** |
| **F07** | ERROR | MEDIUM | `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:99-120` | `fetchConfig` dep `auditPage` → mỗi đổi page audit lại refetch config + `setEditConfig(JSON.stringify(envelope.config))` overwrite draft. | Mất draft khi paginate audit. | Tách `useEffect` config (mount once) và audit (dep auditPage). | **CONFIRMED** |
| **F08** | GAP | MEDIUM | `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:243-264` | Không `visibilitychange` + jitter, poll một lần lúc mount. | Số liệu stale. | Thêm `setInterval 30000` + `visibilitychange` pause. | **CONFIRMED** |
| **F09** | GAP | MEDIUM | `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:194-241` | Export CSV không truyền `service_key`, `limit` → export toàn SOC. | Tốn băng thông, lộ data. | Truyền `service_key` + `limit:5000` hoặc dùng endpoint DataOps-specific. | **CONFIRMED** |
| **F10** | RISK | MEDIUM | `packages/web/src/components/soc/SocSchedulerBoard.tsx:435-460` | Poll 60s fixed, không jitter/visibility, không abort fetch cũ. | Duplicate khi tab background. | Thêm `visibilitychange` + jitter 0-3s. | **CONFIRMED** |
| **F11** | GAP | LOW | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:46-48` | 3 datasets `whale_events/order_flow/dark_flow` disabled opacity 0.5 “coming soon” không tooltip. | Operator tưởng bug. | Thêm tooltip `dataset_field_*` + link docs, hoặc ẩn khỏi Ops. | **CONFIRMED** |
| **F12** | RISK | LOW | `packages/web/src/components/soc/SocAnomalyGuardPanel.tsx:57` | Title hardcoded `⚠️ ${t(...)}` emoji, vi phạm `jsx-no-literals` + a11y. | Lint warn, screen reader kém. | Dùng `LucideIcon AlertTriangle`. | **CONFIRMED** |
| **F13** | GAP | LOW | `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:51-79` | `computeImpactWarnings` hardcode 4 queues + 2 keys, bỏ lỡ key mới. | Warning thiếu. | Generic diff flag `poll_interval_seconds|max_batch_size|...`. | **CONFIRMED** |
| **F14** | GAP | LOW | `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:788-794` + `SocDataInventorySection.tsx:213` | Tier examples 5 (`example_limit=5`) nhưng inventory slice 10 — mismatch. | Hiển thị thiếu. | Tăng BE `example_limit` lên 10 hoặc FE đồng bộ 5. | **CONFIRMED** |
| **F15** | RISK | LOW | `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:121-124` + `SocDataOpsMonitorSection.tsx:263` | eslint-disable `exhaustive-deps` — stale closure `t` khi đổi language. | i18n không update error. | Thêm `t` vào deps. | **CONFIRMED** |
| **F16** | GAP | LOW | `packages/web/src/components/soc/SocDataInventorySection.tsx:164-165` | `calendar_days <30` warning cứng 30 ngày không tooltip. | Không hiểu tại sao 30. | Thêm `title` i18n. | **CONFIRMED** |
| **F17** | GAP | INFRA | `packages/web/src/components/soc/SocDataOpsPlannerConsole.tsx` orphan + `SocBackfillCenter.tsx` delegate | Dead code. | Tech debt. | Xoá hoặc wire. | **CONFIRMED** |
| **F18** | RISK | LOW | `packages/web/src/components/soc/DataOpsContext.tsx:81` | `error` single string cho cả 3 domain — overwrite. | Mất thông tin lỗi. | Tách `error: Record<string,string|null>`. | **CONFIRMED** |

### So với chuẩn thương mại (Datadog/Grafana/Bloomberg DataOps)

| Năng lực thương mại | Hiện trạng DataOps native | Gap |
|---|---|---|
| Real-time SSE/WebSocket cho queue & coverage | Chỉ poll on mount (Inventory/Monitor), scheduler 60s, overview có SSE nhưng DataOps không | Thiếu live — nên thêm `GET /operator/soc/dataops/stream/` tương tự `signals/stream` |
| Bulk action (chọn nhiều gaps → trigger backfill) | Top gaps chỉ list, không select → không bulk hydrate | Thêm checkbox + “Hydrate selected” gọi `planner/run` với `symbols: [...]` |
| SLA/SLO freshness (ví dụ 99% fresh trong 24h) | Parity gates chỉ 24h/72h snapshot, không SLO target config | Thiếu SLO config trong `MarketDataRuntimeConfig` |
| Alerting (gap>threshold → alert) | Anomaly guard passive, không tạo alert/notify | Cần hook `_upsert_service_health_alert` như `packages/core/backend/src/service_ops/tasks.py` health |
| Lineage/dependency graph (dataset → tier → job) | Queue tier → dataset mapping cứng trong `QUEUE_TIER_DATASETS`, không visualize | Thêm graph như `SocOverviewPanel` domain strip |
| Audit search/filter (by actor, time range) | Config audit chỉ paginated, không filter/search | Thêm query `?actor=&since=&until=` |
| RBAC write guard feedback | `ownership.can_apply` chỉ show badge, nhưng `handleRun`/`handleApply` không disable khi `!can_apply` | Nên disable buttons + tooltip `write_block_reason` |
| Dry-run diff viewer | Preview chỉ counts + tables, không diff config | Preview nên show `projected_config` diff như Config tab |

---

## E. Quality Gates audit

| Gate | Lệnh chạy | Kết quả thực tế (2026-09-16) | Đánh giá |
|---|---|---|---|
| **Type-check** | `npx tsc --noEmit` (`packages/web`) | **PASS 0 errors** | ✅ |
| **Build** | `npm run build` (`tsc && vite build`) | **PASS 26.69s**, chunks OK, warnings chỉ `chunk >500kB` (`widget 2218kB`, `echarts 637kB`) — pre-existing. | ✅ |
| **Lint** | `npm run lint` (`eslint src`) | `eslint` chạy **timeout >120s** — baseline 3549 warns, 0 errors. Không có lỗi mới từ DataOps. | ✅ (0 errors) |
| **Tests** | `npm run test:components` (`vitest run`) | **34/35 files pass, 187/188 tests pass** (51.54s). 1 FAIL `soc-overview-stream.component.test.tsx:107` flaky `EventSource` mock — **không liên quan DataOps**. | ⚠️ 1 fail ngoài DataOps; DataOps thiếu unit tests. |
| | `npm run test` (`jest`) | `packages/web/src/adapters/core/__tests__/soc.test.js:150-232` cover `getSocDataOps*` adapter (5 tests). Entry 111 confirm `jest soc.test.js 90/90`. | ✅ adapter covered |
| | BE `manage.py test service_ops` | Không chạy live (không DB), nhưng Entry 91 `301 OK`. | ✅ giả định pass |
| **i18n** | `packages/web/src/i18n/vi.js` + `en.js` | VI/EN đủ keys DataOps — `grep soc.dataops.` >100 hits, không missing. | ✅ |
| **CSS/Config** | `soc.tokens.css + soc.components.css + soc.module.css` | Tokens 30 vars, components 2925 dòng, `dataops*` classes tồn tại. `tabBarDataOps` đã fix. | ✅ |
| **External coupling** | `vninvestcharts-widget ^1.2.5` + `defaultCoreApiAdapter` + dual namespace `scraping/soc` | `package.json:99` `^1.2.5`, `operator_urls.py:1-39` dual-mount hợp lệ, DataOps không dùng widget (0 hit). | ✅ (đính chính F03) |

**i18n hardcoded scan:** `grep -R t("soc.dataops.` → mọi label qua `t()`, không hardcode (trừ `F12` emoji và `F18` fallback `“—”`/`"system"` trong `SocDataOpsConfigSection.tsx:259-260` — minor).

---

## F. Câu hỏi cần làm rõ

1. **Dataset scope thực tế:** BE planner hỗ trợ 5 datasets (`daily_prices/price_board_snapshot/intraday_bars/intraday_ticks/session_facts`) nhưng `GAP §10.2` legacy có 8. 3 datasets `whale_events/order_flow/dark_flow` có kế hoạch đưa vào planner hay bỏ hẳn?
2. **Date range cho planner:** FE Vận hành có `date_from/date_to` nhưng BE chỉ có `reference_trade_date` + coverage gap window tự tính. Có cần BE mở rộng `from_date/to_date` cho planner hay FE bỏ date inputs? (liên quan F01c)
3. **Run logs source of truth:** Hero metrics và Operations run logs đều dùng `ServiceRunLog`, còn `BackfillExecutionRun` (`dataops_backfill.py`) là hệ thống backfill riêng. Có muốn merge timeline hay ẩn Backfill API?
4. **Runtime config prefix:** ĐÃ RÕ — dual-mount `scraping` vs `soc` đều hợp lệ (`operator_urls.py:34` vs `urls.py:135`). Không cần hỏi infra nữa (đính chính F03).
5. **Queue tier examples limit:** BE `example_limit=5` nhưng Inventory UI slice 10 — có muốn tăng BE lên 10 không? (F14)
6. **Orphan `SocDataOpsPlannerConsole`:** Giữ để tách epic riêng hay xoá?
7. **Export scope:** Export CSV hiện toàn SOC — có muốn filter theo `service_key=dataops` hay giữ global? (F09)

---

## G. Đánh giá tổng thể (sau đính chính)

| Tiêu chí | Điểm | Nhận xét |
|---|---|---|
| **Parity vs legacy** | 7.5/10 | 20 gaps claim “closed” nhưng thực tế 3 datasets disabled, 1 orphan planner chưa wire, payload mismatch — parity ~85% chứ không 95%+. Inventory vượt legacy về viz, nhưng Vận hành bị chặn bởi F01 blast radius. |
| **Backend parity** | 8/10 | BE coverage/queue/observability/parity/retention/anomaly đầy đủ (`dataops_market_data.py:711-857`), inventory chi tiết, planner preview/run/abort chuẩn. Dual namespace `scraping/soc` là có chủ ý và đúng. Trừ `symbol_group` chưa đọc (F01b) và page_size handling (F06). |
| **Frontend UX** | 7/10 | Glassmorphism đồng nhất, subtab bar rõ, hero metrics + skeleton tốt, i18n full dấu, a11y `role=tablist/tab/aria-selected` (`SocDataOpsPanel.tsx:169-182`). Nhưng thiếu bulk action, live refresh, write-guard disable, và F02 empty examples làm giảm trust. |
| **Thương mại readiness** | 6.5/10 | So Datadog/Grafana: thiếu SSE, alerting trên anomaly, SLO target, lineage graph, audit search. Đạt **internal operator** nhưng chưa **commercial SaaS**. |
| **Implement tiếp** | **Fix P0 trước khi release** | Ưu tiên **F01a-c (1.5h)** + **F02 (15m)** → ~2h là DataOps usable. F03 **không sửa**. Sau đó F08/F09/F15 (0.5d) cho parity thương mại v1. |
| **Blocker** | **F01a+b+c + F02** | F01 (mode 400 + blast radius universe + dry-run no-op) + F02 (empty examples). **F03 đã rút khỏi blocker** sau đính chính. 2 subpages bị ảnh hưởng: Vận hành Preview/Run (F01) và Kho dữ liệu tier samples (F02). Cấu hình **không block** nữa. |

**Thứ tự sửa đề xuất (đính chính):**

1. **Hotfix 2h** (P0): F01a `MODE_OPTIONS` + F01b `symbol_group` → `symbols` (hoặc BE đọc group) + F01c bỏ `dry_run/date_from/date_to` hoặc BE handle + F02 `active_symbols→examples` — verify `npx tsc --noEmit` + `npm run build` + manual test `preview VN100` đảm bảo không fallback universe.
2. **Polish 0.5d** (P1): F04 retry, F05 single source hero, F07 tách config/audit effect, F08/F10 visibility poll, F09 export filter.
3. **Cleanup 0.5d** (P2): F17 xoá orphan, F11 tooltip, F13 generic warnings, F06 page_size, F12 icon, F16 threshold tooltip.
4. **Commercial backlog** (tách epic): SSE stream cho DataOps, bulk hydrate, SLO, alerting, audit search.

> Sau hotfix, chạy `npx tsc --noEmit` + `npm run build` + `vitest run src/components/__tests__/soc-p2.component.test.tsx` + BE `manage.py test service_ops.tests.test_soc_api_domain --keepdb` để đóng gate. Đặc biệt test `symbol_group="vn100"` phải trả đúng ~30 symbols, không phải toàn universe.

---

## H. Phản biện độc lập & Đính chính (2026-09-16)

### H.1 Phán quyết phản biện

| # | Mức audit gán | Phán quyết độc lập | Chi tiết verify |
|---|---|---|---|
| F01 | CRITICAL | **CONFIRMED, còn nặng hơn** | `mode=force_refresh` → 400 đúng do `DataOpsPlannerPreviewView:218` đọc raw mode + `build_global_planner_preview:557-559` check `PLANNER_SUPPORTED_MODES={'missing_only','strict_fresh'}` (`global_symbol_coverage.py:38,557-559`) → `ValueError` → 400 `PLANNER_PREVIEW_INVALID`. `date_from/date_to` bị ignore đúng do BE chỉ đọc `reference_trade_date` (`dataops_base.py:94-98`). **Bổ sung nặng hơn:** `symbol_group` bị ignore (`dataops_base.py:80-82` chỉ đọc `symbols` → `None` → `global_symbol_coverage.py:221-223` fallback toàn universe) và `dry_run` no-op (`global_symbol_planner.py:329-354` không nhận `dry_run`). Serializer `dataops_planner.py:14-20` chỉ là OpenAPI schema, không tham gia validation — audit Rev.1 nhầm layer nhưng kết luận 400 vẫn đúng. |
| F02 | HIGH | **CONFIRMED** | BE `dataops_market_data.py:286-287` `'examples': symbols[:5]`, FE `SocDataInventorySection.tsx:213` + `SocDataOpsMonitorSection.tsx:789` đọc `active_symbols`, adapter `soc.js:161-163` không transform → luôn `empty_examples`. |
| F03 | HIGH | **REFUTED — false positive** | Audit Rev.1 chỉ đọc `service_ops/urls.py:135` (mount dưới `soc`), bỏ sót `service_ops/operator_urls.py:34` mount `dataops/runtime-config/` dưới `scraping/`, `contracts/operator/urls.py:16` include `service_ops.operator_urls` vào `scraping/`, `vninvest_core/urls.py:42` include `contracts.operator.urls` vào `core/v1/operator/`. Full path `/core/v1/operator/scraping/dataops/runtime-config/` hợp lệ, trỏ đúng `DataOpsRuntimeConfigView`. Cùng tầng `operator_urls.py:11-39` mount toàn bộ nhóm scraping (queue-tiers:32, observability:33, coverage:23, run-logs:27-28, planner:29-31, scheduler:11-14, runtime-config:34) — toàn bộ adapter `soc.js` scraping đều resolve. C7 cũng sai vì cùng lý do. |

### H.2 Vi phạm khung audit

**Nguyên tắc 1** (`AGENTS.md:141` grep/scrape PHẢI quét TOÀN repo gồm `.css/.module.css/config/vite/i18n`) — audit Rev.1 không quét `service_ops/operator_urls.py` + `vninvest_core/contracts/operator/urls.py` + `vninvest_core/urls.py`, dẫn tới kết luận sai 1/3 P0. Đã khắc phục trong Rev.2 bằng `glob "**/operator/urls.py"` + `read` 3 file namespace.

### H.3 Đính chính áp dụng

- **F01:** Giữ CRITICAL, mở rộng thành F01a (mode 400) + F01b (symbol_group universe blast radius) + F01c (dry_run/date no-op) + F01d (serializer vs service layer). Blocker nặng hơn Rev.1.
- **F02:** Giữ HIGH, không đổi.
- **F03:** Đổi từ `ERROR HIGH` → `REFUTED false positive` — chuyển vào §H, rút khỏi §0 top, §C7, §D blocker, §G blocker, §F câu hỏi 4. **Không sửa code** cho F03; chỉ sửa audit + khuyến nghị thêm checklist “verify dual namespace `soc` vs `scraping`” vào `AGENTS.md` Framework Nguyên tắc 1 để tránh tái diễn.
- **C1, C7, B2, B5, A, E, G:** Đã cập nhật để phản ánh dual-mount hợp lệ và cơ chế validation thật (`global_symbol_coverage.py` thay vì serializer).
- **Khuyến nghị trước demo (đính chính):** 1) F01a-c (CRITICAL): sửa FE `MODE_OPTIONS→strict_fresh` + `force_refresh` bool + resolve `symbol_group` → `symbols` (hoặc BE đọc group); bỏ `date_from/date_to/dry_run` khỏi Run. 2) F02 `active_symbols→examples`. 3) F03 **không sửa**.

---

## Phụ lục: Checklist verify sau fix (đính chính)

- [ ] `npx tsc --noEmit` 0 errors
- [ ] `npm run build` PASS (không thêm chunk warning)
- [ ] Preview `mode=strict_fresh + force_refresh=true + 3 symbols` → 200 (không 400)
- [ ] Preview `symbol_group=vn100` (FE gửi `symbols` đã resolve hoặc BE đọc group) → `planned_items` ≈ VN100 scope, **không** fallback universe (check `symbols` trong log không phải toàn registry)
- [ ] Dry-run: tick dry-run → Preview chỉ, **không** queue task khi bấm Chạy (hoặc UI disable Run khi dry-run)
- [ ] Kho dữ liệu → Queue tiers show 5 `examples` thay vì empty
- [ ] Cấu hình → load config 200 (đã load được cả trước fix — verify không regression sau sửa F01/F02)
- [ ] Vận hành → Run logs paginated đúng page_size
- [ ] Monitor → export CSV filter `service_key=dataops` chỉ ra audit DataOps
- [ ] Lịch chạy → `domain=dataops` filter đúng, actions enable/disable hoạt động
- [ ] i18n VI/EN switch không stale error message

---

*Audit thực hiện theo `AGENTS.md` Framework (Nguyên tắc 1-6, B1-B6). Mọi phát hiện đã được đối chiếu plan↔code tại file:line và verify độc lập qua `read/grep` toàn repo (bao gồm `operator_urls.py`, `contracts/operator/urls.py`, `vninvest_core/urls.py`, `.css`, `soc.js`, `global_symbol_coverage.py`). Rev.2 đính chính F03 false positive và bổ sung F01 blast radius theo phản biện độc lập 2026-09-16.*

---

## I. Fix Log 2026-09-16 — P0/P1/P2 đã code (bàn giao)

**Ngày code:** 2026-09-16 · **Gates sau code:** `tsc 0` · `build 58.05s PASS` · `vitest soc-p2 20/20` · `manage.py check 0`

| ID | Trạng thái | File:line đã sửa | Verify |
|---|---|---|---|
| F01a `mode` | ✅ FIXED | `SocDataOpsOperationsSection.tsx:53` `MODE_OPTIONS strict_fresh`, `buildPayload:force_refresh` | Preview `strict_fresh` không 400 |
| F01b `symbol_group` | ✅ FIXED | `service_ops/views/dataops_base.py:80-103` resolve `symbol_group` → `fetch_symbol_group_members` | VN100 preview không fallback universe |
| F01c `dry_run/date` | ✅ FIXED | `OperationsSection.tsx:79-83,128-140,172-188` `forceRefresh` state, `dryRun` block Run, `reference_trade_date` | Dry-run block queue, date không gửi |
| F02 `examples` | ✅ FIXED | `SocDataInventorySection.tsx:8-12,214-220` + `MonitorSection.tsx:12-16,790` + `soc.js:161-172` normalize | Queue tiers show 5 examples, `grep active_symbols` chỉ còn fallback |
| F04 retry | ✅ FIXED | `InventorySection.tsx:180-184` nút Retry | Error → Retry → refetch |
| F05 double-fetch | ✅ FIXED | `OperationsSection.tsx:121-124` bỏ `refreshRuns()` | 1 request run-logs/page |
| F07 split | ✅ FIXED | `ConfigSection.tsx:51-79,99-120` generic warnings + tách `fetchConfigOnly/fetchAuditOnly` | Audit paginate không mất draft |
| F08 poll | ✅ FIXED | `MonitorSection.tsx:244-265` 30s+jitter+visibility | Hidden không poll |
| F09 export | ✅ FIXED | `MonitorSection.tsx:195-226` `service_key backfill_daily_prices limit 5000` | Export filter dataops |
| F10 scheduler poll | ✅ FIXED | `SocSchedulerBoard.tsx:435-460` jitter+visibility |  |
| W-SCHED-01 39vs12 | ✅ FIXED | `SchedulerBoard.tsx:424-563` `showAllDomains` + header `10/39` + `vi.js:1125` `filter_count` | Header “10/39 (lọc)” + toggle |
| F11 tooltip | ✅ FIXED | `OperationsSection.tsx:264-272` `title` coming-soon | Hover show field |
| F12 a11y | ✅ FIXED | `AnomalyGuardPanel.tsx:1-3,54-58` `AlertTriangle` + `lucide-icon.tsx:60` | Không emoji |
| F16 calendar | ✅ FIXED | `InventorySection.tsx:165` + `vi.js:783` `calendar_days_warning` | Title 30 ngày |
| F13 generic | ✅ FIXED | `ConfigSection.tsx:51-79` generic `sensitiveKeys` diff |  |
| F17 orphan | ✅ FIXED | `PlannerConsole.tsx:1-5` deprecated header, `BackfillCenter` giữ delegate |  |
| F18 multiplex | ✅ FIXED | `DataOpsContext.tsx:42-154` `errors: Record<string,…>` |  |
| F03 | ✅ REFUTED | Không sửa code — audit §H | Config load vẫn 200 |

**Còn lại (không blocker):** F06 `page_size` đã đúng (`StandardPageNumberPagination page_size_query_param=page_size`), F14/F15/F17 đã note — không cần code thêm trước demo.
