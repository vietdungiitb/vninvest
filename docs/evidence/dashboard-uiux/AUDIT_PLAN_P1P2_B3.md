# B3 — Audit độc lập plan `PLAN_DASHBOARD_P1P2_20261118.md`

- **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC (không sửa code runtime).
- **Scope:** đối chiếu plan (B2) với code thật tại branch `feat/dash-p1p2-uiux`, base `dev @ 6aa570fa2e06b0131ab1fa5a78ee1c900b5394b9` (`git rev-parse HEAD` = chính sha đó).
- **Nguồn plan:** `docs/PLAN_DASHBOARD_P1P2_20261118.md:1-83`. **Nguồn audit gốc:** `docs/evidence/dashboard-uiux/AUDIT_20261118.md:20-41`. **Quyết định owner:** `docs/CODE_CHANGE_AUDIT_LEDGER.md:5` (Q1–Q5).
- **Lessons áp dụng:** [L-V01, L-V02, L-V04, L-T02, L-T01] — mọi số liệu tự mở file/grep; không tin `file:line` kế thừa khi chưa đọc.

## VERDICT: **NEED_REVISION (objection đánh số)**

Lý do: 12 mục P1/P2 + Q4 được **ánh đúng mã nguồn** phần lớn (xem §1), nhưng có **3 lỗi kỹ thuật làm plan không thi hành được nguyên vẹn** (A3 sai tên prop + bỏ qua cổng `hasReadState`; B2 đảo ngược quyết định CSS có chủ đích mà không có fail-before; E1 để ngỏ khả năng xoá hook không phải trùng) và **4 assertion TDD xanh sẵn trên code cũ** (§3). Không REJECT vì fix đều khả thi và đã chỉ rõ đường sửa.

---

## 1. Đối chiếu 12 mục — hiện trạng code

