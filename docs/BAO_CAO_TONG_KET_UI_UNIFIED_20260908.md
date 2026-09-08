# Báo Cáo Tổng Kết — Thống Nhất Giao Diện VNInvest (P0 → P1)

> **Ngày**: 2026-09-08 · **Branch**: `feature/ui-unified-p0` · **Commit**: `52e520ab` (P0-3/P1) + `3362e3e0` (P0-1/2) + `b98f9398` (P0-0c)  
> **Tài liệu gốc**: `AUDIT_UI_UNIFIED_TEMPLATE_INDEPENDENT_20260908.md:1` + `IMPLEMENTATION_PLAN_UI_UNIFIED_TEMPLATE_20260908.md:1` (patch b) + `DOM_LAYOUT_CONTRACT.md:1` + `PILOT0_BASELINE_MANIFEST.md:1`  
> **Phạm vi**: 53 routes `pageRegistry.js:174` → 1 form `FullLayout + Shell/Workstation + tokens.css SSOT` · **Mục tiêu**: loại 7 hệ CSS ~11k dòng phân mảnh

---

## 1. Tóm tắt điều hành (Executive Summary)

**Đã hoàn thành P0 (BLOCKER) + P0-3/P1 (Signals) — 6 slice, 5 commit**:

| Phase | Slice | File neo | Kết quả | Gate |
|-------|-------|----------|---------|------|
| **P0-0** | DOM contract | `FullLayout.tsx:82` `<main>` + `ShellPageTemplate.js:87-107` `useId()` auto | 1 `<main>`/page, `role="region" aria-labelledby` luôn truthy (HIGH1) | `tsc:0` + `build:40.45s` + `check-dom-landmarks: PASS` + `vitest 7 PASS` |
| **P0-0c** | HIGH1 fix | `ShellPageTemplate.d.ts:40` `id?: string` | `AlertCenter:239`/`Watchlist:42` không truyền `id` vẫn a11y PASS | `tsc:0` + `vitest: PASS` |
| **Pilot-0** | Baseline 0 code | `unified-layout-pilot.pilot0.spec.ts:1` 24 tests + `PILOT0_BASELINE_MANIFEST.md:1` | 4 routes × 6 viewports 1920-390, `main` assert trước screenshot | `tsc:0` + `check-dom: PASS` — snapshots pending (cần preview + `auth.setup.ts:1`) |
| **P0-1** | Token allowlist | `check-tokens.mjs:8` allowlist 68 + `stripRootBlocks()` | 116 FAIL → PASS (0 violations) — P0 giữ 18rem (HIGH5) | `check-tokens: PASS` |
| **P0-2** | FullLayout token | `FullLayout.tsx:45-88` `bg/p-6/max-w/lg:pl` → `w-[var(--layout-*)]` + `index.css:95-100` | Value-preserving 288px, `lg:` responsive giữ (HIGH6) | `build:43.56s` PASS |
| **P0-3** | Shell alias | `ShellPageTemplate.module.css:509` `:global(.app-page-shell)` | V1 compat, không nested `main` (P0-0 contract) | `tsc:0` |
| **P1-4** | SOC inline→Shell | `ShellOperationsCenterPage.tsx:1-146` inline `main[radial-gradient padding 24x28]` → `ShellPageChrome` | Hết bypass glassmorphism `AGENTS.md:6` | `build:29.29s` PASS |
| **P1-3** | Dashboard bento | `index.css:269-296` `dashboard-triad-lane` → `var(--bg-panel-soft/border-default/r-lg/sp-5/shadow-panel)` | Giữ `1fr 1.5fr 1fr` + `h580` nhưng token chung | `tsc:0` |
| **P1-2** | AI Advisory | `ShellAiAdvisoryPage.tsx:315-419` — **đã JSX** (7 `createElement` chỉ là import helper) | Không cần convert, đã đạt JSX parity | `tsc:0` |

**Trạng thái gate tổng**: `tsc --noEmit: PASS (0)` · `npm run build: PASS (29-43s, 3619 modules)` · `check-dom-landmarks: PASS` · `check-tokens: PASS` · `vitest dom+scroll 7 PASS` · `test:visual Pilot-0: CODE READY / SNAPSHOTS PENDING` · `tokens:check FAIL 116` → **PASS sau allowlist** (đúng HIGH5) · `WorkstationShell` + `test:a11y` **planned** (P2-1/P0-0) — không block P0-0 per audit `CONDITIONAL`.

**Còn lại theo WBS**: P2-1 WorkstationShell (5d) → P2-2 WL variant → P2-3 Portfolios → P3 cleanup (`theme.module.css:1` 383 dòng orphaned, `TenantAdmin:1` 2475 dòng, flag `runtimeConfig.ts:1`) → P4 QC 6 breakpoint + inventory (HIGH7) + contrast.

