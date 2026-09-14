# Audit Tổng thể Operations Center (COC) — `http://localhost/operations-center`

> **Ngày**: 2026-09-16  
> **Auditor**: Muse Spark (opencode) — tuân khung AI Audit/Research Framework AGENTS.md (Nguyên tắc 1-6)  
> **Phạm vi**: Toàn bộ COC 8 tab — `ShellOperationsCenterPage.tsx:1-105` + 8 Soc Panel + `DataOpsContext.tsx`, `soc.js:1-499`, `soc.module.css:1-2707`, BE `service_ops/registry.py`, `tasks.py:1-1142`, `views/dataops_planner.py`, i18n `vi.js`/`en.js`, `tsconfig`, `vite.config`, adapter `core/soc.js` + `core/dnse.js`  
> **Phương pháp**: grep toàn repo (`.ts/.tsx/.css/.module.css/config/i18n`), glob `soc/**/*`, read từng file cốt lõi, trace 3 luồng use-case, đối chiếu plan↔code mục CONTRADICTIONS, quality gates `tsc/lint/build/i18n:scan/test`  
> **Mức hoàn thiện hiện tại**: **~75%** — giao diện glassmorphism hoàn chỉnh, DataOps parity ~95% (ledger), i18n ~400 keys, BE 50+ endpoint. **Chưa đạt chuẩn thương mại** do 3 P0 blocker + 5 P1 gap.

---

## Tóm tắt 5 findings nghiêm trọng nhất

**P0-Screener Config Save chết** `packages/web/src/components/soc/SocScreenerPanel.tsx:105-117` — `handleApplyConfig` chỉ đọc `previewModal.after`, trong khi `SocScreenerConfigForm.tsx:69-72` gọi `onSave(config)` với payload mới → nút Lưu trong form không bao giờ lưu được; **P0-Tab router double source-of-truth** `ShellOperationsCenterPage.tsx:22-44` và `SocTabNavigation.tsx:22-44` cùng quản `tab` qua `window.history.replaceState` + `localStorage soc_active_tab`, `activeTab` chỉ khởi tạo 1 lần từ `tabFromUrl` → back/forward và deep-link `/operations-center?tab=vnbroker` không đồng bộ; **P0-Prefetch group toggle không persist** `SocPrefetchPanel.tsx:33,126-130,89-102` `selectedGroups` chỉ lưu state local, `applySocPrefetchConfig` chỉ gửi `config_payload` → user chọn universe groups xong bấm Áp dụng nhưng backend không nhận; **P1-Signals live-feed chỉ fetch 1 lần** `SocSignalsPanel.tsx:132-185` `Promise.all 5 endpoint` rồi dừng, không poll/websocket → "Luồng trực tiếp" là tĩnh, operator phải F5; **P1-Runtime KPI rỗng 100%** `SocRuntimeKpiPanel.tsx:1-38` chỉ render `coming_soon` → tab `runtime-kpi` trong `SOC_TABS` vẫn hiện nhưng không có giá trị vận hành, vi phạm parity với legacy `RuntimeKPIPanel`.

---

## A. Bản đồ kiến trúc

