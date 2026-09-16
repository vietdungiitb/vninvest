
## Goal
Hoàn thiện SOC DataOps tab (Phase 1 parity với legacy) — Steps 1–3 đã xong. Maintenance và build verification cho codebase sau khi thay local vninvestcharts component bằng npm package `vninvestcharts-widget`.

## Constraints & Preferences
- SOC glassmorphism patterns, soc.module.css tokens, i18n qua LangContext.
- API calls dùng defaultCoreApiAdapter cast as unknown as { … }.
- Vietnamese labels full dấu, theo bảng thuật ngữ thống nhất.
- Build verification: npx tsc --noEmit sau mỗi sub-step, npm run build cuối mỗi step.

## Progress
### Done
- Gap analysis hoàn chỉnh: Legacy DataOpsPanel.jsx vs packages/web SOC components. ~45-50% parity overall, ~20 feature gaps. Lưu tại docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md.
- Consolidated implementation plan: docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md.
- Step 0: Backend contract verification — dataset map confirmed (5 keys), inventory response shape fixed.
- Step 1: i18n keys audit + create — 34 keys + 5 subtab nested keys trong vi.js + en.js. Verified resolve.
- Step 2a–2d: Inventory section rewrite — SocDataInventorySection.tsx — dynamic data types grid, coverage by group table (6 columns, color-coded ratio), queue tiers accordion, year distribution bar chart.
- Step 3a–3c: Operations section rewrite — SocDataOpsBackfillForm.tsx — dataset checkboxes, VN100+CUSTOM groups, Preview+Run flow với Planner Console, Run Logs, inline error/success. tsc + build pass.
- Documented full chart refactor analysis: docs/CHART_REFACTOR_ANALYSIS_20260625.md.
- **Migration to vninvestcharts-widget (npm)**: Xoá local component tree `packages/web/src/components/vninvestcharts/` (+ `packages/vn-kline-engine-core/`, `packages/vn-kline-engine-react/`) — 745 files, -102k lines. Import chuyển sang `vninvestcharts-widget` ^1.2.5. Path aliases trong tsconfig + vite.config dọn dẹp. WatchlistDetailPanel sửa props `hideX` → `showX`.
- **Priority 2 (renderSeries registry)**: Hoàn thành trong commit `3df5ff6c`. DynamicChart renderSeries() chuyển 40 case switch → SeriesRendererRegistry dispatcher, tách ~200 dòng.
- **Priority 1 & 3**: Obsolete — local VNInvestCharts.js và contract tests đã bị xoá cùng component tree.

### Done (2026-07-17)
- **React 19 peer-dep TDZ fix**: `vninvestcharts-widget` ^1.2.5 declares `peerDependencies: react ^19.0.0` nhưng app là React 18.3.1. Static import trong `VNStockChartPanel.js` gây TDZ `Cannot access 'N' before initialization` lúc load `StockDetailPage`. Quyết định ban đầu: lazy-load widget qua dynamic `import()` trong `useEffect` (Option B) để giữ React 18 — vì sợ recharts v2 peer-dep không hỗ trợ React 19. Tuy nhiên, `recharts@2.15.4` đã chính thức hỗ trợ `^19.0.0`. **Đã upgrade lên React 19**: `react@19.2.7`, `react-dom@19.2.7`, `@types/react@19.2.17`, `@types/react-dom@19.2.3`. `react-test-renderer` removed, `AuthPages.test.js` rewritten to RTL. Widget vẫn lazy-load as async chunk. tsc + build pass.
- **SOC DataOps gap analysis — ALL 20 gaps CLOSED**: P0 #1–5, P1 #6–11, P2 #12–16, P3 #17–20 đều đã implement (Inventory/Operations/Monitor/Config sections). `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md` đã stale → đánh dấu hoàn thành.

### Done (2026-09-15) — XÓA NỢ BE 19 TEST PRE-EXISTING (Entry 91) — service_ops 17 + market_serving 2
- **Toàn bộ backlog BE đỏ đã XÓA**: `service_ops` 290 tests + `market_serving` 11 tests → `Ran 301 OK (skipped=1)` (trước 17F+2E service_ops + 2F market_serving). 8 nhóm fix:
  1. OpenAPI `security` SessionAuth → `[CorePATBearer, cookieAuth]` (7 tests), 2. BackfillRunNow patch `BackfillService` + symbols upper, 3. Abort `SIGKILL`, 4. Cache bleed `scheduler:inflight` delete, 5. DataOps `service_key` matrix→dataops + revoke patch `dataops_planner`, 6. vnbroker batch `fetch_price_board_snapshots_batch` + `symbols_by_exchange` fallback, 7. Scheduler recovery `post_recovery_cooldown` (400s/1200s, dispatched 0), 8. CVD `SessionFactsCvdView` 404→200 empty (`_build_empty_cvd_payload` + `_source no-data`) + URL slash fix.
