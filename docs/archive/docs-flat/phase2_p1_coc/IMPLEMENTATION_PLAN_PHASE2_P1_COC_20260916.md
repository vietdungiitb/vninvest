# Implementation Plan — Phase 2 P1 COC (UX Parity, 3-5 ngày)

> **Ngày**: 2026-09-16  
> **Tiền đề**: `docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md` 61 findings, `Entry 84` Phase 1 P0 đã đóng (COC-40/36/01-02/56, tsc 0, build 39.98s).  
> **Mục tiêu Phase 2 P1**: Đóng các **P1 GAP** chặn trải nghiệm vận hành thương mại — validate, real-time, pagination, RuntimeKPI — không đụng contract P0, giữ `defaultCoreApiAdapter as unknown`, i18n full dấu, `soc.module.css` token.

---

## 0. Quyết định cần chốt trước code (D)

| ID | Tham số | Đề xuất mặc định | Ảnh hưởng |
|----|---------|-------------------|-----------|
| **D1** | Signals poll interval | **10s** `setInterval(fetchData,10000)` silent (như `SocMatrixScrapeMonitor:70` 10s) | Real-time feed, không spam `soc_operator_read` 120/min |
| **D2** | DnseBackfill poll | **5s** khi có job `running`, tắt khi idle | Giảm tải, vẫn live |
| **D3** | Validate date range | `date_from <= date_to` + `<=365 ngày` client, lỗi inline trước `preview/run` | Tránh BE 400 generic `dataops_planner.py:213` |
| **D4** | Datasets rỗng | Disable **Chạy** khi `selectedDatasets.length===0` | Tránh 400 `datasets required` |
| **D5** | Screener pagination | **10/trang** rules + results, giữ `slice(0,20)` hiện tại làm fallback | Không vỡ layout khi >20 rules |
| **D6** | RuntimeKPI | **Ẩn tab** nếu chưa có BE (graceful) hoặc ghép `AdminCoreUsagePage` metrics tạm | Xóa placeholder `coming_soon` |
| **D7** | Scheduler `formatLag` | `m` thay `p`, `formatNextRun` kèm date | Đúng i18n |

*User chốt giữ mặc định → thực thi P1 theo thứ tự §8.*

---

## 1. Hiệu chỉnh audit↔code (§1) — bổ sung phản biện 2026-09-16

- **Signals**: sort `localeCompare` `SocSignalsPanel.tsx:166` sai với ISO có timezone — đổi `new Date` diff, đã xác nhận BE trả ISO `detected_at` string.
- **Dnse**: adapter `triggerDnseBackfill` gửi `date_from:""` rỗng `SocDnseBackfillPanel.tsx:60-64` → BE 400, cần `undefined` khi rỗng (đã verify `dataops_planner.py` `reference_trade_date` allow null).
- **RuntimeKPI**: `SocRuntimeKpiPanel.tsx:1-38` placeholder, plan Phase 2 cho phép ẩn tab `SOC_TABS` `ShellOperationsCenterPage.tsx:46` hoặc giữ tab nhưng render `Chip: Sắp ra mắt` + link `AdminCoreUsagePage`.
- **Phase 1.1 C1**: `renderActionRow` `SocDataOpsOperationsSection.tsx:413` disabled chỉ `submitting||previewing||!!activeRun` — thiếu `selectedDatasets.length===0`; cần thêm.
- **Phase 1.1 C2**: `buildPayload:130-136` state `dateFrom/dateTo` (camelCase) vs payload `date_from/date_to` (snake_case) — line ref đã lệch trong plan cũ, sửa trong code (§2 P1.1).
- **Phase 1.2 C3**: `fetchData:132` luôn `setLoading(true)` — poll 10s sẽ flash skeleton mỗi lần; cần `isSilent` flag `MISS-1`.
- **Phase 1.5 C4**: `SocSchedulerBoard.tsx:455-458` `setInterval(load,60000)` deps `[load]` đã đúng, nhưng audit COC-54 `normalizedCaps` fallback `["enable","disable","run_now","abort"]` `SocSchedulerBoard.tsx:188` cho abort khi không hỗ trợ — plan cũ bỏ sót.
- **Phase 1.6 C5**: `SocRuntimeKpiPanel.tsx:33` key `coming_soon` đã có, nhưng plan cần thêm `runtime_kpi.banner_hint/link` + `AdminCoreUsagePage` link — liệt kê i18n §4.

---

## 2. Items P1 (chi tiết file:line + DoD)

### P1.1 — Validate Operations Form (COC-07, COC-25, COC-26, MISS-2/8) — `SocDataOpsOperationsSection.tsx:62-789`

