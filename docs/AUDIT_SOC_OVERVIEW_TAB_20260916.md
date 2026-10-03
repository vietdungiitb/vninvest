# Audit Chi Tiết Tab `overview` — `http://localhost/operations-center?tab=overview`

> **Ngày**: 2026-09-16  
> **Phạm vi**: Tab `overview` SOC Operations Center (System Overview) — FE `SocOverviewPanel.tsx` + BE `OverviewSummaryView/SloOverviewView` + contract `soc.js` + i18n + CSS  
> **Khung**: AGENTS.md AI Audit/Research Framework (Nguyên tắc 1-6, B1-B6, đầu ra A-G). Mọi khẳng định kèm `file:line`.  
> **Trạng thái docker dev**: `start_dev.ps1` 2026-09-16 build PASS (frontend 33.37s, `core-api` healthy sau 5s, `No queue drift`, smoke `core-api OK / frontend OK`).

---

## 0. NGUYÊN TẮC BẮT BUỘC — đã tuân

1. Mọi khẳng định kèm `file:line`. 2. Không đoán → "CHƯA XÁC MINH" nếu chưa đọc. 3. Bắt buộc `grep/glob/read`. 4. `CONTRADICTIONS` riêng. 5. Quét `.css/.module.css/config/i18n/adapters`. 6. Chỉ nghiên cứu (không sửa code). 7. Không bịa file. 8. Tiếng Việt.

## 1. ĐỌC TRƯỚC

- `AGENTS.md:1` + `docs/CODE_CHANGE_AUDIT_LEDGER.md:1` (Entry 88-91: Phase 3 SLO `0012`, COMPAT 001/002, xóa 19 lỗi BE `Ran 301 OK`)
- `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md` (20 gaps, Steps 1-3) + `docs/IMPLEMENTATION_PLAN_PHASE3_SOC_COMMERCIAL_20260916.md` (SLO/burn/sparkline Entry 88)
- `docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md` (61 findings COC-01→61, đã fix P0)
- Live stack: `docker-compose.yml` + `docker-compose.dev.yml` + `compose.dev.env` + `start_dev.ps1:1`

## 2. PHẠM VI NGHIÊN CỨU

### A. SOC Overview FE

- `packages/web/src/components/soc/SocOverviewPanel.tsx:1` (666 dòng, panel chính `tab=overview`, `createElement` style)
- `packages/web/src/pages/ShellOperationsCenterPage.tsx:1` (tab router `?tab=overview`, `DOMAIN_TAB_MAP`)
- `packages/web/src/components/soc/SocRuntimeKpiPanel.tsx:1` (burn sparkline 24h, dùng chung `getSocSloOverview`, tab `runtime-kpi` liên đới)
- `packages/web/src/adapters/core/soc.js:33` `getSocOverviewSummary → GET /operator/soc/overview/` + `:46` `getSocSloOverview → /overview/slo-overview/`
- `packages/web/src/components/soc/soc.tokens.css:1` (43 dòng `:root --soc-*`) / `soc.components.css:1` (2715 dòng) / `soc.module.css:1` (`@import` re-export, Entry 88 split)
- `packages/web/src/components/soc/socStatusColors.ts:1` (`getStatusBadgeStyle`, `toneColor`)
- `packages/web/src/i18n/vi.js:193` + `en.js:193` `soc.overview` (10 keys) / `soc.health` (5) / `soc.slo` (9) / `soc.export` (9)

### B. SOC Overview BE

