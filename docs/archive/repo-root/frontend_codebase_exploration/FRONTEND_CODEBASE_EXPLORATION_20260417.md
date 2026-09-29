# VNInvest Frontend Codebase Exploration
**Date:** April 17, 2026  
**Scope:** Websocket Hook, Realtime Components, ECharts Heatmap Implementation

---

## 1. WEBSOCKET CONNECTION HOOK: `useRealtimeFeedCore.js`

### File Path
[frontend/src/hooks/useRealtimeFeedCore.js](frontend/src/hooks/useRealtimeFeedCore.js)

### Current Implementation Summary
This is the **core websocket feed hook** that manages real-time ticker updates, whale alerts, and dark flow alerts. It implements a **hybrid approach**: primary websocket connection with fallback to REST polling.

### Key State Management
```javascript
// State hooks initialized in hook
const [quotesBySymbol, setQuotesBySymbol] = useState({});           // Store live quotes
const [realtimeStatus, setRealtimeStatus] = useState('idle');       // 'idle', 'connecting', 'live', 'polling'
const [lastEventAt, setLastEventAt] = useState(null);               // ISO timestamp of last event
const [alerts, setAlerts] = useState([]);                           // Whale alerts (max configured)
const [darkFlowAlerts, setDarkFlowAlerts] = useState([]);           // Dark flow alerts
const [eventCounts, setEventCounts] = useState({...});              // Telemetry
const [connectionState, setConnectionState] = useState({...});      // WS connection metadata
const [latencySamplesMs, setLatencySamplesMs] = useState([]);       // P95 latency tracking
```

### Websocket Connection Logic (Lines 650-850)

**Connection Sequence:**
1. **Token Validation** - Checks access token expiration (90s skew)
2. **Websocket Establishment** - Creates new WebSocket connection via `getRealtimeWebSocketUrl(token)`
3. **Event Handlers:**

```javascript
// ON OPEN: Subscribe to symbols
nextWs.onopen = () => {
  wsHealthyRef.current = false;
  setRealtimeStatus('live');
  const symbolsForWs = symbolsRef.current.slice(0, MAX_WS_SUB_SYMBOLS); // Max 50 symbols
  sendAction(nextWs, 'subscribe', symbolsForWs);
};

// ON MESSAGE: Handle four event types
nextWs.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  
  // 1. Event: 'ticker_update' → applyTickerUpdate() → setState(quotesBySymbol)
  if (payload.event_type === 'ticker_update') {
    applyTickerUpdate({
      symbol: payload.symbol,
      price: payload.price,
      change_pct: payload.change_pct,
      volume: payload.volume,
      ts: payload.ts,
    });
    setLastEventAt(payload.ts);
    setRealtimeStatus('live');
    // Track latency: (now - event.ts)
  }
  
  // 2. Event: 'whale_alert' → normalizeAlert() → setAlerts()
  else if (payload.event_type === 'whale_alert') {
    if (!shouldSkipDuplicateEvent(normalizedPayload, 'whale_alert')) {
      applyAlert(normalizedPayload);
    }
  }
  
  // 3. Event: 'dark_flow_alert' → normalizeDarkFlowAlert() → setDarkFlowAlerts()
  else if (payload.event_type === 'dark_flow_alert') {
    if (!shouldSkipDuplicateEvent(normalizedPayload, 'dark_flow_alert')) {
      applyDarkFlowAlert(normalizedPayload);
    }
  }
  
  // 4. Event: 'heartbeat' → update lastEventAt + latency
  else if (payload.event_type === 'heartbeat') {
    setLastEventAt(payload.ts);
    setRealtimeStatus('live');
  }
};

// ON ERROR/CLOSE: Fallback to polling
nextWs.onerror = () => {
  wsHealthyRef.current = false;
  setRealtimeStatus('polling');  // Switch to REST polling fallback
};
```

### Quote Merge Logic (Lines 46-87)
```javascript
function mergeQuote(prev, update) {
  // Validates: current_price, prev_price, change_pct, volume
  // Tracks: freshness_seconds, age_seconds, stale flag
  // Returns merged quote object with normalized timestamps
}
```

