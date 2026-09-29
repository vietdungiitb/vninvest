# CODE PLAN — SOC Operations Center: Migration Legacy sang SaaS Native

**Phiên bản**: 1.0  
**Dựa trên**: `SOC_OPERATIONS_CENTER_SAAS_NATIVE_MIGRATION_DEEP_RESEARCH_20260624.md` v1.1  
**Tổng thời gian**: 32-42h  
**Ngày**: 2026-06-24

---

## 1. Tổng quan

### 1.1 Phát hiện sau review codebase

- **`vi.js` đã có sẵn ~300 keys SOC-specific** (tabs, dataops, dnse_backfill, vnbroker, prefetch, screener, matrix, scheduler, preview, guard, ownership) — không cần tạo file `soc.json` mới
- **`soc.js` có 77 methods** (>50), đủ cho tất cả 8 domains
- **Backend `service_ops/urls.py`** đã có hầu hết endpoints, thiếu 3 routes cho backfill runs ở path `/api/soc/dataops/backfill/runs/`
- **ShellOperationsCenterPage.tsx** (955 dòng) là single-page service grid + diagnostics, chưa có tab system

### 1.2 Dependency graph

```
Phase 1 (Tab shell)
  ├── no dependencies
  └── needed by: Phase 2, 3, 4

Phase 2 (5 core panels)
  └── depends on: Phase 1

Phase 3 (DataOps master panel)
  ├── depends on: Phase 1
  └── depends on: Phase 5 (backend routing for BackfillForm)

Phase 4 (Telemetry + DNSE + 7 shared components)
  ├── depends on: Phase 1
  └── blocked by: Phase 5 (DNSE Backfill routing)

Phase 5 (Backend routing + final polish)
  └── independent, can run parallel with Phase 2/3
```

**Thứ tự khuyến nghị**: Phase 1 → Phase 2 + Phase 3 (song song) → Phase 5 → Phase 4

---

## 2. Phase 1 — Foundation & Tab Shell (4-5h)

### Mục tiêu
Biến ShellOperationsCenterPage từ single-page service grid thành multi-tab shell.

### Files

| Action | File | Mô tả |
|--------|------|-------|
| NEW | `components/soc/soc.module.css` | Design tokens, tab bar, glassmorphism, animations |
| NEW | `components/soc/SocTabNavigation.tsx` | Tab bar: 8 tabs + URL sync + localStorage |
| MODIFY | `pages/admin/ShellOperationsCenterPage.tsx` | Gọn ~200 dòng, render tab nav + conditional panels |

### SocTabNavigation.tsx spec

```typescript
interface TabDef {
  key: string;
  label: string;        // i18n key trong vi.js soc.tab.*
  icon?: string;        // emoji/icon
}

interface SocTabNavigationProps {
  tabs: TabDef[];
  activeTab: string;
  onChange: (key: string) => void;
}

// Behavior:
// 1. Đọc ?tab=xxx từ URL params khi mount
// 2. Nếu không có, đọc từ localStorage('soc_active_tab')
// 3. Nếu không có history, default = '' (fallback về debug shell)
// 4. Khi đổi tab: set URL params + localStorage + gọi onChange
```

### ShellOperationsCenterPage.tsx cấu trúc mới

```
ShellOperationsCenterPage
├── useCoreShellPageSnapshot()          ← giữ nguyên
├── deriveCoreShellSnapshot()            ← giữ nguyên
├── activeTab state                      ← mới
├── SocTabNavigation                     ← mới
├── conditional render theo activeTab:
│   ├── 'overview'    → <SocOverviewPanel />
│   ├── 'signals'     → <SocSignalsPanel />
│   ├── 'dataops'     → <SocDataOpsPanel />
│   ├── 'prefetch'    → <SocPrefetchPanel />
│   ├── 'screener'    → <SocScreenerPanel />
│   ├── 'vnbroker'    → <SocVnbrokerPanel />
│   ├── 'runtime-kpi' → <SocRuntimeKpiPanel />
│   ├── 'dnse'        → <SocDnseBackfillPanel />
│   └── default       → <SocDebugShell /> (diagnostics hiện tại)
```

---

## 3. Phase 2 — Core Panels (12-16h)