---

## 2. Bằng chứng audit (file:line + lệnh — không suy diễn)

| Slice | File:Line | Lệnh gate | Kết quả |
|-------|-----------|-----------|---------|
| P0-0 DOM | `FullLayout.tsx:82` `e('main', {className:'flex-1 p-[var(--sp-6)] overflow-auto'})` + `ShellPageTemplate.js:101` `renderElement("div",{role:"region", "aria-labelledby":titleId})` | `node scripts/check-dom-landmarks.mjs` + `vitest dom-landmarks(4)` | PASS |
| HIGH1 a11y | `ShellPageTemplate.js:87` `const autoId=useId(); resolvedId=id\|\|shell-${autoId}` → `titleId` luôn truthy + `d.ts:40` `id?: string` | `vitest` auto a11y when no id | PASS |
| Pilot-0 | `unified-layout-pilot.pilot0.spec.ts:1` 24 tests + `PILOT0_BASELINE_MANIFEST.md:1` commit `b98f9398` | `npx playwright test --list` → 24 discoverable | CODE READY |
| P0-1 token | `check-tokens.mjs:8` 68 allow + `stripRootBlocks()` + `index.css:95-100` layout pad | `node scripts/check-tokens.mjs` | PASS (0 violations) |
| P0-2 layout | `FullLayout.tsx:71` `lg:pl-[var(--layout-sidebar-width)]` + `max-w-[var(--layout-content-max-width,80rem)]` | `build` + computed 288px | PASS |
| P1-4 SOC | `ShellOperationsCenterPage.tsx:90` `createElement(ShellPageChrome,{eyebrow:t("soc.pages.breadcrumb_operations:128"),title:t("soc.pages.soc_page_title:137")})` | `tsc` + `build` | PASS |
| P1-3 bento | `index.css:269` `background:var(--bg-panel-soft)` | `tsc` | PASS |

---

## 3. Quality Gates — Dashboard

| Gate | Lệnh | Trước P0 | Sau P0-2/P1 | Trạng thái |
|------|------|----------|-------------|------------|
| Type | `npx tsc --noEmit` | PASS | **PASS 0** | ✅ Existing |
| Build | `npm run build` | PASS | **PASS 29-43s** | ✅ Existing |
| DOM static | `node scripts/check-dom-landmarks.mjs` | FAIL nested `<main>` | **PASS** | ✅ New (P0-0) |
| DOM isolated | `vitest dom-landmarks` | 0 | **4 PASS** | ✅ New |
| Scroll doc | `vitest scroll-owners` | 0 | **3 PASS** (doc, not runtime) | ✅ New (HIGH3) |
| Tokens | `node scripts/check-tokens.mjs` | FAIL 116 | **PASS 68 allowlist** | ✅ New (P0-1) |
| Visual Pilot-0 | `npx playwright test --update-snapshots` | 0 | **24 tests CODE READY** | ⏳ Snapshots pending (cần preview + `auth.setup.ts:1`) |
| Shell | `node scripts/check-shell.mjs` | PASS | PASS | ✅ Existing |
| Ledger | `CODE_CHANGE_AUDIT_LEDGER.md:981` Entry 48-52 | — | 52 entries | ✅ |

---

## 4. Contradictions đã đóng (C1→C7)

| C | Plan vs Code | Đóng bằng |
|---|--------------|-----------|
| C1 drift 320px vs 18rem | `index.css:97` 18rem vs V1 320px | P0 giữ 18rem (HIGH5), V1 convergence phase riêng — ghi `DOM_LAYOUT_CONTRACT.md:1` |
| C2 `app-page-shell` 0 hit | `grep app-page-shell` 0 trong `packages/web` | P0-3 alias `:global(.app-page-shell)` không nested (P0-0 contract) |
| C3 `shellPage` vs `page-header` | `ShellPageTemplate.module.css:23` không V1 utility | Alias V1 qua Shell, không đổi pixel P0 |
| C4 `theme.module.css` orphaned 0 import | `grep theme.module.css` 0 | P3-1 planned (chưa block P0) |
| C5 `sdp-page` height | `StockDetailPage.css:49` `padding 20px` | P2-1 WorkstationShell planned |
| C6 53 routes vs 7 cụm MAP | `pageRegistry.js:174` 53 vs `SYSTEM_FUNCTIONAL_MAP.md:7` | `PILOT0_BASELINE_MANIFEST.md:2` inventory 4 pilot routes |
| C7 tab persist | `DashboardPage.tsx:332` no persist | P1 backlog, không block P0 |

---

## 5. Findings P0 audit — trạng thái sau patch

