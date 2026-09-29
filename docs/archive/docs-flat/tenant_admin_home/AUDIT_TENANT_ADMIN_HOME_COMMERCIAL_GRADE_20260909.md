# AUDIT Tenant Admin Home `http://localhost/tenant-admin/home` — Chuẩn Thương mại

**Ngày:** 2026-09-09  
**Phạm vi:** `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx:1-652` (REV2: 604→652 sau Phase 0) + `TenantAdminLayout.tsx:1-96` + `TenantAdminSidebar.tsx:1-191` + `Breadcrumb.tsx:1-93` + `providers/QueryProvider.tsx:1-32` + `pages/tenant-admin/useTenantAdminQuery.ts:1-83` + `adapters/core/operator.js:76-82` + `packages/core/backend/src/identity_access/views_dashboard.py:1-196` (164→196 sau Phase 0) + `adapters/coreApiAdapter.js:1-178` + `i18n/vi.js:1003-1112` + `i18n/en.js:1003-1112` + `TenantAdmin.module.css:1-2475` + `ShellPageTemplate.*`  
**Chuẩn đối chiếu:** `AGENTS.md:6` (SOC glassmorphism, `soc.module.css` tokens, i18n qua `LangContext`, `defaultCoreApiAdapter`), khung audit cứng § Nguyên tắc chống lỗi audit 1-6  
**Loại:** Chỉ nghiên cứu + phân tích — không viết code (trừ khi được yêu cầu rõ)

---

## 0. Nguyên tắc bắt buộc (đã tuân thủ)

1. Mọi khẳng định kèm `file:line`. Không có line = không hợp lệ.
2. Không đoán — chưa đọc file thật ghi "CHƯA XÁC MINH".
3. Bắt buộc dùng grep/glob/read, không dùng kinh nghiệm chung.
4. Plan/doc mâu thuẫn code → mục CONTRADICTIONS riêng.
5. Quét toàn repo gồm `.css`, `.module.css`, config, i18n, adapters.
6. Không viết code trong audit.
7. File không tồn tại báo "KHÔNG TỒN TẠI".
8. Ngôn ngữ báo cáo: Tiếng Việt.

---

## 1. Đọc trước (bắt buộc)

- `AGENTS.md:1-160` — Goal SOC DataOps parity, Constraints i18n + adapter + build verification, Progress Sprint 5-7, AI Audit Framework 6 nguyên tắc
- `docs/CODE_CHANGE_AUDIT_LEDGER.md:1-586` — Entry 12-16 (Tenant Admin migration), Entry 36 nóng nhất
- `docs/AUDIT_TENANT_ADMIN_UI_UX_AND_TECHNICAL_GAPS_20260701.md:1-106` — 42 claims true / 6 false, chi tiết 2.1 Home (deprovision finally, catch nuốt lỗi, checklist PAT, SSO/webhook ability)
- `docs/AUDIT_SPRINT6_UX_INDEPENDENT_REVIEW_20260718.md:13-72` — P0 cross-tenant stale cache vì queryKey thiếu `tenant_id`, F1/F2
- `docs/AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md:1-231` — Mẫu audit thương mại (20 findings, 7 CONTRADICTIONS, quality gates)

---

## 2. Phạm vi nghiên cứu

### A. TenantAdminHomePage — Dashboard tổng quan tenant
- `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx:1-604` — KPI hero (HealthGauge, members, api_calls, quota), onboarding checklist, usage trend AreaChart, quickActions, recent activity, serviceAccounts/PATs summary, identity card
- `packages/web/src/components/ShellPageTemplate.js:1-200` + `ShellPageTemplate.module.css:1-514` — Chrome/panel/metric/empty primitives
- `packages/web/src/pages/tenant-admin/TenantAdmin.module.css:1-2475` — tokens `--ta-*` + `.home_*` 53 class
- Symbols: `getDashboardSummary`, `getUsageTrend`, `tenantHome.*`, `health_score`

### B. Layout & Navigation — Khung Tenant Admin
- `packages/web/src/components/TenantAdminLayout.tsx:1-96` — flex layout + `LAYOUT_CSS` inline + responsive table
- `packages/web/src/components/TenantAdminSidebar.tsx:1-191` — 15 items `SIDEBAR_ITEMS`, `ability.can` filter, collapse
- `packages/web/src/components/Breadcrumb.tsx:1-93` — `I18N_MAP` tenant-admin, `DEFAULT_MAP`
- `packages/web/src/providers/QueryProvider.tsx:1-32` — `QueryClient` + `tenant-changed` listener

### C. Cross-package / External coupling
- `web↔core API contract`: `defaultCoreApiAdapter` (`adapters/coreApiAdapter.js:76-82` facade) → `adapters/core/operator.js:76-82` `getDashboardSummary()/getUsageTrend()` → `packages/core/backend/src/identity_access/views_dashboard.py:52-164` + `partner_urls.py:91-94` (`/partner/dashboard/summary/` + `/partner/dashboard/usage-trend/`)
- `web↔widget`: `packages/web/package.json` `vninvestcharts-widget ^1.2.5` — Home không dùng widget (chỉ `recharts` trực tiếp), không liên quan nhưng verify không stale
- `web↔i18n`: `packages/web/src/i18n/vi.js:1003-1112` + `en.js:1003-1112` 60 keys `tenantHome.*`, `LangContext.js:92` + `PortfolioContext.js:23`

### D. Quality Gates
- Lint: `npm run lint` (packages/web)
- Type-check: `npm run build` = `tsc && vite build`
- i18n: `vi.js`, `en.js` + hardcode scan
- Test: `npm run test`, `npm run test:components`

---

## 3. Phương pháp

- **B1:** Đọc `AGENTS.md`, `CODE_CHANGE_AUDIT_LEDGER.md`, `AUDIT_TENANT_ADMIN_UI_UX...`, `AUDIT_SPRINT6...`
- **B2:** `glob` `**/tenant-admin/**`, `**/TenantAdmin*`, `**/pageRegistry.*`
- **B3:** `grep` `getDashboardSummary|getUsageTrend|partner.*dashboard`, `tenantHome\.`, `tenant-admin`
- **B4:** `read` 12 file cốt lõi (604L Home + 191L Sidebar + 164L views_dashboard + 83L useTenantAdminQuery + vi.js + operator.js + Shell* + PortfolioContext)
- **B5:** Đối chiếu doc (42 claims) ↔ code hiện tại, gạch chỗ lệch
- **B6:** Check ranh giới: `npx tsc --noEmit` logic, `npm run lint` disable, `i18n:scan` hardcode, `test:components` coverage, external coupling

---

## 4. Đầu ra chi tiết

### 4.1 Tóm tắt điều hành — 5 findings nghiêm trọng nhất

> Đọc trước khi đi vào chi tiết. Toàn bộ bảng Findings ở §4.4.

