# FRONTEND DESIGN — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Scope**: Chi tiết thiết kế frontend cho DM-01 → DM-05

---

## 1. coreApiAdapter.js — 7 methods mới (DM-01)

**File**: `packages/web/src/adapters/coreApiAdapter.js`

### 1.1 legacyApiGet private transport

Endpoint `/api/stock-management/technicals/bulk/` chỉ tồn tại ở `market_data.public_urls` → mount tại `/api/`, không có tại `/core/v1/`. Cần transport helper riêng.

```js
// PRIVATE — không export, đặt bên trong createCoreApiAdapter factory
function createLegacyApiTransport(env) {
  const legacyBase = env.apiBase || '/api';  // Same origin, different prefix

  return async function legacyApiGet(path, options = {}) {
    const token = env.getAuthToken ? env.getAuthToken() : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const url = `${legacyBase}/${path.replace(/^\//, '')}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: options.signal,
    });

    if (!response.ok) {
      const err = new Error(`API error ${response.status}: ${url}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  };
}
```

### 1.2 7 methods — full spec

```js
// Thêm vào factory return object của createCoreApiAdapter(env)

// ── Portfolio Holdings ──────────────────────────────────────────────────────
/**
 * Lấy danh sách holdings của một portfolio.
 * @param {string|number} portfolioId
 * @returns {Promise<Array<{symbol, shares, avg_cost, current_price, market_value, unrealized_pl, unrealized_pl_pct}>>}
 */
getPortfolioHoldings(portfolioId) {
  if (!portfolioId) throw new Error('portfolioId is required for getPortfolioHoldings');
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/holdings/`);
},

// ── Portfolio Summary ───────────────────────────────────────────────────────
/**
 * Lấy summary metrics của portfolio.
 * @param {string|number} portfolioId
 * @returns {Promise<{total_invested, market_value, unrealized_pl, unrealized_pl_pct, holdings_count, as_of_date}>}
 */
getPortfolioSummary(portfolioId) {
  if (!portfolioId) throw new Error('portfolioId is required for getPortfolioSummary');
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/summary/`);
},

// ── Portfolio Analytics ─────────────────────────────────────────────────────
/**
 * Lấy analytics lịch sử (equity curve, drawdown, sector breakdown).
 * @param {string|number} portfolioId
 * @param {number} [days=30] - Lookback window in calendar days
 * @returns {Promise<{equity_curve: Array, max_drawdown, sector_weights, volatility}>}
 */
getPortfolioAnalytics(portfolioId, days = 30) {
  if (!portfolioId) throw new Error('portfolioId is required for getPortfolioAnalytics');
  const query = new URLSearchParams({ days: String(days) }).toString();
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/analytics/?${query}`);
},

// ── Portfolio Technicals ────────────────────────────────────────────────────
/**
 * Lấy technical signals aggregated cho portfolio.
 * @param {string|number} portfolioId
 * @returns {Promise<{rsi_avg, trend_distribution, momentum_score, last_updated}>}
 */
