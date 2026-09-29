# TECH SPEC — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Layout Grid Specification

### 1.1 CSS Grid tổng thể

```css
/* StockDetailUnifiedPage root layout */
.command-center-layout {
  display: grid;
  grid-template-rows: auto 1fr;   /* TopBar + Main */
  grid-template-columns: 1fr;
  height: 100vh;
  overflow: hidden;
}

.command-center-main {
  display: grid;
  grid-template-columns: 1fr 320px;  /* Main content + Right sidebar */
  grid-template-rows: 1fr;
  overflow: hidden;
  gap: 0;
}

/* Responsive: collapse sidebar */
@media (max-width: 1440px) {
  .command-center-main {
    grid-template-columns: 1fr 0px;  /* sidebar hidden by default */
  }
  .right-sidebar.expanded {
    grid-template-columns: 1fr 300px;
  }
}
```

### 1.2 Left column — KLine + Tabbed Deck

```css
.command-center-left {
  display: grid;
  grid-template-rows: auto 1fr;   /* KLine area + Analytics tab deck */
  overflow: hidden;
}

.kline-workspace {
  flex: 0 0 auto;
  /* KLineChartPanel height: 55vh trên màn hình >= 900px */
  min-height: 420px;
  max-height: 60vh;
}

.analytics-tab-deck {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 260px;
}
```

### 1.3 AnalyticsTabDeck tab bar

```css
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-2);
  gap: 0;
}

.tab-btn {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-blue);
}
```

### 1.4 Tab content animation

```css
.tab-content-panel {
  animation: tabFadeIn 0.18s ease-out;
}

@keyframes tabFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 2. Component Tree

```
StockDetailUnifiedPage
│
├── CommandCenterTopBar
│     props: symbol, liveQuote, watchlistInfo, groupInfo, priceAlerts
│     emits: onToggleWatchlist, onCreateAlert, onSaveToGroup
│
├── div.command-center-main
│     ├── div.command-center-left
│     │     ├── KLineChartPanel
│     │     │     props: symbol, flowData, heatmapData, selectedTradeDate
│     │     │     emits: onSessionChange(tradeDate), onTimeframeChange(tf)
│     │     │
│     │     └── AnalyticsTabDeck
│     │           props: symbol, selectedTradeDate, selectedTimeframe
│     │           │       analyticsData, advisoryData, orderFlowData
│     │           │
│     │           ├── [activeTab="whale"] FactsFirstWhaleBubbleChart
│     │           │     props: symbol, selectedTradeDate, analyticsData
│     │           │
│     │           ├── [activeTab="orderflow"] OrderFlowRadarPanel
│     │           │     props: symbol (uses internal fetch)
│     │           │
│     │           └── [activeTab="advisory"] AIAdvisoryPanel
│     │                 props: symbol, selectedTradeDate, advisoryData
│     │
│     └── div.right-sidebar (collapsible)
│           ├── PriceDepthPanel    (từ StockDetail.jsx — giữ nguyên)
│           └── IntradayMatchedPanel (từ StockDetail.jsx — giữ nguyên)
```

---

## 3. State Contract

### 3.1 Page-level state (StockDetailUnifiedPage)

```js
const [selectedTradeDate, setSelectedTradeDate] = useState(null);
const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
const [liveQuote, setLiveQuote] = useState(null);
// ... các state khác kế thừa từ StockDetail.jsx
```

### 3.2 KLine → Page session handoff

```js
// Trong StockDetailUnifiedPage:
const handleKlineSessionChange = useCallback((tradeDate) => {
  setSelectedTradeDate(tradeDate);
}, []);

// Truyền vào KLineChartPanel:
<KLineChartPanel
  onSessionChange={handleKlineSessionChange}
  onTimeframeChange={setSelectedTimeframe}
  ...
/>
```

### 3.3 AnalyticsTabDeck nhận session

```js
// AnalyticsTabDeck.jsx
function AnalyticsTabDeck({ symbol, selectedTradeDate, selectedTimeframe, ...props }) {
  const [activeTab, setActiveTab] = useState('whale');

  return (
    <div className="analytics-tab-deck">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'whale' && (
        <FactsFirstWhaleBubbleChart
          symbol={symbol}
          selectedTradeDate={selectedTradeDate}
          {...props.analyticsData}
        />
      )}
      {activeTab === 'orderflow' && (
        <OrderFlowRadarPanel symbol={symbol} />
      )}
      {activeTab === 'advisory' && (
        <AIAdvisoryPanel
          symbol={symbol}
          selectedTradeDate={selectedTradeDate}
          {...props.advisoryData}
        />
      )}
    </div>
  );
}
```

---

## 4. i18n Keys

Tất cả text mới phải thêm key vào file i18n tương ứng:

```json
{
  "commandCenter.tab.whale": "🐋 Cá Mập",
  "commandCenter.tab.orderflow": "📊 Order Flow",
  "commandCenter.tab.advisory": "🤖 AI Advisory",
  "commandCenter.sidebar.collapse": "Thu gọn thông tin",
  "commandCenter.sidebar.expand": "Mở rộng thông tin",
  "commandCenter.topbar.follow": "Theo dõi",
  "commandCenter.topbar.unfollow": "Bỏ theo dõi",
  "commandCenter.topbar.saveToGroup": "Lưu vào nhóm",
  "commandCenter.topbar.createAlert": "Tạo cảnh báo"
}
```

---

## 5. Redirect spec

### React Router (trong App.jsx hoặc router config)
```jsx
<Route path="/whale-alerts/:symbol" element={<Navigate to="/stocks/:symbol" replace />} />
```

Hoặc nếu dùng dynamic param:
```jsx
<Route
  path="/whale-alerts/:symbol"
  element={<RedirectToStocks />}
/>

function RedirectToStocks() {
  const { symbol } = useParams();
  return <Navigate to={`/stocks/${symbol}`} replace />;
}
```

---

## 6. Performance constraints

- KLineChartPanel **không được unmount** khi đổi tab.
- Tab content lazy-render: chỉ mount khi tab đó được activate lần đầu, sau đó giữ mount với `display: none` khi không active.
- AnalyticsTabDeck skeleton xuất hiện tức thì khi tab switch, data load async.
- `OrderFlowRadarPanel` và `AIAdvisoryPanel` không block render của KLine.

---

## 7. Breakpoint responsive

| Màn hình | Right Sidebar | Analytics Tab Deck |
|----------|--------------|-------------------|
| ≥ 1440px | Hiển thị mặc định (320px) | Hiển thị đầy đủ |
| 1280–1439px | Collapsed (toggle button) | Hiển thị đầy đủ |
| < 1280px | Ẩn hoàn toàn | Tab scroll ngang |