| Mục | Plan nói | Thực tế (tự mở file) | Kết luận |
|---|---|---|---|
| A1 P1-1 | `index.css:617-627` `.seg` nowrap + scrollbar ẩn | `packages/web/src/index.css:617-627`: `display:inline-flex`, `flex-wrap:nowrap` (`:619`), `overflow-x:auto`, `scrollbar-width:none`, `max-width:100%`. 5 pill **đã render** trong DOM (`UnifiedAlertCenter.js:160`, `:256-274`) | ĐÚNG (lỗi là CSS/visual, không phải thiếu DOM) |
| A2 P1-2 | `UnifiedAlertCenter.js:455` `bodyText = title — summary`, truncate cắt `%` | `:362-368` ghép `title — summary` có điều kiện `isDuplicateSummary` (`utils/alertCenterFormat.ts:113-117` — **chỉ so sánh bằng nhau sau normalize**, không loại tiền tố); `:455` dùng `truncate` | ĐÚNG phần cắt; **sai nhẹ citation** (phép ghép ở `:364-368`, `:455` là chỗ render). AC "không lặp title" là hành vi MỚI, không phải sửa lỗi có sẵn ở ví dụ plan |
| A3 P1-7 | `<a href="/alert-center">` reload; Dashboard không truyền handler đọc/tắt | `UnifiedAlertCenter.js:475-480` đúng `<a href>`; `DashboardPage.tsx:384-394` **không truyền** `markAlertAsRead`/`muteSymbolFor30m`/`readAlertIds`/`unreadCount` — đúng. **Nhưng** component đã có 2 prop đó (`:97-98`) và tự render 2 nút (`:374-408`) | ĐÚNG hiện trạng, **SAI thiết kế fix** (xem O-1) |
| B1 P1-3 | `PortfolioHeatmap.js:514-522` title + 4 cụm nút 1 flex row, subtitle truncate | `:514-526`: `flex items-center justify-between gap-3`, `:518` `<h3>`, `:519` `truncate`, `:525-526` cụm nút `shrink-0` | ĐÚNG |
| B2 P1-4 | `index.css:493-505` `align-items:stretch` kéo legend/tile xuống viewport | `:504` `align-items: stretch` — ĐÚNG. **Nhưng** `:498-503` comment ghi rõ `stretch` được chọn có chủ đích thay `start`; `:469` đã có `max-height: 720px`; `:471` `overflow:hidden`; `:630-634` `.panel-body` flex/min-h-0 | ĐÚNG hiện trạng, **fix mâu thuẫn** (xem O-2) |
| B3 P2-1/Q4 | click đi `/stocks/:symbol`; dialog `selectedDetail` chết; tooltip sunburst `:329` thiếu `isOther`; `useChartResize:17-19` sai API | `:486-495` click → `handleNavigateToStock` → `:439` `navigate('/stocks/...')` ĐÚNG; `:195,651-700` dialog chỉ có `setSelectedDetail(null)` (`:668`), không chỗ gán non-null ĐÚNG; tooltip **treemap** `:329-332` **ĐÃ CÓ** `isOther`, tooltip **sunburst** `:385-392` mới thiếu; `useChartResize.js:16-20` gọi `chartRef.current.resize()`, mà ref là `ReactEChartsCore` (`PortfolioHeatmap.js:8,202,623,632`) có `getEchartsInstance()` (`node_modules/echarts-for-react/lib/core.d.ts:32`) | ĐÚNG 3/4; **citation sai + 1 tautology** (xem O-3). Fix resize ĐÚNG kỹ thuật |
| C1 P1-5 | Bell vừa navigate vừa trigger; `"No new notifications"`; wsStatus hardcode | `Header.tsx:339-349` `onClick: navigate` + `DropdownMenuTrigger`; `:363` hardcode; `:76` init `'connecting'`, `:86-88` `setWsStatus('connected')` ngay mount, `:320` `'Online'/'Offline'` hardcode | ĐÚNG (citation plan ghi `:80` là comment, lệnh set thật `:87`) |
| C2 P1-6 | 2 header cùng `sticky top-0 z-30` | `Header.tsx:216` `sticky top-0 z-30`; `SmartStatsHeader.js:115` `sticky top-0 z-30` | ĐÚNG |
| C3 P2-5 | breadcrumb thường; emoji cờ; search ẩn mobile | `Header.tsx:263` `pathname.split('/').pop()`; `:331-332` `🇻🇳 VI`/`🇺🇸 EN`; `:269` `hidden md:block` | ĐÚNG |
| D1 P2-2 | init từ `propAlerts`; nút disabled; "Quét lại" chỉ GET lại feed | `AIAdvisorAlertPanel.js:56,59` `alerts: propAlerts` → `useState(propAlerts ?? [])`; `:102-104` mount gọi `fetchFeed()` (`:70 getAIAlertsFeed`); `:201-209` nút disabled `viewPrevSession`; `:210-220` nút `rescan` **đã được đổi nhãn trung thực** (comment `:216-218`) | ĐÚNG 2/3; **"đổi nhãn" là tautology** (xem O-5) |
| D2 P2-3 | 4 tab VI; badge EN; charts placeholder; AI panel thiếu `t`; mã CK không link | `CoreDashboardPositionDeck.tsx:108-113` hardcode VI; `:274-278` `Holding/Tracked/Watchlist`; `:518-523` placeholder Owner Q3; `:527-537` `AIAdvisorDeckPanel` không nhận `t` | ĐÚNG |
| E1 P2-4 | 2 hook realtime; `change_value ?? change_pct`; bỏ `watchlistGroups`; truyền `watchlists` vào deck; enum thô | `DashboardPage.tsx:207-208` 2 hook; `:222` `change_value ?? change_pct ?? change ?? 0` (0 đè 2.1 → flat); `:238-247` dùng `watchlists` (có `w.items`), bỏ `watchlistGroups` (khai `:79,156`); `:447` `watchlistGroups={watchlists}`; `:353` `(connecting)` nhồi câu Việt | ĐÚNG (citation plan ghi `:238-247` đúng) |

**Scope 12 mục:** A(3)+B(3)+C(3)+D(2)+E(1) = **12**, Q4 gộp trong B3 → khớp "P1+P2+Q4". **Không mâu thuẫn non-goals**: Q4 của owner là "kích hoạt popover (defer wave P2)" (`ledger:5`) → plan làm P2 trong wave này là đúng nhịp; non-goal "không làm xem phiên trước" khớp D1; "giữ placeholder Biểu đồ" khớp `CoreDashboardPositionDeck.tsx:521` (Owner Q3). Reservation nhỏ: plan `:4` nói "owner chốt 2026-11-18" nhưng **không trích `ledger:5`** — nên thêm citation.

---

## 2. Kiểm tra fix đề xuất — lỗi kỹ thuật / phụ thuộc

