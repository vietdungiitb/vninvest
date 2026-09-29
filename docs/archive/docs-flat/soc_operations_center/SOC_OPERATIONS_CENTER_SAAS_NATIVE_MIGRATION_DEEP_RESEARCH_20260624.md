# DEEP RESEARCH — SOC Operations Center: Migration từ Legacy sang SaaS Native

**Ngày nghiên cứu**: 2026-06-24  
**Trạng thái**: RESEARCH UPDATED — PENDING APPROVAL  
**Phiên bản**: 1.1  
**Phạm vi**: Rà soát toàn bộ tính năng legacy `/operations-center` (8 tabs, 70+ functions) và xây dựng kế hoạch migration 1:1 + nâng cấp UX sang `packages/web`

---

## 1. Bối cảnh

### 1.1 Vấn đề hiện tại

Trang `/operations-center` trên SaaS native (`packages/web`) hiện chỉ có **1 trang debug shell** (`ShellOperationsCenterPage.tsx` — 956 dòng). Trang này chỉ hiển thị:

- Service cards grid (bật/tắt, health check, JSON config editor)
- Status summary (6 metric boxes)
- Diagnostics tabs (Operator, Flags & Abilities, Routes)

**Thiếu hoàn toàn 8 tabs chức năng** mà legacy frontend (`frontend/src/`) đang cung cấp đầy đủ cho operator.

### 1.2 Legacy codebase đang vận hành

| File | Dòng code | Vai trò |
|------|-----------|---------|
| `frontend/src/pages/SOCPage.jsx` | 106 | Page wrapper + tab routing |
| `frontend/src/components/soc/SOCDomainTabs.jsx` | 48 | Tab navigation (8 tabs) |
| `frontend/src/components/soc/OverviewPanel.jsx` | 87 | Service health overview |
| `frontend/src/components/soc/SignalsPanel.jsx` | 151 | Signal intelligence (read-only) |
| `frontend/src/components/soc/DataOpsPanel.jsx` | 2,777 | DataOps master (5 sub-tabs) ⭐ |
| `frontend/src/components/soc/PrefetchPanel.jsx` | 390 | Prefetch config + universe groups |
| `frontend/src/components/soc/ScreenerPanel.jsx` | 477 | Screener config + rule CRUD |
| `frontend/src/components/soc/VnbrokerPanel.jsx` | 828 | VNBroker config + benchmark |
| `frontend/src/components/soc/RuntimeKPIPanel.jsx` | 27 | Placeholder (Coming Soon) |
| `frontend/src/components/soc/DNSEBackfillPanel.jsx` | 425 | DNSE intraday tick backfill |
| `frontend/src/components/soc/SchedulerBoard.jsx` | 522 | Shared scheduler job board |
| `frontend/src/components/soc/ConfigPreviewModal.jsx` | ~140 | Before/after config diff modal |
| `frontend/src/components/soc/ServiceHealthCard.jsx` | 105 | Individual service health card |
| `frontend/src/components/soc/WriteGuardBanner.jsx` | ~40 | Read-only warning banner |
| `frontend/src/components/soc/OwnershipBadgeRow.jsx` | ~70 | Domain ownership display |
| `frontend/src/components/soc/MatrixScrapeMonitor.jsx` | ~200 | Matrix cycle status monitor |
| `frontend/src/components/soc/BackfillProgressPanel.jsx` | ~400 | Backfill run tracker |
| **Tổng** | **~5,800+** | |

### 1.3 SaaS native API adapter đã sẵn sàng

File `packages/web/src/adapters/core/soc.js` đã có sẵn **50+ methods** cho SOC operations, bao gồm:

- Service CRUD: `getSocOverviewSummary`, `getSocServiceList`, `updateSocService`, `triggerSocServiceHealthCheck`, `applySocServiceConfig`, `resetSocServiceConfig`
- VNBroker: `getSocVnbrokerConfig`, `applySocVnbrokerConfig`, `getSocVnbrokerHealth`, `getSocVnbrokerProviders`, `getSocVnbrokerBenchmarkLatest`
- DataOps: `getSocDataOpsQueueTiers`, `getSocDataOpsCoverage`, `getSocDataOpsObservability`, `getSocDataOpsRunLogs`, `getSocDataOpsRuntimeConfig`, `applySocDataOpsRuntimeConfig`, `getSocDataOpsInventory` (Lưu ý: `soc.js` đã có các methods này, đầy đủ cho DataOps panel mà không cần thêm `getSocDataOpsOverview` làm mới)
- Prefetch: `getSocPrefetchConfig`, `applySocPrefetchConfig`, `getSocPrefetchCacheStatus`, `getSocPrefetchUniverseGroups`
- Signals: `getSocSignalConfig`, `getSocSignalOwnership`, `getSocWhaleDetection`, `getSocDarkPoolDetection`, `getSocSignalMetrics`
- Screener: `getSocScreenerConfig`, `applySocScreenerConfig`, `getSocScreenerRules`, `createSocScreenerRule`, `updateSocScreenerRule`, `deleteSocScreenerRule`
- Scheduler: `getSocSchedulerPlan`, `getSocSchedulerHealth`, `getSocSchedulerJobHistory`
- DNSE Backfill: các method liên quan

