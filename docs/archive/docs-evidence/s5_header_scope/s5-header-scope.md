# S5.3 — Phạm vi header (ghi rõ để khỏi hỏi lại) — Slice S5 Dashboard Audit Fix

> **Mục đích**: trả lời S5.3 "Header limited: bell badge = unreadAlertCount (sync với S2.3, nếu bell trong shell thì truyền prop hoặc ghi OUT-OF-SCOPE + file:line shell). Breadcrumb/search là shell → không đổi behavior, chỉ document".

## 1. File sở hữu header

- **Shell layout**: `packages/web/src/layouts/full/FullLayout.tsx:1-101` — `FullLayout()` render `Header` tại `FullLayout.tsx:81-85`.
- **Header thực thi**: `packages/web/src/layouts/full/vertical/header/Header.tsx:1-318`
  - Breadcrumb: `Header.tsx:158-173` (`nav[aria-label=Breadcrumb]` → `VNInvest / {pathname.pop()||Dashboard}` + nút `navigate('/dashboard')`)
  - Search: `Header.tsx:176-192` (`Input pl-10`, `placeholder t('layout.searchPlaceholder')`, `onKeyDown Enter → navigate('/stocks/{SYMBOL}')`)
  - Chuông + badge: `Header.tsx:219-254` (`DropdownMenuTrigger` Bell, badge `unseenCount >0 && span -top-1 -right-1 bg-rose-500`)
  - WebSocket status + ngôn ngữ + avatar: `Header.tsx:197-312`

- **DashboardPage**: `packages/web/src/pages/DashboardPage.tsx:1-442` — bắt đầu từ stats slot `core-dashboard-slot--stats:331`, triad `dashboard-triad-grid:348`. **Không render header shell**, chỉ lane badge (`UnifiedAlertCenter.js:192-196`).

=> Vì vậy header/breadcrumb/search là **app shell**, ngoài phạm vi `§8 danh sách file chạm` của slice S5. Không sửa behavior tìm kiếm hay breadcrumb theo §9 "Không đụng header shell/search behavior".

## 2. Bell badge = unreadAlertCount — đồng bộ S2.3

### 2.1 Shell bell (Header.tsx)

- **Nguồn**: `Header.tsx:35-40`
  ```ts
  const summaryQ = useCoreQuery(['alert-center-summary-global'], {
    enabled: !!isAuthenticated,
    refetchInterval: isAuthenticated ? 30000 : false,
    queryFn: () => coreApiAdapter.getAlertCenterSummary({ timeframe: 'session' }),
  });
  const unseenCount = Number((summaryQ.data as any)?.unseen || 0);
  ```
- **Hiển thị**: `Header.tsx:236-240` badge `unseenCount` (cap 99+), `aria-label t('layout.notifications')`.
- **Poll**: 30s khi `isAuthenticated`, pause khi chưa login. Toast + sound khi `alert-center-new` CustomEvent (`Header.tsx:42-62`).

### 2.2 Dashboard lane badge (UnifiedAlertCenter.js)

- **Nguồn**: `UnifiedAlertCenter.js:106-107` `unreadAlertCount = unreadCount ?? safeAlerts.filter(!readAlertIds.has(alert_id||id)).length`
- **Hiển thị**: `UnifiedAlertCenter.js:195-196` `span bg-red-500/20 text-red-400 title=t('alert.unreadTooltip',{count})`
- **Đồng bộ**: cùng endpoint `getAlertCenterSummary` (BE `/signals/alert-center/summary?timeframe=session`), cùng ý nghĩa **unread** (chưa đọc). Shell poll 30s, lane tính local từ `readAlertIds` (chưa có BE ack trong S5). Về mặt contract badge = unread, không đổi sang trung tính (giữ đỏ `bg-red-500/20` như S2.3).

### 2.3 OUT-OF-SCOPE — vì sao không truyền prop

- **Vị trí cây**: `FullLayout` (shell) là parent của `Outlet` → `DashboardPage` là child của `Outlet` (`FullLayout.tsx:95`). Truyền `unreadAlertCount` từ DashboardPage lên Header phải nâng state lên `FullLayout` hoặc dùng context (`PortfolioContext` hoặc `AlertCenterContext`). Đó là **refactor shell**, vượt §8 "chỉ đọc, không refactor".
- **Quyết định S5.3**: giữ shell tự poll BE (`Header.tsx:35-40`), lane tự tính local (`UnifiedAlertCenter.js:107`). Hai nguồn cùng gốc `unseen` ⇒ số liệu hội tụ khi không có ack tối ưu (S3 batch ack 50). Ghi rõ OUT-OF-SCOPE, không bịa prop.
- **Nếu cần đồng bộ 100% sau S5**: tạo `AlertBadgeContext` hoặc lift `useAlertCenterData` lên `FullLayout`, nhưng hoãn (không blocker cho S5 DoD).

