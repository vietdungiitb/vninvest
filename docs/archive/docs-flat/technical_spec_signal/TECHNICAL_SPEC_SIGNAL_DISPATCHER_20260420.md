# Technical Specification: Signal Dispatcher Architecture

**Concept**: A lightweight, non-intrusive event bus system to synchronize dashboard components based on user interaction (Click), replacing high-frequency state updates.

---

## 1. Event Definition
The system uses native Browser **CustomEvents** dispatched on the `window` object. This avoids Redux/Context re-render overhead for simple synchronization.

-   **Event Name**: `vninvest:sync:interaction`
-   **Payload Structure**:
    ```typescript
    interface SyncPayload {
      timestamp: number;        // Unix timestamp (seconds)
      symbol: string | null;    // Highlighted ticker (if applicable)
      source: string;          // Component ID (e.g., 'heatmap', 'master_chart')
      action: 'select' | 'clear';
    }
    ```

---

## 2. Component Flow

### A. Dispatcher (Heatmap/MasterChart)
When a user clicks on a Data Point (ECharts `click` event):
1.  Capture the `time` (from chart param) and `symbol`.
2.  Dispatch the event:
    ```javascript
    window.dispatchEvent(new CustomEvent('vninvest:sync:interaction', {
      detail: { 
        timestamp: targetTimestamp, 
        symbol: targetSymbol,
        source: 'PortfolioHeatmap',
        action: 'select',
      }
    }));
    ```

### B. Subscribers (NewsPanel / WhaleFeed / Indicators)
Components that need to reflect the selected time/symbol:
1.  Listen for the event in a `useEffect` hook.
2.  Only fetch data or scroll to view *after* the event is caught.
3.  **Implementation**:
    ```javascript
    useEffect(() => {
      const handleSync = (e) => {
        const { timestamp, symbol } = e.detail;
        setCurrentFocus({ timestamp, symbol });
        // Trigger on-demand API fetch for news on this date
      };
      window.addEventListener('vninvest:sync:interaction', handleSync);
      return () => window.removeEventListener('vninvest:sync:interaction', handleSync);
    }, []);
    ```

---

## 3. Data Flow Optimization
-   **On-Demand Fetching**: Subscribers should check if data for the `timestamp` is already in local cache/state before calling the API.
-   **Debouncing**: Not required for `click` events, but the API client should handle potential identical concurrent requests (Deduplication).

---

## 4. Why This Approach?
1.  **Decoupling**: The Heatmap doesn't need to know the NewsPanel exists.
2.  **Performance**: Avoids passing props down through `Layout -> Dashboard -> Grid -> Component`, which would cause a full-page repaint.
3.  **Scalability**: Adding a new "Historical Order Flow" panel in the future is as easy as adding one listener.

---
---

## 5. Clear Selection
When a user clicks outside any data point (on background), components should reset:
```javascript
// Dispatcher — on chart 'globalout' or background click:
window.dispatchEvent(new CustomEvent('vninvest:sync:interaction', {
  detail: { timestamp: null, symbol: null, source: 'PortfolioHeatmap', action: 'clear' }
}));

// Subscriber — handle both actions:
const handleSync = (e) => {
  const { action, timestamp, symbol } = e.detail;
  if (action === 'clear') {
    setCurrentFocus(null);
    return;
  }
  setCurrentFocus({ timestamp, symbol });
  // Trigger on-demand API fetch only for 'select'
};
```

---

**Approved Architecture**: Version 1.1 (Fixed: action field, clear event added)  
**Targeted Sprint**: 1.5