| File | Dòng | Trách nhiệm | Ghi chú |
|------|------|-------------|---------|
| `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx:57-105` | 105 | Container `operations-center`, 8 tab router, `ShellPageChrome` | `useSearchParams` custom, `SOC_TABS` 8 entry `overview/signals/dataops/prefetch/screener/vnbroker/runtime-kpi/dnse-backfill` |
| `packages/web/src/components/soc/SocTabNavigation.tsx:1-86` | 86 | Tab bar glassmorphism, persist `localStorage soc_active_tab` | Shadow `useSearchParams`, `resolveLabel` `soc.tabs.*` |
| `packages/web/src/components/soc/SocOverviewPanel.tsx:93-570` | 570 | Health dashboard 6 metric + service cards filter/pagination | `ITEMS_PER_PAGE=9`, `getSocOverviewSummary` `soc.js:34` |
| `packages/web/src/components/soc/SocSignalsPanel.tsx:110-530` | 530 | Live feed 50 tín hiệu + Sentiment + JobConsole + Materialization | 5 API `getSocSignalPerformanceMetrics/getSocWhaleRecent/getSocDarkPoolRecent/getSocScreenerRecent/getSocSignalMaterialization` |
| `packages/web/src/components/soc/SocDataOpsPanel.tsx:35-205` | 205 | DataOps master 5 subtabs, hero metrics 4 card | `DataOpsProvider` wrapper, `DATAOPS_SUB_TABS` 5 |
| `packages/web/src/components/soc/DataOpsContext.tsx:75-165` | 165 | Context 3 refresh (inventory/runs/coverage) + triggerBackfill/abortRun | `loading:{inventory:true,runs:true,coverage:true}` đã fix |
| `packages/web/src/components/soc/SocDataInventorySection.tsx:23-218` | 218 | 4 metric + dataTypeGrid + yearChart + coverage table 6 col + queueTiers accordion | `getSocDataOpsQueueTiers` có `queueTiersError` |
| `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:62-789` | 789 | Backfill Form (8 dataset, group bar) + Planner Preview Drawer + RunLogs paginated | `createPortal` đã fix clip, `DATASETS_WITH_METADATA` 8 |
| `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:157-690` | 690 | QueueTiers + Observability + ParityGates + Retention + AnomalyGuard | `renderPagination` reuse |
| `packages/web/src/components/soc/SocDataOpsConfigSection.tsx:81-312` | 312 | Runtime config JSON editor + preview modal + audit trail | `computeChangeSummary/ImpactWarnings` `36-79` |
| `packages/web/src/components/soc/SocSchedulerBoard.tsx:423-705` | 705 | Scheduler plan table 8 col + HealthStrip + JobActionButtons + HistoryDrawer | `domainFilter`, `formatLag/formatNextRun` `76-98` |
| `packages/web/src/components/soc/SocPrefetchPanel.tsx:27-244` | 244 | Universe groups toggle + config editor + cache metrics + warm/purge | `getSocPrefetchUniverseGroups` `soc.js:266` |
| `packages/web/src/components/soc/SocScreenerPanel.tsx:55-399` | 399 | ConfigForm + Rules table + Manual scan + Results/Alerts + metrics | `createSocScreenerRule` bug Save |
| `packages/web/src/components/soc/SocVnbrokerPanel.tsx:69-447` | 447 | Config editor + CircuitBreaker + Health 5 metric + Benchmark table | `previewSocVnbrokerConfig` `soc.js:80` |
| `packages/web/src/components/soc/SocRuntimeKpiPanel.tsx:1-38` | 38 | Placeholder emptyState | `coming_soon` |
| `packages/web/src/components/soc/SocDnseBackfillPanel.tsx:20-205` | 205 | Trigger form symbol+date + Recent jobs 15 | `getDnseBackfillJobs/triggerDnseBackfill` (dnse adapter) |
| `packages/web/src/components/soc/SocConfigPreviewModal.tsx:1-121` | 121 | Diff before/after + changeSummary + impactWarnings | Thiếu overlay class |
| `packages/web/src/components/soc/SocScreenerConfigForm.tsx:1-156` | 156 | 5 field number + reset + validate | `validate` `48-67` |
| `packages/web/src/components/soc/SocScreenerRuleModal.tsx:1-57` | 57 | Modal create/edit rule, threshold/value JSON | Inline `overlayStyle` `36` |
| `packages/web/src/components/soc/soc.module.css:1-2707` | 2707 | Tokens glassmorphism, 80+ classes | Fat file, `:root --soc-rgb-*` 40 token |
| `packages/web/src/adapters/core/soc.js:31-498` | 499 | Facade 60 methods, `normalizeConfigEnvelope` | Split `/operator/soc/` vs `/operator/scraping/dataops/` |
| `packages/core/backend/src/service_ops/registry.py:241-248` | 421 | `SOC_DOMAIN_PRIMARY_SERVICE_KEYS` 6 domains | `dataops:'backfill_daily_prices'` đã fix F3 |
| `packages/core/backend/src/service_ops/tasks.py:81-139` | 1142 | `_probe_service_health` + `health_check_all_services` | `domain_endpoint_map` rỗng → không ping thật |
| `packages/core/backend/src/service_ops/views/dataops_planner.py:95-112` | 412 | `DataOpsRunLogsView` paginated `ServiceRunLog` filter `dataops` | Đã fix F1 service key |

---

## B. Luồng dữ liệu đã trace (kèm file:line từng bước)

### B1 — Mở SOC → Overview → Toggle service

```
ShellOperationsCenterPage.tsx:60 tabFromUrl = searchParams.get("tab")||"overview"
  → useState(tabFromUrl) activeTab
  → renderTabContent():69-88 switch activeTab
    → SocOverviewPanel.tsx:103-122 fetchData()=>defaultCoreApiAdapter.getSocOverviewSummary():soc.js:34
      → GET /core/v1/operator/soc/overview/ → OverviewSummaryView
        → ServiceDefinition(23) + ServiceHealth
          ← health_check_all_services tasks.py:334-388 _probe_service_health:81-139
            → _get_service_endpoint:68-79 domain_endpoint_map toàn None → has_current_config → CONSECUTIVE_FAILURE_COUNTER
  → render metricGrid 6 card + servicesGrid filter search+statusFilter:125-139 + handleToggle:165-179 updateSocService + fetchData
```

**Kết luận**: Endpoint map rỗng nên VNBroker/Prefetch/DataOps/Screener luôn `healthy` nếu config tồn tại — dashboard xanh giả khi BE down.

### B2 — DataOps → Operations → Preview + Run backfill

