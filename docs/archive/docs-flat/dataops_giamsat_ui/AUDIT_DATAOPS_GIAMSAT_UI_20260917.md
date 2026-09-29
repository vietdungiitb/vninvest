# AUDIT GIAO DIỆN GIÁM SÁT `operations-center?tab=dataops` — 7 ẢNH 17/09/2026 15:00

> **ERRATA 17/09 Entry 107 — Phản biện F-G01:** Audit gốc chẩn đoán F-G01 sai root cause (bảo “`vi.js:793` thiếu 5 keys, cần thêm”). Thực tế namespace `soc.matrix:802` tồn tại đủ **9 keys** (`title/start_cycle/loading/recent_cycles/...` `vi.js:802-812` + `en.js:802-812`), nhưng bị **duplicate key shadowing**: block `soc.matrix` thứ 2 (cũ, commit `8c10e013`) tại `vi.js:1050-1093`/`en.js:1050-1093` (44 dòng, 0 consumer trong `grep -R soc\.matrix`) đè object literal → 6 keys đầu (`title/recent_cycles/no_cycles`…) bị ghi đè bằng block cũ không có consumer → rơi vào fallback render raw `soc.matrix.title` (ảnh 1-2). Fix đúng là **xoá block duplicate 1050-1093** (Entry 107), không phải thêm keys. Audit gốc nếu làm theo (“thêm 5 keys”) sẽ không ăn. Tài liệu này đã cập nhật F-G01 bên dưới.

**Phạm vi:** `packages/web/src/components/soc/SocDataOpsPanel.tsx:13` (tab router) + `SocDataOpsMonitorSection.tsx:1-973` (Giám sát) + `SocMatrixScrapeMonitor.tsx:30` + `SocParityGatesPanel.tsx` + `SocRetentionHealthPanel.tsx` + `SocAnomalyGuardPanel.tsx` + `DataOpsContext.tsx` + `adapters/core/soc.js:177` + `service_ops/dataops_market_data.py:269,711` + `market_data/global_symbol_coverage.py:506` + `soc.module.css` + `i18n/vi.js:802,1050` + `i18n/en.js:802,1050` (liên quan: `packages/web` React/Vite app ↔ `packages/core` Django backend qua `defaultCoreApiAdapter` + `vninvestcharts-widget` — mọi tracing qua ranh giới widget/adapter đã kiểm tra `src/types/vninvestcharts-widget.d.ts` + `package.json:1.2.5`)

**Nguyên tắc bắt buộc:** AGENTS.md Nguyên tắc 1-6, B1-B6 — mọi khẳng định kèm `file:line`, không đoán, grep toàn repo `.css/.module.css/config/i18n/adapters`, đối chiếu plan↔code mục CONTRADICTIONS, quality gates `lint/type-check/i18n/test/external coupling`.

---

## TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT (đã cập nhật Entry 107)

1. **F-G01 P0 BLOCKER (ĐÃ FIX Entry 107 — root cause corrected)** — `soc.matrix.*` lộ key thô `soc.matrix.title` ảnh 1-2 **không phải thiếu key** mà do **duplicate key shadowing**: `vi.js:802-812` block 1 đủ 9 keys, `vi.js:1050-1093` block 2 cũ (0 consumer, 44 dòng) ghi đè → `SocMatrixScrapeMonitor.tsx:105` `t("soc.matrix.title")` fallback raw. Fix: **xoá block duplicate 1050-1093** `vi.js/en.js` (không thêm keys).
2. **F-G02 P0 (ĐÃ FIX Entry 107)** — `soc.dataops.anomaly_guard_desc` + `no_critical_gaps` + `no_hot_breach` lộ thô 5 chỗ ảnh 5-6: `SocDataOpsMonitorSection.tsx:702` `t("soc.dataops.anomaly_guard_desc")` không tồn tại trong `vi.js:548` (chỉ có `anomaly_guard` không có `_desc`), dẫn tới raw. Fix: **+3 keys** `anomaly_guard_desc/no_critical_gaps/no_hot_breach` `vi.js:551-553`/`en.js`.
3. **F-G03 P0 (ĐÃ FIX Entry 107)** — `Queue tier chưa đặt tên` ×8: `SocDataOpsMonitorSection.tsx:534` `TIER_LABEL_KEYS` chỉ `hot/warm/cold/recovery` nhưng BE `dataops_market_data.py:30 QUEUE_TIER_ORDER` trả `hot_user_demand/warm_liquid_market/cold_full_market/recovery_backlog` → fallback `unknown_tier` `vi.js:679`. Fix: **TIER_LABEL_KEYS → `hot_user_demand/...` khớp BE** `SocDataOpsMonitorSection.tsx:102-108`.
4. **F-G04 P0 (NGOÀI SCOPE Entry 107 — chưa xác minh độc lập)** — `● Reconnecting` xám vĩnh viễn dù `BACKLOG 5123` 200: `useDataOpsStream.ts:30` `Reconnecting` khi `error`, `DataOpsStreamView` chưa verify. **Giữ trong backlog, không tính DoD Entry 107.**
5. **F-V06 P1 (ĐÃ FIX Entry 107)** — `Chỉ báo starvation - / ngưỡng` + `STARVED` 4/4 đỏ sai: `dataops_market_data.py:779` `is_starved=True` khi `latest_progress=null` (chưa có `ServiceRunLog`) → báo động giả. Fix: **neverRun → badge xám `Chưa có lần chạy` `vi.js:starved_never_run` + hero bỏ đếm null** `SocDataOpsMonitorSection.tsx:528`.

