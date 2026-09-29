# TASKBOARD — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Mục tiêu**: Điều phối thực hiện từng task atomic để dashboard hoàn toàn chạy trên coreApiAdapter, sau đó decommission ModernDashboard.jsx

**Legend**: `[ ]` = Not started | `[~]` = In progress | `[x]` = Done | `[!]` = Blocked

---

## Slice DM-00 — Fix 5 Dashboard Bugs (Pre-flight) ⚡ PHẢI XONG TRƯỚC DM-01

> **Gate**: Không bắt đầu DM-01 trước khi DM-00 PASS build.

---

- [ ] `DM-00.1` **Fix useAlertCenterFeed — thiếu 3 return keys**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - Thêm vào return object: `currentUnifiedPage: currentPageIndex`
  - Thêm: `hasPreviousUnifiedPage: currentPageIndex > 0`
  - Thêm: `hasLastUnifiedPage: cursorStack.length - 1 > currentPageIndex`
  - `PaginationBar` trong `UnifiedAlertCenter` nhận đúng props  
  Files: `frontend/src/hooks/useAlertCenterFeed.js`  
  Req: DM-REQ-01

---

- [ ] `DM-00.2` **Fix UnifiedAlertCenter — audience filter enum mismatch**  
  Owner: Frontend Dev  
  Estimate: 15 phút  
  DoD:
  - Options array tại lines ~300-301 dùng `'holdings_only'` và `'watchlist_only'`
  - Khớp với filter checks trong `useAlertCenterFeed.js` (lines 335-341)
  - Không tạo regression với các filter khác  
  Files: `frontend/src/components/UnifiedAlertCenter.jsx`  
  Req: DM-REQ-02

---

- [ ] `DM-00.3` **Fix client.js — window param bị drop trong getAlertCenterFeed**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - Khi `window === 'session'`, truyền `session_date: new Date().toISOString().slice(0, 10)` vào `coreApiAdapter.getAlertCenterFeed()`
  - Không break existing call sites với `window !== 'session'`  
  Files: `frontend/src/api/client.js`  
  Req: DM-REQ-03

---

- [ ] `DM-00.4` **Fix SmartStatsHeader — i18n hardcode**  
  Owner: Frontend Dev  
  Estimate: 20 phút  
  DoD:
  - Dòng hardcode `"Độ rộng danh mục"` được thay bằng `{t('dashboard.breadthLabel')}`
  - Key `breadthLabel: 'Độ rộng danh mục'` tồn tại trong `vi.js` dashboard section
  - Key cũng phải có trong `en.js` nếu file đó tồn tại  
  Files: `frontend/src/components/modern/SmartStatsHeader.jsx`, `frontend/src/i18n/vi.js`  
  Req: DM-REQ-04

---

- [ ] `DM-00.5` **Build validation DM-00**  
  Owner: Frontend Dev  
  Estimate: 10 phút  
  DoD:
  - `cd frontend && npm run build` exit 0
  - Không có new TypeScript/ESLint errors  
  Command: `Push-Location ./frontend; npm run build; Pop-Location`  
  Gate: Bắt buộc trước DM-01

---

## Slice DM-01 — Add Portfolio Analytics Methods to coreApiAdapter ⚡ PHẢI XONG TRƯỚC DM-02

> **Gate**: Tất cả 9 test cases PASS trước khi bắt đầu DM-02.

---

- [ ] `DM-01.1` **Thêm legacyApiGet() transport helper**  
  Owner: Frontend Dev  
  Estimate: 45 phút  
  DoD:
  - Private function `createLegacyApiTransport(env, options)` tồn tại trong file
  - Gọi `/api/{path}` thay vì `/core/v1/{path}`
  - Dùng cùng auth header pattern (`Bearer` token)
  - Dùng cùng error handling pattern (throw với `.status`)
  - KHÔNG export ra ngoài file  
  Files: `packages/web/src/adapters/coreApiAdapter.js`  
  Req: DM-REQ-05

---

