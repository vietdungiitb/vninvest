# UI/UX AUDIT + DESIGN SYSTEM GAP REPORT + REFACTORING ROADMAP

**Ngày:** 2026-09-26 (verify 2026-09-27) · **Scope:** `/dashboard` (3 màn hình trong screenshot) · **HEAD:** `dev` @ `686cff45`
**Chế độ:** **doc-only**. Không sửa 1 dòng code. Mọi khẳng định dưới đây dẫn `file:line` hoặc kèm phép đo.
**Phương pháp:** 5 agent audit song song, đọc source thật, đối chiếu 3 screenshot → sau đó **3 auditor độc lập đi ngược từng claim** (Stage 2 protocol). Xem PHỤ LỤC.
**Phạm vi số:** các số đo (px, contrast, KB) đều chạy tool thật hoặc tính từ CSS — không ước lượng nếu có thể đo được. Số nào **không tái lập lại được thì đã gỡ hoặc gắn nhãn CHƯA XÁC MINH**.

---

## ⚡ TÓM TẮT ĐIỀU HÀNH

> **Đừng bắt đầu bằng việc đổi màu. 5 việc dưới đây giải quyết 60% vấn đề bạn nêu, và 4 trong 5 là lỗi kỹ thuật chứ không phải lựa chọn thiết kế.**

| # | Việc | Vì sao trước | File |
|---|---|---|---|
| **1** | **Gỡ trần `max-width: 1280px`** | Ở màn **1920px** mất **304px chiều ngang = 15,8% viewport chết** (đo được; ở 1900px là 284px = 14,9%; ở 2560px là 944px = 36,9%). Đây là nguyên nhân #1 của "quá nhiều khoảng trống" — không phải card. | `index.css:109` + `FullLayout.tsx:95` |
| **2** | **Bỏ `height: clamp(480px,…,720px)` cứng cho 3 lane** | Lane **luôn** cao 480–720px bất kể 1 mã hay 50 mã. Không phụ thuộc dataset ⇒ không có fix nào theo "nhiều/ít dữ liệu" chạm được. *(Lưu ý: clamp chỉ chạm đỉnh 720px khi `100dvh ≥ 1040` — tức fullscreen; cửa sổ trình duyệt thường ở màn 1080p cho ~580–680px.)* | `index.css:418` |
| **3** | **Bỏ chuỗi `min-height` lồng 3 tầng ở deck** | 1 dòng bảng (~45px) vẫn ra khối **≈545px** (400 min-h + 16 `p-2` + ~87px 2 hàng toolbar `Deck.tsx:244,264` + 40px padding deck) ⇒ **~500px rỗng**. Chính là "1 row mà khung cao như 680px" bạn thấy. | `index.css:435` + `CoreDashboardPositionDeck.tsx:305` |
| **4** | **Hợp nhất 3 hệ token cùng tên, giá trị khác nhau** | 1 hệ nằm trong **lazy chunk** ⇒ vào `/soc` một lần là accent/muted/border/cỡ chữ của **cả app** đổi theo thứ tự điều hướng. | `theme/tokens.css:1-16` ↔ `soc/soc.tokens.css:5-16` |
| **5** | **Sửa 5 i18n key không tồn tại** | User thấy chữ literal `alert.showing`, `alert.loadError` ngay trên UI. Test che vì mock dict. | `UnifiedAlertCenter.js:243,255,261,262,269` |

**Và 4 vấn đề nghiêm trọng hơn, không xuất hiện trong screenshot:**

- **Gate bảo vệ design system là giả.** `check:tokens` không scan `src/index.css`, không đọc `.js/.jsx/.tsx`, và `continue` mọi file `tokens.css`. Đang PASS trong khi design system ở tệ nhất.
- **22/28 component `components/ui/` không có consumer** (32 file gồm 2 CSS + 2 barrel). Dashboard dùng **0** component `ui/`, dùng 655 Tailwind color literal.
- **427 dòng file chết trong `components/dashboard/`** — 2 file trùng tên `(1)`. ⚠️ `FactsFirstModularPositionDeck.jsx` (490 dòng) **KHÔNG chết** (có importer qua bridge `.js` + `index.js:2`) — xem Wave 0.7a / 4.x. Agent sau dễ sửa nhầm.
- **623 KB ECharts trong tải đầu `/dashboard`** = 34,1% JS của route (đo bằng `measure-route-graph.mjs`).

---

## §1. ĐỐI CHIẾU: 6 NHẬN XÉT CỦA BẠN ↔ BẰNG CHỨNG CODE

Không phải nhận xét nào của bạn sai, nhưng **4/6 có nguyên nhân gốc khác** — và nguyên nhân đúng thì rẻ hơn nhiều.

| # | Bạn nói | Verdict | Bằng chứng |
|---|---|---|---|
| **1** | "Quá nhiều khoảng trống" | ✅ **CONFIRMED — nhưng sai nguyên nhân** | Không phải card cao. Là `max-w-[80rem]`=1280px cứng ở `FullLayout.tsx:95` + `height: clamp(…,720px)` ở `index.css:418`. Ở 1920px: `1920−288(sidebar)−48(pad)−1280(cap) = 304px` chết, `mx-auto` chia đều 152px mỗi bên. **Mọi màn ≥1280px render giống hệt từng pixel** ⇒ 2 media query ở `index.css:454,463` vô dụng vì đo viewport trong khi container đã đóng băng. |
| **2** | "Cảnh báo chiếm gần 50% chiều cao, nên giảm" | ⚠️ **PARTIAL — can thiệp sai chỗ sẽ không hiệu quả** | Card không cao; **khung lane cao cố định** (`index.css:418`). 20 item cao 130,5px × 20 + gap = **2762px** nội dung scroll trong ~386–526px nhìn được ⇒ **chỉ 3–4 alert hiện**. Thu nhỏ item 130→93px *không làm lane co lại* — lane vẫn 720px. Phải sửa `clamp` **và** giảm số item **cùng lúc**. |
| **3** | "Text trên treemap chìm vào background" | ❌ **REFUTED như phát biểu** | Chữ trên ô đạt **AAA**: 7,13:1 → 12,32:1 (5/5 stop, đo WCAG). Comment `PortfolioHeatmap.js:25` **đúng**. Vấn đề thật là 2 kênh khác: (a) **ô vs nền panel `#0f172a` chỉ 1,45–2,50:1 → fail WCAG 1.4.11** (cần ≥3:1) ở 5/5 stop, và viền ô cùng màu nền ⇒ viền = 1,00:1 = không tồn tại; (b) **ô cạnh nhau 1,03–1,31:1** — trong screenshot `+1.76%` vs `+4.38%` = 1,22:1 ⇒ không phân biệt được độ lớn. |
| **4** | "Ô `Khác (40 mã)` quá lớn" | ✅ **CONFIRMED — con số tệ hơn bạn tưởng** | Với 5 holdings + 40 mã theo dõi, `Khác` chiếm **70,6% diện tích** (`share = 0.3N/(H+0.3N)`). Vì size là **bịa**: `PortfolioHeatmap.js:188-204` cấp `sizeValue = avgValue × 0.3` cho mã không nắm giữ. Click chỉ toggle mở rộng, **không có drawer** ⇒ 40 mã đó biến mất hoàn toàn. |
| **5** | "Tooltip quá nghèo" | ✅ **CONFIRMED — spec đã viết xong, không ai nối** | i18n có **sẵn 25 key** mô tả tooltip giàu (giá hiện tại, khối lượng, biến động bq, xu hướng 24h, ngành, "mở chi tiết") tại `vi.js:2588-2604` — **0 usage**. Formatter `PortfolioHeatmap.js:279-291` thay bằng 3 dòng tiếng Việt hardcode. |
| **6** | "Breadcrumb `dashboard` mang tính technical" | ✅ **CONFIRMED** | `Header.tsx:186` `location.pathname.split('/').pop() \|\| 'Dashboard'` — render **slug URL thô**, không `t()`. `Header.tsx:183` literal `'VNInvest'`. |

**Phát hiện thêm mà bạn không nêu, nhưng ảnh hưởng trực tiếp "cảm giác chưa chuyên nghiệp":**

| # | Vấn đề | Bằng chứng |
|---|---|---|
| **7** | **"KPI bar bị lép" — 4/4 metric KHÔNG BAO GIỜ có dữ liệu** | BE `PortfolioAnalyticsView.get` trả đúng `{summary, note}` (`portfolio_analytics_views.py:238-244`); grep toàn backend cho `alpha_annual_pct`/`beta`/`sharpe_ratio`/`max_drawdown_pct` = **0 hit**. UI render `--` là **trung thực**, nhưng 1/3 chiều rộng thanh KPI là **ô chết vĩnh viễn**. Sửa ở BE, không phải UI. |
| **8** | **Hệ thống phân cấp KPI bị ĐẢO** | Label của metric (12px/500) **lớn hơn** label của KPI chính (10px/400) — `SmartStatsHeader.js:127` vs `:69,80`. Metric thứ 3 (12px/900) **nhỏ hơn** KPI chính (14px/900). Tỉ lệ lớn nhất/nhỏ nhất = **1,4×**; ngưỡng tạo cảm giác "đây là con số chính" là ≥2×. |
| **9** | **"0" trong `GIÁ TRỊ DANH MỤC 0` mất đơn vị** | `summary.total_market_value` là **string** `"0.00"` từ BE (`:134`) ⇒ `marketValue > 0` = false ⇒ không render `đ`. Cùng lý do đó làm **empty-state CTA (`:99-119`) là dead code**. |
| **10** | **"Cập nhật vừa xong" là thông tin sai** | `updatedAt` đọc `summary.updated_at` — BE **không có field này** (chỉ có `as_of` = ngày, `:139`) ⇒ `isStale` luôn false ⇒ UI nói "vừa xong" với data có thể 3 ngày tuổi. |
| **11** | **5 hệ format tiền, 4 biến thể đơn vị** | `₫` / `đ` (viết tay `SmartStatsHeader.js:74`) / `VNĐ` / `VND`; và `1,3 tỷ` vs `1,68 tỷ` (1dp vs 2dp cho cùng bậc). 1 màn hình hiện 3 hệ khác nhau. |
| **12** | **`9.200` — locale hardcode** | `PortfolioHeatmap.js:610` `toLocaleString("vi-VN")` không truyền options. 31 chỗ `toLocaleString("vi-VN")` inline + 32 chỗ không-arg. Nguồn chuẩn `localeTag` (`LangContext.js:71,75`) tồn tại nhưng `SmartStatsHeader.js:24` không lấy. |
| **13** | **Badge đỏ "20" KHÔNG phải số chưa đọc** | `DashboardPage.tsx:354-369` không truyền `readAlertIds` ⇒ `UnifiedAlertCenter.js:101` rơi về tổng số alert, tooltip ghi "20 **chưa đọc**" (`vi.js:2414`). Hệ quả: nhánh `isRead` là code chết, 0 nút mark-read/mute. |
| **14** | **Loading state & ErrorBanner không có CSS** | `.core-dashboard-skeleton`, `.core-dashboard-error`, `.core-dashboard-page` — **không định nghĩa ở bất kỳ file CSS nào**. Skeleton = 5 div trắng rỗng. Error = 1 dòng chữ trần giữa trang trắng. 9/15 class của `DashboardPage.tsx` là class chết. |
| **15** | **"Tín hiệu AI — Lần quét gần nhất 22:20" là số bịa** | `AIAdvisorAlertPanel.js:76-83`: khi API không trả `last_scan_at` thì dùng `Date.now()` (giờ fetch) rồi hiển thị như "lần quét gần nhất". Comment `:76-77` tự thừa nhận "không bịa API" — code làm ngược lại. Thêm: `"· 0 tín hiệu"` nằm cứng trong chuỗi dịch. |

---