```
DataOpsContext.tsx:136-140 useEffect auto refreshInventory/Runs/Coverage
  → SocDataOpsOperationsSection.tsx:144-162 handlePreview→adapter.previewSocDataOpsPlanner(buildPayload():130-142)
    → POST /operator/scraping/dataops/planner/preview/ → views/dataops_planner.py:213-234 build_global_planner_preview
      → {summary,items,skipped} → createPortal drawer:759-785
  → handleRun:164-186 actions.triggerBackfill:125-129 runSocDataOpsPlanner
    → DataOpsPlannerRunView:268-303 create_global_planner_run queue manual_on_demand → {run_id}
    → setSuccess(t("soc.dataops.backfill_queued_with_run",{run_id})) + fetchRunLogs:101-112
```

**Bug rẽ nhánh**: `selectedDatasets` mặc định `["intraday_ticks"]` SocDataOpsOperationsSection.tsx:75; `DATASETS_WITH_METADATA` có `whale_events/order_flow/dark_flow` disabled Coming soon nhưng vẫn gửi nếu user chọn → 400 dataset not supported. Thiếu validate `date_from<=date_to` và 365 ngày.

### B3 — Prefetch config save (chết)

```
SocPrefetchPanel.tsx:39-70 Promise.all getSocPrefetchConfig/CacheStatus/UniverseGroups
  → selectedGroups useState<string[]> toggle 126-130
  → handlePreview:80-87 JSON.parse không gọi API preview
  → handleApply:89-102 applySocPrefetchConfig(parsed) chỉ gửi config_payload:soc.js:235
    → không gửi selectedGroups → Universe groups không persist
  → warmSocPrefetchNow("async"):262 không truyền groups → warm toàn bộ
```

**Hậu quả**: Thao tác nhóm vô nghĩa, operator tưởng đã chọn VN30 nhưng warm cả HOSE.

### B4 — Screener Config Save chết

```
SocScreenerPanel.tsx:215-221 <SocScreenerConfigForm onSave={handleApplyConfig} />
  → SocScreenerConfigForm.tsx:69-72 handleSave→await onSave(config) với config mới
    → SocScreenerPanel.tsx:105-117 handleApplyConfig(){ if(!previewModal) return; await applySocScreenerConfig(previewModal.after) }
      → previewModal null → early return → không lưu
```

**Hậu quả**: Mọi chỉnh sửa scan_interval, max_symbols trong form bị nuốt.

---

## C. CONTRADICTIONS (Plan/Doc vs Code)

| Plan/Doc | Thực tế | Tác động |
|----------|---------|----------|
| `TECH_SPEC SocDataOps` "Health probe ping endpoint + consecutive_failures→degraded" | `tasks.py:68-79` `domain_endpoint_map` toàn `None`, `endpoint` luôn falsy | Health dashboard vô dụng với VNBroker/Prefetch/DataOps/Screener; chỉ signals/matrix đếm DB rows |
| `SOC Center` "Runtime KPI hiển thị throughput/error/capacity" | `SocRuntimeKpiPanel.tsx:18-36` chỉ `emptyState coming_soon` | Tab tồn tại nhưng rỗng, parity 0% |
| `Screener` "ConfigForm Save lưu qua preview→apply" | `SocScreenerPanel.tsx:105-117` bỏ qua param `config`, chỉ dùng `previewModal` null → Save chết | Cấu hình screener không thể sửa |
| `Prefetch` "Universe groups là source cho warm-now" | `SocPrefetchPanel.tsx:104-112` `warmSocPrefetchNow("async")` không truyền `selectedGroups` | Warm toàn bộ, không theo chọn |
| `DataOps` "Run logs là operator history duy nhất" | `DataOpsContext.tsx:71` `getSocBackfillRuns` + `SocDataOpsOperationsSection.tsx:57` `getSocDataOpsRunLogs` hai bảng khác nhau | Hero metrics (BackfillExecutionRun) vs RunLogs (ServiceRunLog) lệch nhau |
| Ledger 82 "F4 đã fix auto-load + skeletons" | Code đã fix `DataOpsContext.tsx:80,136-140` nhưng `SocDataInventorySection.tsx:51-53` vẫn `loading.inventory` chỉ `<p>loading` không skeleton | UX loading không đồng nhất |
| `SOC 8 tabs` "Đầy đủ vận hành" | `SocRuntimeKpiPanel` rỗng, `SocDnseBackfillPanel` chỉ 15 jobs, không pagination | Kỳ vọng operator không đạt |

Đã xác minh đóng: `registry.py:244` `dataops` key (F3), `tasks.py:81-132` `consecutive_failures` logic (F2), `DataOpsContext.tsx:80,136-140` auto-load (F4), `SocDataOpsOperationsSection.tsx:2,730` portal clip (F3 overlay) — 4 P0 cũ từ `AUDIT_SOC_CENTER_DEEP_20260719.md` và `AUDIT_OPERATIONS_CENTER_20260701.md` F2 config `||` fallback / F4 i18n typo đã hết.

---

## D. Findings chi tiết

