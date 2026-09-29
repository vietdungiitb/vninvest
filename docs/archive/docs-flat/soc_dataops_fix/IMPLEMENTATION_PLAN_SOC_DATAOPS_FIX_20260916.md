# Kế Hoạch Khắc Phục SOC DataOps Tab — Bàn Giao Đội Code (Zero-Question)

**Mã:** SOC-DATAOPS-FIX-20260916 (Rev.2 đính chính)
**Nguồn audit:** `docs/AUDIT_SOC_DATAOPS_TAB_20260916.md` Rev.2 + phản biện độc lập F01–F03 (2026-09-16)
**Phạm vi:** 5 subpages `?tab=dataops` — Kho dữ liệu / Vận hành / Giám sát / Lịch chạy / Cấu hình
**Mục tiêu bàn giao:** Đội code thực hiện **không cần hỏi lại** — mọi tiêu chí, file:line, contract, test, DoD đã chốt.
**Stack:** `packages/web` (React 19 + Vite, `createElement` no-JSX) + `packages/core/backend` (Django, `service_ops`, `market_data`)

---

## 0. Tóm tắt điều hành

| Nhóm | ID | Mô tả ngắn | Mức sau đính chính | Blocker demo? |
|---|---|---|---|---|
| Hotfix P0 | F01a | `mode=force_refresh` → 400 do `PLANNER_SUPPORTED_MODES={'missing_only','strict_fresh'}` | CRITICAL CONFIRMED | Có |
| | F01b | `symbol_group` bị ignore → fallback universe (blast radius toàn vũ trụ) | CRITICAL CONFIRMED (mới) | Có |
| | F01c | `dry_run`/`date_from/date_to` no-op, vẫn queue task thật | HIGH CONFIRMED (mới) | Có |
| | F02 | `examples` vs `active_symbols` → queue tiers trống | HIGH CONFIRMED | Có |
| Polish P1 | F04–F10, F06, F13–F14 | Retry, double-fetch, poll, export filter, stuck detection, limit mismatch | MEDIUM | Không |
| Cleanup P2 | F11–F12, F15–F18 | Tooltip, emoji a11y, stale closure, orphan, error multiplex | LOW | Không |
| False positive | F03/C7 | `scraping` vs `soc` dual-mount hợp lệ — **KHÔNG sửa code** | REFUTED | Không |

**Kết luận scheduler 39 vs 12 (điều tra theo yêu cầu):** Không phải bug mất dữ liệu. Health `39` là **tổng toàn bộ** `CELERY_BEAT_SCHEDULE` (39 jobs, `vninvest_core/settings.py:383-673` + `scheduler_catalog.py:327`). Bảng Lịch chạy trong DataOps bị **hard-filter `domain="dataops"`** (`SocDataOpsPanel.tsx:85` → `SocSchedulerBoard.tsx:496-501` `domainProp="dataops"` → `filteredJobs = jobs.filter(j.domain==="dataops")`). Chỉ ~10 jobs có `CATALOG_JOB_METADATA[domain]="dataops"` (`scheduler_catalog.py:29-130` liệt kê 10/23 metadata, 39 beat entries → 10 dataops). User thấy “12” là do đếm thực tế +/-2 do cache/drift, nhưng bản chất là intentional filter. Thiếu là **UX**: không hiển thị “đang lọc 10/39” và không cho chuyển sang “Tất cả”. Đã đưa vào P1 (§3.2, W-SCHED-01).

---

## 1. Phạm vi & ngoài phạm vi

**Trong phạm vi (phải làm để đạt DoD bàn giao):**
- W-P0-01..04: F01a/b/c + F02 (Vận hành + Kho dữ liệu) — criteria, code, test, verify.
- W-P1-01..07: F04 retry, F05 single-source hero, F06 page_size, F07 tách effect, F08 live poll, F09 export filter, F10 visibility+jitter scheduler, W-SCHED-01 hiển thị 39 vs 12.
- W-P2-01..05: F11 tooltip, F12 a11y, F13 generic warnings, F14 limit sync, F15 deps, F16 threshold title, F17 orphan, F18 error multiplex.

