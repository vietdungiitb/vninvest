# TRACEABILITY MATRIX — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Scope**: 8 slices, 25 requirements

---

## 1. Requirements

| ID | Requirement | Priority | Slice |
|----|-------------|----------|-------|
| DM-REQ-01 | `useAlertCenterFeed` return object có `currentUnifiedPage`, `hasPreviousUnifiedPage`, `hasLastUnifiedPage` | P0 | DM-00 |
| DM-REQ-02 | Audience filter trong `UnifiedAlertCenter` dùng `'holdings_only'` và `'watchlist_only'` | P0 | DM-00 |
| DM-REQ-03 | `client.js` truyền `session_date` vào `coreApiAdapter.getAlertCenterFeed` khi `window === 'session'` | P1 | DM-00 |
| DM-REQ-04 | `SmartStatsHeader` dùng `t('dashboard.breadthLabel')`, key tồn tại trong `vi.js` | P1 | DM-00 |
| DM-REQ-05 | `coreApiAdapter.js` có `legacyApiGet()` private transport cho `/api/` paths | P0 | DM-01 |
| DM-REQ-06 | `getPortfolioHoldings(portfolioId)` và `getPortfolioSummary(portfolioId)` tồn tại trong coreApiAdapter factory | P0 | DM-01 |
| DM-REQ-07 | `getPortfolioAnalytics(portfolioId, days)` và `getPortfolioTechnicals(portfolioId)` tồn tại | P0 | DM-01 |
| DM-REQ-08 | `getBulkTechnicalsBySymbols(symbols)` dùng `legacyApiGet`, trả rỗng khi symbols = [] | P0 | DM-01 |
| DM-REQ-09 | `getTrackedSymbols()` và `getLegacyWatchlistGroups()` tồn tại | P0 | DM-01 |
| DM-REQ-10 | `useCoreDashboardData` hook export từ `packages/web/src/features/dashboard/`, dùng `coreApiAdapter`, có `refresh()` | P0 | DM-02 |
| DM-REQ-11 | `useCoreDashboardData` gọi `getBulkTechnicalsBySymbols` sau khi holdings resolve | P1 | DM-02 |
| DM-REQ-12 | `useCoreDashboardData` fetch alert feed riêng, expose `alertFeed.loading` | P1 | DM-02 |
| DM-REQ-13 | `DashboardPage.js` trong `packages/web/` accept 5 render props slots, không JSX | P0 | DM-03 |
| DM-REQ-14 | Mỗi slot có fallback UI khi prop là null (stats: 3 metrics, deck: list, alerts: 5 items) | P1 | DM-03 |
| DM-REQ-15 | `DashboardPage` có skeleton loading state khi `loading === true` | P1 | DM-03 |
| DM-REQ-16 | Tất cả text mới trong `packages/web/src/` là tiếng Việt có dấu đúng chuẩn | P0 | DM-03 |
| DM-REQ-17 | `PackageDashboardHost.jsx` tồn tại trong `frontend/src/pages/`, import `DashboardPage` từ `@vninvest/web` | P0 | DM-04 |
| DM-REQ-18 | `PackageDashboardHost` inject đủ 4 slots: stats, deck, alert, heatmap từ legacy components | P0 | DM-04 |
| DM-REQ-19 | `/dashboard` route trỏ `PackageDashboardHost`; `/dashboard/legacy` trỏ `ModernDashboard` (shadow) | P0 | DM-05 |
| DM-REQ-20 | `/dashboard` smoke test PASS: load, stats, deck, alerts, heatmap hiển thị data, 0 JS errors | P0 | DM-05 |
| DM-REQ-21 | Parity metrics được ghi lại đủ 3 ngày trade trong `DASHBOARD_MIGRATION_PARITY_REPORT.md` | P0 | DM-06 |
| DM-REQ-22 | Parity ≥ 99% trên 6 metrics trong 3 ngày liên tiếp, Tech Lead sign-off | P0 | DM-06 |
| DM-REQ-23 | 7 pre-decommission gates (A–G) PASS trước khi xóa file | P0 | DM-07 |
| DM-REQ-24 | `ModernDashboard.jsx` bị xóa; không còn import nào trong codebase; build PASS | P0 | DM-07 |
| DM-REQ-25 | `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md` cập nhật sau DM-07 | P0 | DM-07 |

---

## 2. Requirement → Slice mapping