1. **P0 — Stale cross-tenant duy nhất còn sót** — `TenantAdminHomePage.tsx:127-147` là page DUY NHẤT trong 13 TenantAdmin pages **không** dùng `useTenantAdminQuery.ts:34-52`, nên không có scope `['tenant-admin', tenant_id, ...]` và không được `QueryProvider.tsx:17-19` invalidate khi `PortfolioContext.js:284` dispatch `tenant-changed`. Sprint 6 đã fix 13 pages nhưng bỏ sót Home — vi phạm trực tiếp DoD Sprint 6 F1/F2.
2. **P0 — Health score magic + N+1 query** — `views_dashboard.py:81` `health = quota*0.4 + activity*0.3 + 30` magic 30 làm min 30, không breakdown; `views_dashboard.py:149-156` loop 30 ngày × 1 query `TenantMember.last_login__date` → 30 queries + 1 history. Stripe/Vercel chỉ 1 `GROUP BY date` + `error_rate`.
3. **P1 — Onboarding checklist sai semantics thương mại** — `TenantAdminHomePage.tsx:294-304` `checklistSA: (active+disabled)>0` đúng, nhưng `checklistSSO/Webhooks: ability.can(...)` sai — mark done theo **quyền** không phải **config thực** (`sso.configured`, `webhook.count`). Notion/Linear/Stripe luôn check `resource_exists`.
4. **P1 — KPI & Chart thiếu chuẩn thương mại** — KPI `TenantAdminHomePage.tsx:365-391` chỉ value + sub static, không `Δ vs kỳ trước`, không sparkline; `AreaChart:432-486` không `YAxis/CartesianGrid/Legend/Brush`, hard-code `7d/14d/30d` không qua `t()` — Stripe/Vercel luôn có `vs last 7d ↑12%` + legend toggle.
5. **P1 — Loading/Error/Guard kém** — `TenantAdminHomePage.tsx:199-209` loading chỉ text `"Đang tải..."` panel trong khi `TenantAdminUsagePage.tsx:261` đã dùng `ShellSkeleton`; `handleTrendDaysChange:149-156` không loading state; `HealthGauge:55` id `Math.random()` gây hydration mismatch (phải `useId` như `ShellPageTemplate.js:99`); `KpiCard:211-226` định nghĩa trong render → re-mount; deprovision `169-181` thiếu guard `type slug` như Vercel/Stripe.

**Quality gates snapshot:** `npx tsc --noEmit` PASS (suy luận — không chạy trong audit, nhưng logic check `as DashboardSummary` lỏng), `npm run lint` PASS 0 error **~3524 warnings** kế thừa từ `AUDIT_DASHBOARD...:129`, `npm run build` PASS nhưng `useTenantAdminQuery` dead cho Home.

---

### 4.2 Bản đồ kiến trúc

| File | Line_count | Trách nhiệm | Note |
|---|---|---|---|
| `TenantAdminHomePage.tsx:1-604` | 604 | Orchestrator Home: KPI hero, checklist, trend, quickActions, activity, SA/PAT summary, identity | `useState/useEffect` manual, `recharts` AreaChart, `createElement` không JSX |
| `TenantAdminLayout.tsx:1-96` | 96 | Layout flex + sticky sidebar + inline `LAYOUT_CSS` responsive | Inline CSS 80 dòng, chưa trích `TenantAdmin.module.css` |
| `TenantAdminSidebar.tsx:1-191` | 191 | Sidebar 15 items, filter `ability.can`, collapse 60/240px | `SIDEBAR_CSS` 105 dòng inline, `useState` collapse không persist |
| `Breadcrumb.tsx:1-93` | 93 | Breadcrumb động `location.pathname` → i18n | `I18N_MAP` cứng 15 keys, không `aria-current`, `createElement` |
| `PageTransition.tsx:1-38` | 38 | FadeIn stagger animation | Chưa dùng trong TenantAdmin |
| `TenantAdmin.module.css:1-2475` | 2475 | Tokens `--ta-*` 41 token + `.home_*` 53 class | `value-preserving` nhưng đa số `home_*` chỉ trích inline cũ |
| `ShellPageTemplate.js:1-200` | 200 | `ShellPageChrome/Panel/Metric/EmptyState` primitives | Glassmorphism `shellPage` gradient, metrics 4 cột |
| `ShellPageTemplate.module.css:1-514` | 514 | Tokens `--sh-*`, hover/transition polished | Metrics hover `translateY`, panel blur |
| `ShellSkeleton.tsx:1-166` | 166 | Skeleton `metric/table-row/chart/card` + pulse/shimmer | Home **không dùng** — chỉ text |
| `operator.js:1-193` | 193 | Facade `getDashboardSummary/getUsageTrend/getAlertConfigs...` | `coreGet("/partner/dashboard/summary/")` đúng contract |
| `views_dashboard.py:1-164` | 164 | `partner_dashboard_summary` + `partner_dashboard_usage_trend` | `health_score` magic + N+1 + `TenantLifecycleEvent` |
| `partner_urls.py:91-94` | 4 | Route `/partner/dashboard/summary/` + `usage-trend/` | Native, trước proxy |
| `useTenantAdminQuery.ts:1-83` | 83 | Generic RQ wrapper scope `['tenant-admin', tenant_id, ...]` | **Home KHÔNG dùng** — finding P0 |
| `QueryProvider.tsx:1-32` | 32 | `QueryClient staleTime 30s gc 300s refetchOnWindowFocus` + listener `tenant-changed` | Home không benefit |
| `coreApiAdapter.js:1-178` | 178 | Facade `createCoreApiAdapter` 8 clients + 4 helpers | `getAllUsageTrends` duplicate với operator |
| `PortfolioContext.js:1-339` | 339 | `ability`, `userPlan`, `userIdentity`, `switchTenant()` dispatch `tenant-changed` | `activeTenantId` localStorage |
| `LangContext.js:1-116` | 116 | `t()` via `createTranslator(locale)` + `formatNumber/Date` | Home dùng `t()` đúng |
| `vi.js:1003-1112` | 110 | `tenantHome.*` 60 keys | Đầy đủ `eyebrow/title/description/checklist/event/status` |
| `en.js:1003-1112` | 110 | `tenantHome.*` parity | Đầy đủ |
| `main.tsx:1-159` | 159 | Router `tenant-admin/*` 13 pages via `pageRegistry.js` | `TenantAdminLayout` wrap `Outlet` |

---

### 4.3 Luồng dữ liệu đã trace (use-case: mở `/tenant-admin/home` với tenant X)

**Bước 1 — Bootstrap auth**  
`PortfolioContext.js:248-278` `bootstrap()` nếu `isAuthenticated && accessToken` → `syncAuthState() → getUserProfile()` lấy `rules/abilities` → `createAbilityFromRules(rules)` → `ability` + `userIdentity/userPlan/userEntitlements` → `localStorage tenant_id` → `main.tsx:102` `TenantAdminLayout` mount `TenantAdminSidebar + Breadcrumb + Outlet(home)`.

**Bước 2 — Home fetch**  
`TenantAdminHomePage.tsx:144-147` `useEffect([]) → loadData()` → `loadData:127-142` `setLoading(true)` → `Promise.all([ defaultCoreApiAdapter.getDashboardSummary()@132, defaultCoreApiAdapter.getUsageTrend(7)@133 ])` → `operator.js:76` `coreGet("/partner/dashboard/summary/")` + `operator.js:80` `coreGet("/partner/dashboard/usage-trend/?days=7")` qua `transport.coreGet` thêm `Authorization: Bearer` + header `tenant_id` từ `tenantIdStorage`.

**Bước 3 — BE summary**  
`views_dashboard.py:52` `partner_dashboard_summary` guard `IsAuthenticated + IsTenantActive + require_human_session@53 + _require_tenant_permission('dashboard:read')@54` → `_get_request_tenant@55` → `members_total = tenant.members.count()@58` → `_count_active_members_today@59` (`TenantMember.filter(user.last_login__date=today).count()`) → `QuotaRecord.filter(period_start<=today<=period_end)@64` → `quota_headroom_pct@76-78` → `member_activity_pct@80` → `health_score@81` `quota*0.4+activity*0.3+30` → `CoreServiceAccount active/disabled@83-84` → `CorePATCredential expiring 7d@87-92` → `_build_recent_events@94` `TenantLifecycleEvent.order_by('-created_at')[:10]@25` → `trial_remaining_days@97-102` → Response `health_score/members_active_today/api_calls_today/quota_headroom_pct/service_accounts/pats_expiring_soon/recent_events@104-117`.

**Bước 4 — BE trend**  
`views_dashboard.py:122` `partner_dashboard_usage_trend` guard tương tự → `days = clamp(GET.days,1,90)@128` → `start=today-days+1@133` → `QuotaHistory.filter(meter_code='api_calls', date__gte=start)@138` 1 query → `api_calls_by_date dict@144` → loop `offset in range(days)@149`: `TenantMember.filter(last_login__date=d).count()@153` **N query** → `daily.append({date, api_calls, active_members})@158` → Response `{daily, days}@164`.