- **Verified**: `manage.py check` 0, `npx tsc --noEmit` 0, gộp 301 tests PASS. Ledger Entry 91.
- **Còn COMPAT-002**: đã ĐÓNG trước hạn (2026-11-30) — `legacy_views.py` đã xoá, relocate vào `native_views`. Toàn bộ COMPAT (001+002) đã đóng.

### Done (2026-09-15) — COMPAT-002 DONE (Entry 90) — xoá legacy_views.py
- **Relocate toàn bộ**: 3 class `RealtimeUnifiedAlertsView` / `RealtimeWhaleFeedAggregateView` / `RealtimeWhaleCampaignsView` (1317 dòng) từ `legacy_views.py` → `market_serving/native_views.py` (1531 dòng, 13 class). Xoá `legacy_views.py`. Import gộp + bỏ `User`/`default_groups` dead.
- **Verified**: ast.parse OK, `manage.py check` 0 issues, grep sạch (không còn import legacy), market_serving `Ran 11 tests OK` (đã fix 2 SessionFacts CVD 404→200 ở Entry 91).
- **Cả 2 ticket COMPAT đã ĐÓNG trước hạn**: COMPAT-001 (2026-10-15) + COMPAT-002 (2026-11-30). Ledger Entry 89 + 90.

### Done (2026-09-15) — COMPAT-001 DONE (Entry 89)
- **Cutover route**: `market_serving/urls.py` bỏ import `legacy_views`; `realtime/whale-feed-aggregate/<symbol>/` → `native_views.RealtimeWhaleFeedAggregateView` (re-export, name mới `realtime-whale-feed-aggregate`, namespace `market_serving`). Contract giữ nguyên — view vốn đọc core signal tables (`WhaleAlertCanonical`).
- **FE adapter switch**: `coreAdapter.js getWhaleAnalyticsSnapshotEndpoint` → native `/workspace/whale-analytics/{symbol}/` (path cũ `/whale-feed-aggregate/` 404 không tồn tại).
- **Tests**: BE `RealtimeWhaleFeedAggregateCompatTest` 3 tests PASS (reverse namespaced + contract + empty); FE +1 jest test; gates xanh (tsc 0, build 1m4s PASS, lint 0 errors, jest adapter 52/52, vitest 30/130). 2 lỗi market_serving SessionFacts + 17 lỗi service_ops pre-existing (reproduce HEAD sạch).
- **Còn lại**: COMPAT-002 (sunset 2026-11-30) — relocate body class vào native_views.py + xoá legacy_views.py. Ledger Entry 89.