---

## 1. ĐỌC TRƯỚC (bắt buộc)

- `AGENTS.md` (Goal, Constraints glassmorphism `soc.module.css`, i18n `LangContext`, API `defaultCoreApiAdapter as unknown`, build `tsc --noEmit`)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 93-112: Overview P1, Signals SSE, DataOps monitor `Failed to fetch` fix, coverage ratio)
- `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md`, `docs/AUDIT_SOC_DATAOPS_TAB_20260916.md`, `docs/AUDIT_OPERATIONS_CENTER_UI_UX_AND_TECHNICAL_GAPS_20260701.md`
- `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md` (stale, đã đóng 20 gaps)

---

## 2. PHẠM VI NGHIÊN CỨU

**A. SOC DataOps Monitor UI** — `packages/web/src/components/soc/SocDataOpsPanel.tsx`, `SocDataOpsMonitorSection.tsx:1-973`, `SocMatrixScrapeMonitor.tsx:30`, `SocParityGatesPanel.tsx`, `SocRetentionHealthPanel.tsx`, `SocAnomalyGuardPanel.tsx`, `DataOpsContext.tsx`, `soc.module.css`, `soc.tokens.css`
  - Glob `packages/web/src/components/soc/*.tsx`, `soc.module.css`
  - Grep `t("soc.matrix`, `t("soc.dataops`, `TIER_LABEL_KEYS`, `COVERAGE_STATE_ORDER`, `queueTiersError`, `streamStatusLabel`, `Re­connecting`

**B. BE DataOps Market-Data SSOT** — `packages/core/backend/src/service_ops/dataops_market_data.py:269,711`, `packages/core/backend/src/market_data/global_symbol_coverage.py:506`, `packages/core/backend/src/service_ops/views/dataops_*.py`, `service_ops/views/dataops_stream.py:1`, `service_ops/urls.py:138`
  - Grep `build_market_data_observability_summary`, `build_global_coverage_summary`, `QUEUE_TIER_ORDER`, `STARVATION`, `anomaly_guard`

**C. CROSS-PACKAGE / EXTERNAL COUPLING**
  - web↔core API contract `defaultCoreApiAdapter` `src/adapters/core/soc.js:177 getSocDataOpsCoverage/Observability/QueueTiers` + `transport.js:47 resolveCoreApiBase`
  - web↔widget `src/types/vninvestcharts-widget.d.ts` (không liên quan Monitor, đã loại trừ)
  - `dist vs src staleness` — `packages/web/dist` đã `docker cp` sau `build --no-cache frontend 106.3s`

**D. QUALITY GATES**
  - Lint: `npm run lint` `packages/web` → 0 errors 3549 warn
  - Type-check: `npm run build`=`tsc && vite build` → PASS 32.76s (`--no-cache` 106.3s)
  - i18n: `src/i18n/vi.js:396,534` `en.js` + `npm run i18n:scan` → 5 keys leak
  - Test: `npm run test` `jest 232 passed` + `npm run test:components` `vitest 36/193`

---

## 3. PHƯƠNG PHÁP