> [!WARNING]
> **CẦN BỔ SUNG BACKEND ROUTING CHO BACKFILL RUNS**
> Mặc dù adapter layer phía frontend đã khai báo các methods, nhưng endpoint backend `/operator/soc/dataops/backfill/runs/` được gọi bởi `getSocBackfillRuns()` hiện **chưa tồn tại** trong `service_ops/urls.py` (chỉ mới có ở `operator_urls.py` dưới path `/operator/scraping/dataops/backfill/runs/`). Do đó, cần bổ sung backend routing/mapping tương ứng trước khi tính năng backfill ở frontend hoạt động bình thường.
>
> **URL Routing Update**: Backend đã được thêm cấu hình `path('soc/', include('service_ops.urls'))` vào `operator/urls.py` giúp sửa lỗi 404 cho `/operator/soc/overview/`. Tuy nhiên, các routing cụ thể cho backfill runs và DNSE backfill vẫn cần hoàn thiện.

---

## 2. Kiểm Kê Chi Tiết Toàn Bộ Tính Năng Legacy

### 2.1 Tab 1: Overview

**Source**: `OverviewPanel.jsx` (87 dòng)

| # | Function | Mô tả | API call legacy |
|---|----------|-------|-----------------|
| 1 | Service health summary | Grid 5 metric cards: total / healthy / degraded / unhealthy / unknown | `socApi.getOverviewSummary()` |
| 2 | Service health grid | Grid cards cho từng service — status badge, latency, last check time | Reuse data từ #1 |
| 3 | Configuration section | Placeholder "detailed config view" (chưa implement xong) | — |

**Đánh giá**: SaaS shell hiện tại đã có service grid tương đương (có toggle on/off, health check, JSON editor). Cần bổ sung health status aggregation summary.

---

### 2.2 Tab 2: Signals

**Source**: `SignalsPanel.jsx` (151 dòng)

| # | Function | Mô tả | API call legacy |
|---|----------|-------|-----------------|
| 1 | WriteGuardBanner | Banner cảnh báo panel này là read-only, hiển thị owner/writer info | `socApi.getSignalOwnership()` |
| 2 | Signal config viewer | JSON pre-formatted hiển thị cấu hình signal detection hiện tại (read-only) | `socApi.getSignalConfig()` |
| 3 | Whale detection params | Hiển thị min_volume, enabled status cho whale detection | `socApi.getWhaleDetection()` |
| 4 | Dark pool detection | Hiển thị min_signal_count, enabled status cho dark pool | `socApi.getDarkPoolDetection()` |
| 5 | Signal metrics | 3 metric cards: detection_rate (%), false_positive_rate (%), avg_signal_latency_ms | `socApi.getSignalMetrics()` |
| 6 | Ownership badge | Hiển thị domain ownership info (team, surface) | Reuse data từ #1 |

**Đặc điểm**: Toàn bộ panel là **read-only** (bridge-write domain). Operator chỉ xem, không chỉnh trực tiếp.

---

### 2.3 Tab 3: DataOps ⭐ (Component lớn nhất)

**Source**: `DataOpsPanel.jsx` (2,777 dòng)

**Cấu trúc nội bộ**: 5 sub-tabs

```
📦 Kho dữ liệu  |  ⚡ Điều phối  |  🔍 Giám sát  |  ⏱ Lịch chạy  |  ⚙️ Cấu hình
```

#### 2.3.1 Sub-tab: 📦 Kho dữ liệu (Data Inventory)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 1 | Summary cards | 4 cards: total_rows, total_symbols, earliest_date, latest_date | `socApi.getDataOpsInventory()` |
| 2 | Year distribution bar chart | Horizontal bars cho phân bổ DailyPrice theo năm (rows + symbols/năm) | Reuse #1 |
| 3 | Coverage by group table | Bảng: nhóm → bản ghi, mã có data, ngày đầu, ngày cuối, ngày lịch. Highlight partial/full coverage | Reuse #1 |
| 4 | Data types grid | Grid cards cho từng loại dữ liệu (label, row count, date range) | Reuse #1 |

#### 2.3.2 Sub-tab: ⚡ Điều phối (Operations)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 5 | Backfill form | 8 dataset types selectable:<br>• `daily_prices` (✓ planner)<br>• `price_board_snapshot` (✓ planner)<br>• `intraday_bars` (✓ planner)<br>• `intraday_ticks` (✓ planner)<br>• `session_facts` (✓ planner)<br>• `whale_events` (✗ planner)<br>• `order_flow` (✗ planner)<br>• `dark_flow` (✗ planner) | `socApi.runDataOpsPlanner()` |
| 6 | Symbol group selector | Radio buttons: VN30, VN50, VN100, HOSE, HNX, UPCOM, all, custom (free text input) | — (form state) |
| 7 | Mode + dry_run | Mode: `missing_only` / `full`. Dry run toggle. Execution mode: `async` / `sync` | — (form state) |
| 8 | Planner preview | Paginated preview (12 items/page) trước khi chạy thật | `socApi.previewDataOpsPlanner()` |
| 9 | Active run monitor + abort | Hiển thị tiến trình run đang chạy, nút abort | `socApi.abortDataOpsPlannerRun()` |
| 10 | BackfillProgressPanel | Component riêng: run detail view + run list filtered by status | `socApi.getBackfillRunDetail()`, `socApi.getBackfillRuns()` |