### Done (2026-09-15) — Phase 3 SOC Commercial HOÀN TẤT (Entry 88)
- **Step 1 CSS split**: `soc.module.css` 2405 dòng → `soc.tokens.css` (43) + `soc.components.css` (2715) + module re-export 3 dòng `@import`. Build verified (class băm + token resolve).
- **Step 2 SLO Model**: `ServiceHealth` +`slo_target/uptime_30d/burn_rate_1h/error_budget_remaining` + `ServiceHealthCheckLog` model + migration `0012`.
- **Step 3 SLO Computation**: `_compute_service_slo()` (tasks.py:362) hook vào `health_check_all_services` ×2 nhánh + `SloOverviewView` + URL `overview/slo-overview/`. Deviation C1/C2: compute tại probe, view đọc cache.
- **Step 4 SLO Frontend**: `getSocSloOverview()` adapter + SLO badges trong `SocOverviewPanel` (uptime/burn-rate/budget, màu theo burn) + **Step 4c burn-rate sparkline 24h** trong `SocRuntimeKpiPanel` (bỏ stub "coming soon"): aggregation `recent_checks_24h` (TruncHour+Count, exclude maintenance/unknown, failed=unhealthy|degraded) tận dụng cùng endpoint; bar ratio theo giờ, màu green/yellow/red, loading/error+Retry/empty cold-start; CSS `.spark*`; i18n `soc.slo.spark_*`.
- **Step 5 Alerting**: `_upsert_service_health_alert()` generic SYSTEM alert (transition healthy→degraded/unhealthy, dedup `source_ref` + `SOC_ALERT_COOLDOWN_HOURS` 4h, recovery xoá alert) + `detail['last_alert']` + settings `SOC_ALERT_COOLDOWN_HOURS`/`SOC_SLO_TARGET`.
- **Step 6 Export CSV**: `SocExportConfigAuditsView`/`SocExportRunLogsView` (limit ≤5000, filter service_key) + adapter `exportSocConfigAudits/exportSocRunLogs` + FE buttons trong `SocDataOpsMonitorSection` (CSV blob client-side) + i18n `soc.export.*`.
- Quality gates: tsc 0, build 28.21s PASS, lint 0 errors (3547 warn pre-existing), jest 222 pass (1 suite FAIL pre-existing AIAdvisorAlertPanel), vitest 30 files/130 pass, BE service_ops 290 tests — 17 lỗi pre-existing giống hệt HEAD sạch (reproduce worktree, bằng chứng `docs/AUDIT_DANG_DO_VA_PHASE3_CONTINUATION_20260915.md`); test mới Phase 3 14 BE + 5 FE đều pass; migration `0012` check sạch.
- Ledger Entry 88. **Next**: COMPAT-001 (hạn 2026-10-15) → COMPAT-002.

### Done (2026-07-18)
- **Sprint 5 Steps 5.1–5.5 (Real SAML SSO backend)**: `SAMLService` class (AuthnRequest, Response parsing, metadata, connection test), `SSOLoginInitiateView`, `SSOCallbackView`, `SSOMetadataView`, `PartnerSSOTestConnectionView`, `PartnerSSOTestLoginView`. 41 tests pass. `lxml` added to requirements (not `python3-saml` — intentional trade-off, see plan deviation note).
- **Independent audit** (docs/AUDIT_SPRINT5_SAML_SSO_INDEPENDENT_REVIEW_20260718.md): 6 findings (F1–F6). F1 (P0→P1): signature verification stub → added `SAML_SIGNATURE_VERIFICATION_MODE` env var; F2 (P1): python3-saml deviation → plan updated; F6 (P3): AGENTS.md/ledger updated.
- **Step 5.6 (Frontend SSO test button)**: Added connection test button + test login flow button to `TenantAdminSSOPage.tsx`. Calls `POST /partner/sso/test/` and displays checks/errors inline.

### Done (2026-07-18) — Sprint 6: UX Improvements (partial)
- **Step 6.1**: `PortfolioContext.switchTenant` dispatches `tenant-changed` CustomEvent (no reload). Sidebar uses it without page reload.
- **Step 6.2**: Added `QueryProvider` (`providers/QueryProvider.tsx`) wrapping app in `main.tsx`. Created `useTenantAdminQuery`/`useTenantAdminMutation` hooks. Migrated 10/13 TenantAdmin pages to React Query: Security, SSO, Roles, Settings, Webhooks (full), plus Members/PATs/ServiceAccounts/Reports/UsageHistory (migrated Sprint 4/5). AuditLogs/Billing/Usage left with `coreGet` due to cursor-pagination / multi-endpoint complexity.
- **Step 6.3**: Loading skeletons present in migrated pages (ShellSkeleton).
- **Step 6.4**: `TenantAdminLayout.tsx` + `TenantAdminSidebar.tsx` converted from `createElement` to JSX.
- **Step 6.5**: Toast notifications on mutations in all migrated pages.
- Quality gate: `npx tsc --noEmit` PASS.
- **Sprint 6 follow-up (F1–F5 from AUDIT_SPRINT6)**: 
  - F1+F2 (P0 cross-tenant stale): `useTenantAdminQuery` scope mọi queryKey bằng `tenant_id` (localStorage) + `QueryProvider` listener `tenant-changed` → `invalidateTenantAdminQueries`. Đóng.
  - F3 (3 page chưa migrate): AuditLogsPage (cursor pagination + filters), BillingPage (Promise.all 3 endpoint), UsagePage (5 tab query) — đều migrate sang React Query. Tất cả 13/13 TenantAdmin page giờ dùng React Query cho GET data.
  - F4/F5 (skeleton + toast): Skeleton có trong mọi loading state; toast đồng nhất (success/error) trong mutation handlers.
  - `useTenantAdminQuery` mở rộng hỗ trợ `queryFn` custom (cho multi-endpoint). tsc PASS.