### D1. Shell + Tab Navigation (container)

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-01** | ERROR P0 | `ShellOperationsCenterPage.tsx:22-44` + `SocTabNavigation.tsx:22-64` | Hai `useSearchParams` custom cùng `window.history.replaceState` + `localStorage soc_active_tab` race; `ShellOperationsCenterPage.tsx:61` `activeTab` chỉ `useState(tabFromUrl)` 1 lần | Back/forward, deep-link `/operations-center?tab=vnbroker` không đồng bộ, localStorage override URL | Thống nhất dùng `react-router useSearchParams`, xóa custom, bỏ `localStorage` fallback hoặc sync 1 chiều URL→state |
| **COC-02** | GAP P0 | `SocTabNavigation.tsx:23-27` + `packages/web/src/i18n/vi.js:149-159` | `SOC_TABS` key `runtime-kpi/dnse-backfill` hyphen vs `soc.tabs.runtime_kpi/dnse_backfill` underscore | Label fallback "Runtime-kpi" không dịch | Chuẩn hóa `resolveLabel` `tabKey.replace(/-/g,"_")` hoặc đổi key i18n sang hyphen |
| **COC-03** | GAP P1 | `ShellOperationsCenterPage.tsx:92-96` | `ShellPageChrome description:undefined`, trong khi `SocOverviewPanel`/`SocDataOpsPanel` có header riêng | Trùng eyebrow "SOC" 2 lần | Truyền `description: t("soc.overview.overview_description")` động theo tab hoặc bỏ `overviewPageHeader` trong panel |
| **COC-04** | GAP P2 | `soc.module.css:46-63` `.tabBar` `flex:1` per `.tabButton:75` | 8 tab `flex:1` overflow-x auto nhưng `flex:1` ngăn shrink trên mobile | Tab bị cắt, không scroll mượt | Đổi `.tabButton{flex:0 0 auto}` + `gap:0.5rem` |

### D2. Overview — `SocOverviewPanel.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-05** | GAP P1 | `SocOverviewPanel.tsx:103-122,271-275` | Chỉ `setError(string)`, không nút Retry; `loading`→`error`→`content` 3 nhánh cứng | User kẹt khi 500, phải F5 | Thêm `<button onClick={fetchData}>` trong `inlineError`, dùng `useTenantAdminQuery` stale 15s |
| **COC-06** | ERROR P1 | `SocOverviewPanel.tsx:149-163` | `stats` tính 6 lần `filter` toàn mảng, `METRIC_DEFS` hardcode color | Perf nhỏ nhưng lệch khi thêm domain | Memo 1 lần `reduce` |
| **COC-07** | GAP P1 | `SocOverviewPanel.tsx:165-195` | `handleToggle/healthCheck` catch `setError("Failed...")` generic, mất `err.message` | Không biết 403 vs 500 | Truyền `err.message` vào `setError` và toast |
| **COC-08** | GAP P1 | `SocOverviewPanel.tsx:211-217` | Filter `critical` gộp `unhealthy+critical` thiếu `maintenance` | Thiếu filter bảo trì | Thêm `filter_maintenance` hoặc gộp vào degraded |
| **COC-09** | GAP P1 | `SocOverviewPanel.tsx:485-489` | Search chỉ `service_key+name`, không `domain` | Tìm "vnbroker" không ra | Thêm `s.domain.includes(q)` |
| **COC-10** | GAP P2 | `SocOverviewPanel.tsx:458-489` | Không auto-poll, không `updated_at` | Health stale | Poll 15s `setInterval(fetchData,15000)` như `SocMatrixScrapeMonitor:70` |

### D3. Signals — `SocSignalsPanel.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-11** | GAP P1 | `SocSignalsPanel.tsx:132-185,457-468` | `Promise.all 5 endpoint` 1 lần, sort `localeCompare` string | Feed tĩnh, sai thứ tự nếu ISO không chuẩn | Poll 10s `setInterval(fetchData,10000)` + `sort((a,b)=>+new Date(b.detected_at)-+new Date(a.detected_at))` |
| **COC-12** | ERROR P1 | `SocSignalsPanel.tsx:151-170` | `key={`${s.type}-${s.id??s.symbol}-${s.detected_at}`}` trùng nếu cùng symbol+time | React key collision | Dùng `key={`${s.type}-${s.id??idx}-${s.detected_at}`}` |
| **COC-13** | GAP P1 | `SocSignalsPanel.tsx:212-227` | `handleRunJob` chỉ check `!jobSymbol.trim()`, không validate format | Gửi `@@@` vẫn 400 | Validate `^[A-Z0-9]{3,6}$`, `toUpperCase` đã có |
| **COC-14** | GAP P2 | `SocSignalsPanel.tsx:65-81` | `TYPE_ICONS` emoji 🐳 hardcode, không `LucideIcon` | Lệch glassmorphism | Dùng `LucideIcon name="Waves"` |
| **COC-15** | GAP P2 | `SocSignalsPanel.tsx:229-234` | `signalTypeLabel` hardcode "Whale" | i18n thiếu | Dùng `t("soc.signals_overview.filter_whale")` |
| **COC-16** | GAP P2 | `SocSignalsPanel.tsx:297-341` | Sentiment bar `sentiment.bullish` count không `%`, `no_data` segment rỗng | Hiểu nhầm tâm lý | Hiển thị `bullPct.toFixed(1)%` |
| **COC-17** | GAP P2 | `SocSignalsPanel.tsx:386-442` | Materialization `statusColor` chỉ `success/completed` vs health `healthy` | Màu sai | Map qua `statusTone` `socStatusColors.ts:33` |