#### 2.3.3 Sub-tab: 🔍 Giám sát (Monitor)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 11 | Coverage gaps table | Bảng paginated (20 items/page): hiển thị symbols thiếu dữ liệu | `socApi.getDataOpsCoverage()` |
| 12 | Queue tiers dashboard | Hiển thị queue tier structure và trạng thái | `socApi.getDataOpsQueueTiers()` |
| 13 | Observability metrics | Throughput, latency, error rate từ observability subsystem | `socApi.getDataOpsObservability()` |
| 14 | Matrix scrape monitor | Component `MatrixScrapeMonitor`: cycle status, providers, symbol groups | `socApi.getMatrixMonitor()` |
| 15 | Matrix cycle control | Start/abort matrix scrape cycle | `socApi.startMatrixCycle()`, `socApi.abortMatrixCycle()` |
| 16 | Matrix providers | Danh sách providers đang tham gia matrix scrape | `socApi.getMatrixProviders()` |

#### 2.3.4 Sub-tab: ⏱ Lịch chạy (Scheduler)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 17 | SchedulerBoard | Component reusable: hiển thị tất cả scheduled jobs với status badges, freshness indicators, lag formatting | `socApi.getSchedulerPlan()`, `socApi.getSchedulerHealth()` |
| 18 | Job history | Xem lịch sử chạy per job (paginated) | `socApi.getSchedulerJobHistory()` |
| 19 | Job actions | 4 actions: enable / disable / trigger / abort. Có confirm modal cho risky actions (disable, abort) | `socApi.triggerSchedulerAction()` |
| 20 | Confirm modal | Modal yêu cầu nhập reason trước khi disable/abort job | — (UI component) |

#### 2.3.5 Sub-tab: ⚙️ Cấu hình (Config)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 21 | Runtime config editor | JSON textarea cho runtime DataOps config | `socApi.getDataOpsRuntimeConfig()` |
| 22 | Config preview & apply | Preview changes trước khi apply. Validation errors hiển thị inline | `socApi.previewDataOpsRuntimeConfig()`, `socApi.applyDataOpsRuntimeConfig()` |
| 23 | Config audit trail | Paginated table hiển thị lịch sử thay đổi config (who/when/what) | `socApi.getDataOpsRuntimeConfigAudit()` |
| 24 | Run logs viewer | Paginated run logs + purge (keep N records) | `socApi.getDataOpsRunLogs()`, `socApi.purgeDataOpsRunLogs()` |
| 25 | Symbol group management | CRUD custom symbol groups (create name + symbols, delete by slug) | `socApi.createSymbolGroup()`, `socApi.deleteSymbolGroup()`, `socApi.getSymbolGroups()` |

---

### 2.4 Tab 4: Prefetch

**Source**: `PrefetchPanel.jsx` (390 dòng)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 1 | Universe groups multi-select | Checkbox grid cho tất cả universe groups. Mỗi group hiển thị:<br>• Tên + badges (registry_tier, hint_only, custom)<br>• Coverage bar (covered/total symbols)<br>• Data status dot (green/gray)<br>• Latest update date | `socApi.getPrefetchUniverseGroups()` |
| 2 | Config form | 11 number fields:<br>• `batch_size`, `symbol_limit`, `max_retries`<br>• `retry_base_delay_seconds`, `retry_max_delay_seconds`<br>• `rate_limit_cooldown_seconds`<br>• `circuit_breaker_window_seconds`, `circuit_breaker_failure_threshold`, `circuit_breaker_cooldown_seconds`<br>• `cache_ttl_seconds`, `close_history_days` | `socApi.getPrefetchConfig()` |
| 3 | Time profile form | 6 interval fields (seconds):<br>• `pre_open`, `market_open`, `lunch_break`<br>• `pre_close`, `post_close`, `offhours` | Reuse #2 |
| 4 | Cache status display | 3 metrics: hit_rate (%), size_mb, ttl_minutes | `socApi.getPrefetchCacheStatus()` |
| 5 | Change preview modal | Before/after diff + validation errors. Uses `ConfigPreviewModal` component | — |
| 6 | Apply config | Submit draft changes (bao gồm cả universe_group_ids đã chọn) | `socApi.applyPrefetchConfig()` |
| 7 | Warm now | 2 modes: async / sync. Hiển thị result message | `socApi.warmPrefetchNow()` |
| 8 | Purge cache | Xóa toàn bộ prefetch cache | `socApi.purgePrefetchCache()` |
| 9 | Scheduler section | Collapsible section chứa `SchedulerBoard` filtered by `domain="prefetch"` | Reuse SchedulerBoard |