- **Thay đổi**:
  - `buildPayload` trước `preview/run` check `selectedDatasets.length===0` → `setError(t("soc.dataops.backfill_dataset_required"))` (thêm key i18n `vi.js:xxx` + `en.js:xxx`) và disable nút Chạy `SocDataOpsOperationsSection.tsx:413` `disabled={submitting||previewing||!!activeRun||selectedDatasets.length===0}` (C1).
  - `handlePreview` cũng validate `selectedDatasets.length===0` + `isCustom && !customSymbols.trim()` (MISS-8) — không cho preview rỗng → `setError(backfill_dataset_not_supported)`.
  - `dateFrom/dateTo` state (camelCase) → payload `date_from/date_to` (snakeCase) `SocDataOpsOperationsSection.tsx:136-137` (C2): nếu cả hai có giá trị và `dateFrom > dateTo` → lỗi `soc.dataops.error_date_range`; nếu `diffDays >365` → `error_max_range` (key có sẵn `soc.dnse.error_max_range`).
  - `handleRun` khi `runId===""` fallback `t("soc.dataops.backfill_queued")` thay `backfill_queued_with_run`.
  - `DATASETS_WITH_METADATA` `SocDataOpsOperationsSection.tsx:267` `"Coming soon"` hardcode → `t("soc.dataops.backfill_dataset_coming_soon")` (MISS-2).
- **DoD**: Datasets rỗng → nút disabled + preview/run đều lỗi; date ngược/365d → inlineError; `"Coming soon"` đã i18n; `tsc` 0.

### P1.2 — Signals Live Feed real-time (COC-11, COC-05, MISS-1/5, R1/R2) — `SocSignalsPanel.tsx:110-530`

- **Thay đổi**:
  - `fetchData(isSilent=false)` `SocSignalsPanel.tsx:132-133` → `if(!isSilent) setLoading(true)` (MISS-1); `useEffect` `const id=setInterval(()=>fetchData(true),10000)` silent poll; cleanup `clearInterval`; `mountedRef` + `useEffect return` tránh `setSignals` trên unmounted (R1).
  - Poll error handling (R2): `catch` đếm `consecutiveErrorsRef`; sau 3 lần liên tiếp → dừng poll + `setError` 1 lần, không spam toast mỗi 10s; `clearInterval` + log.
  - Fix sort `merged.sort((a,b)=>+new Date(b.detected_at)-+new Date(a.detected_at))` `SocSignalsPanel.tsx:166`.
  - Fix key `key={`${s.type}-${s.id ?? `${s.type}-${s.symbol}-${idx}`}-${s.detected_at}`}` (MISS-5) — giữ ID khi có, fallback stable type+symbol+idx khi `id` null, không perder khi reorder.
  - `TYPE_ICONS` emoji → `LucideIcon` + `signalTypeLabel` dùng `t("soc.signals_overview.filter_*")`.
- **DoD**: Lần đầu skeleton, poll 10s không flash; BE down 3 lần → dừng poll + 1 error; sort đúng; không key collision.

### P1.3 — Dnse Backfill Poll + Validate (COC-49, COC-13, MISS-3/4, R4) — `SocDnseBackfillPanel.tsx:20-205`

- **Thay đổi**:
  - Verify trước: `soc.js` không có `getDnseBackfillJobs` — thực tế dùng `adapters/core/dnse.js:xx` `getDnseBackfillJobs/triggerDnseBackfill` (MISS-4) — grep xác minh trước code, nếu shape `{jobs:[]}` giữ, nếu `{results:[]}` thì map.
  - `handleSubmit` gửi `date_from: dateFrom||undefined` (không `""`) `SocDnseBackfillPanel.tsx:60-64`, validate symbol `/^[A-Z0-9]{3,4}$/` (R4, VN 3-4 chars VCB/FPT, không 6) + lỗi `soc.dnse.symbol_required` + `soc.dnse.symbol_invalid` mới.
  - `alert()` 3 lần `SocDnseBackfillPanel.tsx:52,65,71` → `showToast`/`inlineError` như `SocScreenerPanel:100` (MISS-3).
  - `useEffect` poll `fetchJobs` mỗi 5s khi `jobs.some(j=>j.status==="running")`, cleanup `clearInterval`; R2 backoff tương tự P1.2.
  - `jobs.slice(0,15)` → pagination 10/trang như `SocDataOpsMonitorSection`; `statusBadge` dùng `getStatusBadgeStyle`.
- **DoD**: Symbol `@@` → inlineError; date rỗng → không 400; alert không block; job running tự cập nhật 5s; ngưng poll khi idle.

### P1.4 — Screener Pagination + Toast leak (COC-42, COC-43, MISS-4/6, R5) — `SocScreenerPanel.tsx:100-273,307-352`

- **Thay đổi**:
  - Verify `soc.js:346-354` `getSocScreenerRules` trả `{rules, results}` — thực tế `as unknown as {getSocScreenerRules}` trả `{rules:[]}` raw, nhưng `soc.js` map `results` với `id` fallback; code đọc `rulesData.results||rulesData.rules||[]` (MISS-4).
  - Rules table pagination 10/trang (`rulesPage` state) + Results pagination tách `resultsPage` state (R5) — không share.
  - `showToast` `SocScreenerPanel.tsx:100` `setTimeout 3000` → `const toastTimeoutRef=useRef<number|null>(null)` + `useEffect return()=>clearTimeout` + `showToast` clear trước khi set (MISS-6).
- **DoD**: >20 rules/results đều paginated riêng; rule id luôn có; rời tab trước 3s không leak/crash.