### Done (2026-09-14) — Đóng toàn bộ tồn đọng (audit W1–W10)
- **W4**: Merge `main`→`dev` (CORS dynamic + prod env example + test), push `origin/dev`. Hết diverge.
- **W1**: Fix treo bootstrap E2E — `PortfolioContext` bootstrap timeout 15s fail-open (fail-safe `authStateReady`), `auth.setup.ts` guard spinner, toàn bộ visual spec `networkidle`→`domcontentloaded`, fix `__dirname` ESM trong `screener-p0.spec.ts`. E2E chromium: **5 pass + 1 skip hợp lệ** (trước 1/4 pass).
- **W3**: Verify live email schedule — worker đã có code+ENV (không cần rebuild). Task thật matched 20/20 → mailpit nhận đúng subject/recipient (**PASS**, evidence `docs/evidence/screener-p2/w3-mailpit-live-verify.md`, đã dọn DB + mailpit).
- **W5**: Stash `temp-stash-before-merge-to-enterprise` (2026-07-10, 14 files) — cherry-pick 1 hunk còn giá trị (VnbrokerPanel option dark style), còn lại đã superseded (trademark→DB model, App routes→cleanup, AGENTS cũ). Đã drop.
- **W2**: Queue `screener` riêng + worker `core-worker-screener` (queue_policy domain mới, beat auto-route qua SCHEDULER_QUEUE_MAP). **Phát hiện + fix bug pre-existing**: `screener_tasks` chưa từng được autodiscover (beat gửi 5m/lần nhưng worker báo unregistered) — re-export trong `user_workspace/tasks.py`. Live proof: worker consume + `succeeded {schedules_due: 0}`. BE 17 tests OK.
- **W6**: Compat tickets — `COMPAT-001` (whale legacy→native, target 2026-10-15) + `COMPAT-002` (sunset, 2026-11-30) trong `compat/__init__.py` + `urls.py`.
- **W7**: Watchlist multi-portfolio — gộp holdings mọi portfolio (merge theo symbol, avg_cost bình quân gia quyền, recompute pnl%) + cộng dồn NAV. 5 tests mới pass, tsc xanh.
- **W8**: P3 — fix bug MFI (cộng dồn toàn history → đúng window-14) + 9 pins công thức; preset cộng đồng (`is_public` + migration 0016, catalog public tenant-scope, fork, share toggle, i18n VI/EN): BE 5 + FE 4 tests pass; `docs/SCREENER_METHODOLOGY_20260914.md` + disclaimer UI. Còn backlog có lý do: realtime intraday, đa khung, preset khối ngoại (xem methodology §5).
- **W9**: `npm run check:shell` trỏ lại gate thay thế (dom-landmarks + tokens + stock-detail-shell, PASS, exit 0); script cũ gắn DEPRECATED (`check:shell:legacy`). F-BE-06 cache guard (truncate top-500 + flags, 2 unit tests). E2E evidence mới trong `docs/evidence/screener-p{0,1}/`. Lighthouse chưa cài — để manual. F-BE-05 progress per-200 hoãn (cần hook trong compute loop, lợi ích thấp so với poll hiện tại).
- **W10 (entry này)**: AGENTS.md + README + ledger đồng bộ; fix C2 (ledger path `docs/`).
- Quality gates: FE `tsc` 0, `build` 52s PASS, eslint 0 errors, vitest screener+watchlist 12 files/56 pass; BE `user_workspace` 68 tests (67 pass + 1 pre-existing holdings `httpx.UnsupportedProtocol` đã ghi từ Entry 80).

### Done (2026-07-18) — Sprint 7: Quality Gates & Tests
- **7.1 Lint**: `npm run lint` (sửa script `--ext` → flat config). Exit 0. Sửa 1 error `react-hooks/exhaustive-deps` trong AuditLogsPage (wrap `logs` trong useMemo). Chỉ còn warnings (pre-existing).
- **7.2 Build**: `npm run build` (tsc + vite) exit 0. Chỉ chunk-size warning (pre-existing).
- **7.3 Test isolate cross-tenant**: `useTenantAdminQuery.component.test.ts` (3 tests) — verify queryKey scope theo `tenant_id`, không share cache giữa 2 tenant (no stale data), `invalidateTenantAdminQueries` chỉ invalidate scope đúng. PASS.
- **7.4 Component test**: `TenantAdminRolesPage.component.test.tsx` (2 tests) — skeleton khi loading, error state khi fetch fail. PASS.
- **7.5 Hook test**: coverage hook qua 7.3. 
- **Kết quả**: `vitest run` 6 files / 16 tests PASS (5 mới). Lint + build + tsc đều xanh. Sprint 6 DoD giờ đạt đầy đủ (A2/A3/A4 từ audit Sprint6 đã đóng).