---

### 2.5 Tab 5: Screener

**Source**: `ScreenerPanel.jsx` (477 dòng)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 1 | Config form | 5 number fields:<br>• `scan_interval_seconds`, `max_symbols_per_scan`<br>• `alert_cooldown_seconds`, `max_alerts_per_symbol_per_hour`<br>• `result_retention_hours` | `socApi.getScreenerConfig()` |
| 2 | Config preview & apply | Preview changes + confirm apply | `socApi.applyScreenerConfig()` |
| 3 | Rule CRUD table | Paginated table (10/page): name, type, enabled status, actions (edit/delete) | `socApi.getScreenerRules()` |
| 4 | Create rule modal | Form: name (text), type (select from 9 types), value (JSON textarea), enabled (checkbox) | `socApi.createScreenerRule()` |
| 5 | Edit rule modal | Same form as create, pre-filled with existing values | `socApi.updateScreenerRule()` |
| 6 | Delete rule | Confirm dialog trước khi xóa | `socApi.deleteScreenerRule()` |
| 7 | Manual scan trigger | Text input cho symbols (comma/space separated) → trigger scan | `socApi.manualScan()` |
| 8 | Recent results table | Table: symbol, rule_name, timestamp | `socApi.getScreenerResults()` |
| 9 | Alerts feed | Cards: symbol + message cho mỗi alert | `socApi.getScreenerAlerts()` |
| 10 | Metrics | 2 metrics: avg_scan_duration_ms, rules_hit_rate (%) | `socApi.getScreenerMetrics()` |

**9 rule types hỗ trợ**: `price_change_pct`, `volume_spike_ratio`, `cvd_threshold`, `whale_count`, `dark_pool_ratio`, `rsi_level`, `ma_cross`, `bollinger_band_break`, `custom`

---

### 2.6 Tab 6: VNBroker

**Source**: `VnbrokerPanel.jsx` (828 dòng)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 1 | Core config form | 6 fields: `preferred_provider` (select), `max_retries`, `retry_delay_seconds`, `requests_per_minute`, `burst_limit`, `circuit_breaker_threshold` | `socApi.getVnbrokerConfig()` |
| 2 | Timeout section | 4 fields: `connect`, `read`, `write`, `pool` (seconds, step 0.5) | Reuse #1 |
| 3 | Per-provider config | Expandable accordion cho mỗi provider (vci, kbs, dnse).<br>Mỗi provider có overrides cho: timeout (4 fields), retry (2 fields), rate limit (2 fields).<br>Badge "Được tùy chỉnh" khi có override. Button "Clear override" | Reuse #1 |
| 4 | Provider status grid | Grid cards: provider name, configured status (green/gray) | `socApi.getVnbrokerProviders()` |
| 5 | DNSE credential check | Kiểm tra xem DNSE credentials đã configured chưa | Legacy `getDNSEConfig()` |
| 6 | Health metrics | 3 metrics: healthy/degraded/critical provider count | `socApi.getVnbrokerHealth()` |
| 7 | Throughput metrics | 2 metrics: throughput, error_rate (%) | `socApi.getVnbrokerMetrics()` |
| 8 | Benchmark tool | Select provider → Run benchmark (30s duration) → Results table (provider, latency, RPM, success%, rate_limited%) | `socApi.runVnbrokerBenchmark()` |
| 9 | Latest benchmark | Load benchmark report gần nhất nếu có | `socApi.getVnbrokerBenchmarkLatest()` |
| 10 | Auto-optimization | Client-side algorithm `buildOptimizedConfigFromBenchmark()`:<br>• Tính timeout từ latency × safety factor<br>• Tính max_retries từ error rate<br>• Tính retry_delay từ latency<br>• Tính rate limit từ RPM × safety factor<br>• Generate per-provider config từ benchmark results | — (client logic) |
| 11 | Optimized preview & save | Preview optimized config → confirm → apply. Badge "Sẵn sàng tối ưu" | `socApi.previewVnbrokerConfig()`, `socApi.applyVnbrokerConfig()` |
| 12 | Manual config preview & apply | Standard before/after diff modal cho manual edits | Same as #11 |
| 13 | Reset to defaults | Confirm dialog → apply empty config `{}` | `socApi.applyVnbrokerConfig({})` |
| 14 | Raw benchmark JSON | Collapsible pre block hiển thị raw benchmark report | — |

---

### 2.7 Tab 7: Runtime KPI

**Source**: `RuntimeKPIPanel.jsx` (27 dòng)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 1 | Placeholder | Chỉ hiển thị "Coming Soon" text | — |

**Đánh giá**: Chỉ là placeholder. Cần quyết định có nâng cấp thành telemetry dashboard thật hay giữ placeholder.

---

### 2.8 Tab 8: DNSE Backfill

