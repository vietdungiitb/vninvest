# Implementation Plan — Phase 2 P2 COC (đóng P1 remaining + P2 UX, 4-6 ngày)

> **Ngày**: 2026-09-16
> **Tiền đề**: `docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md` 61 findings → Phase 1 P0 (Entry 84), Phase 2 P1 6 items (Entry 85) + audit follow-up (Entry 86: C1/R-NEW-1/R-NEW-2). Còn lại **13 P1 GAP** ngoài plan 6 item + **~20 P2** + Phase 3 commercial.
> **Mục tiêu**: Đóng toàn bộ P1 còn lại (verification-dẫn), gọn P2 UX, chuẩn bị Phase 3 — giữ `defaultCoreApiAdapter as unknown`, i18n full dấu, `soc.module.css` token.

---

## 0. Verified trạng thái remaining (grep/read ngày 2026-09-16)

| ID | Severity | File:Line thực tế | Tình trạng |
|----|----------|-------------------|-----------|
| COC-05 | GAP P1 | `SocOverviewPanel.tsx:271-273` error branch chỉ `inlineError`, không nút Retry | MỞ |
| COC-06 | ERROR P1 | `SocOverviewPanel.tsx:149-163` stats 6× `filter` toàn mảng | MỞ |
| COC-07 | GAP P1 | `SocOverviewPanel.tsx:174-175,190-191` catch `setError("Failed to toggle/health check.")` generic | MỞ |
| COC-08 | GAP P1 | `SocOverviewPanel.tsx:211-217` `filterButtons` thiếu `maintenance`; `:133-135` critical không gộp maintenance | MỞ |
| COC-09 | GAP P1 | `SocOverviewPanel.tsx:127-129` search chỉ `service_key+name`, thiếu `domain` | MỞ |
| COC-10 | GAP P2 | `SocOverviewPanel.tsx:103-121` không poll 15s | MỞ |
| COC-18 | GAP P1 | `DataOpsContext.tsx:69,101` `getSocBackfillRuns` vs `SocDataOpsOperationsSection.tsx:104` `getSocDataOpsRunLogs` — 2 nguồn runs | MỞ |
| COC-19 | GAP P1 | `SocDataOpsPanel.tsx:103` `isLoading = loading.inventory && loading.runs` — nên `\|\|` (hoặc xuống đủ sớm để skeleton hiện) | MỞ |
| COC-20 | GAP P1 | `SocDataOpsPanel.tsx:85` `hideHeaderTitle:true` ẩn HealthStrip embedded | MỞ |
| COC-28 | GAP P1 | `SocDataOpsOperationsSection.tsx:144-163` preview validate datasets/date nhưng `:184` run check `reason` — đã hợp lệ nhờ `reason:"ops_soc"` default `:141` → **ĐÓNG** (default reason) | ĐÓNG |
| COC-29 | GAP P1 | `SocDataOpsOperationsSection.tsx:120-126` 2 `useEffect` `refreshRuns` + `fetchRunLogs` duplicate | MỞ |
| COC-30 | GAP P2 | `Coming soon` hardcode → i18n | **ĐÓNG** (P1.1) |
| COC-37 | GAP P1 | `SocPrefetchPanel.tsx:80-87` `handlePreview` chỉ `JSON.parse`, không gọi API preview | MỞ |
| COC-38 | GAP P1 | `SocPrefetchPanel.tsx:104-107` `warmSocPrefetchNow("async")` không truyền groups | MỞ |
| COC-39 | GAP P2 | `SocPrefetchPanel.tsx:85,98,108,119` `alert()` blocking | MỞ |
| COC-50 | GAP P2 | `SocDnseBackfillPanel.tsx:62-66` poll 5s conditional đã có, `handleAbort` gọi `fetchJobs` | **ĐÓNG** (P1.3) |
| COC-55 | GAP P2 | scheduler interval dep `[load]` đã đúng | **ĐÓNG** |
| R-NEW-3 | DRY | date-validate ×6: `SocDataOpsOperationsSection.tsx:153-163,192-202` + `SocDnseBackfillPanel.tsx:83-93` lặp block | MỞ |
| COC-57/58/59 | P2 | css 2707 dòng, soc.js 2 namespace, no ErrorBoundary/React Query | MỞ (Phase 3 tech) |
| COC-03/04/14/15/16/17/21-24/31-35/44/45/46/47/60/61 | P2/P3 | UX polish | MỞ |

