# ADR — Blocking lane giữ phiên mới nhất (không theo selectedSession)

- **Date**: 2026-11-21 · **Slice**: S2 (quyết định thay vì sửa bừa, theo PLAN).
- **Ngữ cảnh**: `useStockDetailPageModel.js:116-168` (blocking lane: `getStockOverview`,
  `getStockOrderFlow`, `getSessionFactsCvd`, `getWhaleAnalyticsSnapshot`) chạy theo
  `[env, symbol, activeTimeframe]`, không deps `selectedSession`; deferred lane
  (`:172-218`) đã lọc `session_date` cho whale feed + advisory.
- **Quyết định**: GIỮ NGUYÊN blocking lane (luôn phiên mới nhất, realtime).
  Nhu cầu "xem phiên được click" do bubble (S1, `?trade_date=`) + whale feed +
  advisory (deferred lane, `session_date`) phục vụ — đủ đóng bug user báo.
- **Lý do**:
  1. `getStockOrderFlow` BE chưa rõ có hỗ trợ `session_date` lịch sử không (chỉ
     forward params, chưa verify contract) — đụng vào là mở rộng scope + rủi ro.
  2. Refetch cả lane realtime mỗi lần click nến gây churn + flash overlay cá voi
     trên chart chính, trong khi chart chính phải ở "hiện tại".
  3. Giới hạn 3 vòng sửa/slice: lane thứ 3 cho session-scoped snapshot là ticket riêng.
- **Gap tồn dư đã biết (không giấu)**: khi chọn phiên quá khứ, overlay cá voi trên
  widget (`mappedWhaleOrders` từ `orderFlowData.whale_orders`,
  `VNStockChartPanel.js:325-342`) và panel orderFlow trong `StockContextDeck` vẫn ở
  phiên mới nhất. Nếu owner muốn đồng bộ toàn phần → ticket follow-up: verify BE
  `order-flow` có `session_date` rồi mới đưa vào lane.
- **Ngữ nghĩa timeframe (F-06, chốt)**: click nến luôn resolve về `tradeDate` (ngày);
  bubble giữ timeframe selector riêng (mặc định `session`). Không đồng bộ timeframe
  2 chart trong ticket này.
