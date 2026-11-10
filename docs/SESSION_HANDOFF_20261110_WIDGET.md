# Handoff — Widget registry integration (Phase 1+2+3a) + VPS deploy (2026-11-10)

**Slices:** `feat/widget-registry-integration` (PR #321 MERGED) + `feat/widget-docker-build-auth` (PR #322 MERGED). Nguồn: ledger Entry 438 + git log origin/dev.

## 1. Đã làm

- **PR #321**: package.json deps → GitHub Packages (`@vninvestcharts/widget@0.4.1`, `widget-pro@0.4.1`, `engine-*@0.5.5`); `.npmrc` (registry + `${GITHUB_TOKEN}`); import paths `vninvestcharts-widget` → `@vninvestcharts/widget` (VNStockChartPanel.js, WatchlistDetailPanel.tsx); xoá manual type decl (types resolve từ package). tsc 0, build OK 20.76s, vitest 5/5.
- **PR #322**: Dockerfile `COPY .npmrc` + `GITHUB_TOKEN` ARG/ENV; compose frontend build arg `GITHUB_TOKEN`. VPS: `compose.staging.env` append `GITHUB_TOKEN`; deploy-staging.sh --verify PASS.
- VPS now at `4ae734663` (latest dev). core-api healthy, workers 0 restart, redis 6.4.0 baked in image.

## 2. Còn nợ (phase sau)

- **P3b**: PaperTradePanel, SettingsModal, DrawingDock/Inspector/List, WidgetI18nProvider migration, injectVNInvestChartsCSS.
- **P3.4**: tier pro/enterprise enablement via `@vninvestcharts/widget-pro` (dynamic import khi tier ≥ pro).
- VPS chart render manual verify + E2E.
- Pre-existing lint errors (2) ở ShellMailConfigPage.tsx, VipLocalControlPage.tsx — không liên quan.

## 3. Trạng thái

- `dev @ 4ae734663`, tree sạch (trừ 2 untracked A4 file cố ý).
- Branches merged & có thể xoá: feat/widget-registry-integration, feat/widget-docker-build-auth.
- GITHUB_TOKEN đã lưu trong VPS compose.staging.env (không commit).

## 4. Next (phiên sau)

Owner quyết định scope P3b/P3.4 (theo PLAN_WIDGET_INTEGRATION_20261110.md mục 7) → implement opt-in, PR, deploy, verify.