- `packages/core/backend/src/service_ops/views/overview.py:271` `OverviewSummaryView` (summary/by_domain/services)
- `packages/core/backend/src/service_ops/views/overview.py:1020` `SloOverviewView` (uptime_30d/burn_rate_1h/error_budget_remaining + `recent_checks_24h` TruncHour)
- `packages/core/backend/src/service_ops/views/overview.py:459` `ServiceHealthCheckTriggerView` + `:399` `ServiceDetailView.patch` (toggle `is_active`)
- `packages/core/backend/src/service_ops/models.py:126` `ServiceHealth` (+ `slo_target/uptime_30d/burn_rate_1h/error_budget_remaining`) + `models.py:147` `ServiceHealthCheckLog` (migration `0012`)
- `packages/core/backend/src/service_ops/tasks.py:362` `_compute_service_slo` + `settings.py:197` `SOC_ALERT_COOLDOWN_HOURS`/`SOC_SLO_TARGET`
- `packages/core/backend/src/vninvest_core/urls.py:38` mount `market_serving`/`service_ops` tại `core/v1/`

### C. CROSS-PACKAGE / EXTERNAL COUPLING

- web↔core: `defaultCoreApiAdapter as unknown as {getSocOverviewSummary}` `SocOverviewPanel.tsx:123` ↔ `soc.js:33` `coreGet("/operator/soc/overview/")` + `transport.js`; version `package.json` React 19, `vninvestcharts-widget ^1.2.5` (không liên quan overview)
- web↔widget: không (overview không dùng chart)
- dist vs src: không

### D. QUALITY GATES

- Lint: `npm run lint` (packages/web flat, Entry 91 `0 errors, 3547 warnings`)
- Type-check: `npm run build` = `tsc --noEmit && vite build` (Entry 91 `28-38s PASS`)
- i18n: `vi.js:193/en.js:193` + `npm run i18n:scan` (từng BROKEN ESM, đã fix `i18next-scanner.config.cjs` Entry 78)
- Test: `npm run test` (jest 222) / `vitest 30/130` / BE `service_ops 290 + market_serving 11 = 301 OK` (Entry 91)

## 3. PHƯƠNG PHÁP

B1 đọc ledger/AGENTS/plan, B2 `glob` `**/soc/*` (32 files) + `grep` `soc\.overview|getSocOverview|ServiceHealth`, B3 `grep` toàn repo `.css/.module.css/i18n/adapters`, B4 `read` 6 file cốt lõi + trace use-case, B5 đối chiếu plan↔code + `CONTRADICTIONS`, B6 gates + external coupling.

## 4. ĐẦU RA

### TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

**F-OV-01 P0** Toggle `is_active` không RBAC + không confirm modal — bất kỳ `IsAuthenticated` nào cũng `PATCH /services/{key}/` tắt service critical (`SocOverviewPanel.tsx:224` / `overview.py:408`). **F-OV-03 P0** Health-ratio bar chỉ render `healthy/degraded/critical` (`SocOverviewPanel.tsx:378`) bỏ `unknown/disabled/maintenance` → bar tổng <100%. **F-OV-08 P1** SLO fetch `.catch(()=>{services:[]})` (`SocOverviewPanel.tsx:131`) nuốt lỗi BE. **F-OV-04 P1** Maintenance bị nuốt trong `stats`: `else acc.unknown` (`SocOverviewPanel.tsx:215`) không đếm maintenance. **F-OV-13 P1** Chỉ polling 15s (`SocOverviewPanel.tsx:169`), không WebSocket/SSE + không `visibilitychange`.

---

### A. Bản đồ kiến trúc — `tab=overview`