## §2. BẢN ĐỒ KIẾN TRÚC

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `src/main.tsx` | 247 | Router. `dashboard` → remap `core-dashboard` (`:24`), khai `/dashboard` (`:137`) | |
| `src/pages/pageRegistry.js` | 316 | Lazy registry. `dashboard`→`ShellDashboardPage` (`:189`), `core-dashboard`→`DashboardPage` (`:208`) | **Entry `:189` không bao giờ tới** (C8) |
| `src/layouts/full/FullLayout.tsx` | 101 | Sidebar + Header + `main`. **Cap `max-w-[80rem]` (`:95`)** | ← **P0 số 1** |
| `src/layouts/full/vertical/header/Header.tsx` | 332 | Breadcrumb từ slug thô (`:186`), search (`:190-206`) | |
| `src/components/Breadcrumb.tsx` | 93 | Chỉ `TenantAdminLayout` dùng — dashboard không import | 2 implementation độc lập |
| `src/pages/DashboardPage.tsx` | 442 | 6 slot JSX viết cứng, không registry | |
| `src/components/dashboard/SmartStatsHeader.js` | 176 | KPI bar | 2 hệ label, 6 chuỗi format |
| `src/components/dashboard/PortfolioHeatmap.js` | 627 | Treemap/Sunburst ECharts | 35 hex hardcode, 49 dòng dialog chết |
| `src/components/dashboard/UnifiedAlertCenter.js` | 479 | Alert lane | 5 key `t()` không tồn tại, 12 prop chết |
| `src/features/dashboard/AIAdvisorAlertPanel.js` | 267 | Card "Tín hiệu AI" | 0 `aria-live` |
| `src/components/dashboard/CoreDashboardPositionDeck.tsx` | 494 | Bảng + 4 tab | Lồng `dashboard-full-width-deck` 2× |
| `src/index.css` | 720 | Layout triad + `@theme` 48 token | `:418` height clamp; `:109` trần 1280 |
| `src/theme/tokens.css` | 82 | Token gốc (alias) | ← xung đột với SOC |
| `src/components/soc/soc.tokens.css` | 130 | **Trùng tên, khác giá trị, nằm trong lazy chunk** | ← P0 số 4 |
| `src/theme/theme.module.css` | 383 | **Design system #2 — 100% chết** | 1 consumer giả (`WorkstationShell.tsx:32`) |
| `src/components/soc/soc.components.css` | 3482 | **Design system #3 — 384 class, đầy đủ nhất, nhưng khu trú SOC** | Có sẵn metric/emptyState/tabs/table/skeleton |
| `src/components/ui/` | 30 file | Design system #4 — **22/30 chết** | |

### Trace: user mở `/dashboard`

```
main.tsx:137          route 'dashboard' → resolvePageComponent
main.tsx:24           remap → 'core-dashboard'
pageRegistry.js:208   lazy import('./DashboardPage.tsx')
pageRegistry.js:172   deferred loader: <article> + SVG đồng hồ 640px² xoay (không skeleton)
FullLayout.tsx:61     Sidebar 288px
FullLayout.tsx:81     Header → "VNInvest / dashboard"
FullLayout.tsx:92     <main class="flex-1 p-6 overflow-auto">      ← scroll container
FullLayout.tsx:95     <div class="max-w-[80rem] mx-auto">          ← CẮT NGANG Ở ĐÂY
DashboardPage.tsx:331   slot --stats    → SmartStatsHeader
DashboardPage.tsx:348   slot --triad    → grid 1fr 1.5fr 1fr
DashboardPage.tsx:350     lane --alert  → UnifiedAlertCenter   (height 720px)
DashboardPage.tsx:374     lane --heatmap→ PortfolioHeatmap     (height 720px)
DashboardPage.tsx:395     lane --ai     → AIAdvisorAlertPanel  (height 720px)
DashboardPage.tsx:415   slot --deck    → CoreDashboardPositionDeck (min-h 400px + 400px lồng)
```
Không có `<h1>`, không breadcrumb trong page.

---

## §3. CONTRADICTIONS

| # | Comment/class nói | Code làm | File:line |
|---|---|---|---|
| C1 | "top stays 1.25rem for header alignment" (`:607-610`) | 2 lane `padding:1rem` vs heatmap `1.25rem` ⇒ **lệch 4px** | `index.css:607-610` vs `:416` |
| C2 | "S4.5 radius unified 12px" (`:426`) | Lane dùng `var(--r-lg)`, deck **hardcode** `0.75rem`; còn 2 chỗ nữa dùng `0.75rem !important` / `9999px` | `index.css:415,616,710` |
| C3 | fallback `rgba(30,41,59,0.4)` = glass (`:413`) | `--bg-panel-soft` resolve `#0f172a` **đục** ⇒ fallback không bao giờ chạy ⇒ **không có glassmorphism** | `index.css:413` vs `tokens.css:14` |
| C4 | "Bento Card for full-width deck" | Class áp **3 tầng lồng** ⇒ 3 viền + 3 bo góc + **3 lớp `overflow:auto`** | `DashboardPage.tsx:415` → `Deck.tsx:236` → `WhaleAnalyticsTab.jsx:67` |
| C5 | Token `--dash-chrome` (tên gợi ý cấu hình được) | **Không định nghĩa ở đâu** ⇒ luôn rơi 320px | `index.css:418` (grep toàn repo: 1 hit, chính dòng fallback) |
| C6 | `.core-dashboard-slot--deck { }` | Rule rỗng, chỉ có comment | `index.css:603-605` |
| C7 | `--layout-header-height: 4.5rem` | Khai, **0 consumer** | `index.css:105` |
| C8 | Registry khai `dashboard`→`ShellDashboardPage` | Router remap sang `core-dashboard` ⇒ **entry chết** | `pageRegistry.js:189` vs `main.tsx:24` |
| C9 | `max-w-[1800px]` trong SmartStatsHeader | Nằm trong container cap 1280px ⇒ **constraint chết** | `SmartStatsHeader.js:62` vs `FullLayout.tsx:95` |
| C10 | `index.css:489` "label **12px/500** thống nhất" | 3 label KPI dùng `text-[10px]` (10px) | `index.css:489` vs `SmartStatsHeader.js:69,80,140` |
| C11 | `index.css:415` "12px = rounded-xl" | `--r-lg` = 12px nhưng `rounded-lg` = **8px** ⇒ lệch 4px khi đặt cạnh | `index.css:415` vs `tokens.css:47` |
| C12 | `SmartStatsHeader.css:1` "S8 bridged tokens" | 20/22 rule map tới token có **hex trùng chính xác** Tailwind ⇒ **0 pixel đổi**, nhưng 1 rule (`ring-offset-slate-950`) **phá focus ring** | `SmartStatsHeader.css:2-97` |
| C13 | `index.css:16` "Dark Mode Default" | **Không có block light nào override `--color-bg-*`** ⇒ `body` luôn `#020617` | `index.css:131-135` |
| C14 | `AIAdvisorAlertPanel.js:76-77` "**không bịa API**" | `:83` `setLastScanAt(Date.now())` khi API không trả ⇒ hiển thị như "lần quét gần nhất" | `AIAdvisorAlertPanel.js:76-83` |
| C15 | `PortfolioHeatmap.js:313` "label gating 44×28 / 56×40 **via helper**" | ECharts 6.1.0 `getDataParams` **không truyền `rect`** (chỉ `treeAncestors`/`treePathInfo`) ⇒ nhánh đó **không bao giờ chạy**; runtime chỉ có `share≥1%`/`≥3%` | `PortfolioHeatmap.js:96-107` + `echarts/lib/chart/treemap/TreemapSeries.js:124-131` |
| C16 | `heatmap-scale.component.test.ts:49-63` verify ngưỡng pixel | Test dựng object `rect` giả ⇒ **xác nhận một code path không bao giờ chạy trong browser** | `heatmap-scale.component.test.ts:49-63` |
| C17 | `alert-card-compact.component.test.tsx:80` "height ≤110px" | jsdom `rect.height === 0` ⇒ `if` false ⇒ **assertion chết**; item thật ~130px; probe Playwright lại cho phép `<160` | `alert-card-compact.component.test.tsx:79-83` |
| C18 | `vi.js:2607-2628` đã có 9 key `modernDeck.*` | `CoreDashboardPositionDeck.tsx:266,281,313,321-327` **hardcode** chuỗi VI | `vi.js:2607-2628` vs `Deck.tsx:266` |
| C19 | `vi.js:2636` "Health Score sẽ xuất hiện khi đủ dữ liệu analytics" | 4 field đó BE **không bao giờ trả** ⇒ UI hiện 4 ô `--` vĩnh viễn, không dùng copy này | `vi.js:2636` vs `portfolio_analytics_views.py:238-244` |
| C20 | `formatSessionDate` (formatMarket.js) vs comment alertCenterFormat "never the browser timezone" | **Cùng tên, 2 semantics**. Dashboard import bản lệch TZ; AlertCard import bản đúng | `formatMarket.js:35-39` vs `alertCenterFormat.ts:78-85` |
| C21 | `PortfolioHeatmap.js:577` render dialog chi tiết | `setSelectedDetail` **chỉ** được gọi với `null` (`:594`) ⇒ **dialog không bao giờ mở**; `fetchTrendData:370-386` + `renderSparkline:392` unreachable; API `getStockChartHistory:374` **không bao giờ chạy** | `PortfolioHeatmap.js:577-625` |
| C22 | `index.css:307-308` `var(--mouse-x, 50%)` giả định có JS ghi | grep `mouse-x` toàn `.ts/.tsx/.js/.jsx` = **0 hit** ⇒ glow đứng yên | `index.css:307-308` |
| C23 | `index.css:690-696` `.focus-visible-ring` khai `ring`/`ring-color`/`ring-offset` | Đó là **Tailwind directive, không phải CSS property** ⇒ 3 khai báo vô hiệu. Class 0 consumer | `index.css:690-696` |
| ~~C24~~ | ~~Mojibake: `lucide-icon.tsx:29,34`, `theme/tokens.css:18`~~ | ~~**ĐÃ BỊ REFUTE — xoá dòng này.** Kiểm chứng lại bằng `Read` (UTF-8) cho thấy cả 3 dòng đều sạch: `lucide-icon.tsx:29` = `Building2: Icons.Building2,` · `theme/tokens.css:18` = `/* ── Typography scale (chuẩn hệ thống SOC) ── */`. Dấu `��` trong bản thảo là **artifact đọc file qua console cp1252**, không phải file hỏng.~~ | |

---

## §4. UI/UX AUDIT — 12 NHÓM

Điểm = severity. Mỗi finding có `file:line` + fix đủ cụ thể để implement.

### 4.1 Information Architecture — 3 tầng navigation cùng cấp, không có priority

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| IA-1 | **P0** | `DashboardPage.tsx:331-437` | 6 slot viết cứng trong JSX, **không registry, không priority, không sort key**. Thứ tự = thẻ JSX. 8 panel tổng cộng, tất cả cùng `panel-title` 16px (`index.css:490-499`) ⇒ **không có tín hiệu thị giác nào phân biệt "quan trọng" với "phụ"** | `const SLOTS = [{id, priority, minWidth, render}]` + map; truyền `className` cho deck (prop đã có sẵn `Deck.tsx:32,50` nhưng `DashboardPage.tsx:419-434` không truyền) |
| IA-2 | P1 | `Header.tsx:186` | Breadcrumb = slug URL thô, không `t()`; `:183` literal `'VNInvest'` | Map `const CRUMB = {dashboard: t('layout.nav.dashboard'), …}`, fallback `t()` thay vì `\|\| 'Dashboard'` |
| IA-3 | P1 | 6 nơi | **6 tab/filter implementation độc lập, không component dùng chung**: `Deck.tsx:74-79`(4 tab) · `Deck.tsx:264-303`(2 select) · `SocTabNavigation.tsx:33`(7 tab) · `AICommandCenterPage` hub nav · `AlertCenterPage.tsx:493-537` · `UnifiedAlertCenter.js:219-236`(5 pill) | Tách `TabBar`/`FilterBar`/`SegmentedControl` dùng chung. **Ticket riêng, không gộp vào PR layout** |
| IA-4 | P1 | `index.css:454,463` | Breakpoint `1279px` / `1099px` **không khớp bậc Tailwind nào** (v4 CSS-first, không có `tailwind.config.*`, mặc định 640/768/1024/1280/1536) ⇒ 2 hệ độc lập | Sau khi gỡ trần 1280 (P0 số 1), chuyển sang **container query**: `.dashboard-triad-grid { container-type: inline-size }` |
| IA-5 | P2 | `app/navigationCatalog.js` | **2 menu catalog lệch nhau** (catalog có `vip-local`+`ai-command-center`; sidebar có `trading`+6 mục admin). `navigationCatalog` **không ai render** | Xoá hoặc render thay `sidebaritems.ts` — chọn 1 |
| IA-6 | P3 | `Deck.tsx:394` | Dev-note tiếng Việt render production: "Tab Kỹ thuật hiện đang lọc trên dữ liệu kỹ thuật sẵn có." | Xoá `:392-396` |