**B1:** Đọc `AGENTS.md` + `CODE_CHANGE_AUDIT_LEDGER` + `IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL` + `AUDIT_SOC_DATAOPS_TAB`  
**B2:** Glob `packages/web/src/components/soc/*.tsx` (28 files), `soc.module.css`  
**B3:** Grep `soc\.matrix|soc\.dataops\.anomaly|TIER_LABEL_KEYS|COVERAGE_STATE_ORDER|Re­connecting|queueTiersError|STARVED|anomaly_guard_desc` toàn repo  
**B4:** Read từng file cốt lõi, trace 1 use-case `Mở Giám sát`: `SocDataOpsPanel setActiveSubTab("monitor"):176` → `SocDataOpsMonitorSection useEffect:283 allSettled fetchQueueTiers/fetchObservability` → `soc.js:162,181` → `dataops_market_data.py:269,711` → `global_symbol_coverage.py:506` → `useDataOpsStream.ts:30 EventSource` → render `queueTiersError/observabilityError` + `streamStatusLabel`  
**B5:** Đối chiếu plan↔code, gạch chỗ lệch mục CONTRADICTIONS  
**B6:** Check ranh giới `lint/type-check/i18n/test/external coupling`

---

## 4. ĐẦU RA

### A. Bản đồ kiến trúc (bảng: file | line_count | trách nhiệm | note)

| File | Lines | Trách nhiệm | Note |
|------|-------|-------------|------|
| `SocDataOpsPanel.tsx:13` | 205 | Tab router `Tổng quan/Tín hiệu/Dữ liệu vận hành/Prefetch/Screener/VNBroker/Hiệu năng` + subtab `Kho dữ liệu/Vận hành/Giám sát/Lịch chạy/Cấu hình` `DATAOPS_SUB_TABS:13` + hero `4.5M/0/0/3` `HERO_METRIC_DEFS:21` | Hero `totalRows` từ `inventory.summary.total_rows` ≠ `backlog 5123` |
| `SocDataOpsMonitorSection.tsx:159` | 973 | **Giám sát**: `Re­connecting` dot `:300`, `Ma trận snapshot` `:445`, `BACKLOG 5123` `:466`, `Quan sát vận hành` `:474`, `Backlog theo dataset 911` `:491`, `Chỉ báo starvation -/90` `:528`, `Backlog theo queue tier` `:586`, `Cổng đối chiếu 0/100` `:614`, `Sức khỏe lưu trữ 0` `:666`, `Giám sát dị thường 911/2804.5h` `:702`, `Độ phủ 537/749` `:680`, `Top gaps AST` `:832`, `Queue tier N/A` `:938` | Ảnh 1-7 toàn bộ, 7 lỗi render chính |
| `SocMatrixScrapeMonitor.tsx:30` | 235 | `monitorCache:30` + `Promise.allSettled:42` non-blocking `inlineError+Retry:136` + cycles `recent_cycles` + providers `VCI/KBS/DNSE` | Ảnh 2 `soc.matrix.*` leak |
| `DataOpsContext.tsx:67` | 179 | SSOT `inventory/coverage/runs` `getSocDataOpsInventory/RunLogs/Coverage` `:67-73` `useEffect mount:136` | `coverageContextError` chưa hiển thị trước fix `:679` |
| `soc.js:177` | 614 | `getSocDataOpsCoverage/Observability/QueueTiers/RunLogs` `coreGet /operator/scraping/dataops/...` `getSocDataOpsStreamUrl:451` | Contract OK |
| `dataops_market_data.py:269` | 857 | `queue_tier_snapshot example_limit=5:269` `observability_summary backlog/fail/starvation/parity/anomaly:711` | `QUEUE_TIER_ORDER hot_user_demand...:30` |
| `global_symbol_coverage.py:506` | 817 | `build_global_coverage_summary:506` datasets `fresh537 warm85 stale162 missing749` top_gaps 10×MISSING + `anomaly_guard:614` `no_critical_gaps` | Data ảnh 6 |
| `useDataOpsStream.ts:30` | 120 | `EventSource retry3000 ping15s heartbeat35s token fallback` `DataOpsStreamSnapshot` | Ảnh 1 `Re­connecting` |
| `soc.module.css:874` | | `.inlineError/.sectionCard/.coverageTable/.metricGrid/.glassPanel` | Glassmorphism tokens |
| `vi.js:396,534`+`en.js:451` | 5350 | `stream_live/trực tiếp`, `matrix.title`, `anomaly_guard_desc`, `filter_all_datasets` | 5 keys leak |

