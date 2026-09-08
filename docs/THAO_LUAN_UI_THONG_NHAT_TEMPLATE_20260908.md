# Thảo Luận — Lộ Trình Thống Nhất Giao Diện VNInvest theo Template Chung V1

> **Ngày**: 2026-09-08 (patch 2026-09-08b — đã áp 11 findings review độc lập)  
> **Tài liệu gốc**: `docs/AUDIT_UI_UNIFIED_TEMPLATE_INDEPENDENT_20260908.md:1` + `docs/IMPLEMENTATION_PLAN_UI_UNIFIED_TEMPLATE_20260908.md:1` (patch b) + Review 2026-09-08b (3 BLOCKER + 5 HIGH + 3 MEDIUM)  
> **Đối chiếu**: `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:1` + `docs/SYSTEM_FUNCTIONAL_MAP.md:1` + `docs/UI_LAYOUT_AUDIT_REPORT_20260501.md:1` + `packages/web/package.json:6-24` scripts thực tế  
> **Mục đích**: Làm tài liệu thảo luận tiếp — chốt SSOT, phạm vi rollout, thứ tự ưu tiên. **Trạng thái**: READY FOR KICKOFF sau patch (không tạo branch trước khi patch P0-0).

---

## 1. Bối cảnh (1 trang)

Dự án có **Template V1** đầy đủ (`PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:10-344`: Layout Contract, token `:root`, `app-page-shell/page-body-grid`, checklist 7 mục).  
Nhưng `packages/web` (53 routes `pageRegistry.js:174`) chưa rollout: tồn tại **7 hệ CSS song song ~11k dòng** (`soc.module.css:2386`, `StockDetailPage.css:2486`, `TenantAdmin.module.css:2039`, `aiSettings:871` ...) — mỗi cụm tự định nghĩa token, padding, font, grid.  
`frontend` legacy đã chuẩn hoá `22/48/30` (`UI_LAYOUT_AUDIT_REPORT_20260501.md:35`) nhưng `packages/web` không kế thừa → visual drift khi điều hướng `Dashboard → Watchlist → Stock Detail → Tenant Admin`.

**Cần thảo luận để chốt 1 SSOT trước khi code.**

---

## 2. Câu hỏi cần quyết định (Decision Log)

Điền `Quyết định / Người chốt / Ngày` trước khi kickoff. Mỗi câu hỏi blocking 1 phase.

| # | Câu hỏi | Lựa chọn | Quyết định đề xuất (sau review 2026-09-08) | Trạng thái |
|---|---------|----------|-----------------|------------|
| **Q1** | **SSOT token là gì?** | (A) `theme/tokens.css:1` semantic SSOT + `index.css:6` Tailwind bridge/layout <br>(B) `ShellPageTemplate.module.css:2` `--sh-*` <br>(C) `soc.module.css:4` `--soc-*` | **(A) — Chốt** — `tokens.css:1-56` làm semantic SSOT (`--accent-*`, `--bg-*`, `--border-*`, `--text-*`, `--sp-*`, `--r-*`, `--shadow-*`). `index.css:96-99` chỉ làm Tailwind `@theme` + layout integration (`--layout-sidebar-width/header-height`). Token private của component (`--sh-shell`, `--soc-*` chart accent, `--sdp-*` glow) được giữ nếu thật sự private, không alias cưỡng bức toàn bộ P0. Alias value-preserving chỉ cho token chung, drift giá trị (`#12c7e8` vs `#06b6d4`) phải chuẩn hoá riêng. | ✅ Đề xuất chốt |
| **Q2** | **Shell chuẩn cho `packages/web`?** | (A) `FullLayout` sở hữu frame + `ShellPageChrome` sở hữu header/surface <br>(B) Thay toàn bộ bằng `app-page-shell/page-body-grid` V1 | **(A) — Chốt** — `FullLayout.tsx:70-88` sở hữu page frame, spacing ngoài (`p-*`) và `max-width`. `ShellPageTemplate.js:98-123` `ShellPageChrome` sở hữu header/content surface (`.shellPage/.hero/.metrics`). Không bọc thêm `<main>` trong `<main>`; 1 contract DOM duy nhất. `.app-page-shell` chỉ là alias nếu cần, không tạo nested main. | ✅ Đề xuất chốt |
| **Q3** | **Stock Detail giữ workstation riêng?** | (A) Tạo `WorkstationShell` variant <br>(B) Bọc trực tiếp `sdp-page:49` trong `ShellPageChrome` <br>(C) Xoá `sdp-*` | **(A) — Chốt** — Giữ workstation riêng. Không bọc trực tiếp `sdp-page:49-55` bằng `ShellPageChrome` (sẽ xung đột padding/background/glow/scroll). Tạo `WorkstationShell` dùng chung layout tokens (`--layout-*`, `--sp-*`, `--font-sans`) nhưng giữ glow, `sdp-ticker-badge`, chart/scroll behavior riêng. | ✅ Đề xuất chốt |
| **Q4** | **TenantAdmin numbered CSS?** | (A) Giữ `TenantAdmin.module.css:1` `home_*/pats_*` tạm <br>(B) Migrate theo từng page/cluster với primitives | **(B) — Chốt** — Migrate theo từng page/cluster. Trước tiên tạo semantic primitives (`ta-card`, `ta-toolbar`, `ta-table`), chưa đổi tên hàng loạt selector numbered trong một phase. Precedent `AlertCenter` Entry 24-32 áp dụng dần. | ✅ Đề xuất chốt |
| **Q5** | **Feature flag `isNewLayoutEnabled`?** | (A) Xóa ngay `runtimeConfig.ts:1` <br>(B) Giữ để rollback, đổi tên + document | **(B) — Chốt** — Giữ flag qua P0-P4 để rollback. Đổi tên thành rõ nghĩa (ví dụ `VITE_ENABLE_SAAS_OVERLAP_SIDEBAR` → `VITE_LAYOUT_VARIANT`), ghi rõ nguồn cấu hình, xóa sau visual acceptance + 1 release ổn định. Flag hiện default `true` nhưng vẫn điều khiển thực ở `FullLayout.tsx:11-35`, `Sidebar.tsx:28-42`, `Header.tsx:33-36` — chưa phải dead branch. | ✅ Đề xuất chốt |