### Mục tiêu
Port 5 panels từ legacy + tái cấu trúc service grid hiện tại.

### Files

| Action | File | Legacy source | API methods |
|--------|------|--------------|-------------|
| NEW | `SocOverviewPanel.tsx` | `OverviewPanel.jsx` + inline code từ ShellOperationsCenterPage | `getSocOverviewSummary()` |
| NEW | `SocSignalsPanel.tsx` | `SignalsPanel.jsx` | `getSocSignalConfig()`, `getSocWhaleDetection()`, `getSocSignalMetrics()`, `getSocSignalOwnership()` |
| NEW | `SocPrefetchPanel.tsx` | `PrefetchPanel.jsx` | `getSocPrefetchConfig()`, `getSocPrefetchUniverseGroups()`, `getSocPrefetchCacheStatus()`, `applySocPrefetchConfig()`, `warmSocPrefetchNow()`, `purgeSocPrefetchCache()` |
| NEW | `SocScreenerPanel.tsx` | `ScreenerPanel.jsx` | `getSocScreenerConfig()`, `getSocScreenerRules()`, `createSocScreenerRule()`, `updateSocScreenerRule()`, `deleteSocScreenerRule()`, `manualSocScreenerScan()`, `getSocScreenerMetrics()` |
| NEW | `SocVnbrokerPanel.tsx` | `VnbrokerPanel.jsx` | `getSocVnbrokerConfig()`, `applySocVnbrokerConfig()`, `getSocVnbrokerHealth()`, `runSocVnbrokerBenchmark()`, `getSocVnbrokerBenchmarkLatest()`, `getSocVnbrokerProviders()` |

### SocOverviewPanel.tsx spec

- Import service grid code từ ShellOperationsCenterPage.tsx (renderServiceCard, filter/pagination, status boxes)
- Dùng ShellPanel wrapper
- Export `SocOverviewPanel`
- Props: `fetchImpl?`, `initialSnapshot?`

### SocSignalsPanel.tsx spec

```
┌─ WriteGuardBanner ─────────────────────────┐
│ Panel này read-only. Owner: signals-team    │
└─────────────────────────────────────────────┘

┌─ Signal Config ────────────┐  ┌─ Whale Detection ──────────┐
│ (JSON pre-formatted view)   │  │ min_volume: 500000        │
│                             │  │ enabled: true             │
└─────────────────────────────┘  └────────────────────────────┘

┌─ Dark Pool Detection ──────┐  ┌─ Metrics ──────────────────┐
│ min_signal_count: 3         │  │ detection_rate: 92.4%     │
│ enabled: true              │  │ false_positive: 3.1%      │
└─────────────────────────────┘  │ avg_latency: 145ms        │
                                  └────────────────────────────┘
┌─ OwnershipBadge ─────────────────────────────┐
│ domain: signals | writable: false | team: x  │
└──────────────────────────────────────────────┘
```

### SocPrefetchPanel.tsx spec

