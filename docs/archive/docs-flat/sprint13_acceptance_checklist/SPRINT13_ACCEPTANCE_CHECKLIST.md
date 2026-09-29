# Sprint 13 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 13.

**TRANG THAI: COMPLETED (2026-04-02)**

## A. Portfolio Analytics — Risk & Return Metrics

- [x] API `GET /api/portfolio/portfolios/{id}/analytics/` hoat dong, tra du 7 chi so.
- [x] `compute_max_drawdown` chinh xac voi fixture data co biet truoc.
- [x] `compute_sharpe` va `compute_sortino` su dung risk_free=0.05 (5%/nam) va annualize dung.
- [x] `compute_twr` xu ly dung co cash flow vao/ra trong ky.
- [ ] Hiển thông báo "Cần >= 30 ngày dữ liệu" khi AccountSnapshot quá ít. *(deferred — component dùng `total_trading_days < 5` guard tạm thời; UI message đầy đủ để sau)*

## B. Portfolio Analytics — Allocation

- [x] `GET /allocation/?by=sector` join duoc voi StockProfile, tra ket qua hop le.
- [x] Ma chua co StockProfile hien "Chua phan loai" thay vi crash.
- [x] HHI concentration score được tính và trả trong response. *(Done trong Sprint 14 — S14-01: `GET /allocation/?by=sector` trả `hhi_score`)*
- [x] Frontend có toggle between "by symbol" và "by sector" trên pie chart. *(Done trong Sprint 14 — S14-07: `AllocationPieChart` có toggle Theo mã / Theo ngành + HHI badge)*

## C. Stock Detail Workspace

- [x] Top panel hien thi realtime quote (gia, % thay doi) tu useRealtimeFeed.
- [x] Company profile hien thi ten cong ty, san, nganh, von hoa tu StockProfile.
- [x] Session stats hien thi mo/cao/thap/dong, khoi luong tu DailyPrice.
- [x] Signal summary hien thi price alerts dang active cua user cho symbol hien tai.
- [x] Whale alerts tu useRealtimeFeed.alerts loc dung theo symbol.

## D. Admin Operations Dashboard

- [x] Route `/admin-ops/` tra 403 neu khong phai is_staff (server enforced + frontend hien thong bao).
- [x] System health panel hien thi channel_layer_type, realtime_enabled va redis_ok.
- [x] User stats panel hien thi so user, portfolio, tracked symbols, watchlist items chinh xac.
- [x] Last sync time lay tu MarketGroupSyncLog va StockProfileSyncLog.

## E. QA

- [x] Backend: 13 tests moi pass cho admin ops (test_admin_ops.py) + 28 tests analytics = 41 tong.
- [x] Frontend: npm run build pass (251.69 kB, 0 errors).
- [x] Regression: build compile thanh cong, cac route cu van hoat dong.

## F. Release Sign-off

- [x] Dev xac nhan khong con P0/P1 blocking issue moi.
- [x] Execution log cap nhat day du.
- [x] Taskboard Sprint 13 tat ca 12 tasks → Done.
