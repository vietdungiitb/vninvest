# TASKBOARD - ENTERPRISE B2B MCP TRANSFORMATION SAAS CUTOVER

**Ngay:** 2026-05-03 (cap nhat 2026-05-03 sau kien truc review)  
**Trang thai:** Active — SAAS-14 completed, SAAS-15 is next  
**Muc tieu:** Chot cac slice cu the de dua VNInvest sang mo hinh SaaS that su, co machine-auth, tenant lifecycle, data-plane parity va legacy decommission.

**Architecture assessment:** `docs/SAAS_ARCHITECTURE_GAPS_ASSESSMENT_20260503.md`  
**Master roadmap:** `docs/SAAS_COMPLETION_MASTER_ROADMAP_20260503.md`

---

## 1. Board rule

1. Chi co mot slice `[/]` tai mot thoi diem.
2. `CODE_CHANGE_AUDIT_LEDGER.md` va `PROGRESS_DASHBOARD.md` phai dong bo sau moi slice PASS.
3. Moi slice phai co evidence template va handoff packet.
4. Current-code realignment board da dong; board nay la route tiep theo.

---

## 2. Slice board

| Slice ID | Priority | Owner | Scope | Anchors | Exit criteria | Status |
|---|---|---|---|---|---|---|
| `SAAS-00` | P0 | Platform Lead | Governance freeze va ownership map | handoff master, execution plan, governance freeze doc, ledger/progress | legacy hotfix-only, package-target boundaries, evidence model va single-active-slice rule duoc chot | completed |
| `SAAS-01` | P0 | Backend Lead | Access plane finalization | `backend/portfolio/auth_views.py`, `backend/portfolio/tests/test_api_routes_auth_profile.py`, `packages/core/backend/src/vninvest_core/api_stub.py`, `shared/api-contracts/capability-bootstrap.contract.json`, `frontend/src/context/AbilityContext.js`, `frontend/src/components/ProtectedRoute.jsx` | capability snapshot versioned, human vs machine surface map ro rang, bridge semantics chi con transitional | completed |
| `SAAS-02` | P0 | Backend Lead | Partner machine-auth cutover | `backend/portfolio/views_partner_admin.py`, `backend/portfolio/models.py`, `backend/portfolio/authentication_partner.py`, `backend/portfolio/tests/test_partner_admin_api.py`, `frontend/src/api/client.js` | PAT auth la target path cho partner APIs, issue/rotate/revoke co idempotency + audit reason, browser khong cam machine credential | completed |
| `SAAS-03` | P0 | Backend/Finance Lead | Tenant lifecycle and commercial parity | `backend/portfolio/models.py`, `backend/portfolio/views_admin_runtime.py`, `backend/portfolio/tests/test_operator_tenant_registry_api.py`, `backend/portfolio/tests/test_partner_admin_api.py`, `docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md`, `docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md` | onboard/activate/upgrade/downgrade/suspend/unsuspend/deprovision co truth, usage/quota/subscription/invoice khop nhau | completed |
| `SAAS-04` | P0 | Data Lead | Data-plane facts parity and freshness | `backend/portfolio/market_data_service.py`, `backend/portfolio/services_whale_analytics_snapshot.py`, `frontend/src/components/KLineChartPanel.jsx`, `frontend/src/pages/WhaleAlertsDashboard.jsx`, `frontend/src/pages/StockDetail.jsx`, `docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md` | symbol_snapshot/session_facts/unified_alert la serving truth, stale/degraded semantics co witness, raw scan khong con la primary path | completed |
| `SAAS-05` | P1 | Release Lead | Shadow run and pilot | `packages/web/scripts/check-shell.mjs`, `frontend/src/pages/packageShellHostRuntime.test.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`, `frontend/src/pages/AiAdvisoryShellHost.jsx`, `frontend/src/pages/WhaleAlertsShellHost.jsx`, `docker-compose.dev.yml` | dual-run diff, pilot cohort, rollback rehearsal va signoff report duoc ghi lai | completed |
| `SAAS-06` | P1 | Platform/DevOps Lead | Legacy decommission | `backend/portfolio/urls.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_access.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_refresh.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_delete_current.py`, `backend/portfolio/tests/test_api_routes_trading_and_p1_13.py`, `backend/portfolio/views_ai_advisory_management.py`, `backend/portfolio/views_ai_runtime_stats.py`, `backend/portfolio/views_stock_order_flow.py`, `frontend/src/App.adminCoreRoutes.test.jsx` | legacy runtime khong con nam trong normal operation, read-only fallback window dong, route/script/doc refs duoc go bo | completed |
| `SAAS-07` | P1 | Platform/DevOps Lead | Production manifest hardening | `docker-compose.prod.yml`, `frontend/Dockerfile.dev-package-shell` | production compose parses cleanly, package-shell host la frontend deployment path, no merge markers hoac legacy frontend build remain in prod manifest | completed |
| `SAAS-08` | P0 | Core Lead | Core package adoption | `packages/core/backend/src/vninvest_core/api_stub.py`, `packages/core/backend/src/vninvest_core/app_manifest.py`, `packages/core/backend/src/vninvest_core/worker_stub.py`, `packages/core/backend/src/vninvest_core/beat_stub.py`, `packages/core/backend/tests/test_runtime_baseline.py`, `packages/core/docker-compose.core.yml`, `docker-compose.prod.yml`, `frontend/docker/nginx.conf` | core runtime smoke proof, package manifest/bootstrap/heartbeat validated, prod topology exposes `core-api` for `/core/v1`, no legacy-only assumption on package-track surface | completed |
| `SAAS-09` | P0 | Web Lead | Web package consolidation | `frontend/src/pages/SupportShellHost.jsx`, `frontend/src/pages/SettingsShellHost.jsx`, `frontend/src/pages/AICommandCenterShellHost.jsx`, `frontend/src/pages/AdminOpsShellHost.jsx`, `frontend/src/pages/PortfoliosShellHost.jsx`, `frontend/src/pages/WatchlistShellHost.jsx`, `frontend/src/pages/TransactionsShellHost.jsx`, `frontend/src/App.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`, `packages/web/src/pages/system/ShellSupportPage.js`, `packages/web/src/pages/system/ShellSettingsPage.js`, `packages/web/src/pages/system/ShellAiCommandCenterPage.js`, `packages/web/src/pages/admin/ShellAdminOpsPage.js`, `packages/web/src/pages/workspace/ShellPortfoliosPage.js`, `packages/web/src/pages/workspace/ShellWatchlistPage.js`, `packages/web/src/pages/workspace/ShellTransactionsPage.js` | support, settings, settings/ai, admin-ops, portfolios, watchlist and transactions routes mount package shell host when flag enabled, legacy fallback remains when disabled, route-level regression tests pass | completed |
| `SAAS-09B` | P0 | Web Lead | Dashboard shell host follow-up | `frontend/src/pages/DashboardShellHost.jsx`, `frontend/src/pages/DashboardShellHost.test.jsx`, `frontend/src/App.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`, `frontend/src/pages/Dashboard.jsx`, `packages/web/src/pages/workspace/ShellDashboardPage.js` | dashboard route mount package shell host when flag enabled, legacy Dashboard dispatcher remains when disabled, route-level regression tests pass, browser proof captured on /dashboard | completed |
| `SAAS-10` | P0 | VIP Lead | VIP app completion | `packages/web/src/pages/vip/VipLocalControlPage.js`, `packages/web/src/app/routeCatalog.js`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/adapters/vip-app/vipAppAdapter.js`, `packages/web/scripts/check-vip-local-control.mjs`, `packages/vip-app/local-backend/api_stub.py`, `packages/vip-app/local-backend/store.py`, `packages/vip-app/docker-compose.vip.yml` | vip-local-control route resolves to VipLocalControlPage, vip-app adapter endpoints and local backend smoke pass, dedicated VIP smoke script passes, no separate frontend source added under packages/vip-app | completed |
| `SAAS-11` | P0 | Mobile Lead | Mobile package completion | `packages/mobile/src/runtimeConfig.js`, `packages/mobile/src/index.js`, `packages/mobile/src/navigation/mobileNavigation.js`, `packages/mobile/src/components/MobileBottomTabBar.js`, `packages/mobile/src/i18n/index.ts`, `packages/mobile/src/theme/colors.ts`, `packages/mobile/src/types/*.ts`, `packages/mobile/src/services/*.ts`, `packages/mobile/src/store/*.ts`, `packages/mobile/src/screens/*.tsx`, `packages/mobile/scripts/check-mobile-config.mjs`, `packages/mobile/scripts/check-mobile-navigation.mjs`, `mobile-app/src/services/*.ts`, `mobile-app/src/store/*.ts`, `mobile-app/src/i18n/index.ts`, `mobile-app/src/theme/colors.ts`, `mobile-app/src/types/*.ts`, `mobile-app/src/screens/*.tsx`, `mobile-app/src/components/BottomTabBar.tsx`, `mobile-app/src/app/AppRoot.tsx`, `mobile-app/metro.config.js`, `mobile-app/tsconfig.json`, `packages/mobile/README.md`, `packages/mobile/package.json` | mobile package owns shared runtime config, navigation, auth, dashboard, transactions, watchlist, whale and shared primitives; legacy mobile-app keeps thin wrappers and app shell glue only; config/nav smoke plus mobile-app typecheck stay green | completed |

---

## 3. Detailed slice notes

### SAAS-00

Slice nay la governance freeze va ownership map. Khong co freeze thi cac slice sau se tro thanh target-state prose.

Current working artifact: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_GOVERNANCE_FREEZE_20260503.md`.

Freeze outputs expected from this slice:

1. Legacy hotfix-only list.
2. Package implementation target list.
3. Change policy and evidence requirements.
4. Explicit statement that feature development on legacy paths stops here.

Status note: completed.

### SAAS-01

Slice nay tach human session va machine auth. Kiem soat chung: capability snapshot phai versioned, front-end surface map phai explicit, va package track khong duoc quay lai broad bridge semantics.

Current working artifact: `backend/portfolio/auth_views.py`, `backend/portfolio/tests/test_api_routes_auth_profile.py`, `packages/core/backend/src/vninvest_core/api_stub.py`, `shared/api-contracts/capability-bootstrap.contract.json`.

Freeze outputs expected from this slice:

1. Capability snapshot version field khop giua legacy backend va package stub.
2. Tests xac minh versioned payload.
3. Shared contract thoi them field versioned de package track theo kịp.
4. Bridge semantics chi con transitional.

Status note: completed.

### SAAS-02

Slice nay la cutover auth thuc su cho partner plane. If this slice fails, SaaS van chi la monolith co credential wrapper.

Current working artifact: `backend/portfolio/views_partner_admin.py`, `backend/portfolio/models.py`, `backend/portfolio/authentication_partner.py`, `backend/portfolio/tests/test_partner_admin_api.py`, `frontend/src/api/client.js`.

Freeze outputs expected from this slice:

1. Partner APIs chap nhan Bearer PAT song song voi session fallback.
2. Mutating partner actions co audit reason + auth mode metadata.
3. Client helper gan default audit reason de browser flow khong lo payload gap.
4. PAT expire sau grace window khong con la token hop le.

Status note: completed.

### SAAS-03

Slice nay la business lifecycle slice. Chi sau slice nay tenant moi di duoc het vong doi SaaS ma khong can thao tac DB thu cong.

Current working artifact: `backend/portfolio/models.py`, `backend/portfolio/views_admin_runtime.py`, `backend/portfolio/tests/test_operator_tenant_registry_api.py`, `backend/portfolio/tests/test_partner_admin_api.py`.

Freeze outputs expected from this slice:

1. Tenant status machine va lifecycle projection ro rang.
2. Usage/quota/subscription/invoice khop nhau trong operator va partner snapshots.
3. Deprovision/suspend/unsuspend/upgrade/downgrade transitions co truth.

Status note: completed.

### SAAS-04

Slice nay dam bao data-plane khong noi doi. Chuan cuoi la selected-session facts-first path, co freshness witness va degraded semantics ro rang.

Current working artifact: `backend/portfolio/market_data_service.py`, `backend/portfolio/services_whale_analytics_snapshot.py`, `frontend/src/components/KLineChartPanel.jsx`, `frontend/src/pages/WhaleAlertsDashboard.jsx`, `frontend/src/pages/StockDetail.jsx`.

Freeze outputs expected from this slice:

1. symbol_snapshot/session_facts/unified_alert la serving truth.
2. Stale/degraded semantics co witness ro rang.
3. Raw scan khong con la primary path.

Status note: completed.

### SAAS-05

Slice nay la proof that package track can run the business flow. Chay shadow/pilot truoc khi mo cua cutover.

Current working artifact: `packages/web/scripts/check-shell.mjs`, `frontend/src/pages/packageShellHostRuntime.test.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`.

Freeze outputs expected from this slice:

1. Dual-run parity so payload, auth, gating, route behavior va UX khop nhau.
2. Pilot cohort nho duoc ghi nhan trong evidence packet.
3. Rollback rehearsal through package-shell disable flag va route fallback.

Status note: completed.

### SAAS-06

Slice nay chi duoc mo khi SAAS-01 den SAAS-05 xong va co rollback proof. Muc tieu la xoa legacy path khoi luong van hanh binh thuong.

Current working artifact: `backend/portfolio/urls.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_access.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_refresh.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_delete_current.py`, `backend/portfolio/tests/test_api_routes_trading_and_p1_13.py`, `backend/portfolio/views_ai_advisory_management.py`, `backend/portfolio/views_ai_runtime_stats.py`, `backend/portfolio/views_stock_order_flow.py`, `frontend/src/App.adminCoreRoutes.test.jsx`.

Status note: completed.

Status note: completed.

### SAAS-07

Slice nay harden production manifest de frontend deploy path chay qua package-shell host thay vi root legacy frontend build, dong thoi loai bo merge conflict residue trong `docker-compose.prod.yml`.

Current working artifact: `docker-compose.prod.yml`.

Freeze outputs expected from slice:

1. Production compose parse thanh cong va khong con conflict markers.
2. Frontend prod build chay qua `frontend/Dockerfile.dev-package-shell` voi package-shell env explicit.
3. Deployment graph giu chuyen tiep until core package cutover, khong mo them legacy frontend build path moi.

Status note: completed.

### SAAS-08

Slice nay la core package adoption slice dau tien. Muc tieu la chot runtime smoke proof cho `packages/core` va lam ro rang package track co the chay doc lap nhu runtime baseline.

Current working artifact: `packages/core/backend/src/vninvest_core/api_stub.py`, `packages/core/backend/src/vninvest_core/app_manifest.py`, `packages/core/backend/src/vninvest_core/worker_stub.py`, `packages/core/backend/src/vninvest_core/beat_stub.py`, `packages/core/backend/src/vninvest_core/stub_heartbeat.py`, `packages/core/backend/tests/test_runtime_baseline.py`, `packages/core/docker-compose.core.yml`, `docker-compose.prod.yml`, `frontend/docker/nginx.conf`.

Freeze outputs expected from slice:

1. Core manifest, capability bootstrap va heartbeat smoke tests pass.
2. Prod topology exposes `core-api` behind `/core/v1` for the package-shell frontend.
3. Evidence phai ghi ro core adoption la package-track baseline, chua phai legacy backend truth migration hoac decommission.

Status note: completed.

### SAAS-09

Slice nay la web package consolidation nho dau tien: chuyen route `support`, `settings`, `settings/ai`, `admin-ops`, `watchlist` va `transactions` sang package shell host de route nay doc service lane tu `packages/web` thay vi page local legacy.

Current working artifact: `frontend/src/pages/SupportShellHost.jsx`, `frontend/src/pages/SupportShellHost.test.jsx`, `frontend/src/pages/SettingsShellHost.jsx`, `frontend/src/pages/SettingsShellHost.test.jsx`, `frontend/src/pages/AICommandCenterShellHost.jsx`, `frontend/src/pages/AICommandCenterShellHost.test.jsx`, `frontend/src/pages/AdminOpsShellHost.jsx`, `frontend/src/pages/AdminOpsShellHost.test.jsx`, `frontend/src/pages/PortfoliosShellHost.jsx`, `frontend/src/pages/PortfoliosShellHost.test.jsx`, `frontend/src/pages/WatchlistShellHost.jsx`, `frontend/src/pages/WatchlistShellHost.test.jsx`, `frontend/src/pages/TransactionsShellHost.jsx`, `frontend/src/pages/TransactionsShellHost.test.jsx`, `frontend/src/App.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`, `packages/web/src/pages/system/ShellSupportPage.js`, `packages/web/src/pages/system/ShellSettingsPage.js`, `packages/web/src/pages/system/ShellAiCommandCenterPage.js`, `packages/web/src/pages/admin/ShellAdminOpsPage.js`, `packages/web/src/pages/workspace/ShellPortfoliosPage.js`, `packages/web/src/pages/workspace/ShellWatchlistPage.js`, `packages/web/src/pages/workspace/ShellTransactionsPage.js`.

Freeze outputs expected from this slice:

1. Route `support` mount `SupportShellHost` khi shell flag bat.
2. Route `settings` mount `SettingsShellHost` khi shell flag bat.
3. Route `settings/ai` mount `AICommandCenterShellHost` khi shell flag bat.
4. Route `admin-ops` mount `AdminOpsShellHost` khi shell flag bat.
5. Route `portfolios` mount `PortfoliosShellHost` khi shell flag bat.
6. Route `watchlist` mount `WatchlistShellHost` khi shell flag bat.
7. Route `transactions` mount `TransactionsShellHost` khi shell flag bat.
8. Legacy `Support`, `UserConfig`, `AICommandCenter`, `AdminOps`, `PortfolioManagement`, `Watchlist` va `Transactions` page van dung duoc khi shell flag tat.
9. Route regression test phai pass de audit co the verify consolidation.

Status note: completed.

### SAAS-09B

Slice nay la follow-up cho route dashboard: mount `ShellDashboardPage` tu `packages/web` qua mot host wrapper, giu `Dashboard` legacy dispatcher khi shell flag tat, va co browser proof tren `/dashboard`.

Current working artifact: `frontend/src/pages/DashboardShellHost.jsx`, `frontend/src/pages/DashboardShellHost.test.jsx`, `frontend/src/App.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`, `frontend/src/pages/Dashboard.jsx`, `packages/web/src/pages/workspace/ShellDashboardPage.js`.

Freeze outputs expected from slice:

1. Route `/dashboard` mount `DashboardShellHost` khi shell flag bat.
2. Legacy `Dashboard` dispatcher van dung duoc khi shell flag tat.
3. Route regression test cover ca hai nhánh enabled/disabled.
4. Browser proof chụp duoc viewport dashboard shell host sau khi rebuild dev stack.

Browser proof: logged in as `testpro / test@123456` and captured `/dashboard` showing the dashboard shell host banner plus the shared dashboard workspace surface.

Status note: completed.

### SAAS-10

Slice nay chot VIP local control seam trong `packages/web` va local backend facade trong `packages/vip-app`. Khong co VIP frontend source rieng; route, page registry va adapter phai duoc smoke test roi moi xem la doc.

Current working artifact: `packages/web/src/pages/vip/VipLocalControlPage.js`, `packages/web/src/app/routeCatalog.js`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/adapters/vip-app/vipAppAdapter.js`, `packages/web/scripts/check-vip-local-control.mjs`, `packages/vip-app/local-backend/api_stub.py`, `packages/vip-app/local-backend/store.py`, `packages/vip-app/docker-compose.vip.yml`.

Freeze outputs expected from this slice:

1. Route `vip-local-control` resolve to `VipLocalControlPage` trong page registry va route catalog.
2. `vip-app` adapter endpoints trỏ ve local backend base URL va request flow khop smoke proof.
3. Dedicated `check:vip` smoke script pass cho adapter, route catalog va page markup.
4. Khong them separate frontend source vao `packages/vip-app`.

Status note: completed.

### SAAS-11

Slice nay tiep tuc mobile package completion bang cach mo rong `packages/mobile` sang auth/shared-primitives layer: `packages/mobile` phai own shared mobile API/WS/demo defaults, tab catalog, bottom navigation shell, i18n, colors, auth store, locale store, token/http/authApi, va auth/login entrypoint; `mobile-app` phai tiep tuc consume package boundary qua thin wrappers thay vi giu logic rieng.

Current working artifact: `packages/mobile/src/runtimeConfig.js`, `packages/mobile/src/index.js`, `packages/mobile/src/navigation/mobileNavigation.js`, `packages/mobile/src/components/MobileBottomTabBar.js`, `packages/mobile/src/i18n/index.ts`, `packages/mobile/src/theme/colors.ts`, `packages/mobile/src/types/*.ts`, `packages/mobile/src/services/*.ts`, `packages/mobile/src/store/*.ts`, `packages/mobile/src/screens/*.tsx`, `packages/mobile/scripts/check-mobile-config.mjs`, `packages/mobile/scripts/check-mobile-navigation.mjs`, `mobile-app/src/services/*.ts`, `mobile-app/src/store/*.ts`, `mobile-app/src/i18n/index.ts`, `mobile-app/src/theme/colors.ts`, `mobile-app/src/types/*.ts`, `mobile-app/src/screens/*.tsx`, `mobile-app/src/components/BottomTabBar.tsx`, `mobile-app/src/app/AppRoot.tsx`, `mobile-app/metro.config.js`, `mobile-app/tsconfig.json`, `packages/mobile/README.md`, `packages/mobile/package.json`.

Freeze outputs expected from this slice:

1. `packages/mobile` owns shared runtime config defaults, tab catalog, bottom navigation shell, auth/login screen, dashboard/transactions/watchlist/whale screens, and shared mobile primitives.
2. `mobile-app` consumes package-owned shared primitives via thin wrappers only; legacy screen bodies no longer live there.
3. `mobile-app/src/services/config.ts`, `mobile-app/src/services/http.ts`, `mobile-app/src/store/authStore.ts`, `mobile-app/src/store/localeStore.ts`, `mobile-app/src/i18n/index.ts`, `mobile-app/src/theme/colors.ts`, `mobile-app/src/types/*.ts`, and `mobile-app/src/screens/*.tsx` consume package-owned boundaries.
4. `mobile-app/src/components/BottomTabBar.tsx` and `mobile-app/src/app/AppRoot.tsx` continue to consume package-owned navigation defs and tab ownership.
5. `mobile-app/metro.config.js` and `mobile-app/tsconfig.json` keep sibling package migration resolvable in Expo/Metro and TypeScript.
6. Dedicated `check:mobile` and `check:mobile-navigation` smoke plus `mobile-app` typecheck stay green for the package track contracts.
7. `mobile-app/src/screens/AuthScreen.tsx`, `ProfileScreen.tsx`, `HomeScreen.tsx`, `DashboardScreen.tsx`, `TransactionsScreen.tsx`, `WatchlistScreen.tsx`, and `WhaleScreen.tsx` are thin wrappers only.

Status note: completed.

---

## 4. Next recommended route

1. `SAAS-11` is completed.
2. Future shared-contract work should start at `SAAS-12`.
3. Neu taskboard, ledger va progress khong khop, dung ngay va sua drift truoc khi claim slice moi.

---

## 5. Slice board — Phase 2: SaaS completion (SAAS-12 den SAAS-15)

| Slice ID | Priority | Owner | Scope | Anchors | Exit criteria | Status |
|---|---|---|---|---|---|---|
| `SAAS-12` | P0 | Platform Lead | Shared contract lock va mobile API migration | `shared/api-contracts/symbol-snapshot.contract.json`, `shared/api-contracts/session-facts.contract.json`, `shared/api-contracts/unified-alert.contract.json`, `shared/api-contracts/whale-feed-aggregate.contract.json`, `shared/api-contracts/tenant-lifecycle.contract.json`, `shared/api-contracts/partner-pat.contract.json`, `shared/scripts/validate-contracts.mjs` | 6 data-plane contracts locked va valid; contract validator script pass (9/9 PASS); mobile migration DEFERRED (mobile-app locked) | ✅ completed |
| `SAAS-13` | P0 | Core Lead | packages/core domain extraction — Django that | `packages/core/backend/requirements.txt`, `packages/core/backend/manage.py`, `packages/core/backend/src/vninvest_core/settings.py`, `packages/core/backend/src/vninvest_core/urls.py`, `packages/core/backend/src/vninvest_core/celery.py`, `packages/core/backend/src/identity_access/models.py`, `packages/core/backend/src/market_serving/models.py`, `packages/core/backend/src/signal_intelligence/models.py`, `packages/core/backend/src/commercial/models.py`, `packages/core/backend/src/ops_audit/middleware.py`, `packages/core/docker-compose.core.yml` | packages/core chay Django doc lap; CoreTenant/CoreServiceAccount/CorePATCredential trong identity_access; X-Request-ID propagation; khong co import tu backend/portfolio; 23/23 unit tests pass | ✅ completed |
| `SAAS-14` | P0 | Data Lead | Data-plane serving models materialization + cursor pagination | `packages/core/backend/src/market_serving/materializers.py`, `packages/core/backend/src/signal_intelligence/materializers.py`, `packages/core/backend/src/vninvest_core/pagination.py`, `packages/web/src/adapters/coreApiAdapter.js` | Celery materializers chay on schedule; SymbolSnapshot/SessionFacts/UnifiedAlert co data fresh; cursor pagination tren list APIs; packages/web goi /core/v1 qua coreApiAdapter; 29/29 Python tests + 12/12 jest tests pass | ✅ completed |
| `SAAS-15` | P1 | Platform/DevOps Lead | Legacy decommission final gate | `docker-compose.dev.yml`, `docker-compose.prod.yml`, `frontend/docker/nginx.conf`, `AGENTS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md` | Gates A-F trong SAAS15 doc deu GREEN; decommission sequence hoan thanh; production traffic 24h khong tang error; legacy containers khong con trong docker ps | not started |
| `SAAS-16` | P2 | Platform Lead | packages/opencore community distribution | `packages/opencore/` | community/self-host distribution bundle; upgrade journey community → SaaS | future |

---

## 6. Detailed slice notes — Phase 2

### SAAS-12

Slice nay lock toan bo data-plane contracts truoc khi bat dau migration bat ky client nao. Khong co contract lock thi moi client se self-interpret API response khac nhau va khong the test regression.

Anchor doc: `docs/SAAS12_SHARED_CONTRACT_LOCK_EXECUTION_PLAN_20260503.md`

Outputs expected:
1. 6 contract files trong `shared/api-contracts/` — valid JSON, co version field.
2. `validate-contracts.mjs` script chay pass.
3. Mobile services migrate sang `/core/v1` paths.
4. `packages/mobile/src/services/coreHttp.ts` inject X-Request-ID.

Status note: ✅ completed 2026-05-03. 6 contracts created; validator 9/9 PASS. Mobile migration deferred (user decision — mobile-app locked).

Evidence: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS12.md`

---

### SAAS-13

Slice nay chuyen packages/core tu ThreadingHTTPServer stub thanh Django/DRF that. Day la backbone slice — tat ca slice sau deu phu thuoc vao day.

Anchor doc: `docs/SAAS13_PACKAGES_CORE_DOMAIN_EXTRACTION_PLAN_20260503.md`

Bounded contexts:
- `identity_access` — CoreTenant, CoreServiceAccount, CorePATCredential
- `market_serving` — SymbolSnapshot, SessionFacts (read models)
- `signal_intelligence` — UnifiedAlert, WhaleAlertCanonical
- `commercial` — Subscription, Quota, Invoice
- `ops_audit` — AuditEvent, RequestTraceMiddleware

Isolation rule: khong duoc co import nao tu `backend/portfolio` vao `packages/core`.

Status note: not started.

---

### SAAS-14

Slice nay materialize data vao serving models cua packages/core bang Celery jobs, dong thoi migrate packages/web sang coreApiAdapter va them cursor pagination.

Anchor doc: `docs/SAAS14_DATA_PLANE_SERVING_MODELS_PLAN_20260503.md`

Materializer schedule:
- `materialize_symbol_snapshot` — moi 60s
- `materialize_session_facts` — moi 5 phut
- `materialize_unified_alerts` — moi 5 phut
- `materialize_whale_feed_aggregate` — moi 5 phut

Status note: not started.

---

### SAAS-15

Slice nay la formal gate truoc khi decommission legacy roots. KHONG duoc bat dau decommission neu chua co explicit go decision tu platform lead.

Anchor doc: `docs/SAAS15_LEGACY_DECOMMISSION_GATES_20260503.md`

Gate checklist: 6 gates (A: core completeness, B: data-plane, C: client migration, D: contract coverage, E: regression tests, F: production routing).

Decommission sequence: Phase 1 (route isolation) → Phase 2 (read-only window 7 ngay) → Phase 3 (legacy shutdown) → Phase 4 (archive).

Status note: not started.