**Source**: `DNSEBackfillPanel.jsx` (425 dòng)

**2 sections chính: System backfill + User backfill**

#### System Backfill (admin-only)

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 1 | Dataset checkboxes | 3 datasets:<br>• `tape_intraday` (✓ supported)<br>• `session_facts` (✗ coming soon)<br>• `candle_intraday` (✗ coming soon) | — |
| 2 | Symbol group radios | 8 options: vn30, vn50, vn100, hose, hnx, upcom, all, custom (text input) | — |
| 3 | Date range | From date + To date pickers | — |
| 4 | Mode + dry run | Mode: `missing_only` / `full`. Dry run toggle | — |
| 5 | Validation | Dataset required, date range valid, custom symbol required if selected | — |
| 6 | Submit | Gửi system backfill request | Legacy `triggerSystemBackfill()` |

#### User Backfill

| # | Function | Mô tả | API call |
|---|----------|-------|----------|
| 7 | User backfill form | Single symbol (text) + trade date (date picker) | Legacy `triggerUserBackfill()` |
| 8 | Result display | JSON formatted result display | — |

**⚠️ Lưu ý**: DNSE Backfill hiện dùng legacy `client.js` functions (`triggerSystemBackfill`, `triggerUserBackfill`). Cần kiểm tra xem core-api adapter đã có endpoint tương ứng chưa.

---

### 2.9 Shared Components cần port

| Component | Source file | Dòng | Functions |
|-----------|------------|------|-----------|
| `ConfigPreviewModal` | `ConfigPreviewModal.jsx` | ~140 | Before/after JSON diff, validation errors display, change summary list, confirm/cancel buttons |
| `SchedulerBoard` | `SchedulerBoard.jsx` | ~522 | Job list with status badges (running/enabled/idle/disabled/degraded/stale), freshness indicators, lag formatting, 4 actions (enable/disable/trigger/abort), confirm modal with reason input, auto-refresh polling, domain filtering |
| `WriteGuardBanner` | `WriteGuardBanner.jsx` | ~40 | Amber warning banner: "Read-only" + owner info + write surface link |
| `OwnershipBadgeRow` | `OwnershipBadgeRow.jsx` | ~70 | Domain ownership display: owner team, writer, access level badges |
| `ServiceHealthCard` | `ServiceHealthCard.jsx` | ~105 | Individual card: service name, key, domain, status badge (5 colors), latency, last check time |
| `MatrixScrapeMonitor` | `MatrixScrapeMonitor.jsx` | ~200 | Matrix cycle status: cycle_id, provider progress, symbol group breakdown, live polling |
| `BackfillProgressPanel` | `BackfillProgressPanel.jsx` | ~400 | Backfill tracking: run list filtered by status, individual run detail with symbol-level progress |

---

## 3. Trạng Thái Hiện Tại SaaS Native

### 3.1 Đã có (ShellOperationsCenterPage.tsx — 956 dòng)

- ✅ Service grid với toggle on/off, health check trigger
- ✅ JSON config editor per service (textarea + reason + save/reset/cancel)
- ✅ Status summary boxes (6 items: total, healthy, degraded, unhealthy, unknown, inactive)
- ✅ Search bar (tìm theo tên, key, domain, description)
- ✅ Filter buttons (all, healthy, degraded, unhealthy, inactive)
- ✅ Pagination cho service list (9 items/page)
- ✅ Diagnostics panel với 3 tabs:
  - Operator: session info, runtime snapshot, build metadata, SMTP link
  - Flags & Abilities: surface flags, operator abilities
  - Routes: visible groups, operator routes
- ✅ Core shell integration (useCoreShellPageSnapshot, buildSurfaceFlags, etc.)

### 3.2 Thiếu hoàn toàn

- ❌ **Tab navigation system** (8 tabs)
- ❌ **Overview panel** (health aggregation summary)
- ❌ **Signals panel** (read-only signal intelligence, whale/dark-pool params)
- ❌ **DataOps panel** (5 sub-tabs: inventory, operations, monitor, scheduler, config)
- ❌ **Prefetch panel** (config forms, universe groups multi-select, cache, warm/purge)
- ❌ **Screener panel** (config, rule CRUD, manual scan, results, alerts, metrics)
- ❌ **VNBroker panel** (structured forms, per-provider config, benchmark, auto-optimize)
- ❌ **Runtime KPI panel** (telemetry — chưa có cả trên legacy)
- ❌ **DNSE Backfill panel** (system + user backfill forms)
- ❌ **Tất cả shared components** (ConfigPreviewModal, SchedulerBoard, WriteGuardBanner, etc.)

---

## 4. Kế Hoạch Migration

### 4.1 Kiến trúc mục tiêu