### Done (2026-09-16) — Phase 1 P0 Fixes (COC audit)
- **Entry 84**: 4 P0 blocker COC — `SocScreenerPanel handleApplyConfig` (directConfig merge), `SocPrefetchPanel selectedGroups persist` (merge `universe_group_ids`), `ShellOperationsCenterPage+SocTabNavigation` tab router race + hyphen i18n, BE `SOC_HEALTH_ENDPOINTS`/`SOC_HEALTH_PROBE_TIMEOUT_SECONDS` env. tsc 0 + build 39.98s PASS.

### Done (2026-09-14) — Phase 2 P2 (P2-A1/A2/A3 + P2-B UX + R-NEW-3) — Entry 87
- **P2-A1 Overview** (`SocOverviewPanel`): COC-05 Retry button, COC-06 single reduce, COC-07 err.message, COC-08 maintenance filter+button, COC-09 domain search, COC-10 15s poll + backoff.
- **P2-A2 DataOps**: COC-18 `DataOpsContext.refreshRuns` → `getSocDataOpsRunLogs(1,20)`; COC-19 `SocDataOpsPanel` loading tổng; COC-20 scheduler health strip luôn hiển thị; COC-29 merge 2 useEffects.
- **P2-A3 Prefetch**: COC-37 preview gọi API thật (`previewSocPrefetchConfig`), COC-38 `warmSocPrefetchNow` gửi `{universe_group_ids}`, COC-39 bỏ 4 `alert()` → inline error/success. i18n `preview_failed`/`apply_success`.
- **R-NEW-3**: `socValidation.ts validateDateRange()` — dùng tại OperationsSection ×2 + DnseBackfillPanel ×1.
- **P2-B**: COC-21/22/23/24 skeleton+token+ratio+accordion a11y (Inventory), COC-32/33/34/35 skeleton+fail-rate dash+String()+empty state (Monitor), COC-31 dryRun hint, COC-44 scan_interval min 30→10, COC-45/61 drawer overlay, COC-04 tab bar flex, COC-03 tab description map, COC-16 sentiment bar `toFixed(1)%`, COC-17 `socStatusColor` shared, COC-46 throughput qua `getSocVnbrokerMetrics` + Error Rate card, COC-47 provider `is_active = enabled && runtime_ready` map đúng field backend.
- **Tests**: soc.test.js updated cho COC-38 body — 80/80 pass. tsc 0 + build 31.21s PASS. **Day-5**: lint 0 errors (2 exhaustive-deps section đã thêm eslint-disable theo convention), vitest 127 tests (mới `soc-p2.component.test.tsx`: Overview retry, Prefetch warm groups, validateDateRange), build 38.49s PASS. Ledger Entry 87. **Phase 2 P2 HOÀN TOÀN DONE** — còn Phase 3 commercial backlog riêng.