### 4.2 Layout & Density — nguồn gốc thật của "quá nhiều khoảng trống"

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| **LY-1** | **P0** | `index.css:109` + `FullLayout.tsx:95` | `--layout-content-max-width: 80rem` = **1280px cứng**. 1920px mất **304px = 15,8%** viewport (đo). 2560px mất 688px | `80rem` → `100rem` (1600px) hoặc bỏ cap, dùng `max-w-[1800px]` cho khớp `WhaleAdvisoryPage.tsx:337`; thêm `padding-inline: clamp(1.5rem, 3vw, 3rem)` |
| **LY-2** | **P0** | `index.css:418` | `height: clamp(480px, calc(100dvh − var(--dash-chrome,320px)), 720px)` cho **cả 3 lane**. 1080p ⇒ **720px cố định**. **Không phụ thuộc dataset** | `height: auto; min-height: 360px; max-height: 720px` + `align-items: start` trên grid. Hoặc đặt `--dash-chrome` thật vào `index.css:104-112` |
| **LY-3** | **P0** | `index.css:435` + `Deck.tsx:305` | `min-height:400px` (deck) **và** `min-h-[400px]` (nội dung) = 2 tầng sàn lồng | Bỏ `index.css:435`; `Deck.tsx:305` → `min-h-[280px]` |
| **LY-4** | **P0** | `DashboardPage.tsx:415` → `Deck.tsx:236` → `WhaleAnalyticsTab.jsx:67` | `.dashboard-full-width-deck` áp **3 tầng** ⇒ 3 viền + 3 bo góc + 3 `overflow:auto` + padding thực 40px | Giữ ở `DashboardPage.tsx:415`; gỡ 2 chỗ còn lại |
| LY-5 | P1 | `index.css:416,609` | 4 mức thụt lề ngang trên 1 màn: **24** (main) / **20** (deck) / **16** (lane side) / **8** (heatmap lane) + `SmartStatsHeader.js:59` `px-6` ⇒ mép trái **không thẳng hàng** | 1 biến `--lane-pad`; `SmartStatsHeader.js:59,62` bỏ `px-6`/`max-w-[1800px]` |
| LY-6 | P1 | `index.css:444-446` | Ở ≥1280px: `1fr 1.5fr 1fr` gap 16px. Trong 1280px ⇒ lane sau **356px**, lane giữa **535px** | Sau LY-1: `minmax(280px,1fr) minmax(420px,1.6fr) minmax(280px,1fr)` |
| LY-7 | P1 | `index.css:418` | `clamp(480px,…)` ⇒ viewport ≤800px (laptop 1366×768) lane **vượt** khả gian | `min(480px, 60dvh)` |
| LY-8 | P1 | `SmartStatsHeader.js:59` | `sticky top-0 z-30` bên trong `main` (`overflow-auto`), app header nằm **ngoài** `main` | Bỏ `sticky`, hoặc `top: var(--layout-header-height)` và **dùng** token `index.css:105` |
| LY-9 | P2 | `index.css:603-605,105` | Rule rỗng + token chết | Xoá |
| LY-10 | P2 | `index.css:145-160` vs `:571-581` | Scrollbar thumb khai 2 lần: `@layer base` = `--color-border-secondary`, `@layer utilities` thắng = `#2a3550` ⇒ **rule trong base là code chết** | Xoá 1 |
| LY-11 | P2 | `index.css:660-687,261-265,295-316` | `.bento-card-hover`, `.glass`, `.agentic-glow-cyan` — **0 consumer** (~45 dòng) | Xoá |
| LY-12 | P2 | `index.css:564` | `mask-image` 24px cuối panel áp **vô điều kiện** ⇒ 24px dưới cùng luôn mờ dù không scroll | Chuyển sang `mask` chỉ khi `scrollTop + clientHeight < scrollHeight` |
| LY-13 | P2 | `DashboardPage.tsx:348-413` | 5 `PageErrorBoundary` cho 6 slot ⇒ 1 lần remount lỗi là mất layout | Gom 1 boundary + fallback slot-level |

**Số đo vùng chết (đo được, không ước lượng):**

```
1920px viewport
− 288  sidebar (--layout-sidebar-width 18rem)     index.css:106
= 1632 content box
−  48  main padding 1.5rem × 2                    FullLayout.tsx:92
= 1584 khả dụng
− 1280  max-w 80rem                                index.css:109
───────
=  304px  CHẾT NGANG  (15,8%, mx-auto chia 152px/bên)   ← đo trực tiếp

Dọc, viewport 1080px:
48 (main pad) + ~56 (stats) + 16 (gap) + 720 (triad, clamp max) + 16 + 456 (deck tối thiểu)
= ~1312px trong vùng nhìn ~1008px  ⇒ ~304px phải cuộn
và `main` là scroll container + `.panel-body` cũng scroll  ⇒ cuộn lồng 2 tầng
```

### 4.3 KPI hierarchy — "mọi KPI ngang hàng" có 2 nguyên nhân riêng

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| **KH-1** | **P0** | `portfolio_analytics_views.py:238-244` | BE trả `{summary, note}`; thiếu cả 4 field. grep toàn backend = 0 hit ⇒ **4 ô KPI chết vĩnh viễn** | Tính từ `PortfolioEquityCurveView` (`:167-199`, đã có `curve`): `sharpe = mean(r)/std(r)×√252` · `beta = cov(port,VNINDEX)/var(VNINDEX)` · `maxDD = min((nav/peak − 1)×100)` · `alpha = (rp−rf) − β(rm−rf)`. Trả `null` (không phải `0`) khi `<30` điểm. **Không cần migration** (view không đụng model) |
| ~~KH-2~~ | ~~**P0**~~ → **P3 dead CSS** | `SmartStatsHeader.css:93-97` | ~~`.ring-offset-slate-950` specificity **0-2-0**, không điều kiện, ghi đè `box-shadow` ⇒ focus ring luôn hiện, WCAG 2.4.7 fail~~ **⛔ SAI — đã kiểm chứng lại khi implement.** Selector là `.smart-stats-header .ring-offset-slate-950`, còn token trong DOM là `focus-visible:ring-offset-slate-950` (có tiền tố variant) ⇒ **selector không bao giờ match** ⇒ **không có gì phá focus ring**. Token trần `ring-offset-slate-950` chỉ nằm ở `ui/tabs.tsx:44`, mà `tabs.tsx` không có class `smart-stats-header`. Đã đo bằng script exact-token: bare count = **0** | Đã xoá vì là **CSS chết** (`.bg-current/10` bare=0, `.ring-emerald-400/80` bare=0), không phải vì hỏng. Bài học: phải hỏi "selector có match không" **trước** khi lập luận về specificity |
| KH-3 | P1 | `SmartStatsHeader.js:127` vs `:69,80,140` | **2 hệ label**: metric 12px/500/sentence-case vs KPI 10px/400/uppercase ⇒ **hệ thống phân cấp bị đảo** | 7 label → 1 class `.kpiLabel` |
| KH-4 | P1 | `SmartStatsHeader.js:27,38,74` | `total_market_value` là **string** `"0.00"` ⇒ `!marketValue`=false, `"0.00">0`=false ⇒ mất `đ` + CTA chết | `const mvNum = Number(marketValue) \|\| 0`; `đ` render luôn khi có data |
| KH-5 | P1 | `SmartStatsHeader.js:72,84` | 2 con số **primary** **không** có `tabular-nums`, trong khi 4 metric `--` (`:128`) và metadata (`:155,160`) **có** ⇒ đảo ngược ưu tiên | Thêm `tabular-nums` vào `:72,84` |
| KH-6 | P1 | `index.css:134` | `font-feature-settings: "cv02","cv03","cv04","cv11"` — thiếu `"tnum"`. 2 hệ cùng tồn tại (`font-variant-numeric` 30 chỗ trong SOC/StockDetail + class JSX 19 chỗ) | Thêm `"tnum"` hoặc bỏ hẳn class JSX — chọn 1 |
| KH-7 | P2 | `SmartStatsHeader.js:19-21,40-41` | `updated_at` không tồn tại ở BE ⇒ `isStale` luôn false ⇒ badge "Dữ liệu cũ" chết + nói dối "vừa xong" | BE thêm `'updated_at': max(snapshot.updated_at)`; tới lúc đó FE hiện `—` thay vì giờ render |
| KH-8 | P2 | `SmartStatsHeader.css:80-83` | `.bg-current\/10` không tồn tại trong Tailwind, `opacity` áp cả element | Xoá |

**Đề xuất type scale cho KPI bar** (tỉ lệ hiện 1,4× → **2,55×**):