### O-1 (MAJOR) — A3 bịa tên handler và bỏ qua cổng `hasReadState`
Plan `:22` viết "handler `onMarkRead`/`onMuteSymbol` truyền xuống". Tên prop thật là **`markAlertAsRead`/`muteSymbolFor30m`** (`UnifiedAlertCenter.js:97-98`), không phải `onMarkRead`/`onMuteSymbol`. Hơn nữa nút "đánh dấu đã đọc" **không render** nếu thiếu read state: `hasReadState = typeof unreadCount === 'number' || readAlertIds.size > 0` (`:118`) và điều kiện `if (hasReadState && !isRead && markAlertAsRead)` (`:374`). `DashboardPage.tsx:384-394` truyền **cả 4 thứ đều thiếu** → chỉ truyền thêm handler theo plan thì **TDD vẫn đỏ** và UI vô tác dụng. Cảnh báo thêm: `:414-417` `onClick` card tự gọi `markAlertAsRead(alertId)` → pass handler sẽ mark-read cả khi click vào nội dung, plan không nhắc.

**Không phải "bịa adapter":** method thật có sẵn — `coreApiAdapter.acknowledgeAlertCenterEvent` (`adapters/core/market.js:119-124`), `muteAlertCenterPreference` (`:132-133`; manifest `core-route-manifest.json:437`), được gọi qua `useAlertCenterActions.ts:57,77`. Plan phải đổi tên handler + ghi rõ dùng hook/adapter này + truyền `readAlertIds`/`unreadCount` (hoặc bỏ điều kiện `hasReadState` có chủ đích).

### O-2 (MAJOR) — B2 đảo ngược quyết định CSS có chủ đích, không có fail-before
Plan `:29` đề xuất `align-items: start` + `max-height: min(720px, calc(100vh - 260px))`. `index.css:498-503` **comment giải thích tại sao bỏ `start`**: "`start` trước đây làm cột 'Cảnh báo' ... tạo khoảng trống tối lớn ở góc phải" — plan khôi phục đúng lỗi đã sửa. Thêm xung đột: `max-height: 720px` **đã có** tại `:469`; plan thêm 1 `max-height` nữa mà không nói xoá/override cái cũ → tuỳ thứ tự khai báo, dễ thành no-op. Tuyên bố "lane cảnh báo ~680px kéo legend xuống dưới viewport" là **runtime claim chưa đo** (plan §3 ghi visual QA "CHƯA CHẠY") → vi phạm L-V02 (root cause kế thừa cần phản chứng). Yêu cầu: chạm repro/đo thực tế trước; nếu giữ `start` thì xoá `:469` và nêu rõ đánh đổi "trống góc phải".

### O-3 (MINOR/MAJOR) — B3 citation sai file:line + 1 AC xanh sẵn
Plan `:30` "tooltip sunburst `:329` thiếu nhánh `isOther`" — `:329` nằm trong `if (viewMode === "treemap")` (`:319`), và **đã có** `if (data?.isOther)` tại `:329-332`; chỗ thiếu thật là tooltip sunburst `:385-392`. Theo L-T02: đúng số dòng nhưng sai ngữ cảnh → sửa citation. Ngoài ra AC "Given click 'Khác', then vẫn `showAllTiles`" **đã xanh trên code cũ**: `handleClick` `:488-490` đã `setShowAllTiles(true); return;` → không được tính là assertion fail-before. Fix `getEchartsInstance().resize()` là **đúng** (ref là `ReactEChartsCore`, type `lib/core.d.ts:32`) — nhưng useChartResize là hook dùng chung (`useEChartsResize` tại `useChartResize.js:60-61`), plan phải ghi rõ sửa ở hook dùng chung để không sót consumer khác.

### O-4 (MAJOR) — E1 để ngỏ phương án xoá hook KHÔNG trùng
Plan `:51` "nếu trùng thì bỏ cái thừa". Đọc hook thật: `useAlertCenterRealtime.js:7-13` **comment chủ đích bypass manager**, `:16-21` tự gọi `useRealtimeFeedCore({symbols:['market_discovery'], pollInterval:30000, maxAlerts:50})` — khác consumer/symbol/poll interval với `useRealtimeFeedFromManager` (`RealtimeContext.js:40-45,108-196`). Quan trọng hơn: hook này **dispatch `alert-center-new`** (`useAlertCenterRealtime.js:40`) mà `Header.tsx:66` lắng nghe để cập nhật badge (`unseenCount`), và `DashboardPage.tsx:279` dùng `globalRealtimeAlerts` vào `mergedAlerts`. ⇒ **KHÔNG trùng, không được bỏ**. Plan phải đổi thành "giữ cả hai + comment rõ khác mục đích" ngay trong AC, đừng để implementer tự quyết xoá.