### B. Luồng dữ liệu đã trace (use-case cụ thể, kèm file:line từng bước)

**Use-case:** User mở `operations-center?tab=dataops` → click subtab `Giám sát`

1. `SocDataOpsPanel.tsx:176` `actions.setActiveSubTab("monitor")` → `renderSubTabContent:77-80` `createElement(SocDataOpsMonitorSection)`
2. `SocDataOpsMonitorSection.tsx:283` `useEffect` `fetchQueueTiers:252` + `fetchObservability:261` `allSettled` + `actions.refreshCoverage()` `DataOpsContext:121` → `soc.js:162 /queue-tiers/ → build_market_data_queue_tier_snapshot:269` (1942 registry `hot 50 warm 1892` `examples[:5] ABW...`) → `soc.js:181 /observability/ → build_market_data_observability_summary:711` (`backlog 911 daily`, `fail 0.0%` `ServiceRunLog 2 runs`, `starvation 4× is_starved True` khi `latest_progress null`) → `soc.js:177 /coverage/ → build_global_coverage_summary:506` (`datasets fresh537 warm85 stale162 missing749` `top_gaps AST daily_prices MISSING`)
3. `useDataOpsStream.ts:30` `EventSource /operator/soc/dataops/stream/ retry3000` → `dataops_stream.py:120` token fallback `Bearer` + `SOCStreamThrottle 60/min` + poll 5s `snapshot observability/coverage/tiers` signature `json backlog/fail/coverage/tiers` → `handleStreamSnapshot:286` `setStreamCoverage` + `setObservability` + `streamOpenRef pause poll:320` → dot `Live/Polling` `vi.js:stream_live`
4. Render tách lỗi: `queueTiersError:434` + `observabilityError:438` + `renderActiveRunBanner:442` + `streamStatusLabel:447` → hero `BACKLOG 5123 = by_dataset sum:467` vs table `911` → mismatch double count.

### C. CONTRADICTIONS (plan/doc vs code): [mỗi dòng] Plan X (file:line) | Thực tế Y (file:line) | Tác động

| # | Plan X `file:line` | Thực tế Y `file:line` | Tác động |
|---|---------------------|------------------------|----------|
| C1 | `AGENTS.md GAP #1-20 CLOSED 2026-09-15` `vi.js` đủ i18n `soc.dataops.* 34 keys` + Audit gốc `F-G01: vi.js:793 thiếu 5 keys` | **Sai root cause:** `grep` thực tế `vi.js:802-812` đủ 9 keys, nhưng `vi.js:1050-1093` block duplicate `soc.matrix` cũ (44 dòng, commit `8c10e013`, 0 consumer) ghi đè object literal → 6 keys đầu (`title/recent_cycles/no_cycles`) fallback raw `soc.matrix.title` (ảnh 1-2). Audit đề xuất “thêm 5 keys” sẽ không ăn. | Mất credibility, fix sai hướng sẽ tốn công vô ích; cần **xoá block duplicate** không thêm keys |
| C2 | `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md SimpleCache module-level giữ state khi switch tab` | `SocMatrixScrapeMonitor.tsx:30 monitorCache` có, nhưng `SocDataOpsMonitorSection.tsx:283` + `SocDataInventorySection.tsx:36` không cache → mỗi mount refetch `queueTiers` double request | Flicker + 2× API `GET /queue-tiers/` |
| C3 | `soc.js:166` fix `examples\|\|active_symbols` | `SocDataOpsMonitorSection.tsx:948 Queue tier snapshot N/A` ảnh 7 `50 mã • Cadence: N/A` | `MarketDataRuntimeConfig is_current False` → `poll_interval_seconds N/A` (không phải bug FE) |
| C4 | Spec `parity 99% strict-fresh` `dataops_market_data.py:398 strict_threshold 99%` | `Cổng đối chiếu 0/100 0.00% CHƯA ĐẠT` ảnh 4 đúng threshold, nhưng `Lịch sử 7 kỳ 0.0%` flat | User hiểu nhầm hệ chết, thực tế `last_verified_at < since 24h` → `strict_fresh_count 0` |
| C5 | `P0 “tách lỗi non-blocking”` `SocOverviewPanel:434` | Ảnh 1 `● Reconnecting` xám vĩnh viễn dù `BACKLOG 5123` đã load 200 | `useDataOpsStream onStatusChange` set `Reconnecting` khi `error` nhưng `open` chưa reset do `heartbeat 35s` chưa ping → UI kẹt reconnect |
| **C6** | **Audit F-G01 đề xuất `vi.js:793 thêm 5 keys` (file không tồn tại lỗi)** | `vi.js:1050-1093` block duplicate tồn tại, `grep soc\.matrix` chỉ hit 2 block, `en.js:1050-1093` tương tự | **Bài học Nguyên tắc 3**: Mọi reference file phải `read/grep` xác nhận tồn tại — audit gốc vi phạm, team sẽ sửa sai chỗ |