| File | Lines | Trách nhiệm | Note |
|------|-------|-------------|------|
| `packages/web/src/pages/ShellOperationsCenterPage.tsx:1` | ~120 | Tab router `?tab=overview` → `SocOverviewPanel` | `useRouterSearchParams`, `DOMAIN_TAB_MAP` ánh xạ `domain→tab` (`SocOverviewPanel.tsx:50`) |
| `packages/web/src/components/soc/SocOverviewPanel.tsx:1` | 666 | **Panel chính overview** — skeleton, 6 metric cards, health bar, toolbar search+filter, grid 9/pg, SLO badge, 3 actions | `createElement` (không JSX), polling 15s backoff 60s sau 3 lỗi (`:147`), `ITEMS_PER_PAGE=9` (`:40`) |
| `packages/web/src/adapters/core/soc.js:33` | 525 | `getSocOverviewSummary()` → `GET /operator/soc/overview/` + `getSocSloOverview()` → `/overview/slo-overview/` (`:46`) | `defaultCoreApiAdapter` cast `as unknown` (`SocOverviewPanel.tsx:123`) |
| `packages/core/backend/src/service_ops/views/overview.py:271` | 1162 | `OverviewSummaryView.get` — `ServiceDefinition × ServiceHealth` → `summary/by_domain/services` (`:280`) | `SloOverviewView:1020` aggregation `ServiceHealthCheckLog` 24h (`TruncHour`) |
| `packages/core/backend/src/service_ops/models.py:126` | ~200 | `ServiceHealth` (+`slo_target/uptime_30d/burn_rate_1h/error_budget_remaining`) + `ServiceHealthCheckLog` | Migration `0012` (Entry 88) |
| `packages/web/src/components/soc/soc.tokens.css:1` | 43 | `:root --soc-*` tokens glassmorphism | Re-export via `soc.module.css:1` (`@import`) |
| `packages/web/src/components/soc/soc.components.css:1` | 2715 | `.overview*`, `.sloBadges`, `.glassPanel`, `.skeleton` | Đã split khỏi `soc.module.css` 2405 dòng |
| `packages/web/src/components/soc/socStatusColors.ts:1` | ~30 | `getStatusBadgeStyle`, `toneColor` | Dùng cho badge/actionBtn |
| `packages/web/src/i18n/vi.js:193` + `en.js:193` | 5246 | `soc.overview.*` (10 keys) + `soc.health.*` (5) + `soc.slo.*` (9) + `soc.export.*` (9) | Full dấu VI |
| `packages/web/src/components/soc/SocRuntimeKpiPanel.tsx:1` | ~120 | Burn sparkline 24h (tab `runtime-kpi`, dùng chung `getSocSloOverview` `recent_checks_24h`) | Liên đới SLO, không nằm trong `overview` |

### B. Luồng dữ liệu đã trace — Use-case "Mở `?tab=overview`, xem health, toggle, chạy health-check"

1. **User** vào `http://localhost/operations-center?tab=overview` — `ShellOperationsCenterPage.tsx:22` đọc `tab=overview` qua `useSearchParams`, render `<SocOverviewPanel onChangeTab>` (`SocOverviewPanel.tsx:105`).

2. **Mount** `SocOverviewPanel.tsx:166` `useEffect` → `fetchData(false)` + `restartInterval(15000)` (`:158`). `fetchData` (`:120`) `Promise.all([getSocOverviewSummary(), getSocSloOverview().catch(()=>{services:[]})])` (`:129`). Adapter `soc.js:34` `coreGet("/operator/soc/overview/")` → `transport.js` `Authorization: Bearer <PAT|session>` (global `DEFAULT_AUTHENTICATION_CLASSES` `CorePATAuthentication` + `SessionAuthentication`).

3. **BE** `overview.py:274` `OverviewSummaryView.get` — `ServiceDefinition.objects.all().order_by(domain, service_key)` (`:275`) + `ServiceHealth.objects.filter(service__in=services)` (`:278`) → `summary {total,healthy,degraded,unhealthy,unknown,maintenance}` (`:280`) + `by_domain` (`:296`) + `service_rows [{service_key,name,domain,status,is_active,last_check_at,avg_response_ms}]` (`:310`) → JSON `generated_at+summary+by_domain+services`. `SloOverviewView:1023` loop `ServiceDefinition` + `ServiceHealthCheckLog.objects.filter(checked_at__gte=now-24h).exclude(maintenance,unknown).annotate(TruncHour).values(bucket).annotate(checks,failed)` (`:1030`) → `recent_checks_24h` per service (dùng cho sparkline tab `runtime-kpi`).