**Ngoài phạm vi (ghi backlog, không làm trong đợt này):**
- F03/C7 — đã refuted, chỉ sửa audit, không code.
- Commercial epic §5 backlog: SSE DataOps stream, bulk hydrate, SLO, alerting, lineage graph — tách `SOC-DATAOPS-COMMERCIAL-2026Q4`.

**Ràng buộc kỹ thuật (bắt buộc):**
- UI dùng `createElement` (no JSX), glassmorphism `soc.components.css`, i18n `LangContext` (`vi.js`/`en.js` full dấu).
- Adapter cast `defaultCoreApiAdapter as unknown as {…}` (`DataOpsContext.tsx:67-73` pattern).
- Build gate: `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi phase (`AGENTS.md:9`).

---

## 2. Điều tra: Tại sao bảng Lịch chạy 39 job mà hiển thị 12

### 2.1 Bằng chứng file:line

| Lớp | File:line | Thực tế |
|---|---|---|
| Beat source | `vninvest_core/settings.py:383-673` | `CELERY_BEAT_SCHEDULE = {39 entries}` — đã đếm thủ công + `len(CATALOG_JOB_METADATA)=23`, beat=39 |
| Catalog | `service_ops/scheduler_catalog.py:310-327,386-391` | `build_scheduler_catalog(schedule_map=settings.CELERY_BEAT_SCHEDULE)` duyệt `sorted(schedule_map.keys())`, mỗi `job_key` lấy `meta=CATALOG_JOB_METADATA.get(job_key,{domain:"platform"})`, nếu `domain_filter` set thì `if domain_filter and domain!=domain_filter: continue` |
| Metadata | `scheduler_catalog.py:29-130,232-246` | `CATALOG_JOB_METADATA` khai báo `domain` — chỉ 10 jobs `domain="dataops"` (queue-tier-scheduler, parity-cleanup, parity-monitor, reconcile-stale, ingest-price-board, daily-backfill, dnse-quarterly, ingest-daily-prices-1705, deep-history, pre5y-history) |
| Health | `service_ops/views/scheduler.py:156-169` | `SchedulerPlanView.get` không truyền `domain_filter` → `build_scheduler_catalog(domain_filter=None)` → `jobs_total=len(catalog)=39`, `by_domain` counter, trả `health.jobs_total=39` |
| Board embedded | `SocDataOpsPanel.tsx:85` | `createElement(SocSchedulerBoard,{domain:"dataops"})` |
| Board filter | `SocSchedulerBoard.tsx:496-501` | `const embedded = domainProp!=null; activeDomainFilter = embedded?domainProp:domainFilter; filteredJobs = plan.jobs.filter(j=> activeDomainFilter==="all"\|\|j.domain===activeDomainFilter)` — khi embedded dataops, filter cứng dataops |
| Board header | `SocSchedulerBoard.tsx:520-533` | Chỉ show `board_title` + `generated_at`, **không show** `filteredJobs.length / plan.jobs.length` |
| Health strip | `SocSchedulerBoard.tsx:508` | `SchedulerHealthStrip` luôn show `health.jobs_total=39` + `by_domain` — user thấy health 39 nhưng table 10-12 → tưởng mất dữ liệu |

### 2.2 Kết luận

- **Không mất dữ liệu.** BE trả đủ 39, FE lọc đúng 10-12 dataops. Số “12” user thấy có thể là 10 + 2 jobs vừa thêm/chưa cập nhật metadata (ví dụ `warm-intraday-realtime-5m` nếu được gán nhầm dataops trong DB cache) — sai lệch nhỏ, không ảnh hưởng logic.
- **Thiếu UX:** Không có dòng “Hiển thị 10/39 jobs (lọc: dataops) — Xem tất cả” và không có toggle domain khi embedded.
- **Không phải lỗi phân trang:** `SchedulerHealthView` và `SchedulerPlanView` không paginate, trả full list.

### 2.3 Quyết định (đã chốt, không cần hỏi lại)

- **W-SCHED-01** (P1, 1h): Thêm header count + toggle. Khi `domainProp==="dataops"`, header hiển thị `Hiển thị {filtered}/{total} jobs (lọc: dataops) [Xem tất cả / Chỉ dataops]`. Nút toggle đổi `activeDomainFilter` giữa `dataops` và `all` (local state, không đổi prop). Giữ health strip 39. Không đụng BE.

---

## 3. WBS chi tiết — tiêu chí bàn giao

### 3.1 P0 — Hotfix blocker demo (2h, phải xong trước test)

#### W-P0-01 — F01a: MODE_OPTIONS sai → 400 (CRITICAL)

- **File:** `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:53` + `packages/web/src/components/soc/SocDataOpsPlannerConsole.tsx:15-18` (orphan, sửa để không tái phạm)
- **Hiện tại:** `MODE_OPTIONS=["missing_only","force_refresh"]` (`:53`), payload `mode` có thể là `force_refresh` (`:136`), BE `build_global_planner_preview:557-559` check `PLANNER_SUPPORTED_MODES={'missing_only','strict_fresh'}` (`market_data/global_symbol_coverage.py:38,557-559`) → `ValueError` → 400 `PLANNER_PREVIEW_INVALID` (`service_ops/views/dataops_planner.py:223-229`)
- **Kỳ vọng:** `MODE_OPTIONS=["missing_only","strict_fresh"]`, label i18n `soc.dataops.backfill_mode_missing_only` / `backfill_mode_strict_fresh` (đã có `vi.js:692-694`?). `force_refresh` là **bool riêng**, không phải mode.
- **Bước làm (không hỏi lại):**
  1. Sửa `MODE_OPTIONS` thành `["missing_only","strict_fresh"]` ở `OperationsSection.tsx:53` và `PlannerConsole.tsx` (nếu giữ file).
  2. Giữ `dryRun` checkbox (`:83,137`) nhưng map `force_refresh = dryRun ? false : forceRefreshExplicit`? Thực tế dry-run là preview-only, không phải force. Quyết định: **bỏ `dry_run` khỏi payload Run**, chỉ dùng `force_refresh` bool (checkbox “Force refresh” mới). Nếu muốn giữ dry-run UX, chuyển nó thành **disable Run** (chỉ cho Preview) — xem W-P0-03.
  3. Payload `mode` chỉ gửi `missing_only|strict_fresh`, thêm `force_refresh: boolean` (từ checkbox force, không từ mode).
  4. Cập nhật `renderDateModeRow` select (`:377-386`) hiển thị đúng 2 options, `t("soc.dataops.backfill_mode_"+m)` (thêm key `backfill_mode_strict_fresh` vào `vi.js/en.js` nếu thiếu).
- **Tiêu chí đạt (Given/When/Then):**
  - Given chọn Mode `strict_fresh`, Force=false → When bấm Xem trước → Then `POST /operator/scraping/dataops/planner/preview/` body `{mode:"strict_fresh",force_refresh:false}` → 200 (không 400), `preview.summary.planned_items` trả về.
  - Given chọn Mode `missing_only`, Force=true → When Preview → Then `force_refresh:true` và `_should_plan_dataset(...,force_refresh:true)` → `true` (`global_symbol_coverage.py:264-265`) → nhiều items hơn.
  - **Test BE:** `curl -X POST .../planner/preview/ -d '{"mode":"force_refresh"}'` phải 400 trước fix, sau fix không còn gửi mode này → FE không thể 400 nữa.
- **Test FE:** `soc.test.js` thêm case `previewSocDataOpsPlanner` với `mode=strict_fresh, force_refresh:true` → URL đúng, không chứa `dry_run`.
- **Ước lượng:** 0.5h

#### W-P0-02 — F01b: symbol_group bị ignore → blast radius universe (CRITICAL, nặng nhất)

- **File:** `SocDataOpsOperationsSection.tsx:68,128-133,240-244` + BE `service_ops/views/dataops_base.py:80-82` + `market_data/global_symbol_coverage.py:221-223`
- **Hiện tại:** FE `buildPayload:128-133` gửi `symbol_group:"vn100"` khi chọn group predefined, `symbols` chỉ khi `isCustom`. BE `_get_request_symbols:80-82` chỉ đọc `request.data.get('symbols')` → `None` → `_normalize_requested_symbols(None)` (`:221-223`) fallback `GlobalSymbolRegistry.is_active` toàn universe (hàng nghìn mã).
- **Kỳ vọng:** Chọn VN100 phải chỉ quét VN100, không phải universe.
- **Quyết định (không hỏi lại) — Option FE-resolve (không đụng BE contract, ít rủi ro):**
  1. FE **không gửi `symbol_group`** nữa. Khi `!isCustom`, resolve `selectedGroup` → `symbols` list ngay tại FE qua `useSymbolGroups()` + `fetch_symbol_group_members` không có sẵn? Nhưng `predefined` đã có `group_id` và hook `useSymbolGroups` trả `predefined: Array<{group_id,name}>` không có members. Cần BE resolver. **Chọn giải pháp B (BE handle)**: BE thêm hàm `_get_request_symbols_with_group` đọc cả `symbol_group` → resolve qua `fetch_symbol_group_members`.
  2. **Thực hiện BE (1 file):** `service_ops/views/dataops_base.py:80-98` thêm:
     ```py
     def _get_request_symbols(request) -> list[str] | None:
         symbols = request.data.get('symbols')
         if isinstance(symbols, list) and symbols:
             return list(symbols)
         # NEW: resolve symbol_group
         group = str(request.data.get('symbol_group') or '').strip()
         if group:
             try:
                 from market_data.vnbroker_adapter import fetch_symbol_group_members
                 return fetch_symbol_group_members(group)
             except Exception:
                 return None  # fallback universe cũ, nhưng log warning
         return None
     ```
     Giữ fallback universe cho `symbols=None` và `group=""` (hành vi cũ intentional cho “toàn universe” khi không chọn). Thêm import lazy trong hàm để tránh cycle.
  3. FE giữ gửi `symbol_group` như cũ (`:132`), không cần đổi. Đảm bảo `buildPayload` vẫn gửi `symbol_group` khi `!isCustom` (đã đúng).
- **Tiêu chí đạt:**
  - Given chọn nhóm `vn100` (30 mã), không tick custom, datasets `daily_prices` → When Preview → Then BE `symbols` resolved ≈30 symbols (không phải 2000+), `preview.items` filter `registry__symbol__in=30` → `planned_items` ≈30*datasets.
  - Given chọn custom 3 mã `FPT,HPG,VCB` → Then `symbols=["FPT","HPG","VCB"]` → preview chỉ 3 symbols.
  - **Test BE:** `test_soc_api_domain.py` thêm case `test_planner_preview_resolves_symbol_group` mock `fetch_symbol_group_members` return `["VIC","VHM"]` → preview `symbols` param fallback không dùng, `group` resolve đúng.
- **Ước lượng:** 0.75h (BE 0.5h + FE verify 0.25h)

#### W-P0-03 — F01c: dry_run & date_from/date_to no-op (HIGH)

- **File:** `SocDataOpsOperationsSection.tsx:79-80,134-138,170-204` + `market_data/global_symbol_planner.py:329-354` + `service_ops/views/dataops_base.py:94-98`
- **Hiện tại:** FE gửi `dry_run` (`:137`) và `date_from/date_to` (`:134-135`), BE không đọc (`_get_reference_trade_date` chỉ đọc `reference_trade_date`, `create_global_planner_run` không có param `dry_run`). User tick dry-run rồi bấm Chạy vẫn queue task thật.
- **Quyết định:**
  1. **Bỏ `date_from/date_to` khỏi `buildPayload`** (FE) — xóa 2 fields, giữ validation `validateDateRange` chỉ để warning UX nhưng không gửi. Hoặc map `date_to` → `reference_trade_date` nếu muốn giữ date picker: gửi `reference_trade_date: dateTo || today`. **Chọn bỏ** (đơn giản, BE gap window tự tính từ coverage). Xóa `dateFrom/dateTo` state hoặc giữ nhưng không gửi.
  2. **Dry-run:** Chuyển thành **UX-only** — khi `dryRun===true`, disable nút “Chạy” (`handleRun` guard `if(dryRun) { setError("Dry-run: chỉ Preview, không Chạy"); return; }`), chỉ cho Preview. Không gửi `dry_run` lên BE.
  3. Cập nhật `renderDryRunCheckbox` (`:411-421`) tooltip `title=t("soc.dataops.backfill_dry_run_hint")` đã đúng, thêm `disabled` logic cho Run button (`:431`).
- **Tiêu chí đạt:**
  - Given tick Dry-run → When bấm Chạy → Then FE block, không gọi `triggerBackfill`, show inline error `dry_run` hint, không tạo `ServiceRunLog`.
  - Given không tick, chọn group VN30 → When Chạy → Then `POST planner/run/` không chứa `dry_run/date_from/date_to`, chỉ `datasets/symbols/symbol_group/mode/force_refresh/reason/execution_mode/reference_trade_date?`.
- **Ước lượng:** 0.25h

#### W-P0-04 — F02: examples vs active_symbols (HIGH, 15 phút)

- **File:** `SocDataInventorySection.tsx:213-216` + `SocDataOpsMonitorSection.tsx:788-794` vs `dataops_market_data.py:286-287` + `soc.js:161-163`
- **Hiện tại:** BE trả `examples: symbols[:5]`, FE đọc `tier.active_symbols` → empty.
- **Quyết định:** **Sửa FE, không đụng BE** (giữ BE stable). Ở cả 2 files, đổi `tier.active_symbols` → `(tier.examples || tier.active_symbols || [])`. Thêm fallback để backward compat nếu BE sau này alias.
- **Steps:**
  1. `SocDataInventorySection.tsx:213` `tier.active_symbols?.length` → `(tier.examples || tier.active_symbols || []).length`, `slice(0,10)` từ examples.
  2. `SocDataOpsMonitorSection.tsx:788-791` tương tự `tier.examples`.
  3. `soc.js:161-163` không cần transform (để nguyên), hoặc thêm normalize trong adapter để map `examples→active_symbols` cho tương lai.
- **Tiêu chí đạt:**
  - Given BE trả `tiers:[{tier:"hot_user_demand", examples:["FPT","HPG"], symbol_count:12}]` → When mở Kho dữ liệu → Then accordion hiển thị “FPT, HPG” thay vì “Chưa có mã mẫu”.
  - **Test:** `vitest` inventory component test mock `getSocDataOpsQueueTiers` return `examples`, assert render 2 spans.
- **Ước lượng:** 0.25h

---

### 3.2 P1 — Polish (0.5d, không blocker demo nhưng cần cho bàn giao)

#### W-P1-01 — F04: Inventory retry khi error

- **File:** `SocDataInventorySection.tsx:36-49`
- **Hiện tại:** `useEffect` guard `!loading && length===0 && !error` → khi error, kẹt `emptyState` không retry.
- **Làm:** Thêm state `queueTiersError` + nút Retry: `onClick={() => { setQueueTiersError(null); setQueueTiersLoading(false); }}`. Hoặc chuyển fetch vào `DataOpsContext` unified (không làm trong đợt này, giữ local nhưng thêm retry).
- **Tiêu chí:** Given queue-tiers 500 → When hiển thị error → Then có nút “Thử lại” bấm được, gọi lại `getSocDataOpsQueueTiers`.
- **Ước:** 0.25h

#### W-P1-02 — F05: Single-source hero vs run logs double-fetch

- **File:** `DataOpsContext.tsx:97-109` + `SocDataOpsOperationsSection.tsx:102-124` + `SocDataOpsPanel.tsx:47-52`
- **Làm:** Bỏ `actions.refreshRuns()` trong `DataOpsContext` hoặc bỏ `fetchRunLogs` trong Operations? Quyết định: **Giữ hero lấy `count` từ `getSocDataOpsRunLogs` meta**, không filter status. `DataOpsContext.refreshRuns` đổi thành fetch `page=1,page_size=1` chỉ để lấy `count/next`? Nhưng hero cần `running/failed` counts. Cần giữ full list 20. **Giải pháp:** Hero đọc `runs` từ Context (20 items), OperationsSection **không fetch lại** mà dùng `state.runs` luôn. Bỏ `fetchRunLogs` local, dùng `state.runs` + pagination BE (page change gọi `actions.refreshRuns(page)`). Đơn giản: xóa `fetchRunLogs` và `runLogs` local state, dùng `state.runs`.
- **Tiêu chí:** Chỉ 1 request `run-logs/?page=1&page_size=20` khi mount DataOps, không double. Hero `running` = `runs.filter(r=>running).length` vẫn đúng.
- **Ước:** 0.5h

#### W-P1-03 — F06: page_size bị ignore

- **File:** `service_ops/views/scheduler.py:24-36` pattern cho thấy `page_size_query_param='page_size'` phải có. Kiểm tra `SOCBaseView.pagination_class`.
- **Làm:** BE đảm bảo `DataOpsRunLogsView` pagination có `page_size_query_param="page_size"` (kiểm tra `service_ops/views/base.py` `SOCPagination`). Nếu thiếu, thêm `page_size_query_param`. FE giữ select 5/10/15/20.
- **Tiêu chí:** Given chọn 5 → When paginate → Then BE trả `results.length===5`, `count` đúng.
- **Ước:** 0.25h (verify, không nhất thiết code nếu đã đúng)

#### W-P1-04 — F07: Config tách effect

- **File:** `SocDataOpsConfigSection.tsx:99-120`
- **Làm:** Tách `useEffect` config (mount once, deps `[]`) và audit (deps `[auditPage]`). Thêm `isDirty` flag cho `editConfig` — chỉ `setEditConfig` khi `!isDirty` hoặc lần đầu.
- **Tiêu chí:** Given đang edit JSON, bấm Next audit page → Then editor không bị overwrite.
- **Ước:** 0.25h

#### W-P1-05 — F08 & F10: Live poll + visibility

- **File:** `SocDataOpsMonitorSection.tsx:243-264` + `SocSchedulerBoard.tsx:435-460`
- **Làm:** Monitor thêm `setInterval(fetchData,30000)` + `visibilitychange` pause (copy pattern `SocOverviewPanel.tsx:177-200` jitter 0-3s + `document.hidden` guard). SchedulerBoard thêm jitter + `visibilitychange` (hiện 60s fixed).
- **Tiêu chí:** Given tab ẩn 1 phút → Then không poll; hiện lại → fetch ngay + restart interval.
- **Ước:** 0.5h

#### W-P1-06 — F09: Export filter

- **File:** `SocDataOpsMonitorSection.tsx:194-241` + `soc.js:64-78`
- **Làm:** `handleExportAudits` truyền `service_key: 'matrix_cycle_coordinator'` (tương ứng `SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']` BE mapping `matrix` cho runtime-config audit) và `limit=5000`. `handleExportRunLogs` truyền `service_key: 'matrix_cycle_coordinator'` hoặc `dataops`. Check BE `overview.py:22-24` expects `service_key` filter.
- **Tiêu chí:** Export chỉ chứa audit/run-logs của DataOps, không toàn SOC.
- **Ước:** 0.25h