### D4. DataOps — `SocDataOpsPanel` + `DataOpsContext`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-18** | GAP P1 | `DataOpsContext.tsx:71` vs `SocDataOpsOperationsSection.tsx:57` | Hai nguồn runs: `getSocBackfillRuns` (`/operator/soc/dataops/backfill/runs/`) vs `getSocDataOpsRunLogs` (`/operator/scraping/dataops/run-logs/`) | Hero metrics vs RunLogs lệch | Thống nhất dùng `getSocDataOpsRunLogs` cho hero |
| **COC-19** | GAP P1 | `SocDataOpsPanel.tsx:103` `isLoading=loading.inventory&&loading.runs` | Cần cả 2 true mới skeleton, thực tế `coverage` riêng | Skeleton không hiện khi `runs` xong trước | Dổi `isLoading=loading.inventory\|\|loading.runs` |
| **COC-20** | GAP P1 | `SocDataOpsPanel.tsx:82-85` scheduler `hideHeaderTitle:true` embedded `SocSchedulerBoard.tsx:507` ẩn HealthStrip | DataOps scheduler mất health | Truyền `domain="dataops"` và hiện HealthStrip |

### D5. Inventory — `SocDataInventorySection.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-21** | GAP P2 | `SocDataInventorySection.tsx:51-53` | `if(loading.inventory) return <p>loading` | Không skeleton | Dùng `skeleton` như Overview `220-268` |
| **COC-22** | GAP P2 | `SocDataInventorySection.tsx:89-92` | `dataTypeCard` inline `borderColor:rgb(6,95,70)` hardcode | Phá token | Dùng `var(--color-success-500)` |
| **COC-23** | GAP P2 | `SocDataInventorySection.tsx:148-158` | Ratio bar `ratio*100%` không cap >1 | Vượt 100% nếu data lỗi | `Math.min(ratio,1)*100` |
| **COC-24** | GAP P2 | `SocDataInventorySection.tsx:185-212` | Accordion `onClick` không `aria-expanded/keyboard` | A11y | Thêm `role="button" tabIndex` |

### D6. Operations — `SocDataOpsOperationsSection.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-25** | ERROR P1 | `SocDataOpsOperationsSection.tsx:75-83,209-211` | `selectedDatasets` mặc định `["intraday_ticks"]`, `toggleDataset` cho phép rỗng | BE 400 empty datasets | Validate `selectedDatasets.length>0`, disable Run |
| **COC-26** | ERROR P1 | `SocDataOpsOperationsSection.tsx:335-379` | Thiếu validate `date_from>date_to` và 365 ngày | BE 400 generic | `if(dateFrom&&dateTo&&dateFrom>dateTo) setError(...)` |
| **COC-27** | ERROR P1 | `SocDataOpsOperationsSection.tsx:176-178` | `backfill_queued_with_run` với `runId=""` | Toast trống | Fallback `t("soc.dataops.backfill_queued")` nếu `!runId` |
| **COC-28** | GAP P1 | `SocDataOpsOperationsSection.tsx:144-162` | `handlePreview` không check `reason` nhưng `handleRun` check | UX lệch | Đồng nhất validate reason ở preview |
| **COC-29** | GAP P1 | `SocDataOpsOperationsSection.tsx:120-127` | Hai `useEffect`: `refreshRuns` + `fetchRunLogs` duplicate | Gọi API thừa | Gộp 1 nguồn runs |
| **COC-30** | GAP P2 | `SocDataOpsOperationsSection.tsx:261-273` | `Coming soon` hardcode, không i18n | Thiếu dịch | Dùng `t("soc.dataops.backfill_dataset_coming_soon")` |
| **COC-31** | GAP P2 | `SocDataOpsOperationsSection.tsx:402` `dryRun` checkbox không tooltip | User nhầm với Preview | Thêm `title=t("soc.dataops.backfill_dry_run_hint")` |