4. **FE render** — `loading:280` skeleton (`glassPanel` + 6 `overviewSkeletonMetric` + `servicesGrid` 3 cards) → `error:331` `inlineError+Retry` (thay toàn panel) → `stats:204` `services.reduce` 6 metric → `healthBar:378` 3 segment `healthyPct/degradedPct/criticalPct` (`:343`) + `metricGrid:402` 6 cards `METRIC_DEFS:60` (icon `LucideIcon`, `METRIC_COLORS:78` hard-code) → toolbar search `:443` (`searchInput`) + filter `:459` (`filterButtons` `all/healthy/degraded/critical/maintenance/disabled`) → `paginated:198` slice 9 (`ITEMS_PER_PAGE`) → `servicesGrid:486` map `overviewServiceCard` (`:501`) header name+`key·domain` (`:515`) + `statusBadge` `getStatusBadgeStyle(status)` (`:525`) + **SLO badges** (`:529` `sloMap[service_key]` → `uptimePct/budgetPct/burnColor` `>1 red >0.5 yellow`) + stats latency `toFixed(0)ms` (`:570`) + last_check `split("T")[1].slice(0,8)` (`:582`) + actions `handleToggle:224` `updateSocService(key,{is_active:!})` + `handleHealthCheck:240` `triggerSocServiceHealthCheck(key)` + `handleConfigure:256` `DOMAIN_TAB_MAP[config_domain||domain] → onChangeTab(tab)`.

5. **Polling** — `restartInterval:158` `setInterval(fetchData(true),15000)` (`:161`), backoff sau 3 lỗi `consecutiveErrorsRef>=3` → 60000 (`:148`), success reset `hadBackoff→15000` (`:141`). `mountedRef:115` guard unmount.

**Bằng chứng live**: `start_dev.ps1:375` smoke 2026-09-16 `GET http://localhost:8001/core/v1/health OK`, `core-api healthy` sau 5s, `No queue drift`, `Frontend OK`.

### C. CONTRADICTIONS — plan/doc vs code

| # | Plan / Doc | Code thực tế | Tác động |
|---|-------------|---------------|----------|
| C1 | `IMPLEMENTATION_PLAN_PHASE3` §4 SLO: sparkline ở `SocRuntimeKpiPanel` (tab `runtime-kpi`) là đủ | `SocOverviewPanel.tsx:529` chỉ badge số, **không sparkline** trong overview | Overview thiếu trend visual như Grafana; operator phải nhảy tab |
| C2 | `overview.py:122` `ServiceSummaryRowSerializer` không có `slo_*` | `SloOverviewView:1020` SLO riêng, FE gộp 2 endpoint (`Promise.all :129`) không atomic | Snapshot lệch thời gian; SLO fail thì badge rỗng (F-OV-08) |
| C3 | `OverviewSummaryView:226` summary gồm `maintenance` (`:58` `maintenance`) | FE `stats:219` `maintenance` không đếm (`// keep unknown 0`), `METRIC_DEFS:60` không có `maintenance`, healthBar `:378` không segment maintenance | Metric BE↔FE lệch, UI ảo |
| C4 | `SloOverviewView:1011` `burn_rate_1h` normalize theo `slo_target` | FE `burnColor` `:536` ngưỡng cứng `>1 red >0.5 yellow` không theo `slo_target` | Service SLO 99.9 vs 99.5 cùng màu sai |
| C5 | `soc.tokens.css` là SSOT token (AGENTS.md Constraints) | `SocOverviewPanel.tsx:88` `METRIC_BORDER_COLORS/METRIC_ICON_BG` hard-code `rgba(...)` không `var(--soc-*)` | Drift token, đợt split CSS Entry 88 chưa migrate hết |
| C6 | `AUDIT_OPERATIONS_CENTER_COMPREHENSIVE` COC-08 maintenance filter phải có metric | `filterButtons:270` có `maintenance` nhưng `METRIC_DEFS` thiếu, `emptyState:483` hard-concat `filter_all + unknown_value` không i18n key | Trải nghiệm thiếu nhất quán |

