# Kế hoạch triển khai: Dashboard SaaS Native Migration

**Ngày lập**: 2026-05-18  
**Phạm vi**: Migrate dashboard từ `ModernDashboard.jsx` (legacy apiClient) sang `DashboardPage.js` (`packages/web`, coreApiAdapter)  
**Trạng thái**: APPROVED FOR IMPLEMENTATION

---

## 1. Bối cảnh kỹ thuật

### Backend — trạng thái ĐÃ DONE

Sau khi B1 proxy và B4 portfolio cutover hoàn thành:
- nginx route `/api/*` → `core-api:8100` ✅
- `/api/portfolio/portfolios/{id}/holdings/` → `PortfolioHoldingsView` (core-api native) ✅
- `/api/portfolio/portfolios/{id}/summary/` → `PortfolioSummaryView` ✅
- `/api/portfolio/portfolios/{id}/analytics/` → `PortfolioAnalyticsView` ✅
- `/api/portfolio/portfolios/{id}/technicals/` → `PortfolioTechnicalsView` ✅
- `/api/stock-management/technicals/bulk/` → `StockManagementTechnicalsView` ✅
- `/api/stock-management/tracked-symbols/` → `TrackedSymbolListCreateView` ✅
- `/api/portfolio/watchlist/groups/` → `LegacyWatchlistGroupListView` ✅
- `/core/v1/signals/alert-center/feed` → Alert Center native ✅

**Không có backend change nào cần thiết trong toàn bộ migration plan này.**

### Frontend — khoảng cách cần lấp

| Điểm | Hiện trạng | Mục tiêu |
|------|-----------|--------|
| `/dashboard` route | `ModernDashboard` → `apiClient` | `PackageDashboardHost` → `DashboardPage` → `coreApiAdapter` |
| `coreApiAdapter.js` portfolio methods | Chỉ có `getPortfolios`, `getWatchlists` | Thêm 7 analytics methods |
| `packages/web/src/pages/DashboardPage.js` | Skeleton (list portfolios) | Full-featured (stats, heatmap, deck, alerts) |
| `useCoreDashboardData` hook | Không tồn tại | Create trong `packages/web/src/features/dashboard/` |
| `PackageDashboardHost.jsx` | Không tồn tại | Create trong `frontend/src/pages/` |

---

## 2. Slice DM-00 — Fix 5 Dashboard Bugs (Pre-flight, đã approved)

**Mục tiêu**: Sửa 5 lỗi được identify trong session audit. Không liên quan đến migration về kiến trúc, nhưng phải làm trước DM-01 để baseline sạch.

**Files bị ảnh hưởng**:
- `frontend/src/hooks/useAlertCenterFeed.js` (MODIFY)
- `frontend/src/components/UnifiedAlertCenter.jsx` (MODIFY)
- `frontend/src/api/client.js` (MODIFY)
- `frontend/src/components/modern/SmartStatsHeader.jsx` (MODIFY)
- `frontend/src/i18n/vi.js` (MODIFY)

**Thay đổi cụ thể**:

### Bug #1 — `useAlertCenterFeed.js` missing return keys

```js
// Trong return statement, thêm 3 keys sau unifiedPageIndex:
currentUnifiedPage: currentPageIndex,
hasPreviousUnifiedPage: currentPageIndex > 0,
hasLastUnifiedPage: cursorStack.length - 1 > currentPageIndex,
```

### Bug #2 — `UnifiedAlertCenter.jsx` audience filter enum

```jsx
// Lines ~300-301 — đổi:
{ value: 'holdings_only', label: t('dashboardRealtime.filterHoldingsOnly') },
{ value: 'watchlist_only', label: t('dashboardRealtime.filterWatchlistOnly') },
```

### Bug #3 — `client.js` window param dropped