| Class | Giá trị | Thay cho |
|---|---|---|
| `.kpiLabel` | `--fs-2xs`(11) · `--fw-medium` · `--lh-snug` · `ls 0.02em` · **no uppercase** · `--color-text-muted` | `SmartStatsHeader.js:69,80,127,140` (4 nơi → 1) |
| `.kpiValuePrimary` | **`--fs-3xl`(28)** · `700` · `1.1` · `ls -0.01em` · `tabular-nums` | `:72` (hiện 14px/**900**) |
| `.kpiValueSecondary` | `--fs-2xl`(22) · `700` · `1.15` · `tabular-nums` | `:84` |
| `.kpiValueTertiary` | `--fs-sm`(13) · `600` · `tabular-nums` | `:128` |
| `.kpiMeta` | `--fs-2xs`(11) · `400` · `--lh-snug` | `:74,88,155,159,163` |

> `--fs-3xl`(28) và `--fs-4xl`(34) đã được định nghĩa (`tokens.css:29-30`) mà **0 lần dùng** — có sẵn bậc display mà vùng cần display nhất lại không dùng.

### 4.4 Typography & labels

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| TP-1 | P1 | `index.css:119-129` vs `tokens.css:19` vs `StockDetailPage.css:54` | **3 font stack**; `Inter` **không bao giờ resolve** (không `@font-face`, `index.html` 12 dòng không có link) ⇒ rendering phụ thuộc OS, metric jitter khi đổi máy | Self-host WOFF2 subset, hoặc xoá `Inter` và dùng đúng stack `index.css:120-128` |
| TP-2 | P1 | `packages/web/src` | **300 match `uppercase` / 69 file** (233/61 nếu chỉ tính `.js/.jsx/.ts/.tsx`). Dashboard: 22 lần ở **9px**, 48 lần ở **10px** — **dưới** sàn `--fs-2xs`=11px | Cấm `text-[9px]`/`text-[10px]`; dùng `text-[length:var(--fs-2xs)]` |
| TP-3 | P1 | `Deck.tsx:266,281` · `WhaleAnalyticsTab.jsx:72,87` · `AIAdvisorDeckPanel.jsx:88,201,210` · `OptimizationModal.jsx:75` | **Field label + section title bị uppercase.** `<h4>` 10px uppercase, `<h3>` 12px uppercase ⇒ **heading nhỏ hơn và xấu hơn body**. `text-transform` trên tiếng Việt phá dấu (`Ỗ`,`Ự`,`Ệ` ở 10px + tracking-widest) | Bỏ `uppercase` khỏi mọi heading/label. **Giữ** chỉ cho `<thead><tr>` + eyebrow |
| TP-4 | P2 | `PortfolioHeatmap.js:600-621` | 9px uppercase cho data-field label — đúng vai trò nhưng dưới sàn 11px | Lên `--fs-2xs` |
| TP-5 | P2 | `index.css` | **0 token letter-spacing, 0 token font-weight.** 5 giá trị `tracking-*` rải rác (kể cả 2 giá trị tự chế `tracking-[0.22em]`), 6 bậc weight dùng trong 1 màn | Thêm `--fw-*` (400/500/600/700/800) + `--ls-*` (0.02/0.06em/−0.01em) |
| TP-6 | P3 | `SmartStatsHeader.js:69,80,140` | `leading-none` (1.0) trên label 10px chứa ký tự có dấu (`LÃI/LỖ CHƯA THỰC HIỆN`) | `leading-[1.4]` cho label; giữ `leading-none` cho số |

### 4.5 Alert UX — "pill soup" có con số chính xác

**1 alert item = 8 `<span>` + 1 `<p>`, trong đó 5 pill thật.** 4/9 là **trùng lặp**:

| Trùng | Vị trí A | Vị trí B | Nguồn chung |
|---|---|---|---|
| Giá trị compact | `:323` `` `Giá trị: ${formatVNDCompact(val)}` `` | `:418` `` `· ${formatVNDCompact(alert.value)}` `` | `alert.value` — **trùng 100% ký tự** |
| `formatFullVND` | `:321` `title:` | `:417` `title:` | 2 `title` attr giống hệt |
| Chiều | `:308` `↓ Bán` | `:427` `"Cá mập bán CAR…"` | BE sinh lại trong text |
| Mã | `:413` `CAR` | `:427` `"…CAR…"` | lặp |
| *(ngược lại)* | BE `title` **luôn có** (`serializers.py:31`) | **không render ở đâu** | **mất thông tin** |

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| **AL-1** | **P0** | `UnifiedAlertCenter.js:243,255,261,262,269` | 5 key `t()` **không tồn tại** trong `vi.js`/`en.js`; `createTranslator` (`i18n/index.js:42`) fallback = chuỗi key ⇒ **user thấy literal `alert.showing`, `alert.loadError`, `alert.filteredEmpty`** ở cả 4 empty/error state | Thêm 5 key vào **cả 2** locale. **Bắt buộc**: bỏ mock `LangContext` ở `alert-card-compact.component.test.tsx:6-42`, thay bằng `createTranslator("vi")` thật |
| **AL-2** | **P0** | `DashboardPage.tsx:354-369` | Không truyền `readAlertIds`/`markAlertAsRead` ⇒ `UnifiedAlertCenter.js:101` = tổng số alert, tooltip ghi "**20 chưa đọc**". Hệ quả: `isUnread` luôn true ⇒ nhánh `isRead` (`:29-31`) chết, 0 nút mark-read/mute | (a) Đổi nhãn badge về "tổng số", bỏ `unreadTooltip`; (b) Truyền state thật từ `useAlertCenterActions.ts` |
| **AL-3** | **P0** | `formatMarket.js:56,59,61,63` | `formatTimeAgo` hardcode 4 chuỗi VI ("Vừa xong"/"X phút trước"/…). Comment `:51-52` tự thừa nhận "Không i18n" | Chuyển sang `Intl.RelativeTimeFormat` đã có sẵn ở `alertCenterFormat.ts:88-98`; thêm file vào scope `check:i18n-hardcoded` |
| **AL-4** | **P0** | `useRealtimeFeedCore.js:264-279` | `normalizeDarkFlowAlert` **không đọc `severity`/`body`** dù BE broadcast gửi (`broadcasting.py:79,83`) ⇒ item dark-flow: severity `undefined` → **không vào pill nào**, viền xám, **không dòng mô tả**, nhãn sai **"Hệ thống"** | Thêm `severity`/`body`/`value`/`direction`/`session_date` vào normalizer |
| AL-5 | P1 | `alertDedup.js:19-25` | Sort **chỉ theo `triggered_at`**, không severity, không value. "3-5 quan trọng nhất" **chưa có sẵn** | Thêm `SEV_RANK={critical:0,high:1,medium:2,low:3}` + `topAlerts(alerts, 5)` = severity → `|value|` desc → ts desc. Tái dùng comparator `AlertCenterPage.tsx:278-280` (đang viết lần 2) |
| AL-6 | P1 | `DashboardPage.tsx:262-268` + `UnifiedAlertCenter.js:106,114-123` | **Lọc 2 lần**: page lọc trước, component lọc lại. `severityCounts` đếm trên data **đã lọc** ⇒ bấm "Cao" thì `Tất cả (1)` thay vì `(20)`, 4 pill kia về `(0)` | Bỏ filter ở page, truyền `mergedAlerts` thẳng |
| AL-7 | P1 | `UnifiedAlertCenter.js:105-112` | `sourceFilter` không ai truyền ⇒ luôn `"all"`, `setSourceFilter`=undefined ⇒ nhánh `:108-110` + nút "Xóa bộ lọc" reset 1/2 | Nối UI thật (`FilterBar.tsx:56-63` đã có 6 family) hoặc xoá |
| AL-8 | P1 | `UnifiedAlertCenter.js:16-25` | Map chỉ 5 family; BE trả **8** (`serializers.py:44-55`) ⇒ `signal`/`ai_alert`/`ai_suggest` render **literal** | Dùng `t('alertCenter.fam*')` — `vi.js:6303-6308` đã có đủ 8; `AlertCard.tsx:62-69` đã làm đúng |
| AL-9 | P1 | `UnifiedAlertCenter.js:427` | Render `body\|\|message\|\|summary`; `message` **không tồn tại** trong BE; BE `summary = body` (`serializers.py:57-61`) ⇒ luôn trùng | Dùng `isDuplicateSummary` (`alertCenterFormat.ts:113-117` đã có sẵn, `AlertCard.tsx:171` dùng) |
| AL-10 | P1 | `DashboardPage.tsx:272-273` | Lọc `severity==="warning"`/`"info"` — **không tồn tại** trong domain (`models.py:24-28` chỉ có `critical\|high\|medium\|low`) ⇒ 2 nhánh luôn 0 | Sửa thành `medium`/`low` hoặc xoá |
| AL-11 | P2 | `UnifiedAlertCenter.js:71-91,98` + import `:8` | 12 prop + 1 `useState` + 1 import **không dùng** (`minHeightClass="min-h-[580px]"` trông như đang ép chiều cao — **thực tế không**) | Xoá |
| AL-12 | P2 | `DashboardPage.tsx:270-275,356` | `alertSummary` tính mỗi rồi **component không đọc** (`showSummaryChips` hardcode `false`) | Xoá hoặc nối thật |

**Fix "pill soup" — markup thay cho 4 pill (giữ 2 badge như bạn đề xuất):**

```
Row 1:  CAR  [Cá mập]  [↓ Bán]                    ← 2 badge
                                                    (bỏ span "· 1,3 tỷ ₫" ở :416)
Row 2:  title hoặc summary, truncate 1 dòng
Row 3:  25/09/2026 · Tin cậy 95%                    ← typography, KHÔNG border/bg
Cột phải:  1,3 tỷ ₫ (bold, tabular-nums) + 14:32:58
```

| Hạng mục | Hiện tại | Đề xuất |
|---|---|---|
| Badge padding | `px-2 py-0.5` | `px-1.5 py-px` (cao **19px**, −2) |
| Body | `text-xs leading-relaxed` (19,5px) | `text-[11px] leading-snug truncate` (15,1px) |
| Dòng meta | 4 chip wrap 2 hàng = **52px** | 1 dòng typography = **22,5px** |
| **TỔNG item** | **130,5px** | **~93px** |
| **20 item scrollHeight** | **2762px** | **2012px** |
| Số item hiện được | 3–4 | **5–6** |

Pagination (53px) **xoá hẳn** — đã có "Xem tất cả". Curation `TOP_N=5` ⇒ 5×93 = 465px ≈ vừa `clientHeight` ⇒ **scroll biến mất** ⇒ lane hạ được `clamp` xuống `clamp(400px,…,560px)`.

> **3 test khóa cứng 20 phải sửa:** `alert-list-20repro.component.test.tsx:40`, `tests/visual/dashboard-alert-probe.spec.ts:100,133`. Đây là **đổi hợp đồng test, không phải sửa để xanh** — phải ghi rõ trong commit body.

### 4.6 Data visualization — Treemap

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| **DV-1** | **P0** | `PortfolioHeatmap.js:216,303,309` | `borderColor:"#0f172a"` — **cùng màu nền panel** ⇒ viền 1,00:1 = không tồn tại. Ô vs nền **1,45–2,50:1** → fail **WCAG 1.4.11** (≥3:1) ở **5/5 stop**. **Đây mới là "chìm vào background"** | `borderColor:"#64748b"`, `borderWidth:1`, `gapWidth:1` (đo **3,75:1** ✓). Giữ `HEAT_ZERO_BORDER #eab308` (`borderWidth:1.5`) |
| **DV-2** | **P0** | `PortfolioHeatmap.js:96-107` | Ngưỡng pixel 44×28/56×40 **không bao giờ chạy** — ECharts không truyền `rect`. Runtime chỉ có `share≥1%`/`≥3%` ⇒ ở 1280px chart 375×489 với ~50 ô, ô 20×15px vẫn bị gán `showPct` ⇒ **chữ tràn** | Dùng `series.labelLayout` callback (có `rect` thật) |
| **DV-3** | **P0** | `PortfolioHeatmap.js:50-61` | Contrast 2 stop liền kề **1,23/1,03/1,31/1,28**. Ramp **gần như chỉ đổi hue, không đổi lightness** ⇒ không phân biệt được độ lớn. *(**CHƯA XÁC MINH**: bản thảo từng nói "đã thử giải ramp trong khoảng lum thỏa AA-chữ + 1.4.11-tile, khoảng chỉ rộng 1,45:1" — con số 1,45 trùng đúng với min contrast ô-vs-nền của DV-1 và **không kèm script/bảng nào chứng minh**. Cần tự chạy lại trước khi dùng làm căn cứ.)* Dù kết luận có đúng hay không, **bắt buộc thêm kênh dự phòng** | (a) viền (DV-1) · (b) **luôn** render `%` mọi ô đủ chỗ (DV-2) — `%` là kênh chính · (c) bảng dữ liệu ẩn-giờ |
| **DV-4** | **P0** | `PortfolioHeatmap.js:27-33` | Mô phỏng deuteranopia (Machado 2009, severity 1.0): cặp −7%/−3% → **1,30:1** (`#7f1d1d`→`#534a19`, `#5b2228`→`#3d3927`; ΔE-RGB 31, cả hai ra nâu-ô-liu). Raw chưa mô phỏng: 1,23:1. ~8% nam giới khó phân biệt mức độ trong nhóm đỏ | Giữ quy ước HOSE (khớp phần còn lại app). Kênh dự phòng như DV-3. **Đổi hue phía giảm sang đỏ-cam/amber là quyết định sản phẩm — cần owner chấp thuận**, không tự sửa. *Lưu ý: repo **không có** script Machado nào (`git grep -i machado\|deuteran\|protan packages/web` = 0 hit) ⇒ số này do auditor tự tính, cần verify lại trước khi dùng làm căn cứ quyết định* |
| **DV-5** | **P0** | `PortfolioHeatmap.js:188-204` | `Khác` chiếm **70,6%** diện tích khi H=5/N=40 vì size **bịa** `avgValue×0.3`. Click chỉ toggle mở rộng, **không có drawer** | `DashboardPage.tsx:213-222` chỉ truyền holdings thật; phần non-holding tách toggle riêng, hoặc `sizeValue = marketCap` |
| DV-6 | P1 | `PortfolioHeatmap.js:51` + `heatmap-scale.component.test.ts:11-14` | `clamp(±7)` ⇒ mọi biến động vượt ±7% (rất phổ biến ở HOSE) gộp về **đúng một màu biên** ⇒ mất toàn bộ thông tin vùng đuôi. Test **khẳng định đây là hành vi đúng** | Clamp động theo P95 của data thay vì hằng số |
| DV-7 | P1 | `PortfolioHeatmap.js:568` + `index.css:711-718` | Legend gradient 5 stop đều 0/25/50/75/100% nhưng ramp nội suy trên 4 đoạn **không đều** (4/3/3/4pp) ⇒ **trục lệch 0,5pp** | Offset tường minh `0%, 28.57%, 50%, 71.43%, 100%` |
| DV-8 | P1 | `PortfolioHeatmap.js:279-291` | Tooltip chỉ 2 dòng. **25 i18n key giàu đã có sẵn, 0 usage**. 6 chuỗi VI hardcode + 4 `toLocaleString("vi-VN")` | Nối 25 key: giá hiện tại, tỷ trọng %, khối lượng, biến động bq, xu hướng 24h, ngành, "mở chi tiết" |
| DV-9 | P1 | `PortfolioHeatmap.js:549-559` | Container chart **không role, không tên, không tabIndex**; `AriaComponent` **chưa** `use()` (`:18`); `nodeClick:false` (`:296`) ⇒ **50+ điểm dữ liệu, 0 bàn phím, 0 screen-reader** | `use([...,AriaComponent])`; `role="img"` + `aria-label`; bảng `<table>` ẩn-giờ |
| DV-10 | P1 | `PortfolioHeatmap.js:577-625` | 49 dòng dialog **không bao giờ mở**; `fetchTrendData` + `renderSparkline` + `getVolatilityLabel` unreachable; API `getStockChartHistory` **không bao giờ chạy** | Xoá, hoặc nối vào click ô thay `navigate` |
| DV-11 | P2 | `PortfolioHeatmap.js:320-321,360-361` | `textBorderWidth:2` @ `fontSize:11` = 18% chiều cao glyph mỗi phía; halo-vs-fill chỉ 1,71:1 ⇒ vệt nhoè gần như vô hình nhưng vẫn làm nhòe | Sau DV-1/DV-3 xong → `textBorderWidth: 0` |
| DV-12 | P2 | `PortfolioHeatmap.js:143-152` | 6 prop mỗi cái xuất hiện **đúng 1 lần** = dòng destructure. `onSelectSymbol` unreachable (`:444` navigate thay) | Nối lại hoặc bỏ khỏi API |
| DV-13 | P2 | `PortfolioHeatmap.js:143-152` | `textOnHeat` ngưỡng `lum>0.35` → lum cao nhất palette = 0,0973 ⇒ **nhánh tối không bao giờ chạy**; test `:34-36` bảo vệ code chết | Xoá nhánh + test |
| DV-14 | P2 | `index.css:613-642` | `.echarts-tooltip-dark` 30 dòng — **0 consumer** (tooltip style bằng object JS tại `:261-271`) | Xoá |
| DV-15 | P2 | `index.css:646-650` | `--heat-up-strong`… 5 token — **0 consumer**. Palette thật là `HEAT_STOPS` tối hơn nhiều. **2 tuyên bố thương hiệu mâu thuẫn về cùng 1 chart** | Xoá hoặc dùng làm nguồn duy nhất |
| DV-16 | P2 | `theme/tokens.css:69` | Light mode set `--bg-panel-soft:#f8fafc` nhưng `HEAT_STOPS` hardcode không đổi, không có rule `.heatmap-legend` light ⇒ ramp tối trên card gần trắng | Bảng `HEAT_STOPS_LIGHT` hoặc ghi rõ giới hạn |

### 4.7 Empty state & trung thực dữ liệu

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| ES-1 | **P0** | `AIAdvisorAlertPanel.js:76-83` | `lastScanAt = Date.now()` khi API không trả ⇒ hiển thị "**Lần quét gần nhất 22:20**" = **số bịa** | Khi không có `last_scan_at` ⇒ hiện `—` hoặc "Chưa có lượt quét" |
| ES-2 | P0 | `vi.js:2433` | `"· 0 tín hiệu"` **nằm cứng trong chuỗi dịch** ⇒ không bao giờ phản ánh số thật | Tách thành tham số `{count}` |
| ES-3 | P1 | `AIAdvisorAlertPanel.js:198` | Nút "**Chạy phân tích**" gọi `fetchFeed` — **y hệt** nút refresh `:147`. Nhãn hứa 1 hành động, code làm hành động khác | Đổi nhãn thành "Quét lại", hoặc nối API phân tích thật |
| ES-4 | P1 | `AIAdvisorAlertPanel.js:176-204` | Không giải thích **tại sao** empty. Mẫu đúng đã có: `AIAdvisorDeckPanel.jsx:122-124` `aiNoAnalyticsHelp` | Thêm câu giải thích điều kiện, dùng lại pattern có sẵn |
| ES-5 | P1 | `WhaleAnalyticsTab.jsx:180-185` | Badge "**Dữ liệu Realtime**" + "Xác thực SSOT" render **vô điều kiện**, trong khi component có nhánh `isStale:170` / `isDegraded:175` ngay phía trên | Chỉ render khi `!isStale && !isDegraded` |
| ES-6 | P1 | `WhaleAnalyticsTab.jsx:180-185` ×2 | Badge "Xác thực SSOT" — **claim không kiểm chứng được** từ UI | Bỏ hoặc thay bằng nguồn dữ liệu thật |

### 4.8 Accessibility

**Đếm trên 4 file dashboard, 19 element tương tác:** 0 `tabIndex` · 0 `onKeyDown` · 0 `aria-live` · 0 `role="alert"/"status"/"dialog"` · 4 toggle thiếu `aria-pressed` · 1 container chart không role/tên/bàn phím · 2 `<label>` không gắn · 1 modal không semantics.

| ID | Mức | Vị trí | Thiếu | Fix |
|---|---|---|---|---|
| **AC-1** | **P0** | `PortfolioHeatmap.js:549-559` | Toàn bộ chart (xem DV-9) | `AriaComponent` + `role="img"` + bảng ẩn-giờ |
| AC-2 | **P0** | `AIAdvisorAlertPanel.js` | 0 `aria-live` toàn file. Poll 10s trả tín hiệu mà screen reader **không thông báo** | `<div aria-live="polite" aria-busy={loading}>` quanh list `:206-265`; error banner `role="alert"` |
| AC-3 | P0 | `OptimizationModal.jsx:24` | **0** `role`/`aria-*`/`onKeyDown`/Escape/focus trap/focus restore. Keyboard user **không thoát được** nếu không Tab tới nút | `role="dialog" aria-modal="true"`, focus vào nút đóng, Escape → `onClose`, trap focus |
| AC-4 | P1 | `WhaleAnalyticsTab.jsx:72-79, 87-94` | 2 `<label>` không `htmlFor`, `<select>` không `id` ⇒ **"combo box, unlabelled"** | `id` + `htmlFor` |
| AC-5 | P1 | `PortfolioHeatmap.js:473-529` | 4 toggle không `role="group"`, không `aria-pressed` — trạng thái **chỉ bằng màu** (1.4.1) | **Mẫu đúng đã có sẵn cùng dashboard**: `UnifiedAlertCenter.js:215` `role:"group"` + `:230` `aria-pressed`. Sao y hệt |
| AC-6 | ~~P1~~ → **P3** | `SmartStatsHeader.css:93-97` | ~~Focus ring vô hiệu~~ **SAI** — xem KH-2, đây là dead CSS chứ không phải WCAG bug | Đã xoá cùng Wave 0.5 |
| AC-7 | P2 | `AIAdvisorAlertPanel.js:186-194` | Nút `disabled:true` vĩnh viễn + `title:"Sắp có"` | `aria-disabled="true"` + text giải thích, hoặc bỏ |
| AC-8 | P2 | `AIAdvisorDeckPanel.jsx:132` | Trạng thái "AI" chỉ bằng chấm xanh `animate-pulse` | `<span className="sr-only">` hoặc `aria-label` |
| AC-9 | P2 | Toàn dashboard | `animate-pulse` ×4 + `animate-fade-in` + `transition duration-1000` mà **0** `@media (prefers-reduced-motion)` trong `index.css` (chỉ có trong SOC/StockDetail/Watchlist) | Thêm block ở `index.css` |
| AC-10 | P2 | `AIAdvisorDeckPanel.jsx:94-102` | SVG donut health score không `role="img"`/`<title>` | Thêm (số có lặp ở `:104` nên nhẹ) |
| AC-11 | P2 | `WhaleAnalyticsTab.jsx:118-123` | Thanh strength không `role="progressbar"`/`aria-valuenow` | Thêm (số lặp ở `:124` nên nhẹ) |
| AC-12 | P2 | `lucide-icon.tsx:68` | Không `aria-hidden` cho icon trang trí | Thêm |

**Mẫu ĐÚNG đã có sẵn trong cùng feature** (dùng làm chuẩn, không phải phát minh mới): `SmartStatsHeader.js:148-149` (`role:"img"` + `aria-label` tính động) · `UnifiedAlertCenter.js:215,230` (`role:"group"` + `aria-pressed`) · `PortfolioHeatmap.js:566-572` (legend `role="img"` + `aria-label`).

### 4.9 Responsive

| Viewport | Sidebar | Content | Grid | Chart px | **Tỉ lệ khung** |
|---|---|---|---|---|---|
| 1900 | 288 | **1280 (trần)** | 3 cột | 519 × 629 | **0,83:1 dọc** |
| 1280 | 288 | 944 | 3 cột | 375 × 489 | 0,77:1 |
| 1024 | 288 | 688 | **1 cột** | 672 × 489 | **1,37:1 ngang** |
| 768 | off-canvas | 720 | 1 cột | 704 × 489 | **1,44:1 ngang** |

| ID | Mức | Thực tế | Fix |
|---|---|---|---|
| RS-1 | P1 | **Tỉ lệ khung đảo chiều giữa 1024px và 1900px** mà không có re-layout nào. Squarify trên khung 0,83:1 sinh ô rộng-rất-thấp ở hàng cuối — đúng những ô "VNZ +1.76%", "CMF +4.38%" trong screenshot | `aspect-ratio` lock hoặc `min-height` theo lane |
| RS-2 | P1 | `index.css:454,463` dùng `1279px`/`1099px` — **không khớp bậc Tailwind nào**. 0 container query toàn repo | Đồng bộ hoặc chuyển container query (IA-4) |
| RS-3 | P2 | `index.css:500-506` `.panel-head` không `flex-wrap`, `PortfolioHeatmap.js:471` nhồi 2 nhóm toggle + nút expand. <640px còn ~180px cho tiêu đề ⇒ truncate, control không wrap | `flex-wrap` + 1 toggle group thay 2 |
| RS-4 | P3 | `components/dashboard/**` dùng `sm:`×6, `md:`×3, `lg:`×1; **`xl:`=0, `2xl:`=0** | Không phải vấn đề — nhưng nghĩa là **thiết kế desktop-wide chưa từng được xử lý** |

### 4.10 Performance

**Đo bằng `node scripts/measure-route-graph.mjs DashboardPage` (build `dist/assets/*` mtime 2026-09-26 23:47:06; HEAD `686cff45` commit 23:48:18 chỉ đụng `docs/CLAIMS.md` ⇒ dist tương đương HEAD về source):**

| Route | Chunk | Tổng raw | echarts trong tải đầu |
|---|---|---|---|
| `DashboardPage` | 15 | **1828,7 KB** | **623,0 KB** = **34,1%** |
| `ShellDashboardPage` | 15 | 1296,3 KB | 0 |

| ID | Mức | Vị trí | Thực tế | Fix |
|---|---|---|---|---|
| PF-1 | **P0** | `PortfolioHeatmap.js:8-11` | `echarts` import **tĩnh** ⇒ 623 KB không lazy được. `vite.config.ts:61,72-84` đã **tự ghi nhận** việc tách chunk không ngăn tải | `React.lazy` + dynamic import tách khỏi chunk dashboard |
| PF-2 | P1 | `PortfolioHeatmap.js:251,554,555` | `option` là object mới mỗi 10s ⇒ `PureComponent` shallow compare fail ⇒ `setOption({notMerge:true, lazyUpdate:false})` = **vứt toàn bộ cây option**, chạy lại squarify, đo lại mọi label, vẽ lại, **đồng bộ trên main thread**. `core.js:59` còn gọi `resize()` ở **mọi** `componentDidUpdate` ⇒ thêm 1 relayout | `notMerge:false` khi shape không đổi · debounce option · bỏ resize thừa |
| PF-3 | P2 | `PortfolioHeatmap.js:207` + `:319` | `heatColorContinuous` bị gọi **2× mỗi node** (dựng + callback `color` mỗi lần layout) | Cache `labelColor` vào data, callback đọc cache |
| PF-4 | — | — | ECharts dispose **đúng** (`core.js:62-63,109`) ⇒ **không rò rỉ** | ✅ không cần làm gì |
| PF-5 | — | `package.json:104` | `vninvestcharts-widget` **không liên quan** — 2 consumer, không export treemap, 0 lazy chunk trong graph dashboard | ✅ |

---

## §5. DESIGN SYSTEM GAP REPORT

### 5.1 Không có design system thật — có 4 bộ cạnh tranh

| Bộ | Quy mô | Vấn đề |
|---|---|---|
| `components/ui/` (shadcn) | 30 file | **22/30 có 0 consumer**. Dashboard dùng **0** |
| `theme/theme.module.css` | 383 dòng, đủ 15 nhóm component | **100% chết**. 1 consumer giả: `WorkstationShell.tsx:32` `void theme; // né gate grep` |
| `soc/soc.components.css` | 3482 dòng, **384 class** | **Bộ đầy đủ nhất repo** — có sẵn `metricCard`/`metricValue`/`emptyState`/`tabBar`/`pagination`/`statusBadge`/`skeleton`/`socDataTable`… nhưng **khu trú SOC** |
| `index.css` + `@theme` | 720 dòng | Token gốc, nhưng 16 hard-hex ngoài allowlist |

**Hệ quả**: cùng một khái niệm "card", "metric", "empty state", "tab", "skeleton" được implement **4 lần khác nhau**. Đó là gốc rễ cảm giác "chưa thống nhất" mà bạn mô tả.

### 5.2 P0: 3 hệ token cùng tên, giá trị khác nhau, 1 hệ trong lazy chunk

`theme/tokens.css:1-16` và `soc/soc.tokens.css:5-16` cùng khai 5 token, giá trị mâu thuẫn. Đo trong build: chunk SOC là **lazy chunk 71 KB**, `:root` của nó **không nằm trong `@layer` nào** (unlayered) ⇒ thắng `@theme` của Tailwind, và được inject **sau** chunk chính.

| Token | Trước khi vào `/soc` | Sau khi vào `/soc` |
|---|---|---|
| `--accent-cyan` | `#06b6d4` | **`#22d3ee`** |
| `--text-muted` | `#64748b` | **`#94a3b8`** |
| `--border-default` | `#1e293b` đặc | **`rgba(80,120,168,.15)`** |
| `--bg-panel` | `#0f172a` đặc | **`rgba(8,23,52,.4)`** |
| `--fs-xs` | `.75rem` | **`.68rem`** |
| `--shadow-sm/md` | — | **đổi hoàn toàn** |

⇒ **Điều hướng tới SOC rồi quay lại dashboard ⇒ mọi màu accent, muted, độ đục viền, cỡ chữ nhỏ của cả app đổi theo thứ tự điều hướng.** Đây cũng là nguồn gốc của cảm giác "palette không nhất quán".

**Fix:** gộp về `theme/tokens.css` làm SSOT. Xoá block `:root` ở `soc.tokens.css:5-78, 81-130`, chỉ giữ 24 `--soc-c-*`/`--soc-rgb-*` **có tiền tố**. Thêm gate chặn trùng tên.

### 5.3 P0: Light mode vỡ ở tầng gốc

`main.tsx:206-210` set `data-theme="light"` lên `<html>`, nhưng `index.css:131-135` `body { background: var(--color-bg-primary) }` = `#020617`, và **không tồn tại bất kỳ rule `[data-theme="light"] body`** nào trong toàn bộ 19 file CSS. Light override chỉ phủ token *alias*, không phủ `--color-bg-*`/`--color-text-*`.

Minh hoạ rõ nhất: `ui/dropdown-menu.tsx:40,57` dùng `bg-slate-900 text-slate-100` **không có `dark:` prefix** ⇒ chọn light, mở menu avatar → **menu tối trên trang sáng**. 26 chỗ Radix portal cùng tình trạng.

**Fix** — thêm vào `tokens.css`:
```css
:root[data-theme="light"] {
  --color-bg-primary: #f8fafc;  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f1f5f9;  --color-bg-panel: #ffffff;
  --color-text-primary: #0f172a;   --color-text-secondary: #475569;
  --color-text-muted: #64748b;
  --color-border-primary: #e2e8f0; --color-border-secondary: #cbd5e1;
  --shadow-sm: 0 1px 2px 0 rgb(15 23 42 / 0.06);
  --shadow-md: 0 4px 6px -1px rgb(15 23 42 / 0.08);
}
```

### 5.4 P0: Cảm giác "neon" không phải do palette — do **14 class màu cho 3 ý nghĩa**

Trong `components/dashboard/**` riêng:

| Ý nghĩa | Số dạng khác nhau | Ví dụ |
|---|---|---|
| "tăng" | **9** | `text-emerald-400`×37, `bg-emerald-500/600/400`, `border-emerald-500/800/900`, `ring-emerald-400/500`, `from-emerald-500` |
| "giảm" | **9** | `text-rose-400`×22, `text-red-400/300`, `bg-rose-500`, `bg-red-500`, `border-red-500/900`… |
| "cảnh báo" | **4** | amber / yellow / orange |

`UnifiedAlertCenter.js:125-166` dùng **6 họ màu** cho 5 mức severity — `critical`→red, `high`→orange, `medium`→yellow: **3 hue khác nhau cho 3 mức liên tiếp** ⇒ không phân biệt được critical với high.

`UnifiedAlertCenter.js:447,466` có **4 bản pagination button** tự viết, chỉ khác màu. `ui/button.tsx` đã có đủ 4 state.

**Đánh giá palette bạn đề xuất** (đã đo contrast trên nền `#080E1D`):

| Token | Hex | Contrast trên `#080E1D` | WCAG | Đánh giá |
|---|---|---|---|---|
| Primary | `#16C7D9` | ~8,3:1 | AAA | ✅ Tốt, hợp hệ cyan hiện tại |
| Positive | `#22B573` | **7,26:1** | **AAA** | ✅ Giảm chroma so với `#34d399` |
| Negative | `#E05252` | **5,04:1** | **AA** | ✅ Ổn cho text thường |
| Warning | `#D99A28` | **7,89:1** | **AAA** | ✅ |
| Background | `#080E1D` | — | — | ✅ Tối hơn `#020617`, ít "thụt" hơn |
| Surface | `#10182B` | — | — | ⚠ contrast vs bg chỉ ~1,15:1 ⇒ **cần viền** |
| Surface elev. | `#151F34` | — | — | ⚠ tương tự |

⇒ **Palette bạn đề xuất tốt hơn palette hiện tại** ở chỗ giảm chroma (bỏ "neon") mà vẫn giữ đủ contrast. Nhưng 2 điểm cần lưu ý: (1) `Surface`/`Surface elevated` tách quá ít contrast với `Background` ⇒ phải dựa vào **viền**, đúng cái bạn muốn giảm — cân nhắc thay bằng **1 token viền duy nhất** thay vì 3 tầng nền; (2) **chỉ áp dụng sau khi hợp nhất token** (5.2), nếu không sẽ thành hệ token thứ 5.

**Fix:** 4 tone thay 6 hue, phân biệt mức bằng weight/opacity chứ không bằng hue:
```css
--color-pos: #22B573;  --color-pos-soft: #22B5731f;
--color-neg: #E05252;  --color-neg-soft: #E052521f;
--color-warn: #D99A28; --color-warn-soft: #D99A281f;
--color-neu: #94A3B8;
```
```js
const severityTone = { all:"info", critical:"danger", high:"danger", medium:"warning", low:"muted" };
```

### 5.5 Token inventory & drift

**48 token `--color-*`:** 11 token **0 consume** (23%), 19 token chỉ 1–2 lần (40%). **7/11 bậc `primary-50…950` không dùng gì** — palette "chính" thực tế chỉ có `primary-300/400/500`.

**Token mâu thuẫn khác tên:**

| Tên | `index.css` | `tokens.css` | Lệch |
|---|---|---|---|
| sm | `--radius-sm: .25rem` (4px) | `--r-sm: 6px` | **2px** |
| md | `.375rem` (6px) | `--r-md: 8px` | **2px** |
| lg | `.5rem` (8px) | `--r-lg: 12px` | **4px** |
| xl | `.75rem` (12px) | `--r-lg: 12px` | trùng tên khác họ |
| pill | `9999px` | `999px` | — |

**Radius thực tế:** 9 Tailwind class (609 lần) + **44 giá trị raw CSS distinct** (325 lần) → 19 giá trị px khác nhau. Không có token nào là SSOT.

**Padding:** 4 mật độ cho cùng một loại "card": `ui/card.tsx` **24px** · `soc.components.css` 12/16/20 · `ShellPageTemplate` **28px** · `index.css:609` 20px.

**Button height:** `ui/button.tsx` 36/40/44/48 (4 bậc) — dashboard tự viết thêm `py-1`, `py-1.5`×2, `py-2`, `px-2.5 py-1.5` ⇒ **7 chiều cao**.

**Icon size:** 10 kích cỡ đo được. `LucideIcon` dùng 3 kích cỡ khác nhau (14/16/20px) không nhất quán.

**Thiếu token:** `--fw-*` (0 token, 6 bậc weight rải rác) · `--ls-*` (0 token, 5 giá trị tracking) · `--icon-*` · `--size-control-*`.

### 5.6 Gate bảo vệ design system là giả

| Gate | Đang kiểm | Lỗ hổng |
|---|---|---|
| `check:tokens` | 72 hex allowlist | **`roots` không gồm `src/index.css`** ⇒ 720 dòng CSS gốc không bao giờ được scan. **`continue` mọi file `tokens.css`** ⇒ bỏ qua `soc.tokens.css` (57 token) + `tokens.css`. **Chỉ đọc `.css`/`.module.css`, không đọc `.js/.jsx/.tsx`** ⇒ 35 hex trong `PortfolioHeatmap.js` vô hình. Allowlist còn chứa 7 màu neon (`#22d3ee`, `#ec4899`, `#f43f5e`, `#a855f7`…) |
| `check:contrast` | **7 cặp tone admin** | **0 cặp nào thuộc dashboard**. Palette treemap 5 stop không ai biết tồn tại |
| `check:i18n-hardcoded` | 19 file, 5 path | Không quét `UnifiedAlertCenter.js`, `SmartStatsHeader.js`, `PortfolioHeatmap.js`, `CoreDashboardPositionDeck.tsx`, `AIAdvisorAlertPanel.js`. Chạy thử trên `src/components/dashboard` ⇒ **exit 1, `TOTAL_HARDCODED_VI=23`** |
| `check:shell` | 7 sub-gate | PASS trong khi 4 P0 ở trên tồn tại |
| `check:dom-landmarks` | static scan | Tự khai runtime DOM "planned at P4" |

**Đo tay số vi phạm ẩn trong `index.css`:** 16 hex ngoài allowlist (`#2a3550`×7, `#7f1d1d`, `#166534`, `#14532d`, `#5b2228`, `#2f3747`, `#fb7185`, `#8a94a6`, `#364760`, `#eab308`).

### 5.7 Component cần thêm cho dashboard chuyên nghiệp

Đã có sẵn trong `soc.components.css` nhưng **dashboard không dùng**: `metricCard`/`metricValue`/`metricLabel`/`metricGrid`/`kpiBadge` · `emptyState`/`emptyStateIcon` · `tabBar`/`tabButton`/`tabCountBadge`/`subTabBar` · `filterBtn`/`filterBtnActive` · `pagination`/`pageBtn` · `statusBadge` (6 variant) · `statusDot` · `socDataTable`/`kvTable`/`diffTable` · `skeleton` + 6 biến thể · `actionBtn`/`actionBtnPrimary`/ghost/Danger.

**Còn thiếu thật sự:**

| Component | API sketch | Vì sao |
|---|---|---|
| `SegmentedControl` | `<SegmentedControl value onChange options={[{value,label,icon?}]} size />` | 6 nơi tự viết pill/tab bar (IA-3) |
| `KpiTile` | `<KpiTile label value delta={1.4} tone="pos" />` | Thay SmartStatsHeader hardcode; đã có `metricCard` trong SOC |
| `AlertItem` | `<AlertItem symbol family side value confidence sessionDate onClick />` | Hợp nhất 15/15 fact đang render 2 markup (4.5) |
| `EmptyState` | `<EmptyState variant="loading\|error\|filtered\|empty" title hint action />` | 4 empty state viết tay lệch nhau + 6 hệ skeleton |
| `DataTable` | wrapper cho `ui/table.tsx` + pagination + 2 hàng filter | 3 nơi tự viết `<table>` |
| `Tooltip` | dùng `ui/tooltip.tsx` — **nhưng cần `TooltipProvider` trong app** | Treemap/tooltip hiện không hover được bằng bàn phím |

---

## §6. REFACTORING ROADMAP

Nguyên tắc: **mỗi wave phải để lại app xanh hơn, không để lại "chờ refactor"**. Mỗi wave 1 PR, khai claim theo `docs/AGENT_PROTOCOL.md`.

### Wave 0 — Bỏ điểm chết (chặn mọi thứ khác) · ~1 ngày

| # | Việc | File | Gate |
|---|---|---|---|
| 0.1 | ⏸ **CHỜ OWNER** — gỡ trần 1280px | `index.css:109`, `FullLayout.tsx:95` | `--layout-content-max-width` dùng bởi wrapper **toàn app**, không riêng dashboard. Blast radius mọi màn hình + cần owner trả lời §8-Q2. Xem `gates-wave0.md` §2 |
| ~~0.2~~ | ✅ **DONE** (PR #25) — `height: auto; min-height:360px; max-height:720px` + `align-items:start` | `index.css` `.dashboard-triad-lane`, `.dashboard-triad-grid` | `align-items:start` **bắt buộc**: mặc định `stretch` kéo lane ngắn bằng chiều cao lane cao nhất, tái tạo đúng khoảng trống cần xoá |
| ~~0.3~~ | ✅ **DONE** (PR #25) — bỏ sàn `min-height` lồng | `index.css` `.dashboard-full-width-deck`, `Deck.tsx:305` | `min-h-[400px]`→`min-h-[280px]` |
| ~~0.4~~ | ✅ **DONE** (PR #25) — gỡ `dashboard-full-width-deck` ở 2 chỗ lồng | `Deck.tsx:236`, `WhaleAnalyticsTab.jsx:67` | Giữ class ở `DashboardPage.tsx:415` |
| ~~0.5~~ | ✅ **DONE** (PR #25) — xoá 3 rule CSS chết | `SmartStatsHeader.css` | ⚠ **KH-2 trong report SAI** (P0 WCAG → P3 dead CSS). Xem `gates-wave0.md` §5 |
| ~~0.6~~ | ✅ **DONE** (PR #25) — 5 i18n key + bỏ mock che lỗi | `vi.js`, `en.js`, `alert-card-compact.component.test.tsx` | Có **negative test**: xoá key ⇒ test đỏ |
| ~~0.7a~~ | ✅ **DONE** (PR #24) — xoá 2 file chết thật (427 dòng) | `PortfolioHeatmap (1).js`, `SmartStatsHeader (1).js` | |
| ~~0.8~~ | ❌ **BỎ — đề xuất sai** | ~~`app/navigationCatalog.js`~~ | File **KHÔNG chết**: là public subpath trong `package.json`, và `check-shell.mjs:26,70` dùng nó để assert route id. Xoá ⇒ vỡ `check:shell`. Bug thật phát hiện: **gate validate catalog A, UI render catalog B** (shape khác nhau) ⇒ menu user bấm không được gate nào bảo vệ. `gates-wave0.md` §2 |
| ~~0.9~~ | ✅ **DONE** (PR #25) — xoá dead CSS | `index.css` | `.glass` · `.agentic-glow-cyan` · `.bento-card-hover` · `.focus-visible-ring` · rule rỗng `.core-dashboard-slot--deck` + sửa 1 comment sai |

> 🔴 **KHÔNG xoá `FactsFirstModularPositionDeck.jsx` ở Wave 0.** File này **có importer**: `FactsFirstModularPositionDeck.js:5` + re-export `components/dashboard/index.js:2`. Xoá mà không gỡ bridge ⇒ `tsc` vỡ. Chuyển sang **Wave 4.x**: gỡ 2 export trước, xoá file sau. (`DashboardPage.tsx:419` đang dùng `CoreDashboardPositionDeck.tsx` chứ không dùng bản `.jsx` ⇒ xoá được sau khi gỡ export.)

**Trạng thái Wave 0**: 0.2–0.7a + 0.9 **xong**; 0.1 **chờ owner**; 0.8 **bỏ vì sai**.
**Sau Wave 0**: ước lượng thu hồi **~304px ngang** (chỉ khi 0.1 được duyệt) + **~300px dọc** trên viewport 1920×1080.
**⏳ Visual QA 3 viewport CHƯA CHẠY** — 0.2/0.2b/0.3/0.4 đều là thay đổi layout bằng mắt. Phải chụp 1920×1080 / 1440×900 / 1280×800 trước khi coi là xong.

### Wave 1 — Sửa nói dối dữ liệu (P0 nghiêm trọng nhất về niềm tin) · ~2 ngày

| # | Việc | File |
|---|---|---|
| 1.1 | `normalizeDarkFlowAlert` đọc `severity`/`body`/`value`/`direction`/`session_date` | `useRealtimeFeedCore.js:264-279` |
| 1.2 | `lastScanAt` không bịa: không có `last_scan_at` ⇒ hiện `—` | `AIAdvisorAlertPanel.js:76-83` |
| 1.3 | `"0 tín hiệu"` thành tham số | `vi.js:2433`, `en.js` |
| 1.4 | Nút "Chạy phân tích" → đúng nhãn hoặc nối API thật | `AIAdvisorAlertPanel.js:198` |
| 1.5 | Badge "Realtime"/"SSOT" chỉ khi `!isStale && !isDegraded` | `WhaleAnalyticsTab.jsx:180-185` |
| 1.6 | `isStale` dùng `as_of` thay vì `updated_at` không tồn tại; `updatedLabel` hiện `—` | `SmartStatsHeader.js:19-21,40-41` |
| 1.7 | Fix `total_market_value` string ⇒ mất `đ` + CTA chết | `SmartStatsHeader.js:27,38,74` |
| 1.8 | Badge alert: đổi nghĩa từ "chưa đọc" → "tổng số" | `UnifiedAlertCenter.js:101,190` |
| 1.9 | Dữ liệu thật cho 4 KPI risk (**ticket BE riêng**, file 2780 dòng, đang có agent khác sửa) | `portfolio_analytics_views.py:238-244` |
| 1.10 | `formatTimeAgo` → `Intl.RelativeTimeFormat` | `formatMarket.js:53-64` |

### Wave 2 — Alert UX: chấm dứt "pill soup" + curation · ~2 ngày

| # | Việc |
|---|---|
| 2.1 | `topAlerts(alerts, 5)` = severity → `|value|` → ts (lift comparator từ `AlertCenterPage.tsx:278-280`) |
| 2.2 | Markup mới: 2 badge + 2 dòng typography (spec ở §4.5) — 130,5px → ~93px |
| 2.3 | Bỏ filter trùng ở `DashboardPage.tsx:262-268`; `severityCounts` tính trên data chưa lọc |
| 2.4 | Nối `readAlertIds`/`markAlertAsRead` → badge + 2 nút action sống lại |
| 2.5 | Xoá pagination (53px), thêm link "Xem thêm N cảnh báo →" |
| 2.6 | Dùng `alertCenter.fam*` (8 key sẵn có) thay map 5 key |
| 2.7 | Render `title` + `isDuplicateSummary` + `freshness_state` |
| 2.8 | Xoá 12 prop chết, `alertSummary` chết, 2 nhánh severity không tồn tại |
| 2.9 | **Sửa 3 test khóa 20** (`alert-list-20repro:40`, `dashboard-alert-probe:100,133`) — ghi lý do vào commit body |

### Wave 3 — Treemap: contrast + kênh dự phòng + tooltip · ~2 ngày

| # | Việc |
|---|---|
| 3.1 | Viền ô `#64748b` 1px (3,75:1) — fix WCAG 1.4.11 5/5 stop |
| 3.2 | `series.labelLayout` theo pixel thật — luôn render `%` mọi ô đủ chỗ |
| 3.3 | Clamp động theo P95 thay vì ±7% hằng số |
| 3.4 | `Khác` chỉ gom holdings thật; phần non-holding tách toggle "mã theo dõi" |
| 3.5 | Drawer 40 mã (thay dialog 49 dòng chết) |
| 3.6 | Nối 25 key tooltip + bảng dữ liều ẩn-giờ + `AriaComponent` + `role="img"` |
| 3.7 | Legend offset `0/28.57/50/71.43/100%` |

### Wave 4 — Design system: token SSOT + light mode · ~3 ngày

| # | Việc |
|---|---|
| 4.1 | Hợp nhất `theme/tokens.css` ↔ `soc.tokens.css` (xoá block `:root` SOC) + gate chặn trùng tên |
| 4.2 | Thêm `:root[data-theme="light"]` override `--color-bg-*`/`--color-text-*` ở tầng `body` |
| 4.3 | Thêm `--color-pos/neg/warn/neu` (4 tone) + remap 14 class màu dashboard |
| 4.4 | Radius: 1 họ 6 bậc, codemod 44 giá trị raw → 6 |
| 4.5 | Thêm `--fw-*`, `--ls-*`, `--icon-*`, `--size-control-*`; cấm `text-[Npx]` dưới 11px |
| 4.6 | Chọn 1 bộ component: `ui/` (sửa 22 chết) hoặc `soc.components.css` (đã đầy đủ nhất). **Xoá `theme.module.css`** 383 dòng |
| 4.7 | 6 hệ skeleton → 1 (`ShellSkeleton.tsx`, 12 consumer) |

### Wave 5 — Gate thật (chặn tái phát) · ~2 ngày

| # | Gate | Rule |
|---|---|---|
| 5.1 | `check-tokens.mjs` | Thêm `src/index.css` vào `roots`; bỏ `continue tokens.css`; đọc `.js/.jsx/.ts/.tsx`; cắt allowlist 72→12. **Kỳ vọng đỏ ~400-600 — cần biết số trước khi lập kế hoạch** |
| 5.2 | `check:contrast` | Nhận danh sách cặp từ file thay vì hardcode 7 cặp admin; thêm palette heatmap |
| 5.3 | `check:i18n-hardcoded` | Thêm `src/components/dashboard` + `src/utils` vào scope |
| 5.4 | `check-no-arbitrary-size` | Fail nếu còn `text-[Npx]`/`h-[Npx]`/`p-[Npx]` dưới ngưỡng |
| 5.5 | `check-interactive-states` | Mỗi `<button>`/`<a>` không `disabled` phải có `focus-visible:`. Chạy report mode trước để lấy baseline |
| 5.6 | `check-light-mode` | Fail nếu `var(--color-bg-primary)` không có block light tương ứng |
| 5.7 | Fix lint rule `jsx-no-literals` | Đang bắt `className` thay vì text node ⇒ **tín hiệu = 0** nên 23 chuỗi VI sống sót. **Đây là nguyên nhân gốc khiến i18n gate vô dụng** |

### Wave 6 — IA + performance · ~3 ngày

| # | Việc |
|---|---|
| 6.1 | `SLOTS` registry có priority (thay 6 slot JSX cứng) |
| 6.2 | Lazy-load ECharts — giảm 623 KB khỏi tải đầu dashboard |
| 6.3 | `notMerge:false` khi shape không đổi + debounce option + bỏ resize thừa |
| 6.4 | Tách `TabBar`/`FilterBar`/`SegmentedControl` dùng chung (6 nơi) |
| 6.5 | Breadcrumb qua `t()` |
| 6.6 | Container query thay 2 media query lệch |

### Thứ tự đề xuất

```
Wave 0 (1d)  → Wave 1 (2d) → Wave 2 (2d) → Wave 3 (2d) → Wave 5 (2d) → Wave 4 (3d) → Wave 6 (3d)
  bỏ chết         nói thật     alert        treemap      gate thật      design sys     IA + perf
```
**Wave 5 (gate) nên lên sớm hơn** sau Wave 2 — vì hiện tại mọi thay đổi ở Wave 2-4 đều không có gate bảo vệ, và chính điều đó đã để 427 dòng file chết trùng tên tồn tại.

---

## §7. GATE ĐÃ CHẠY (thật)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Type-check | `npx tsc --noEmit` | ✅ **exit 0**, 0 lỗi |
| Shell gate | `npm run check:shell` | ✅ **PASS** cả 7 sub-gate |
| Token gate | `npm run check:tokens` | ✅ PASS — **nhưng xem §5.6, gate không scan `index.css`/`.js`/`tokens.css`** |
| Contrast gate | `npm run check:contrast` | ✅ PASS — **chỉ 7 cặp admin, 0 cặp dashboard** |
| i18n hardcode (gate hiện hành) | `npm run check:i18n-hardcoded` | ⚠ **không gate dashboard** (chỉ 5 path) |
| i18n hardcode (chạy thử trên scope) | `node scripts/check-i18n-hardcoded.mjs src/components/dashboard` | ❌ **exit 1, `TOTAL_HARDCODED_VI=23`** |
| Lint | `npx eslint src/components/dashboard src/pages/DashboardPage.tsx` | ✅ 0 error / 474 warning — **warning phần lớn là `jsx-no-literals` gắn nhầm vào `className`** (xem 5.7) |
| Bundle | `node scripts/measure-route-graph.mjs DashboardPage` | 15 chunk / 1828,7 KB, echarts 623,0 KB |
| `npm run build` | — | **CHƯA CHẠY** |
| `npm run test:components` (vitest) | — | **CHƯA CHẠY** |
| BE test | — | **CHƯA CHẠY** (cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`) |

**Ghi chú quan trọng**: `check:shell` PASS trong khi 4 P0 ở trên tồn tại. Lý do đo được: `check:contrast` không biết palette treemap tồn tại · `check:tokens` không đọc `.js` cũng không đọc `index.css` · `check:i18n-hardcoded` không quét 5 file dashboard · `check:dom-landmarks` tự khai runtime check "planned".

---

## §8. CÂU HỎI CẦN OWNER QUYẾT

| # | Câu hỏi | Chặn cái gì |
|---|---|---|
| **1** | **Màu phía giảm trên treemap**: giữ đỏ thuần (quy ước HOSE, khớp phần còn lại app) hay đổi sang đỏ-cam/amber để mù màu đọc được? Số đo deuteranopia ở DV-4 | Wave 3.3 |
| **2** | **Trần 1280px**: cố ý giới hạn dashboard không rộng hơn 1280? Nếu **có** thì ở 1900px treemap 535px là đúng ý đồ và phải sống với nó; nếu **không** thì 304px đang lãng phí | Wave 0.1 |
| **3** | **Lane full-height là cố ý?** Nếu full-height để 3 lane thẳng hàng thì phải sửa theo hướng *fill bằng nội dung thật* thay vì *co lane* | Wave 0.2 |
| **4** | **`--dash-chrome: 320px`** — số đo thật hay ước lượng? Không ai set | Wave 0.2 |
| **5** | **Sửa 1.4.11**: nâng cả ramp vào khoảng lum thỏa đồng thời (tốn công, và DV-3 chứng minh **không đủ**) hay chỉ đổi viền (rẻ, đạt 3,75:1, giải đúng triệu chứng)? | Wave 3.1 |
| **6** | **Chọn 1 bộ component**: `ui/` (shadcn, nhưng 22/30 chết) hay `soc.components.css` (đã đầy đủ nhất, 384 class)? | Wave 4.6 |
| **7** | **Palette** bạn đề xuất — áp **sau** khi hợp nhất token (tránh thành hệ thứ 5), hay áp luôn? Lưu ý `Surface`/`Surface elevated` tách quá ít contrast với `Background` | Wave 4.3 |
| **8** | **Badge "20"** — ý đồ gốc là *số chưa đọc* hay *tổng số*? Đỏ + tooltip "chưa đọc" là thông tin sai | Wave 1.8 |
| **9** | **Severity chỉ hiện bằng viền trái 4px** (dashboard) vs **có chữ** (Alert Center) — cố ý hay sót? Không có legend ở đâu | Wave 2 |
| **10** | **Trần `cardCount===20` trong 3 test** — xác nhận đây là đổi hợp đồng chứ không phải test cần giữ? | Wave 2.9 |
| **11** | **`file nào sở hữu `portfolio_analytics_views.py`** (2780 dòng, đang có agent khác sửa)? Wave 1.9 cần khai claim trước | Wave 1.9 |
| **12** | **`ShellDashboardPage` xoá hẳn hay giữ?** Chưa kiểm `tests/`, `e2e/`, `docs/` | Wave 0 |

---

## PHỤ LỤC — Đính chính trung thực

### Đợt 2 — Kiểm chứng độc lập (3 auditor, `edit: deny`) @ `686cff45`

Bản thảo đầu do **5 agent viết song song, không ai kiểm chéo ai**. Đã chạy Stage 2 của protocol: 3 auditor độc lập đi ngược từng claim. Báo cáo đầy đủ: **`docs/AUDIT_UIUX_VERIFY_20260926.md`**.

**Verdict: `NEED_REVISION`** — không lật ngược nội dung nào, nhưng có:

- 🔴 **1 lỗi làm hỏng build**: Wave 0.7 ghi "xoá 852 dòng / 3 file" gồm `FactsFirstModularPositionDeck.jsx` — file này **có importer** (`FactsFirstModularPositionDeck.js:5` + `index.js:2`). Xoá mà không gỡ bridge ⇒ `tsc` vỡ. **Đã tách thành 0.7a (427 dòng, an toàn) + 4.x.**
- 🔴 **2 con số không tái lập được**: DV-4 deuteranopia `1,00:1` → thực **1,30:1** (Machado 2009 sev 1.0); DV-3 "khoảng lum 1,45:1" → không kèm script, trùng số của DV-1 ⇒ nghi chép nhầm. **Đã gỡ/đánh dấu CHƯA XÁC MINH.**
- 🟠 **§0 dòng 15** gán `304px/15,8%` cho màn 1900px — số đó của **1920px**; 1900px là 284px/14,9%, 2560px là 944px/36,9%. **Đã sửa** (nằm ở phần owner đọc đầu tiên).
- 🟠 **§0 dòng 17**: khối deck là **≈545px** không phải 456px (thiếu ~87px 2 hàng toolbar) — nặng hơn, không nhẹ hơn. **Đã sửa.**
- 🟠 **§0 dòng 16**: "1080p ⇒ 720px cố định" sai — clamp chỉ chạm 720 khi `100dvh ≥ 1040`. **Đã sửa.**
- 🟠 **5 con số sai**: 31→**61** chỗ vi-VN · 390/103→**300/69** `uppercase` · 9/9/4→**26/20/24** class màu · `--fs-3xl/4xl` "0 dùng"→**1 dùng mỗi token** · 16→**25** hex vi phạm trong `index.css`.
- 🟡 **C24 REFUTED**: "mojibake" là **artifact đọc file qua console cp1252**, file thật sạch UTF-8. **Đã gỡ.**

**18/18 dải contrast khớp tuyệt đối** khi auditor chạy lại script WCAG độc lập (7,13–12,32 · 1,45–2,50 · 1,23/1,03/1,31/1,28 · palette owner 7,26/5,04/7,89). Mô hình chiều cao alert khớp tuyệt đối (130,50px · 2762px). 3 claim mạnh nhất đều **đứng vững**: C15/C16 (`params.rect` ECharts không truyền) · C21 (dialog 49 dòng không bao giờ mở) · A4 (token SOC trong lazy chunk).

> **Bài học quy trình (đáng ghi vào `AGENTS.md`):** ① Dùng `Read` tool (UTF-8) cho file tiếng Việt, **không** dùng `Get-Content` — nếu không sẽ tạo "citation đúng dòng nhưng sai nội dung", đúng biến thể của xung đột #4 trong `AGENT_PROTOCOL.md` §1. ② **Citation đúng dòng ≠ claim đúng**: 0/29 citation sai dòng nhưng 3/24 claim sai về nội dung — chỉ kiểm citation sẽ bỏ sót toàn bộ.

### Đợt 1 — Đính chính của agent viết

Agent dataviz **đã tự đính chính 1 lần trong quá trình audit**: lần tính WCAG đầu tiên chạy inline `node -e` trong PowerShell bị bóp méo chuỗi, in ra `1.00:1 – 1.50:1`, suýt kết luận "chữ fail AA". Kiểm chéo bằng file riêng cho kết quả **7,13:1 – 12,32:1 = AAA**. Báo cáo này dùng số đã verify lại 3 lần (kể cả tay tính). **Đây cũng chính là bài học Entry 232/233 của repo: gate PASS trên máy agent không đại diện cho máy khác, và output script cũng phải kiểm chéo.**

**Điều CHƯA xác minh trong báo cáo này:**
- Số px render thật của 1 alert item và deck (tính từ class + CSS, chưa đo trong browser)
- **Bảng "Chart px" ở §4.9** (519×629, 375×489, 672×489, 704×489) — ECharts quyết định lúc runtime, **chưa đo trong browser** ⇒ số này *suy ra từ CSS*, không phải đo thật
- **Bảng "Trước / Sau khi vào `/soc`" ở §5.2** — cần load route rồi đọc `getComputedStyle`. Token trong file thì khớp, nhưng **hiệu ứng runtime chưa đo** ⇒ nên verify bằng browser trước khi Wave 4.1 sửa
- File chết: đã kiểm `src/` + `tests/` + `e2e/` + `docs/` — 2 file `(1)` **0 importer** ✅; `FactsFirstModularPositionDeck.jsx` **CÓ importer** ⇒ không phải file chết
- Contrast thực tế trên màn hình thật (do mô phỏng WCAG, không đo pixel)
- Chưa chụp screenshot trước/sau — **Wave 0-3 cần visual QA 3 viewport để chốt**
- `vitest` / `build` / BE test: **CHƯA CHẠY**