- [ ] `DM-01.2` **Thêm getPortfolioHoldings và getPortfolioSummary**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - `getPortfolioHoldings(portfolioId)` → `coreGet("/portfolio/portfolios/{id}/holdings/")`
  - `getPortfolioSummary(portfolioId)` → `coreGet("/portfolio/portfolios/{id}/summary/")`
  - Cả 2 throw Error khi `portfolioId` là undefined/null  
  Files: `packages/web/src/adapters/coreApiAdapter.js`  
  Req: DM-REQ-06

---

- [ ] `DM-01.3` **Thêm getPortfolioAnalytics và getPortfolioTechnicals**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - `getPortfolioAnalytics(portfolioId, days = 30)` → path có `?days=N`
  - `getPortfolioTechnicals(portfolioId)` → `coreGet("/portfolio/portfolios/{id}/technicals/")`
  - Throw Error khi portfolioId undefined  
  Files: `packages/web/src/adapters/coreApiAdapter.js`  
  Req: DM-REQ-07

---

- [ ] `DM-01.4` **Thêm getBulkTechnicalsBySymbols**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - `getBulkTechnicalsBySymbols(symbols)` → dùng `legacyApiGet("/stock-management/technicals/bulk/?symbols=...")`
  - Khi `symbols.length === 0` → return `Promise.resolve([])` KHÔNG gọi API
  - Symbols được URL-encoded  
  Files: `packages/web/src/adapters/coreApiAdapter.js`  
  Req: DM-REQ-08

---

- [ ] `DM-01.5` **Thêm getTrackedSymbols và getLegacyWatchlistGroups**  
  Owner: Frontend Dev  
  Estimate: 20 phút  
  DoD:
  - `getTrackedSymbols()` → `coreGet("/stock-management/tracked-symbols/")`
  - `getLegacyWatchlistGroups()` → `coreGet("/portfolio/watchlist/groups/")`
  Files: `packages/web/src/adapters/coreApiAdapter.js`  
  Req: DM-REQ-09

---

- [ ] `DM-01.6` **Viết test cases cho 7 methods mới**  
  Owner: Frontend Dev  
  Estimate: 1.5h  
  DoD:
  - Test: `getPortfolioHoldings("1")` → gọi coreGet đúng path
  - Test: `getPortfolioHoldings(undefined)` → throw Error
  - Test: `getPortfolioSummary("1")` → gọi đúng path
  - Test: `getPortfolioAnalytics("1", 60)` → path có `?days=60`
  - Test: `getPortfolioTechnicals("1")` → gọi đúng path
  - Test: `getBulkTechnicalsBySymbols(["VCB","HPG"])` → gọi legacyApiGet đúng path
  - Test: `getBulkTechnicalsBySymbols([])` → không fetch
  - Test: `getTrackedSymbols()` → gọi đúng path
  - Test: `getLegacyWatchlistGroups()` → gọi đúng path
  - Tất cả 9 tests PASS  
  Files: `packages/web/src/adapters/coreApiAdapter.test.js`  
  Gate: Tất cả PASS trước DM-02

---

## Slice DM-02 — Create useCoreDashboardData Hook ⚡ PHẢI XONG TRƯỚC DM-03

---

- [ ] `DM-02.1` **Tạo file và base structure**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - File tồn tại tại `packages/web/src/features/dashboard/useCoreDashboardData.js`
  - Export `useCoreDashboardData` function
  - JSDoc đầy đủ cho params và return shape  
  Files: `packages/web/src/features/dashboard/useCoreDashboardData.js` (NEW)  
  Req: DM-REQ-10

---

- [ ] `DM-02.2` **Implement portfolio data fetching**  
  Owner: Frontend Dev  
  Estimate: 1.5h  
  DoD:
  - Gọi 6 methods song song: holdings, summary, analytics, technicals, trackedSymbols, watchlistGroups
  - `AbortController` được dùng trong `useEffect`
  - Không update state sau unmount (check `mountedRef.current`)
  - `portfolioId === null` → không fetch, trả rỗng  
  Files: `packages/web/src/features/dashboard/useCoreDashboardData.js`  
  Req: DM-REQ-10

---

