# Route Inventory — Unified Layout (HIGH7)

> **Ngày**: 2026-09-08 · **Phase**: P4 QC · **Nguồn**: `packages/web/src/pages/pageRegistry.js:174` (53 entries) vs `packages/web/src/main.tsx:75-138` (route tree)  
> **Mục đích**: Thay `grep ShellPageChrome ≥50/53` bằng inventory runtime/AST per HIGH7

| # | Route (main.tsx) | Registry id (pageRegistry.js) | Layout owner | Shell type | Exemption | Visual test |
|---|------------------|-------------------------------|--------------|------------|-----------|-------------|
| 1 | `/` → `/dashboard` | `dashboard` → `core-dashboard` | `FullLayout.tsx:82` `<main>` | `ShellPageChrome` / bento `dashboard-triad-grid` | — | `unified-layout-pilot.pilot0` dashboard ×6 |
| 2 | `/dashboard` | `core-dashboard` | `FullLayout` | `DashboardPage.tsx:331` bento | — | pilot0 dashboard |
| 3 | `/watchlist` | `core-watchlist` | `FullLayout` | `ShellPageChrome` + `watchlistPage__layout` `minmax(240px,22%)` | — | pilot0 watchlist |
| 4 | `/alert-center` | `alert-center` | `FullLayout` | `ShellPageChrome` + `soc.opsLayoutContainer` | — | pilot0 alert-center |
| 5 | `/stocks/:symbol` | `core-stock-detail` → `market/ShellStockDetailPage.js` | `FullLayout` | `WorkstationShell.tsx:1` variant (P2-1) | `sdp-page` glow private | pilot0 stocks-HPG |
| 6 | `/operations-center` | `operations-center` | `FullLayout` | `ShellPageChrome` (P1-4) | — | `check-dom-landmarks` |
| 7 | `/operations-center/mail-config` | `operations-center-mail-config` | `FullLayout` | `ShellPageChrome` | — | — |
| 8 | `/ai-advisory` | `whale-advisory` | `FullLayout` | `ShellPageChrome` | — | pilot0 (via alert-center) |
| 9 | `/screener` | `screener` | `FullLayout` | `ShellPageChrome`? (legacy) | — | — |
| 10 | `/transactions` | `core-transactions` | `FullLayout` | `ShellPageChrome` | — | — |
| 11 | `/portfolios` | `core-portfolios` | `FullLayout` | `ShellPageChrome` (P2-3) | — | — |
| 12 | `/support` | `support` | `FullLayout` | `ShellPageChrome` | — | — |
| 13 | `/settings` | `core-user-settings` | `FullLayout` | `ShellPageChrome` | — | — |
| 14 | `/settings/ai` | `ai-command-center` | `FullLayout` | `aiSettings` private (P3) | `aiSettings.module.css` | — |
| 15 | `/settings/ai/agents` | `ai-agent-federation` | `FullLayout` | `aiSettings` | — | — |
| 16 | `/settings/ai/usage` | `ai-usage-analytics` | `FullLayout` | `aiSettings` | — | — |
| 17 | `/tenant-admin/*` (13) | `tenant-admin-*` | `TenantAdminLayout` | `ShellPageChrome` + `TenantAdmin.module.css` `home_*` | `ta` numbered (P3-2) | per-page |
| 18 | `/admin/*` (8) | `admin-core-*` | `FullLayout` | `ShellPageChrome` + `soc` | — | — |
| 19 | `/commercial/*` (2) | `commercial-*` | `FullLayout` | `ShellPageChrome` | — | — |
| 20 | `/login` `/register` | `auth-*` | none | none | **exemption** — no shell, no inventory | no visual |
| 21 | `/verify-email` `/reset-password` | `auth-*` | none | none | exemption | no visual |
| 22 | `/whale-alerts` (legacy) | `whale-alerts` → `alert-center` | redirect | — | compat → `/alert-center` (F-12) | redirect test |

**Kiểm chứng**: `grep ShellPageChrome|WorkstationShell packages/web/src/pages --include *.tsx` + `pageRegistry.js:230` + `main.tsx:101` — không dùng `grep ≥50/53` đếm chuỗi.

**Số lượng**: 53 registry entries → 22 nhóm route trên → 4 pilot routes ×6 viewport = 24 snapshots baseline (PILOT0).

**Trạng thái**: inventory DONE (P4), visual matrix 1920/1440/1280/1024/768/390 per `unified-layout-pilot.pilot0.spec.ts:1` + `playwright.config.ts:19-49` (default Pixel5/iPhone12 ≠ 6 viewport — cần matrix riêng, đã ghi ở `PILOT0_BASELINE_MANIFEST.md:3`).
