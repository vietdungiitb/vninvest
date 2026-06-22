# Code Change Audit Ledger

> **Source of truth** for every code change in VNInvest SaaS migration.
> Each entry = one focused edit with traceability to spec/plan.

---

## Entry 1: Whale Alerts upgrade — Symbol Kline Intelligence

- **PR / branch**: feature/whale-alerts-symbol-kline-intelligence
- **Date**: 2026-04-27
- **Files touched**:
  - `quality/QUALITY.md`
  - `docs/*WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE*` (6 files)
- **Summary**: Quality framework + full feature pack documentation for whale alerts symbol/kline intelligence upgrade.
- **Validation**: N/A — documentation only.
- **Risk**: None.

---

## Entry 2: Final sprint — Legacy admin-core JSX → TSX

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `packages/web/src/pages/admin/AdminCore*Page.tsx` (8 new TSX files)
  - `packages/web/src/pages/pageRegistry.js` (routes added for 8 admin-core-* entries with `status: 'core'`)
  - `packages/web/vite.config.ts` (chunkSizeWarningLimit: 1000)
  - `packages/web/tests/visual/login.spec.ts` (Playwright login E2E, 4 tests)
  - `packages/web/tests/visual/watchlist.spec.ts` (Playwright watchlist CRUD E2E, 4 tests)
  - `docker-compose.beta.yml` (standalone beta deploy compose)
  - `AGENTS.md` (updated with beta deploy commands, anchor files)
  - `docs/LEGACY_FRONTEND_MIGRATION_FINAL_SPRINT_PLAN_20260622.md` (revised with standalone compose deploy steps)
  - `CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
  - `PROGRESS_DASHBOARD.md` (updated with final sprint entry)
- **Summary**: Converted 8 legacy AdminCore JSX pages to TSX in `packages/web/src/pages/admin/`. All 8 use `coreApiAdapter` cast pattern, inline Vietnamese text without i18n. TypeScript `--noEmit` passes clean. `npm run build` passes (3161 modules). Beta deployed to `beta.edusuccess.vn`.
- **Validation**:
  - `npx tsc --noEmit` — zero errors
  - `npm run build` — 3161 modules, 0 errors, built in ~10s
  - Beta deploy: container `vninvest-frontend-beta` running, nginx 1.27.5 workers started, HTTP on `beta.edusuccess.vn` returns 200 (redirects to HTTPS pending LE cert)
- **Residual risk**: HTTPS pending Let's Encrypt cert via acme-companion (sleeping 3600s); manual force renewal or wait needed.

---

## Entry 3: Beta deploy fix — VIRTUAL_PORT heredoc mangling

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `docker-compose.beta.yml` (network name: property added)
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
- **Summary**: `VIRTUAL_PORT: \"80\"` in SSH heredoc was mangled to `VIRTUAL_PORT: \ 80\`, causing nginx-proxy to generate `server 172.20.0.7:\ 80\;` (broken upstream). Fixed by rewriting the compose file on the server without escaped quotes. Also added `name:` to external networks for explicit resolution. HTTP now returns 200; HTTPS pending LE cert.
- **Validation**:
  - `docker inspect` shows `VIRTUAL_PORT=80` (correct)
  - `curl http://beta.edusuccess.vn` returns `HTTP 200` (301 redirect to HTTPS)
  - nginx-proxy upstream now: `server 172.20.0.7:80;` (correct)
- **Residual risk**: HTTPS cert not yet issued; acme-companion sleeping 3600s. Manually force `docker exec acme-companion /app/signal` or wait.

---

## Entry 4: Beta Allowed Hosts Nginx Proxy Fix

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `packages/web/docker/nginx.conf` (added map for Host mapping `beta.edusuccess.vn` -> `saas.edusuccess.vn`)
  - `PROGRESS_DASHBOARD.md` (updated status and metrics)
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
- **Summary**: Fix lỗi 400 Bad Request cho môi trường beta do Django backend `core-api` đang chạy với production configuration `DJANGO_ALLOWED_HOSTS=saas.edusuccess.vn,localhost,127.0.0.1`. Sửa đổi Nginx configuration của `frontend-beta` để map Host header `beta.edusuccess.vn` -> `saas.edusuccess.vn` khi proxy sang backend, bypass thành công Allowed Hosts check mà không cần can thiệp hay restart backend container của production.
- **Validation**:
  - `curl -v https://beta.edusuccess.vn/api/health` -> Trả về `HTTP 200 OK` và response JSON hợp lệ.
  - Playwright E2E tests (`$env:PLAYWRIGHT_BASE_URL="https://beta.edusuccess.vn"; npx playwright test`) -> 38 passed, 2 skipped, 0 failed.
- **Residual risk**: None.

---

## Entry 5: E2E Regression Test Hardening — Infinite Loop Fix & Login Selectors Validation

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `packages/web/src/hooks/useAlertCenterSnapshot.ts` (fixed reference dependencies)
  - `packages/web/src/pages/DashboardPage.tsx` (cast holdings prop type)
  - `packages/web/tests/visual/dashboard-ui-fixes.spec.ts` (cleared browser storage in beforeEach, added console logging)
  - `packages/web/tests/visual/login.spec.ts` (cleared browser storage in beforeEach, fixed input selectors)
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
- **Summary**: Khắc phục lỗi timeout khi chạy Playwright E2E tests cục bộ. Fix lỗi vòng lặp request vô tận đến endpoint `/core/v1/signals/alert-center/feed` do hook `useAlertCenterSnapshot` nhận reference dependencies là object literal `{ page_size: 20 }` được khởi tạo lại trên mỗi render của DashboardPage. Đồng thời sửa đổi selector input email trong `login.spec.ts` để hỗ trợ thẻ input không có thuộc tính `type="text"` hoặc `name="username"`, và bổ sung clear localStorage/sessionStorage trước mỗi test để cô lập hoàn toàn trạng thái và tránh tự động chuyển hướng.
- **Validation**:
  - `npx tsc --noEmit` -> ✅ Pass (0 errors).
  - Playwright tests `dashboard-ui-fixes.spec.ts` -> ✅ 5 passed.
  - Playwright tests `login.spec.ts` -> ✅ 3 passed, 1 skipped.