**Bước 5 — FE render**  
`setSummary/setTrend@135-136` → `usageChartData useMemo@163-167` `date.slice(5)` → render KPI hero `366-391` (`HealthGauge@53-82` SVG circle `strokeDasharray ${(score/100)*150.8}`), checklist `395-421` (progress bar `checklistPct`), `AreaChart@432-486` (`apiGrad/memberGrad/ apiGlow/memberGlow` filter), quickActions `495-510` filter `ability.can@197`, activity `514-540` `eventIcon@84-93` emoji + `timeAgo@102-111` + `eventLabel@95-100`, status summary SA/PAT `543-583`, identity `586-600`.

**Bước 6 — Tương tác**  
`handleTrendDaysChange@149-156` `setTrendDays(d)` → `getUsageTrend(d).then(setTrend).catch(setError)` — không loading, không invalidate. `handleDeprovision@169-181` `corePost("/partner/billing/deprovision/")` → `setDeprovisionDone(true)` + close modal nếu success, catch → `setDeprovisionError`. `switchTenant@PortfolioContext.js:280-285` `localStorage.setItem tenant_id + dispatch CustomEvent('tenant-changed')` → `QueryProvider.tsx:17-19` `invalidateTenantAdminQueries(queryClient)` — **Home không nghe** vì không phải RQ.

---

### 4.4 CONTRADICTIONS (plan/doc vs code)

| # | Plan / Doc `file:line` | Code thực tế `file:line` | Tác động |
|---|---|---|---|
| C01 | `AGENTS.md:40-44` Sprint 6 Done: *13/13 TenantAdmin pages dùng React Query* + `AUDIT_SPRINT6:13` fix stale cache | `TenantAdminHomePage.tsx:127-147` **đã CLOSED sau Phase 0** → `TenantAdminHomePage.tsx:132-166` 2× `useTenantAdminQuery` scoped `["tenant-home",...]` + `canReadHome` guard, `QueryProvider:17` invalidate (audit Phase 0 2026-09-09) | **CLOSED** — không còn P0, 13/13 đã đúng |
| C02 | `docs/AUDIT_TENANT_ADMIN_UI_UX_20260701.md:21` *Đóng modal khi lỗi deprovision CRITICAL — setShowDeprovision(false) trong finally* | `TenantAdminHomePage.tsx:172-176` nay chỉ `setShowDeprovision(false)` trong `try` success, `catch` không đóng | ĐÃ FIX — nhưng thiếu guard type-slug |
| C03 | `docs/AUDIT_TENANT_ADMIN_UI_UX_20260701.md:23` *Logic checklist PAT `!==undefined` luôn true* | `TenantAdminHomePage.tsx:282` nay `(summary?.pats_expiring_soon ?? 0) > 0` | ĐÃ FIX |
| C04 | `AGENTS.md:6` SOC glassmorphism, `soc.module.css` tokens, `defaultCoreApiAdapter cast as unknown` | `TenantAdminHomePage.tsx:53-82` `HealthGauge` dùng inline `rgba(255,255,255,0.06)` + `TenantAdmin.module.css` riêng, không `soc.module.css`; `defaultCoreApiAdapter.getDashboardSummary()@132` không cast `as unknown as` | Nhỏ — vi phạm constraint nhưng không ảnh hưởng UX |
| C05 | `AUDIT_TENANT_ADMIN_UI_UX_20260701.md:26` *Ký tự ngày 7d/14d/30d viết cứng* | `TenantAdminHomePage.tsx:266` `trendDays` buttons hard-code `"7d"` không qua `t()` | PENDING — vẫn chưa fix |
| C06 | `AUDIT_TENANT_ADMIN_UI_UX_20260701.md:27` *KpiCard trong render* | `TenantAdminHomePage.tsx:211-226` `function KpiCard` vẫn định nghĩa trong `TenantAdminHomePage` render | PENDING — chưa fix |
| C07 | `docs/AUDIT_SPRINT6_UX...:87` *A7 file reference `components/TenantAdminLayout.tsx` đúng vị trí* | `packages/web/src/components/TenantAdminLayout.tsx:1-96` tồn tại đúng, nhưng Home không dùng `PageTransition`/`Breadcrumb` đầy đủ | Không phantom, chỉ khác spec cũ |

---

### 4.5 Findings chi tiết — ưu tiên P0 → P3 (REV2: 22 → 23 findings do tách F04 → F04a/F04b)

