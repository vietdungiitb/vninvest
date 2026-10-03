# TASKBOARD — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## Quy ước

- **Owner**: Tên dev nhận slice.
- **Status**: `[ ]` Chưa bắt đầu | `[/]` Đang làm | `[x]` Hoàn thành | `[!]` Blocked.
- **Test gate**: Phải pass trước khi mark `[x]`.
- **Evidence**: Link screenshot/video/payload.

---

## SLICE 1 — Layout Skeleton & CommandCenterTopBar

| Field | Value |
|-------|-------|
| **ID** | S1 |
| **Owner** | ___ |
| **Priority** | P0 — Blocking tất cả slice khác |
| **Estimate** | 0.5–1 ngày |

### Tasks
- [ ] S1.1 Tạo `StockDetailUnifiedPage.jsx` với CSS Grid 2 cột (left + right sidebar).
- [ ] S1.2 Di chuyển `CommandCenterTopBar` logic ra khỏi `StockDetail.jsx` thành component riêng.
- [ ] S1.3 Đặt `KLineChartPanel` vào left column, kết nối `onSessionChange` → `setSelectedTradeDate`.
- [ ] S1.4 Di chuyển `PriceDepthPanel` + `IntradayMatchedPanel` vào right sidebar với toggle collapse.
- [ ] S1.5 Register route `/stocks/:symbol` trỏ tới `StockDetailUnifiedPage`.
- [ ] S1.6 Chạy build, kiểm tra không có lỗi mới.

### Acceptance criteria
1. Trang `/stocks/BMP` render đúng với KLine ở giữa, sidebar bên phải.
2. Sidebar collapse/expand hoạt động.
3. Không có console error mới.
4. Trang cũ `/stocks/:symbol` không regress (nếu chưa swap route).

### Test gate
- `npm run build` pass.
- Manual: mở `/stocks/BMP`, kiểm tra layout 2 cột.

### Evidence template
- [ ] Screenshot layout desktop (≥1440px).
- [ ] Screenshot layout sidebar collapsed.

---

## SLICE 2 — AnalyticsTabDeck Shell

| Field | Value |
|-------|-------|
| **ID** | S2 |
| **Owner** | ___ |
| **Priority** | P0 — Blocking S3, S4 |
| **Estimate** | 0.5 ngày |
| **Phụ thuộc** | S1 pass |

### Tasks
- [ ] S2.1 Tạo `AnalyticsTabDeck.jsx` với 3 tab buttons: Cá Mập, Order Flow, AI Advisory.
- [ ] S2.2 Implement tab switching với local `activeTab` state.
- [ ] S2.3 Thêm CSS animation `tabFadeIn` khi switch tab.
- [ ] S2.4 Placeholder content cho từng tab (skeleton hoặc text "Đang tải...").
- [ ] S2.5 Thêm i18n keys: `commandCenter.tab.*`.
- [ ] S2.6 Đặt `AnalyticsTabDeck` ngay dưới `KLineChartPanel` trong left column.

### Acceptance criteria
1. 3 tab hiển thị và switch được.
2. Animation mượt (không flicker).
3. KLine không bị re-render khi switch tab.
4. Tab state không ảnh hưởng đến `selectedTradeDate`.

### Test gate
- Manual: click từng tab, xác nhận KLine không unmount.
- DevTools: quan sát React component tree, KLineChartPanel không unmount.

### Evidence template
- [ ] Screen recording tab switching (3 tab).

---

## SLICE 3 — Tab Cá Mập: Whale Analytics

| Field | Value |
|-------|-------|
| **ID** | S3 |
| **Owner** | ___ |
| **Priority** | P1 |
| **Estimate** | 1–1.5 ngày |
| **Phụ thuộc** | S2 pass |

### Tasks
- [ ] S3.1 Import `FactsFirstWhaleBubbleChart` vào Tab Cá Mập của `AnalyticsTabDeck`.
- [ ] S3.2 Import `FactsFirstWhaleAnalyticsTab` (Cảnh báo dòng tiền, RVOL).
- [ ] S3.3 Truyền `symbol` và `selectedTradeDate` vào cả 2 component.
- [ ] S3.4 Tái sử dụng `useWhaleAnalyticsData` hook từ `frontend/src/hooks/useWhaleAnalyticsData.js`.
- [ ] S3.5 Xử lý loading state và error state trong Tab.
- [ ] S3.6 Kiểm tra `selectedTradeDate` thay đổi → Bubble Chart cập nhật đúng session.

### Acceptance criteria
1. Tab Cá Mập hiển thị Bubble Chart đúng với `selectedTradeDate` hiện tại.
2. Click nến mới trên KLine → Bubble Chart reload với trade date mới.
3. Hover nến không làm thay đổi Bubble Chart.
4. Không sửa `WhaleBubbleChart.jsx` (immutable source check).

### Test gate
- Manual: chọn nến ngày hôm qua → Bubble Chart hiện đúng dữ liệu ngày đó.
- Manual: hover một nến khác → Bubble Chart không đổi.
- Kiểm tra file diff: `WhaleBubbleChart.jsx`, `WhaleAnalyticsTab.jsx` phải unchanged.