---

## 3. Đề Xuất Lộ Trình (P0→P4) — rút gọn từ audit

> Mỗi phase tuân `AGENTS.md:8-9`: `npx tsc --noEmit` mỗi sub-step, `npm run build` cuối phase, cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`.

### P0 — Baseline Shell (2-3 tuần) — BLOCKER

> **P0-0 trước tiên** — DOM/layout contract (blocking Q1+Q2+Q3).

| Slice | Việc | File chạm | Pass criteria |
|-------|------|-----------|---------------|
| **P0-0** | **DOM/layout contract**: xác định 1 page = mấy shell, ai sở hữu scroll/padding/max-width. `FullLayout.tsx:70-88` sở hữu frame + spacing ngoài + max-width; `ShellPageTemplate.js:98-123` sở hữu `header/metrics/surface`; không nested `<main>` trong `<main>`. Document 1 scroll owner/page. | `FullLayout.tsx:46-88`, `ShellPageTemplate.js:98-123`, `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:272` | No nested `<main>`, no double padding, 1 scroll owner, contract ghi vào audit |
| P0-1 | SSOT token (semantic): `tokens.css:1-56` làm SSOT cho `--accent/bg/border/text/sp/r/shadow`; `index.css:96-99` chỉ bridge Tailwind + layout. Token private (`--sh-shell`, `--soc` chart, `--sdp` glow) giữ lại, không alias cưỡng bức. Drift màu (`#12c7e8` vs `#06b6d4`) chuẩn hoá bằng allowlist. | `tokens.css:1`, `index.css:6-100`, 6 module.css | Allowlist pass (semantic/status/chart/private effect), không phải `hex <10` cứng |
| P0-2 | FullLayout token hoá — **làm sau pilot** | `FullLayout.tsx:72,85` `p-6/max-w-7xl/lg:pl-72` → `var(--layout-*)` | Pixel không đổi, token-driven, screenshot 1920/768 pass |
| P0-3 | Shell wrapper | `ShellPageTemplate.module.css:23` thêm `.app-page-shell` alias **chỉ nếu cần** (không tạo thêm wrapper `<main>`); nếu đã có contract P0-0 thì alias = 0 nested | `ShellPageTemplate.module.css:23`, `ShellPageTemplate.js:98` | Mọi trang Shell tự có spacing V1, không double padding |

### P1 — Signals Cluster (2-3 tuần)

- P1-1 Alert Center: đã xong 95%, chỉ audit `#ffd166` (`AlertCenterPage.module.css:107`) — giữ
- P1-2 AI Advisory: `ShellAiAdvisoryPage.tsx:315` `createElement` → JSX
- P1-3 Dashboard: `index.css:265` bento `1fr 1.5fr 1fr` giữ ratio, nền/border đổi `soc.glassPanel`
- P1-4 SOC: `ShellOperationsCenterPage.tsx:90` inline gradient → `ShellPageChrome`

### P2 — Portfolio Cluster (3-4 tuần)

- P2-1 Stock Detail: `StockDetailPage.tsx:324` bọc Shell, `StockDetailPage.css:54` font → `var(--font-sans)`
- P2-2 Watchlist: `WatchlistPage.css:24` `240px 1fr` align `page-body-grid` token
- P2-3 Portfolios/Transactions: `PortfoliosPage.tsx:92` `core-page-header` → `ShellPageChrome`

### P3 — Cleanup (2 tuần)

- `theme.module.css:1` 383 dòng: promote hoặc xóa (hiện 0 import) — quyết định sau khi chốt Q1 allowlist
- `TenantAdmin.module.css:1` 2039 dòng numbered → semantic primitives `ta-card/ta-toolbar/ta-table` theo từng page/cluster (Q4)
- **Giữ flag `runtimeConfig.ts:1` qua P3** (Q5), đổi tên rõ nghĩa, thống nhất `panel-scrollbar`/`ShellSkeleton`/`ShellEmptyState`