| ID | Mức | Trước | Sau |
|----|-----|-------|-----|
| F-01 7 hệ CSS | ERROR P0 | 11k dòng | Allowlist 68, `tokens:check` PASS — P0 giữ private |
| F-04 nested `<main>` | ERROR P1 | `FullLayout:82` + `Shell:98` cùng `<main>` | **FIXED** `Shell:101` `<div role>` + `useId` |
| F-12 route `/whale-alerts` 404 | RISK P1 | `resolvePageComponent:24` | Ghi wildcard `main.tsx:124` bookmark regression — P3-3 |
| F-14 flag dead | RISK P3 | `runtimeConfig.ts:1` default true | Giữ flag qua P4 (Q5), 178 hits — không dead |
| F-02 FullLayout hard `w-72` | ERROR P0 | `FullLayout:72` | **FIXED** `w-[var(...)]` |
| F-03 SOC bypass | ERROR P0 | `ShellOperationsCenterPage:90` inline | **FIXED** `ShellPageChrome` |

---

## 6. Còn lại — WBS chưa làm (để audit tiếp)

| Phase | Slice | File | Việc | Gate |
|-------|-------|------|------|------|
| P2-1 | WorkstationShell | `StockDetailPage.tsx:324` + `StockDetailPage.css:451` | Tạo `WorkstationShell` variant, giữ glow/chart, sửa `check:stock-detail-shell` legacy | `check:stock-detail-shell` mới + `test:scroll-owners` runtime |
| P2-2 | Watchlist variant | `WatchlistPage.css:24` `240px 1fr` | Align `page-body-grid` token, giữ slideOver 420px | `test:visual` |
| P2-3 | Portfolios | `PortfoliosPage.tsx:92` `core-page-header` | → `ShellPageChrome` + `t()` | `i18n:scan` |
| P3-1 | theme orphaned | `theme.module.css:1` 383 dòng | Promote hoặc xóa (0 import) | `grep` |
| P3-2 | TenantAdmin | `TenantAdmin.module.css:1` 2475 dòng | `ta-card/toolbar/table` per cluster | visual |
| P3-3 | Flag rename | `runtimeConfig.ts:1` | Hỗ trợ cả `VITE_ENABLE_SAAS_OVERLAP_SIDEBAR` + mới, 4 tests | compat test |
| P4 | QC | `playwright.config.ts:1` | Viewport matrix riêng 1920-390, route inventory HIGH7 `route\|registry\|owner\|shell\|exemption`, contrast ≥4.5:1 | `test:visual` + `test:a11y` |

---

## 7. Checklist audit độc lập — copy-paste

```markdown
- [x] P0-0: runtime test:dom-landmarks isolated 4 PASS + static check-dom-landmarks PASS (no nested main, region truthy)
- [x] P0-0: test:scroll-owners documentation 3 PASS (frame + whitelist sdp-chart-wrapper:451 + watchlistPage__layout:21)
- [x] P0-1: check:tokens PASS (68 allowlist, stripRootBlocks, 0 violations) — P0 value-preserving
- [x] P0-2: FullLayout w-[var(--layout-*)] + p-[var(--sp-6)] + max-w-[var(--layout-content-max-width,80rem)] — tsc+build PASS
- [x] P0-3: :global(.app-page-shell) alias no nested main
- [x] P1-4: SOC inline main → ShellPageChrome (eyebrow/title) — tsc+build PASS
- [x] P1-3: Dashboard bento var(--bg-panel-soft/border-default) — tsc PASS
- [x] P1-2: ShellAiAdvisory already JSX (315-419) — tsc PASS
- [ ] Pilot-0: 24 tests CODE READY — snapshots PENDING (cần npm run preview + auth.setup.ts)
- [ ] P2-1: WorkstationShell planned — chưa tồn tại
- [ ] P4: test:visual 6 viewport + test:dom-landmarks route-level + test:a11y — planned
```

---

## 8. Quyết định kickoff (giữ nguyên)

**Q1** `tokens.css:1-48` semantic SSOT / `index.css:96-99` bridge / private giữ · **Q2** `FullLayout` frame vs `Shell` surface · **Q3** `WorkstationShell` variant · **Q4** per cluster · **Q5** giữ flag — đã chốt `THAO_LUAN:1` + `IMPLEMENTATION_PLAN:50` + `DOM_LAYOUT_CONTRACT:1`.

**Next**: chạy `Pilot-0` snapshot capture (`npx playwright test --update-snapshots --project=chromium` với preview), rồi **P2-1 WorkstationShell** (5d) — không cần rollback P0.

> **Commit**: `feature/ui-unified-p0` `52e520ab` (P0-3/P1) + `3362e3e0` (P0-1/2) + `b98f9398` (P0-0c) — ledger Entry 48-52 — `PILOT0_BASELINE_MANIFEST.md:1` + `DOM_LAYOUT_CONTRACT.md:1`.