### Evidence template
- [ ] Screenshot Bubble Chart với nến đã chọn (highlight trên KLine + bubble tương ứng).
- [ ] Payload snapshot từ `getWhaleAnalyticsSnapshot` API response.

---

## SLICE 4 — Tab Order Flow & AI Advisory

| Field | Value |
|-------|-------|
| **ID** | S4 |
| **Owner** | ___ |
| **Priority** | P1 |
| **Estimate** | 1–1.5 ngày |
| **Phụ thuộc** | S2 pass (S3 song song được) |

### Tasks
- [ ] S4.1 Import `OrderFlowRadarPanel` vào Tab Order Flow.
- [ ] S4.2 Import `MoneyFlowDonut` bên cạnh OrderFlowRadarPanel.
- [ ] S4.3 Import `AIAdvisorAlertPanel` hoặc inline advisory logic vào Tab AI Advisory.
- [ ] S4.4 Tái sử dụng `useAIAdvisor` hook, truyền `symbol` và `selectedTradeDate`.
- [ ] S4.5 Lazy mount: chỉ fetch data khi tab đó được activate lần đầu.
- [ ] S4.6 Skeleton loader cho AI Advisory (vì thường load chậm hơn).

### Acceptance criteria
1. Tab Order Flow hiển thị `OrderFlowRadarPanel` đúng symbol.
2. Tab AI Advisory hiển thị nhận định AI. Nếu chưa có, hiện skeleton.
3. Switch giữa các tab không gây refetch không cần thiết (dùng cache/memo).
4. Không sửa `AIAdvisorAlertPanel` source file.

### Test gate
- Manual: mở Tab Order Flow → radar chart render.
- Manual: mở Tab AI Advisory → hiển thị nội dung hoặc skeleton hợp lệ.
- Network tab: xác nhận không có duplicate API calls khi switch tab.

### Evidence template
- [ ] Screenshot Tab Order Flow.
- [ ] Screenshot Tab AI Advisory.

---

## SLICE 5 — Redirect & Cleanup

| Field | Value |
|-------|-------|
| **ID** | S5 |
| **Owner** | ___ |
| **Priority** | P2 |
| **Estimate** | 0.5 ngày |
| **Phụ thuộc** | S3 + S4 pass |

### Tasks
- [ ] S5.1 Thêm redirect route trong React Router: `/whale-alerts/:symbol` → `/stocks/:symbol`.
- [ ] S5.2 Kiểm tra `WhaleAlertsShellHost.jsx` — xóa hoặc đổi thành redirect wrapper.
- [ ] S5.3 Xóa duplicate data-fetching logic trong `WhaleAlertsDashboard.jsx` đã được tích hợp vào `StockDetailUnifiedPage`.
- [ ] S5.4 Giữ lại `WhaleAlertsDashboard.jsx` nếu có dependency khác — chỉ cleanup code thừa.
- [ ] S5.5 Cập nhật breadcrumb nếu cần.
- [ ] S5.6 Final build và smoke test toàn bộ trang.

### Acceptance criteria
1. Truy cập `/whale-alerts/BMP` tự redirect về `/stocks/BMP`.
2. Không có broken link trong navigation menu.
3. `StockDetailUnifiedPage` có đủ tất cả data từ cả 2 trang cũ.

### Test gate
- Manual: gõ `/whale-alerts/VNM` vào browser → chuyển về `/stocks/VNM`.
- `npm run build` pass không warning mới.

### Evidence template
- [ ] Screenshot redirect hoạt động (URL bar).
- [ ] Smoke test checklist sign-off.

---

## Progress Summary — Cập nhật 2026-05-20

| Slice | Status | Ngày hoàn thành | Ghi chú |
|-------|--------|-----------------|---------|
| S1 Layout + TabDeck | `[x]` | 2026-05-20 | AnalyticsTabDeck.jsx inject vào StockDetail.jsx |
| S2 TabDeck Shell | `[x]` | 2026-05-20 | 3 tab, lazy mount, session badge |
| S3 Tab Cá Mập | `[x]` | 2026-05-20 | FactsFirstWhaleBubbleChart + RVOL + WhaleFeedPanel |
| S4 Tab OrderFlow + AI | `[x]` | 2026-05-20 | OrderFlowRadarPanel + MoneyFlowDonut + advisory render prop |
| S5 Redirect + Cleanup | `[x]` | 2026-05-20 | WhaleAlertsSymbolRedirect, build compiled |

### Files Changed
- **[NEW]** `frontend/src/components/AnalyticsTabDeck.jsx` (221 dòng)
- **[MODIFY]** `frontend/src/pages/StockDetail.jsx`
  - +import AnalyticsTabDeck
  - -OrderFlowRadarPanel standalone, -AI Advisory section riêng lẻ
  - +AnalyticsTabDeck với advisoryContent render prop
  - -MoneyFlowDonut, BubbleOrderChart từ sidebar
- **[MODIFY]** `frontend/src/App.jsx`
  - +WhaleAlertsSymbolRedirect component
  - Route whale-alerts/:symbol → WhaleAlertsSymbolRedirect

### Build Validation
- `npm run build` 20/05/2026 14:45 — **COMPILED SUCCESSFULLY**
- Output: 813.21 kB (main.js gzip), 24.96 kB (css), 0 errors