```
packages/web/src/
├── pages/admin/
│   └── ShellOperationsCenterPage.tsx     ← [MODIFY] Thêm tab system + import panels
│
├── components/soc/                        ← [NEW] Folder mới cho SOC components
│   ├── SocTabNavigation.tsx               ← Tab bar (8 tabs + URL sync)
│   │
│   ├── SocOverviewPanel.tsx               ← Tab 1: Service health + summary
│   ├── SocSignalsPanel.tsx                ← Tab 2: Read-only signal intelligence
│   ├── SocDataOpsPanel.tsx                ← Tab 3: Master panel (5 sub-tabs)
│   │   ├── SocDataInventorySection.tsx    ← Sub: Kho dữ liệu
│   │   ├── SocDataOpsBackfillForm.tsx     ← Sub: Điều phối + backfill
│   │   ├── SocDataOpsMonitorSection.tsx   ← Sub: Giám sát + matrix
│   │   └── SocDataOpsConfigSection.tsx    ← Sub: Cấu hình + audit
│   ├── SocPrefetchPanel.tsx               ← Tab 4: Prefetch config + universe
│   ├── SocScreenerPanel.tsx               ← Tab 5: Config + Rule CRUD + scan
│   ├── SocVnbrokerPanel.tsx               ← Tab 6: VNBroker + benchmark
│   ├── SocRuntimeKpiPanel.tsx             ← Tab 7: Runtime telemetry
│   ├── SocDnseBackfillPanel.tsx           ← Tab 8: DNSE backfill forms
│   │
│   ├── SocConfigPreviewModal.tsx          ← Shared: diff modal
│   ├── SocSchedulerBoard.tsx              ← Shared: scheduler job board
│   ├── SocWriteGuardBanner.tsx            ← Shared: read-only warning
│   ├── SocServiceHealthCard.tsx           ← Shared: health card
│   ├── SocOwnershipBadge.tsx              ← Shared: ownership display
│   ├── SocMatrixScrapeMonitor.tsx         ← Shared: matrix cycle monitor
│   ├── SocBackfillProgressPanel.tsx       ← Shared: backfill run tracker
│   └── soc.module.css                     ← Scoped styles
│
├── adapters/core/
│   └── soc.js                             ← [MODIFY] Xác minh/bổ sung DNSE backfill endpoints
│
└── i18n/locales/vi/
    └── soc.json                           ← [NEW] Merge bản dịch trực tiếp vào từng phase tương ứng
```

### 4.2 Phân pha thực hiện

#### Phase 1 — Foundation & Navigation (4-5h)

| Task | File | Mô tả |
|------|------|-------|
| P1.1 | `ShellOperationsCenterPage.tsx` [MODIFY] | Refactor layout: thêm tab system, giữ service grid + diagnostics trong tab "Overview" hoặc tab ẩn |
| P1.2 | `SocTabNavigation.tsx` [NEW] | 8 tabs, URL sync qua `?tab=xxx`, responsive, active indicator animation |
| P1.3 | `soc.module.css` [NEW] | Design tokens, premium dark theme, micro-animations, typography hierarchy |
| P1.4 | `soc.json` [NEW/MODIFY] | Thêm bản dịch tiếng Việt cho phần khung sườn và navigation |

#### Phase 2 — Core Panels & i18n (12-16h)

| Task | File | Mô tả |
|------|------|-------|
| P2.1 | `SocOverviewPanel.tsx` [NEW] | Port health summary + service grid. Upgrade: animated counters, pulse dots. Kèm i18n tương ứng |
| P2.2 | `SocSignalsPanel.tsx` [NEW] | Port 1:1 read-only signals view. Upgrade: metric cards với trend indicators. Kèm i18n tương ứng |
| P2.3 | `SocPrefetchPanel.tsx` [NEW] | Port universe groups, config form, profiles, cache, warm/purge, scheduler. Kèm i18n tương ứng |
| P2.4 | `SocScreenerPanel.tsx` [NEW] | Port config, rule CRUD (modal), manual scan, results, alerts, metrics. Kèm i18n tương ứng |
| P2.5 | `SocVnbrokerPanel.tsx` [NEW] | Port core config, per-provider, benchmark, auto-optimization, reset. Kèm i18n tương ứng |

#### Phase 3 — DataOps Master Panel & i18n (8-10h) ⭐ Critical Path

| Task | File | Mô tả |
|------|------|-------|
| P3.1 | `SocDataOpsPanel.tsx` [NEW] | Master panel với 5 sub-tabs. Kèm i18n tương ứng |
| P3.2 | `SocDataInventorySection.tsx` [NEW] | Summary, year distribution, coverage table, data types |
| P3.3 | `SocDataOpsBackfillForm.tsx` [NEW] | 8 datasets, symbol groups, planner preview, run monitor |
| P3.4 | `SocDataOpsMonitorSection.tsx` [NEW] | Coverage gaps, queue tiers, observability, matrix |
| P3.5 | `SocDataOpsConfigSection.tsx` [NEW] | Config editor, preview/apply, audit, run logs, symbol groups |

#### Phase 4 — Telemetry, DNSE & Shared (6-8h)