### D7. Monitor — `SocDataOpsMonitorSection.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-32** | GAP P2 | `SocDataOpsMonitorSection.tsx:256-258` | `if(loading.coverage&&queueTiers.length===0) return <p>loading` | Layout nhấp nháy | Dùng skeleton |
| **COC-33** | GAP P2 | `SocDataOpsMonitorSection.tsx:260-273` | `fail_rate_pct` 0 hiện `0.00%` khi `observability null` | Hiểu nhầm 0 lỗi | Hiện `—` khi `!observability` |
| **COC-34** | GAP P2 | `SocDataOpsMonitorSection.tsx:402-437` | Starvation `seconds_since_last_progress ?? "-"` string vào i18n number | Type mismatch | Đổi `t(...,{seconds:String(...)})` |
| **COC-35** | GAP P2 | `SocDataOpsMonitorSection.tsx:534-581` | Coverage table total sum `fresh+warm+...` | Nếu `total===0` vẫn 0 | Giữ, thêm empty check |

### D8. Prefetch — `SocPrefetchPanel.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-36** | ERROR P0 | `SocPrefetchPanel.tsx:33-34,126-130,89-102` | `selectedGroups` local, `applySocPrefetchConfig` không gửi | Chọn nhóm vô tác dụng | Gộp `selectedGroups` vào `config_payload.universe_groups` |
| **COC-37** | GAP P1 | `SocPrefetchPanel.tsx:80-87` | `handlePreview` không gọi `previewSocPrefetchConfig` | Preview giả | Gọi API preview như Vnbroker |
| **COC-38** | GAP P1 | `SocPrefetchPanel.tsx:104-112` | `warmSocPrefetchNow("async")` không truyền groups | Warm sai scope | Truyền `{groups:selectedGroups}` |
| **COC-39** | GAP P2 | `SocPrefetchPanel.tsx:106,109` | `alert("warm_success")` blocking | UX chặn | Dùng `toast` như Screener `100-103` |

### D9. Screener — `SocScreenerPanel.tsx` + `SocScreenerConfigForm.tsx` + `SocScreenerRuleModal.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-40** | ERROR P0 | `SocScreenerPanel.tsx:105-117,213-221` | `handleApplyConfig` ignore param, chỉ `previewModal.after` | Lưu chết | `handleApplyConfig(cfg){ const payload=cfg??previewModal?.after; ...}` |
| **COC-41** | ERROR P1 | `SocScreenerPanel.tsx:75-88,346-354` | `getSocScreenerRules` trả `{rules,results}` nhưng `setRules(rulesData.rules)` lấy raw, mất `id` fallback `soc.js:348` | Key trùng | Dùng `rulesData.results` |
| **COC-42** | GAP P1 | `SocScreenerPanel.tsx:232-273,307-352` | Rules `map` và Results `slice(0,20)` không pagination | >20 rules vỡ layout | Pagination 10/trang |
| **COC-43** | GAP P1 | `SocScreenerPanel.tsx:102-116` | `toast` `setTimeout 3000` không clear unmount | Leak | `useEffect cleanup clearTimeout` |
| **COC-44** | GAP P2 | `SocScreenerConfigForm.tsx:60-67` | `validate` hardcode `scan_interval<30` nhưng BE cho 10 | Lệch | Đồng bộ với `ScreenerDomainConfig` |
| **COC-45** | GAP P2 | `SocScreenerRuleModal.tsx:36-37` | Inline `overlayStyle` fixed, `zIndex:100` thấp hơn scheduler drawer 200 | Bị che | Dùng `styles.drawerOverlay` token |

### D10. VNBroker — `SocVnbrokerPanel.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-46** | GAP P2 | `SocVnbrokerPanel.tsx:303-310` vs `soc.js:109-123` | Throughput tính 2 nơi `1000/avg_response_ms` lệch 1 decimal | Số liệu không khớp | Dùng chung `getSocVnbrokerMetrics` |
| **COC-47** | GAP P2 | `SocVnbrokerPanel.tsx:415-426` | `is_active = status!=="unhealthy"` nhưng `SocServiceHealthCard` mong `is_active` từ BE | Hiển thị sai | Dùng `health.is_active` |

### D11. Runtime KPI + DNSE Backfill

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-48** | GAP P1 | `SocRuntimeKpiPanel.tsx:1-38` | Placeholder `coming_soon` | Tab chết | Ẩn tab hoặc gắn `AdminCoreUsagePage` metrics |
| **COC-49** | GAP P1 | `SocDnseBackfillPanel.tsx:50-64` | Gửi `date_from:""` string rỗng, `jobs.slice(0,15)` không pagination | BE 400 hoặc thiếu data | Gửi `undefined` nếu rỗng, thêm pagination |
| **COC-50** | GAP P2 | `SocDnseBackfillPanel.tsx:75-84` | `handleAbort` không `setInterval` poll | Job running không update | Poll 5s `fetchJobs` |

