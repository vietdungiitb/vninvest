# Implementation Plan — Thống Nhất Giao Diện VNInvest theo Template Chung V1

> **Ngày**: 2026-09-08 (patch 2026-09-08b) · **Trạng thái**: READY AFTER PLAN PATCH → READY FOR KICKOFF sau khi áp 11 chỉnh dưới đây (đã chốt Q1→Q5)  
> **Tài liệu gốc**: `docs/AUDIT_UI_UNIFIED_TEMPLATE_INDEPENDENT_20260908.md:1` + `docs/THAO_LUAN_UI_THONG_NHAT_TEMPLATE_20260908.md:1` + Review 2026-09-08 (4 điểm) + Review độc lập P0-0 (11 findings BLOCKER/HIGH/MEDIUM)  
> **Đối chiếu**: `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:1` + `docs/SYSTEM_FUNCTIONAL_MAP.md:1` + `docs/UI_LAYOUT_AUDIT_REPORT_20260501.md:1` + `AGENTS.md:65-159` + `packages/web/package.json:6-24` scripts thực tế  
> **Branch**: `feature/ui-unified-p0` (tạo mới, base `dev`) · **Governance**: mỗi slice cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md:8-9` gate

---

## 0. Cách dùng file này cho audit độc lập

Mọi khẳng định trong plan này có **neo `file:line`**. Auditor độc lập chỉ cần:

1. Đọc §3 (Contract đã chốt) → §4 (WBS từng slice) → §5 (Quality Gates) → §6 (Traceability).
2. Chạy các lệnh gate ở §5 (tsc, build, lint, `i18n:scan`, `check:shell`, `check:stock-detail-shell`, `test:visual`).
3. Đối chiếu **Bằng chứng audit** cột §4 với file thực — thiếu file/line = KHÔNG ĐẠT.
4. Không suy diễn — file KHÔNG TỒN TẠI phải ghi rõ (theo `AGENTS.md:71` Nguyên tắc 3).

---

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu

Đưa **53 routes** `packages/web/src/pages/pageRegistry.js:174` về **1 form** `FullLayout frame + Shell/Workstation surface + tokens.css semantic SSOT` theo `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:32-336`, loại bỏ **7 hệ CSS ~11k dòng** phân mảnh (`soc 2386`, `sdp 2486`, `ta 2039`, `aiSettings 871`, `Shell 509`, `theme 383` orphaned, `wl 735`, `port 341`).

**Không đổi pixel** ở P0 (value-preserving + allowlist), đổi visual có kiểm soát từ P1 (có screenshot + computed-style diff).

### 1.2 Phạm vi

- **Trong**: `packages/web/src/{layouts,components,theme,pages,hooks,context}` + `frontend/src/index.css:182` (tham chiếu legacy `app-page-shell`).
- **Ngoài**: `packages/core` (chỉ coupling qua `defaultCoreApiAdapter`), `packages/mobile/opencore/vip-app` (không chạm).
- **Không chạm logic**: chỉ layout/token/shell — không đổi API, state, business.

### 1.3 Định nghĩa DONE cho toàn plan

| # | Tiêu chí | Kiểm chứng | Nguồn |
|---|----------|------------|-------|
| D1 | 1 semantic SSOT token, không drift `#12c7e8` vs `#06b6d4` | `grep -rn "#[0-9a-f]"` Allowlist §5.2 (§5.4) — planned `tokens:check` khi tạo xong | F-01, C1 |
| D2 | 1 DOM contract, không nested `<main>`, không double padding | **Runtime** `document.querySelectorAll('main').length===1` + `querySelector('main main')===null` trên 4 route pilot (`/alert-center:132`, `/watchlist:83`, `/dashboard:82`, `/stocks/HPG:101`) — không dùng `grep "<main"` tĩnh | F-04, C3, BLOCKER1 |
| D3 | **Frame 1 page-level scroll** + **panel/workstation nested scroll có chủ đích** (có selector + lý do + test) | `grep panel-scrollbar` + Playwright scroll test: frame `FullLayout:82 overflow-auto`, workstation `StockDetailPage.css:451` + `WatchlistPage.css:21` được phép nested | F-15, BLOCKER2 |
| D4 | Route inventory 100% coverage: `route\|registry\|layout owner\|shell type\|exemption\|visual test` | Không dùng `grep ≥50/53`; verify bằng **route inventory** (§5.5) + runtime/AST (không đếm chuỗi) | F-04, F-07, HIGH7 |
| D5 | 0 dead module.css, `theme.module.css` có consumer hoặc xóa | `grep theme.module.css packages/web/src` ≥ 1 hoặc file xóa | F-01, C4 |
| D6 | `tsc --noEmit` PASS + `npm run build` PASS mỗi phase | CI log | AGENTS.md:8 |
| D7 | Visual parity 6 breakpoint 1920/1440/1280/1024/768/390 + contrast ≥4.5:1 | `test:visual` Playwright + axe | V1:200 |
| D8 | Ledger cập nhật mỗi slice | `CODE_CHANGE_AUDIT_LEDGER.md` entry | AGENTS.md:160 |

---

## 2. Quyết định kiến trúc đã chốt (Q1→Q5)