| Req ID | Slice | Task ID | Verification method |
|--------|-------|---------|---------------------|
| DM-REQ-01 | DM-00 | DM-00.1 | Grep return object trong useAlertCenterFeed.js |
| DM-REQ-02 | DM-00 | DM-00.2 | Grep `'holdings_only'` và `'watchlist_only'` trong UnifiedAlertCenter.jsx |
| DM-REQ-03 | DM-00 | DM-00.3 | Grep `session_date` trong client.js getAlertCenterFeed |
| DM-REQ-04 | DM-00 | DM-00.4 | Grep `t('dashboard.breadthLabel')` trong SmartStatsHeader.jsx + key trong vi.js |
| DM-REQ-05 | DM-01 | DM-01.1 | Grep `legacyApiGet` hoặc `createLegacyApiTransport` trong coreApiAdapter.js |
| DM-REQ-06 | DM-01 | DM-01.2 | Grep `getPortfolioHoldings` và `getPortfolioSummary` trong factory return |
| DM-REQ-07 | DM-01 | DM-01.3 | Grep `getPortfolioAnalytics` và `getPortfolioTechnicals` trong factory return |
| DM-REQ-08 | DM-01 | DM-01.4 | Test case: getBulkTechnicalsBySymbols([]) không fetch |
| DM-REQ-09 | DM-01 | DM-01.5 | Grep `getTrackedSymbols` và `getLegacyWatchlistGroups` trong factory return |
| DM-REQ-10 | DM-02 | DM-02.1–5 | File tồn tại; AbortController trong source; refresh() trong return |
| DM-REQ-11 | DM-02 | DM-02.3 | Code review: getBulkTechnicalsBySymbols called after holdings resolve |
| DM-REQ-12 | DM-02 | DM-02.4 | alertFeed.loading state riêng trong state object |
| DM-REQ-13 | DM-03 | DM-03.1–2 | `grep -c "createElement" DashboardPage.js` > 0; không có `<` JSX syntax |
| DM-REQ-14 | DM-03 | DM-03.2 | Fallback renders được call khi slot props là null |
| DM-REQ-15 | DM-03 | DM-03.3 | `core-dashboard--loading` class tồn tại trong source |
| DM-REQ-16 | DM-03 | DM-03.4 | No English text trong UI-visible strings |
| DM-REQ-17 | DM-04 | DM-04.1–3 | File tồn tại; `import.*DashboardPage.*@vninvest/web` trong source |
| DM-REQ-18 | DM-04 | DM-04.2 | Grep `renderStatsHeader`, `renderPositionDeck`, `renderAlertCenter`, `renderHeatmap` |
| DM-REQ-19 | DM-05 | DM-05.1 | Grep routes trong App.jsx |
| DM-REQ-20 | DM-05 | DM-05.3 | Manual smoke test + screenshot |
| DM-REQ-21 | DM-06 | DM-06.1–3 | File `docs/DASHBOARD_MIGRATION_PARITY_REPORT.md` có 3 ngày entries |
| DM-REQ-22 | DM-06 | DM-06.4 | Parity report có Tech Lead sign-off section |
| DM-REQ-23 | DM-07 | DM-07.1 | Gates A–G checklist completed |
| DM-REQ-24 | DM-07 | DM-07.2–5 | `git status` không còn ModernDashboard.jsx; build PASS |
| DM-REQ-25 | DM-07 | DM-07.6 | Governance files updated; timestamps mới |

---

## 3. Slice → Files mapping

| Slice | Files Modified | Files Created | Files Deleted |
|-------|---------------|---------------|---------------|
| DM-00 | `useAlertCenterFeed.js`, `UnifiedAlertCenter.jsx`, `client.js`, `SmartStatsHeader.jsx`, `vi.js` | — | — |
| DM-01 | `coreApiAdapter.js`, `coreApiAdapter.test.js` | — | — |
| DM-02 | — | `packages/web/src/features/dashboard/useCoreDashboardData.js` | — |
| DM-03 | `packages/web/src/pages/DashboardPage.js` | — | — |
| DM-04 | — | `frontend/src/pages/PackageDashboardHost.jsx` | — |
| DM-05 | `frontend/src/App.jsx` | — | — |
| DM-06 | — | `docs/DASHBOARD_MIGRATION_PARITY_REPORT.md` | — |
| DM-07 | `frontend/src/App.jsx`, `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md` | — | `frontend/src/pages/modern/ModernDashboard.jsx` |

---

## 4. Risk registry

| Risk ID | Risk | Probability | Impact | Mitigation |
|---------|------|-------------|--------|------------|
| R-01 | `packages/web` không build được vì import resolution issue với `useCoreDashboardData` | M | H | Test build sau DM-02 trước DM-03 |
| R-02 | `legacyApiGet()` gọi `/api/` path nhưng CORS block nếu domain khác | L | H | nginx config đã route `/api/*` → core-api, cùng domain |
| R-03 | `getBulkTechnicalsBySymbols` endpoint không tồn tại ở expected path | M | M | Verify bằng `curl /api/stock-management/technicals/bulk/?symbols=VCB` trước DM-01.4 |
| R-04 | `FactsFirstModularPositionDeck` cần props không có trong slot data shape | M | M | Map props wrapper trong `renderPositionDeck` lambda của PackageDashboardHost |
| R-05 | Parity drift do timing difference giữa 2 routes render | L | L | Collect metrics từ API directly, không so sánh UI render time |
| R-06 | `AbortController` không được support trên browser cũ | L | L | Polyfill đã có trong vite/webpack target; không cần action |
| R-07 | Shadow route `/dashboard/legacy` bị cache sau decommission | L | M | Dùng `Cache-Control: no-store` header cho `/dashboard/*` routes |

---

## 5. Immutable source constraints

Các files sau **không được sửa trực tiếp** trong migration này — chỉ được inject qua props:

| File | Lý do immutable |
|------|----------------|
| `frontend/src/components/WhaleBubbleChart.jsx` | AGENTS.md §3 constraint 4 |
| `frontend/src/components/modern/ModularPositionDeck.jsx` | AGENTS.md §3 constraint 4 |
| `frontend/src/components/WhaleAnalyticsTab.jsx` | AGENTS.md §3 constraint 4 |