---

## 1. Phase 2 P2-A — Đóng 13 P1 remaining (2 ngày)

### P2-A1 — Overview Panel (COC-05,06,07,08,09,10) — `SocOverviewPanel.tsx`

- **COC-05 Retry**: error branch `:271-273` thêm button `onClick={fetchData}` `t("soc.overview.retry")` + `aria-label`; hoặc migrate fetch sang `useTenantAdminQuery` stale 15s (tự refetch retry). Ưu tiên **React Query** (nhất quán Sprint 6) — `useTenantAdminQuery({queryKey:["soc-overview"],queryFn:...})` giữ skeleton + error `refetch`.
- **COC-06 stats memo**: gộp 6 `filter` → 1 `reduce` trong `useMemo` `:149-163`.
- **COC-07 err detail**: `handleToggle`/`handleHealthCheck` catch `setError(err instanceof Error ? err.message : t(...))` thay `"Failed to..."`.
- **COC-08 maintenance filter**: `filterButtons` thêm `{key:"maintenance", label:t("soc.overview.filter_maintenance")}` + branch `statusFilter==="maintenance"` (i18n key mới) + critical vẫn gộp unhealthy+critical (maintenance tách riêng).
- **COC-09 search domain**: `:128` thêm `!s.domain?.toLowerCase().includes(q)` — `domain` field có sẵn từ `ServiceItem`.
- **COC-10 poll 15s**: nếu không React Query → `useEffect` `setInterval(fetchData,15000)` + `mountedRef` + `consecutiveErrorsRef` backoff như Signals (Entry 86); nếu React Query → `refetchInterval:15000` + `retry:false` + manual Retry.
- i18n mới: `soc.overview.retry`, `soc.overview.filter_maintenance` (vi.js + en.js) — thêm trước `i18n:scan`.
- **DoD**: 500 hiện Retry; stats 1 pass; lỗi toggle hiện message thật; filter maintenance đúng; tìm theo domain ra; không flash poll.

### P2-A2 — DataOps runs source + skeleton (COC-18,19,20,29) — `DataOpsContext.tsx` + `SocDataOpsPanel.tsx` + `SocDataOpsOperationsSection.tsx`

- **COC-18**: thống nhất hero runs dùng `getSocDataOpsRunLogs` (1 nguồn). `DataOpsContext.tsx:69,101` đổi `getSocBackfillRuns({limit:20})` → `getSocDataOpsRunLogs(1,20)` map `{runs:results,next}`; giữ `BackfillRun` shape (status/run_id/created_at) — verify BE `run-logs/` trả status tương đương. Drop `getSocBackfillRuns` khỏi adapter cast nếu không dùng nữa.
- **COC-19**: `SocDataOpsPanel.tsx:103` `isLoading = loading.inventory || loading.runs` cho skeleton hiện sớm; sau đó mỗi subtab render rule riêng (operations không chờ inventory).
- **COC-20**: `SocDataOpsPanel.tsx:85` bỏ `hideHeaderTitle:true` → truyền `hideHeaderTitle={false}` hoặc xóa prop; HealthStrip tràn qua scheduler embedded (cần cho dataops domain).
- **COC-29**: gộp `useEffect` `:120-126` → 1 effect gọi `refreshRuns()` + `fetchRunLogs(runLogsPage,runLogsPageSize)` (runs context và logs panel là 2 view khác nhau nhưng fetch cùng lúc để giảm chờ), giữ deps đúng.
- **DoD**: hero metrics = RunLogs (không lệch); skeleton hiện khi 1 trong 2 loading; scheduler dataops có health strip; không gọi API thừa.

### P2-A3 — Prefetch preview API + warm groups (COC-37,38,39) — `SocPrefetchPanel.tsx`