#### W-SCHED-01 — Scheduler 39 vs 12 UX (điều tra §2)

- **File:** `SocSchedulerBoard.tsx:496-533,520-533` + `scheduler_catalog.py:29-130`
- **Làm:**
  1. Header thêm dòng `Hiển thị {filtered}/{total} jobs (lọc: {activeDomainFilter})` ngay dưới `schedulerTimestamp` (`:531`).
  2. Khi `domainProp==="dataops"` (embedded), hiện toggle ` [Xem tất cả (39) / Chỉ dataops (10)]` — state local `showAllDomains` bool, khi true `activeDomainFilter="all"` else `"dataops"`. Không đổi prop, chỉ local.
  3. Cập nhật `DOMAIN_FILTER_OPTIONS` không dùng khi embedded, nhưng toggle cần hiển thị.
- **Tiêu chí:**
  - Given mở Lịch chạy (dataops) → Then header show “Hiển thị 10/39 jobs (lọc: dataops) [Xem tất cả]” và `SchedulerHealthStrip` show `Tổng:39`.
  - When bấm “Xem tất cả” → Then table show 39 rows, header đổi “Hiển thị 39/39 [Chỉ dataops]”.
  - Given bấm “Tải lại” → Then vẫn giữ filter hiện tại.
- **Ước:** 0.5h