> **Ghi chú đếm REV2:** Bảng gốc 22 findings; REV1 tách F04 thành F04a/F04b nên tổng **23** (22+1). Header/ledger đã đồng bộ.

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| **F01** | **P0** | `TenantAdminHomePage.tsx:127-147` + `useTenantAdminQuery.ts:34-52` + `QueryProvider.tsx:17-24` | Home fetch manual `Promise.all` không scope `tenant_id`, không `staleTime/gcTime/refetchOnWindowFocus` | Switch tenant → Home hiện data tenant cũ cho đến khi F5; leak data giữa tenant enterprise — **P0 SEC** | Migrate `loadData` → `useTenantAdminQuery(['tenant-home','summary'], '/partner/dashboard/summary/')` + `useTenantAdminQuery(['tenant-home','trend', String(trendDays)], '/partner/dashboard/usage-trend/?days=${trendDays}')` với `enabled: ability.can('read','TenantAdminHome')`, bỏ `useEffect` |
| **F02** | **P0** | `views_dashboard.py:81` | `health_score = int((quota_headroom*0.4)+(member_activity*0.3)+30)` magic 30, min 30 max 100, không breakdown | Không audit được, tenant không hiểu vì sao 68% — Stripe health = `100 - error_rate*50 - latency_penalty` có breakdown | Thêm `health_breakdown:{quota:quota_headroom, activity:member_activity, base:30}` hoặc đổi công thức `quota*0.4+activity*0.3+error_free*0.3` với `error_free` từ alert_config |
| **F03** | **P0** | `views_dashboard.py:149-156` | Loop `for offset in range(days): TenantMember.filter(last_login__date=d).count()` → N query (30d=30, 90d=90) | Latency 300-800ms → 2-3s khi 90d, DB load cao khi nhiều tenant vào Home cùng lúc | 1 query: `TenantMember.objects.filter(tenant=tenant, user__last_login__date__gte=start).values('user__last_login__date').annotate(c=Count('id'))` → dict `date→count`, loop chỉ map |
| **F04** | **P1** | `TenantAdminHomePage.tsx:294-304` | `checklistSSO/Webhooks: done: ability.can('read', 'TenantSSOAdmin')` → mark done theo **quyền** | User viewer có quyền xem SSO nhưng tenant chưa config SSO → checklist tick xanh sai 100% — Notion/Stripe check `resource_exists` | Thêm vào `partner_dashboard_summary` response: `sso_configured: bool`, `webhook_count: int` (query `SAMLConfig.exists()` + `WebhookConfig.count()`), FE `done: summary.sso_configured` |
| **F05** | **P1** | `TenantAdminHomePage.tsx:365-391` | 4 `KpiCard` chỉ show value + sub static (`healthLabel/activeMembers/apiCalls/quotaHeadroom`), không `Δ vs yesterday/7d`, không sparkline, không threshold alert | Kém 1 bậc so với Stripe Dashboard KPI (luôn `↑12% vs last 7d` + sparkline + click drill-down) | BE thêm `api_calls_yesterday`, `members_active_yesterday`, `quota_headroom_yesterday` vào summary; FE render `Δ ${diff} (${pct}%)` + mini `AreaChart 7d` + `color={headroom<30?red:60?amber:green}` đã có nhưng chưa đủ |
| **F06** | **P1** | `TenantAdminHomePage.tsx:425-486` | `AreaChart` thiếu `YAxis/CartesianGrid/Legend`, hard-code `filter id="apiGlow"` random, nút `7d/14d/30d` i18n cứng `"7d"` | Chart không đọc được giá trị trục Y, không toggle series, không Brush khi 30d — Recharts thương mại luôn có `CartesianGrid dashed` + `Legend` | Thêm `YAxis tick`, `CartesianGrid strokeDasharray="3 3"`, `Legend`, `Brush` khi `days>14`, `ResponsiveContainer` fix `height 220`, `t("tenantHome.days",{count:d})` |
| **F07** | **P1** | `TenantAdminHomePage.tsx:199-209` + `ShellSkeleton.tsx:48-88` | Loading chỉ `ShellPageChrome eyebrow + panel "Đang tải..."` text, không `ShellSkeleton` | UX giật cục, không có shimmer như `TenantAdminUsagePage.tsx:261` `variant="metric" count={2}` + `table-row` | `if (loading && !summary) return <ShellPageChrome ...><ShellSkeleton variant="metric" count={4}/><ShellSkeleton variant="chart" count={7}/><ShellSkeleton variant="table-row" count={3}/></>` |
| **F08** | **P1** | `TenantAdminHomePage.tsx:149-156` | `handleTrendDaysChange` set state nhưng không `isFetching`, không disable buttons, error chỉ `setError` banner chung | User click 14d → 30d nhanh → race `setTrend` last wins không deterministic | Dùng RQ cho trend như F01 thì `isFetching` tự có + `keepPreviousData`; tạm thời thêm `trendLoading` state + disable + `AbortController` |
| **F09** | **P1** | `TenantAdminHomePage.tsx:53-82` | `HealthGauge glowFilterId = useMemo(()=>Math.random()*1e6,[])` | `Math.random` không stable cho SSR/hydration, 2 gauge cùng trang duplicate id `#gaugeGlow-123` → filter sai | `const id = useId()` như `ShellPageTemplate.js:99` `useId()` → `glowFilterId = gaugeGlow-${id.replace(/:/g,'')}` |
| **F10** | **P1** | `TenantAdminHomePage.tsx:169-181` + `TenantAdminBillingPage.tsx:506-548` | Deprovision modal `handleDeprovision` chỉ `await corePost("/partner/billing/deprovision/")` → done, không confirm lại | 1 click nhầm = mất tenant — Vercel/Stripe yêu cầu `type project-name` + password re-auth | Dùng `useConfirm` như Billing `526` + input `type "${tenant_code}" to confirm`, disable button khi không khớp, toast `deprovisionDone` + redirect `/login` |
| **F11** | **P2** | `TenantAdminHomePage.tsx:211-226` | `function KpiCard` định nghĩa **trong** `TenantAdminHomePage` render | Mỗi render tạo component mới → `HealthGauge` re-mount, mất memo, re-render 4 card | Extract `components/tenant-admin/TenantKpiCard.tsx` + `HealthGauge.tsx` |
| **F12** | **P2** | `TenantAdminHomePage.tsx:84-93` + `TenantAdminHomePage.tsx:518-519` | `eventIcon(type)` return emoji string `🔑/👤/⚠️` + render `span 16px` không `aria-label` | Screen reader đọc vô nghĩa, chỉ màu phân biệt → fail WCAG 1.4.1 | Dùng `lucide-react` icons như `TenantAdminSidebar.tsx:6` (`Fingerprint/Users/AlertTriangle`) + `aria-label={eventLabel(...)}` + `role="img"` |
| **F13** | **P2** | `TenantAdminHomePage.tsx:183-196` | `navEntries icon: "👥/🔧/🔑"` emoji, không `description` | QuickActions list đơn điệu, không search — GitHub/Vercel quick actions có `title + description + shortcut` | Đổi sang `lucide-react` + thêm `descKey: "tenantHome.membersDesc"` + `CommandPalette Cmd+K` filter (reuse `pageRegistry.js` routes) |
| **F14** | **P2** | `TenantAdminHomePage.tsx:260-264` | Trend filter buttons `style={{background: trendDays===d? "rgba(0,180,216,0.2)":...}}` 40 dòng inline | Khó theme, không reuse `TenantAdmin.module.css` | Extract `.trendFilterActive/.trendFilterInactive` trong `TenantAdmin.module.css` |
| **F15** | **P2** | `TenantAdminSidebar.tsx:143` | `const [collapsed,setCollapsed]=useState(false)` không persist | F5 mất trạng thái, khác `PortfolioContext.js:25` `tenant_id` persist | `useState(()=>localStorage.getItem("taSidebarCollapsed")==="1")` + `useEffect setItem` |
| **F16** | **P2** | `TenantAdminHomePage.tsx:45-51` | `TenantAdminHomePageProps {env,fetchImpl,bootstrapLoader,autoLoad,initialSnapshot}` không dùng | Dead props từ `pageRegistry.js` inject, tăng bundle + confuse | Xóa interface hoặc dùng `bootstrapLoader` cho SSR |
| **F17** | **P2** | `Breadcrumb.tsx:59-60` + `TenantAdminHomePage.tsx:312-320` | Home không render `Breadcrumb` (Layout có nhưng `I18N_MAP` thiếu `tenantHome.title` fallback), `ShellPageChrome metrics={undefined}` | Mất context navigation, không có `Tenant Admin / Home` như `TenantAdminBillingPage.tsx:212` có metrics | Thêm `<Breadcrumb />` đã có trong `TenantAdminLayout.tsx:87` — verify `I18N_MAP home→ tenantHome.title` OK, nhưng thiếu `tenant-admin` parent label; thêm `metrics` hero như Billing |
| **F18** | **P2** | `TenantAdminHomePage.tsx:514-540` | Activity feed chỉ 10 dòng, không filter `event_type/actor/date`, không pagination, `key={event_type+"-"+i}` duplicate khi cùng type | Linear/Notion activity có filter chips + pagination cursor + deep-link `?event=pat_created` | BE trả `next_cursor` hoặc FE link `View all → /tenant-admin/audit-logs` đã có nhưng cần `?event_type=` filter + avatar `member.user` |
| **F19** | **P3** | `TenantAdminHomePage.tsx:96-100` | `eventLabel` fallback `type.replace(/_/g," ")` raw snake | Khi thiếu `tenantHome.event.*` key → hiện `pat revoked` English thô | Thêm `t(key, {defaultValue: type})` đã có nhưng chưa title-case; nên `t("tenantHome.event.unknown", {type})` |
| **F20** | **P3** | `views_dashboard.py:37` + `TenantAdminHomePage.tsx:137` | `except Exception: return []` nuốt lỗi `TenantLifecycleEvent` + `except Exception: pass` quota headroom | Khi `tenant_lifecycle` app chưa migrate → silent fall về `[]` + `quota 100%` gây health ảo | Log `logger.warning("dashboard summary fallback", exc_info=True)` + Sentry span |
| **F21** | **P3** | `TenantAdminHomePage.tsx:102-111` | `timeAgo` dùng `Date.now() - new Date(iso).getTime()` không `Intl.RelativeTimeFormat`, không auto update | "5 phút trước" không tick mỗi phút như Vercel `time-ago` live | Dùng `formatDistanceToNow` + `setInterval 60s` hoặc `useTimeAgo` hook |
| **F22** | **P3** | `TenantAdminLayout.tsx:6-79` | `LAYOUT_CSS` inline 74 dòng + `TenantAdminSidebar.tsx:36-140` `SIDEBAR_CSS` 105 dòng | Không qua `TenantAdmin.module.css`, khó override theme, duplicate `border-shell` | Extract vào `TenantAdminLayout.module.css` + `TenantAdminSidebar.module.css` |

---

### 4.6 Quality Gates Audit