| # | Quyết định | Chi tiết | File neo | Tác động nếu chốt sai |
|---|------------|----------|----------|-----------------------|
| **Q1** | `tokens.css:1-48` semantic SSOT, `index.css:96-99` Tailwind/layout bridge | `tokens.css` sở hữu `--accent/bg/border/text/sp/r/shadow/font/mono`, `index.css` chỉ `@theme` + `--layout-*`. Token private (`--sh-shell: #00b4d8` `tokens.css:49`, `--soc` chart, `--sdp` glow) giữ lại. Drift chuẩn hoá bằng allowlist (§5.4), không alias cưỡng bức. | `tokens.css:1-56`, `index.css:96-100`, `ShellPageTemplate.module.css:45`, `soc.module.css:4` | Alias sai → drift giữ nguyên, P1/P2 làm lại |
| **Q2** | `FullLayout` sở hữu frame, `ShellPageChrome` sở hữu surface | `FullLayout.tsx:70-88` frame + spacing ngoài + max-width; `ShellPageTemplate.js:98-123` header/metrics/surface; **không nested `<main>`**, 1 contract DOM ghi ở P0-0. | `FullLayout.tsx:70-88`, `ShellPageTemplate.js:98-123` | Double padding/max-width |
| **Q3** | Giữ workstation riêng — `WorkstationShell` variant | Không bọc trực tiếp `sdp-page:49` (glow 120px, `sdp-ticker-badge:128`, chart 640px) bằng Shell; tạo `WorkstationShell` dùng chung layout token nhưng giữ scroll/behavior riêng. | `StockDetailPage.tsx:324`, `StockDetailPage.css:49-55,453-461` | Mất glow/chart hoặc nested scroll |
| **Q4** | TenantAdmin migrate theo cluster | Tạo primitives `ta-card/ta-toolbar/ta-table` trước, migrate từng page, chưa đổi hàng loạt `home_*/pats_*` | `TenantAdmin.module.css:1-2475` | Đổi hàng loạt → regression 13 pages |
| **Q5** | Giữ flag `runtimeConfig.ts:1` | `isNewLayoutEnabled()` default `true` nhưng vẫn sống ở `FullLayout:11-35`, `Sidebar:28-42`, `Header:33-36` (178 hits). Đổi tên rõ nghĩa, xóa sau 1 release ổn định. | `runtimeConfig.ts:1-9` | Xóa sớm mất rollback |

---

## 3. Contract chi tiết (để audit căn cứ)

### 3.1 Token contract — ownership rõ (MEDIUM 9)

| Tầng | File | Sở hữu | Quy tắc | Ví dụ |
|------|------|--------|---------|-------|
| Semantic SSOT | `tokens.css:1-48` | `--accent-cyan/emerald/rose/amber`, `--bg-panel/soft`, `--border-default`, `--text-primary/secondary/muted`, `--sp-1..6`, `--r-sm/md/lg/pill`, `--shadow-card/pop`, `--font-sans/mono` | Dùng cho mọi layout chung; không định nghĩa lại trong module page | `--accent-cyan: var(--color-accent-primary, #06b6d4)` |
| Shell private | `tokens.css:49-55` | `--accent-shell/--bg-shell-surface/--border-shell/--shadow-shell` (giữ, không alias) | Chỉ dùng cho `ShellPageChrome` surface, không dùng cho page private | `--accent-shell: #00b4d8` |
| Layout bridge | `index.css:96-99` | `--layout-sidebar-width/header-height/collapsed-width`, `@theme --color-*` | Chỉ layout/tailwind integration; P0 giữ 18rem (288px) khác V1 320px — **V1 convergence phase riêng** (HIGH5) | `--layout-sidebar-width: 18rem` |
| Page/Chart private | `soc.module.css:4`, `StockDetailPage.css:2`, `WatchlistPage.css:1`, `aiSettings:30` | Chart palette, glow RGB, `wl/sdp/ta` private — giữ, chỉ chuẩn hoá màu chung qua semantic | `--sdp-page-bg: #050a14` |
| Quy tắc | — | Token private **không được dùng** cho layout chung; semantic token **không được định nghĩa lại** trong module page | `stylelint` allowlist §5.2 kiểm chứng | — |

**Allowlist màu được phép hard-code** (ngoài semantic): `status` (success/warning/danger), `chart palette` (heat-up/down), `private visual effect` (glow). Ngoài allowlist = FAIL — gate này là **planned** cho tới khi tạo `tokens:check` ở P0-1.

### 3.2 DOM/Layout contract (P0-0) — đã chỉnh BLOCKER 1+2

```
FullLayout (frame) — sở hữu page-level scroll + max-width + padding ngoài
 ├─ Sidebar (w: var(--layout-sidebar-width))
 ├─ Header (h: var(--layout-header-height))
 └─ <main> (1 duy nhất — landmark duy nhất của page)
     └─ Outlet → Page
         ├─ ShellPageChrome (không render <main>, chỉ <div class="shellPage" role="region" aria-labelledby>)
         │   ├─ header.hero (h1 hierarchy duy nhất)
         │   ├─ section.metrics
         │   └─ children (bodyGrid / opsLayout / triadGrid)
         └─ WorkstationShell (chỉ Stock Detail) — variant Shell, giữ sdp-* nội bộ, cho phép nested scroll có chủ đích
```

**Cấm**: `<main>` trong `<main>` (`FullLayout:82` + `ShellPageChrome:98` cùng `<main>` hiện tại → vi phạm, phải sửa P0-0).

**Scroll contract (BLOCKER 2)**: Frame 1 page-level scroll owner (`FullLayout:82-88 overflow-auto`). Workstation (`StockDetailPage.css:451-460 height:640px`) và panel (`WatchlistPage.css:21-38 calc(100vh -120px) + overflow`) được phép nested scroll **có selector + lý do + test riêng**. Cấm overflow ngẫu nhiên ở page root.

**A11y khi đổi `<main>`→`<div>` (MEDIUM 10)**: giữ heading hierarchy (1 h1/page), landmark duy nhất từ FullLayout, thêm `aria-labelledby` nếu surface cần label, gate `test:a11y` (axe ≥4.5:1, planned cho tới khi tạo ở P0-0).

