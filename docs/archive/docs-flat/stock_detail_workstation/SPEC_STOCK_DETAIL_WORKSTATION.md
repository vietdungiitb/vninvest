# SPEC: Stock Detail Workstation (SSI iBoard Style)

**Version**: 1.1  
**Date**: 2026-06-19  
**Status**: Implementation Ready  
**Feature Flag**: `WORKSTATION_LAYOUT_V2`

---

## 1. New Components & File Tree

```
packages/web/src/components/workstation/
├── StockOrderBookWidget.jsx          # Order Book grid + progress bars
├── StockExecutionLogWidget.jsx       # Trade Log with live prepend
├── OrderFlowRadarPanel.jsx           # CVD + Volume Delta radar
├── VNStockChartPanel.jsx             # Wrapper chart + sync logic
├── WorkstationLayout.jsx             # Desktop split / Mobile tabs
├── index.js                          # Barrel export
└── hooks/
    ├── useRealtimePolling.js         # Generic polling + AbortController
    ├── useOrderBook.js               # Calls getRealtimeDepthChart
    ├── useTradeLog.js                # Calls getRealtimeIntraday
    ├── useSessionFacts.js            # Calls overview + SessionFacts
    └── index.js
```

---

## 2. API Contracts (TypeScript Interfaces)

```typescript
// packages/web/src/types/api.d.ts

export interface SessionFactsPayload {
  total_buy_qty: number;
  total_sell_qty: number;
  institutional_buy: number;  // 0-100 percentage
  retail_buy: number;         // 0-100 percentage
}

export interface OrderBookLevel {
  price: number;
  volume: number;
  orders: number;
}

export interface OrderBookResponse {
  bids: OrderBookLevel[];   // length 3, descending price
  asks: OrderBookLevel[];   // length 3, ascending price
  spread: number;           // ask[0].price - bid[0].price
  timestamp: string;        // ISO 8601, Asia/Ho_Chi_Minh
}

export interface TradeLogItem {
  time: string;             // HH:mm:ss
  price: number;
  volume: number;
  side: 'BUY' | 'SELL';     // aggressor side
  change: number;           // vs previous close price
  change_pct: number;
}

export interface WhaleFeedAggregateResponse {
  symbol: string;
  net_flow: number;         // institutional net buy/sell
  large_orders: Array<{
    time: string;
    price: number;
    volume: number;
    side: 'BUY' | 'SELL';
  }>;
}
```

---

## 3. Mock Market Depth Algorithm (Deterministic)

**Input**: `lastPrice`, `refPrice` (previous close), `totalVolume` (session), `tickSize` (from security_master, default 0.05)

**Spread**: `max(0.15% * lastPrice, tickSize)` → rounded to tickSize

**Price Levels**:
```
Bids (3 levels):  [lastPrice - 1*tick, lastPrice - 2*tick, lastPrice - 3*tick]
Asks (3 levels):  [lastPrice + 0*tick, lastPrice + 1*tick, lastPrice + 2*tick]
```

**Volume Distribution** (per level, sum = `totalVolume / 100`):
```
Level 1: 40%
Level 2: 30%
Level 3: 20%
Level 4 (hidden reserve): 10%
```

**Orders per Level**: Random integer 15-80 (seeded by symbol+date for consistency)

**Output Example**:
```json
{
  "bids": [
    {"price": 89.50, "volume": 120000, "orders": 45},
    {"price": 89.45, "volume": 90000, "orders": 32},
    {"price": 89.40, "volume": 60000, "orders": 21}
  ],
  "asks": [
    {"price": 89.55, "volume": 120000, "orders": 38},
    {"price": 89.60, "volume": 90000, "orders": 29},
    {"price": 89.65, "volume": 60000, "orders": 18}
  ],
  "spread": 0.05,
  "timestamp": "2026-06-19T14:30:00+07:00"
}
```

---

## 4. Feature Flag Strategy

| Source | Key | Type | Default |
|--------|-----|------|---------|
| Backend template injection | `window.__ENV__.WORKSTATION_LAYOUT_V2` | boolean | `false` |
| Fallback localStorage | `localStorage.getItem('workstation_v2')` | string 'true'/'false' | `null` |

**Resolution Logic** (in `WorkstationLayout.jsx`):
```js
const flag = window.__ENV__?.WORKSTATION_LAYOUT_V2 
  ?? (localStorage.getItem('workstation_v2') === 'true');
```

**Rollout Plan**:
- Week 1: 10% (internal/QA)
- Week 2: 50% (beta users)
- Week 3: 100% (GA)
- Controlled via remote config / backend template variable

---

## 5. Accessibility Checklist (WCAG 2.1 AA)

