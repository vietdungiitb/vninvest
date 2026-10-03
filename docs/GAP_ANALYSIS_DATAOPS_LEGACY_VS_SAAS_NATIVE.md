# Gap Analysis: Legacy DataOpsPanel.jsx vs SaaS Native

> **⚠️ DOC STALE — COMPLETED (2026-07-17)**. Tất cả 20 feature gaps (P0 #1–5, P1 #6–11, P2 #12–16, P3 #17–20) đã được implement trong `packages/web/src/components/soc/` (Inventory / Operations / Monitor / Config sections). SOC DataOps parity đạt ~95%+. Bảng dưới chỉ giữ làm tài liệu tham khảo lịch sử; đừng dùng làm backlog.

Phân tích so sánh chi tiết từng tính năng của legacy `frontend/src/components/soc/DataOpsPanel.jsx` (2777 dòng, 56k chars) so với implementation hiện tại trong `packages/web/src/components/soc/`.

## 1. Tổng quan

### Legacy subtabs
| Tên legacy | Tab key legacy | Tab key native | Trạng thái |
|---|---|---|---|
| Kho dữ liệu (📦) | `data` | `inventory` | ~40% parity |
| Điều phối (⚡) | `ops` | `operations` | ~50% parity |
| Giám sát (🔍) | `monitor` | `monitor` | ~30% parity |
| Lịch chạy (⏱) | `scheduler` | `scheduler` | ~80% parity |
| Cấu hình (⚙️) | `config` | `config` | ~60% parity |

**Overall parity: ~45-50%**

---

## 2. Tab: Kho dữ liệu / Inventory

### 2.1 Metric cards (4 cards)
| Legacy | Native | Status |
|---|---|---|
| `total_rows`, `total_symbols`, `earliest_date`, `latest_date` | Yes — `renderMetricCard` x4 | ✅ Đã có |

### 2.2 Year distribution (by_year)
| Legacy | Native | Status |
|---|---|---|
| Horizontal bar chart với % of max, color bar, `y.rows · y.symbols` | Badges dạng `year: count` | ❌ Thiếu bar chart |
| Container scrollable với bar animation | Flex-wrap badge list | ❌ Thiếu visualization |

**Gap**: Legacy dùng bar chart (`div.h-full.bg-blue-600` with width as `pct%`). Native chỉ render `statusBadge` dạng text badges.

### 2.3 Coverage by group table (by_group)
| Legacy | Native | Status |
|---|---|---|
| Table: Nhóm, Bản ghi, Mã có data (covered/symbol_count), Ngày đầu, Ngày cuối, Ngày lịch | ❌ Missing | ❌ **Missing** |
| Color coding: `covered_symbols >= symbol_count` → green, `> 0` → yellow, `= 0` → grey | ❌ | ❌ |
| Custom groups hiển thị với icon ★ và màu teal | ❌ | ❌ |
| Cảnh báo nếu `calendar_days < 30` (⚠) | ❌ | ❌ |

### 2.4 Data types grid (data_types)
| Legacy | Native | Status |
|---|---|---|
| Dynamic render từ `inventory.data_types[]` | Hardcoded list `["intraday_ticks", "daily_prices", "whale_alerts", "dark_flow", "snapshots"]` | ❌ **Hardcoded** |
| Mỗi data type có `name`, `label`, `total_rows`, `symbols` | Chỉ show type name | ❌ |
| Color: `total_rows > 0` → green border, else grey | Tất cả giống nhau | ❌ |
| Legacy có 8 datasets | Native có 5 datasets | ❌ **Dataset mapping khác** |

**Datasets legacy:**
- `daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts`, `whale_events`, `order_flow`, `dark_flow`

**Datasets native:**
- `intraday_ticks`, `daily_prices`, `whale_alerts`, `dark_flow`, `snapshots`

**Gap**: Không match — thiếu `price_board_snapshot`, `intraday_bars`, `session_facts`, `order_flow`; thay vào đó có `whale_alerts`, `snapshots` không có trong legacy.

### 2.5 Stats grid
| Legacy | Native | Status |
|---|---|---|
| `total_symbols`, `queue_tiers count`, `decay_days`, `last_updated` | ❌ | ❌ **Missing** |

### 2.6 Queue Tiers accordion
| Legacy | Native | Status |
|---|---|---|
| Accordion expandable section | Queue tiers chỉ ở Monitor tab | ❌ **Nằm sai tab** |
| Tier cards: name, symbol_count, poll_interval_seconds, max_batch_size, examples | Chỉ show ở monitor section | ❌ |

### 2.7 UI states
| Legacy | Native | Status |
|---|---|---|
| Collapsible section (toggle open/close) | Luôn mở | ✅ Simple |
| Loading state ("Đang tải...") | ✅ | ✅ |
| Empty state ("Không có dữ liệu.") | ✅ | ✅ |

---

## 3. Tab: Điều phối / Operations

### 3.1 Backfill Center Section
| Legacy Feature | Native | Status |
|---|---|---|
| Dataset checkboxes with descriptions + "Coming soon" badge | Single select dropdown | ❌ SAI UX pattern |
| Dynamic custom groups merged with predefined | Only predefined groups | ❌ Missing custom groups |
| Custom symbols text input (radio "Tuỳ chỉnh") | ❌ | ❌ **Missing** |
| Execution mode select (async/sync) | ❌ | ❌ **Missing** |
| Dry-run checkbox | ❌ | ❌ **Missing** |
| Mode (missing_only/force_refresh) select | ❌ | ❌ **Missing** |
| Auto-poll active run every 5s | Static load | ❌ Missing polling |
| Active run display with abort button | ✅ Has abort button | ✅ Partial |
| Status message after run | ✅ Has status | ✅ |
| `canApply` write guard | ❌ | ❌ **Missing WriteGuardBanner** |
| 8 datasets vs 5 | ❌ Dataset mismatch | ❌ |

### 3.2 Planner Console (Manual Run)
| Legacy | Native | Status |
|---|---|---|
| Textarea for free-form symbols | ❌ | ❌ **Missing** |
| Dataset checkboxes | ❌ | ❌ **Missing** |
| Execution mode select | ❌ | ❌ **Missing** |
| Force refresh checkbox | ❌ | ❌ **Missing** |
| Reason input | ❌ | ❌ **Missing** |
| Preview button → async call `previewDataOpsPlanner` | ❌ | ❌ **Missing** |
| Run button (disabled until preview) | ❌ | ❌ **Missing** |
| Preview summary cards (planned, skipped counts) | ❌ | ❌ **Missing** |
| Planned items table with pagination | ❌ | ❌ **Missing** |
| Skipped items table with pagination | ❌ | ❌ **Missing** |
| Planner run result display | ❌ | ❌ **Missing** |

### 3.3 Custom Symbol Group Manager
| Legacy | Native | Status |
|---|---|---|
| List existing custom groups with delete button | ❌ | ❌ **Missing** |
| Create new group form (name, description, symbols textarea) | ❌ | ❌ **Missing** |
| `socApi.getSymbolGroups()` / `socApi.createSymbolGroup()` / `socApi.deleteSymbolGroup()` | ❌ | ❌ **Missing** |

---

## 4. Tab: Giám sát / Monitor

### 4.1 Matrix "Snapshot Trực tiếp"
| Legacy | Native | Status |
|---|---|---|
| Provider selection (toggle buttons) | ❌ | ❌ **Missing** |
| Symbol group selection (Vn30, Vn50, etc.) | ❌ | ❌ **Missing** |
| Start / Abort cycle buttons | ❌ | ❌ **Missing** |
| MatrixScrapeMonitor heatmap component | ✅ SocMatrixScrapeMonitor tồn tại | ❌ **Chưa tích hợp** |
| Cycle status display | ❌ | ❌ **Missing** |
| Auto-poll every 5s | ❌ | ❌ **Missing** |

### 4.2 Fail Rates
| Legacy | Native | Status |
|---|---|---|
| Fail rate 1h + 24h | ✅ Cards | ✅ |
| Failed/total runs with counts | ✅ | ✅ |
| Degraded rate (`degraded_rate_pct`) | ❌ | ❌ **Missing** |

### 4.3 Parity Gates
| Legacy | Native | Status |
|---|---|---|
| Window 24h: strict parity %, relaxed parity % | ❌ | ❌ **Missing** |
| Window 72h: strict parity %, relaxed parity % | ❌ | ❌ **Missing** |
| Status pass/fail badges | ❌ | ❌ **Missing** |
| Trend direction (up/down/flat) with color coding | ❌ | ❌ **Missing** |
| History sequence data points with tooltip | ❌ | ❌ **Missing** |

### 4.4 Retention Health
| Legacy | Native | Status |
|---|---|---|
| Deleted rows count | ❌ | ❌ **Missing** |
| Retention policy days | ❌ | ❌ **Missing** |
| Status badge (ok/failed/unknown) | ❌ | ❌ **Missing** |
| Trend comparison (delta, direction) | ❌ | ❌ **Missing** |
| Retention histogram (CSS bars) | ❌ | ❌ **Missing** |
| Threshold check (`within_staleness_threshold`) | ❌ | ❌ **Missing** |

### 4.5 Backlog
| Legacy | Native | Status |
|---|---|---|
| Backlog by dataset table | ✅ Badges | ✅ Basic |
| Backlog by tier table | ❌ | ❌ **Missing** |
| Pagination | ❌ | ❌ |

### 4.6 Starvation
| Legacy | Native | Status |
|---|---|---|
| Starvation alerts per tier | ✅ List | ✅ |
| `is_starved`, `seconds_since_last_progress` | ❌ | ❌ **Missing** |

### 4.7 Coverage
| Legacy | Native | Status |
|---|---|---|
| Coverage compact table (datasets x freshness states matrix) | ❌ JSON dump | ❌ **Tệ hơn** |
| Freshness states: fresh, warm, stale, missing, error, unknown | ❌ | ❌ |
| Top gaps paginated list (20/page) | ❌ | ❌ **Missing** |
| `next_recommended_action` for each gap | ❌ | ❌ **Missing** |

### 4.8 Anomaly Guard
| Legacy | Native | Status |
|---|---|---|
| Promotion backlog count | ❌ | ❌ **Missing** |
| Repair backlog age | ❌ | ❌ **Missing** |
| Critical gap symbols table (symbol, tier, gap_score, freshness_state) | ❌ | ❌ **Missing** |
| Hot tier breach table (symbol, gap_days, gap_score, freshness_state) | ❌ | ❌ **Missing** |

### 4.9 Run History
| Legacy | Native | Status |
|---|---|---|
| Run logs table with pagination | ❌ Chỉ ở Config section | ❌ **Sai tab** |
| `handleRunLogsPageChange(page)` | ❌ | ❌ |
| Pagination controls (prev/next) | ❌ | ❌ |
| Purge button with confirmation | ✅ Có ở Config section | ❌ **Sai tab** |
| Run summary details: planned, inserted, updated, skipped_existing, failed | ❌ | ❌ |

---

## 5. Tab: Lịch chạy / Scheduler

| Legacy | Native | Status |
|---|---|---|
| `SchedulerBoard` component | ✅ `SocSchedulerBoard` | ✅ **Đã có** |
| `domain="dataops"` prop | ✅ | ✅ |

---

## 6. Tab: Cấu hình / Config

### 6.1 JSON Editor
| Legacy | Native | Status |
|---|---|---|
| JSON textarea | ✅ | ✅ |
| Edit button (reset to current) | ✅ | ✅ |

### 6.2 Preview
| Legacy | Native | Status |
|---|---|---|
| Preview button → call `previewDataOpsRuntimeConfig` | ✅ | ✅ |
| `ConfigPreviewModal` → `SocConfigPreviewModal` | ✅ | ✅ |
| Change summary computed from `buildChangeSummary()` | ❌ | ❌ **Missing** |
| Impact warnings: runtime change, recovery change | ❌ | ❌ **Missing** |
| Validation errors display | ❌ | ❌ **Missing** |

### 6.3 Apply
| Legacy | Native | Status |
|---|---|---|
| Apply button | ✅ | ✅ |
| WriteGuardBanner (`canApply` check) | ❌ | ❌ **Missing** |

### 6.4 Audit Trail
| Legacy | Native | Status |
|---|---|---|
| Audit trail table with pagination | ✅ Basic list | ✅ |
| `handleAuditPageChange(page)` | ❌ | ❌ **Missing pagination** |

### 6.5 Ownership
| Legacy | Native | Status |
|---|---|---|
| `OwnershipBadgeRow` with `runtimeEnvelope.ownership` | ❌ `SocOwnershipBadge` exists | ❌ **Chưa tích hợp** |

### 6.6 Scheduler Re-include
| Legacy | Native | Status |
|---|---|---|
| SchedulerBoard only on scheduler tab | ✅ Có ở config section | ❌ **Duplicate** |

---

## 7. Infrastructure Gaps

### 7.1 i18n Keys
| Legacy keys | Native keys | Status |
|---|---|---|
| ~50 keys under `soc.dataops.*` | ~30 keys | ❌ **Thiếu ~20 keys** |

**Missing i18n keys:**
- `soc.dataops.dataset_*` cho `price_board_snapshot`, `intraday_bars`, `session_facts`, `whale_events`, `order_flow`
- `soc.dataops.dataset_field_*` — mô tả từng dataset
- `soc.dataops.backfill_*`: mode, execution, dry_run, active_run, stopping, stopped_with_run
- `soc.dataops.tier_*`: label cho tiers
- `soc.dataops.freshness_*`: label cho freshness states
- `soc.dataops.run_status_*`: queued, running, success, partial, skipped
- `soc.dataops.action_*`: next recommended action labels
- `soc.dataops.parity_*`: label cho parity gates
- `soc.dataops.retention_*`: label cho retention health
- `soc.dataops.anomaly_*`: label cho anomaly guard
- `soc.dataops.subtab.*`: inventory, operations, monitor, scheduler, config
- `soc.matrix.*`: status labels

### 7.2 CSS / Styling
| Legacy | Native | Status |
|---|---|---|
| Tailwind classes | CSS Modules via `soc.module.css` | ✅ |
| Glassmorphism patterns | ✅ | ✅ |
| Status colors (emerald, amber, rose, slate) | ✅ Partial | ✅ |

### 7.3 API Adapter
| Legacy | Native | Status |
|---|---|---|
| `socApi.*` calls | `defaultCoreApiAdapter` cast | ✅ |
| Full API coverage | ✅ soc.js has all endpoints | ✅ |

### 7.4 DataOpsContext
| Legacy | Native | Status |
|---|---|---|
| State quản lý bằng useState trực tiếp trong component | `DataOpsContext` provider | ✅ |
| Context provides: runs, inventory, coverage, loading | ✅ | ✅ |
| Context actions: refreshInventory, refreshRuns, refreshCoverage, triggerBackfill, abortRun | ✅ | ✅ |
| ❌ Không có observability, queueTiers, matrix state trong context | ❌ | ❌ |

---

## 8. Tổng hợp Priority

### P0 — CRITICAL (phải có để parity cơ bản)

| # | Feature | Tab | File cần sửa | Ước lượng |
|---|---|---|---|---|
| 1 | Dataset list matching legacy (8 datasets) | Backfill, Inventory | `SocDataOpsBackfillForm.tsx` + `SocDataInventorySection.tsx` | Nhỏ |
| 2 | Coverage render thay vì JSON dump | Monitor | `SocDataOpsMonitorSection.tsx` | Trung bình |
| 3 | Planner Console (symbols textarea + preview + run + results) | Operations | New component | Lớn |
| 4 | Backfill form mở rộng: dry-run, mode, execution, custom symbols, checkbox datasets | Operations | `SocDataOpsBackfillForm.tsx` | Trung bình |
| 5 | Missing i18n keys (ít nhất các key label dataset) | All | `i18n/vi.js` + `i18n/en.js` | Nhỏ |

### P1 — HIGH (parity monitor section)

| # | Feature | Tab | Notes |
|---|---|---|---|
| 6 | Matrix live snapshot integration | Monitor | SocMatrixScrapeMonitor exists, cần tích hợp |
| 7 | Parity gates (24h, 72h) + history | Monitor | New section |
| 8 | Retention health | Monitor | New section |
| 9 | Coverage top gaps with pagination | Monitor | Paginated table |
| 10 | Anomaly Guard | Monitor | New section |
| 11 | Run history with pagination + purge on Monitor tab | Monitor | Move from Config |

### P2 — MEDIUM (visual + UX enhancement)

| # | Feature | Tab | Notes |
|---|---|---|---|
| 12 | Year distribution bar chart | Inventory | Thay badges bằng bar chart |
| 13 | Coverage by group table | Inventory | Table với color coding |
| 14 | Data types dynamic from API | Inventory | Thay hardcoded list |
| 15 | Stats grid | Inventory | 4 cards metrics |
| 16 | Queue tiers accordion | Inventory | Expandable | 

### P3 — LOW (enhancements)

| # | Feature | Tab | Notes |
|---|---|---|---|
| 17 | Custom symbol group manager | Operations | CRUD form |
| 18 | WriteGuardBanner integration | Config, Operations | `canApply` check |
| 19 | OwnershipBadgeRow integration | Config | `SocOwnershipBadge` exists |
| 20 | Audit trail pagination | Config | `handleAuditPageChange` |

---

## 9. Kết luận

**Tổng cộng cần ~20 feature gaps để đạt parity tối thiểu 1:1 với legacy.**

Phân bố effort:
- **P0**: ~5 items, ~2-3 ngày
- **P1**: ~6 items, ~3-4 ngày
- **P2**: ~5 items, ~1-2 ngày
- **P3**: ~4 items, ~1 ngày

**Khuyến nghị Phase 1 (P0+P1)**: Tập trung vào Backfill, Operations, Monitor — chiếm 80% usage của DataOps panel theo legacy.

---

## 10. Phản Biện Bổ Sung (2026-06-25) & Triangulation

Phần này ghi lại kết quả review chéo từ reviewer thứ hai (senior technical reviewer) và đối chiếu với review trước đó.

### 10.1 Context Bloat & Performance (Matrix State)

**Phản biện:** Matrix polling (5s) trong DataOpsContext gây re-render toàn bộ tree. Đề xuất giữ matrix state local, chỉ expose start/abort actions ra context.

**Triangulation với review trước (REVIEW point #6):**
- ✅ Nhất quán. Cả 2 review đều cảnh báo context bloat.
- Bổ sung: Luận điểm "polling 5s → wide re-render → JSON editor mất focus" là đúng và cụ thể hơn.

**Quyết định:**
- Matrix `cycleId` (read-only) → context (dùng bởi Monitor + Backfill Center)
- Matrix `providers`, `selectedGroups`, `status`, `cells`, `polling interval` → local state trong `SocMatrixScrapeMonitor`
- `startMatrixCycle()`, `abortMatrixCycle()` → actions trong context
- Run logs + audit trail → local state, load khi mount

### 10.2 Dataset Translation Map

**Phản biện:** Cần xác minh backend trước khi port 1:1 dataset keys để tránh 400 errors. Đề xuất "Dataset Translation Map".

**Triangulation với review trước (REVIEW point #10):**
- ✅ Nhất quán. Cả 2 đều yêu cầu verify backend contracts trước code.
- Bổ sung: Giải pháp cụ thể (translation map) thay vì chỉ cảnh báo.

**Dataset Translation Map (cần verify backend):**

| Legacy Key | SaaS Native Key | Trạng thái |
|---|---|---|
| `daily_prices` | `daily_prices` | ✅ Giống |
| `intraday_ticks` | `intraday_ticks` | ✅ Giống |
| `whale_events` | `whale_alerts` | 🔄 Cần verify (có thể đã đổi tên) |
| `dark_flow` | `dark_flow` | ✅ Giống |
| `price_board_snapshot` | `snapshots` | ❓ Cần verify |
| `intraday_bars` | ❓ | ❓ Cần verify — có thể đã gộp |
| `session_facts` | ❓ | ❓ Cần verify — có thể đã bỏ |
| `order_flow` | ❓ | ❓ Cần verify — có thể đã bỏ |

**Hành động:** Đọc `packages/core/backend/src/service_ops/urls.py` + test endpoint thực tế trước Phase 1.

### 10.3 Monitor UI Overload & Run Logs Placement

**Phản biện:** Monitor tab sau khi port full sẽ quá nặng. Run Logs nên ở Ops tab (behavioral link: "run" + "history"), không phải Monitor.

**Triangulation với review trước (REVIEW point #2 về scope):**
- ✅ Nhất quán. Cả 2 đều cảnh báo scope overflow.
- Bổ sung: Giải pháp placement cụ thể thay vì chỉ "chia phase".

**Quyết định:**
- Run Logs → **Ops tab** (dưới Backfill Center + Planner Console)
- Monitor tab chỉ giữ: Matrix, Parity Gates, Retention Health, Backlog/Starvation, Anomaly Guard, Coverage/Gaps
- Run History ở Monitor chỉ là collapsible panel mặc định đóng (nếu vẫn muốn monitor context)

### 10.4 i18n Vietnamese Terminology

**Phản biện:** Cần thống nhất thuật ngữ tiếng Việt cho các khái niệm SaaS mới trước khi code.

**Triangulation với review trước (REVIEW point #4):**
- ✅ Nhất quán. Cả 2 đều yêu cầu i18n.
- Bổ sung: Bảng thuật ngữ cụ thể thay vì chỉ "thiếu i18n keys".

**Bảng thuật ngữ tiếng Việt thống nhất:**

| English | Tiếng Việt (đã chuẩn hóa) |
|---|---|
| DataOps | DataOps (giữ nguyên) |
| Queue Tiers | Phân tầng hàng đợi |
| Inventory | Kho dữ liệu |
| Backfill | Chạy bù dữ liệu |
| Planner | Bộ lập kế hoạch |
| Coverage | Mức độ bao phủ |
| Freshness | Độ tươi mới |
| Starvation alerts | Cảnh báo trễ tiến trình cào dữ liệu |
| Parity gates | Cổng đối chiếu đồng bộ |
| Retention Health | Sức khỏe lưu trữ |
| Anomaly Guard | Giám sát dị thường dòng dữ liệu |
| Backlog | Tồn đọng |
| Run Logs | Lịch sử chạy |
| Audit Trail | Nhật ký kiểm toán |
| Purge | Dọn dẹp