---

## 4. WBS Chi tiết — từng slice có đủ 8 cột nghiệm thu

### P0 — Baseline Shell (2-3 tuần, BLOCKER — không song song với P1/P2 cho tới khi P0-0 xong)

#### P0-0 — DOM/Layout Contract (2 ngày) — **làm trước mọi token** — BLOCKER 1+2+3

| Mục | Nội dung |
|-----|----------|
| **Mô tả** | Xác định 1 page = mấy shell, ai sở hữu scroll/padding/max-width, không nested `<main>`; định nghĩa scroll contract frame vs panel/workstation |
| **File chạm** | `FullLayout.tsx:46-88`, `ShellPageTemplate.js:98-123`, `AppShell.tsx:1-11`, `StockDetailPage.css:451-460`, `WatchlistPage.css:21-38`, `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:272` |
| **Bước** | B1 Đọc 3 file neo + V1 utility. B2 Vẽ DOM hiện tại (FullLayout `<main.p-6>` + Shell `<main.shellPage>` → nested). B3 Quyết định: FullLayout giữ `<main>` duy nhất, Shell đổi `<main>` → `<div role="region" aria-labelledby>` + giữ h1 hierarchy (MEDIUM 10). B4 Ghi scroll contract: frame 1 owner, workstation `StockDetailPage.css:451` + panel `WatchlistPage.css:21` được nested có lý do. B5 Ghi vào `docs/DOM_LAYOUT_CONTRACT.md` mới + tạo **runtime gate** `test:dom-landmarks` + `test:scroll-owners` (planned). |
| **Kết quả** | `docs/DOM_LAYOUT_CONTRACT.md` + patch `ShellPageTemplate.js:98` `<main>` → `<div>` + 2 gate mới (planned) + a11y assertion |
| **Nghiệm thu** | **Runtime** trên 4 route (`/alert-center`, `/watchlist`, `/dashboard`, `/stocks/HPG`): `querySelectorAll('main').length===1`, `querySelector('main main')===null`, không dùng `grep "<main"` tĩnh (BLOCKER 1). Scroll: frame `FullLayout:82 overflow-auto` là owner, nested `StockDetailPage.css:451` + `WatchlistPage.css:21` có selector+test riêng, không overflow ngẫu nhiên ở page root (BLOCKER 2). A11y: 1 h1/page, landmark duy nhất. |
| **Bằng chứng audit** | Playwright/Vitest runtime DOM test report (BLOCKER 1) + scroll test report (BLOCKER 2) + DOM inspector 1920/768 |
| **Gate** | `tsc --noEmit` PASS, `npm run build` PASS, **planned** `test:dom-landmarks` + `test:scroll-owners` + `test:a11y` (tạo trong P0-0, chưa PASS trước khi tạo — BLOCKER 3) |
| **Owner** | FE shell owner |
| **Phụ thuộc** | Không — làm đầu tiên; tạo gate trước khi dùng làm acceptance |

#### P0-1 — Token SSOT Allowlist (3 ngày) — HIGH 5 (tách parity/convergence)

| Mục | Nội dung |
|-----|----------|
| **Mô tả** | Chuẩn hoá token: `tokens.css` semantic SSOT, `index.css` bridge, private giữ lại, drift chuẩn hoá bằng allowlist; **tách P0 value-preserving (giữ 18rem/288px, màu hiện tại) khỏi V1 convergence (320px, màu V1) thành phase riêng** |
| **File chạm** | `tokens.css:1-56`, `index.css:6-100` (`--layout-sidebar-width:18rem`), `ShellPageTemplate.module.css:2-21`, `soc.module.css:4-40`, `aiSettings.module.css:30-40`, `StockDetailPage.css:2-40`, `WatchlistPage.css:1-10`, `TenantAdmin.module.css:4-41` |
| **Bước** | B1 `grep "#[0-9a-f]"` toàn `packages/web/src` lấy baseline hard hex. B2 Phân loại allowlist (semantic/status/chart/private §5.2) vs drift (`#12c7e8` vs `#06b6d4` vs `#00b4d8`). B3 Alias drift về semantic **trong P0**, giữ private + giữ 18rem (không đổi 320px ở P0) — **V1 320px** để phase P0-V1 riêng. B4 Tạo **planned** `tokens:check` (§5.2) rồi chạy; P0 acceptance = computed-style diff allowlist, không gọi "theo V1" và "pixel parity" cùng lúc. |
| **Kết quả** | Token drift giảm, private giữ, 18rem giữ ở P0, `tokens:check` planned được tạo |
| **Nghiệm thu** | `grep hard hex` ngoài allowlist =0 (allowlist §5.2); P0 `computed width 288px` không đổi, màu drift chuẩn hoá nhưng private giữ → diff <1%; V1 320px chưa áp ở P0 |
| **Bằng chứng audit** | `tokens.css:1` diff + `grep` count + computed-style diff allowlist trước/sau |
| **Gate** | `tsc` PASS, **planned** `tokens:check` (tạo trong P0-1, không PASS trước khi tạo — BLOCKER 3) |
| **Phụ thuộc** | P0-0 xong; tạo `tokens:check` trước khi dùng làm acceptance |

#### P0-2 — FullLayout Token Hoá (2 ngày) — **làm sau Pilot-1** — HIGH 6

