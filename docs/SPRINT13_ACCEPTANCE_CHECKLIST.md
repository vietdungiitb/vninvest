# Sprint 13 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 13.

## A. Portfolio Analytics — Risk & Return Metrics

- [ ] API `GET /api/portfolio/portfolios/{id}/analytics/` hoat dong, tra du 7 chi so.
- [ ] `compute_max_drawdown` chinh xac voi fixture data co biet truoc.
- [ ] `compute_sharpe` va `compute_sortino` su dung risk_free=0.05 (5%/nam) va annualize dung.
- [ ] `compute_twr` xu ly dung co cash flow vao/ra trong ky.
- [ ] Hien thong bao "Can >= 30 ngay du lieu" khi AccountSnapshot qua it.

## B. Portfolio Analytics — Allocation

- [ ] `GET /allocation/?by=sector` join duoc voi StockProfile, tra ket qua hop le.
- [ ] Ma chua co StockProfile hien "Chua phan loai" thay vi crash.
- [ ] HHI concentration score duoc tinh va tra trong response.
- [ ] Frontend co toggle between "by symbol" va "by sector" tren pie chart.

## C. Stock Detail Workspace

- [ ] Top panel hien thi realtime quote (gia, % thay doi) tu useRealtimeFeed.
- [ ] Company profile hien thi ten cong ty, san, nganh, von hoa tu StockProfile.
- [ ] Session stats hien thi mo/cao/thap/dong, khoi luong tu DailyPrice.
- [ ] Signal summary hien thi price alerts dang active cua user cho symbol hien tai.
- [ ] Whale alerts tu useRealtimeFeed.alerts loc dung theo symbol.

## D. Admin Operations Dashboard

- [ ] Route `/admin-ops/` chi truong hop superuser truy cap duoc (redirect neu khong phai admin).
- [ ] System health panel hien thi channel_layer_type va redis_ok lay tu /api/health/realtime/.
- [ ] User stats panel hien thi so user, portfolio, tracked symbols, watchlist items chinh xac.
- [ ] Last sync time lay tu MarketGroupSyncLog va StockProfileSyncLog.

## E. QA

- [ ] Backend: >= 8 tests moi pass cho analytics + admin ops.
- [ ] Frontend: npm run build pass, khong co loi compile moi.
- [ ] Regression: Watchlist realtime, Dashboard realtime, price alerts van hoat dong.

## F. Release Sign-off

- [ ] Dev xac nhan khong con P0/P1 blocking issue moi.
- [ ] Execution log cap nhat day du.
- [ ] Taskboard Sprint 13 tat ca tasks duoc cap nhat trang thai.