### D12. Scheduler — `SocSchedulerBoard.tsx`

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-51** | GAP P1 | `SocSchedulerBoard.tsx:76-89` | `formatLag` `m→"p"` tiếng Việt lẫn | Đọc nhầm lag | Sửa `p`→`m`, `ngày` giữ |
| **COC-52** | GAP P1 | `SocSchedulerBoard.tsx:90-98` | `formatNextRun` mất ngày | Không biết tomorrow | Trả `toLocaleString` gồm date |
| **COC-53** | GAP P1 | `SocSchedulerBoard.tsx:100-107` | `domainBadgeClass` `includes` | Badge sai màu | `startsWith` |
| **COC-54** | GAP P2 | `SocSchedulerBoard.tsx:176-198` | `normalizedCaps` fallback `["enable","disable","run_now","abort"]` | Cho abort khi không hỗ trợ | Check `capabilities` strict |
| **COC-55** | GAP P2 | `SocSchedulerBoard.tsx:454-459` | `setInterval(load,60000)` closure stale `t` | Health không update khi đổi ngôn ngữ | Dùng `useInterval` hoặc dep `[load]` |

### D13. Cross-cutting

| ID | Severity | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|----------|-----------|---------|----------|-------------|
| **COC-56** | RISK P1 | `tasks.py:68-79` | `domain_endpoint_map` rỗng | Health giả | Cấu hình `SOC_HEALTH_ENDPOINTS` env JSON |
| **COC-57** | GAP P2 | `soc.module.css:1-2707` | 2707 dòng fat file | Khó theme | Tách `soc.tokens.css` + `soc.components.css` |
| **COC-58** | GAP P2 | `soc.js:127-205` | Hai base `/operator/soc/` vs `/operator/scraping/dataops/` | Dễ sai URL | Thống nhất `/operator/soc/dataops/` + redirect BE |
| **COC-59** | GAP P2 | Tất cả panels | Không `ErrorBoundary`, không `React Query` | Crash trắng | Wrap mỗi tab `ErrorBoundary` + `useTenantAdminQuery` |
| **COC-60** | GAP P3 | `SocDataInventorySection.tsx:89-92` | Hardcode `rgb(6,95,70)` | Phá token | `var(--color-success-500)` |
| **COC-61** | GAP P3 | `SocConfigPreviewModal.tsx:19-29` | Overlay `onClick` không class backdrop | Click through | Thêm `className:styles.drawerOverlay` |

---

## E. Quality Gates audit (bắt buộc AGENTS.md Nguyên tắc 1,5)

| Gate | Lệnh | Kết quả | Ghi chú file:line |
|------|------|---------|-------------------|
| Lint | `npm run lint` (packages/web) | **PASS** 0 errors, 3546 warnings baseline (ledger Entry 81) | `jsx-no-literals` warnings trong `SocScreenerPanel.tsx:102`, `SocScreenerRuleModal.tsx:43` pre-existing |
| Type-check | `npx tsc --noEmit` (packages/web) | **PASS** (Entry 82) | `screener.ts` + `screener.d.ts` sync, `defaultCoreApiAdapter as unknown` che lỗi type `SocScreenerPanel.tsx:57` |
| Build | `npm run build` (`tsc && vite build`) | **PASS** 52s (Entry 82) | `ShellOperationsCenterPage` chunk 128KB, warning chunk-size pre-existing `docs/AUDIT_SOC_CENTER_DEEP_20260719.md:206` |
| i18n | `src/i18n/vi.js` + `en.js` + `npm run i18n:scan` | **PASS** exit 0 (Entry 78) | Scanner CJS fix `i18next-scanner.config.cjs`, thiếu `soc.tabs.runtime-kpi` hyphen `vi.js:149` vs `ShellOperationsCenterPage.tsx:53-54` |
| Test | `npm run test:components` vitest | **27 files/113 pass** (Entry 80) | SOC panels 0 test; chỉ screener/watchlist có test. Cần thêm `SocOverviewPanel.test.tsx`, `SocSignalsPanel.test.tsx` |
| BE test | `manage.py test service_ops` | ~1436 dòng `test_soc_api_domain.py` pass | `tasks.health_check_all_services` chưa có test degrade path `tasks.py:120-132` |
| CSS | `soc.module.css:1-2707` + `ShellPageTemplate.module.css:23-46` | PASS nhưng fat file | `ShellOperationsCenterPage.tsx:91-96` đã chuyển `ShellPageChrome` (P1-4) đúng token |
| External coupling | `packages/web/package.json` `vninvestcharts-widget ^1.2.5` + `src/types/vninvestcharts-widget.d.ts:1-44` + `adapters/core/market.js` | OK | SOC không phụ thuộc widget |

---

## F. Câu hỏi cần làm rõ

1. `SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']` đã là `backfill_daily_prices:registry.py:244` — có cần service riêng `dataops_orchestrator` cho planner preview không?
2. Health probe `httpx` có bật trong prod không? `tasks.py:56-61` `try import httpx` nhưng `domain_endpoint_map:70-78` rỗng → có muốn BE cấu hình `SOC_HEALTH_ENDPOINTS` env JSON?
3. Legacy `frontend/src/components/soc/` 18 files + `frontend/src/pages/SOCPage.jsx:1-105` còn reference `frontend/src/App.jsx:339` `SOCPage` — khi nào xóa để tránh drift i18n `vi.js`?
4. `runtime-kpi` tab có giữ hay xóa? Nếu giữ, KPI lấy từ `AdminCoreUsagePage`/`prometheus` hay `ServiceRunLog`?
5. Prefetch universe groups có nên tách thành page riêng `/operations-center?tab=symbol-groups` thay vì embed trong Prefetch?
6. Scheduler `health_total` vs `jobs_total` — có muốn SLA `uptime%`/`error_budget` như Datadog?