### Done (2026-09-16) — Signals P0 → P2c (P0/P1/P2a/P2b/P2c + audit fix F1) — Entry 99-110
- **P0 (W0.1-W0.4) Entry 100**: feed sống lại đúng số — envelope `recent` + `mapRecentItem`, stats từ `summary/`, error tách section, job poll theo `run_log_id`, `formatLastCheck`. Tests BE 4 + FE 10, tsc 0, vitest 32/152, build 32s.
- **P1 (W1.1-W1.5) Entry 102**: paging+filter (page/page_size 20/100, `total_filtered`), materialization progress, time/a11y, API chết 3 subtabs lazy, poll 15s + jitter + visibility. Tests BE 9 + FE 10, vitest 32/163, build 52s.
- **P2a (W2.4+W2.1+W2.5) Entry 104-106**: honest metrics (accuracy/FPR null, last_scan từ run log, whale-test smoke), poll-diff highlight cộng dồn + badge/title-blink, export CSV 5000 rows. Tests BE 3 + FE 4, vitest 32/166, build 26s. Audit độc lập Entry 105 PASS, fix F-P2A-A highlight cộng dồn Entry 106.
- **P2b (W2.2+W2.3) Entry 107-108**: triage deliveries ack/mute/seen (BE `signals_triage.py` + FE badge/checkbox/modal) + rule management bridge-write request + precision proxy (BE `signals_rules.py` 8 keys, FE Rules tab + feedback thumbs). Tests BE 12 + FE 9, vitest 32/175→33/33, jest 230, build 53s. Plan P2b DONE.
- **P2c (W2.1-long) Entry 109**: SSE realtime `GET /operator/soc/signals/stream/` (`retry:3000`, `:ping` 15s, `event:signal`, `Last-Event-ID`/`since`, token fallback, poll DB 3s, throttle `soc_stream` 60/min, idle 1h) + hook `useSignalStream` (EventSource + heartbeat 35s + backoff 1s→30s + `since` persist) + panel dot indicator + pause poll khi `open`. Tests BE 12→13 + hook 8 + panel stream 3, vitest 34/186, build 43s.
- **Audit fix P2c Entry 110**: F1 watchdog treo (HIGH) → `scheduleReconnect` trực tiếp, F3 `since` param, F4 throttle riêng, F5 idle, F2 token comment. BE 13 OK, hook 8/8, vitest 34/186, build 43s, tsc 0.
- **Validation tổng**: `manage.py check` 0, BE `service_ops` 56 OK (api 31 + stream 13 + triage 4 + rules 8), FE `vitest 34/186`, `jest 230`, `tsc 0`, `build PASS`. **Toàn bộ Signals P0/P1/P2a/P2b/P2c HOÀN TẤT** — đạt chuẩn thương mại Bloomberg/Datadog/Grafana (realtime, triage, rule, precision, feedback, SSE).