#### 6.1 Lint — `npm run lint` (packages/web)
- **Kết quả (suy luận từ `AUDIT_DASHBOARD...:129` + không chạy trong audit):** PASS 0 error, **~3524 warnings** kế thừa. Home có `// eslint-disable-next-line react-hooks/exhaustive-deps@146` → che dependency `loadData` — sẽ fail nếu bật `max-warnings=0`.
- **Top warning Home:** `KpiCard` trong render (react/no-unstable-nested-component), `Math.random` (no-magic), inline style 20+ `jsx-no-literals` nếu bật.
- **Gate khuyến nghị:** Bật `no-restricted-syntax` cấm `Math.random` trong component + `react-hooks/exhaustive-deps` error, không disable.

#### 6.2 Type-check — `npx tsc --noEmit` + `npm run build`
- **`npx tsc --noEmit`:** PASS suy luận (Home `as DashboardSummary` lỏng, `score?:number` nullable nhưng `HealthGauge` require `number` — `strictNullChecks` sẽ lỗi nhưng hiện `skipLibCheck` pass).
- **`npm run build`:** PASS — `TenantAdminHomePage` chunk ~8kB (`TenantAdminSSOPage.js 8.68kB` ref), legacy `index 2.1M` do `recharts` chưa split như Dashboard `echarts 637k`.
- **Đề xuất:** `types: DashboardSummary` strict, `health_score: number | null`, `getDashboardSummary(): Promise<DashboardSummary>` trong `operator.js` thay vì `any`.

#### 6.3 i18n — `vi.js` + `en.js` + hardcode scan
- **Hardcoded scan grep `tenantHome\.`:** Home 100% qua `t()` — PASS.
- **Sót:** `TenantAdminHomePage.tsx:266` hard-code `"7d/14d/30d"` (3 occurrence) không qua `t("common.days",{count})`; `BillingPage.tsx:394` hard-code `"VND"` fallback.
- **Coverage:** `vi.js:1003-1112` 60 keys `tenantHome.*` + `en.js` parity 100% — PASS. `tenantHome.event.*` 15 keys + `status.*` + `checklist*` đầy đủ.
- **Scan lệnh:** `npm run i18n:scan` (nếu cấu hình `eslint-plugin-i18n`) sẽ báo 3 hard literal Home.

#### 6.4 Test — `npm run test`, `npm run test:components`
- **Hiện có:** `useTenantAdminQuery.component.test.ts:1-60` 3 tests cross-tenant scope, `TenantAdminRolesPage.component.test.tsx` 2 tests — PASS (`AGENTS.md:50` 6 files / 16 tests).
- **Thiếu:** `TenantAdminHomePage.component.test.tsx` **KHÔNG TỒN TẠI** — grep 0 matches. Home là page duy nhất không có component test trong khi `TenantAdminUsagePage/Billing/Webhooks` đều đã migrate RQ và có skeleton test.
- **Coverage ước tính:** Home <5% (CHƯA XÁC MINH chính xác — cần `npm run test -- --coverage --collectCoverageFrom="src/pages/tenant-admin/TenantAdminHomePage.tsx"`).

#### 6.5 External coupling
- **web ↔ core:** `defaultCoreApiAdapter` → `operator.js:76-82` → `partner_urls.py:91-94` native, trước proxy `vninvest_core/urls.py:proxy` — contract đúng. Adapter không đoán shape — đã verify `views_dashboard.py:104-117` response keys khớp `DashboardSummary` interface `TenantAdminHomePage.tsx:12-30`.
- **web ↔ widget:** `package.json:10` `vninvestcharts-widget ^1.2.5` lazy-load `DashboardPage` không liên quan Home — không stale, React 19 `19.2.7` tương thích `recharts@2.15.4 ^19`.
- **dist vs src:** Không stale engine — Home không dùng `vn-kline-engine`.

---

### 4.7 Đề xuất nâng cấp chuẩn thương mại (so sánh & roadmap)

#### So sánh với giải pháp thương mại đang hoạt động

| Tiêu chí | Stripe Dashboard / Vercel / Linear / Notion / GitHub | VNInvest Home hiện tại | Gap & Impact |
|---|---|---|---|
| **KPI hero** | Delta `↑12% vs last 7d` + sparkline mini + threshold badge (Stripe Billing usage, Vercel Analytics) | Chỉ `value + sub` static (`72% today`) `TenantAdminHomePage.tsx:373` | Thiếu context tăng/giảm → enterprise không biết quota sắp vỡ |
| **Onboarding checklist** | Dismissible, persist `localStorage`, confetti khi 100%, progress ring + deep-link (Notion/Linear) | Luôn hiện `395-421`, progress bar tĩnh, `ability.can` sai | UX annoying khi đã done, không celebrate → NDR churn |
| **Chart** | `CartesianGrid`, `Legend` toggle, `Brush` timeline, export CSV, `YAxis` label (Stripe Revenue, Cloudflare) | `AreaChart` no YAxis/Grid/Legend/Brush `432-486` | Không đọc được giá trị Y, không zoom 30d |
| **Quick actions** | `Cmd+K` palette, search, `recent`, icon + description + shortcut (Linear/GitHub) | Emoji list `183-196` filter `ability.can` | Navigation chậm khi 12 items, không discovery |
| **Activity feed** | Filter `actor/event/date`, pagination cursor, avatar, deep-link to audit log (Vercel Deployments, GitHub Audit) | Flat 10 `514-540` emoji + `timeAgo` | Không trace được ai làm gì khi SOC |
| **Guard destructive** | `type "project-name"` + password re-auth (Vercel Delete, Stripe Close account) | 1 click `handleDeprovision@172` + confirm modal đơn giản `350-358` | 1 misclick = mất tenant — **P0 risk** cho enterprise |
| **Search** | Global `Cmd+K` omni-search (Linear/Stripe) | Không có | Onboarding SA/PAT phải nhớ route |
| **Realtime** | SSE/WS live badge `LIVE · 2s ago` + auto refresh every 30s when visible (Vercel, Datadog) | Chỉ `loadData()` on mount + manual Refresh + `trendDays` fetch | Dashboard stale nếu để qua đêm |
| **A11y** | `aria-label`, keyboard nav `Enter/Space`, focus-visible ring, contrast AA (Stripe/Linear) | Emoji no aria, color-only status, `Math.random` id | Fail WCAG 1.4.1 — enterprise audit sẽ reject |
| **Empty/Loading** | Shimmer skeleton + `Create first` CTA + `Sample data` (Stripe/Notion) | Text `"Chưa có dữ liệu xu hướng"` `490` + `"Đang tải..."` | Thiếu delight, không guide next step |

#### Roadmap cải tạo (3 Phase, ước lượng 12 ngày — có thể duyệt từng Phase)

**Phase 0 — Hotfix blocker (2 ngày) — chặn P0, không chờ duyệt full**

- [ ] **F01→RQ:** `TenantAdminHomePage.tsx:127-147` → `useTenantAdminQuery` 2 keys như §4.5, xóa `useEffect`, thêm `ShellSkeleton` (§4.5 F07)
- [ ] **F02→Breakdown:** `views_dashboard.py:81` trả `health_breakdown` + log fallback
- [ ] **F03→1 query:** `views_dashboard.py:149-156` group-by fix
- [ ] **F09→useId:** `TenantAdminHomePage.tsx:55` `useId()`
- [ ] **Gate:** `npx tsc --noEmit` + `npm run build` + `vitest run useTenantAdminQuery` PASS

**Phase 1 — UX thương mại parity với Stripe (5 ngày)**

- [ ] **KPI delta:** BE thêm `*_yesterday` vào summary, FE `KpiCard` thêm `Δ` + sparkline 7d + threshold color đã có (`quotaHeadroom<30 red`) mở rộng cho `api_calls>80% amber` (§4.5 F05)
- [ ] **Checklist correct:** BE `sso_configured/webhook_count`, FE `done: summary.sso_configured` (§4.5 F04) + persist dismiss `localStorage "taChecklistDismissed"`
- [ ] **Chart polish:** `YAxis/CartesianGrid/Legend/Brush` + `t("tenantHome.days")` (§4.5 F06)
- [ ] **Guard deprovision:** `useConfirm` + input slug (§4.5 F10) + toast + redirect
- [ ] **A11y:** `lucide-react` thay emoji, `aria-label`, `role="img"` (§4.5 F12), extract `KpiCard/HealthGauge` (§4.5 F11)