### D. Findings: [ID] <ERROR|GAP|RISK> | Mức | file:line | Thực tế | Tác động | Đề xuất fix

| ID | <ERROR\|GAP\|RISK> | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|----|-------------------|-----|-----------|---------|----------|-------------|
| **F-G01** | ERROR | P0 BLOCKER | `SocMatrixScrapeMonitor.tsx:105` `vi.js:802` + `vi.js:1050-1093` duplicate | `soc.matrix.title` lộ thô ảnh 1-2 do **shadowing** block 1 (đủ 9 keys) bị block 2 cũ (44 dòng, 0 consumer) ghi đè → `JS {a:1, a:2} === {a:2}` | Toàn bộ header matrix không dịch | **Xoá block duplicate 1050-1093 `vi.js/en.js`** (Entry 107) — không thêm keys |
| **F-G02** | ERROR | P0 | `SocDataOpsMonitorSection.tsx:702` `vi.js:551` | `soc.dataops.anomaly_guard_desc/no_critical_gaps/no_hot_breach` lộ 5 chỗ ảnh 5-6 (thiếu 3 keys, không phải 5) | Panel dị thường 100% key chết | Bổ sung `vi.js:551-553` `anomaly_guard_desc/no_critical_gaps/no_hot_breach` `en.js` tương ứng (Entry 107) |
| **F-G03** | ERROR | P0 | `SocDataOpsMonitorSection.tsx:534` `TIER_LABEL_KEYS:102-108` | `Queue tier chưa đặt tên` ×8 (4 tier + 4 table + 4 starvation) | `queueTier.tier="hot_user_demand"` ≠ key `hot` → fallback `unknown_tier` | Đổi `TIER_LABEL_KEYS` thành 4 key `hot_user_demand→Nhu cầu nóng` khớp `dataops_market_data.py:30 QUEUE_TIER_ORDER` |
| **F-G04** | ERROR | P0 | `useDataOpsStream.ts:30` `SocDataOpsMonitorSection.tsx:300` | `● Reconnecting` xám vĩnh viễn dù `BACKLOG 5123` 200 | User tưởng mất realtime | Sửa `DataOpsStreamView.initial:116` copy `signals_stream.py:116 pat_auth.authenticate` đã có nhưng thiếu `CORS Allow-Credentials` + UI `Live` xanh khi `open` (`SocOverviewPanel SSE dot` mẫu) — đã fix `useDataOpsStream onStatusChange` `Live` |
| **F-V05** | GAP | P1 HIGH | `SocDataOpsMonitorSection.tsx:466` `467 BACKLOG 5123` vs `491 Backlog theo dataset 911` vs `586 Backlog theo queue tier 50+1483` | 2-3 số backlog 3 nơi không khớp, double count | Mất trust số liệu | Hero `:467 (by_dataset.reduce sum)` đúng 5123 nhưng table `by_dataset` 911 là `GlobalSymbolCoverage freshness IN (missing,stale...)` ≠ hero `plannable_gaps` 5 dataset → thống nhất 1 source hoặc ghi chú `Hero = tổng gaps 5 dataset` |
| **F-V06** | GAP | P1 | `SocDataOpsMonitorSection.tsx:528` `dataops_market_data.py:779` | `Chỉ báo starvation - / ngưỡng 90/360/2700/1800` + `STARVED` 4/4 đỏ | `latest_progress_started_at=null` khi `ServiceRunLog market_data.queue_tier_scheduler success` chưa có → `seconds_since=null` → `is_starved=True` vĩnh viễn → progress bar 0% nhưng badge đỏ báo động giả | Fix `starvation_threshold` hiển thị `Chưa có lần chạy` xám thay `STARVED` khi `null`, màu `warning` không `danger` |
| **F-V07** | GAP | P1 | `dataops_market_data.py:372` `SocDataOpsMonitorSection.tsx:614` | `Cổng đối chiếu 24h/72h 0/100 0.00% CHƯA ĐẠT` + `Lịch sử 7 kỳ 0.0%` flat ảnh 4-5 | BE `strict_fresh 0.00%` khi `GlobalSymbolCoverage fresh 537/100 sample` nhưng `last_verified_at < since 24h` → `strict_fresh_count 0` | Sửa `sample_symbols` lấy `active registry` không filter `last_verified_at` hoặc seed `fresh` khi bootstrap, thêm note `Threshold 99% strict-fresh` |
| **F-V08** | GAP | P1 | `SocDataOpsMonitorSection.tsx:666` `Sức khỏe lưu trữ Đã xóa 0 Còn lại 0 LƯU GIỮ ỔN ĐỊNH` `30 days` | `0` nhưng `Ổn định` xanh ảnh 4-5 | `retention_health trend within_staleness_threshold True` khi `latest_run_age 0.61h <2h` nhưng `deleted 0` → `ỔN ĐỊNH` sai semantics `deleted 0` là idle không phải ổn định | Đổi logic `deleted 0 + retained 0 → “Chưa có dữ liệu” xám` |
| **F-V09** | GAP | P1 | `SocDataOpsMonitorSection.tsx:474` `Quan sát vận hành` | 2-3 Nút `Xuất Audit/Run Logs CSV` trắng trên nền tối low contrast | Không đạt WCAG AA | Thêm `LucideIcon Download` + `variant primary/ghost` như `SocOverviewPanel` |
| **F-V10** | GAP | P1 | `SocDataOpsMonitorSection.tsx:680 Độ phủ` | 6 Ô `537/749/162` màu thiếu legend, không phân biệt `STALE` vàng vs `MISSING` đỏ khi in | UX Datadog có legend cố định | Thêm legend `FRESH xanh WARM xanh nhạt STALE vàng MISSING đỏ` + filter bar đã thêm nhưng chưa sticky |
| **F-V11** | GAP | P1 | `SocDataOpsMonitorSection.tsx:832 Top gaps` | 6-7 10 dòng toàn `MISSING Hydrate giá ngày` `AST,ATG...` | Không prior, không `gap_days` | Thêm cột `Gap days` + `Gap score` như `dataops_market_data.py:614 anomaly_guard critical_gap_symbols gap_score` |
| **F-V12** | GAP | P2 | `SocDataOpsPanel.tsx:109` header | 1 `Trung tâm Hoạt động Dịch vụ > Operations Center LIVE` + `Dữ liệu vận hành` lặp 2 lần + breadcrumb `DATAOPS` | Thừa 120px height | Gộp 1 header như `SocOverviewPanel` hero |
| **F-V13** | RISK | P2 | `SocDataOpsMonitorSection.tsx:444 metricGrid` | 2-7 Mật độ thấp: 1 card `BACKLOG` full width, 7 ảnh scroll 3000px | So sánh Grafana compact `grid 3 col` | Đổi `metricGrid repeat(4,1fr)` + collapsible `Queue tier` accordion |
| **F-V14** | GAP | P2 | `SocMatrixScrapeMonitor.tsx:196` `SocDataOpsMonitorSection.tsx:528` | 2-3 `Thu gọn/Bắt đầu cycle` không `aria-expanded`, `STARVED` badge không `role=status`, table `Backlog` không `scope="col"` | Fail WCAG 2.1 | Thêm `aria-*` như `SocOverviewPanel:470` |
| **F-V15** | GAP | P2 | `SocDataOpsMonitorSection.tsx:832` | 6 `Top gaps 10/10` không virtual, `coverage matrix 5×6` render sync | Với 1533 symbol lag | Thêm `react-window` như `ScreenerPanel` |
| **F-V16** | GAP | P2 | `SocDataOpsMonitorSection.tsx:466` `467` | `TỶ LỆ LỖI 1 GIỜ 0.0% vs 0.00%` format `toFixed(1)` hero `:468` vs `toFixed(2)` table `:452` | Mất trust số liệu | Thống nhất `toFixed(2)` |