### Done (2026-09-16) — Overview P3 SSE health stream + Đóng Signals tag (Entry 111-112)
- **Signals đóng** (Entry 110 fix + tag): D1 doc fix `55→56` (AGENTS+ledger, commit `5d5fbbce`), D2 force-move tag **`soc-signals-v1.0` → `5d5fbbce`** (trước `ff44e840`), D3 leftover tests → backlog test-tech.
- **DataOps B (Entry 111, commit `d672dc41`)**: maintenance + build verification sau migration widget. Verified thật: grep `vninvestcharts` trong `src/components/soc/*DataOps*` **0 hit**, eslint 7 file DataOps **0 errors**, tsc 0, build PASS 46.79s, vitest soc-p2+overview 20/20, `jest soc.test.js` **90/90** (bao phủ DataOps adapter endpoints), `manage.py check` 0. Đính chính claim sai "vitest 34/186 bao phủ DataOps" trong Entry 111.
- **Overview P3 (Entry 112, commit `954a696e`) — SSE health stream (F-OV-14/15)**:
  - BE `overview_stream.py`: `OverviewStreamView` — snapshot diff status (signature không gồm `generated_at` → chỉ emit khi health đổi), `event: overview`, `:ping` 15s, idle 1h, `max_loops` test, `?token=` fallback, throttle `soc_stream` 60/min, poll DB 3s. Import `_sse_format`+`SOCStreamThrottle` từ `signals_stream.py` (no duplicate). Route `overview/stream/` + tests **9/9**.
  - FE `useOverviewStream.ts`: EventSource `event: overview` + onmessage fallback + backoff 1s→30s + watchdog 35s. `SocOverviewPanel.tsx`: `streamOpenRef` → interval chỉ fetchSlo khi open (không duplicate overview GET), `isDocVisible` → stream enabled, `onSnapshot` setData+clear error; status dot header (Live/Connecting/Reconnecting/Polling, reuse `soc.signals_overview.stream_*` keys). `soc.js` + `getSocOverviewStreamUrl()`.
  - Tests: vitest `soc-overview-stream.component.test.tsx` **2/2** (Live indicator + fallback Polling), `soc.test.js` **91/91** (+1), vitest soc **5 files/58/58**, BE** service_ops` 348 OK (skipped=1).
  - Gates: tsc 0, build PASS 33.32s, lint 0 errors (3549 warn pre-existing), `manage.py check` 0.
- **PR-1 + PR-2 Overview đã DONE từ trước** (docs `AUDIT_SOC_OVERVIEW_UI_UX_20260916.md`: PR-1 `d39f9fed` + PR-2 `25c26c96` merged) — không làm lại W1-W14. P3 backlog §8 còn: ETag/304, donut global HealthStatusView, export history CSV, dependency graph, maintenance scheduler; JSX migration hoãn (Đ3 audit).

## Key Decisions & Metrics
- Local `vninvestcharts/` component tree (~745 files, -102k lines) replaced by npm package `vninvestcharts-widget` ^1.2.5
- New adapter file: `packages/web/src/adapters/chartAdapter.js` — bridges core API → chart bar format
- New type declarations: `packages/web/src/types/vninvestcharts-widget.d.ts` — 44 lines
- renderSeries() registry refactor (Priority 2) completed in commit `3df5ff6c`
- **Widget lazy-load** (Option B): Widget code-split thành async chunk. App đã upgrade lên React 19 — recharts@2.15.4 hỗ trợ ^19.0.0.
- **SOC DataOps parity: ~95%+** (tất cả 20 feature gaps đóng).
- Priority 1 (VNInvestCharts.js split) và Priority 3 (contract test split) obsolete — component đã xoá

---

## AI Audit/Research Framework (Quy định cứng bắt buộc)

Mọi prompt audit, nghiên cứu, phân tích chi tiết dự án (bao gồm nhưng không giới hạn: audit code, research architecture, phân tích subsystem, review plan-vs-code, impact analysis, debugging investigation, spec verification, code-review, integration-test review) PHẢI tuân theo khung dưới đây. Quy định này áp dụng bắt buộc cho toàn bộ repo `vninvest`, không phụ thuộc vào repo `vninvestcharts-widget`.

### Nguyên tắc chống lỗi audit (kế thừa bài học DRAWING_DOCK + sai sót navigation/TDZ 2026-07-17)

| Bài học | Nguyên tắc chống tái diễn |
|---------|--------------------------|
| Plan bảo CSS "chết" nhưng code vẫn dùng | **Nguyên tắc 1**: grep/scrape PHẢI quét TOÀN repo bao gồm `.css`, `.module.css`, `soc.module.css`, config (`vite.config.ts`, `tsconfig*.json`), demo, i18n (`src/i18n/vi.js`, `en.js`). Không dừng ở file `.ts`/`.tsx`. |
| Plan bảo field X có trong state nhưng code không có | **Nguyên tắc 2**: Đối chiếu plan→code phải có mục CONTRADICTIONS riêng, mỗi dòng kèm `plan:file:line \| code:file:line \| impact`. |
| Plan trỏ file không tồn tại | **Nguyên tắc 3**: MỌI reference file phải được `read` hoặc `grep` xác nhận tồn tại. File KHÔNG TỒN TẠI → báo `KHÔNG TỒN TẠI`, không suy diễn "có thể ở đâu đó". |
| Quên external package coupling | **Nguyên tắc 4**: Web app tiêu thụ `vninvestcharts-widget` (npm `^1.2.5`) và `defaultCoreApiAdapter`. Mọi tracing qua ranh giới widget/adapter PHẢI kiểm tra (a) type declarations `src/types/vninvestcharts-widget.d.ts`, (b) adapter `src/adapters/core/market.js` + `transport.js`, (c) version thực tế trong `packages/web/package.json`. Không đoán shape của package ngoài. |
| Quên i18n / fat-file / quality gates | **Nguyên tắc 5**: Phần "Quality Gates" audit PHẢI gồm: (a) eslint status (`npm run lint`), (b) type-check status (`npm run build` = `tsc && vite build`), (c) i18n hardcoded string scan (`src/i18n/vi.js`, `en.js`, `npm run i18n:scan`), (d) test coverage gap (`npm run test`, `npm run test:components`). |
| Debug navigation/TDZ do thiếu trace thực tế | **Nguyên tắc 6**: Mọi điều tra bug runtime/UI PHẢI reproduce-first và trace từng bước qua file:line. Không chốt root cause bằng suy luận; phải có bằng chứng (console error, repro script, hoặc trace log) trước khi đề xuất fix. |

### Cấu trúc khung prompt chuẩn (điền scope cụ thể vào `[...]`)

```markdown
Bạn là kiểm toán viên mã nguồn cấp cao. Nhiệm vụ: NGHIÊN CỨU và PHÂN TÍCH CHI TIẾT
[phạm vi: subsystem / feature / module / package] tại:

  C:\Mujoco Projects\vninvest