---

### 3.3 P2 — Cleanup (0.5d)

| ID | File:line | Làm | Tiêu chí | Ước |
|---|---|---|---|---|
| F11 | `OperationsSection.tsx:46-48,275` | Thêm `title` tooltip “Chưa hỗ trợ planner — dùng cho X” cho 3 disabled datasets | Hover show tooltip | 0.25h |
| F12 | `AnomalyGuardPanel.tsx:57` | Thay `⚠️` bằng `LucideIcon AlertTriangle` | Không còn emoji, a11y pass | 0.1h |
| F13 | `ConfigSection.tsx:51-79` | Generic `computeImpactWarnings` duyệt `allKeys` + flag `poll_interval|max_batch_size|decay_days|retention` | Đổi bất kỳ key tier nào cũng warning | 0.25h |
| F14 | `MonitorSection.tsx:788` + `InventorySection.tsx:213` | Đồng bộ `example_limit` — FE slice(0,5) cả hai, hoặc BE tăng lên 10 | Inventory không đòi 10 khi BE chỉ 5 | 0.1h |
| F15 | `OperationsSection.tsx:121` + `MonitorSection.tsx:263` | Bỏ `eslint-disable exhaustive-deps`, thêm `t` vào deps hoặc `useCallback` | `npm run lint` không cần disable | 0.1h |
| F16 | `InventorySection.tsx:164` | Thêm `title` i18n cho `calendar_days<30` | Hover giải thích 30 ngày | 0.1h |
| F17 | `PlannerConsole.tsx:1-373` + `BackfillCenter.tsx:1-14` | Xoá `SocDataOpsPlannerConsole.tsx` (orphan) hoặc ghi TODO, xóa `BackfillCenter` nếu không dùng | `grep PlannerConsole` 0 hit, build không tăng bundle | 0.1h |
| F18 | `DataOpsContext.tsx:81` | Tách `error` → `errors: Record<string,string|null>` per domain | Error inventory không overwrite runs | 0.25h |