## 3. Breadcrumb / search — không đổi behavior

- **Breadcrumb**: `Header.tsx:159-173` chỉ `VNInvest / {segment}` tĩnh, click về `/dashboard`. Không sửa thành `Tổng quan` sentence-case hay i18n breadcrumb động — vì breadcrumb là global, đụng sẽ ảnh hưởng mọi route, ngoài scope S5 (§9).
- **Search**: `Header.tsx:176-192` là `Input` global với hint `/`/`⌘K` UI-only (hiện placeholder, không đổi logic tìm kiếm). Spec S5.3 yêu cầu search có hint `/`/`⌘K` UI-only, không đổi behavior — hiện placeholder đã là `t('layout.searchPlaceholder')` (`Tìm mã cổ phiếu...`), hint bàn phím chưa thêm để tránh đổi behavior phím tắt global. Ghi nhận OUT-OF-SCOPE, không thêm handler `⌘K`.
- **Lý do không chạm**: `DashboardPage` không sở hữu search, search thuộc shell; thêm hint hay đổi behavior phải sửa `Header.tsx` ngoài danh sách file chạm S5 (vi phạm §8). Chỉ document, không code.

## 4. Severity duy nhất viền trái + category chip trung tính (S5.4)

- **Dashboard lane**: `UnifiedAlertCenter.js:27-43` `severityCardStyles` — S5 đổi nền về `bg-slate-800/30` trung tính, chỉ giữ `border-l-4 border-l-{red|orange|yellow|emerald}` theo severity (trước có `bg-red-950/10` v.v.). Chip category `Cá mập/Dark flow` tại `UnifiedAlertCenter.js:414` đổi về `bg-slate-800 text-slate-300 border-slate-700/50` + icon `Waves h-3 w-3 text-slate-400` (bỏ vàng riêng, S5.4).
- **Whale-alerts (AlertCenterPage)**: `packages/web/src/pages/AlertCenterPage.tsx:182-245` + `components/alert-center/AlertCard.tsx:182-214` — chip family hiện là `statusBadgeInfo` trung tính + freshness, không dùng vàng riêng. So sánh side-by-side: dashboard lane chip `bg-slate-800` vs whale page chip `statusBadgeInfo` — cùng tông trung tính, khác component nhưng đồng chuẩn (§9 không đụng AlertCenterPage trong S5, chỉ đối chiếu). Evidence: `s5-severity-compare.png` (dashboard vs whale-alerts) — chụp cùng viewport 1280px, thấy viền trái đỏ/cam/vàng/xanh, chip `Cá mập` xám + icon Waves.

## 5. Danh sách file chạm thực tế S5

- `SmartStatsHeader.js:91-124,132-177` — breadth symbol+tooltip+aria-label + relative time `formatTimeAgo` shared util, refresh 1 nút + absolute tooltip.
- `DashboardPage.tsx:189-207` — giữ nguyên breadth calc (mergedQuotes → up/down/flat), chỉ đọc, không đổi logic dedup.
- `AIAdvisorAlertPanel.js:164-205` — empty block icon 32px + title + desc lastScan/noScan + 2 CTA (viewPrevSession disabled comingSoon, runAnalysis), lastScanAt từ `getAIAlertsFeed` response fallback `Date.now()`, document comment không bịa API, max-h 240px.
- `UnifiedAlertCenter.js:26-43,414` — severity left-border only + chip neutral + Waves icon, timeAgo chuyển vào `formatMarket.js`.
- `utils/formatMarket.js` — thêm `formatTimeAgo/timeAgo` shared util (S5.1).
- `s5-header-scope.md` (file này) — document scope header shell.

Không chạm `FullLayout.tsx`/`Header.tsx` behavior, chỉ đọc.

## 6. Minh chứng

- `s5-breadth-tooltip.png` — hover từng đoạn `Tăng: {n} mã` / `Không đổi` / `Giảm` trên bar 3 màu, text `▲ {up} · ■ {flat} · ▼ {down}` có tooltip + aria-label descriptive.
- `s5-ai-empty.png` — DevTools height ≤240px, có `Lần quét gần nhất HH:mm · 0 tín hiệu` hoặc `Chưa có lượt quét`, 2 nút.
- `s5-severity-compare.png` — dashboard vs whale-alerts side-by-side, chip trung tính, viền trái severity.
- `s5-header-scope.md` — file này.

Gates: `npx tsc --noEmit` 0, `npm run build` PASS (workdir `packages/web`).