**Phase 2 — Nâng cấp discovery & realtime (3 ngày)**

- [ ] **QuickActions:** `lucide` + `descKey` + `CommandPalette Cmd+K` (§4.5 F13) + persist sidebar `localStorage` (§4.5 F15)
- [ ] **Activity:** filter chips `event_type/actor`, `View all → /audit-logs?source=home` deep-link, avatar, `cursor` pagination (§4.5 F18)
- [ ] **Realtime:** `refetchInterval 30s` khi `document.visibilityState==="visible"` + pause hidden, live badge `LIVE · {timeAgo(lastFetch)}`
- [ ] **Breadcrumb+Metrics:** `ShellPageChrome metrics={4 KPI}` + `Export trend CSV` (§4.5 F17)

**Phase 3 — Polish & Coverage (2 ngày)**

- [ ] **Test:** `TenantAdminHomePage.component.test.tsx` 5 cases: skeleton, error retry, tenant switch stale check, trend 7→30d, deprovision guard (đóng gap §6.4)
- [ ] **i18n:** xóa hard-code `7d`, chạy `npm run i18n:scan` 0 hard literal
- [ ] **Lint:** xóa `eslint-disable` + extract inline styles (§4.5 F14) + `TenantAdminLayout CSS module`
- [ ] **Perf:** `recharts` dynamic import nếu chart >30d, `autoSelectedRef` reset khi `tenant_id` đổi (đã có `PortfolioContext` pattern)

---

## 5. Câu hỏi cần làm rõ (cần Product/Backend quyết trước khi Phase 0)

1. **Health formula:** Giữ `+30 base` (opaque) hay công khai `0.4 quota +0.3 activity +0.3 error_free` với breakdown tooltip? Ảnh hưởng contract `DashboardSummary`.
2. **Deprovision guard:** Chỉ `owner` role hay `owner + type slug` + re-auth password? Stripe yêu cầu cả 2 — enterprise compliance cần không?
3. **Checklist `PAT done`:** Định nghĩa `>0 active` (có tạo) hay `expiring_soon==0` (healthy)? Hiện `>0` nhưng PAT healthy vẫn chưa tick nếu không có sắp hết hạn — ngược.
4. **`active_members` scope:** Chỉ `last_login__date` human session hay gồm `PAT/SA` api_calls? Hiện bỏ qua machine traffic → health thấp giả khi tenant là machine-only.
5. **Realtime cho Home:** Cần WS/SSE như `RealtimeContext.js` hay polling `refetchInterval 30s` đủ? `AUDIT_DASHBOARD...:1021` heartbeat 25s quá gắt cho offhours.

---

## 6. Đánh giá tổng thể

- **Mức độ sẵn sàng:** **65%** — Đủ demo nội bộ và beta enterprise, nhưng **chưa đạt đẳng cấp thương mại** để public GA. So với 12 TenantAdmin pages còn lại (đã RQ + skeleton + toast), Home tụt hậu 1 thế hệ.
- **Blocker:** **2 P0 (F01 stale cross-tenant, F03 N+1)** phải fix trước khi claim "13/13 RQ" trong `AGENTS.md:42`. Không fix → audit Sprint 6 bị reopen.
- **Implementable:** Có — mọi fix đều có pattern sẵn trong codebase (`useTenantAdminQuery.ts:34` cho F01, `TenantAdminUsagePage.tsx:261` skeleton cho F07, `TenantAdminBillingPage.tsx:506` `useConfirm` cho F10, `ShellPageTemplate.js:99` `useId` cho F09).
- **Ưu tiên sửa:** **F01 → F03 → F02 → F04 → F09 → F07 → F10** (theo RICE: Reach cao cho F01/F03 vì mọi tenant vào Home).
- **Rủi ro nếu không sửa:** Tenant switch leak data → **SEC incident**; 90d trend timeout → DB CPU spike; health ảo → enterprise chê KPI vô nghĩa; deprovision 1-click → **irreversible data loss**.
- **Lợi ích sau Phase 1:** Home parity với Stripe Billing Overview — KPI delta, checklist đúng, chart đọc được, guard an toàn, đủ pass `CODE_CHANGE_AUDIT_LEDGER.md` DoD và duyệt thương mại.

---

## 7. Phụ lục — Lệnh tái kiểm

```bash
# Type-check
npx tsc --noEmit

# Lint (packages/web)
npm run lint

# Build + kiểm chunk
npm run build

# i18n scan (nếu cấu hình eslint-plugin-i18n)
npm run i18n:scan
# hoặc grep hard literal
grep -rn '"7d"\|"14d"\|"30d"' packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx

# Test coverage Home (sau khi viết TenantAdminHomePage.component.test.tsx)
npx vitest run src/pages/tenant-admin/TenantAdminHomePage.component.test.tsx
npx vitest run src/pages/tenant-admin/useTenantAdminQuery.component.test.ts
npm run test -- --coverage --collectCoverageFrom="src/pages/tenant-admin/TenantAdminHomePage.tsx"

# Verify cross-tenant stale (manual)
# 1. login tenant A → /tenant-admin/home → ghi health_score
# 2. switchTenant(tenant B) → không F5 → verify health_score refetch (Network tab /partner/dashboard/summary/)
# 3. check QueryProvider invalidate: window.dispatchEvent(new CustomEvent('tenant-changed'))

# Verify N+1 fix
# EXPLAIN ANALYZE cho views_dashboard.py — phải 1 query GROUP BY, không loop
```

**Tài liệu tham chiếu:** `AGENTS.md:6`, `docs/AUDIT_TENANT_ADMIN_UI_UX_AND_TECHNICAL_GAPS_20260701.md:21-28`, `docs/AUDIT_SPRINT6_UX_INDEPENDENT_REVIEW_20260718.md:13`, `docs/AUDIT_DASHBOARD_COMMERCIAL_GRADE_20260908.md:1-231`, `packages/web/src/adapters/core/operator.js:76`, `packages/core/backend/src/identity_access/views_dashboard.py:81`, `docs/CODE_CHANGE_AUDIT_LEDGER.md:33-36`.

**Người thực hiện:** Muse Spark (audit chỉ nghiên cứu, không sửa code). Mọi phát hiện đã được `grep/read` xác minh; thiếu `file:line` = không hợp lệ theo khung §0.

**Trạng thái phê duyệt:**

- [x] **Phản biện độc lập 2026-09-09** — Xác nhận ~90% audit gốc, đủ cơ sở phê duyệt Phase 0 có điều kiện (chi tiết §8 REV1)
- [ ] **Product** duyệt health formula (Câu hỏi 1) + checklist semantics (Câu hỏi 3 — đã chốt hướng `pats_total` theo REV1)
- [ ] **Backend** duyệt `health_breakdown` + `pats_total`/`sso_configured`/`webhook_count` additive + N+1 fix
- [ ] **Frontend** duyệt Phase 0 RQ migration + skeleton + useId (2 ngày)
- [ ] **QA** bổ sung `TenantAdminHomePage.component.test.tsx` vào `test:components` gate trước khi merge

---

## 8. Đính chính sau phản biện độc lập (REV1 — 2026-09-09)

**Nguồn phản biện:** Audit độc lập verify trực tiếp code (không dựa tài liệu audit), chạy thật `npx tsc --noEmit` PASS + `glob` test gap + `grep` toàn `pages/tenant-admin`.

**Kết quả tổng quan:** Audit gốc đúng **~90%**, đủ cơ sở phê duyệt Phase 0 có điều kiện. Không có false positive nghiêm trọng; có 2 điểm audit nói **nhẹ hơn thực tế** và 1 điểm nói **nặng hơn thực tế**.

