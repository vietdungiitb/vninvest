# TECH SPEC — Dashboard SaaS Native Migration

**Ngày tạo**: 2026-05-18  
**Scope**: API contracts, data models, component interfaces, và technical decisions  
**Level**: B (Frontend migration + API layer extension)  
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Nguyên tắc kỹ thuật bất biến

1. **coreApiAdapter là SSOT duy nhất** cho mọi API call trong `packages/web/` — không direct fetch, không import `apiClient`.
2. **Không JSX trong `packages/web/src/`** — chỉ `createElement` thuần. Convention này bắt buộc cho toàn bộ `packages/web/src/pages/`, `features/`, và `components/`.
3. **Slot injection pattern** — `DashboardPage` không import bất kỳ component nào từ `frontend/src/`. Tất cả legacy components được inject qua render props từ `PackageDashboardHost`.
4. **Immutable source constraint** — `WhaleBubbleChart`, `ModularPositionDeck`, `WhaleAnalyticsTab` chỉ được inject qua props, không sửa trực tiếp.
5. **No backend changes** — Tất cả endpoints đã tồn tại trong core-api. Migration này là thuần frontend.
6. **AbortController cho fetch cleanup** — Mọi `useEffect` có async fetch phải dùng `AbortController` để tránh state update sau unmount.
7. **Parity gate bắt buộc** — Không được decommission trước khi DM-06 PASS 3 ngày calendar.

---

## 2. Backend API Inventory (đã tồn tại, không thay đổi)

### 2.1 Portfolio Analytics (user_workspace app)

| Endpoint | View | Method | Auth |
|----------|------|--------|------|
| `/core/v1/portfolio/portfolios/{id}/holdings/` | `PortfolioHoldingsView` | GET | Bearer |
| `/core/v1/portfolio/portfolios/{id}/summary/` | `PortfolioSummaryView` | GET | Bearer |
| `/core/v1/portfolio/portfolios/{id}/analytics/` | `PortfolioAnalyticsView` | GET `?days=N` | Bearer |
| `/core/v1/portfolio/portfolios/{id}/technicals/` | `PortfolioTechnicalsView` | GET | Bearer |
| `/core/v1/stock-management/tracked-symbols/` | `TrackedSymbolListCreateView` | GET | Bearer |
| `/core/v1/portfolio/watchlist/groups/` | `LegacyWatchlistGroupListView` | GET | Bearer |

**File nguồn**: `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` và `user_workspace/legacy_views.py`

### 2.2 Market Data (market_data app)

| Endpoint | View | Method | Auth |
|----------|------|--------|------|
| `/api/stock-management/technicals/bulk/` | `StockManagementTechnicalsView` | GET `?symbols=` | Bearer |

**File nguồn**: `packages/core/backend/src/market_data/stock_mgmt_native_views.py`  
**Lưu ý**: Endpoint này nằm ở `market_data.public_urls` (mount tại `/api/`), không phải `/core/v1/`. Cần dùng `legacyApiGet()` trong coreApiAdapter.

### 2.3 Alert Center (signal_intelligence app)

| Endpoint | Method | Auth |
|----------|--------|------|
| `/core/v1/signals/alert-center/feed` | GET | Bearer |
| `/core/v1/signals/alert-center/summary` | GET | Bearer |

### 2.4 Response shapes (tham khảo)

#### PortfolioHoldings response
```json
{
  "count": 12,
  "results": [
    {
      "symbol": "VCB",
      "quantity": 1000,
      "average_cost": 85000,
      "current_price": 92000,
      "market_value": 92000000,
      "unrealized_pl": 7000000,
      "unrealized_pl_percent": 8.24,
      "weight": 0.15
    }
  ]
}
```

#### PortfolioSummary response
```json
{
  "portfolio_id": 1,
  "total_cost": 580000000,
  "market_value": 650000000,
  "unrealized_pl": 70000000,
  "unrealized_pl_percent": 12.07,
  "total_holdings": 12,
  "cash_balance": 0,
  "breadth_up": 8,
  "breadth_down": 4,
  "breadth_flat": 0
}
```

---

## 3. Frontend API Layer (DM-01)

### 3.1 legacyApiGet() transport helper

Cần thêm private transport function trong `coreApiAdapter.js` để call `/api/` paths (thay vì `/core/v1/`) vì endpoint `technicals/bulk` chỉ được mount tại `/api/` trong core-api.