### Polling Fallback (Lines 450-600)
When WS fails or unhealthy, triggers REST polling via `getRealtimeTickers(batch)`:
- **Batch size:** 16 symbols (8 if WS healthy, 16 if recovery mode)
- **Intervals:** 15s (default) → 8s (recovery) → 3s (stale recovery)
- **Rate limiting:** Exponential backoff on 429 errors
- **Deduplication:** 1s window for event ID deduplication

### Key Configuration Constants
```javascript
const STALE_RESYNC_RETRY_MS = 3000;                    // Retry stale quotes every 3s
const POLL_BATCH_SIZE = 16;                           // Normal polling batch
const WS_HEALTHY_POLL_BATCH_SIZE = 8;                 // Reduced when WS active
const WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS = 8000;    // Recovery interval
const MAX_WS_SUB_SYMBOLS = 50;                        // Max symbols per WS subscription
```

---

## 2. REALTIME COMPONENT: `DashboardRealtimePanel.jsx`

### File Path
[frontend/src/components/DashboardRealtimePanel.jsx](frontend/src/components/DashboardRealtimePanel.jsx)

### Current Implementation Summary
Displays realtime alerts, quote table, and metrics from websocket feed. **Consumes** state from `useRealtimeFeedCore` via `useRealtimeFeed` hook.

### Props Accepted
```javascript
export default function DashboardRealtimePanel({
  holdings,
  trackedSymbolNames = [],
  quotesBySymbol = {},           // From useRealtimeFeedCore
  realtimeStatus = 'idle',        // From useRealtimeFeedCore
  lastEventAt = null,             // From useRealtimeFeedCore
  alerts = [],                    // From useRealtimeFeedCore
  darkFlowAlerts = [],            // From useRealtimeFeedCore
  metrics = null,
  monitoredSymbols = [],
  enableSnapshot = true,
  onSyncRequest = null,
  showSummaryMetrics = true,
  portfolioId = null,
})
```

### State Update Pattern
```javascript
// Uses useUnifiedAlerts hook to filter/paginate alerts
const {
  quoteList,              // Processed quotes from quotesBySymbol
  filteredUnifiedAlerts,  // Alerts filtered by source/severity
  alertSummary,           // Aggregated alert counts
  hotSymbols,             // Top symbols by activity
} = useUnifiedAlerts({
  alerts,                 // Direct from useRealtimeFeedCore
  darkFlowAlerts,         // Direct from useRealtimeFeedCore
  quotesBySymbol,         // Direct from useRealtimeFeedCore
  ...
});
```

### Real-Time Update Logic
1. **Quote Table:** Reads `quotesBySymbol` state and re-renders via `RealtimeQuoteTable` component
2. **Alert Bar:** Renders `filteredUnifiedAlerts` with toast notifications for critical events
3. **Status Indicator:** Maps `realtimeStatus` to UI state (`'live'` → green, `'polling'` → yellow, `'idle'` → gray)
4. **Latency Display:** Uses `metrics.lastLatencyMs` for P95 latency badge

### Realtime Update Flow (No Manual Polling)
```
useRealtimeFeedCore Hook
  ↓ (state updates on WS message)
setQuotesBySymbol({...})
setAlerts([...])
setLastEventAt(isoTs)
  ↓ (parent component receives new props)
DashboardRealtimePanel receives updated quotesBySymbol
  ↓ (automatic re-render)
RealtimeQuoteTable re-renders with new quotes
UnifiedAlertCenter displays new alerts
```

---

## 3. HEATMAP COMPONENT: `PortfolioHeatmap.jsx`

### File Path
[frontend/src/components/PortfolioHeatmap.jsx](frontend/src/components/PortfolioHeatmap.jsx)

### Current Implementation Summary
**Dual-mode hierarchical visualization** using ECharts (Treemap + Sunburst). Displays portfolio holdings grouped by industry sector with color-coding based on price change percentage.

### Props
```javascript
export default function PortfolioHeatmap({ holdings, title })
```

