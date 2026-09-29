# SAAS-09 Execution Evidence - Support / Settings / Settings AI / Admin Ops / Portfolios / Watchlist / Transactions Shell Route Consolidation

## 1. Slice identity

- Slice ID: SAAS-09
- Ngay: 2026-05-03
- Owner: Web Lead
- Task status when claimed: in-progress
- Task status when closed: completed
- Scope: web package consolidation

## 2. Objective

- Migrate the `support`, `settings`, `settings/ai`, `admin-ops`, `portfolios`, `watchlist` and `transactions` routes from the legacy frontend pages into the package-shell host path backed by `packages/web`.
- Keep the legacy `Support`, `UserConfig`, `AICommandCenter`, `AdminOps`, `PortfolioManagement`, `Watchlist` and `Transactions` pages as fallbacks when the shell flag is disabled.

## 3. Files changed

- frontend/src/pages/SupportShellHost.jsx
- frontend/src/pages/SupportShellHost.test.jsx
- frontend/src/pages/SettingsShellHost.jsx
- frontend/src/pages/SettingsShellHost.test.jsx
- frontend/src/pages/AICommandCenterShellHost.jsx
- frontend/src/pages/AICommandCenterShellHost.test.jsx
- frontend/src/pages/AdminOpsShellHost.jsx
- frontend/src/pages/AdminOpsShellHost.test.jsx
- frontend/src/pages/PortfoliosShellHost.jsx
- frontend/src/pages/PortfoliosShellHost.test.jsx
- frontend/src/pages/WatchlistShellHost.jsx
- frontend/src/pages/WatchlistShellHost.test.jsx
- frontend/src/pages/TransactionsShellHost.jsx
- frontend/src/pages/TransactionsShellHost.test.jsx
- frontend/src/App.jsx
- frontend/src/App.adminCoreRoutes.test.jsx
- docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md
- module_tree_full.md

## 4. Validation

- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false --runTestsByPath src/App.adminCoreRoutes.test.jsx src/pages/SettingsShellHost.test.jsx src/pages/AICommandCenterShellHost.test.jsx; Pop-Location` -> route wrapper tests passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false --runTestsByPath src/App.adminCoreRoutes.test.jsx src/pages/AdminOpsShellHost.test.jsx; Pop-Location` -> admin ops shell host tests passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false --runTestsByPath src/App.adminCoreRoutes.test.jsx src/pages/PortfoliosShellHost.test.jsx; Pop-Location` -> portfolios shell host tests passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; npm test -- --runInBand --watch=false src/pages/SupportShellHost.test.jsx; Pop-Location` -> 1 test passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false --runTestsByPath src/App.adminCoreRoutes.test.jsx src/pages/WatchlistShellHost.test.jsx; Pop-Location` -> 18 tests passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false --runTestsByPath src/App.adminCoreRoutes.test.jsx src/pages/TransactionsShellHost.test.jsx; Pop-Location` -> transactions shell host tests passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest"; & ".\.venv\Scripts\python.exe" "scripts/ops/generate_module_tree.py"; Pop-Location` -> module tree regenerated successfully (610 modules).
- PASSED: `Push-Location .; docker compose -f ./docker-compose.dev.yml up -d --build frontend backend; Pop-Location` -> dev frontend/backend stack refreshed and containers reported healthy.
- PASSED: `Push-Location .; docker compose -f ./docker-compose.dev.yml up -d --build frontend backend; Pop-Location` -> dev frontend/backend stack refreshed and containers reported healthy.

## 5. Payload snapshots

- Route snapshot: `support` now mounts `SupportShellHost`, `settings` now mounts `SettingsShellHost`, `settings/ai` now mounts `AICommandCenterShellHost`, `admin-ops` now mounts `AdminOpsShellHost`, and `portfolios` now mounts `PortfoliosShellHost` when `REACT_APP_ENABLE_PACKAGE_SHELL_HOST=1`.
- Fallback snapshot: `support` still renders the legacy `Support` page, `settings` still renders `UserConfig`, `settings/ai` still renders `AICommandCenter`, `admin-ops` still renders `AdminOps`, `portfolios` still renders `PortfolioManagement`, `watchlist` still renders `Watchlist`, and `transactions` still renders `Transactions` when the shell flag is disabled.
- Package-shell snapshot: `SupportShellHost` mounts `ShellSupportPage`, `SettingsShellHost` mounts `ShellSettingsPage`, `AICommandCenterShellHost` mounts `ShellAiCommandCenterPage`, `AdminOpsShellHost` mounts `ShellAdminOpsPage`, `PortfoliosShellHost` mounts `ShellPortfoliosPage`, `WatchlistShellHost` mounts `ShellWatchlistPage`, and `TransactionsShellHost` mounts `ShellTransactionsPage` from `@vninvest/web` and uses the shared package-shell bootstrap loader.
- Wrapper snapshot: `SupportShellHost.test.jsx`, `SettingsShellHost.test.jsx`, `AICommandCenterShellHost.test.jsx`, `AdminOpsShellHost.test.jsx`, `PortfoliosShellHost.test.jsx`, `WatchlistShellHost.test.jsx` and `TransactionsShellHost.test.jsx` prove the component boundary calls the shared shell pages with package shell runtime props.

## 6. UI/runtime proof

- Screenshot/browser proof: captured on `http://localhost/settings/ai`, `http://localhost/admin-ops`, and `http://localhost/portfolios`, each showing the package shell host banner and the live shared shell page surface.
- Route/actor used to prove: `http://localhost/settings/ai`, `http://localhost/admin-ops`, `http://localhost/portfolios`, `App.adminCoreRoutes.test.jsx`, `AICommandCenterShellHost.test.jsx`, `AdminOpsShellHost.test.jsx`, and `PortfoliosShellHost.test.jsx`.
- Dev stack refresh command: `Push-Location .; docker compose -f ./docker-compose.dev.yml up -d --build frontend backend; Pop-Location`.

## 7. Residual risk note

- Only the `support`, `settings`, `settings/ai`, `admin-ops`, `portfolios`, `watchlist` and `transactions` routes have been moved so far; the broader web package consolidation lane still has many legacy routes/pages left to migrate.

## 8. Handoff packet

- Trang thai khi roi slice: completed
- Next recommended task ID: next web route inventory / new slice
- Route doc consulted: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_FINAL_PLAN_20260503.md`
- Exact command de resume hoac verify dau tien: `Push-Location "c:/Mujoco Projects/vninvest/frontend"; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false src/App.adminCoreRoutes.test.jsx; Pop-Location`
- Blockers / residual risks / immutable guardrails: broader web consolidation still has legacy routes/pages outside this slice; keep one active slice rule and audit-sync rule intact.
- Audit entry IDs vua cap nhat: 2026-05-03bp