```js
// Private helper — KHÔNG export
function createLegacyApiTransport(env = {}, transportOptions = {}) {
  const { getToken = () => null } = transportOptions;
  const base = resolveCoreApiBase(env).replace(/\/core\/v1\/?$/, "");
  // base sẽ là "" (empty) hoặc "https://domain.com" — để /api/ là path prefix

  return async function legacyApiGet(path, options = {}) {
    const url = `${base}/api${path}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Request-Id": generateRequestId(),
      ...getAuthorizationHeader(getToken),
    };
    const resp = await fetch(url, { method: "GET", headers, signal: options.signal });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      const err = new Error(body?.detail || `HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  };
}
```

### 3.2 Thêm vào createCoreApiAdapter factory

```js
// Trong createCoreApiAdapter(env, options):
const legacyApiGet = createLegacyApiTransport(env, options)();
// Truyền legacyApiGet vào closure để các methods có thể dùng
```

### 3.3 coreApiAdapter.js — vị trí thêm methods

Thêm 7 methods mới vào **cuối** của factory return object, sau `deleteWatchlistItem`:

```js
  // ============================================================
  // DM-01: Portfolio Analytics Methods
  // ============================================================

  getPortfolioHoldings(portfolioId) { ... },
  getPortfolioSummary(portfolioId) { ... },
  getPortfolioAnalytics(portfolioId, days = 30) { ... },
  getPortfolioTechnicals(portfolioId) { ... },
  getBulkTechnicalsBySymbols(symbols = []) { ... }, // dùng legacyApiGet
  getTrackedSymbols() { ... },
  getLegacyWatchlistGroups() { ... },
```

---

## 4. useCoreDashboardData Hook Design (DM-02)

### 4.1 File location
```
packages/web/src/features/dashboard/useCoreDashboardData.js
```

### 4.2 Data loading strategy

```
Mount / portfolioId change
  ↓
Parallel fetch:
  ├── getPortfolioHoldings(portfolioId)     → holdings state
  ├── getPortfolioSummary(portfolioId)      → summary state
  ├── getPortfolioAnalytics(portfolioId)    → analytics state
  ├── getPortfolioTechnicals(portfolioId)   → technicals state
  ├── getTrackedSymbols()                   → trackedSymbols state
  └── getLegacyWatchlistGroups()            → watchlistGroups state

After holdings resolved:
  └── getBulkTechnicalsBySymbols(holdingSymbols) → bulkTechnicals state

Separate effect:
  └── getAlertCenterFeed()                  → alertFeed state
```

### 4.3 State machine

```
IDLE (portfolioId === null) → không fetch, trả loading: false, data rỗng

LOADING → fetch đang chạy, loading: true

SUCCESS → tất cả fetches resolve, loading: false

ERROR → bất kỳ fetch nào throw, loading: false, error: string
```

### 4.4 AbortController pattern

```js
useEffect(() => {
  if (!portfolioId) return;
  const controller = new AbortController();
  
  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const adapter = coreApiAdapter({ env });
      const [holdingsRes, summaryRes, analyticsRes, technicalsRes, trackedRes, watchlistRes] =
        await Promise.all([
          adapter.getPortfolioHoldings(portfolioId),
          adapter.getPortfolioSummary(portfolioId),
          adapter.getPortfolioAnalytics(portfolioId, 30),
          adapter.getPortfolioTechnicals(portfolioId),
          adapter.getTrackedSymbols(),
          adapter.getLegacyWatchlistGroups(),
        ]);
      
      if (controller.signal.aborted) return;
      
      // resolve holdings symbols for bulk technicals
      const symbols = (holdingsRes?.results ?? []).map(h => h.symbol).filter(Boolean);
      const bulkRes = symbols.length > 0
        ? await adapter.getBulkTechnicalsBySymbols(symbols)
        : [];
      
      if (controller.signal.aborted) return;
      
      setState({ /* ... */ });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!mountedRef.current) return;
      setError(err?.message || "Không thể tải dữ liệu dashboard.");
    } finally {
      if (!controller.signal.aborted && mountedRef.current) setLoading(false);
    }
  }
  
  fetchAll();
  return () => controller.abort();
}, [portfolioId, refreshToken, /* env stable ref */]);
```

---

## 5. DashboardPage Slot Injection Pattern (DM-03)

### 5.1 Render prop contract

```js
// Mỗi slot renderer nhận một data object:
renderStatsHeader({ summary, holdings, loading })
renderPositionDeck({ holdings, bulkTechnicals, summary, loading })
renderAlertCenter({ alertFeed, trackedSymbols, watchlistGroups, loading })
renderHeatmap({ holdings, bulkTechnicals, summary })
renderBubble({ holdings, summary, analytics })
```

### 5.2 Fallback behavior

Khi một slot renderer là `null`, DashboardPage render fallback built-in tối giản:

| Slot | Fallback content |
|------|-----------------|
| `renderStatsHeader` | 3 metric cards: market_value, unrealized_pl, breadth |
| `renderPositionDeck` | Simple `<ul>` list holdings với symbol + value + pnl% |
| `renderAlertCenter` | List 5 alerts với type badge và timestamp |
| `renderHeatmap` | `null` (không render section) |
| `renderBubble` | `null` (không render section) |

### 5.3 Skeleton loading state

Khi `loading === true`, render skeleton structure dùng CSS classes:

```js
createElement("div", { className: "core-dashboard--loading" },
  createElement("div", { className: "core-dashboard__skeleton core-dashboard__skeleton--stats" }),
  createElement("div", { className: "core-dashboard__skeleton core-dashboard__skeleton--deck" }),
)
```

---

## 6. PackageDashboardHost Design (DM-04)

### 6.1 Responsibilities

```jsx
import { DashboardPage } from '@vninvest/web';
import SmartStatsHeader from '../components/modern/SmartStatsHeader';
import FactsFirstModularPositionDeck from '../components/modern/FactsFirstModularPositionDeck';
import UnifiedAlertCenter from '../components/UnifiedAlertCenter';
import PortfolioHeatmap from '../components/PortfolioHeatmap';

export default function PackageDashboardHost() {
  const { portfolioId } = usePortfolio();   // ← từ PortfolioContext
  const { t } = useLang();                  // ← từ LangContext

  return (
    <DashboardPage
      portfolioId={portfolioId}
      env={packageShellHostEnv}            // ← reuse từ packageShellHostRuntime.js
      renderStatsHeader={(data) => (
        <SmartStatsHeader summary={data.summary} holdings={data.holdings} loading={data.loading} />
      )}
      renderPositionDeck={(data) => (
        <FactsFirstModularPositionDeck holdings={data.holdings} bulkTechnicals={data.bulkTechnicals} />
      )}
      renderAlertCenter={(data) => (
        <UnifiedAlertCenter alerts={data.alertFeed.alerts} summary={data.alertFeed.summary} />
      )}
      renderHeatmap={(data) => (
        <PortfolioHeatmap holdings={data.holdings} technicals={data.bulkTechnicals} />
      )}
    />
  );
}
```

### 6.2 packageShellHostEnv reuse

`PackageDashboardHost.jsx` import `packageShellHostEnv` từ `./packageShellHostRuntime` (đã tồn tại) để đảm bảo cùng API base URL config.

---

## 7. Route Architecture (DM-05)

### 7.1 App.jsx changes

```jsx
// Thêm import:
import PackageDashboardHost from './pages/PackageDashboardHost';
// ModernDashboard import giữ lại tạm thời cho shadow route

// Route changes:
<Route path="dashboard" element={<PackageDashboardHost />} />
<Route path="dashboard/legacy" element={<ModernDashboard />} /> {/* Shadow — xóa sau DM-06 */}
```

### 7.2 Route không thay đổi

- `/dashboard/shell` → `DashboardShellHost` → `ShellDashboardPage` (operator diagnostic — KHÔNG phải user dashboard)
- Tất cả routes khác giữ nguyên

---

## 8. Parity Validation (DM-06)

### 8.1 Metric comparison protocol

```powershell
# Collect metrics từ cả 2 routes (chạy mỗi ngày trong 3 ngày trade)
$BASE = "http://localhost"
$TOKEN = "<admin token>"
$H = @{ "Authorization" = "Bearer $TOKEN" }

# New dashboard endpoint check
$summaryNew = (Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/1/summary/" -Headers $H)
$holdingsNew = (Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/1/holdings/" -Headers $H)

# Legacy dashboard endpoint check (cùng data source vì cùng core-api)
$summaryLegacy = (Invoke-RestMethod "$BASE/api/portfolio/portfolios/1/summary/" -Headers $H)
$holdingsLegacy = (Invoke-RestMethod "$BASE/api/portfolio/portfolios/1/holdings/" -Headers $H)

# Compare
$marketValueDelta = [math]::Abs($summaryNew.market_value - $summaryLegacy.market_value) / $summaryLegacy.market_value * 100
Write-Host "Market value delta: $marketValueDelta%"
Write-Host "Holdings count match: $($holdingsNew.count -eq $holdingsLegacy.count)"
```

---

## 9. Decommission Checklist (DM-07)

**Pre-conditions gates** — không được decommission nếu bất kỳ gate nào FAIL:

```
A. DM-06 parity report EXISTS tại docs/DASHBOARD_MIGRATION_PARITY_REPORT.md
B. Tất cả 6 parity metrics PASS ≥ 99% trong 3 ngày liên tiếp
C. Tech Lead signed-off trên parity report
D. /dashboard/legacy đã được inform 1 ngày trước (internal announce)
E. npm run build PASS (clean) trước khi delete
F. Không có open P0/P1 bugs liên quan đến dashboard mới
G. module_tree_full.md sẽ được regenerate ngay sau khi delete
```