### D. Findings — `tab=overview` (ID | Mức | file:line | Thực tế | Tác động | Đề xuất)

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất |
|----|-----|-----------|---------|----------|---------|
| **F-OV-01** | <ERROR> **P0** | `SocOverviewPanel.tsx:224` `updateSocService` + `overview.py:408` `is_active` | Không check `IsStaff/IsSuperuser/SOCRole`, không confirm modal, không `change_reason` | Bất kỳ `IsAuthenticated` cũng tắt service critical → outage | BE `permission_classes=[IsStaff\|SOCRole]` + FE confirm modal + `reason` textarea → `change_reason` + toast + audit `by_domain` |
| **F-OV-02** | <ERROR> **P0** | `SocOverviewPanel.tsx:331` `if(error) return <div>inlineError+Retry` | `error` (dù chỉ SLO fail) thay toàn panel, mất `servicesGrid` đã có | Mất tầm nhìn khi mạng chập chờn | Tách `errorBanner` non-blocking (giữ grid), retry chỉ fetch lại |
| **F-OV-03** | <GAP> **P0** | `SocOverviewPanel.tsx:343` `healthyPct…` + `:378` bar 3 segment | Bar chỉ `healthy/degraded/critical`, bỏ `unknown/disabled/maintenance` → bar <100% | Hiểu sai health | Thêm 3 segment `unknown/disabled/maintenance` với `var(--soc-c-*)` hoặc donut 6 phần |
| **F-OV-04** | <ERROR> **P1** | `SocOverviewPanel.tsx:215` `else if(maintenance){ // keep unknown 0 }` | `maintenance` không tăng `unknown` cũng không riêng → `stats.unknown` sai, sum ≠ total | Metric sai BE vs FE | `else if(maintenance) acc.maintenance++` + thêm `maintenance` vào `METRIC_DEFS` (hoặc gộp rõ) |
| **F-OV-05** | <GAP> **P1** | `SocOverviewPanel.tsx:582` `split("T")[1]?.slice(0,8)` | Chỉ giờ UTC `HH:MM:SS`, không ngày, không timezone, không relative | Nhầm ca trực | `Intl.DateTimeFormat` local + `formatDistanceToNow` + tooltip ISO full |
| **F-OV-06** | <GAP> **P1** | `SocOverviewPanel.tsx:179` `filter` + `:451` search | Không debounce 300ms, không highlight, không `by_domain` group | Lag 50+ services | `useDebounced(search,300)`, highlight match, group domain accordion |
| **F-OV-07** | <GAP> **P1** | `SocOverviewPanel.tsx:529` SLO badges | Burn color cứng `>1/>0.5`, không theo `slo_target`; `is_active=false` vẫn hiện | Đánh giá SLO sai | Tính theo `error_budget_remaining` + ẩn SLO khi `!is_active` |
| **F-OV-08** | <RISK> **P1** | `SocOverviewPanel.tsx:131` `catch(()=>{services:[]})` | Nuốt lỗi SLO, badge trống không biết "chưa probe" hay "BE sập" | Che lỗi | Bỏ catch, `setSloError` + banner riêng |
| **F-OV-09** | <GAP> **P1** | `overview.py:296` `by_domain` BE trả nhưng FE không dùng | Mất view domain treemap như Datadog | Thiếu bức tranh domain | Thêm `DomainHealthStrip` pills `domain healthy/total` → click filter |
| **F-OV-10** | <GAP> **P1** | `SocOverviewPanel.tsx:636` pagination `prev/next + page_of` | Không page numbers, jump, `results 1-9 of 42`, sort | Khó điều hướng 30+ services | Thêm `pageNumbers`, `pageSize 9/18/36`, `sortBy` |
| **F-OV-11** | <RISK> **P1** | `SocOverviewPanel.tsx:1` `createElement` + `soc.components.css:2715` | Không JSX → khó đọc, thiếu `aria-*` metric/pagination, `filterBtn` không `aria-pressed` | A11y fail WCAG | Chuyển JSX, `aria-pressed`, `role="status"`, `aria-live` |
| **F-OV-12** | <GAP> **P2** | `SocOverviewPanel.tsx:88` hard-code `rgba` | Trùng token `soc.tokens.css` (`C5`) | Drift theme | Dùng `var(--soc-*)` class |
| **F-OV-13** | <GAP> **P2** | `SocOverviewPanel.tsx:158` `setInterval(...,15000)` | Không `visibilitychange` pause, không jitter → tab ẩn vẫn poll, thundering herd | Tốn tài nguyên | `visibilitychange` pause/resume + `delay+random(0,3000)` |
| **F-OV-14** | <GAP> **P2** | `soc.js:42` `getSocHealthStatus` không dùng | FE không hiện `health_status_counts` global (`HealthStatusView:856`) | Thiếu tổng quan | Dùng `getSocHealthStatus` cho donut global |
| **F-OV-15** | <GAP> **P2** | `SocOverviewPanel.tsx:120` chỉ `useEffect` polling | Không `WebSocket/SSE` realtime, không `ETag` | Trễ 15s vs commercial | P2 `EventSource /operator/soc/stream/health/` |
| **F-OV-16** | <GAP> **P2** | `SocOverviewPanel.tsx:256` `DOMAIN_TAB_MAP` | Thiếu `platform/realtime/cache/analytics` → `Configure` ẩn (`hasConfig` false) | Lúng túng | Mở rộng map + fallback `services` tab |
| **F-OV-17** | <GAP> **P2** | `SocOverviewPanel.tsx:483` `filter_all + unknown_value` hard-concat | Không i18n key riêng | I18n cứng | Thêm `soc.overview.empty_filtered` |
| **F-OV-18** | <GAP> **P2** | `overview.py:320` `generated_at=now()` naive | Không cache, mỗi poll full scan `ServiceDefinition+ServiceHealth` | Perf 100 services | `ETag`/`304` hoặc `max(updated_at)` |
| **F-OV-19** | <GAP> **P3** | `SocOverviewPanel.tsx:352` `glassPanel` không `role` | Thiếu landmark `check:shell` | Warn | `role="region" aria-label` |
| **F-OV-20** | <RISK> **P3** | `SocOverviewPanel.tsx:589` inline `background: rgba` | CSP `style-src` | Bảo mật | Class `.disableBtn/.enableBtn` |