| Task | File | Mô tả |
|------|------|-------|
| P4.1 | `SocRuntimeKpiPanel.tsx` [NEW] | Upgrade từ placeholder → telemetry dashboard (hoặc giữ placeholder). Kèm i18n |
| P4.2 | `SocDnseBackfillPanel.tsx` [NEW] | Port system + user backfill. Migrate API calls. Kèm i18n |
| P4.3 | Shared components (7 files) [NEW] | ConfigPreviewModal, SchedulerBoard, WriteGuardBanner, ServiceHealthCard, OwnershipBadge, MatrixScrapeMonitor, BackfillProgressPanel |

#### Phase 5 — API Routing & Final Polish (2-3h)

| Task | File | Mô tả |
|------|------|-------|
| P5.1 | `soc.js` [MODIFY] | Add missing DNSE backfill methods, verify all 50+ methods |
| P5.2 | Django Backend [MODIFY] | Bổ sung routing backend thiếu cho backfill runs và kiểm thử tích hợp |

### 4.3 Tổng thời gian ước tính

| Phase | Thời gian | Mô tả |
|-------|-----------|-------|
| Phase 1 | 4-5h | Foundation: tab system, CSS, page refactor + navigation i18n |
| Phase 2 | 12-16h | 5 core panels (Overview, Signals, Prefetch, Screener, VNBroker) + panel i18n |
| Phase 3 | 8-10h | DataOps master panel (5 sub-tabs) + DataOps i18n |
| Phase 4 | 6-8h | Telemetry, DNSE Backfill, 7 shared components + i18n |
| Phase 5 | 2-3h | API routing fix & backend work + final polish |
| **Tổng** | **32-42h** | |

---

## 5. Nâng Cấp UX So Với Legacy

### 5.1 Cải thiện chung (áp dụng toàn bộ)

| Hạng mục | Legacy | SaaS Native (đề xuất) |
|----------|--------|----------------------|
| Styling | Tailwind classes inline (inconsistent) | CSS modules, design tokens, glassmorphism panels |
| Animations | Không có | Tab switch transitions, card hover effects, loading skeletons |
| Typography | Browser defaults + Tailwind | Consistent hierarchy, monospace cho numbers/codes |
| Error handling | `alert()` popup | Toast notifications, inline error banners |
| Responsive | Basic Tailwind responsive | CSS grid auto-fit, mobile-first collapsible sections |
| Loading states | Simple text "Đang tải..." | Skeleton placeholders, shimmer effects |
| JSON editing | Plain textarea | Syntax-highlighted editor (Monaco-style hoặc highlighted pre) |

### 5.2 Nâng cấp per component

| Component | Legacy | Đề xuất upgrade |
|-----------|--------|-----------------|
| Overview | Static cards | Animated counters, status donut chart, real-time pulse dots |
| Signals | Plain JSON dump | Formatted config viewer, metric cards với trend arrows |
| DataOps | Monolithic 2,777-line file | Tách 5 sub-components, wizard flow cho backfill |
| Prefetch | Flat checkbox list | Interactive group cards với coverage progress bars |
| Screener | Basic table | Rule type icons, inline enabled/disabled toggle |
| VNBroker | Accordion + plain table | Benchmark sparkline charts, optimization confidence indicator |
| Runtime KPI | Placeholder only | Real telemetry dashboard (nếu được approve) |
| DNSE Backfill | Basic forms | Progress tracking, result history table |

---

## 6. Điểm Cần Quyết Định

### 6.1 Scope approach

- **Option A (Khuyến nghị)**: Port 1:1 + UX upgrade trong cùng một pass. Tổng: 33-43h.
- **Option B**: Port 1:1 trước (functional parity), UX upgrade sau. Tổng: 25-30h parity + 8-13h polish.

### 6.2 Runtime KPI Panel

Legacy chỉ có placeholder "Coming Soon". Hai hướng:
- **Giữ placeholder**: Port nguyên trạng, chờ backend telemetry API.
- **Build mới**: Thiết kế telemetry dashboard (response time histogram, throughput gauges, error rate trends). Cần backend endpoint.

### 6.3 DNSE Backfill API

Legacy dùng `triggerSystemBackfill()` và `triggerUserBackfill()` từ `client.js` (gọi trực tiếp legacy Django backend). Cần xác nhận:
- Core-api (`packages/core`) đã có endpoint DNSE backfill tương ứng?
- Hay cần thêm backend work trước khi port frontend?

### 6.4 Shell debug view

Giữ lại diagnostics panel hiện tại (Operator, Flags, Routes) ở đâu?
- **Option A**: Tab ẩn "Debug" / "Advanced" (chỉ visible cho superuser)
- **Option B**: Tích hợp vào Overview panel
- **Option C**: Loại bỏ hoàn toàn

### 6.5 Default tab

Khi vào `/operations-center`:
- **Option A**: Mặc định "Overview" (như legacy)
- **Option B**: Giữ shell debug view hiện tại
- **Option C (Đã quyết định)**: Tự động ghi nhớ và chọn tab cuối cùng đã xem thông qua `localStorage`, với giá trị mặc định fallback về trang debug shell hiện tại để đảm bảo operator không mất đi khả năng debug nhanh.