| Mục | Nội dung |
|-----|----------|
| **Mô tả** | Thay hard Tailwind bằng token, không đổi pixel; cần quyết implement cụ thể cho Tailwind |
| **File chạm** | `FullLayout.tsx:46,72,85` (`w-72`, `lg:pl-72`, `p-6`, `max-w-7xl`, `bg-slate-950`) |
| **Bước** | Chọn 1: `w-[var(--layout-sidebar-width)]` (arbitrary Tailwind) / CSS module class / `style` prop. Thay `w-72 → w-[var(--layout-sidebar-width)]`, `lg:pl-72 → lg:pl-[var(--layout-sidebar-width)]` (giữ responsive), `p-6 → p-[var(--layout-content-pad-y)]` hoặc `style={{padding: 'var(--sp-*)'}}`, `max-w-7xl → max-w-[var(--layout-content-max-width,1800px)]`. |
| **Kết quả** | `FullLayout.tsx` token-driven, giữ `lg:` responsive, pixel giữ nguyên (288px) |
| **Nghiệm thu** | Computed `width` Sidebar 288px không đổi, `padding` main token, 6 breakpoint không vỡ, `lg:pl` responsive còn hoạt động |
| **Bằng chứng audit** | `FullLayout.tsx:72` diff + computed-style 1920/768 + `check:shell` (existing) |
| **Gate** | `tsc` PASS, `test:visual` full-shell PASS |
| **Phụ thuộc** | Pilot-1 PASS mới làm (HIGH 4) |

#### P0-3 — Shell Alias (1 ngày)

| Mục | Nội dung |
|-----|----------|
| **Mô tả** | `.app-page-shell` alias chỉ nếu cần, không tạo thêm wrapper |
| **File chạm** | `ShellPageTemplate.module.css:23` (`.shellPage`), `ShellPageTemplate.js:98` |
| **Bước** | Nếu đã có P0-0 contract, chỉ thêm alias CSS không thêm DOM. Nếu chưa, thêm `div.app-page-shell` bọc `shellPage` với `max-width/padding` từ V1:272. |
| **Kết quả** | Mọi page qua Shell tự có spacing V1 hoặc giữ shell hiện tại không double |
| **Nghiệm thu** | No double padding khi inspect `main > div.shellPage`; `padding-top` = 1 nguồn |
| **Bằng chứng audit** | `ShellPageTemplate.module.css:23` diff + DOM inspector |
| **Gate** | `tsc` PASS |

#### Pilot-0 — Baseline Capture (2 ngày) + Pilot-1 — Post-Change Diff (2 ngày) — HIGH 4 (tách baseline/post)

| Mục | Nội dung |
|-----|----------|
| **Mô tả** | Dùng 2 page đã có `ShellPageChrome` làm pilot, tách baseline và post-change rõ ràng |
| **File chạm** | `AlertCenterPage.tsx:238-249` (`ShellPageChrome` + `soc.opsLayoutContainer` + `FixedSizeList 460/280`), `WatchlistPage.tsx:42-56` (`ShellPageChrome` + `watchlistPage__layout 240px 1fr`) |
| **Bước** | **Pilot-0 (baseline, 0 code)**: B1 Chụp 6 breakpoint 1920/1440/1280/1024/768/390, record `test:visual` baseline, ghi `playwright.config.ts:1-75` viewport matrix (thêm matrix riêng cho unified-layout — HIGH 8). **Pilot-1 (post P0-1)**: B2 Áp P0-1 token lên 2 page. B3 Computed-style diff + `test:visual` diff. B4 Record diff report. |
| **Kết quả** | Pilot-0 baseline screenshot (không đổi code) + Pilot-1 diff report, pilot PASS |
| **Nghiệm thu** | Pilot-0 6 viewport baseline PASS (không code change); Pilot-1 6 viewport diff < threshold allowlist, `FixedSizeList` không tràn; cần server/seed/account/isolation + naming + baseline ownership ghi rõ (HIGH 8) |
| **Bằng chứng audit** | Playwright `test:visual` Pilot-0 report + Pilot-1 diff report + screenshot |
| **Gate** | Pilot-0: `check:shell` (existing) PASS; Pilot-1: `i18n:scan` PASS, viewport matrix PASS |
| **Phụ thuộc** | Pilot-0 không phụ thuộc code (làm ngay sau P0-0); Pilot-1 phụ thuộc P0-1 xong |

---

### P1 — Signals Cluster (2-3 tuần)

#### P1-1 — Alert Center (đã 95%, 2 ngày)

| Mục | Nội dung |
|-----|----------|
| **File** | `AlertCenterPage.tsx:1-356`, `AlertCard.js:52,58`, `AlertCenterPage.module.css:107` |
| **Việc** | Chuẩn hoá `acPendingBadge #ffd166` → allowlist accent status (giữ), verify `soc.statusBadge:199` import `soc:9` đã đúng (fix F1 Entry 30), `ShellSkeleton:302` + `PageErrorBoundary:296` đã đủ |
| **Nghiệm thu** | `soc.statusBadge` tồn tại (`soc.module.css:199`), `AlertCard.js:5` import `soc`, không `ReferenceError` |
| **Gate** | `tsc` PASS, `test:visual` alert-center PASS |

#### P1-2 — AI Advisory JSX (3 ngày)

| Mục | Nội dung |
|-----|----------|
| **File** | `ShellAiAdvisoryPage.tsx:315-418` (`createElement` metrics/flag) |
| **Việc** | `createElement` → JSX, `renderFlagList` badge → `soc.*`/`Shell` badge |
| **Nghiệm thu** | JSX parity, `tsc` PASS, 0 `createElement` trong file |
| **Gate** | `tsc` PASS |

#### P1-3 — Dashboard Bento (5 ngày)

