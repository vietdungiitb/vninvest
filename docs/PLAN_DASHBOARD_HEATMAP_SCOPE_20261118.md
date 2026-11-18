# PLAN — Heatmap chỉ lấy mã user theo dõi (bugfix sau wave 2)

> Ngày 2026-11-18 · branch `feat/dash-heatmap-scope` · base `dev @ b83718ef9`.
> **Trigger**: Owner gửi ảnh staging chụp sau deploy: heatmap hiển thị **1833 mã** (toàn thị trường) thay vì vài mã theo dõi.

## 1. Root cause (đã trace, có file:line)

- `packages/web/src/adapters/core/market.js:462-464`: `getLegacyWatchlistGroups()` → `GET /stock-management/groups/?include_prices=0`.
- Backend `packages/core/backend/src/market_data/stock_mgmt_native_views.py:3821` ghi rõ các group này **"KHÔNG phải danh mục do user tạo"** — là nhóm thị trường (`CachedSymbolGroup`: VN30, HOSE, ngành…) chứa toàn bộ ~1833 mã.
- `useCoreDashboardData.js:159-161`: `const watchlistGroups = rawWatchlistGroups` — **giữ tất cả, không lọc** (comment cũ cho rằng đây là "nhóm user follows" — SAI).
- Wave 2 `DashboardPage.tsx:243-246` thêm `watchlistGroups` vào `heatmapSymbols` theo khuyến nghị audit P2-4 → heatmap + Position Deck (`DashboardPage.tsx:457`) đều nhận 1833 mã; `collectDashboardSymbols` (`useCoreDashboardData.js:168-173`) còn gửi 1833 mã vào bulk technicals.

## 2. Fix

- Thêm `isSystemMarketGroup(group)` vào `packages/web/src/constants/marketGroups.ts` — **tiêu chí chính: `group_type` thuộc hệ thống** `SECTOR|INDEX|EXCHANGE|ETF|CW|BOND|DERIVATIVE` (`vnbroker_adapter.py:1430-1459` định nghĩa đủ 29 nhóm); **fallback** slug hoá `id`/`slug`/`name` (NFD → bỏ dấu → lowercase → gom separator thành `-`) so với `SYSTEM_GROUP_IDS` cho case thiếu `group_type`. Lọc theo tên alone **KHÔNG đủ** (14 slug vs 29 nhóm) — auditor B3 chỉ ra blocker này.
- `useCoreDashboardData.js`: `filterUserWatchlistGroups(groups)` (export để test hành vi) lọc `rawWatchlistGroups` trước khi đưa vào state ⇒ heatmap, deck, `collectDashboardSymbols` và `onDataReady` **không còn group hệ thống**. Không đụng API/backend, không đổi contract `watchlistGroups`. `WatchlistContext.tsx:239,338` có kênh lọc slug cũ (không bỏ dấu) — ghi follow-up, không sửa trong slice này.
- Giữ nguyên phần còn lại của P2-4 (breadth, status, 2 hook realtime).

## 3. AC

- Given group hệ thống `{id:7, name:"Ngân hàng", group_type:"SECTOR", items:[...800 mã]}` + group user `{id:99, name:"Theo dõi riêng", group_type:"CUSTOM", items:[FPT]}`, when lọc, then chỉ còn group 99.
- Given 29 nhóm hệ thống (kể cả `VNX50`, `HNXCon`, `FU_INDEX`, `Thép & Vật liệu`), when lọc, then **tất cả** bị loại (không phụ thuộc slug có trong `SYSTEM_GROUP_IDS` hay không).
- Given user có 5 `trackedSymbols` và 0 group user, when render heatmap, then `scopeCount === 5` (không phải 1833) và Position Deck scope `"Tất cả (5)"`.

## 4. TDD fail-before

`src/utils/__tests__/market-group-filter.component.test.ts` (mới): (a) `isSystemMarketGroup` cho 29 tên/type hệ thống + `CUSTOM` → false; (b) **test hành vi** `filterUserWatchlistGroups([...])` trả đúng group user; (c) source-scan `useCoreDashboardData.js` phải dùng helper trước `setState`. Import mới → **ĐỎ** trước fix. Không dùng test chỉ kiểm export/ text (tautology).

## 5. Gates

Local: `npx tsc --noEmit` · `npm run lint` · `vitest` file mới + `useCoreDashboardData` tests cũ. VPS: worktree tạm, full `test:components` + `build`, baseline 5 fail SSE, dọn worktree. Visual QA: deploy `dev` mới + chụp `/dashboard` và **mở ảnh** xác nhận số mã.

## 6. Non-goals / rollback

- Không xoá API nhóm thị trường (dùng ở screener nơi khác).
- Không đổi logic collapse/watchlist của user.
- Rollback = revert commitThis; cấm `git checkout --` (L-A01).

Lessons áp dụng: [L-001, L-002, L-V02, L-V03, L-V04, L-F10]. Root kế thừa (audit P2-4) đã có phản chứng từ code/ ảnh staging ⇒ không tin khuyến nghị cũ.