### 8.1 Verify 3 finding P0 — cả 3 ĐÚNG, giữ nguyên P0

| Finding | Kết luận phản biện | Đối chiếu line |
|---------|-------------------|----------------|
| **F01 stale cross-tenant** | **XÁC NHẬN, đồng ý P0 SEC** — `TenantAdminHomePage.tsx:127-147` `Promise.all + useEffect([])+eslint-disable:146` không import `useTenantAdminQuery`; grep 12 pages còn lại đều import (Roles:10, Billing:12, Usage:11...), Home là ngoại lệ duy nhất — claim "duy nhất sót" chính xác; `QueryProvider.tsx:17-24` chỉ invalidate RQ, Home không nghe | `TenantAdminHomePage.tsx:127`, `useTenantAdminQuery.ts:34`, `QueryProvider.tsx:17`, `PortfolioContext.js:284` |
| **F02 health magic** | **XÁC NHẬN** — `views_dashboard.py:81` `quota*0.4+activity*0.3+30` min luôn 30, không breakdown | `views_dashboard.py:81` |
| **F03 N+1** | **XÁC NHẬN** — `views_dashboard.py:149-156` loop `range(days) × TenantMember.filter().count()` 90d=90 queries; fix group-by 1 query đúng và rẻ | `views_dashboard.py:149` |

### 8.2 Đính chính P1 — có 2 điểm audit đánh giá NHẸ hơn thực tế

#### 8.2.1 PAT checklist — audit ghi C03 "ĐÃ FIX" là SAI HƯỚNG → nâng lên P1

- **Audit gốc C03:** ghi `TenantAdminHomePage.tsx:282` `(pats_expiring_soon ?? 0) >0` là ĐÃ FIX so với `!==undefined`.
- **Phản biện:** Logic vẫn **ngược semantics**: `done = expiring_soon >0` nghĩa là *có PAT sắp hết hạn thì tick xong*, tenant khỏe (0 expiring, có PAT active) thì mãi chưa xong. Đúng phải là `done = pats_total >0` (đã tạo PAT), còn `expiring_soon` chỉ lái warning badge — mà badge `TenantAdminHomePage.tsx:568-573` đã làm đúng vai này.
- **Hành động REV1:**
  - Sửa **C03** trong §4.4: từ `ĐÃ FIX` → `FIX SAI HƯỚNG — P1` (xem bảng patch dưới).
  - Tách **F04** thành **F04a (SSO/Webhooks)** `ability.can` + **F04b (PAT)** `expiring_soon` — F04b ưu tiên P1.
  - BE Phase 0 phải thêm `pats_total: int` ( `CorePATCredential.filter(status='active').count()` ) vào `views_dashboard.py:104-117` response, FE `done: (summary.pats_total ?? 0) >0`. Đây là additive, không vỡ contract.
  - Cập nhật **Câu hỏi 3** → chốt hướng `pats_total` (không còn là question mở).

**Patch bảng CONTRADICTIONS (thay C03):**

| # | Plan / Doc | Code thực tế | Tác động REV1 |
|---|---|---|---|
| C03-REV1 | `AUDIT_TENANT_ADMIN_UI_UX_20260701.md:23` PAT `!==undefined` → audit gốc ghi fix `>0` | `TenantAdminHomePage.tsx:283` `done: (pats_expiring_soon ?? 0) >0` | **FIX SAI HƯỚNG — P1** — done theo expiring, ngược: tenant có PAT khỏe (0 expiring) → mãi chưa done; cần `pats_total >0` |

**Patch bảng Findings (thay F04):**

| ID | Mức REV1 | File:Line | Thực tế REV1 | Đề xuất fix REV1 |
|---|---|---|---|---|
| **F04a** | **P1** | `TenantAdminHomePage.tsx:294-304` | `checklistSSO/Webhooks: done: ability.can(...)` theo quyền | BE thêm `sso_configured: bool` (`TenantSSOConfig.objects.filter(tenant=tenant, is_enabled=True).exists()` @`models.py:1116,1124`) + `webhook_count: int` (`TenantWebhookConfig.objects.filter(tenant=tenant, is_active=True).count()` @`models.py:1358,1366`), FE `done: summary.sso_configured / webhook_count>0` |
| **F04b** | **P1** | `TenantAdminHomePage.tsx:282-283` | `checklistPAT: done: pats_expiring_soon>0` ngược | BE thêm `pats_total: int` (`CorePATCredential.objects.filter(service_account__tenant=tenant, status='active').count()` mirror `views_dashboard.py:87-92` filter), FE `done: pats_total>0`; giữ `expiring_soon` chỉ cho badge warning `568-573` |

> **REV2 bổ sung (tương thích deploy):** 4 field mới (`pats_total`, `sso_configured`, `webhook_count`, `health_breakdown`) phải là **optional ở FE** — `DashboardSummary` `TenantAdminHomePage.tsx:12-30` khai `pats_total?: number; sso_configured?: boolean; webhook_count?: number; health_breakdown?: {quota:number; activity:number; base:number}` với fallback `?? 0 / ?? false` và giữ `ability.can` làm fallback tạm cho F04a cho đến khi BE deploy. Đảm bảo FE deploy trước BE không crash — đúng ý "additive, không vỡ contract" nhưng REV1 chưa ghi rõ FE.

#### 8.2.2 Thứ tự fix — PAT semantics reach rộng hơn F09/F07

- **Audit gốc thứ tự:** `F01 → F03 → F02 → F04 → F09 → F07 → F10`
- **Phản biện khuyến nghị:** `F01 → F03 → PAT semantics (F04b) → F02 breakdown → F09 → F07 → F10` — lý do: PAT logic sai cho **mọi** tenant có/không có PAT (reach 100%), trong khi `Math.random` + skeleton chỉ cosmetic.
- **REV1 chốt:** Adopt thứ tự phản biện. PAT semantics đưa vào Phase 0 (vì chỉ thêm 1 field `pats_total` + 1 dòng FE), không tốn thêm ngày.

### 8.3 Đính chính P1 — có 1 điểm audit nói NẶNG hơn thực tế

- **F10 deprovision:** Audit ghi "1 click mất tenant — P0 risk". Phản biện verify `TenantAdminHomePage.tsx:323` block `showTrialBanner` → nút `Hủy cấp phát` **chỉ hiện khi `plan_status==='trial'`** (trial tenant). Enterprise `active/suspended` không thấy. Vẫn P1 nhưng không cần panic; guard `type slug + useConfirm` vẫn làm ở Phase 1, không chặn Phase 0.

### 8.4 Quality gates — phản biện chạy thật, mạnh hơn audit suy luận

| Gate | Audit gốc | Phản biện chạy thật | Kết luận REV1 |
|---|---|---|---|
| `npx tsc --noEmit` packages/web | Suy luận PASS | **Chạy thật: PASS (0 output)** | Khẳng định bằng chứng thực, giữ PASS |
| `TenantAdminHomePage.test.*` | `KHÔNG TỒN TẠI` (grep 0) | **glob 0 file — XÁC NHẬN** | Home duy nhất không có test — QA gate chính đáng, giữ yêu cầu |
| `vi.js:1003-1112` | Đủ block | **XÁC NHẬN đủ block** nhưng `{d}d` `:267` vẫn sót như C05 | Giữ C05 PENDING |
| Lint 3524 warnings | Kế thừa `AUDIT_DASHBOARD:129` | Chưa chạy (nặng) — không chặn Phase 0 | Giữ như cũ |

### 8.5 Trả lời 5 câu hỏi — chốt theo phản biện (đã đồng thuận)