| Mục | Nội dung |
|-----|----------|
| **File** | `DashboardPage.tsx:345-403`, `index.css:265-310` (`.dashboard-triad-grid 1fr 1.5fr 1fr`, `h580`) |
| **Việc** | Giữ ratio `1fr 1.5fr 1fr` làm variant `page-body-grid--dashboard`, nền/border `bg-slate-900/40` → `soc.glassPanel`/`ShellPanel` token |
| **Nghiệm thu** | Bento vẫn `1fr 1.5fr 1fr` nhưng token chung, `h580` audit không đẩy module quan trọng dưới viewport (check first viewport 1080p) |
| **Gate** | `test:visual` dashboard PASS |

#### P1-4 — SOC Overview (3 ngày)

| Mục | Nội dung |
|-----|----------|
| **File** | `ShellOperationsCenterPage.tsx:90-99` inline `background radial-gradient + padding 24px 28px` |
| **Việc** | Inline → `ShellPageChrome` (như AlertCenter Entry 24), i18n `soc.pages.breadcrumb_operations:128` + `soc.pages.soc_page_title:137` giữ |
| **Nghiệm thu** | Không còn inline `style` background, qua `shellPage` token |
| **Gate** | `tsc` PASS |

---

### P2 — Portfolio Cluster (3-4 tuần)

#### P2-1 — Stock Detail WorkstationShell (5 ngày) — BLOCKER 2+3

| Mục | Nội dung |
|-----|----------|
| **File** | `StockDetailPage.tsx:324-325` (`div.sdp-page`), `StockDetailPage.css:49-55,453-461` (`.sdp-chart-wrapper`, glow), `VNStockChartPanel.js:128-137` price map, `Header/Whale`; `WorkstationShell` **chưa tồn tại** (planned) |
| **Việc** | Tạo `WorkstationShell` (variant Shell, mới) dùng chung `--layout-*/--sp-*/--font-sans:15`, giữ `sdp-page-bg #050a14`, glow `blur 120px`, `sdp-ticker-badge:128`, chart `640px/560px`, scroll riêng có selector+test (BLOCKER 2). Cập nhật `check:stock-detail-shell` hiện chỉ check `ShellStockDetailPage.js` legacy → sửa để check `WorkstationShell` + DOM contract (BLOCKER 3). |
| **Nghiệm thu** | No nested `<main>` (runtime), glow/chart giữ, font `Inter` → `var(--font-sans)`, 6 breakpoint không vỡ, scroll nested có test riêng |
| **Gate** | `tsc` PASS, **planned** `check:stock-detail-shell` mới PASS (tạo trong P2-1, không PASS trước khi tạo) + `test:scroll-owners` |

#### P2-2 — Watchlist Variant (3 ngày)

| Mục | Nội dung |
|-----|----------|
| **File** | `WatchlistPage.css:24-32` `240px 1fr`, slideOver `420px:62`, `WatchlistPage.tsx:52` |
| **Việc** | Align `240px 1fr` với `page-body-grid` token, giữ `240px` làm fallback, slideOver 420px giữ nguyên |
| **Nghiệm thu** | Grid token-driven, slideOver không tràn 375px |
| **Gate** | `test:visual` watchlist PASS |

#### P2-3 — Portfolios/Transactions (3 ngày)

| Mục | Nội dung |
|-----|----------|
| **File** | `PortfoliosPage.tsx:92` `core-page-header h1 2rem`, `PortfoliosPage.css:29`, `TransactionsPage:108` |
| **Việc** | `core-page-header` → `ShellPageChrome eyebrow/title/metrics`, hard `"Danh mục đầu tư"`/`"Giao dịch"` → `t("portfolio.*")` |
| **Nghiệm thu** | Có `ShellPageChrome` eyebrow + `t()` i18n, không hard VN |
| **Gate** | `i18n:scan` PASS |

---

### P3 — Cleanup (2 tuần)

| Slice | File | Việc | Nghiệm thu |
|-------|------|------|------------|
| P3-1 | `theme.module.css:1-383` | Promote làm primitive **hoặc** xóa — quyết sau Q1 allowlist; nếu promote, `ShellPanel/ShellField` import `theme`; ghi ownership bảng §3.1 | `grep theme.module.css` ≥1 hoặc file xóa, không orphaned |
| P3-2 | `TenantAdmin.module.css:1-2475` | Tạo `ta-card/ta-toolbar/ta-table` primitives, migrate từng page (`Home 313`, `Members 19`, `Billing 24`...), chưa đổi hàng loạt | Mỗi cluster có primitives, `ta.home_*` giảm dần |
| P3-3 | `runtimeConfig.ts:1-9` | Giữ flag qua P4, hỗ trợ **cả cũ `VITE_ENABLE_SAAS_OVERLAP_SIDEBAR` + mới `VITE_LAYOUT_VARIANT`** 1 release, precedence cũ→mới, migration note, test `true/false/missing/invalid` (MEDIUM11) | Flag rõ nghĩa, compat, 4 test PASS |
| P3-4 | `index.css:372`, `ShellSkeleton.tsx:1`, `ShellEmptyState.tsx:1` (`ShellEmptyState:1` tồn tại, `WorkstationShell` planned), `WatchlistPage.css:260`, `StockDetailPage.css:2460` | Thống nhất `panel-scrollbar` + `ShellSkeleton` + `ShellEmptyState`, xóa duplicate scrollbar 6px; `WorkstationShell` đã tạo ở P2-1, không tồn tại trước đó | 1 skeleton, 1 empty, 1 scrollbar utility; WorkstationShell tồn tại từ P2-1 |

---

### P4 — QC Gate (1 tuần) — đã chỉnh BLOCKER 3 + HIGH 8 + MEDIUM 10