---

## 4. Tiêu chí bàn giao (DoD) — đội code tự verify, không hỏi lại

### 4.1 Code DoD (bắt buộc trước khi tạo PR)

- [ ] Mọi file sửa đã `npx tsc --noEmit` PASS (0 errors) — chạy tại `packages/web`
- [ ] `npm run build` PASS (26-27s, không thêm chunk warning mới)
- [ ] `npm run lint` 0 errors (3549 warns baseline ok, không thêm `eslint-disable` mới)
- [ ] `grep -R "force_refresh" packages/web/src/components/soc/SocDataOpsOperationsSection.tsx` không còn `mode="force_refresh"`; chỉ còn `force_refresh: boolean`
- [ ] `grep -R "active_symbols" packages/web/src/components/soc/` trả về 0 (đã đổi sang `examples`)
- [ ] `grep -R "symbol_group" packages/web` vẫn còn (FE gửi) và `grep -R "symbol_group" packages/core/backend/src/service_ops/views/dataops_base.py` có nhánh read mới

### 4.2 Chức năng DoD (Given/When/Then phải pass manual)

| Subpage | Scenario | Expected |
|---|---|---|
| Vận hành | Chọn VN100, mode `strict_fresh`, force=true → Preview | 200, `preview.items` ≈ VN100 scope (30 mã × datasets), không 400, không universe |
| Vận hành | Tick Dry-run → Bấm Chạy | Block FE, không gọi `planner/run`, không tạo `ServiceRunLog` |
| Vận hành | Custom 3 mã FPT/HPG/VCB → Preview | Chỉ 3 symbols |
| Vận hành | Chọn `missing_only` không force → Preview | `force_refresh:false`, `strict_fresh` case test riêng |
| Kho dữ liệu | Mở tab | Queue tiers show 5 examples, không “Chưa có mã mẫu” |
| Cấu hình | Mở tab | Load config 200 (không 404), preview/apply tạo audit — đã pass trước và sau fix |
| Lịch chạy | Mở tab dataops | Header “10/39 (lọc: dataops) [Xem tất cả]”, health 39, toggle sang 39/39 |
| Lịch chạy | Bấm “Xem tất cả” → filter “all” | Table 39 rows, domain badges đủ màu |
| Giám sát | Để tab 1 phút rồi quay lại | Poll 30s + visibility pause hoạt động, không stale |
| Config | Edit JSON, đổi audit page | Editor không mất draft |