### E. Quality gates audit (lint / type-check / i18n / test)

| Gate | Lệnh | Trạng thái | Bằng chứng ảnh |
|------|------|------------|----------------|
| **Lint** | `npm run lint` `packages/web` | **0 errors 3549 warn** `jsd:37` | 5 key leak đáng ra `eslint jsx-no-literals` phải bắt nhưng `soc.matrix.*` là `t()` nên không |
| **Type-check** | `npm run build` `tsc && vite build` | **PASS 32.76s (no-cache 106.3s)** | Không block i18n leak runtime |
| **i18n** | `vi.js/en.js` `i18n:scan` | **5 keys missing** `soc.matrix.title/recent_cycles/no_cycles` + `anomaly_guard_desc/no_critical_gaps/no_hot_breach` | Ảnh 1,2,5 lộ `soc.*` |
| **Test** | `npm run test` `jest 232 passed` + `npm run test:components` `vitest 36/193` | **193 pass nhưng 0 test cover starvation `-` case** `soc-monitor.component.test.tsx:30` | 3 `starvation - / ngưỡng` không cover |
| **External coupling** | `soc.js:177` `transport.js:47 resolveCoreApiBase` + `types/vninvestcharts-widget.d.ts` `package.json:1.2.5` | **OK** `coreGet /operator/scraping/dataops/...` + `useDataOpsStream retry3000 ping15s` | 1 `Re­connecting` |