| Gate | Lệnh | Pass criteria | Nguồn | Trạng thái |
|------|------|---------------|-------|------------|
| Lint | `npm run lint` | 0 error (warnings pre-existing) | AGENTS.md:7.1 | Existing |
| Type | `npx tsc --noEmit` | EXIT 0 | AGENTS.md:8 | Existing |
| Build | `npm run build` | `tsc && vite` PASS, chỉ chunk warning | AGENTS.md:8 | Existing |
| i18n | `npm run i18n:scan` | 0 hard VN ngoài allowlist | AGENTS.md:5 | **Planned** (ghi rõ nếu chưa có script, không đánh PASS trước khi tạo) |
| Shell | `npm run check:shell` | PASS — kiểm tra route/registry + shell exports (không kiểm DOM — BLOCKER 3) | package.json:6-24 | Existing |
| Stock shell | `npm run check:stock-detail-shell` | **Sửa**: check `WorkstationShell` + DOM contract, không chỉ `ShellStockDetailPage.js` legacy | package.json:6-24 | **Planned sửa** |
| DOM | `npm run test:dom-landmarks` (mới) | `main` count 1, `main main` null trên 4 route pilot (runtime) — không grep tĩnh | P0-0 BLOCKER1 | **Planned, tạo ở P0-0** |
| Scroll | `npm run test:scroll-owners` (mới) | Frame 1 owner + panel/workstation nested có test riêng | P0-0 BLOCKER2 | **Planned, tạo ở P0-0** |
| Tokens | `npm run tokens:check` (mới) | Allowlist §5.2 PASS | §5.2 | **Planned, tạo ở P0-1** |
| Visual | `npm run test:visual` | **Viewport matrix riêng** 1920/1440/1280/1024/768/390 (không dùng default Desktop/Pixel5), ghi server/seed/account/naming/isolation, baseline ownership, diff threshold theo viewport (không `maxDiffPixels:100` cố định) | V1:228, HIGH8 | Existing nhưng cần matrix riêng |
| Contrast/a11y | `npm run test:a11y` (axe) | ≥4.5:1 body text, heading hierarchy, landmark duy nhất | V1:200, MEDIUM10 | **Planned, tạo ở P0-0** |
| Ledger | `docs/CODE_CHANGE_AUDIT_LEDGER.md` | entry mỗi slice | AGENTS.md:160 | Existing |

---

## 5. Quality Gates Chi Tiết (để audit căn cứ)

### 5.1 Lệnh chạy (tại `packages/web`) — phân existing vs planned

```bash
# Existing (chạy được ngay)
npx tsc --noEmit
npm run lint
npm run build
npm run check:shell              # existing — chỉ route/registry, không DOM
npm run test                     # jest 17/17
npm run test:components          # vitest 10/10
npm run test:visual              # Playwright — cần viewport matrix riêng (HIGH8)

# Planned (tạo trong P0-0/P0-1 trước khi dùng làm acceptance — BLOCKER 3)
npm run tokens:check             # planned — tạo ở P0-1 (§5.2)
npm run check:stock-detail-shell # planned sửa — check WorkstationShell mới, không legacy (P2-1)
npm run test:dom-landmarks       # planned — tạo ở P0-0 (BLOCKER1)
npm run test:scroll-owners       # planned — tạo ở P0-0 (BLOCKER2)
npm run test:a11y                # planned — tạo ở P0-0 (MEDIUM10)
npm run i18n:scan                # planned nếu chưa có script — ghi rõ, không PASS trước khi tạo
```

### 5.2 Token drift — allowlist (thay `hex <10` cứng)

| Allowlist | Ví dụ | Kiểm chứng |
|-----------|-------|------------|
| Semantic | `var(--accent-cyan)` | `grep "var(--accent"` |
| Status | `#10b981` success, `#f59e0b` warning, `#ef4444` danger | `grep "#10b981\|#f59e0b\|#ef4444"` |
| Chart | `--heat-up/down`, `--sdp-cyan-rgb` | `grep "heat-\|sdp-"` |
| Private effect | `glow blur 120px`, `ticker-badge` | `grep "glow\|ticker"` |
| Ngoài allowlist | hard hex/named color trong `*.module.css` | =0 mới PASS |

### 5.3 DOM contract gate — BLOCKER 1 (không dùng grep tĩnh)

```bash
# Sai (cũ): grep -rn "<main" ... # chỉ source tĩnh

# Đúng: runtime Playwright/Vitest trên 4 route pilot
# test:dom-landmarks — assert:
#   document.querySelectorAll('main').length === 1
#   document.querySelector('main main') === null
#   heading hierarchy 1 h1/page, landmark duy nhất
# + test:scroll-owners — assert frame scroll owner + nested panel/workstation có test riêng
# + grep chỉ để phát hiện hard Tailwind còn sót:
grep -rn "p-6\|max-w-7xl" packages/web/src/layouts/full/FullLayout.tsx
# FAIL nếu còn hard sau P0-2 (HIGH6: dùng w-[var(...)] mới PASS)
```

---

## 6. Traceability Matrix (Requirement → Task → File → Evidence) — HIGH 7 (thay grep bằng inventory)