- [ ] `DM-02.3` **Implement bulk technicals sau khi holdings resolved**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - Extract symbols từ holdings array
  - Gọi `getBulkTechnicalsBySymbols(symbols)` sau khi holdings resolve
  - Khi symbols rỗng → không gọi API  
  Files: `packages/web/src/features/dashboard/useCoreDashboardData.js`  
  Req: DM-REQ-11

---

- [ ] `DM-02.4` **Implement alertFeed fetching**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - Gọi `coreApiAdapter.getAlertCenterFeed({ page_size: 20 })`
  - `alertFeed.loading` là state riêng (không block portfolio data loading)
  - Merge kết quả vào state `alertFeed: { alerts, summary, loading }`  
  Files: `packages/web/src/features/dashboard/useCoreDashboardData.js`  
  Req: DM-REQ-12

---

- [ ] `DM-02.5` **Implement refresh() function**  
  Owner: Frontend Dev  
  Estimate: 20 phút  
  DoD:
  - `refresh()` trong return object tăng `refreshToken` state
  - `refreshToken` là dependency của `useEffect` → trigger re-fetch  
  Files: `packages/web/src/features/dashboard/useCoreDashboardData.js`  
  Req: DM-REQ-10

---

## Slice DM-03 — Upgrade DashboardPage.js to Full-Featured ⚡ PHẢI XONG TRƯỚC DM-04

---

- [ ] `DM-03.1` **Rewrite skeleton thành full layout với useCoreDashboardData**  
  Owner: Frontend Dev  
  Estimate: 2h  
  DoD:
  - File import `useCoreDashboardData` từ `../features/dashboard/useCoreDashboardData.js`
  - `DashboardPage` render loading/error/content states
  - Không có JSX trong file  
  Files: `packages/web/src/pages/DashboardPage.js`  
  Req: DM-REQ-13

---

- [ ] `DM-03.2` **Implement 5 slot renderers + fallbacks**  
  Owner: Frontend Dev  
  Estimate: 2h  
  DoD:
  - `renderStatsHeader` slot: nếu null → fallback 3 metric cards (market_value, unrealized_pl, holdings count)
  - `renderPositionDeck` slot: nếu null → fallback `<ul>` list holdings
  - `renderAlertCenter` slot: nếu null → fallback list 5 alerts
  - `renderHeatmap` slot: nếu null → không render section
  - `renderBubble` slot: nếu null → không render section
  - Data được pass vào slot function đúng shape  
  Files: `packages/web/src/pages/DashboardPage.js`  
  Req: DM-REQ-13, DM-REQ-14

---

- [ ] `DM-03.3` **Thêm skeleton loading state UI**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - CSS classes `core-dashboard--loading`, `core-dashboard__skeleton` được dùng
  - Skeleton render khi `loading === true`
  - Không flash nội dung trong lúc loading  
  Files: `packages/web/src/pages/DashboardPage.js`  
  Req: DM-REQ-15

---

- [ ] `DM-03.4` **Kiểm tra i18n và text**  
  Owner: Frontend Dev  
  Estimate: 20 phút  
  DoD:
  - Tất cả text hardcode là tiếng Việt có dấu đúng chuẩn
  - Không có text tiếng Anh thuần trong UI visible
  - Kiểm tra fallback error message: "Không thể tải dữ liệu dashboard."  
  Files: `packages/web/src/pages/DashboardPage.js`  
  Req: DM-REQ-16

---

- [ ] `DM-03.5` **Build validation DM-03**  
  Owner: Frontend Dev  
  Estimate: 10 phút  
  DoD:
  - `Push-Location ./frontend; npm run build; Pop-Location` exit 0
  - Không có new warnings về missing props  
  Gate: Bắt buộc trước DM-04

---

## Slice DM-04 — Create PackageDashboardHost.jsx ⚡ PHẢI XONG TRƯỚC DM-05

---