### O-5 (MINOR) — D1: nhãn rescan đã đúng; key `viewPrevSession` thành rác
`AIAdvisorAlertPanel.js:219` **đã dùng** `t("aiAdvisor.panel.rescan")` và comment `:216-218` ghi rõ đã đổi từ "Chạy phân tích" → hành vi GET thật. AC "đổi nhãn đúng hành vi GET (rescan giữ)" là **xanh sẵn**. Khi bỏ nút `:201-209`, key `aiAdvisor.panel.viewPrevSession` còn tồn tại ở `i18n/locales/vi/aiAdvisor.js:10` + `en/aiAdvisor.js:10` và **không còn call site nào** (grep toàn `src` chỉ còn 1 dùng tại `:208`). `check:i18n-hardcoded` (`package.json:33`) chỉ quét 5 path, **không quét 2 file này** → không gate nào bắt; nhưng nên dọn 2 key để trống rác contract. Plan chưa nhắc → thêm vào scope D1 (không vi phạm non-goal).

### C1 — khả thi nhưng mơ hồ ở mức chấp nhận được
`RealtimeContext.js:85-102` expose `feed.realtimeStatus`, `feed.metrics.connectionState`; `useRealtimeFeedFromManager` trả `realtimeStatus` (`:167`) — **có trạng thái kết nối dùng được**. Provider bọc `App` tại `main.tsx:292-294` ⇒ Header nằm trong provider, không cần mở feed mới. Plan `:36` cho phép "trạng thái trung tính **hoặc** derive từ realtime context" → không sai, nhưng nên ghi cụ thể nguồn (`useContext(RealtimeContext).feed.realtimeStatus`, **không** gọi `useRealtimeFeedFromManager` vì làm register consumer mới `:125`). Reservation, không phải objection chặn.

---

## 3. TDD fail-before — assertion xanh sẵn (tautology)

| Plan §2 | Assertion | Trên code cũ | Đánh giá |
|---|---|---|---|
| `alert-center-short` | "5 pill render" | `UnifiedAlertCenter.js:160,256-274` đã map 5 button vào DOM | **XANH SẢN** — muốn bắt lỗi P1-1 phải source-scan `.seg{flex-wrap:nowrap}` (`index.css:619`) như chính plan đã làm, hoặc computed-style; đừng dùng DOM count làm fail-before |
| `alert-center-short` | "có `-26.88%`" | `:455` chỉ thêm class CSS `truncate`; **jsdom không cắt `textContent`** → chuỗi `-26.88%` vẫn nằm trong DOM | **XANH SẢN** — assert `line-clamp-2`/computed style thay vì `toHaveTextContent` |
| `heatmap-popover` | "click 'Khác' → showAllTiles" | `PortfolioHeatmap.js:488-490` đã xử lý | **XANH SẢN** — dùng làm regression guard, không tính là RED |
| `ai-panel-deck-i18n` | "không alert lạ lúc mount" | `AIAdvisorAlertPanel.js:59` init từ `propAlerts`, nhưng `:102-104` fetch ngay; nếu test assert sau `waitFor` thì feed thật đã ghi đè → xanh | **RỦI RO XANH** — phải assert đồng bộ ngay lần render đầu (hoặc mock `getAIAlertsFeed` treo) mới là RED thật |
| (D1) "rescan đổi nhãn" | `aiAdvisor.panel.rescan` | `:219` đã đúng | **XANH SẢN** (xem O-5) |
| `index.css` source-scan / `useChartResize` / sticky / breadth / breadcrumb | — | Đều chạm code cũ còn sai (`:619`, `:504`, `useChartResize.js:18`, `SmartStatsHeader.js:115`, `DashboardPage.tsx:222`, `Header.tsx:263`) | **ĐỎ thật** — giữ |

Khuyến nghị: ÷ mỗi assertion "xanh sẵn" chuyển sang cột **regression guard**, và bổ sung 1 assertion computed-style/source-scan tương ứng để có fail-before thật (L-V04: assert giá trị thật, tránh assert rỗng/âm tính).

---

## 4. Kết luận & next step

- **Verdict:** `NEED_REVISION` — sửa 5 objection O-1…O-5 + đổi 5 assertion tautology ở §3, rồi gửi audit lại (tối đa 3 vòng theo workflow-dev-loop B4).
- **Không chạm:** không sửa code runtime; đang giữ nguyên uncommitted `docs/LESSONS/verification.md` (M) và `docs/PLAN_DASHBOARD_P1P2_20261118.md` (??) của planner — `git status --short` trước và sau audit như nhau.
- **CHƯA CHẠY:** tsc/lint/build/vitest/VPS staging — auditor chỉ đọc, không chạy gate; plan §3 tự khai đúng các mục này.
- **Owner của bản sửa:** planner (B2) — auditor không tự sửa plan.