(liên quan: packages/web = React/Vite app, packages/core = Django backend,
packages/vip-app, packages/opencore, packages/mobile — mọi phân tích qua
ranh giới web↔core hoặc web↔widget PHẢI tham chiếu CẢ HAI bên).

=== 0. NGUY TẮC BẮT BUỘC ===
1. MỌI khẳng định kèm `file_path:line_number`. Không có line = không hợp lệ.
2. KHÔNG đoán. Chưa đọc file thật → ghi "CHƯA XÁC MINH".
3. Bắt buộc dùng grep/glob/read, không dùng kinh nghiệm chung.
4. Plan/doc MÂU THUẪN với code → finding quan trọng nhất, báo mục CONTRADICTIONS.
5. grep/scrape TOÀN repo bao gồm .css, .module.css, config, i18n, adapters.
6. KHÔNG viết code. Chỉ nghiên cứu + phân tích + đề xuất (trừ khi được yêu cầu rõ).
7. KHÔNG bịa file. File không tồn tại → báo "KHÔNG TỒN TẠI".
8. Ngôn ngữ báo cáo: Tiếng Việt.

=== 1. ĐỌC TRƯỚC (bắt buộc) ===
- AGENTS.md, docs/CODE_CHANGE_AUDIT_LEDGER.md
- docs/ [các file context cần đọc]
- [tên plan / spec / review cần đối chiếu, ví dụ RUN_SPEC_AUDIT_*, RUN_CODE_REVIEW_*]

=== 2. PHẠM VI NGHIÊN CỨU ===
A. [SUB] — [mô tả subsystem A]
   - [file patterns / dirs cần glob, ví dụ packages/web/src/features/...]
   - [symbols cần grep]
   - [plan cần đối chiếu]

B. [SUB] — [mô tả subsystem B]
   - ...

C. CROSS-PACKAGE / EXTERNAL COUPLING (nếu có)
   - web↔core API contract (defaultCoreApiAdapter, src/adapters/core/*)
   - web↔vninvestcharts-widget (src/types/vninvestcharts-widget.d.ts, package.json version)
   - dist vs src staleness nếu liên quan engine

D. QUALITY GATES
   - Lint: npm run lint (packages/web)
   - Type-check: npm run build (= tsc && vite build)
   - i18n: src/i18n/vi.js, en.js + npm run i18n:scan
   - Test: npm run test, npm run test:components

=== 3. PHƯƠNG PHÁP ===
B1: Đọc context docs + plans (mục 1)
B2: glob [dir patterns]
B3: grep [key symbols]
B4: read từng file cốt lõi, trace 1 use-case cụ thể
B5: Đối chiếu plan ↔ code, gạch chỗ lệch
B6: Check ranh giới: lint, type-check, i18n, test, external coupling

=== 4. ĐẦU RA ===
A. Bản đồ kiến trúc (bảng: file | line_count | trách nhiệm | note)
B. Luồng dữ liệu đã trace (use-case cụ thể, kèm file:line từng bước)
C. CONTRADICTIONS (plan/doc vs code): [mỗi dòng] Plan X (file:line) | Thực tế Y (file:line) | Tác động
D. Findings: [ID] <ERROR|GAP|RISK> | Mức | file:line | Thực tế | Tác động | Đề xuất fix
E. Quality gates audit (lint / type-check / i18n / test)
F. Câu hỏi cần làm rõ
G. Đánh giá tổng thể: implementable? blocker? ưu tiên sửa?

=== 5. ĐẦU RA NGẮN ===
Tóm tắt 5 findings nghiêm trọng nhất vào 1 đoạn đầu file.
```

### Cách dùng

Khi cần AI phân tích/research/audit bất kỳ phần nào của dự án:
1. Copy template từ mục "Cấu trúc khung prompt chuẩn"
2. Điền `[phạm vi]`, file paths, symbols cần tra
3. Paste vào session AI mới
4. AI sẽ tự chạy grep/glob/read theo đúng quy trình

Không deviation khỏi cấu trúc đầu ra (mục 4). Thiếu section = kết quả không hợp lệ.

### Ghi chú ledger

Sau mọi thay đổi mã nguồn hoặc kết luận audit quan trọng, PHẢI cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` (root) theo quy ước现存 của dự án.