| Req (V1) | Task | File neo | Evidence audit |
|----------|------|----------|----------------|
| V1 §2 Tokens `:root` | P0-1 | `tokens.css:1`, `index.css:96` | `tokens:check` allowlist (planned) |
| V1 §2 Layout 320/72/1800/24 | P0-1 (giữ 288px) + V1 conv riêng | `FullLayout.tsx:72`, `index.css:96` | computed width 288px P0, 320px phase riêng |
| V1 §4 Page template shell | P0-0 + P0-3 | `ShellPageTemplate.js:98`, `FullLayout:82` | **runtime** `test:dom-landmarks` (không grep) |
| V1 §5 3-col `22/48/30` | P1-3, P2-2 | `DashboardPage.tsx:345`, `WatchlistPage.css:24` | grid computed + visual matrix |
| V1 §6 Tab 3-state + persist | P1-1, P1-2 | `AlertCenterPage.tsx:296`, `DashboardPage.tsx:332` | tab persist localStorage |
| V1 §7 Typography 40/48, density | P2-1 | `ShellPageTemplate.module.css:72`, `StockDetailPage.css:54` | font-size computed |
| V1 §8 Semantic color | P0-1 | `tokens.css:5-8` | `var(--accent-*)` allowlist |
| V1 §10 Checklist 7 mục | P4 | `test:visual` viewport matrix riêng (HIGH8) | screenshot 6 viewport 1920/1440/1280/1024/768/390 |
| C1 drift | P0-1 | `tokens.css:49` vs `index.css:96` | diff report + allowlist |
| C2 app-page-shell 0 hit | P0-3 | `grep app-page-shell` | count 0→ alias (không nested) |
| C4 theme orphaned | P3-1 | `theme.module.css:1` | grep import ≥1 hoặc xóa |
| F-01 7 hệ CSS | P0-1 | 16 file *.css | line count 11k → ↓ |
| F-04 nested main | P0-0 | `ShellPageTemplate.js:98` + `FullLayout:82` | **runtime** `test:dom-landmarks` + `test:scroll-owners` (BLOCKER1+2) |
| F-12 route | P3-3 | `main.tsx:132`, `pageRegistry:206` | **route inventory** (§5.5) + redirect test (HIGH7) |
| F-14 flag | Q5 | `runtimeConfig.ts:1` | grep hits 178 + compat test 4 giá trị (MEDIUM11) |
| D4 100% shell | P4 | route inventory | runtime/AST, không grep (HIGH7) |

### 6.1 Route Inventory (HIGH 7) — thay D4 grep

| route | registry id | layout owner | shell type | exemption | visual test |
|-------|-------------|--------------|------------|-----------|-------------|
| `/dashboard` | `core-dashboard` | `FullLayout` | `ShellPageChrome`?/bento | bento triad `1fr 1.5fr 1fr` | `test:visual` dashboard |
| `/watchlist` | `core-watchlist` | `FullLayout` | `ShellPageChrome` | — | pilot |
| `/alert-center` | `alert-center` | `FullLayout` | `ShellPageChrome` | — | pilot |
| `/stocks/:symbol` | `core-stock-detail` | `FullLayout` | `WorkstationShell` (planned) | glow/chart private | `check:stock-detail-shell` mới |
| `/tenant-admin/*` (13) | `tenant-admin-*` | `TenantAdminLayout` | `ShellPageChrome` + `ta-*` | `TenantAdmin.module.css` cluster | per-page |
| `/login`, `/register` | `auth-*` | none | none | exemption — không shell | no visual |
| `/whale-alerts` (legacy) | — | redirect | — | compat → `/alert-center` | redirect test |

---

## 7. Rủi ro & Mitigation

| Rủi ro | Xác suất | Tác động | Mitigation |
|--------|----------|----------|------------|
| Alias value-preserving giữ drift màu | Cao | Trung | Allowlist + chuẩn hoá riêng, không alias cưỡng bức (Q1) |
| Nested shell double padding | Cao | Cao | P0-0 contract trước, không chạm FullLayout trước pilot |
| Workstation mất glow/chart | Trung | Cao | WorkstationShell variant, giữ `sdp-*` nội bộ (Q3) |
| TenantAdmin regression 13 pages | Trung | Cao | Migrate theo cluster, primitives trước (Q4) |
| `isNewLayoutEnabled` xóa sớm mất rollback | Thấp | Cao | Giữ flag qua P4, xóa sau 1 release (Q5) |
| Visual diff >1% sau token | Trung | Trung | Pilot AlertCenter/Watchlist trước, computed-style diff |

---

## 8. Lịch trình & Phụ thuộc — đã chỉnh HIGH 4

```
Tuần 1: P0-0 (2d, tạo gate DOM/a11y/scroll) → P0-1 prep (1d, baseline hard hex) ─┐
Tuần 2: Pilot-0 baseline (2d, 0 code, 6 viewport) → P0-1 token migration (3d, tạo tokens:check) → Pilot-1 diff (2d) ─┤
Tuần 3: P0-2 FullLayout token (2d, HIGH6 arbitrary) + P0-3 alias (1d) + P1-4 SOC (3d) ─┤ song song sau Pilot-1
Tuần 4: P1-1 AC (2d) + P1-3 Dashboard (5d) + P1-2 AI (3d) ─┤
Tuần 5: P2-1 WorkstationShell (5d, sửa check:stock-detail-shell) ─┤
Tuần 6: P2-2 WL (3d) + P2-3 Portfolios (3d) + P3-1 theme (2d) ─┤
Tuần 7: P3-2 TA primitives (5d) + P3-3 flag rename (1d, hỗ trợ cả cũ+mới, MEDIUM11) + P3-4 scrollbar (1d) ─┤
Tuần 8: P4 QC viewport matrix riêng + contrast + ledger + MAP update ─┘
```

**Phụ thuộc cứng**: P0-0 → Pilot-0 (baseline 0 code) → P0-1 → Pilot-1 (diff) → P0-2 → P1/P2. Không chạy P0-1 trước Pilot-0. P3 không chạm trước khi P1-3 xong. Flag `runtimeConfig.ts:1` giữ qua P4, precedence cũ→mới ghi ở P3-3.