---

## B4 CONSENSUS

- **Ngày 2026-11-18** · Đọc lại bản amend `docs/PLAN_DASHBOARD_P1P2_20261118.md:1-85` trên cùng branch/base; auditor vẫn chỉ đọc. **Verdict: AGREE (reservation)** — đây là cổng đồng thuận B4, không phải vòng audit mới.
- **5 objection đã hết:** O-1 → plan `:22` dùng đúng prop `readAlertIds`/`markAlertAsRead`/`muteSymbolFor30m` (code `UnifiedAlertCenter.js:96-98`) + cổng `hasReadState` (`:118,374`) + hook/adapter thật (`useAlertCenterActions.ts:57,77` → `market.js:119,132`). O-2 → plan `:29` **giữ `stretch`** (code `index.css:498-503`), thay bằng định nghĩa `--dash-chrome` thật (hiện chỉ nằm trong comment `index.css:462-464`, grep toàn `src` không có định nghĩa) + `calc(100dvh - var(--dash-chrome))` thay `max-height:720px` `:469`, có yêu cầu ghi số đo. O-3 → plan `:30,59` sửa citation sang sunburst `:387-392` (treemap `:329-331` đã có `isOther`), `:30,66` gán "Khác → showAllTiles" (`PortfolioHeatmap.js:488-490`) làm regression guard, bỏ tautology khỏi fail-before. O-4 → plan `:51` **giữ cả 2 hook** + comment, đúng thực tế `useAlertCenterRealtime.js:7-21,40` và `Header.tsx:66`. O-5 → plan `:44` dọn key `viewPrevSession` (`i18n/locales/vi|en/aiAdvisor.js:10`) có grep verify, và `:44` thừa nhận nhãn `rescan` đã đúng (`AIAdvisorAlertPanel.js:219`). Reservation trước đó (C1) cũng được nhận: plan `:36` cấm `useRealtimeFeedFromManager` (register consumer mới `RealtimeContext.js:125`).
- **TDD:** plan `:66` đã liệt kê 4 assertion xanh sẵn thành regression guard; mỗi dòng `:57-64` có ít nhất 1 assertion ĐỎ thật (source-scan/computed style/hành vi mới) — chấp nhận.
- **Reservation (không chặn B4→B5, đóng ở B6/B8):**
  1. **C1 — `useRealtimeContext` chưa tồn tại.** Plan `:36` gọi `useRealtimeContext().feed.realtimeStatus`, nhưng grep toàn `src` không có hook này; `RealtimeContext.js:5` khai `const RealtimeContext` **không export** (chỉ export `RealtimeProvider` `:19` và `useRealtimeFeedFromManager` `:108`; barrel `src/index.js:63` cũng chỉ export 2 cái đó). Cách sửa: export context rồi `useContext(RealtimeContext)` trong Header, hoặc thêm 1 hook export mới — phải đưa `src/context/RealtimeContext.js` vào scope. **Ai đóng:** implementer ở B6 (thêm file vào scope + export) → B8 verify bằng grep/gate.
  2. **A3 — chưa khớp chữ ký handler.** Component gọi `markAlertAsRead(alertId)` với scalar `alertId = alert.alert_id || alert.id` (`UnifiedAlertCenter.js:328,382,416`), trong khi `handleAcknowledge` nhận **object** và đọc `alert.alert_id ?? alert.event_id` (`useAlertCenterActions.ts:49-51`) → truyền thẳng sẽ `if (!id) return` (no-op im lặng). Cần wrapper `markAlertAsRead={(id) => handleAcknowledge({ alert_id: id })}`; tương tự `muteSymbolFor30m={(sym) => handleMute({ symbol: sym })}`. **Ai đóng:** implementer ở B6 (TDD assertion phải gọi adapter thật, không chỉ "handler được gọi") → B8 verify.
  3. **B2 — số 296px là ước lượng, chưa đo.** Plan `:29` tự ghi "đo từ Header 72 + h1 + SmartStats ~56 + padding" và yêu cầu "ghi số đo vào evidence, không đoán". **Ai đóng:** implementer ở B6/B7 (ghi số đo thực vào `docs/evidence/dashboard-uiux/`), B8 đối chiếu (L-V01).
- **Không có objection mới ở mức chặn.** B4→B5 được phép (PASS/AGREE), với 3 reservation trên phải đóng trước B8.