```js
// Trong getAlertCenterFeed, thêm session_date khi window === 'session':
const payload = await coreApiAdapter.getAlertCenterFeed({
  symbol: normalizedSymbols.length === 1 ? normalizedSymbols[0] : undefined,
  severity,
  alert_family: undefined,
  page_size: Number.isFinite(Number(_limit)) ? Number(_limit) : undefined,
  cursor: cursor || undefined,
  session_date: _window === 'session' ? new Date().toISOString().slice(0, 10) : undefined,
});
```

### Bug #5 — `SmartStatsHeader.jsx` + `vi.js` i18n

```jsx
// SmartStatsHeader.jsx line ~51 — đổi:
{t('dashboard.breadthLabel')}
```

```js
// vi.js trong section dashboard — thêm:
breadthLabel: 'Độ rộng danh mục',
```

**DoD**:
- [ ] `useAlertCenterFeed` return có 3 keys mới
- [ ] `UnifiedAlertCenter` dùng `'holdings_only'` và `'watchlist_only'`
- [ ] `client.js` truyền `session_date` khi `window === 'session'`
- [ ] `SmartStatsHeader` dùng `t('dashboard.breadthLabel')`
- [ ] `vi.js` có key `dashboard.breadthLabel`
- [ ] `npm run build` frontend PASS

---

## 3. Slice DM-01 — Add Portfolio Analytics Methods to coreApiAdapter

**Mục tiêu**: Thêm 7 methods vào `coreApiAdapter.js` factory để `useCoreDashboardData` và `DashboardPage` có thể gọi portfolio analytics từ core-api.

**Files bị ảnh hưởng**:
- `packages/web/src/adapters/coreApiAdapter.js` (MODIFY — thêm 7 methods vào factory return)
- `packages/web/src/adapters/coreApiAdapter.test.js` (MODIFY — thêm test cases)

**Interface cần implement**:

```js
// Thêm vào factory return object trong createCoreApiAdapter():

/**
 * Lấy danh sách holdings của một portfolio.
 * GET /core/v1/portfolio/portfolios/{portfolioId}/holdings/
 */
getPortfolioHoldings(portfolioId) {
  if (!portfolioId) throw new Error("portfolioId is required for getPortfolioHoldings");
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/holdings/`);
},

/**
 * Lấy summary tổng quan của một portfolio.
 * GET /core/v1/portfolio/portfolios/{portfolioId}/summary/
 */
getPortfolioSummary(portfolioId) {
  if (!portfolioId) throw new Error("portfolioId is required for getPortfolioSummary");
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/summary/`);
},

/**
 * Lấy analytics (P&L chart, equity curve) của một portfolio.
 * GET /core/v1/portfolio/portfolios/{portfolioId}/analytics/?days={days}
 */
getPortfolioAnalytics(portfolioId, days = 30) {
  if (!portfolioId) throw new Error("portfolioId is required for getPortfolioAnalytics");
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/analytics/?days=${days}`);
},

/**
 * Lấy technicals tổng hợp cho toàn bộ portfolio.
 * GET /core/v1/portfolio/portfolios/{portfolioId}/technicals/
 */