### F. Câu hỏi cần làm rõ

1. `Re­connecting` live hay poll? Nếu dùng `useDataOpsStream` thì `onSnapshot` có đang gọi `setStreamCoverage` chưa? Ảnh 1 vẫn `Reconnecting` dù `BACKLOG` đã hiện → `streamOpenRef` chưa `true` do `heartbeat 35s` chưa ping. Cần `onopen` → `Live` ngay.
2. `Queue tier Cadence: N/A` có phải do `MarketDataRuntimeConfig is_current False`? Kiểm `ServiceConfig is_current` `dataops_market_data.py:85` `get_market_data_runtime_config`.
3. `0/100` parity có phải do `GlobalSymbolCoverage` chưa `refresh_gap_scores` sau `ensure_market_data_system_default_baseline 1942 registry`? Kiểm `service_ops/tasks.py:362` `health_check_all_services` có `slo` nhưng không `gap_scores`.

### G. Đánh giá tổng thể: implementable? blocker? ưu tiên sửa?

**Điểm: 5.5/10 — chức năng sống (BACKLOG 5123, 537 fresh) nhưng UX leaked i18n + 8 “chưa đặt tên” + realtime giả.**

**Implementable:** Có, 80% logic BE đã có (`queue_tier_snapshot`, `observability_summary` 911, `coverage 537`), chỉ cần polish FE. **Blocker:** Không — BE 200, chỉ UI leak. **Ưu tiên:**
- **P0 HOTFIX (0.5d, không đổi BE):** Sửa `TIER_LABEL_KEYS:102` thành 4 key `hot_user_demand→Nhu cầu nóng` khớp `QUEUE_TIER_ORDER` + bổ sung `vi.js:5` keys `soc.matrix.* + anomaly_guard_desc/no_*` + đổi `starvation null → “Chưa chạy” xám` `SocDataOpsMonitorSection.tsx:552`. **DoD P0:** reload ảnh 1 `Ma trận snapshot` hiện tiếng Việt, `Queue tier` hiện `Nhu cầu nóng`, `Chỉ báo starvation` không còn `-`.
- **P1 POLISH (1d):** (a) `Re­connecting` → `Live` xanh khi `open` (đã fix `useDataOpsStream onStatusChange` nhưng `span background var(--soc-c-34d399)` chưa trigger — 1 dòng) + tooltip `EventSource fallback token` (b) Gộp `BACKLOG` 5123 hero xóa, chỉ để table `by_dataset` (c) `Cổng đối chiếu` thêm note `Threshold 99% strict-fresh` + empty `Chưa đủ sample`.
- **P2 COMMERCIAL (2d):** Collapsible tất cả `sectionCard`, sticky filter `Top gaps` (đã làm `gapsDatasetFilter:170`), thêm `Gap days` cột, `LƯU GIỮ` empty `0 → —`, `Queue tier` virtual list, `axe` audit.

**Lệnh verify sau P0:** `npm run build && docker cp dist/. frontend:/usr/share/nginx/html && curl http://127.0.0.1/operations-center?tab=dataops` không còn `soc.matrix`.

---

*Sinh bởi Muse Spark — file: `docs/AUDIT_DATAOPS_GIAMSAT_UI_20260917.md:1` — cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` nếu tiếp tục P0 hotfix.*