```
┌─ Universe Groups (checkbox grid) ───────────┐
│ [✅] VN30  [✅] VN50  [ ] VN100             │
│ [ ] HOSE  [ ] HNX   [ ] UPCOM              │
│ [ ] All   [ ] Custom: [_______________]     │
│ Summary: 2/7 groups selected                │
├──────────────────────────────────────────────┤
│ ┌─ Config Form ────────────────────────────┐ │
│ │ batch_size: [___] symbol_limit: [____]   │ │
│ │ max_retries: [_] rate_limit_cooldown: [] │ │
│ │ cache_ttl: [____] close_history_days: [] │ │
│ └──────────────────────────────────────────┘ │
│ ┌─ Time Profile ───────────────────────────┐ │
│ │ pre_open: [] market_open: [] lunch: []   │ │
│ │ pre_close: [] post_close: [] offhours:[] │ │
│ └──────────────────────────────────────────┘ │
│ [Preview Changes] [Apply Config]             │
├──────────────────────────────────────────────┤
│ hit_rate: 87%  |  size: 245MB  |  TTL: 30m  │
│ [Warm Now] [Purge Cache]                     │
├──────────────────────────────────────────────┤
│ ┌─ Scheduler (domain=prefetch) ────────────┐ │
│ │ ...SchedulerBoard filtered...             │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### SocScreenerPanel.tsx spec

```
┌─ Config ────────────────────────────────────┐
│ scan_interval: [___] max_symbols: [___]     │
│ alert_cooldown: [___] retention_hours: [___]│
│ [Preview] [Apply]                           │
├──────────────────────────────────────────────┤
│ ┌─ Rules (table) ──────────────────────────┐ │
│ │ Name    | Type       | Enabled | Actions │ │
│ │─────────|------------|---------|---------│ │
│ │ Rule 1  | price+5%   | ✅      | [✏️][🗑]│ │
│ │ Rule 2  | volume 3x  | ❌      | [✏️][🗑]│ │
│ │ [+ Add Rule]                              │ │
│ └──────────────────────────────────────────┘ │
│ [Manual Scan: {symbols}] [Run]               │
│ ┌─ Results ───────┐  ┌─ Alerts ──────────┐  │
│ │ symbol|rule|time │  │ symbol: message   │  │
│ └─────────────────┘  └───────────────────┘  │
│ Metrics: avg_scan: 2.3s | hit_rate: 15.2%   │
└──────────────────────────────────────────────┘
```

### SocVnbrokerPanel.tsx spec

```
┌─ Core Config ───────────────────────────────┐
│ preferred_provider: [vci ▼]                 │
│ max_retries: [3] retry_delay: [1.0]         │
│ rpm: [60] burst: [10] cb_threshold: [5]     │
├─ Timeout ───────────────────────────────────┤
│ connect: [5] read: [120] write: [30] pool:  │
├─ Per-Provider ──────────────────────────────┤
│ [▼] vci — [Clear override]                  │
│     timeout overrides | retry overrides      │
│ [▼] kbs — [Clear override]                  │
│ [▼] dnse — [Clear override]                  │
├─ Health & Metrics ──────────────────────────┤
│ healthy: 2 | degraded: 0 | critical: 1       │
│ throughput: 8.5/s | error_rate: 2.1%         │
├─ Benchmark ─────────────────────────────────┤
│ [Provider: vci ▼] [Run Benchmark]            │
│ ┌─ Results ───────────────────────────────┐ │
│ │ Provider|Latency|RPM  |Success|RateLim  │ │
│ │ vci     |245ms  |52   |98%   |1.2%      │ │
│ │ kbs     |180ms  |68   |99.5% |0.5%      │ │
│ └─────────────────────────────────────────┘ │
│ [Apply Optimized Config]                     │
│ ┌─ Raw JSON ──────────────────────────────┐ │
│ │ <details>...                             │ │
│ └─────────────────────────────────────────┘ │
│ [Reset to Defaults]                          │
└──────────────────────────────────────────────┘
```

---

## 4. Phase 3 — DataOps Master Panel (8-10h)

### Mục tiêu
Tách monolithic 2,777-line legacy thành 5 sub-components + React Context.

### Files

| Action | File | Mô tả |
|--------|------|-------|
| NEW | `SocDataOpsPanel.tsx` | Master panel + DataOpsContext.Provider + 5 sub-tab navigation |
| NEW | `SocDataInventorySection.tsx` | Summary cards, year distribution, coverage table, data types |
| NEW | `SocDataOpsBackfillForm.tsx` | 8 datasets, symbol groups, planner preview, run monitor |
| NEW | `SocDataOpsMonitorSection.tsx` | Coverage gaps, queue tiers, observability, matrix |
| NEW | `SocDataOpsConfigSection.tsx` | Config editor, preview/apply, audit, run logs, symbol groups |

### DataOpsContext

```typescript
interface BackfillRun {
  run_id: string;
  status: string;
  dataset: string;
  progress: number;
  started_at: string;
  [key: string]: unknown;
}

interface InventoryData {
  total_rows: number;
  total_symbols: number;
  earliest_date: string;
  latest_date: string;
  groups: Record<string, unknown>;
  [key: string]: unknown;
}