- [ ] `DM-04.1` **Tạo file PackageDashboardHost.jsx**  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:
  - File tồn tại tại `frontend/src/pages/PackageDashboardHost.jsx`
  - Import `DashboardPage` từ `@vninvest/web`
  - Không có direct import từ `packages/web/src/`  
  Files: `frontend/src/pages/PackageDashboardHost.jsx` (NEW)  
  Req: DM-REQ-17

---

- [ ] `DM-04.2` **Inject 4 render props slots từ legacy components**  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:
  - `renderStatsHeader`: inject `SmartStatsHeader` từ `../components/modern/SmartStatsHeader`
  - `renderPositionDeck`: inject `FactsFirstModularPositionDeck`
  - `renderAlertCenter`: inject `UnifiedAlertCenter`
  - `renderHeatmap`: inject `PortfolioHeatmap`
  - Mỗi slot truyền đúng props từ data argument  
  Files: `frontend/src/pages/PackageDashboardHost.jsx`  
  Req: DM-REQ-17, DM-REQ-18

---

- [ ] `DM-04.3` **Bridge PortfolioContext và env**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - `portfolioId` lấy từ `usePortfolio()` context
  - `env` dùng `packageShellHostEnv` import từ `./packageShellHostRuntime`
  - LangContext được preserve cho legacy components  
  Files: `frontend/src/pages/PackageDashboardHost.jsx`  
  Req: DM-REQ-17

---

- [ ] `DM-04.4` **Build validation DM-04**  
  Owner: Frontend Dev  
  Estimate: 10 phút  
  DoD:
  - Build exit 0
  - Không có lỗi "cannot find module @vninvest/web"  
  Gate: Bắt buộc trước DM-05

---

## Slice DM-05 — Route Swap + Shadow Run

---

- [ ] `DM-05.1` **Swap /dashboard route trong App.jsx**  
  Owner: Frontend Dev  
  Estimate: 20 phút  
  DoD:
  - Route `path="dashboard"` trỏ vào `<PackageDashboardHost />`
  - Route `path="dashboard/legacy"` trỏ vào `<ModernDashboard />` (shadow)
  - Import `PackageDashboardHost` đúng path  
  Files: `frontend/src/App.jsx`  
  Req: DM-REQ-19

---

- [ ] `DM-05.2` **Build và rebuild stack**  
  Owner: DevOps / Dev  
  Estimate: 10 phút  
  DoD:
  - `npm run build` exit 0
  - `./start_dev.ps1` rebuild và tất cả containers healthy  
  Command: `.\start_dev.ps1`  
  Req: DM-REQ-20

---

- [ ] `DM-05.3` **Smoke test /dashboard mới**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:
  - `/dashboard` load thành công, không có blank screen
  - Stats header hiển thị market_value, unrealized_pl
  - Holdings/position deck hiển thị data
  - Alert center hiển thị alerts
  - Heatmap hiển thị (không blank)
  - Console không có JS errors  
  Req: DM-REQ-20

---

- [ ] `DM-05.4` **Smoke test /dashboard/legacy (shadow)**  
  Owner: Frontend Dev  
  Estimate: 15 phút  
  DoD:
  - `/dashboard/legacy` vẫn render ModernDashboard bình thường
  - Không có regression trên legacy route  
  Req: DM-REQ-19

---

## Slice DM-06 — Parity Validation (3-Day Gate) 🔒 KHÔNG ĐƯỢC BỎ QUA

> **Gate cứng**: Không bắt đầu DM-07 trước khi đủ 3 ngày calendar parity PASS.

---

- [ ] `DM-06.1` **Ngày 1: Thu thập và ghi lại parity metrics**  
  Owner: Frontend Dev / QA  
  DoD:
  - Compare: market_value, holdings.count, trackedSymbols.length, watchlistGroups
  - Ghi kết quả vào `docs/DASHBOARD_MIGRATION_PARITY_REPORT.md`
  - Chụp screenshot cả 2 routes  
  Req: DM-REQ-21

---

- [ ] `DM-06.2` **Ngày 2: Thu thập và ghi lại parity metrics (ngày 2)**  
  Owner: Frontend Dev / QA  
  DoD: Tương tự DM-06.1, append vào parity report  
  Req: DM-REQ-21

---