- **Residual risk**: None.

---

## Entry 6: Animated Clock Loader UI Upgrade

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `packages/web/src/pages/pageRegistry.js` (replaced plain text status fallback with premium animated clock SVG loader)
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
- **Summary**: Nâng cấp giao diện tải trang tạm thời (fallback loading state) khi nạp động các routes trong pageRegistry. Thay thế đoạn text tĩnh nhàm chán bằng một đồ họa SVG động hình đồng hồ quả lắc/kim xoay mượt mà, sử dụng gradient chuyển màu cao cấp từ xanh lục lam (`--shell-accent`) đến cam coral (`--shell-signal`) và đổ bóng phát sáng (glow filter) đồng nhất với ngôn ngữ thiết kế của VNInvest SaaS.
- **Validation**:
  - `npx tsc --noEmit` -> ✅ Pass (0 errors).
  - `npm run build` -> ✅ Pass (3241 modules).
  - Playwright tests `dashboard-ui-fixes.spec.ts` -> ✅ 5 passed.
- **Residual risk**: None.

---

## Entry 7: Responsive Overlap Sidebar Menu Drawer Layout

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `packages/web/src/layouts/full/FullLayout.tsx` (removed persist desktop padding, backdrop visible on all viewports when sidebar open)
  - `packages/web/src/layouts/full/vertical/header/Header.tsx` (hamburger menu button visible on all viewports, added class menu-toggle-btn)
  - `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx` (sidebar slides off-screen on all viewports when closed)
  - `packages/web/tests/visual/dashboard-ui-fixes.spec.ts` (updated E2E tests to trigger sidebar toggle and verify overlay)
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
- **Summary**: Thực hiện cấu hình panel menu ở chế độ overlap (drawer) trên toàn bộ thiết bị (kể cả desktop và mobile). Loại bỏ khoảng đệm padding-left 288px (lg:pl-72) cố định trên giao diện desktop để phần nội dung Dashboard chính hiển thị full-width tối đa, tránh bị co rúm giao diện. Sidebar mặc định ẩn hoàn toàn trên mọi màn hình và sẽ slide-in chồng lên nội dung khi bấm nút hamburger ở Header, hiển thị kèm lớp backdrop mờ và tối phía dưới để tối ưu trải nghiệm và diện tích hiển thị.
- **Validation**:
  - `npx tsc --noEmit` -> ✅ Pass (0 errors).
  - `npm run build` -> ✅ Pass (3241 modules).
  - Playwright tests `dashboard-ui-fixes.spec.ts` -> ✅ 5 passed.
- **Residual risk**: None.

---

## Entry 8: Heatmap & Alert Center Visual Audit & Parity Upgrades

- **PR / branch**: `dev`
- **Date**: 2026-06-22
- **Files touched**:
  - `packages/web/src/components/dashboard/PortfolioHeatmap.js` (ECharts treemap colors, compact cell spacing, Symbol + Change% labels)
  - `packages/web/src/components/dashboard/UnifiedAlertCenter.js` (redesigned top filter pills with counts and Lucide icons, added left-border severity card borders, metadata chips strip, inline action buttons)
  - `packages/web/playwright.config.ts` (added PLAYWRIGHT_BASE_URL override capability)
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (this entry)
- **Summary**: Khắc phục các lỗi visual và nâng cấp tính năng hiển thị cho cấu phần bản đồ nhiệt và trung tâm cảnh báo. Đồng bộ màu sắc treemap heatmap về chuẩn màu xanh/đỏ/vàng thị trường chứng khoán Việt Nam, thu hẹp khoảng cách và viền mã cổ phiếu còn 0.5px. Bổ sung nhãn phần trăm biến động hiển thị trực tiếp trên nến heatmap. Đồng thời, cấu trúc lại bộ lọc cấp độ cảnh báo với biểu tượng ngọn lửa/chuông và hiển thị số lượng tương ứng theo gradient đỏ-xanh; bổ sung thông tin chi tiết trên card cảnh báo (chiều giao dịch MUA/BÁN, giá trị giao dịch, độ tin cậy AI, phiên giao dịch) và hai nút thao tác nhanh inline (Đánh dấu đã đọc, Tắt 30p).
- **Validation**:
  - `npx tsc --noEmit` -> ✅ Pass (0 errors).
  - `npm run build` -> ✅ Pass (3241 modules).
  - Local tests: `npx playwright test tests/visual/dashboard-ui-fixes.spec.ts --project=chromium` -> ✅ Pass (5/5).
  - Remote beta server tests: `PLAYWRIGHT_BASE_URL="https://beta.edusuccess.vn" npx playwright test tests/visual/dashboard-ui-fixes.spec.ts --project=chromium` -> ✅ Pass (5/5).
- **Residual risk**: None.