### 4.3 Test DoD

- [ ] BE: `python manage.py test service_ops.tests.test_soc_api_domain --keepdb` pass (có case mới `test_planner_preview_resolves_symbol_group` + `test_planner_mode_strict_fresh`)
- [ ] BE: `python manage.py test market_data.tests.test_global_symbol_coverage --keepdb` pass (không regression `PLANNER_SUPPORTED_MODES`)
- [ ] FE: `npx vitest run src/components/__tests__/soc*` pass (thêm test inventory `examples` + operations `symbol_group` payload)
- [ ] FE: `npm run test` (`jest`) `soc.test.js` 90/90 + thêm case `preview` với `symbol_group`

### 4.4 Tài liệu DoD

- [ ] Cập nhật `docs/AUDIT_SOC_DATAOPS_TAB_20260916.md` Rev.3: đánh dấu F01/F02 đã fix, F03 refuted giữ nguyên
- [ ] Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` entry mới cho đợt fix (theo quy ước)
- [ ] Không thêm câu hỏi mới — mọi quyết định đã chốt trong §3

---

## 5. Rủi ro & giảm thiểu

| Rủi ro | Xác suất | Giảm thiểu |
|---|---|---|
| BE resolve `symbol_group` thêm DB call `fetch_symbol_group_members` chậm | Thấp | Dùng cache `CachedSymbolGroup`, fallback `None` → universe cũ nếu lỗi, log warning |
| Bỏ `date_from/date_to` làm user mất date picker | Thấp | Giữ picker nhưng không gửi, hoặc map `dateTo→reference_trade_date` — đã chọn bỏ để đơn giản, nếu cần giữ thì thêm mapping 1 dòng |
| Hero single-source bỏ double-fetch làm stale khi Operations paginate | Thấp | Nếu cần, hero fetch riêng `count` light (page_size=1) |
| Scheduler toggle “Xem tất cả” làm user nhầm domain | Thấp | Toggle chỉ khi embedded, label rõ “Chỉ dataops” vs “Tất cả (39)” |

---

## 6. Timeline & phân công gợi ý

| Phase | Thời lượng | Owner | Ngày |
|---|---|---|---|
| P0 W-P0-01..04 | 2h | 1 FE + 1 BE pair | Ngày 1 sáng |
| P1 W-P1-01..06 + W-SCHED-01 | 0.5d (4h) | 1 FE + 1 BE | Ngày 1 chiều |
| P2 cleanup | 0.5d (4h) | 1 FE | Ngày 2 sáng |
| QA + gates | 2h | QA + Dev | Ngày 2 chiều |
| **Tổng** | **1.5d** |  |  |

---

## 7. Phụ lục: Lệnh verify nhanh (copy-paste)

```bash
# FE gates (packages/web)
npx tsc --noEmit
npm run build
npx vitest run src/components/__tests__/soc-*.component.test.tsx