- **COC-37**: `handlePreview` `:80-87` thay `JSON.parse` local → gọi API `previewSocPrefetchConfig(parsed)` (verify `soc.js` có `previewSocPrefetchConfig` — nếu không, thêm facade map `POST /operator/soc/prefetch/preview/` tương tự `previewSocVnbrokerConfig`). Render kết quả preview modal `{computed, warnings}` như Vnbroker.
- **COC-38**: `warmSocPrefetchNow` cast `(mode: string)` `:106` → `(mode: string, opts?: {groups?: string[]})` + gửi `{groups: selectedGroups}`. Verify BE warm endpoint nhận `universe_group_ids`.
- **COC-39**: thay 4 `alert()` `:85,98,108,119` bằng `toast` hoặc `inlineError/success` state như Dnse (Entry 85 P1.3) — `alert` khỏi Prefetch.
- i18n: `soc.prefetch.preview_failed`, `warm_success` đã có, thêm `prefetch.purge_error` nếu cần.
- **DoD**: Preview gọi API thật; warm theo nhóm đã chọn; không còn `alert`.

---

## 2. Phase 2 P2-B — P2 UX polish (2 ngày)

| Item | File:Line | Fix |
|------|-----------|-----|
| COC-03 | `ShellOperationsCenterPage.tsx:92-96` | Truyền `description` động theo tab (key `soc.*.*_description`), bỏ eyebrow trùng |
| COC-04 | `soc.module.css:46-63,75` | `.tabButton{flex:0 0 auto}` + `gap:0.5rem`, giữ overflow-x auto |
| COC-10 | Overview poll | (đã nằm P2-A1) |
| COC-14 | `SocSignalsPanel.tsx:66-70` | đã dùng LucideIcon (Entry 86 C1) — **ĐÓNG** |
| COC-15 | `SocSignalsPanel.tsx` `signalTypeLabel` | đã i18n — **ĐÓNG** |
| COC-16 | `SocSignalsPanel.tsx:297-341` | Sentiment bar hiển thị `bullPct.toFixed(1)%`, segment `no_data` màu lược |
| COC-17 | `SocSignalsPanel.tsx:386-442` | `statusColor` map qua `socStatusColors.statusTone` (healthy/degraded/unhealthy) |
| COC-21 | `SocDataInventorySection.tsx:51-53` | `<p>loading` → skeleton grid |
| COC-22/60 | `SocDataInventorySection.tsx:89-92` | `rgb(6,95,70)` → `var(--color-success-500)` |
| COC-23 | `SocDataInventorySection.tsx:148-158` | ratio bar `Math.min(ratio,1)*100` |
| COC-24 | `SocDataInventorySection.tsx:185-212` | accordion `role="button" tabIndex` + `aria-expanded` |
| COC-31 | `SocDataOpsOperationsSection.tsx:402` | `dryRun` checkbox `title=t("soc.dataops.backfill_dry_run_hint")` |
| COC-32 | `SocDataOpsMonitorSection.tsx:256-258` | loading → skeleton |
| COC-33 | `SocDataOpsMonitorSection.tsx:260-273` | `!observability` → hiện `—` thay `0.00%` |
| COC-34 | `SocDataOpsMonitorSection.tsx:402-437` | `seconds_since_last_progress ?? "-"` → `String(...)` vào t() |
| COC-35 | `SocDataOpsMonitorSection.tsx:534-581` | coverage tổng giữ, thêm empty state nếu total 0 |
| COC-44 | `SocScreenerConfigForm.tsx:60-67` | `scan_interval>=10` đồng bộ BE (không 30 cứng) |
| COC-45 | `SocScreenerRuleModal.tsx:36-37` | `overlayStyle` → `styles.drawerOverlay` |
| COC-46 | `SocVnbrokerPanel.tsx:303-310` | dùng chung `getSocVnbrokerMetrics` throughput (1 nguồn) |
| COC-47 | `SocVnbrokerPanel.tsx:415-426` | `is_active` từ `health.is_active` thay `status!=="unhealthy"` |
| COC-61 | `SocConfigPreviewModal.tsx:19-29` | thêm `className:styles.drawerOverlay` (backdrop) |