interface DataOpsContextValue {
  state: {
    activeSubTab: string;
    runs: BackfillRun[];
    inventory: InventoryData | null;
    coverage: CoverageData | null;
    loading: Record<string, boolean>;
  };
  actions: {
    setActiveSubTab: (tab: string) => void;
    refreshInventory: () => Promise<void>;
    refreshRuns: () => Promise<void>;
    triggerBackfill: (payload: BackfillPayload) => Promise<string | null>;
    abortRun: (runId: string) => Promise<void>;
  };
}
```

### API methods cluster

| Sub-tab | soc.js calls |
|---------|-------------|
| Inventory | `getSocDataOpsInventory()` |
| Operations | `previewSocDataOpsPlanner()`, `runSocDataOpsPlanner()`, `getSocBackfillRuns()`, `getSocBackfillRunDetail()`, `abortSocDataOpsPlannerRun()` |
| Monitor | `getSocDataOpsCoverage()`, `getSocDataOpsQueueTiers()`, `getSocDataOpsObservability()`, `getSocMatrixMonitor()`, `startSocMatrixCycle()`, `getSocMatrixProviders()` |
| Scheduler | `getSocSchedulerPlan()`, `getSocSchedulerHealth()`, `getSocSchedulerJobHistory()`, `postSocSchedulerJobAction()` |
| Config | `getSocDataOpsRuntimeConfig()`, `previewSocDataOpsRuntimeConfig()`, `applySocDataOpsRuntimeConfig()`, `getSocDataOpsRunLogs()`, `purgeSocDataOpsRunLogs()`, `getSocDataOpsRuntimeConfigAudit()`, `getSocSymbolGroups()`, `createSocSymbolGroup()`, `deleteSocSymbolGroup()` |

---

## 5. Phase 4 — Telemetry + DNSE + Shared (6-8h)

### Mục tiêu
Port nốt 2 panels + 7 shared components.

### Files

| Action | File | Legacy source | Lines | Type |
|--------|------|--------------|-------|------|
| NEW | `SocRuntimeKpiPanel.tsx` | `RuntimeKPIPanel.jsx` | 27 | Placeholder |
| NEW | `SocDnseBackfillPanel.tsx` | `DNSEBackfillPanel.jsx` | 425 | ⚠️ Blocked by P5 |
| NEW | `SocConfigPreviewModal.tsx` | `ConfigPreviewModal.jsx` | ~140 | Shared |
| NEW | `SocSchedulerBoard.tsx` | `SchedulerBoard.jsx` | ~522 | Shared |
| NEW | `SocWriteGuardBanner.tsx` | `WriteGuardBanner.jsx` | ~40 | Shared |
| NEW | `SocOwnershipBadge.tsx` | `OwnershipBadgeRow.jsx` | ~70 | Shared |
| NEW | `SocServiceHealthCard.tsx` | `ServiceHealthCard.jsx` | ~105 | Shared |
| NEW | `SocMatrixScrapeMonitor.tsx` | `MatrixScrapeMonitor.jsx` | ~200 | Shared |
| NEW | `SocBackfillProgressPanel.tsx` | `BackfillProgressPanel.jsx` | ~400 | Shared |

### Shared components overview

| Component | Props | Key Logic |
|-----------|-------|-----------|
| `SocConfigPreviewModal` | `{ before, after, onConfirm, onCancel }` | JSON diff, validation errors, confirm/cancel |
| `SocSchedulerBoard` | `{ domain?, jobs, onAction }` | Job list, status badges, freshness, 4 actions, confirm modal, domain filter, auto-refresh polling |
| `SocWriteGuardBanner` | `{ owner, writer, surface }` | Amber warning: "Read-only" + owner info |
| `SocOwnershipBadge` | `{ team, writable, accessLevel }` | Team, writer, access level badges |
| `SocServiceHealthCard` | `{ service }` | Name, key, domain, status badge, latency, last check |
| `SocMatrixScrapeMonitor` | `{ cycleId, onAbort }` | Cycle progress, providers, symbol groups, live polling |
| `SocBackfillProgressPanel` | `{ runs, onRefresh, onSelect }` | Run list + detail + symbol-level progress |

---

## 6. Phase 5 — Backend Routing & Final Polish (2-3h)

### Mục tiêu
Bổ sung 3 routes backend còn thiếu + verify frontend routing.

### Backend work

**File sửa**: `packages/core/backend/src/service_ops/urls.py`

**Thêm vào** (sau line 12, trước overview endpoints):
```python
path('dataops/backfill/runs/', dataops.BackfillRunListView.as_view(), name='soc_backfill_run_list'),
path('dataops/backfill/runs/<str:run_id>/', dataops.BackfillRunDetailView.as_view(), name='soc_backfill_run_detail'),
path('dataops/backfill/run-now/', dataops.BackfillRunNowView.as_view(), name='soc_backfill_run_now'),
```

**Lý do**: Các view `BackfillRunListView`, `BackfillRunDetailView`, `BackfillRunNowView` **đã tồn tại** trong `dataops` module (import ở line 15 của `service_ops/urls.py`). Chỉ cần map route. Hiện tại chúng chỉ có ở `operator_urls.py` (path `/operator/scraping/dataops/backfill/runs/`) nên soc.js gọi `/operator/soc/dataops/backfill/runs/` sẽ 404.

### Frontend work

**File**: `adapters/core/soc.js`

- Verify `getSocBackfillRuns()` gọi đúng path
- Verify `getSocBackfillRunDetail()` gọi đúng path
- Thêm `triggerSystemBackfill()` và `triggerUserBackfill()` nếu cần

---

## 7. File Tree Tổng Thể (Sau Migration)

```
packages/web/src/
├── pages/admin/
│   └── ShellOperationsCenterPage.tsx     ← [MODIFIED] ~200 dòng, tab shell
│
├── components/soc/                        ← [NEW] 21 files
│   ├── soc.module.css                     ← Design tokens
│   ├── SocTabNavigation.tsx              ← Tab bar
│   │
│   ├── SocOverviewPanel.tsx              ← Tab 1
│   ├── SocSignalsPanel.tsx               ← Tab 2
│   ├── SocDataOpsPanel.tsx               ← Tab 3 (master)
│   │   ├── SocDataInventorySection.tsx   ← Sub: Inventory
│   │   ├── SocDataOpsBackfillForm.tsx    ← Sub: Backfill
│   │   ├── SocDataOpsMonitorSection.tsx  ← Sub: Monitor
│   │   └── SocDataOpsConfigSection.tsx   ← Sub: Config
│   ├── SocPrefetchPanel.tsx              ← Tab 4
│   ├── SocScreenerPanel.tsx              ← Tab 5
│   ├── SocVnbrokerPanel.tsx              ← Tab 6
│   ├── SocRuntimeKpiPanel.tsx            ← Tab 7
│   ├── SocDnseBackfillPanel.tsx          ← Tab 8
│   │
│   ├── SocConfigPreviewModal.tsx         ← Shared
│   ├── SocSchedulerBoard.tsx             ← Shared
│   ├── SocWriteGuardBanner.tsx           ← Shared
│   ├── SocOwnershipBadge.tsx             ← Shared
│   ├── SocServiceHealthCard.tsx          ← Shared
│   ├── SocMatrixScrapeMonitor.tsx        ← Shared
│   └── SocBackfillProgressPanel.tsx      ← Shared
│
├── adapters/core/
│   └── soc.js                             ← [VERIFY] Routes
│
└── i18n/locales/vi/
    └── vi.js                              ← [EXISTING] ~300 SOC keys

packages/core/backend/src/
└── service_ops/
    └── urls.py                            ← [MODIFIED] +3 backfill routes
```

---

## 8. Verification Plan

### Automated (sau mỗi Phase)
```bash
cd packages/web
npm run build
npx tsc --noEmit
```

### Manual parity checklist
- [ ] 8/8 tabs accessible và functional
- [ ] URL tab sync: reload page giữ nguyên active tab
- [ ] Config apply hoạt động (Prefetch, Screener, VNBroker, DataOps)
- [ ] Rule CRUD hoạt động (Screener: create, edit, delete)
- [ ] Benchmark tool hoạt động (VNBroker)
- [ ] Pagination hoạt động trên tất cả tables
- [ ] ConfigPreviewModal hiển thị diff đúng
- [ ] WriteGuardBanner hiển thị cho read-only domains
- [ ] i18n keys tất cả resolve
- [ ] Responsive: mobile, tablet, desktop
- [ ] Tất cả API calls route qua core adapter