### ECharts Configuration

#### 1. Data Transformation (Lines 25-103)
Converts holdings array → hierarchical sector structure:

```javascript
const hierarchicalData = useMemo(() => {
  const sectors = {};
  
  holdings.forEach((holding) => {
    // Calculate display size from live_market_value or market_value
    const size = liveValue > 0 ? liveValue : snapshotValue;
    
    // Get change percentage
    const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
    
    // Group by industry sector
    sectors[industry] = {
      name: industry,
      children: [
        {
          id: `symbol:${symbol}`,
          name: symbol,
          symbol,
          industry,
          changePct,
          value: [size, changePct],  // [weight, colorDimension]
          itemStyle: {
            borderColor: h.is_holding ? 'rgba(250, 204, 21, 0.75)' : 'rgba(15, 23, 42, 0.32)',
            shadowBlur: Math.abs(changePct) >= 2 ? 14 : 0,
            shadowColor: changePct > 0 ? 'rgba(16, 185, 129, 0.36)' : 'rgba(244, 63, 94, 0.32)',
          },
        }
      ],
    };
  });
  
  return Object.values(sectors).map(sector => ({
    id: `industry:${sector.name}`,
    name: sector.name,
    value: [sector.totalWeight, avgChange],
    children: sector.children.sort(...),
  }));
}, [holdings]);
```

**Data Structure:**
```
hierarchicalData = [
  {
    id: "industry:Ngân hàng",
    name: "Ngân hàng",
    value: [1500000, 2.5],           // [totalSize, avgChangePct]
    children: [
      {
        id: "symbol:VCB",
        name: "VCB",
        value: [750000, 3.2],         // [size, changePct]
        changePct: 3.2,
        isHolding: true,
        itemStyle: {...}
      },
      ...
    ]
  },
  ...
]
```

#### 2. ECharts Options (Lines 104-390+)

**Shared Configuration:**
```javascript
const option = useMemo(() => {
  const heatScaleColors = ['#ef4444', '#f97316', '#94a3b8', '#22c55e', '#10b981'];
  // Red (-3%) → Orange → Gray (0%) → Green → Dark Green (+3%)
  
  const tooltip = {
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    borderColor: 'rgba(51, 65, 85, 0.7)',
    confine: true,
    textStyle: { color: '#e2e8f0', fontSize: 12 },
    formatter: (params) => {
      // Custom HTML tooltip showing symbol, size, changePct, holding status
      return `
        <div style="min-width: 210px; padding: 4px 2px;">
          <strong>${data.name}</strong>
          <span>${data.isHolding ? 'Đang nắm giữ' : 'Trong watchlist'}</span>
          <div>Trọng số: ${Math.round(size).toLocaleString('vi-VN')}</div>
          <div>Biến động: ${formatPercent(changePct)}</div>
        </div>
      `;
    }
  };

  const visualMap = {
    show: false,
    min: -3,
    max: 3,
    dimension: 1,              // Color by value[1] (changePct)
    inRange: {
      color: heatScaleColors
    }
  };
```

**Mode 1: TREEMAP (Default)**
```javascript
if (viewMode === 'treemap') {
  return {
    backgroundColor: 'transparent',
    animationDuration: 350,
    animationDurationUpdate: 900,
    animationEasingUpdate: 'cubicInOut',
    tooltip,
    visualMap,
    series: [{
      type: 'treemap',
      id: 'portfolio-heatmap-transition',
      data: hierarchicalData,
      roam: false,
      nodeClick: false,
      universalTransition: true,        // Smooth animation between treemap/sunburst
      breadcrumb: { show: false },
      sort: 'desc',
      squareRatio: 0.75,
      leafDepth: 1,                     // Show only leaf level (symbols)
      label: {
        show: true,
        formatter: (params) => {
          const cp = Number.isFinite(rawCp) ? rawCp : 0;
          return `{symbol|${params.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(1)}%}`;
        },
        rich: {
          symbol: { color: '#ffffff', fontWeight: 900, fontSize: 12 },
          pct: { color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 10 }
        }
      },
      emphasis: {
        focus: 'descendant',
        itemStyle: {
          borderColor: '#e2e8f0',
          borderWidth: 2,
          shadowBlur: 20,
          shadowColor: 'rgba(15, 23, 42, 0.45)',
        }
      },
      levels: [
        { itemStyle: { borderColor: 'rgba(15, 23, 42, 0.9)', borderWidth: 2 } },
        { itemStyle: { borderColor: 'rgba(2, 6, 23, 0.6)', borderWidth: 1 } }
      ]
    }]
  };
}
```