### 6.6 DataOps tách component

Component legacy `DataOpsPanel.jsx` có 2,777 dòng. Đề xuất tách thành 5 sub-components. Cần xác nhận approach.

### 6.7 Benchmark auto-optimization

Logic `buildOptimizedConfigFromBenchmark()` trong VnbrokerPanel tính toán:
- Timeout = latency × safety factor (1.5-2.0x)
- Max retries dựa trên error rate thresholds
- Rate limit = observed RPM × safety factor (0.8-0.9x)

Giữ nguyên logic hay muốn điều chỉnh thuật toán?

---

## 7. Verification Plan

### 7.1 Automated

Cần lưu ý kiểm tra package manager của `packages/web` (hiện tại thư mục chứa `package-lock.json` nên sử dụng `npm` làm mặc định, tuy nhiên dự án có thể cấu hình workspace monorepo với `pnpm`).

```bash
# Sử dụng NPM (mặc định theo package-lock.json hiện tại):
cd packages/web
npm run build
npx tsc --noEmit
npm test -- --testPathPattern="soc"

# Nếu chạy với PNPM (kiểm tra môi trường CI/CD trước khi chạy):
pnpm --filter web build
pnpm --filter web typecheck
pnpm --filter web test -- --testPathPattern="soc"
```

### 7.2 Manual Parity Checklist

- [ ] 8/8 tabs accessible và functional
- [ ] Tất cả API calls route qua core adapter (không còn dùng legacy client.js)
- [ ] Config apply hoạt động (Prefetch, Screener, VNBroker, DataOps)
- [ ] Rule CRUD hoạt động (Screener: create, edit, delete)
- [ ] Backfill form submit hoạt động (DataOps + DNSE)
- [ ] Benchmark tool hoạt động (VNBroker: run, view results, apply optimized)
- [ ] Pagination hoạt động trên tất cả tables
- [ ] ConfigPreviewModal hiển thị diff đúng
- [ ] WriteGuardBanner hiển thị cho read-only domains (Signals)
- [ ] SchedulerBoard hiển thị jobs per domain filter
- [ ] Search + filter hoạt động trên service grid
- [ ] Toggle on/off service hoạt động
- [ ] Health check trigger hoạt động
- [ ] i18n keys tất cả resolve (không missing translations)
- [ ] URL tab sync: reload page giữ nguyên active tab
- [ ] Responsive: mobile, tablet, desktop

---

## 8. Quản Trị Rủi Ro (Risk Mitigation Plan)

### 8.1 Rủi ro thiếu hụt API backend và routing
- **Vấn đề**: Backend chưa có đủ các endpoints cho DNSE Backfill và `/operator/soc/dataops/backfill/runs/` dẫn đến lỗi 404/500 khi gọi từ frontend SaaS.
- **Biện pháp**: Yêu cầu phối hợp đồng bộ/thực hiện backend routing task (mapping sang `operator_urls.py`) trước khi release Phase 4.

### 8.2 Rủi ro phình to file `ShellOperationsCenterPage.tsx`
- **Vấn đề**: File hiện tại đã dài 956 dòng, nếu tiếp tục nhét cả 8 panels và logic phụ trợ vào sẽ vượt ngưỡng 2,000+ dòng, khó maintain và tăng khả năng xung đột code.
- **Biện pháp**: Tách nhỏ ngay từ đầu. `ShellOperationsCenterPage.tsx` đóng vai trò là một container/layout điều hướng gọn nhẹ. Tất cả các tab (Overview, Signals, DataOps, Prefetch, Screener, VNBroker, Telemetry, DNSE) và các components dùng chung phải nằm trong các file riêng thuộc thư mục `components/soc/`.

### 8.3 Rủi ro phức tạp luồng dữ liệu (Data Flow) trong DataOps Master Panel
- **Vấn đề**: `DataOpsPanel.jsx` (2,777 dòng) có tới 5 sub-tabs tương tác chéo dữ liệu với nhau (ví dụ: kích hoạt backfill ở Operations cần refresh danh sách runs ở Monitor, thay đổi Config cần cập nhật trạng thái ở Inventory).
- **Biện pháp**: 
  - Tách thành 5 sub-components chức năng riêng biệt.
  - Sử dụng một React Context dùng chung hoặc State lifter tại `SocDataOpsPanel.tsx` để quản lý trạng thái đồng bộ (như danh sách runs hiện tại, các triggers tải lại dữ liệu).
  - Định nghĩa rõ ràng API payload schemas và callback handlers.

---

## 9. Tài liệu liên quan

- `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_HANDOFF_MASTER_20260516.md` — Handoff master cho SOC UI upgrade ban đầu
- `docs/TECH_SPEC_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md` — Tech spec kỹ thuật
- `docs/IMPLEMENTATION_PLAN_SOC_CONFIG_UI_20260516.md` — Implementation plan (5 slices)
- `docs/TASKBOARD_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md` — Atomic task list
- `quality/QUALITY.md` — Quality constitution tổng thể