### Order Book (`StockOrderBookWidget`)
- [ ] `role="grid"` with `aria-label="Sổ lệnh Mua/Bán"`
- [ ] `aria-live="polite"` on tbody for updates
- [ ] Column headers: `scope="col"` (Giá, KL, Lệnh)
- [ ] Color-blind: ▲/▼ icons + "M"/"B" badges + 3px left border (green/red)
- [ ] Focus-visible on each row (`tabindex="0"`)
- [ ] Keyboard: Arrow keys navigate rows, Enter expands detail

### Trade Log (`StockExecutionLogWidget`)
- [ ] `role="log"` with `aria-live="polite"` `aria-atomic="false"`
- [ ] New entries prepended with `aria-label="Khớp lệnh mới"`
- [ ] Side badge: "M" (green) / "B" (red) + icon ▲/▼
- [ ] Timestamp format: `HH:mm:ss` (Asia/Ho_Chi_Minh)

### Mobile Tab Switcher
- [ ] `role="tablist"` with `aria-label="Chế độ xem Workstation"`
- [ ] Buttons: `role="tab"` `aria-selected` `aria-controls`
- [ ] Panels: `role="tabpanel"` `aria-labelledby`
- [ ] Keyboard: Left/Right arrows switch tabs, Home/End first/last

### General
- [ ] Color contrast ≥ 4.5:1 (text), 3:1 (UI components)
- [ ] Reduced motion: `@media (prefers-reduced-motion)` disable animations
- [ ] Focus trap in mobile tab panels when open

---

## 6. Error / Loading / Empty States

| Component | Skeleton | Error Toast | Empty State |
|-----------|----------|-------------|-------------|
| Order Book | 3 bid + 3 ask rows (shimmer) | "Mất kết nối sổ lệnh" + Retry | "Chưa có dữ liệu sổ lệnh" |
| Trade Log | 5 rows (shimmer) | "Mất kết nối nhật ký" + Retry | "Chưa có khớp lệnh trong phiên" |
| CVD/Radar | Placeholder chart (gray area) | Silent (non-critical) | "Dữ liệu CVD chưa sẵn sàng" |
| Chart Panel | Chart.js skeleton | "Không tải được biểu đồ" | N/A |

**Retry Logic**: Exponential backoff 2s → 4s → 8s, max 3 retries, then show toast.

---

## 7. Polling Hook Specification (`useRealtimePolling`)

```typescript
interface PollingOptions<T> {
  intervalMs: number;           // default 5000
  fetchFn: (signal: AbortSignal) => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;            // default true
  dedupeKey?: string;           // symbol, used to ignore stale responses
}

function useRealtimePolling<T>(options: PollingOptions<T>): {
  stop: () => void;
  start: () => void;
  isPolling: boolean;
}
```

**Behavior**:
- Creates `AbortController` per poll cycle
- On `dedupeKey` change: aborts in-flight request, resets interval
- On unmount: aborts + clears interval
- On error: calls `onError`, schedules retry with backoff
- On success: calls `onData`, reschedules at fixed interval

---

## 8. Test Matrix

| Layer | Tool | Scenarios |
|-------|------|-----------|
| **Backend API** | pytest | Whale Feed 200/404, SessionFacts payload shape, Depth mock algorithm, 404 for invalid symbol |
| **Hook** | Vitest | `useRealtimePolling` abort, retry, dedupe, interval cleanup, enabled toggle |
| **Component** | React Testing Library | Order Book render 3 levels, Trade Log prepend, Mobile tab switch, Skeleton states, A11y roles |
| **E2E** | Playwright | Symbol switch VCB→HPG→VNM (no stale data), Mobile layout 375px, Polling updates visible, Axe-core 0 critical, Feature flag toggle |
| **Performance** | Lighthouse CI | Load time < 2s, Bundle increase < 50KB gz, Memory stable after 50 mount/unmount |

---

## 9. Rollout & Monitoring

**Metrics to Track**:
- `workstation_load_time` (p50, p95)
- `polling_error_rate` (per endpoint)
- `symbol_switch_latency` (time to interactive)
- `feature_flag_adoption` (% users on v2)

**Rollback Plan**:
1. Flip `WORKSTATION_LAYOUT_V2 = false` in backend template
2. Clear `localStorage.workstation_v2`
3. Deploy hotfix if critical bug

**Success Criteria**:
- Zero critical a11y violations
- Polling error rate < 1%
- Symbol switch < 300ms
- Mobile usability score > 90

---

## 10. Dependencies & Prerequisites

| Dependency | Status | Owner |
|------------|--------|-------|
| `SessionFacts` materialized view | ✅ Ready | Backend |
| `security_master.tick_size` | ✅ Available | Backend |
| `getRealtimeIntraday` API | ✅ Exists | Backend |
| `getRealtimeDepthChart` API | 🔄 Modified | Backend |
| `RealtimeWhaleFeedAggregateView` | 🔄 Fixed | Backend |
| Chart.js / Recharts (CVD) | ✅ Installed | Frontend |
| Feature flag injection | 🔄 Needed | DevOps |

---

*End of Spec*