### E. Quality Gates Audit

| Gate | Lệnh | Kết quả | Chuẩn thương mại | Gap |
|------|------|---------|------------------|-----|
| **Lint** | `npm run lint` (flat) | Entry 91 `0 errors, 3547 warnings` (`react/jsx-no-literals`) | 0 errors, <100 warn | Warnings cao nhưng không block; `createElement` lách `jsx-no-literals` |
| **Type-check** | `npx tsc --noEmit` (Entry 91) | `0` | 0 | Đạt, nhưng `as unknown as {getSocOverviewSummary}` (`:123`) mất type safety |
| **Build** | `npm run build` (`tsc && vite`) | `28-38s PASS`, chunk `widget 2,218k` warn | PASS <1M | `widget` code-split async nên OK |
| **i18n** | `vi.js:193/en.js:193` + `i18n:scan` | `soc.overview` 10 keys, `health` 5, `slo` 9 full VI dấu; `scan` đã fix `cjs` Entry 78 | 100% no hard-string | Đạt; còn `filter_all + unknown_value` concat (F-OV-17) |
| **Test** | `jest 222` / `vitest 30/130` / BE `301 OK` | Entry 91 `301 OK`; SOC component `soc-p2` 3 tests (overview retry) **không có test metric/maintenance/bar/SLO** | Bloomberg: overview E2E + visual regression | Thiếu test chuyên biệt (F-OV-04/03 không bị bắt) |