### P1.5 — Scheduler Format + Domain Badge (COC-51,52,53, MISS-7) — `SocSchedulerBoard.tsx:76-107,188`

- **Thay đổi**:
  - `formatLag` `SocSchedulerBoard.tsx:81` `p→m`, giữ `ngày`.
  - `formatNextRun` `SocSchedulerBoard.tsx:90` `toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})` kèm date.
  - `domainBadgeClass` `SocSchedulerBoard.tsx:100` `includes` → `startsWith` (prefetch/dataops/...).
  - `normalizedCaps` fallback `SocSchedulerBoard.tsx:188` `["enable","disable","run_now","abort"]` → sửa thành check `capabilities.includes` strict, không cho abort khi không hỗ trợ (MISS-7, COC-54).
  - `setInterval(load,60000)` `SocSchedulerBoard.tsx:455-458` deps `[load]` đã đúng — giữ, thêm comment why.
- **DoD**: Lag `5m 30s` đúng; next run kèm ngày; badge đúng; fallback không cấp abort sai.

### P1.6 — RuntimeKPI Graceful (COC-48) — `SocRuntimeKpiPanel.tsx:1-38` + `ShellOperationsCenterPage.tsx:46`

- **Thay đổi**:
  - Giữ tab, render `bannerNotice` + mô tả `soc.runtime_kpi.description` + `coming_soon` + link `/admin/core/usage` (key mới `soc.runtime_kpi.banner_hint/link`).
  - Thêm i18n `vi.js`/`en.js` `soc.runtime_kpi.banner_hint: "Tính năng đang phát triển — xem tạm Usage"` + `banner_link: "Mở Usage"`; liệt kê §4 để `i18n:scan` pass (R3).
- **DoD**: Click RuntimeKPI không trống, có hướng dẫn, không 404.

---

## 3. Thứ tự thực thi (đề xuất 3-4 ngày)

1. **Ngày 1**: P1.1 + P1.5 (validate + format) — ít rủi ro, `tsc` nhanh.
2. **Ngày 2**: P1.2 + P1.3 (poll) — cần test `setInterval` cleanup.
3. **Ngày 3**: P1.4 + P1.6 (pagination + KPI) — UI nhiều, `build` chunk check.
4. **Ngày 4**: Buffer + `npm run lint` + `npm run test:components` (thêm 2 test Signals poll + Dnse validate) + `build` 40s + ledger.

---

## 4. Quality Gates (bắt buộc trước merge)

- `npx tsc --noEmit` (packages/web) → 0 sau mỗi sub-step
- `npm run lint` → 0 errors (warnings baseline 3546 giữ)
- `npm run build` (`tsc && vite build`) → PASS <45s, không chunk mới >1MB ngoài `widget`
- `npm run i18n:scan` → 0 — **R3** keys mới phải thêm vào `vi.js` + `en.js` **trước** scan: `soc.dataops.backfill_dataset_required`, `soc.dataops.backfill_dataset_coming_soon` (i18n MISS-2), `screener.opsHint/opsLink` (đã thêm `vi.js:2514`, `en.js:2516`), `soc.runtime_kpi.banner_hint/banner_link`, `soc.dnse.symbol_invalid`
- `vitest run` → PASS, thêm 2 test mới (Signals poll `isSilent`, Dnse validate regex) nếu có

---

## 5. Rủi ro & Giảm thiểu (bổ sung phản biện)

- **Poll spam**: `soc_operator_read` 120/min → 10s poll Signals + 5s Dnse conditional chỉ khi running → <12 req/min, an toàn.
- **Poll memory leak (R1)**: `mountedRef` + `useEffect cleanup clearInterval/clearTimeout` cho Signals `SocSignalsPanel:182` và Dnse `SocDnseBackfillPanel:44` + Screener `SocScreenerPanel:156`.
- **Poll error spam (R2)**: `consecutiveErrorsRef` 3 lần → dừng poll + 1 error, không toast mỗi 10s.
- **i18n scan fail (R3)**: Liệt kê keys §4, thêm trước `npm run i18n:scan`.
- **Dnse regex (R4)**: `^[A-Z0-9]{3,4}$` cho VN (VCB 3, VHM 3, không 6) — test với `VIC, VCB, FPT, VNM`.
- **Screener pagination conflict (R5)**: Tách `rulesPage` vs `resultsPage` state, không share.
- **Date validate drift**: BE vẫn là source truth 365 ngày, FE chỉ pre-check, không chặn BE.
- **Pagination state**: Rules pagination local, không ảnh hưởng BE; Results pagination local slice, không tốn API.

---

## 6. Out-of-scope Phase 2 P1 (đẩy Phase 3)

- SLO/burn-rate, dependency graph, audit export S3, auto-remediation — thuộc Phase 3 `G` audit.
- `soc.module.css` tách tokens (P2) — không đụng P1.

---

## 7. Tiến hành

- User đã chốt D1-D7 mặc định → **bắt đầu P1.1** ngay, `tsc` sau mỗi sub-step như Phase 1.
- Sau P1.6 → cập nhật `AGENTS.md` Done + `CODE_CHANGE_AUDIT_LEDGER Entry 85` + `build` cuối.

