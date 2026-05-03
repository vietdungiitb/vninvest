# TASKBOARD - ENTERPRISE B2B MCP TRANSFORMATION SAAS CUTOVER

**Ngay:** 2026-05-03  
**Trang thai:** Completed execution board sau package parity  
**Muc tieu:** Chot cac slice cu the de dua VNInvest sang mo hinh SaaS that su, co machine-auth, tenant lifecycle, data-plane parity va legacy decommission.

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
| `SAAS-11` | P0 | Mobile Lead | Mobile runtime config bridge | `packages/mobile/src/runtimeConfig.js`, `packages/mobile/src/index.js`, `packages/mobile/scripts/check-mobile-config.mjs`, `mobile-app/src/services/config.ts`, `mobile-app/metro.config.js`, `packages/mobile/README.md`, `packages/mobile/package.json` | mobile package owns shared runtime config defaults, legacy mobile-app consumes the package boundary through a thin bridge, dedicated mobile config smoke passes, mobile-app Metro resolves the sibling package | in-progress |

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

Slice nay mo phan dau tien cua mobile package completion bang cach tap trung vao runtime config bridge va screen/navigation bridge: `packages/mobile` phai own shared mobile API/WS/demo defaults, tab catalog va bottom navigation shell; `mobile-app` phai re-export config va consume navigation package boundary thay vi giu logic rieng.

Current working artifact: `packages/mobile/src/runtimeConfig.js`, `packages/mobile/src/index.js`, `packages/mobile/src/navigation/mobileNavigation.js`, `packages/mobile/src/components/MobileBottomTabBar.js`, `packages/mobile/scripts/check-mobile-config.mjs`, `packages/mobile/scripts/check-mobile-navigation.mjs`, `mobile-app/src/services/config.ts`, `mobile-app/src/components/BottomTabBar.tsx`, `mobile-app/src/app/AppRoot.tsx`, `mobile-app/metro.config.js`, `packages/mobile/README.md`, `packages/mobile/package.json`.

Freeze outputs expected from this slice:

1. `packages/mobile` co shared runtime config defaults cho API, websocket va demo creds.
2. `packages/mobile` own tab catalog va bottom navigation shell for the mobile app.
3. `mobile-app/src/services/config.ts` consume shared config boundary qua thin bridge.
4. `mobile-app/src/components/BottomTabBar.tsx` va `mobile-app/src/app/AppRoot.tsx` consume package-owned navigation defs.
5. Dedicated `check:mobile` va `check:mobile-navigation` smoke pass cho config va navigation contracts.
6. `mobile-app/metro.config.js` load duoc sibling package path cho future package migration.

Status note: in-progress.

---

## 4. Next recommended route

1. `SAAS-11` is in-progress.
2. Neu future decommission follow-up xuat hien, mo board/slice moi va dong bo audit surfaces truoc khi code.
3. Neu taskboard, ledger va progress khong khop, dung ngay va sua drift truoc khi claim slice moi.
