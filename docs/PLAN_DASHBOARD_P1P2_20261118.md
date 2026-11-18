# PLAN — Dashboard wave 2: P1 + P2 (2026-11-18)

> **Trạng thái:** PLAN (B2) — chưa code wave này. Branch `feat/dash-p1p2-uiux`, base `dev @ 6aa570fa2` (đã gồm PR #429/P0).
> **Nguồn:** `docs/evidence/dashboard-uiux/AUDIT_20261118.md` · owner chốt 2026-11-18: làm **toàn bộ P1 + P2** (12 mục) + Q4 (kích hoạt popover Heatmap).
> **Cách làm:** 1 claim, 1 PR, commit theo nhóm A/B/C/D/E. Không đụng deny-list, không migration, không `npm install`.

## 0. Lessons áp dụng

`Lessons áp dụng: [L-001, L-002, L-003, L-008, L-M02, L-A01, L-F03, L-F08, L-F09, L-F10, L-F12, L-V01, L-V02, L-V03, L-V04]`

- C2 đang **60/60** ⇒ lesson mới từ lỗi VPS (`useNavigate` ngoài Router) đã ghi dạng **checklist bổ sung trong `L-V04`** (`verification.md`), `check-lessons` exit 0. Không tạo heading mới.
- Checklist cứng: claim trước dòng code đầu; TDD fail-before; `git diff --numstat` sau mỗi ghi; **full component suite trên VPS** sau khi thêm hook cần context (L-V04); rebase→gate cuối (L-003); không báo PASS cho thứ chưa chạy (L-V02).
- **Reservation B4 (đóng ở B6, verify B8):** (1) `useRealtimeContext` **chưa tồn tại** — phải export từ `RealtimeContext.js` (đưa file vào scope/claim), KHÔNG register consumer mới; (2) `markAlertAsRead` component gọi scalar `alertId` (`:328,382,416`) trong khi hook nhận object (`:49-51`) ⇒ cần wrapper ở DashboardPage, truyền thẳng là no-op im lặng; (3) `--dash-chrome: 296px` mới là ước lượng ⇒ phải đo thực (computed style/Chrome) ghi vào evidence, không suy diễn.

## 1. Scope / AC

### Nhóm A — AlertCenter (P1-1, P1-2, P1-7)

| ID | Bằng chứng hiện trạng | AC (Given/When/Then) |
|---|---|---|
| A1 P1-1 | `index.css:617-627` `.seg{nowrap;overflow-x:auto;scrollbar-width:none}` trong lane ~300px ⇒ `Cao (7` cắt, `Trung bình`/`Thấp` ẩn | Given lane hẹp, when render filter, then **5 pill đều nhìn thấy** (wrap thành 2 hàng), không cần cuộn ẩn. Assert CSS `flex-wrap: wrap` + test render 5 button accessible. |
| A2 P1-2 | `UnifiedAlertCenter.js:455` `bodyText` = `title — summary`, dùng `truncate` 1 dòng ⇒ cắt mất `%` | Given `price_shock` title `"Biến động bất thường TVG"` + body `"Biến động giá -26.88%"`, when render, then text **không lặp title** và hiển thị đủ `-26.88%` (`line-clamp-2`). |
| A3 P1-7 | `UnifiedAlertCenter.js:475-480` `<a href="/alert-center">` ⇒ full reload; DashboardPage `:384-394` truyền thiếu 4 prop; prop thật là `readAlertIds`/`markAlertAsRead`/`muteSymbolFor30m` (`:96-98`), nút còn phụ thuộc `hasReadState` (`:118,374`) | Given click "Xem thêm", when navigate, then **KHÔNG reload** (`<Link to>`). DashboardPage truyền đủ `readAlertIds` + `unreadCount` (để `hasReadState=true`) + `markAlertAsRead` + `muteSymbolFor30m` **từ hook `useAlertCenterActions` có sẵn** (`src/hooks/useAlertCenterActions.ts:57,77` → adapter `market.js:119,132` — KHÔNG bịa endpoint). When click nút đọc/tắt 30p, then handler gọi thành công + card phản hồi (`aria-pressed`/style). |

### Nhóm B — Heatmap (P1-3, P1-4, P2-1/Q4)

| ID | Bằng chứng | AC |
|---|---|---|
| B1 P1-3 | `PortfolioHeatmap.js:514-522` title + 4 cụm nút trên 1 flex row ⇒ title gãy 2 dòng; subtitle `truncate` mất giờ | Given lane hẹp, when render, then title **1 dòng**, subtitle hiện đủ `count · cập nhật giờ · đang gộp · fallback`. Dùng `flex-wrap` + tách cụm nút xuống hàng 2 dưới `sm`, bỏ `truncate` subtitle. |
| B2 P1-4 | `index.css:493-505` `align-items: stretch`; `.dashboard-triad-lane` `:467-471` đã có `max-height:720px` nhưng `--dash-chrome` ở comment `:462-465` **không bao giờ được định nghĩa** nên lane luôn 720px vượt viewport | Given viewport 900px cao, when render triad, then legend và hàng tile đáy nằm trong khung nhìn đầu. **Giữ `align-items: stretch`** (quyết định cũ có chủ đích, `:498-503` — không đảo lại `start` khi chưa có repro runtime). Sửa bằng cách **định nghĩa `--dash-chrome` thật** trên `.core-dashboard-page` (~296px đo từ Header 72 + h1 + SmartStats ~56 + padding) rồi đổi lane `max-height: min(720px, calc(100dvh - var(--dash-chrome)))`; `.panel-body` tự cuộn. Ghi số đo vào evidence, không đoán. |
| B3 P2-1/Q4 | `PortfolioHeatmap.js:486-495` click đi thẳng `/stocks/:symbol`; dialog `selectedDetail` `:651-700` không bao giờ mở; nhánh `isOther` **đã có ở treemap `:329-331`**, chỗ thiếu là **sunburst `:387-392`**; `useChartResize.js:17-19` gọi `resize()` thay vì `getEchartsInstance().resize()` | Given click tile có symbol, when click, then **popover mở** (sparkline 24h + giá/KL/vốn hóa/biến động), KHÔNG điều hướng. Given click nút mã trong popover, then đi `/stocks/:symbol`. Click "Khác" → `showAllTiles` **giữ nguyên** (chỉ là regression guard, KHÔNG tính là fail-before). Given hover "Khác" **sunburst** (`:387-392`), then tooltip liệt kê `otherCount`/`otherSymbols`/avg pct. Given resize, then `getEchartsInstance().resize()` được gọi (fallback nếu không có instance). Escape đóng popover, `role="dialog"`. |

### Nhóm C — Header / sticky (P1-5, P1-6, P2-5)

| ID | Bằng chứng | AC |
|---|---|---|
| C1 P1-5 | `Header.tsx:339-366` Bell vừa `onClick navigate` vừa `DropdownMenuTrigger`; `:363` hardcode `"No new notifications"`; `:76,80,320` set cứng `wsStatus='connected'` | Given click bell, when menu mở, then **không điều hướng ngay**; chỉ menu item "Xem tất cả" mới đi `/alert-center`. Nội dung dropdown qua i18n `layout.*`. Trạng thái mạng lấy từ `useRealtimeContext().feed.realtimeStatus` (`RealtimeContext.js:85-102`) — **KHÔNG gọi `useRealtimeFeedFromManager`** (sẽ register consumer mới tại `:125`); nếu status không có thì hiện nhãn trung tính, không nói dối "Online". |
| C2 P1-6 | `Header.tsx:216` `sticky top-0 z-30`; `SmartStatsHeader.js:~136` `sticky top-0 z-30` | Given cuộn trang, when 2 header gặp nhau, then SmartStatsHeader nằm **dưới** Header (`top-[4.5rem] z-20`), không đè `<h1>`. |
| C3 P2-5 | `Header.tsx:263` breadcrumb chữ thường `dashboard`; `:331-332` emoji cờ render `VN VI`; `:269` search `hidden md:block` | Given route `/dashboard`, then breadcrumb `"Dashboard"` (vi: `"Tổng quan"`); selector chỉ `VI`/`EN` (không emoji); ô tìm kiếm **hiện ở mọi viewport** (mobile thu nhỏ). |

### Nhóm D — AI panel & Position Deck (P2-2, P2-3)

| ID | Bằng chứng | AC |
|---|---|---|
| D1 P2-2 | `AIAdvisorAlertPanel.js:59` init từ `propAlerts` (chứa Whale/Sốc giá) ⇒ flash sai loại; `:201-209` nút `disabled: true` vĩnh viễn; `:211-220` "Quét lại" chỉ GET lại feed | Given propAlerts chứa alert không-AI, when mount trước `fetchFeed`, then **không hiển thị alert không-AI**. Nút vĩnh viễn disabled được **bỏ khỏi UI** (không hứa tính năng chưa có) **và dọn key i18n `aiAdvisor.panel.viewPrevSession` rác tại `vi/en/aiAdvisor.js`** — grep verify trước khi xoá (có thể call-site khác); "Quét lại" giữ nhãn `aiAdvisor.panel.rescan` (đã đúng hành vi GET), không nhân đòn với Refresh header. |
| D2 P2-3 | `CoreDashboardPositionDeck.tsx:108-113` 4 tab hardcode VI; `:274-278` badge `Holding/Tracked/Watchlist`; `:518-524` tab Biểu đồ placeholder; `:527-537` `AIAdvisorDeckPanel` thiếu prop `t`; mã CK không link | Given locale en, then 4 tab + 3 badge dịch qua `t` (thêm key `dashboard.tab*`, `dashboard.source*` ở **cả** vi/en). Given render AI tab, then `AIAdvisorDeckPanel` nhận `t`. Given dòng mã CK, then click mở `/stocks/:symbol`. Tab "Biểu đồ" giữ placeholder **có chủ đích** (Owner Q3) — không sửa thành giả. |

### Nhóm E — DashboardPage logic (P2-4)

| ID | Bằng chứng | AC |
|---|---|---|
| E1 P2-4 | `DashboardPage.tsx:207-208` 2 hook realtime; `:222` `change_value ?? change_pct` ⇒ `change_value=0` đếm nhầm flat; `:238-247` bỏ `watchlistGroups`; `:447` truyền `watchlists` thay `watchlistGroups` vào deck; `:353` nhồi enum Anh `(connecting)` vào câu Việt | Given `change_value=0` nhưng `change_pct=2.1`, when tính breadth, then đếm **up** (ưu tiên `change_pct` có giá trị khác 0). Given `watchlistGroups` có mã, then mã đó vào `heatmapSymbols` **và** `CoreDashboardPositionDeck`. Given status `connecting`, then banner tiếng Việt + nhãn đã dịch, không còn enum thô. **Giữ CẢ HAI hook realtime** — auditor đã verify `useAlertCenterRealtime.js:7-21` bypass manager có chủ đích (feed global `market_discovery`, dispatch `alert-center-new` `:40` mà `Header.tsx:66` nghe); chỉ thêm comment giải thích, KHÔNG gộp/bỏ. |

## 2. TDD fail-before (bắt buộc ĐỎ trước khi sửa)

| Test | Assertion mới | Kỳ vọng code cũ |
|---|---|---|
| `index.css` source-scan (mới) | `.seg` có `flex-wrap: wrap`; `--dash-chrome` **được định nghĩa** và lane dùng `calc(100dvh - var(--dash-chrome))`; `align-items: stretch` **vẫn giữ** | ĐỎ |
| `__tests__/alert-center-short.component.test.tsx` (mới) | `bodyText` KHÔNG chứa `title` (kiểm prop/source, không phải textContent — jsdom `truncate` không xoá chữ); link là `<a>` có `data-router-link`/`role=link` thay vì hardcode `href` | ĐỎ |
| `__tests__/heatmap-popover.component.test.tsx` (mới) | click tile mở dialog (`role="dialog"`), Escape đóng, nút mã navigate; sunburst tooltip có nhánh `isOther` | ĐỎ |
| `useChartResize` test (mới) | `getEchartsInstance().resize` được gọi | ĐỎ |
| `Header.component.test.tsx` (sửa) | breadcrumb `Dashboard`, option KHÔNG chứa `🇻🇳`, search có mặt ở mobile | ĐỎ |
| `smart-stats-cta` + sticky source-scan | SmartStatsHeader class chứa `top-[4.5rem]`, `z-20` | ĐỎ |
| `__tests__/ai-panel-deck-i18n.component.test.tsx` (mới) | không alert lạ lúc mount, **không có nút `disabled`** trong empty state (source-scan hoặc query), tab/badge dịch, `t` truyền vào AI panel | ĐỎ |
| `dashboard-breadth` test (mới, pure helper) | `change_value=0, change_pct=2.1` → up; watchlistGroups vào universe | ĐỎ |

⚠ Auditor B3: "5 pill render", "có `-26.88%`", "rescan đổi nhãn", "Khác → showAllTiles" **xanh sẵn trên code cũ** ⇒ chỉ dùng làm **regression guard**, KHÔNG tính là fail-before. Mỗi AC phải có ít nhất 1 assertion ĐỎ thật (source-scan/computed style/hành vi mới).

Tất cả chạy `cd packages/web && npx vitest run <file>`; chỉ implement sau khi thấy ĐỎ.

## 3. Gates

Lokal: `npx tsc --noEmit` · `npm run lint` · `npm run check:tokens` · `npm run i18n:scan:strict` · `npm run check:i18n-hardcoded` · `node packages/web/scripts/check-multi-agent.mjs` · `node scripts/check-lessons.mjs` · `git diff --numstat`.

VPS (`docs/STAGING_VPS_RUNBOOK.md` §12.4): worktree tạm từ `origin/feat/dash-p1p2-uiux`, **full** `npm run test:components` + `npm run build`, đối chiếu baseline 5 fail SSE đã biết; dọn worktree. Visual QA/E2E/a11y runtime: **CHƯA CHẠY** nếu staging vẫn chạy code khác — ghi rõ.

## 4. Non-goals

- Không đổi màu tăng/giảm Bloomberg (L-F08); không token mới (nếu cần → `soc.tokens.css`, class → `soc.components.css`, KHÔNG `soc.module.css`).
- Không làm tính năng "xem phiên trước" (BE chưa xác minh) — chỉ bỏ nút chết.
- Không sửa 5 test SSE baseline (đã chứng minh fail sẵn trên `dev @ 577ddf646`).
- Không đụng backend, migration, package.json, docker compose.

## 5. Rollback

Commit theo nhóm A→B→C→D→E, revert từng commit nếu hỏng. Cấm `git checkout --` (L-A01) — dùng `git show HEAD:<file> > <file>`.