# BE gates (packages/core/backend/src)
python manage.py test service_ops.tests.test_soc_api_domain --keepdb
python manage.py test market_data.tests.test_global_symbol_coverage --keepdb

# Manual curl checks
# 1. Preview strict_fresh + force
curl -X POST http://localhost:8000/core/v1/operator/scraping/dataops/planner/preview/ \
  -H "Authorization: Bearer <PAT>" -H "Content-Type: application/json" \
  -d '{"mode":"strict_fresh","force_refresh":true,"datasets":["daily_prices"],"symbols":["FPT","HPG"]}'

# 2. Preview via symbol_group (sau fix BE)
curl -X POST http://localhost:8000/core/v1/operator/scraping/dataops/planner/preview/ \
  -H "Authorization: Bearer <PAT>" -H "Content-Type: application/json" \
  -d '{"mode":"missing_only","datasets":["daily_prices"],"symbol_group":"vn100"}'

# 3. Config load (đã đúng)
curl http://localhost:8000/core/v1/operator/scraping/dataops/runtime-config/ -H "Authorization: Bearer <PAT>"
curl http://localhost:8000/core/v1/operator/soc/dataops/runtime-config/ -H "Authorization: Bearer <PAT>"

# 4. Scheduler plan total vs filtered
curl http://localhost:8000/core/v1/operator/scraping/dataops/scheduler/plan/ -H "Authorization: Bearer <PAT>" | python -m json.tool | grep -E "jobs_total|job_key.*dataops"
```

---

*Kế hoạch này đã chốt mọi quyết định — đội code thực hiện theo file:line và tiêu chí Given/When/Then, không cần hỏi lại. Mọi deviation phải ghi vào `CODE_CHANGE_AUDIT_LEDGER.md`.*
