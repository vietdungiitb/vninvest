# DOM / Layout Contract — Thống Nhất Giao Diện VNInvest

> **Ngày**: 2026-09-08 · **Phase**: P0-0 (BLOCKER) · **Trạng thái**: ACTIVE (patch 2026-09-08c — HIGH1 auto a11y)  
> **Đối chiếu**: `docs/IMPLEMENTATION_PLAN_UI_UNIFIED_TEMPLATE_20260908.md:75` + `docs/THAO_LUAN_UI_THONG_NHAT_TEMPLATE_20260908.md:1` + Review 2026-09-08b BLOCKER1+2 + Audit P0-0 2026-09-08c HIGH1-6  
> **File neo**: `packages/web/src/layouts/full/FullLayout.tsx:70-88` + `packages/web/src/components/ShellPageTemplate.js:87-147` (`useId` auto) + `packages/web/src/pages/StockDetailPage.css:451-460` + `packages/web/src/pages/WatchlistPage.css:21-38`

---

## 1. Nguyên tắc

- **1 `<main>` / page**: landmark duy nhất do `FullLayout.tsx:82` sở hữu. `ShellPageChrome` không render `<main>`.
- **1 page-level scroll owner**: `FullLayout.tsx:82-88` `main.overflow-auto`. Panel/workstation được phép nested scroll **có selector + lý do + test riêng** (BLOCKER2).
- **Không double padding / max-width**: `FullLayout` sở hữu spacing ngoài + max-width; `Shell` sở hữu header/surface.
- **A11y**: 1 `h1`/page (từ `ShellPageChrome` title), landmark duy nhất, `role="region" aria-labelledby` **luôn truthy** — `ShellPageTemplate.js:87` dùng `useId()` auto sinh `resolvedId` nếu không truyền `id` (HIGH1 fix 2026-09-08c), `h1 id={titleId}` ↔ `region aria-labelledby={titleId}`.

## 2. DOM Tree Chuẩn

```
FullLayout (frame) — packages/web/src/layouts/full/FullLayout.tsx:46-88
 ├─ Sidebar — w: var(--layout-sidebar-width:18rem) — Header
 ├─ Header   — h: var(--layout-header-height:4.5rem)
 └─ <main role="main"> — 1 duy nhất, overflow-auto, p-[var(--layout-content-pad-y)], max-w-[var(--layout-content-max-width)]
     └─ Outlet → Page
         ├─ ShellPageChrome — <div class="shellPage" role="region" aria-labelledby="shell-title"> — KHÔNG <main>
         │   ├─ header.hero — <span class="eyebrow"> + <div class="titleRow"><h1 class="title">
         │   ├─ section.metrics
         │   └─ children — bodyGrid / opsLayout / triadGrid
         └─ WorkstationShell (planned, chỉ Stock Detail) — variant Shell
             ├─ giữ sdp-page-bg #050a14, glow blur 120px, sdp-ticker-badge:128
             └─ nested scroll: .sdp-chart-wrapper:451 height 640px + overflow hidden (chart), không double với FullLayout
```

## 3. Ownership

| Tầng | Sở hữu | File | Ghi chú |
|------|--------|------|---------|
| Frame + spacing ngoài + max-width + scroll page | `FullLayout.tsx:70-88` | `FullLayout.tsx:82-88` | `overflow-auto`, `p-[var(--layout-content-pad-y)]`, `max-w-[var(--layout-content-max-width,1800px)]` (P0-2) |
| Header / metrics / surface | `ShellPageTemplate.js:87-147` | `ShellPageTemplate.js:98-107` | `<div role="region" aria-labelledby>` auto `useId()`, `h1 id={titleId}` (HIGH1) |
| Workstation nested scroll | `StockDetailPage.css:451-460` | `StockDetailPage.css:453` | `.sdp-chart-wrapper height 640px`, có test riêng |
| Panel nested scroll | `WatchlistPage.css:21-38` | `WatchlistPage.css:21` | `.watchlistPage__layout height calc(100vh -120px) overflow hidden` + inner `overflow-y:auto` |

## 4. Cấm

- `<main>` trong `<main>` — vi phạm BLOCKER1 (hiện `FullLayout:82` + `ShellPageTemplate.js:98` cùng `<main>` → phải sửa P0-0).
- `p-6` / `max-w-7xl` / `w-72` hard Tailwind trong `FullLayout:46-85` — phải token hoá ở P0-2 (`w-[var(--layout-sidebar-width)]`).
- Overflow ngẫu nhiên ở page root — chỉ frame + workstation/panel whitelist được phép.

## 5. Gate (audit căn cứ)

| Gate | Lệnh | Pass | Trạng thái |
|------|------|------|------------|
| `test:dom-landmarks` | `vitest src/components/__tests__/dom-landmarks.component.test.tsx:1` (isolated) + static `scripts/check-dom-landmarks.mjs:1` | Isolated: `main` count 0 trong Shell, `region` truthy, `FullLayout` 1 `<main>`; Runtime 4 route planned Playwright P4 | **DONE isolated+static / CONDITIONAL runtime** (HIGH2) |
| `test:scroll-owners` | `vitest src/components/__tests__/scroll-owners.component.test.tsx:1` (documentation) + `check-tokens` | Whitelist `sdp-chart-wrapper:451` + `watchlistPage__layout:21`, frame `overflow-auto` | **DONE documentation / CONDITIONAL runtime** (HIGH3) |
| `test:a11y` | axe + `dom-landmarks` auto `useId` | `role="region"` + `aria-labelledby` luôn truthy (HIGH1), 1 h1 | **DONE isolated / CONDITIONAL route** |
| `tokens:check` | `node scripts/check-tokens.mjs:1` allowlist §5.2 | ngoài allowlist =0 (hiện 116 FAIL — expected tới P0-1) | **Planned** ở P0-1 (MEDIUM6) |

## 6. Lịch sử

- 2026-09-08: Tạo contract P0-0, tách frame vs panel/workstation, HIGH5 parity vs V1, HIGH6 arbitrary Tailwind.
- 2026-09-08c: HIGH1 fix `ShellPageTemplate.js:87 useId()` auto `aria-labelledby` (không yêu cầu call site truyền `id`), `ShellPageTemplate.d.ts:40 id?: string`, audit P0-0 CONDITIONAL verification — Pilot-0 được phép tiếp tục.