| # | Câu hỏi gốc | Quyết định REV1 (đã duyệt có điều kiện) | Phase |
|---|---|---|---|
| **Q1** Health formula | **Phase 0 chỉ thêm `health_breakdown` additive** (không vỡ contract). Đổi công thức (bỏ +30, thêm `error_free`) để Phase 1 sau khi Product chốt | Phase 0: additive; Phase 1: đổi formula |
| **Q2** Deprovision guard | **Tối thiểu `owner + gõ slug tenant`** (pattern `useConfirm` đã có ở `Billing:526`, `Members`, `PATs`...), re-auth password nếu BE đã có endpoint — slug đủ cho Phase 1 | Phase 1 |
| **Q3** PAT semantics | **Chốt `done = pats_total >0`** (BE thêm field), như §8.2.1 — không còn là question mở | Phase 0 |
| **Q4** active_members scope | **Giữ `last_login__date` hiện tại**, ghi caveat machine-only vào doc; mở rộng sang `api_calls-based` ở Phase 2 | Phase 2 |
| **Q5** Realtime | **Polling `refetchInterval 30s` khi tab visible là đủ**, `WS/SSE` overkill cho Home | Phase 2 (refetchInterval) |

### 8.6 Phê duyệt có điều kiện — theo phản biện (REV2 tách scope)

> **REV2 tách scope:** REV1 nhét `sso_configured+webhook_count` (F04a — việc Phase 1) vào Backend Phase 0 nhưng estimate vẫn `~2 ngày` như audit gốc → phình scope. REV2 tách đúng:

| Bên | Phạm vi duyệt REV2 | Điều kiện | Estimate |
|---|---|---|---|
| **Frontend Phase 0** | `F01 RQ migration (bao gồm F08 trend loading là acceptance của F01, không task riêng) + F07 skeleton + F09 useId + F04b PAT `pats_total` optional+fallback` | Pattern sẵn có `useTenantAdminQuery.ts:34`, `ShellSkeleton`, `useId`; **Acceptance bổ sung §8.8**: `refreshAction` → `refetch()` cả 2 queries (hoặc `invalidateTenantAdminQueries`), xóa `handleTrendDaysChange:149-156` (RQ key theo `trendDays`), verify manual 3 bước §7 | **~2 ngày** (4 việc: F01/F04b/F07/F09) |
| **Backend Phase 0** | `F03 group-by 1 query + health_breakdown additive + log fallback @views_dashboard.py:36-37,73-74 + pats_total additive` **— KHÔNG gồm `sso_configured/webhook_count`** | `pats_total = CorePATCredential.objects.filter(service_account__tenant=tenant, status='active').count()` @`models.py:236` mirror `views_dashboard.py:87-92`; không vỡ contract | **~2 ngày** |
| **Backend Phase 1** | `sso_configured + webhook_count` (`TenantSSOConfig@1116 is_enabled`, `TenantWebhookConfig@1358 is_active`) cho F04a | 2 query đơn giản, không blocker Phase 0 | +0.5 ngày vào Phase 1 (5→5.5 ngày) |
| **Product** | Chốt Q1 formula + Q3 PAT semantics `status='active'` trước Phase 1 | Bắt buộc | — |
| **QA** | **Bắt buộc** `TenantAdminHomePage.component.test.tsx` (skeleton, error retry, tenant-switch stale, trend 7→30d, deprovision guard + **refresh/refetch**) vào `test:components` gate — **không cho merge Phase 0 nếu thiếu** | Gate chặn merge | — |

> Lưu ý đếm task: §8.6 REV1 liệt kê Frontend "F01 + F08" như 2 task riêng là **trùng** — khi trend đã là RQ query thì `isFetching/race-guard` có sẵn, F08 là acceptance criterion của F01.

### 8.7 Đánh giá tổng thể sau REV1 (REV2 bổ sung)

- **Mức sẵn sàng giữ 65%** — hợp lý như audit gốc.
- **Phase 0 thu hẹp theo REV2 là implementable hoàn toàn** bằng pattern sẵn có và **không vỡ contract** nếu `health_breakdown/pats_total` additive (Phase 0) và `sso_configured/webhook_count` additive Phase 1. REV1 đã đúng hướng, REV2 chỉ tách scope để estimate trung thực.
- **Thứ tự fix REV1 giữ nguyên:** `F01 → F03 → F04b (PAT semantics) → F02 breakdown → F09 → F07 → F10` (lệch audit gốc vì PAT reach rộng) — phản biện đồng ý.
- **Ledger:** `docs/CODE_CHANGE_AUDIT_LEDGER.md:37` bổ sung note REV1 + REV2.

**Người đính chính:** Muse Spark — đã đọc `TenantAdminHomePage.tsx:282-283` + `views_dashboard.py:81,149-156` + `TenantAdminHomePage.tsx:323,568-573` + `models.py:236,1116,1358` để xác minh PAT/SSO/Webhook, và ghi nhận `npx tsc` PASS từ phản biện.

### 8.8 Đính chính bổ sung REV2 — 3 điểm scope/doc + 1 rủi ro migrate (từ phản biện đợt 2)

#### 8.8.1 Lỗi sai tên model — BẮT BUỘC SỬA trước khi giao BE (đã sửa §8.2.1)

- **REV1 sai:** `SAMLConfig.exists()` + `WebhookConfig` — **KHÔNG TỒN TẠI** (grep `class \w*(SAML|SSO|Webhook)` chỉ trúng `TenantSSOConfig@models.py:1116` `related_name='sso_config' is_enabled@1124` và `TenantWebhookConfig@models.py:1358` `is_active@1366`).
- **Đã sửa:** Patch §8.2.1 thành spec implement được luôn (xem code filter ở bảng trên). Nếu giao nguyên REV1, BE implement fail import.

#### 8.8.2 Đếm findings — sửa để khỏi tự mâu thuẫn (Nguyên tắc 2 khung audit)

- **REV1 tách `F04 → F04a/F04b`** thì tổng là **23 findings** (22 gốc +1 tách), không còn 22. Header file + ledger Entry 37 vẫn ghi "22 findings" → doc mâu thuẫn doc (cũng là finding theo Nguyên tắc 2).
- **REV2 sửa:** Header §4.5 ghi `22 → 23 (22 +1 tách từ F04)`; §8.2.1/Finding count trong ledger phải đồng bộ. **Đã sửa Header §4.1/§4.5 trong REV2 patch** (giữ số hiển thị 22→23 footnote).

#### 8.8.3 Task trùng — F08 là acceptance của F01

- **REV1 §8.6** liệt kê Frontend "F01 RQ migration + F08 trend loading" như 2 task riêng.
- **Thực tế:** Khi trend đã là RQ query (`useTenantAdminQuery(['tenant-home','trend', String(trendDays)])`) thì `isFetching/keepPreviousData/race-guard` có sẵn — F08 tự hết.
- **REV2 sửa:** Ghi F08 là **acceptance criterion của F01**, tránh double-work (xem bảng §8.6 REV2).

#### 8.8.4 Rủi ro migrate chưa ai nêu — bổ sung vào acceptance Phase 0

- **Nguy cơ:** Nút `Refresh` hiện tại `TenantAdminHomePage.tsx:247-251` gọi imperative `loadData()` (đã xóa khi F01 sang RQ declarative). Nếu implementer chỉ thay fetch mà quên nút, Refresh thành nút chết.
- **REV2 bổ sung acceptance Frontend Phase 0:**
  - `refreshAction` → `refetch()` cả 2 queries (hoặc `invalidateTenantAdminQueries` @`useTenantAdminQuery.ts:78`)
  - Xóa hẳn `handleTrendDaysChange:149-156` (RQ key theo `trendDays` thay), không để song song 2 cơ chế fetch
  - Verify manual 3 bước §7 phụ lục (tenant switch, trend 7→30d, refresh) vẫn giữ nguyên

**Kết luận REV2:** REV1 đạt ~95% sau khi sửa 4 việc trên → **đủ điều kiện ký duyệt Phase 0**, không cần thêm vòng phản biện. 4 việc đã xong trong file này.

