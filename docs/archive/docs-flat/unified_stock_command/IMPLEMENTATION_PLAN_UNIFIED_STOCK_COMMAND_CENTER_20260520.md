# IMPLEMENTATION PLAN — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Bối cảnh

Hiện tại, người dùng phải duy trì 2 tab browser song song:
- `/stocks/:symbol` — thông tin giá, sổ lệnh, AI Advisory, chart cơ bản.
- `/whale-alerts/:symbol` — Whale Analytics, Bubble Chart, dòng tiền thông minh.

Cả hai trang đều render `KLineChartPanel` riêng lẻ → trùng lặp, tốn tài nguyên, gây context-switching. Bộ nhớ workspace cá mập không được đồng bộ với chart đang chọn ở trang kia.

---

## 2. Giải pháp kỹ thuật

### 2.1 Kiến trúc tổng quan

```
StockDetailUnifiedPage (mới)
├── CommandCenterTopBar          ← NEW wrapper (tổng hợp price + actions)
├── [CSS Grid: main 2 cột]
│   ├── LEFT COLUMN (flex-grow)
│   │   ├── KLineChartPanel       ← giữ nguyên, single source of truth
│   │   │     └── pane CVD + pane Strength (cùng trục X)
│   │   └── AnalyticsTabDeck      ← NEW component
│   │         ├── Tab "🐋 Cá Mập": FactsFirstWhaleBubbleChart + FlowSummary
│   │         ├── Tab "📊 Order Flow": OrderFlowRadarPanel + MoneyFlowDonut
│   │         └── Tab "🤖 AI Advisory": AIAdvisoryPanel (session-linked)
│   └── RIGHT COLUMN (fixed width ~300-360px, collapsible)
│         ├── PriceDepthPanel      ← từ StockDetail hiện có
│         └── IntradayMatchedPanel ← từ StockDetail hiện có
```

### 2.2 Shared State contract

```js
// Shared qua React Context hoặc prop drilling từ page level:
const sharedState = {
  symbol: string,                    // VD: "BMP"
  selectedTradeDate: string | null,  // ISO date, từ KLine click
  selectedTimeframe: string,         // "1H", "15", v.v.
};
```

- `handleKlineSessionChange(tradeDate)` → cập nhật `selectedTradeDate`.
- Tất cả tab trong `AnalyticsTabDeck` nhận `selectedTradeDate` qua props.
- Hover trên KLine không thay đổi `selectedTradeDate` (rule đã khóa).

### 2.3 Component mới cần tạo

#### `AnalyticsTabDeck.jsx`
```jsx
// Props: symbol, selectedTradeDate, analyticsData, advisoryData, orderFlowData
// Quản lý activeTab state (local)
// Render đúng tab content theo activeTab
// Animate tab switch với CSS transition (opacity + transform)
```

#### `CommandCenterTopBar.jsx`
```jsx
// Tổng hợp từ StockDetail top-bar hiện tại:
// - Symbol header (logo, tên, giá, %, vol)
// - Badge realtime / sector
// - CTA: Bỏ theo dõi, Lưu vào nhóm, Mức giá cảnh báo, Tạo cảnh báo
// - Shortlist badges
```

---

## 3. Lộ trình triển khai (5 Slices)

### Slice 1: Layout Skeleton (S1)
**Mục tiêu:** Dựng CSS Grid mới, di chuyển KLineChartPanel và Right Sidebar vào đúng vị trí.
**File thay đổi:**
- `[NEW] frontend/src/pages/StockDetailUnifiedPage.jsx`
- `[NEW] frontend/src/components/CommandCenterTopBar.jsx`
**Không làm ở slice này:** Tab deck, whale analytics.
**Acceptance:** Build pass. KLine render đúng. Sidebar collapsible hoạt động.

---

### Slice 2: AnalyticsTabDeck Shell (S2)
**Mục tiêu:** Tạo component AnalyticsTabDeck với tab navigation, chưa có nội dung thực.
**File thay đổi:**
- `[NEW] frontend/src/components/AnalyticsTabDeck.jsx`
**Acceptance:** 3 tab render, switching mượt (CSS animation). Tab state local, không break KLine.

---

### Slice 3: Tab Cá Mập — Whale Analytics (S3)
**Mục tiêu:** Chèn `FactsFirstWhaleBubbleChart` và `FactsFirstWhaleAnalyticsTab` vào Tab 1.
**File thay đổi:**
- `AnalyticsTabDeck.jsx` — điền nội dung Tab 1.
**Hook tái sử dụng:** `useWhaleAnalyticsData.js`, `getWhaleAnalyticsSnapshot` từ `client.js`.
**Acceptance:** Tab Cá Mập hiển thị bubble chart đúng session. Click nến KLine → bubble update.

---

### Slice 4: Tab Order Flow & AI Advisory (S4)
**Mục tiêu:** Chèn `OrderFlowRadarPanel` vào Tab 2 và `AIAdvisoryPanel` vào Tab 3.
**File thay đổi:**
- `AnalyticsTabDeck.jsx` — điền nội dung Tab 2, Tab 3.
**Hook tái sử dụng:** `useAIAdvisor.js`, `getStockOrderFlow`, `getStockAIAdvisorySession` từ `client.js`.
**Acceptance:** OrderFlowRadarPanel hiển thị đúng. AI Advisory hiển thị nhận định theo session.

---

### Slice 5: Redirect + Cleanup (S5)
**Mục tiêu:** Redirect `/whale-alerts/:symbol` về `/stocks/:symbol`. Cleanup code cũ trong `WhaleAlertsDashboard.jsx`.
**File thay đổi:**
- `frontend/src/pages/WhaleAlertsShellHost.jsx` hoặc React Router config.
- `frontend/src/App.jsx` (hoặc router root).
**Acceptance:** `/whale-alerts/BMP` chuyển về `/stocks/BMP` đúng. Không có broken link.

---

## 4. Dependency map giữa các slice

```
S1 (Layout) → S2 (Tab Shell) → S3 (Cá Mập) → S4 (OrderFlow + AI) → S5 (Cleanup)
```

Các slice phải chạy tuần tự. Không được bắt đầu S3 khi S2 chưa pass acceptance.

---

## 5. API không thay đổi

Toàn bộ API calls đã có trong `client.js`. Không có backend endpoint mới.
Các hàm tái sử dụng:
- `getWhaleAnalyticsSnapshot(symbol, tradeDate)`
- `getStockAIAdvisorySession(symbol)`
- `getStockOrderFlow(symbol)`
- `getSessionFacts(symbol, tradeDate)` / `getSessionFactsCvd(symbol, tradeDate)`
- `getIntradayMatched(symbol)`, `getDepthChart(symbol)`, `getRVOL(symbol)`

---

## 6. Risk và mitigation

| Risk | Xác suất | Mitigation |
|------|----------|------------|
| KLine re-render khi tab switch | Cao | Giữ KLine outside TabDeck, không unmount khi đổi tab |
| Session sync lag khi tab chưa mount | Trung bình | Lazy mount tab content, defer data fetch khi tab inactive |
| Right sidebar che khuất chart ở màn hình 1366px | Trung bình | Default collapsible ở breakpoint < 1440px |
| AI Advisory load chậm làm chặn UX | Thấp | Render skeleton, load async độc lập |