**Mode 2: SUNBURST (Hierarchical Radial)**
```javascript
if (viewMode === 'sunburst') {
  return {
    ...
    series: [{
      type: 'sunburst',
      id: 'portfolio-heatmap-transition',
      data: hierarchicalData,
      radius: ['7%', '92%'],            // Inner/outer radius
      nodeClick: false,
      universalTransition: true,
      label: {
        rotate: 'radial',
        minAngle: 5,
        formatter: (params) => {
          if (params?.data?.children) return params.name;  // Sector label
          const cp = Number.isFinite(rawCp) ? rawCp : 0;
          return `{symbol|${params.name}}\n{pct|${cp > 0 ? '+' : ''}${cp.toFixed(1)}%}`;
        },
        rich: {
          symbol: { color: '#f8fafc', fontWeight: 800, fontSize: 12 },
          pct: { color: 'rgba(241,245,249,0.95)', fontSize: 10 }
        }
      },
      levels: [
        { itemStyle: { borderWidth: 0 } },
        {
          r0: '7%',
          r: '48%',
          itemStyle: { borderColor: 'rgba(2, 6, 23, 0.82)', borderWidth: 2 },
          label: { rotate: 0, color: '#e2e8f0', fontWeight: 800 }
        },
        {
          r0: '50%',
          r: '92%',
          itemStyle: { borderColor: 'rgba(2, 6, 23, 0.72)', borderWidth: 1.5 }
        }
      ]
    }]
  };
}
```

#### 3. Rendering & View Mode Toggle
```javascript
return (
  <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl">
    {/* Header with mode toggle */}
    <div className="flex items-center justify-between px-5 py-4">
      <h3>{title}</h3>
      <div className="flex gap-2">
        <button onClick={() => setViewMode('treemap')} className={...}>
          ⊞ Treemap
        </button>
        <button onClick={() => setViewMode('sunburst')} className={...}>
          ◎ Sunburst
        </button>
      </div>
    </div>
    
    {/* ECharts chart */}
    <ReactECharts option={option} style={{ height: HEATMAP_HEIGHT }} />
  </div>
);
```

### ECharts Feature Highlights
- **Color Scale:** -3% (Red) → 0% (Gray) → +3% (Green)
- **Animation:** `universalTransition: true` for smooth treemap↔sunburst toggle
- **Interactive:** Hover emphasis with glow effect, no node click navigation
- **Tooltips:** Vietnamese labels with position, size, change %
- **Responsive:** 420px fixed height, Tailwind dark theme integration

---

## 4. INTEGRATION FLOW: Dashboard → Hooks → Components

### File: Dashboard.jsx (Pages)
[frontend/src/pages/Dashboard.jsx](frontend/src/pages/Dashboard.jsx)

**Component Tree:**
```
<Dashboard>
  ├─ useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 20 })
  │  └─ useRealtimeFeedCore (WS + Polling)
  │
  ├─ <PortfolioHeatmap holdings={liveHoldings} />
  │  ├─ ECharts Treemap/Sunburst visualization
  │  └─ Consumes: holdings array (with live_market_value, change_pct)
  │
  └─ <DashboardRealtimePanel
       quotesBySymbol={quotesBySymbol}
       realtimeStatus={realtimeStatus}
       alerts={alerts}
     />
     ├─ RealtimeQuoteTable (updates on state change)
     ├─ UnifiedAlertBar (displays whale alerts)
     └─ Consumes: useRealtimeFeedCore state directly
```