- i18n keys P2-B: `soc.overview.filter_maintenance`, `soc.screener.scan_interval_hint` (nếu cần), `soc.dataops.capacity_empty` (nếu cần), `soc.vnbroker.is_active` — thêm **trước** `i18n:scan`.
- **DoD**: Không P1 còn lại (sau P2-A) → tổng chỉ còn COC-3/4 P2 cosmetic optional, Phase 3 công nghệ.

---

## 3. Phase 3 — Commercial (P2-P3, 5-7 ngày, backlog riêng)

- **Observability SLO**: `ServiceHealth.uptime_percentage/slo_target/error_budget` BE + burn-rate chart FE (Datadog parity) — cần migration BE + endpoint.
- **Alerting**: mở rộng `tasks.py:1060` `_upsert_retention_health_alert` → toàn domain unhealthy email/webhook.
- **Capacity**: trend `RunLog.duration/queue_depth` + forecast + parity history sparkline.
- **RBAC + Export**: gate SOC tab theo `tenant-admin`, export `ConfigChangeAudit+RunLog` CSV/push S3.
- **Dependency graph**: `ServiceDependency` visual service map.
- **Tech**: tách `soc.module.css` → `soc.tokens.css` + `soc.components.css` (COC-57); namespace `/operator/soc/dataops/` (COC-58); `ErrorBoundary` + `useTenantAdminQuery` toàn panel (COC-59); vitest 4 panel chính.

---

## 4. Thứ tự thực thi (đề xuất)

1. **Ngày 1**: P2-A1 Overview (Retry/React Query + memo + erase generic error + maintenance filter + search domain) — `tsc` + `i18n:scan`.
2. **Ngày 2**: P2-A2 DataOps source + P2-A3 Prefetch API — `tsc` + build.
3. **Ngày 3**: P2-B UX polish batch 1 (Inventory/Monitor/ConfigPreview) — `tsc`.
4. **Ngày 4**: P2-B batch 2 (Vnbroker/Screener/Signals/Scheduler) — `tsc` + build.
5. **Ngày 5**: `npm run lint` + `npm run test:components` (thêm 3 test: Overview retry, Prefetch warm groups, Dnse/Operations validate) + build cuối + ledger Entry 87 + AGENTS.md.

---

## 5. Quality Gates (bắt buộc)

- `npx tsc --noEmit` (packages/web) → 0 sau mỗi sub-step.
- `npm run lint` → 0 errors.
- `npm run build` (`tsc && vite build`) → PASS, không chunk mới >1MB ngoài `widget`.
- `npm run i18n:scan` → 0; keys P2 nằm trong list §P2-A1/P2-B thêm trước scan.
- `vitest run` → PASS (thêm component tests nêu §4 ngày 5).
- BE (nếu đụng `getSocDataOpsRunLogs` map): `manage.py test service_ops` pass.

---

## 6. Rủi ro & Giảm thiểu

- **COC-18 hero mapping drift**: `getSocDataOpsRunLogs` trả `{results,next}` status khác `BackfillRun` → verify BE response shape trước, map field status (`PENDING/RUNNING/SUCCESS/FAILED/ABORTED` vs snake).
- **React Query migrate Overview**: giữ `isSilent`/skeleton nhất quán, `refetchInterval` không gây flash (staleTime > interval).
- **Precache preview API chưa có**: verify `soc.js` hoặc thêm facade — nếu BE thiếu endpoint, fallback text-diff local như hiện tại + note backlog (không block warm).
- **P2-B CSS đụng token**: chỉ dùng `soc.module.css` existing class, không inline hardcode mới.
- **i18n scan fail**: liệt kê đủ keys trước build.

---

## 7. Out-of-scope Phase 2 (đẩy Phase 3)

- SLO/alerting/capacity/RBAC-export/dependency graph — §3.
- css split + namespace + ErrorBoundary — §3 tech.
- Watcher E2E + Lighthouse perf budget.

## 8. Tiến hành

- User chốt phạm vi (chỉ P2-A? cả P2-B? Phase 3 tách sprint?) → bắt đầu P2-A1.
- Sau mỗi phase → ledger + AGENTS.md Done + `build` cuối (như Phase 2 P1).