---

## 9. Governance — đã chỉnh MEDIUM 11 + HIGH 8

- **Branch**: `feature/ui-unified-p0` → `feature/ui-unified-p1` → `feature/ui-unified-p2` (rebase `dev` mỗi phase). Không tạo branch trước khi patch P0-0 (BLOCKER 1-3).
- **Gate mỗi slice**: `tsc --noEmit` (sub-step) + `npm run build` (cuối phase) + **planned gate tạo trước khi dùng** + ledger entry (`AGENTS.md:160`).
- **Review**: mỗi phase PR cần screenshot **6 viewport** 1920/1440/1280/1024/768/390 (HIGH8) + server/seed/account/naming/ownership + `grep`/`runtime` evidence + `CODE_CHANGE_AUDIT_LEDGER.md` entry.
- **Flag compat (MEDIUM11)**: `runtimeConfig.ts:1` hỗ trợ cả `VITE_ENABLE_SAAS_OVERLAP_SIDEBAR` (cũ) + `VITE_LAYOUT_VARIANT` (mới), precedence ghi migration note, test 4 giá trị `true/false/missing/invalid`.
- **Owner**: FE shell owner (P0), feature owner (P1-2), QA visual (P4).

---

## 10. Phụ lục — Checklist Audit Độc Lập (copy-paste để audit) — đã chỉnh BLOCKER 1-3 + HIGH 7-8

```markdown
- [ ] P0-0: runtime test:dom-landmarks PASS (main count 1, main main null, 1 h1, landmark duy nhất trên 4 route pilot) — không grep tĩnh (BLOCKER1)
- [ ] P0-0: runtime test:scroll-owners PASS (frame 1 owner FullLayout:82, nested StockDetailPage.css:451 + WatchlistPage.css:21 có selector+test, không overflow ngẫu nhiên — BLOCKER2)
- [ ] P0-0: test:a11y PASS (axe ≥4.5:1, heading hierarchy — MEDIUM10) — planned, tạo ở P0-0
- [ ] P0-1: tokens:check PASS (allowlist §5.2, ngoài allowlist =0, 18rem giữ P0, V1 320px phase riêng — HIGH5) — planned, tạo ở P0-1
- [ ] P0-2: FullLayout.tsx w-72/p-6/max-w-7xl → w-[var(--layout-*)]/lg:pl-[var(...)] giữ responsive (HIGH6)
- [ ] P0-3: ShellPageChrome không nested <main>, no double padding (P0-0 contract)
- [ ] Pilot-0: baseline 6 viewport 1920/1440/1280/1024/768/390, 0 code change, report + naming/isolation/ownership ghi rõ (HIGH4, HIGH8)
- [ ] Pilot-1: diff sau P0-1, < threshold allowlist, FixedSizeList không tràn
- [ ] P1-1: AlertCard import soc:5, soc.statusBadge:199, no ReferenceError
- [ ] P1-2: ShellAiAdvisory 315 JSX, 0 createElement
- [ ] P1-3: Dashboard triad 1fr 1.5fr 1fr token, h580 first viewport check
- [ ] P1-4: SOC inline style 90 xóa, qua shellPage
- [ ] P2-1: WorkstationShell (mới, planned) variant, sdp-page not nested, font var(--font-sans), check:stock-detail-shell mới PASS (BLOCKER3)
- [ ] P2-2: Watchlist 240px 1fr → token variant, slideOver 420px
- [ ] P2-3: Portfolios core-page-header → ShellPageChrome + t()
- [ ] P3-1: theme.module.css has consumer or deleted (grep import)
- [ ] P3-2: TenantAdmin primitives ta-card/toolbar/table, numbered ↓ theo cluster
- [ ] P3-3: runtimeConfig flag hỗ trợ cả cũ VITE_ENABLE_SAAS_OVERLAP_SIDEBAR + mới VITE_LAYOUT_VARIANT, precedence + migration note, test true/false/missing/invalid (MEDIUM11)
- [ ] P3-4: 1 scrollbar/panel-scrollbar, 1 skeleton, 1 empty
- [ ] P4: tsc PASS + build PASS + lint PASS + i18n:scan (planned) PASS + check:shell PASS + check:stock-detail-shell mới PASS + test:visual viewport matrix riêng PASS (HIGH8) + route inventory runtime/AST (HIGH7, thay grep ≥50/53)
```

---

> **Kết luận (patch 2026-09-08b)**: Plan đã chỉnh 11 findings review độc lập (3 BLOCKER + 5 HIGH + 3 MEDIUM), đủ để **audit độc lập căn cứ runtime test + route inventory + viewport matrix** mà không suy diễn. Chốt Q1→Q5 giữ nguyên, P0-0 làm đầu tiên với gate DOM/a11y/scroll planned. **READY FOR KICKOFF** sau patch — tạo branch `feature/ui-unified-p0` và kickoff **P0-0 + Pilot-0 baseline (0 code)**.
>
> **Patch log 2026-09-08b**: BLOCKER1 grep→runtime `test:dom-landmarks`, BLOCKER2 scroll 1 owner → frame+nested contract + `test:scroll-owners`, BLOCKER3 planned gates `tokens:check`/`test:a11y`/`WorkstationShell`, HIGH4 Pilot-0/1 tách, HIGH5 parity vs V1 tách, HIGH6 `w-[var(...)]`, HIGH7 D4→inventory, HIGH8 viewport matrix riêng + isolation, MEDIUM9 token ownership bảng, MEDIUM10 a11y, MEDIUM11 flag compat.