getPortfolioTechnicals(portfolioId) {
  if (!portfolioId) throw new Error("portfolioId is required for getPortfolioTechnicals");
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/technicals/`);
},

/**
 * Bulk technicals cho danh sách symbols (GET với query param).
 * GET /api/stock-management/technicals/bulk/?symbols=VCB,HPG,...
 * NOTE: Endpoint này ở /api/ (market_data.public_urls), không ở /core/v1/.
 * Dùng legacyApiGet() thay coreGet() vì base path khác.
 */
getBulkTechnicalsBySymbols(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return Promise.resolve([]);
  const query = `symbols=${symbols.map(encodeURIComponent).join(",")}`;
  return legacyApiGet(`/stock-management/technicals/bulk/?${query}`);
},

/**
 * Lấy danh sách tracked symbols của user.
 * GET /core/v1/stock-management/tracked-symbols/
 */
getTrackedSymbols() {
  return coreGet("/stock-management/tracked-symbols/");
},

/**
 * Lấy danh sách watchlist groups (legacy response shape).
 * GET /core/v1/portfolio/watchlist/groups/
 */
getLegacyWatchlistGroups() {
  return coreGet("/portfolio/watchlist/groups/");
},
```

**Lưu ý về `legacyApiGet()`**: Cần thêm transport helper nội bộ trong coreApiAdapter.js gọi `/api/` base thay vì `/core/v1/`. Xem TECH_SPEC section 3.1 để biết chi tiết implementation.

**Test cases bắt buộc** (trong `coreApiAdapter.test.js`):
1. `getPortfolioHoldings("1")` → gọi `coreGet("/portfolio/portfolios/1/holdings/")`
2. `getPortfolioHoldings(undefined)` → throw Error "portfolioId is required"
3. `getPortfolioSummary("1")` → gọi đúng path
4. `getPortfolioAnalytics("1", 60)` → path có `?days=60`
5. `getPortfolioTechnicals("1")` → gọi đúng path
6. `getBulkTechnicalsBySymbols(["VCB","HPG"])` → gọi `/api/stock-management/technicals/bulk/?symbols=VCB,HPG`
7. `getBulkTechnicalsBySymbols([])` → return empty array không fetch
8. `getTrackedSymbols()` → gọi đúng path
9. `getLegacyWatchlistGroups()` → gọi đúng path

**DoD**:
- [ ] 7 methods tồn tại và hoạt động trong factory return
- [ ] `legacyApiGet()` helper tồn tại (private, không export)
- [ ] `coreApiAdapter.test.js` có ≥ 9 test cases mới, tất cả PASS
- [ ] Không có method duplicate với existing
- [ ] No type errors nếu có JSDoc annotations

---

## 4. Slice DM-02 — Create `useCoreDashboardData` Hook

**Mục tiêu**: Tạo React hook tập trung toàn bộ data fetching cho dashboard, dùng `coreApiAdapter`. Không dùng `apiClient`.

**Files bị ảnh hưởng**:
- `packages/web/src/features/dashboard/useCoreDashboardData.js` (CREATE)

**Interface**:

```js
/**
 * Hook trung tâm cho data layer của dashboard.
 * Dùng coreApiAdapter, không phụ thuộc apiClient.
 * 
 * @param {object} options
 * @param {object} options.env - Environment config cho coreApiAdapter
 * @param {number|string|null} options.portfolioId - ID portfolio cần load
 * @returns {DashboardDataState}
 */
export function useCoreDashboardData({ env = {}, portfolioId = null } = {}) {
  // Returns:
  return {
    loading: false,          // boolean — true khi đang fetch
    error: null,             // string | null
    holdings: [],            // Array<HoldingItem>
    summary: null,           // PortfolioSummary | null
    analytics: null,         // PortfolioAnalytics | null
    technicals: null,        // PortfolioTechnicals | null
    trackedSymbols: [],      // Array<TrackedSymbol>
    watchlistGroups: [],     // Array<WatchlistGroup>
    bulkTechnicals: {},      // Record<symbol, TechnicalData>
    alertFeed: {
      alerts: [],
      summary: null,
      loading: false,
    },
    refresh: () => void,     // re-trigger tất cả fetch
  };
}
```

**DoD**:
- [ ] File tồn tại tại đúng path
- [ ] Hook sử dụng `coreApiAdapter({ env })` — không import `apiClient`
- [ ] Dùng `AbortController` trong `useEffect` cleanup
- [ ] `portfolioId` là required dependency — khi null, không fetch portfolio data
- [ ] Loading state: `true` trong lúc fetch, `false` sau resolve/reject
- [ ] `refresh()` re-trigger tất cả requests
- [ ] `alertFeed` gọi `coreApiAdapter.getAlertCenterFeed()` với `page_size` hợp lý

---

## 5. Slice DM-03 — Upgrade DashboardPage.js to Full-Featured

**Mục tiêu**: Nâng cấp `packages/web/src/pages/DashboardPage.js` từ skeleton thành full-featured dashboard với slot/render-prop pattern. Không JSX.

**Files bị ảnh hưởng**:
- `packages/web/src/pages/DashboardPage.js` (REWRITE toàn bộ)

**Interface props của DashboardPage**:

```js
/**
 * @param {object} props
 * @param {object} props.env - Core API env config
 * @param {number|string|null} props.portfolioId - Active portfolio ID
 * @param {string} [props.className] - Optional CSS class
 * 
 * Slot renderers (optional — fallback về built-in nếu null):
 * @param {function|null} props.renderStatsHeader - (data) => ReactElement
 * @param {function|null} props.renderPositionDeck - (data) => ReactElement
 * @param {function|null} props.renderAlertCenter - (data) => ReactElement
 * @param {function|null} props.renderHeatmap - (data) => ReactElement
 * @param {function|null} props.renderBubble - (data) => ReactElement
 */
export function DashboardPage({
  env = {},
  portfolioId = null,
  className = "",
  renderStatsHeader = null,
  renderPositionDeck = null,
  renderAlertCenter = null,
  renderHeatmap = null,
  renderBubble = null,
}) { ... }
```

**Layout sections**:

```
DashboardPage
  ├── Loading/Error state
  ├── Section: Stats Header
  │     ├── Nếu renderStatsHeader prop: dùng nó
  │     └── Fallback: built-in SmartStatsHeaderFallback (3 metrics cơ bản)
  ├── Section: Position Deck (holdings list)
  │     ├── Nếu renderPositionDeck prop: dùng nó
  │     └── Fallback: built-in SimpleHoldingsList
  ├── Section: Alert Center
  │     ├── Nếu renderAlertCenter prop: dùng nó
  │     └── Fallback: built-in AlertCenterFallback (list 5 alerts)
  ├── Section: Heatmap
  │     ├── Nếu renderHeatmap prop: dùng nó
  │     └── Fallback: null (không render)
  └── Section: Bubble/Advisory
        ├── Nếu renderBubble prop: dùng nó
        └── Fallback: null (không render)
```

**DoD**:
- [ ] File không chứa JSX (chỉ `createElement`)
- [ ] `DashboardPage` accept 5 render props slots
- [ ] Loading skeleton hiển thị khi `loading === true`
- [ ] Error state hiển thị khi `error !== null`
- [ ] Stats fallback hiển thị `summary.market_value`, `summary.unrealized_pl`, holdings count
- [ ] Holdings fallback hiển thị list với symbol + current_value + pnl_percent
- [ ] Alert fallback hiển thị 5 alerts gần nhất với type badge
- [ ] i18n: tất cả text hardcode tiếng Việt có dấu đúng chuẩn
- [ ] `DashboardPage` được export từ `packages/web/src/index.js` (đã có, không cần thêm)

---

## 6. Slice DM-04 — Create PackageDashboardHost.jsx

**Mục tiêu**: Tạo host component trong `frontend/src/` để mount `DashboardPage` từ `@vninvest/web`, inject legacy components qua render props, bridge PortfolioContext.

**Files bị ảnh hưởng**:
- `frontend/src/pages/PackageDashboardHost.jsx` (CREATE)

**Responsibilities**:
1. Đọc `portfolioId` từ `PortfolioContext`
2. Import các components từ `frontend/src/components/`:
   - `SmartStatsHeader` (stats slot)
   - `FactsFirstModularPositionDeck` (deck slot)
   - `UnifiedAlertCenter` (alert slot)
   - `PortfolioHeatmap` (heatmap slot)
3. Inject chúng vào `DashboardPage` qua render props
4. Wrap với `LangContext` và required providers

**DoD**:
- [ ] File tồn tại tại đúng path
- [ ] Import `DashboardPage` từ `@vninvest/web` (không trực tiếp từ `packages/web/src/`)
- [ ] Inject đủ 5 render props slots
- [ ] `portfolioId` lấy từ `usePortfolio()` context
- [ ] Không import `apiClient` — data fetching do `DashboardPage` + `useCoreDashboardData` tự xử lý
- [ ] `LangContext` / i18n providers được preserve

---

## 7. Slice DM-05 — Route Swap + Shadow

**Mục tiêu**: Swap route `/dashboard` sang `PackageDashboardHost` trong `App.jsx`. Thêm shadow route `/dashboard/legacy` để parity so sánh trong 3 ngày.

**Files bị ảnh hưởng**:
- `frontend/src/App.jsx` (MODIFY — 2 route changes)

**Thay đổi**:
```jsx
// Trước:
<Route path="dashboard" element={<ModernDashboard />} />

// Sau:
<Route path="dashboard" element={<PackageDashboardHost />} />
<Route path="dashboard/legacy" element={<ModernDashboard />} /> {/* Shadow — xóa sau DM-06 */}
```

**DoD**:
- [ ] `/dashboard` render `PackageDashboardHost`
- [ ] `/dashboard/legacy` render `ModernDashboard` (shadow reference)
- [ ] `PackageDashboardHost` import trong App.jsx đúng path
- [ ] `npm run build` frontend PASS
- [ ] `./start_dev.ps1` → smoke test: `/dashboard` load, heatmap/deck/alerts hiển thị

---

## 8. Slice DM-06 — Parity Validation (3-Day Gate)

**Mục tiêu**: Xác nhận `/dashboard` (new) có parity ≥ 99% so với `/dashboard/legacy` (old) trong 3 ngày trade.

**Gate criteria**:

| Metric | Pass condition |
|--------|---------------|
| `summary.market_value` | Delta ≤ 1% so với legacy |
| `holdings.length` | Phải bằng nhau 100% |
| `trackedSymbols.length` | Phải bằng nhau 100% |
| `watchlistGroups` có data | Cả 2 đều show groups |
| Alert center load | Không có JS error |
| Console JS errors | 0 errors trong session |

**DoD**:
- [ ] `docs/DASHBOARD_MIGRATION_PARITY_REPORT.md` tồn tại với evidence 3 ngày
- [ ] Tất cả 6 metrics PASS ≥ 99%
- [ ] Screen-recorded evidence ít nhất 1 phiên giao dịch đầy đủ
- [ ] Tech Lead review và sign-off

---

## 9. Slice DM-07 — Decommission Legacy Dashboard

**Pre-conditions (BLOCKING)** — tất cả phải PASS:
- [ ] DM-06 PASS với 3-day parity evidence
- [ ] Tech Lead sign-off trên parity report
- [ ] Shadow route `/dashboard/legacy` được inform người dùng trước ít nhất 1 ngày

**Files bị ảnh hưởng**:
- `frontend/src/App.jsx` (MODIFY — xóa legacy route + import)
- `frontend/src/pages/modern/ModernDashboard.jsx` (DELETE)

**DoD**:
- [ ] Route `dashboard/legacy` được xóa khỏi `App.jsx`
- [ ] Import `ModernDashboard` được xóa khỏi `App.jsx`
- [ ] `frontend/src/pages/modern/ModernDashboard.jsx` bị xóa
- [ ] `npm run build` PASS sau khi xóa
- [ ] `./start_dev.ps1` → `/dashboard` vẫn load bình thường
- [ ] `CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md` được cập nhật
- [ ] `module_tree_full.md` được regenerate

---

## 10. Validation gates toàn workstream

- [ ] `npm run build` frontend exit 0 sau mỗi slice có frontend change
- [ ] `./start_dev.ps1` healthy sau DM-05
- [ ] `/core/v1/portfolio/portfolios/{id}/holdings/` → 200 OK (manual verify)
- [ ] `coreApiAdapter.test.js` tất cả tests PASS sau DM-01
- [ ] `/dashboard` load ≤ 3s sau DM-05 (không performance regression)
- [ ] Không có `import.*apiClient` trong `packages/web/src/` sau DM-04
- [ ] Không còn `ModernDashboard` import trong codebase sau DM-07
