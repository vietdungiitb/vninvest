# DOM / Layout Contract — Thống Nhất Giao Diện VNInvest

> **Ngày**: 2026-09-08 · **Phase**: P0-0 (BLOCKER) · **Trạng thái**: ACTIVE  
> **Đối chiếu**: `docs/IMPLEMENTATION_PLAN_UI_UNIFIED_TEMPLATE_20260908.md:75` + `docs/THAO_LUAN_UI_THONG_NHAT_TEMPLATE_20260908.md:1` + Review 2026-09-08b BLOCKER1+2  
> **File neo**: `packages/web/src/layouts/full/FullLayout.tsx:70-88` + `packages/web/src/components/ShellPageTemplate.js:98-123` + `packages/web/src/pages/StockDetailPage.css:451-460` + `packages/web/src/pages/WatchlistPage.css:21-38`

---

## 1. Nguyên tắc

- **1 `<main>` / page**: landmark duy nhất do `FullLayout.tsx:82` sở hữu. `ShellPageChrome` không render `<main>`.
- **1 page-level scroll owner**: `FullLayout.tsx:82-88` `main.overflow-auto`. Panel/workstation được phép nested scroll **có selector + lý do + test riêng** (BLOCKER2).
- **Không double padding / max-width**: `FullLayout` sở hữu spacing ngoài + max-width; `Shell` sở hữu header/surface.
- **A11y**: 1 `h1`/page (từ `ShellPageChrome` title), landmark duy nhất, `aria-labelledby` nếu surface cần label (MEDIUM10).

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
| Header / metrics / surface | `ShellPageTemplate.js:98-123` | `ShellPageTemplate.js:98` | `<div>` không `<main>`, `role="region"` |
| Workstation nested scroll | `StockDetailPage.css:451-460` | `StockDetailPage.css:453` | `.sdp-chart-wrapper height 640px`, có test riêng |
| Panel nested scroll | `WatchlistPage.css:21-38` | `WatchlistPage.css:21` | `.watchlistPage__layout height calc(100vh -120px) overflow hidden` + inner `overflow-y:auto` |

## 4. Cấm

- `<main>` trong `<main>` — vi phạm BLOCKER1 (hiện `FullLayout:82` + `ShellPageTemplate.js:98` cùng `<main>` → phải sửa P0-0).
- `p-6` / `max-w-7xl` / `w-72` hard Tailwind trong `FullLayout:46-85` — phải token hoá ở P0-2 (`w-[var(--layout-sidebar-width)]`).
- Overflow ngẫu nhiên ở page root — chỉ frame + workstation/panel whitelist được phép.

## 5. Gate (audit căn cứ)

| Gate | Lệnh | Pass | Trạng thái |
|------|------|------|------------|
| `test:dom-landmarks` | Playwright/Vitest runtime trên 4 route `/alert-center:132` `/watchlist:83` `/dashboard:82` `/stocks/HPG:101` | `querySelectorAll('main').length===1`, `querySelector('main main')===null`, 1 h1 | **Planned** — tạo ở P0-0 |
| `test:scroll-owners` | Playwright scroll test | Frame 1 owner + nested panel/workstation có selector+test, không overflow ngẫu nhiên | **Planned** |
| `test:a11y` | axe | ≥4.5:1, landmark duy nhất, heading hierarchy | **Planned** |
| `tokens:check` | allowlist §5.2 IMPLEMENTATION_PLAN | ngoài allowlist =0 | **Planned** ở P0-1 |

## 6. Lịch sử

- 2026-09-08: Tạo contract P0-0, tách frame vs panel/workstation, HIGH5 parity vs V1, HIGH6 arbitrary Tailwind.