### P4 — QC Gate (1 tuần) — bổ sung gate hiện có

- Checklist `PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:228` 7 mục + 6 breakpoint 1920/1440/1280/1024/768/390
- `npm run test:visual` (mẫu `alert-center.spec.ts:1` đã có)
- **Gate bổ sung từ `package.json:6-24`**: `npm run check:shell`, `check:stock-detail-shell`, `i18n:scan` — không chỉ `tsc`/`build`
- **Acceptance cứng**: no nested `<main>`, no double padding, 1 scroll owner/page, contrast check

Tổng: **7-8 tuần** (thêm P0-0), P1/P2 song song được. Pilot là `AlertCenterPage.tsx:238`/`WatchlistPage.tsx:42` (đã có `ShellPageChrome`), **không pilot `FullLayout.tsx:70` đầu tiên** vì tác động 53 routes.

---

## 4. Anti-pattern Cấm (trích V1:259)

1. Tự đặt `max-width/padding-top` riêng (`sdp-page:55` `20px 20px 48px` ✗)
2. Hero cao đẩy module quan trọng dưới viewport (`dashboard-triad-lane: h580` cần audit)
3. Hard-code màu ngoài token
4. Trộn nhiều hệ spacing (`p-6` + `var(--sp-*)` + `24px`)
5. Ẩn module khi empty thay vì `ShellEmptyState.tsx:1`

---

## 5. Tài liệu tham chiếu nhanh

| Tài liệu | Dùng khi nào |
|----------|--------------|
| `docs/AUDIT_UI_UNIFIED_TEMPLATE_INDEPENDENT_20260908.md:1` | Tra cứu findings chi tiết F-01→F-15 + CONTRADICTIONS C1→C7 |
| `docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md:272` | Copy CSS utility `app-page-shell/page-body-grid/page-panel` |
| `docs/SYSTEM_FUNCTIONAL_MAP.md:7` | Map 7 cụm chức năng → 53 routes |
| `docs/UI_LAYOUT_AUDIT_REPORT_20260501.md:35` | Precedent remediation 22/48/30 đã làm ở `frontend` |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md:1` | Ghi entry mỗi slice (bắt buộc per `AGENTS.md:160`) |

---

## 6. Errata — Sửa findings diễn đạt quá mạnh (review 2026-09-08)

| Claim cũ | Sửa lại | Cơ sở |
|----------|---------|-------|
| F-14 "flag chết, dead branch `w-16`" | Flag **mặc định bật** (`runtimeConfig.ts:1-9` → `true`) nhưng **vẫn sống**, điều khiển thực ở `FullLayout.tsx:11-35`, `Sidebar.tsx:28-42`, `Header.tsx:33-36` | Grep `isNewLayoutEnabled` 178 hits |
| F-12 "`/whale-alerts` → 404" | `/whale-alerts` không phải route hiện tại; route thật `alert-center` (`main.tsx:132`, `pageRegistry.js:206`). `/whale-alerts` rơi vào wildcard `* → /dashboard:124` → **bookmark regression / compatibility gap**, không phải 404 | `main.tsx:124,132` |
| Q1 alias toàn bộ value-preserving | Alias toàn bộ sẽ **giữ drift** nếu giá trị gốc khác (`#12c7e8` vs `#06b6d4`). Cần allowlist semantic/status/chart/private | `tokens.css:49-55` vs `index.css:96-99` |
| P0-3 bọc `ShellPageChrome` bằng `app-page-shell` | Tạo **nested main + double padding** (`ShellPageTemplate.js:98` `<main>` trong `FullLayout.tsx:82` `<main>`) | DOM contract chưa định nghĩa |

---

## 7. Next Step — Đề xuất cuộc họp (đã chỉnh theo review)

1. **Chốt Q1→Q5** (bảng §2) — owner FE + design. **Q1/Q2/Q3 là quyết định kiến trúc, chốt sai phải làm lại P1/P2.**
2. **Chọn pilot P0-0 + P1-1**: `AlertCenterPage.tsx:238` hoặc `WatchlistPage.tsx:42` (đã có `ShellPageChrome`, rủi ro thấp, có screenshot baseline) — **không pilot `FullLayout.tsx:70` đầu tiên**.
3. **Tạo branch `feature/ui-unified-p0`** — P0-0 contract trước, rồi P0-1 token allowlist (không đổi pixel nếu giữ private token).
4. **Hẹn review P0** với screenshot 1920/1440/1280/1024/768/390 + `tsc --noEmit` + `check:shell` + `i18n:scan` + computed-style diff.

> File này là **bản thảo luận** — sau khi chốt Q1→Q5 sẽ cập nhật thành `IMPLEMENTATION_PLAN_UI_UNIFIED_TEMPLATE_20260908.md` chính thức và bắt đầu code.