> **Kết luận gates**: Build/type/i18n pass nhưng **không chứng minh overview đúng** do thiếu test.

### F. Câu hỏi cần làm rõ

1. `ServiceHealth.status` enum chính thức gồm `healthy/degraded/unhealthy/unknown/maintenance` hay `critical`? FE map `critical→status_critical` (`:44`) nhưng BE `summary:58` không có `critical` → key lẻ.
2. `is_active=false` có nên ẩn SLO badge không?
3. `DOMAIN_TAB_MAP` có cần `platform/data_ingest/realtime` không?
4. Polling 15s × 2 req/poll = 32 req/min có vượt `UserRateThrottle 120/min` khi 4 tab SOC cùng mở?
5. `by_domain` có nên kèm `health_status_counts` để FE không tự reduce?

### G. Đánh giá tổng thể & Lộ trình nâng cấp đạt chuẩn full tính năng (Datadog/Grafana/AWS OpsCenter/Bloomberg)

**Mức hiện tại**: 6.5/10 — đủ vận hành nội bộ (health list + toggle + SLO badge + poll/backoff) nhưng chưa đạt chuẩn thương mại (thiếu RBAC, domain view, metric lệch, a11y, realtime).

**Không blocker** để giữ tab, nhưng **P0 F-OV-01/03 phải fix trước khi mở rộng**.

**P0 — Hotfix 0.5 ngày** (không đổi contract):
- F-OV-01 BE `IsStaff|SOCRole` + FE confirm modal + `change_reason`
- F-OV-03/04 bar 6 segment + `maintenance` metric
- F-OV-08 tách `sloError` banner
- C5 token `var(--soc-*)`

**P1 — Parity thương mại 2 ngày** (parity Grafana):
- F-OV-09 `DomainHealthStrip` từ `by_domain`
- F-OV-05 relative time + tooltip
- F-OV-06 debounce + sort + highlight
- F-OV-10 pagination numbers + pageSize + `1-9 of 42`
- F-OV-02 error non-blocking
- Tests: `SocOverviewPanel.test.tsx` 6 cases

**P2 — Realtime & A11y 3 ngày** (parity Datadog):
- F-OV-15/13 `EventSource /stream/health/` + `visibilitychange` + jitter
- F-OV-11 JSX + `aria-pressed`/`role` + `check:shell`
- F-OV-14 global donut từ `HealthStatusView:856`
- F-OV-18 `ETag`/`304` hoặc `React Query`
- Drawer `ConfigChangeAudit` recent

**P3 — Nice-to-have** (Bloomberg):
- Export health history CSV (`SocExport*View:1089`)
- Dependency graph domain
- Maintenance window scheduler (`SOC_ALERT_COOLDOWN_HOURS`)

**Ưu tiên**: P0 ngay (1 PR), P1 sprint, P2 sau P1.

---

## 5. ĐẦU RA NGẮN

5 lỗi nặng nhất: P0 toggle không RBAC/confirm (`SocOverviewPanel.tsx:224`), P0 bar thiếu `unknown/disabled/maintenance` (`:378`), P1 nuốt lỗi SLO (`:131`), P1 maintenance không đếm (`:215`), P1 chỉ polling 15s không realtime (`:169`). Fix 5 này + `DomainHealthStrip` là đủ 8.5/10 chuẩn thương mại.

---

*Evidence*: `docker ps` 2026-09-16 `core-api healthy`, `GET /core/v1/health 200`, `npx tsc 0`, `Ran 301 OK`, `soc.js:33`, `overview.py:271`, `soc.tokens.css` 43 dòng, `vi.js:193` — mọi khẳng định có `file:line`, không đoán.