getPortfolioTechnicals(portfolioId) {
  if (!portfolioId) throw new Error('portfolioId is required for getPortfolioTechnicals');
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/technicals/`);
},

// ── Bulk Technicals via /api/ path ──────────────────────────────────────────
/**
 * Lấy technical data cho nhiều symbols cùng lúc.
 * CHỈ available tại /api/stock-management/technicals/bulk/ (không có /core/v1/)
 * @param {string[]} symbols
 * @returns {Promise<Array<{symbol, rsi, macd, signal, trend}>>}
 */
getBulkTechnicalsBySymbols(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return Promise.resolve([]);
  }
  const query = symbols.map(s => `symbols=${encodeURIComponent(s)}`).join('&');
  return legacyApiGet(`/stock-management/technicals/bulk/?${query}`);
},

// ── Tracked Symbols ─────────────────────────────────────────────────────────
/**
 * Lấy danh sách symbols đang tracked.
 * @returns {Promise<Array<{symbol, name, tracked_since}>>}
 */
getTrackedSymbols() {
  return coreGet('/stock-management/tracked-symbols/');
},

// ── Legacy Watchlist Groups ─────────────────────────────────────────────────
/**
 * Lấy watchlist groups (legacy schema).
 * @returns {Promise<Array<{id, name, items: Array<{symbol}>}>>}
 */
getLegacyWatchlistGroups() {
  return coreGet('/portfolio/watchlist/groups/');
},
```

---

## 2. useCoreDashboardData.js — Hook Design (DM-02)

**File**: `packages/web/src/features/dashboard/useCoreDashboardData.js`

### 2.1 State shape

```js
// Initial state
const INITIAL_STATE = {
  // Portfolio data
  portfolios: [],         // từ getPortfolios()
  selectedPortfolio: null,
  holdings: [],           // từ getPortfolioHoldings()
  summary: null,          // từ getPortfolioSummary()
  analytics: null,        // từ getPortfolioAnalytics()
  technicals: null,       // từ getPortfolioTechnicals()
  bulkTechnicals: {},     // { [symbol]: technicalData } từ getBulkTechnicalsBySymbols()
  
  // User assets
  trackedSymbols: [],     // từ getTrackedSymbols()
  watchlistGroups: [],    // từ getLegacyWatchlistGroups()
  
  // Alerts (separate loading track)
  alertFeed: {
    alerts: [],
    summary: null,
    loading: false,
    error: null,
  },
  
  // Meta
  loading: false,
  error: null,
  lastFetchedAt: null,
};
```

### 2.2 State machine

```
IDLE ──(portfolioId set)──> LOADING
LOADING ──(success)──> SUCCESS
LOADING ──(error)──> ERROR
SUCCESS ──(refresh() called)──> LOADING
ERROR ──(refresh() called)──> LOADING
```

### 2.3 Full implementation spec

```js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook cung cấp toàn bộ data cho DashboardPage.
 * @param {object} params
 * @param {string|number|null} params.portfolioId - Portfolio đang được xem
 * @param {object} params.coreApiAdapter - Adapter instance (inject để testable)
 * @returns {object} Dashboard data + state + refresh()
 */
export function useCoreDashboardData({ portfolioId, coreApiAdapter }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [refreshToken, setRefreshToken] = useState(0);
  const mountedRef = useRef(true);

  // cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Alert feed — independent fetch, không block main data
  useEffect(() => {
    if (!portfolioId) return;
    const controller = new AbortController();

    setState(prev => ({
      ...prev,
      alertFeed: { ...prev.alertFeed, loading: true, error: null },
    }));

    coreApiAdapter.getAlertCenterFeed({ page_size: 20 }, { signal: controller.signal })
      .then(feed => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setState(prev => ({
          ...prev,
          alertFeed: { alerts: feed.results || [], summary: feed.summary || null, loading: false, error: null },
        }));
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        if (!mountedRef.current) return;
        setState(prev => ({
          ...prev,
          alertFeed: { ...prev.alertFeed, loading: false, error: err.message },
        }));
      });

    return () => controller.abort();
  }, [portfolioId, refreshToken]);

  // Main portfolio data fetch
  useEffect(() => {
    if (!portfolioId) return;
    const controller = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    async function load() {
      try {
        // Phase 1: Fetch portfolio data + user assets in parallel
        const [holdings, summary, analytics, technicals, trackedSymbols, watchlistGroups] = 
          await Promise.all([
            coreApiAdapter.getPortfolioHoldings(portfolioId),
            coreApiAdapter.getPortfolioSummary(portfolioId),
            coreApiAdapter.getPortfolioAnalytics(portfolioId, 30),
            coreApiAdapter.getPortfolioTechnicals(portfolioId),
            coreApiAdapter.getTrackedSymbols(),
            coreApiAdapter.getLegacyWatchlistGroups(),
          ]);

        if (controller.signal.aborted || !mountedRef.current) return;

        // Phase 2: Bulk technicals (depends on holdings)
        const symbols = (Array.isArray(holdings) ? holdings : [])
          .map(h => h.symbol)
          .filter(Boolean);

        const bulkRaw = await coreApiAdapter.getBulkTechnicalsBySymbols(symbols);
        if (controller.signal.aborted || !mountedRef.current) return;

        const bulkTechnicals = {};
        (Array.isArray(bulkRaw) ? bulkRaw : []).forEach(t => {
          if (t && t.symbol) bulkTechnicals[t.symbol] = t;
        });

        setState(prev => ({
          ...prev,
          holdings: Array.isArray(holdings) ? holdings : [],
          summary: summary || null,
          analytics: analytics || null,
          technicals: technicals || null,
          trackedSymbols: Array.isArray(trackedSymbols) ? trackedSymbols : [],
          watchlistGroups: Array.isArray(watchlistGroups) ? watchlistGroups : [],
          bulkTechnicals,
          loading: false,
          error: null,
          lastFetchedAt: new Date().toISOString(),
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!mountedRef.current) return;
        setState(prev => ({
          ...prev,
          loading: false,
          error: err.message || 'Không thể tải dữ liệu dashboard.',
        }));
      }
    }

    load();
    return () => controller.abort();
  }, [portfolioId, refreshToken]);

  const refresh = useCallback(() => {
    setRefreshToken(t => t + 1);
  }, []);

  return { ...state, refresh };
}
```

---

## 3. DashboardPage.js — Full Layout Design (DM-03)

**File**: `packages/web/src/pages/DashboardPage.js`

### 3.1 Component contract

```js
/**
 * DashboardPage — Trang dashboard chính của SaaS.
 * Sử dụng render props pattern để inject legacy components từ host.
 * 
 * @param {object} props
 * @param {string|number|null} props.portfolioId - Portfolio đang được xem
 * @param {object} props.env - Runtime env (apiBase, getAuthToken)
 * @param {object} props.coreApiAdapter - Adapter instance
 * @param {function|null} props.renderStatsHeader - (data) => ReactElement | null
 * @param {function|null} props.renderPositionDeck - (data) => ReactElement | null  
 * @param {function|null} props.renderAlertCenter - (data) => ReactElement | null
 * @param {function|null} props.renderHeatmap - (data) => ReactElement | null
 * @param {function|null} props.renderBubble - (data) => ReactElement | null
 */
export function DashboardPage({
  portfolioId = null,
  env = {},
  coreApiAdapter,
  renderStatsHeader = null,
  renderPositionDeck = null,
  renderAlertCenter = null,
  renderHeatmap = null,
  renderBubble = null,
}) { ... }
```

### 3.2 Data object shape cho render props

```js
// Argument truyền vào mỗi render prop function:
const slotData = {
  // Core data
  portfolioId,
  holdings,        // Array<Holding>
  summary,         // PortfolioSummary | null
  analytics,       // PortfolioAnalytics | null
  technicals,      // PortfolioTechnicals | null
  bulkTechnicals,  // { [symbol]: TechnicalData }
  trackedSymbols,  // Array<TrackedSymbol>
  watchlistGroups, // Array<WatchlistGroup>
  alertFeed,       // { alerts, summary, loading, error }
  
  // Meta
  loading,
  error,
  refresh,         // () => void
};
```

### 3.3 Skeleton loading UI

```js
// Class naming convention: BEM với prefix "core-dashboard"
// core-dashboard-page
// core-dashboard__section
// core-dashboard__stats
// core-dashboard__position-deck
// core-dashboard__alert-center
// core-dashboard__heatmap
// core-dashboard__bubble
// core-dashboard--loading (modifier)
// core-dashboard__skeleton
// core-dashboard__skeleton-bar

function BuiltinSkeleton() {
  return e('div', { className: 'core-dashboard__skeleton' },
    e('div', { className: 'core-dashboard__skeleton-bar', style: { width: '60%', height: '24px' } }),
    e('div', { className: 'core-dashboard__skeleton-bar', style: { width: '40%', height: '16px', marginTop: '8px' } }),
  );
}
```

### 3.4 Fallback UI specs

| Slot | Fallback khi prop = null |
|------|--------------------------|
| `renderStatsHeader` | 3 metric cards: `market_value`, `unrealized_pl`, `holdings.length` |
| `renderPositionDeck` | `<ul>` list với tên symbol + market_value mỗi holding |
| `renderAlertCenter` | Danh sách 5 alert đầu (type + message) |
| `renderHeatmap` | Không render section (omit) |
| `renderBubble` | Không render section (omit) |

---

## 4. PackageDashboardHost.jsx — Host Component Design (DM-04)

**File**: `frontend/src/pages/PackageDashboardHost.jsx`

### 4.1 Imports

```jsx
// packages/web component — qua npm alias @vninvest/web
import { DashboardPage } from '@vninvest/web';

// Runtime env — reuse từ ShellDashboardPage pattern
import { packageShellHostEnv, packageShellHostFetch } from './packageShellHostRuntime';

// Legacy components để inject
import SmartStatsHeader from '../components/modern/SmartStatsHeader';
import UnifiedAlertCenter from '../components/UnifiedAlertCenter';
import PortfolioHeatmap from '../components/modern/PortfolioHeatmap';

// Context hooks
import { usePortfolio } from '../contexts/PortfolioContext';
import { useLang } from '../contexts/LangContext';

// coreApiAdapter — SaaS data layer
import { createCoreApiAdapter } from '@vninvest/web';
```

### 4.2 Render props injection pattern

```jsx
export function PackageDashboardHost() {
  const { portfolioId } = usePortfolio();
  const { t } = useLang();
  
  // Create adapter instance với env từ runtime
  const adapter = useMemo(() => createCoreApiAdapter(packageShellHostEnv), []);

  // Render props — bridge từ SaaS data shape sang legacy component props
  const renderStatsHeader = useCallback((data) => (
    <SmartStatsHeader
      summary={data.summary}
      holdings={data.holdings}
      loading={data.loading}
      onRefresh={data.refresh}
    />
  ), []);

  const renderPositionDeck = useCallback((data) => (
    <FactsFirstModularPositionDeck
      holdings={data.holdings}
      bulkTechnicals={data.bulkTechnicals}
      portfolioId={data.portfolioId}
      loading={data.loading}
    />
  ), []);

  const renderAlertCenter = useCallback((data) => (
    <UnifiedAlertCenter
      externalAlerts={data.alertFeed.alerts}
      loading={data.alertFeed.loading}
      portfolioId={data.portfolioId}
    />
  ), []);

  const renderHeatmap = useCallback((data) => (
    data.analytics ? (
      <PortfolioHeatmap
        analytics={data.analytics}
        holdings={data.holdings}
      />
    ) : null
  ), []);

  return (
    <DashboardPage
      portfolioId={portfolioId}
      env={packageShellHostEnv}
      coreApiAdapter={adapter}
      renderStatsHeader={renderStatsHeader}
      renderPositionDeck={renderPositionDeck}
      renderAlertCenter={renderAlertCenter}
      renderHeatmap={renderHeatmap}
    />
  );
}
```

---

## 5. App.jsx — Route changes (DM-05)

```jsx
// DM-05.1 — Thêm import
import PackageDashboardHost from './pages/PackageDashboardHost';

// DM-05.1 — Swap route (giữ nguyên các routes khác)
// BEFORE:
<Route path="dashboard" element={<ModernDashboard />} />

// AFTER:
<Route path="dashboard" element={<PackageDashboardHost />} />
<Route path="dashboard/legacy" element={<ModernDashboard />} />  {/* shadow 3 ngày */}

// DM-07.2-3 — Sau decommission:
// Xóa route dashboard/legacy
// Xóa import ModernDashboard
```

---

## 6. CSS Class Naming Convention

Tất cả CSS classes của `packages/web` dùng prefix `core-` + BEM:

```css
/* Block */
.core-dashboard-page { }

/* Element */
.core-dashboard__stats { }
.core-dashboard__position-deck { }
.core-dashboard__alert-center { }
.core-dashboard__heatmap { }
.core-dashboard__skeleton { }
.core-dashboard__skeleton-bar { }
.core-dashboard__error-banner { }
.core-dashboard__metric-card { }
.core-dashboard__metric-label { }
.core-dashboard__metric-value { }

/* Modifier */
.core-dashboard-page--loading { }
.core-dashboard-page--error { }
```

---

## 7. Package.json / Build Notes

`packages/web` phải được built và có npm link/alias trước khi `frontend` có thể import `@vninvest/web`.

```json
// frontend/package.json hoặc vite config
{
  "dependencies": {
    "@vninvest/web": "file:../packages/web"  // hoặc workspace:*
  }
}
```

Verify alias tồn tại:
```powershell
Get-Content frontend/package.json | Select-String "@vninvest/web"
# Expected: 1 match
```