- [ ] `DM-06.3` **Ngày 3: Thu thập và ghi lại parity metrics (ngày 3)**  
  Owner: Frontend Dev / QA  
  DoD: Tương tự DM-06.1, append vào parity report  
  Req: DM-REQ-21

---

- [ ] `DM-06.4` **Tổng hợp parity report và sign-off**  
  Owner: Tech Lead  
  DoD:
  - `docs/DASHBOARD_MIGRATION_PARITY_REPORT.md` có đủ 3 ngày data
  - Tất cả 6 parity metrics PASS ≥ 99%
  - Tech Lead ký tên / comment approve trong file report  
  Req: DM-REQ-22

---

## Slice DM-07 — Decommission Legacy Dashboard 🔒 BLOCKING: DM-06 PASS

---

- [ ] `DM-07.1` **Verify tất cả pre-conditions gates A–G**  
  Owner: Tech Lead  
  Estimate: 30 phút  
  DoD:
  - Gate A: parity report tồn tại ✓
  - Gate B: 6 metrics PASS 3 ngày ✓
  - Gate C: Tech Lead sign-off ✓
  - Gate D: 1-day advance notice ✓
  - Gate E: clean build hiện tại ✓
  - Gate F: không có open P0/P1 bugs ✓
  - Gate G: module_tree_full.md sẽ regenerate ✓  
  Req: DM-REQ-23

---

- [ ] `DM-07.2` **Xóa shadow route /dashboard/legacy khỏi App.jsx**  
  Owner: Frontend Dev  
  Estimate: 10 phút  
  DoD:
  - Dòng `<Route path="dashboard/legacy" ...>` bị xóa
  - Không còn legacy route accessible  
  Files: `frontend/src/App.jsx`  
  Req: DM-REQ-24

---

- [ ] `DM-07.3` **Xóa import ModernDashboard khỏi App.jsx**  
  Owner: Frontend Dev  
  Estimate: 5 phút  
  DoD:
  - `import ModernDashboard from './pages/modern/ModernDashboard'` bị xóa
  - Không còn dead imports  
  Files: `frontend/src/App.jsx`  
  Req: DM-REQ-24

---

- [ ] `DM-07.4` **Xóa file ModernDashboard.jsx**  
  Owner: Frontend Dev  
  Estimate: 5 phút  
  DoD:
  - File `frontend/src/pages/modern/ModernDashboard.jsx` bị xóa
  - Confirm bằng `git status`  
  Req: DM-REQ-24

---

- [ ] `DM-07.5` **Build validation sau decommission**  
  Owner: Frontend Dev  
  Estimate: 10 phút  
  DoD:
  - `npm run build` exit 0 sau khi xóa
  - Không còn import nào trỏ đến `ModernDashboard`
  - `grep -r "ModernDashboard" frontend/src` → 0 results  
  Gate: BLOCKING — không mark DM-07 DONE nếu build fail

---

- [ ] `DM-07.6` **Cập nhật governance artifacts**  
  Owner: Tech Lead / Dev  
  Estimate: 30 phút  
  DoD:
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` updated với full slice DM-07 evidence
  - `PROGRESS_DASHBOARD.md` updated với "Dashboard Migration — COMPLETED"
  - `module_tree_full.md` regenerated  
  Req: DM-REQ-25

---

## Summary — Tổng quan tiến độ

| Slice | Mô tả | Status | Gate |
|-------|-------|--------|------|
| DM-00 | Fix 5 bugs | `[ ]` | Build PASS |
| DM-01 | coreApiAdapter 7 methods | `[ ]` | 9 tests PASS |
| DM-02 | useCoreDashboardData hook | `[ ]` | Unmount safe |
| DM-03 | DashboardPage full-featured | `[ ]` | Build PASS |
| DM-04 | PackageDashboardHost | `[ ]` | Build PASS |
| DM-05 | Route swap + shadow | `[ ]` | Smoke PASS |
| DM-06 | Parity 3 ngày | `[ ]` | 99% 3 ngày |
| DM-07 | Decommission | `[ ]` | 7 gates PASS |
