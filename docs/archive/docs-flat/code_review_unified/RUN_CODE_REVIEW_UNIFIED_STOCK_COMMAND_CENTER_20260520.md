# RUN CODE REVIEW — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## Mục đích

Checklist này dành cho **reviewer** khi review PR của từng slice. Reviewer phải PASS toàn bộ items liên quan đến slice đó trước khi approve.

---

## Checklist tổng quát (mọi PR)

### A. Immutable source protection
- [ ] `git diff` xác nhận `WhaleBubbleChart.jsx` không đổi.
- [ ] `git diff` xác nhận `WhaleAnalyticsTab.jsx` không đổi.
- [ ] `git diff` xác nhận `ModularPositionDeck.jsx` không đổi.
- [ ] `git diff` xác nhận `KLineChartPanel.jsx` không đổi (hoặc chỉ có thêm prop handler).
- [ ] `git diff` xác nhận `OrderFlowRadarPanel.jsx` không đổi.
- [ ] `git diff` xác nhận `AIAdvisorAlertPanel.jsx` không đổi.

### B. Backend impact
- [ ] Không có file mới trong `backend/` ngoài README/docs.
- [ ] Không có file migration mới.
- [ ] Không có thay đổi trong `urls.py` (ngoài trường hợp redirect ở S5 nếu dùng Django).

### C. State architecture
- [ ] `selectedTradeDate` là state của `StockDetailUnifiedPage`, không bị duplicate ở các component con.
- [ ] Không có local session state trong `AnalyticsTabDeck`.
- [ ] `handleKlineSessionChange` được truyền đúng vào `KLineChartPanel` qua prop `onSessionChange`.

### D. Performance
- [ ] `KLineChartPanel` không nằm trong điều kiện render (`{activeTab === x && <KLine>}`) — phải luôn mounted.
- [ ] Tab content dùng `display: none` khi không active, không unmount.
- [ ] Không có data fetch không cần thiết khi switch tab (kiểm tra useEffect dependencies).

### E. i18n
- [ ] Tất cả text mới trong JSX dùng `t('commandCenter.*')`.
- [ ] Keys đã được thêm vào tất cả locale files.
- [ ] Không có text tiếng Việt hardcode trong JSX/JSS.

### F. CSS/Styling
- [ ] Không có inline style cho layout values cố định.
- [ ] Sử dụng CSS custom properties cho màu sắc.
- [ ] Responsive breakpoints được xử lý (ít nhất 1280px và 1440px).

---

## Checklist theo từng slice

### Slice S1 — Layout Skeleton
- [ ] CSS Grid 2 cột hoạt động đúng.
- [ ] KLine nằm trong left column, sidebar nằm trong right column.
- [ ] Sidebar toggle hoạt động với animation.
- [ ] Breadcrumb đúng: `RADAR THỊ TRƯỜNG / STOCK WORKSPACE / :symbol`.

### Slice S2 — TabDeck Shell
- [ ] `AnalyticsTabDeck.jsx` là component mới, không phải copy-paste từ nơi khác.
- [ ] `activeTab` state là local trong `AnalyticsTabDeck`.
- [ ] Animation CSS được define đúng.
- [ ] i18n keys cho 3 tab đã có.

### Slice S3 — Tab Cá Mập
- [ ] `FactsFirstWhaleBubbleChart` nhận `selectedTradeDate` từ props.
- [ ] Hook `useWhaleAnalyticsData` được tái sử dụng, không tạo hook mới.
- [ ] Loading/error state được xử lý.

### Slice S4 — Tab OrderFlow + AI
- [ ] `OrderFlowRadarPanel` được lazy mount.
- [ ] `AIAdvisoryPanel` nhận `selectedTradeDate` từ props.
- [ ] Skeleton được hiển thị khi AI data đang load.

### Slice S5 — Redirect
- [ ] Redirect route được đặt trước route `/stocks/:symbol` trong router config.
- [ ] `WhaleAlertsShellHost.jsx` không còn render `WhaleAlertsDashboard` trực tiếp.