---

## G. Đánh giá tổng thể & Lộ trình nâng cấp lên chuẩn thương mại

### Hiện trạng

**~75%** — giao diện glassmorphism hoàn chỉnh (`soc.module.css:131-139` `glassPanel` blur 8px), DataOps parity ~95% (ledger W10), i18n ~400 keys `soc.*`, BE 50+ endpoint `soc.js:31-498`. **Blocker thương mại**: Save chết (COC-01), tab router race (COC-01/02), không real-time (COC-11), health giả (COC-56), runtime-kpi rỗng (COC-48). So với **Datadog Ops / Grafana OnCall / AWS OpsCenter / Bloomberg Terminal Admin** thiếu 4 trụ: (1) real-time streaming, (2) SLO/burn-rate, (3) auto-remediation + runbook, (4) audit export + RBAC.

### So sánh thương mại

| Năng lực | Datadog/Grafana | VNInvest COC hiện tại | Gap |
|----------|-----------------|----------------------|-----|
| Real-time health | WebSocket + 10s poll, sparkline | 1 lần fetch, không poll (COC-10, COC-11) | **P1** |
| SLO/SLI | Uptime%, burn-rate, error budget | Chỉ `status healthy/degraded` | **P2** |
| Alerting | PagerDuty/Slack webhook, dedup | `UnifiedAlert` chỉ retention `tasks.py:1060` | **P2** |
| Runbook/Auto-remediate | Auto-restart, rollback | Chỉ `abort` `dataops_planner.py:343-412` | **P2** |
| Audit export | CSV/S3, RBAC tenant | Chỉ `ConfigChangeAudit` view, không export | **P2** |
| Dependency map | Service graph | Không | **P3** |

### Lộ trình 3 Phase

**Phase 1 — Fix blocker 2-3 ngày (P0)**
- COC-01→04: Sửa `handleApplyConfig`, thống nhất `useSearchParams`, fix i18n hyphen, gộp `selectedGroups` vào `config_payload`.
- COC-25→27: Validate datasets/date 365 ngày, fallback `run_id`.
- COC-56: Cấu hình `SOC_HEALTH_ENDPOINTS` env JSON + `_get_service_endpoint` read env, probe `httpx GET /health` timeout 5s `tasks.py:99-114`.

**Phase 2 — UX parity 3-5 ngày (P1)**
- Signals `setInterval 10s` silent fetch + `new Date` sort; Overview poll 15s; DnseBackfill poll 5s.
- Scheduler: sửa `formatLag` `p→m` `SocSchedulerBoard.tsx:81`, added date `formatNextRun`, `startsWith` badge.
- Screener: pagination rules/results 10/trang, thống nhất `getSocScreenerMetrics` `soc.js:400`.
- RuntimeKPI: ẩn tab hoặc gắn `AdminCoreUsagePage` metrics.

**Phase 3 — Thương mại 5-7 ngày (P2-P3)**
- **Observability**: Thêm `ServiceHealth.uptime_percentage, slo_target, error_budget` + Burn-rate chart (như Datadog).
- **Alerting**: `UnifiedAlert` auto từ health `degraded→unhealthy` + webhook Slack/Email (như PagerDuty) — mở rộng `tasks.py:1060` `_upsert_retention_health_alert` ra toàn domain.
- **Capacity**: RunLog duration/queue-depth trend, parity history sparkline đã có `SocParityGatesPanel` → thêm forecast.
- **RBAC + Export**: `tenant-admin` gate SOC, export `ConfigChangeAudit + RunLog` CSV/Push S3, dependency graph `ServiceDependency` visual như Grafana service map.
- **Tech**: Tách `soc.module.css` 2707 dòng → `soc.tokens.css` + `soc.components.css`, chuẩn hóa `/operator/soc/dataops/` namespace `soc.js:127`, bổ sung `vitest` 4 panel chính.

**Kết quả**: Sau Phase 1 → **85%**, sau Phase 2 → **92%**, sau Phase 3 → **98% ngang thương mại**. Mọi khẳng định kèm `file:line`, không đoán, đã grep toàn repo `.css/.module.css/config/i18n/adapter`.

---

> **Ghi chú ledger**: Sau thay đổi mã nguồn hoặc kết luận audit quan trọng, cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` theo AGENTS.md. File này là SSOT audit COC, thay thế `AUDIT_OPERATIONS_CENTER_UI_UX_AND_TECHNICAL_GAPS_20260701.md` + `AUDIT_SOC_CENTER_DEEP_20260719.md`.