### State Flow for Real-Time Updates
```
WebSocket Message
  ↓
useRealtimeFeedCore.onmessage()
  ↓
setQuotesBySymbol() [state update]
  ↓
Dashboard receives new quotesBySymbol prop
  ↓
buildLiveHoldingsOverlay(holdings, quotesBySymbol)  [selector]
  ↓
<PortfolioHeatmap holdings={liveHoldings} />
  ↓
hierarchicalData useMemo recomputes
  ↓
ECharts option updates
  ↓
Chart re-renders with new colors/sizes
```

### Helper Context: RealtimeContext.jsx
[frontend/src/context/RealtimeContext.jsx](frontend/src/context/RealtimeContext.jsx)

```javascript
// Manages multiple consumers (components) subscribing to same symbols
<RealtimeProvider>
  // Aggregates all symbol subscriptions
  // Deduplicates symbols
  // Returns: register(), update(), unregister(), feed state
</RealtimeProvider>

// Usage in component:
const { register, feed } = useRealtimeContext();
useEffect(() => {
  const consumerId = register({ symbols: ['VCB', 'VNM'], maxAlerts: 5 });
  return () => unregister(consumerId);
}, []);
```

---

## 5. QUICK REFERENCE: FILE LOCATIONS & CURRENT LOGIC

| Component | Path | Purpose | Current Logic |
|-----------|------|---------|----------------|
| **useRealtimeFeedCore** | `frontend/src/hooks/useRealtimeFeedCore.js` | WS + Polling | Hybrid: WS (primary) + REST fallback; merges quotes; tracks alerts |
| **DashboardRealtimePanel** | `frontend/src/components/DashboardRealtimePanel.jsx` | Alert display | Consumes hook state; filters alerts; renders quote table & toasts |
| **PortfolioHeatmap** | `frontend/src/components/PortfolioHeatmap.jsx` | ECharts viz | Treemap/Sunburst dual-mode; color by change %; grouped by sector |
| **Dashboard (Page)** | `frontend/src/pages/Dashboard.jsx` | Main page | Orchestrates feeds; passes state to children; builds live overlays |
| **RealtimeContext** | `frontend/src/context/RealtimeContext.jsx` | State provider | Aggregates subscriptions; deduplicates symbols |
| **API Client** | `frontend/src/api/client.js` | WS URL & REST | `getRealtimeWebSocketUrl()`, `getRealtimeTickers()` |

---

## 6. KEY TAKEAWAYS

✅ **Websocket Connection:**
- Managed by `useRealtimeFeedCore` hook
- Subscribes to max 50 symbols
- Falls back to REST polling on error
- Tracks event counts, latency, connection state

✅ **State Update Pattern:**
- No manual polling in components
- Automatic re-render on `quotesBySymbol`, `alerts`, `realtimeStatus` state change
- Event deduplication in place (1s window)

✅ **ECharts Heatmap:**
- Uses **hierarchical data** (sectors → symbols)
- **Dual visualization mode:** Treemap (rectangular) ↔ Sunburst (radial)
- **Color scale:** -3% to +3% change percentage
- **Animation:** Smooth transition between modes via `universalTransition`

✅ **Integration Pattern:**
- Dashboard.jsx orchestrates multiple hooks
- PortfolioHeatmap reads holdings (pre-computed live overlay)
- DashboardRealtimePanel reads quotesBySymbol directly
- No prop drilling; context-based for large trees

---

## 7. SUGGESTED IMPROVEMENTS (Optional Guidance)

**Potential Enhancements:**
1. **Memoization:** `DashboardRealtimePanel` could use `React.memo()` to prevent unnecessary re-renders
2. **Quote Subscription:** Limit DashboardRealtimePanel re-renders by subscribing only to needed symbols
3. **Heatmap Interactivity:** Add click handlers to drill-down into sector/symbol details
4. **Latency Visualization:** Display P95 latency badge with threshold warnings (>500ms)
5. **Dark Flow Alerts:** Integrate dark_flow_alert visual differentiator in heatmap glow effects

