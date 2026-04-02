# Sprint 13 Detailed Plan - Portfolio Analytics Nâng Cao & Stock Detail Workspace

**Thời gian**: 2026-04-02 đến 2026-04-15 (2 tuần)
**Trạng thái**: PLANNING

---

## Mục tiêu Sprint 13

1. Nâng cấp portfolio analytics với các chỉ số tài chính chuẩn: Sharpe, Sortino, Max Drawdown, TWR, Alpha/Beta.
2. Allocation analysis nâng cao: sector, market-cap, concentration (HHI).
3. Stock detail workspace hoàn chỉnh: top panel realtime + EOD chart + signal summary.
4. Admin operations dashboard: task health, worker status, sync quick actions.

**Không trong scope:**
- Brokerage integration, order book, social features.
- Production load test > 1k concurrent.
- Backtest strategy UI (Sprint 14+).

---

## Trạng thái đầu Sprint 13

Từ Sprint 12:
- `useRealtimeFeed` hook dùng chung ổn định.
- Dashboard realtime panel đầy đủ: NAV, P/L, breadth, whale alerts, observability.
- Watchlist: nhóm thị trường + danh sách theo dõi cá nhân + price alerts + sync tự động.
- Backend: 12 tests pass, Redis realtime chạy, SECRET_KEY 64 chars, token 2h/7d.
- Git: 114 files sạch được track.

Analytics hiện tại đã có:
- `portfolio/analytics.py`: tính holdings mark-to-market, allocation % theo symbol.
- API: `/api/portfolio/portfolios/{id}/summary/`, `/allocation/`, `/chart/`.
- Frontend: Dashboard có pie chart allocation, line chart equity curve cơ bản.

Chưa có:
- Sharpe, Sortino, Max Drawdown, TWR, Alpha/Beta.
- Allocation theo sector/industry từ StockProfile.
- Stock detail page riêng với signal summary.
- Admin ops dashboard.

---

## Timeline (10 ngày làm việc)

### Day 1-2: Analytics Backend — Chỉ số rủi ro/hiệu suất

**Task S13-01**: Mở rộng `portfolio/analytics.py`
- `compute_max_drawdown(daily_values: list[float]) -> float`
- `compute_sharpe(returns: list[float], risk_free=0.05) -> float`
- `compute_sortino(returns: list[float], risk_free=0.05) -> float`
- `compute_twr(cashflows: list, snapshots: list) -> float`
- Helper: `compute_daily_returns(snapshots)` từ `AccountSnapshot`

**Task S13-02**: API endpoint mới
- `GET /api/portfolio/portfolios/{id}/analytics/` → trả JSON đầy đủ:
  ```json
  {
    "sharpe_ratio": 1.23,
    "sortino_ratio": 1.45,
    "max_drawdown_pct": -12.5,
    "twr_pct": 18.3,
    "volatility_annual_pct": 22.1,
    "best_day_pct": 3.2,
    "worst_day_pct": -4.1,
    "total_trading_days": 180
  }
  ```
- Thêm unit tests trong `test_analytics_advanced.py`

### Day 3: Analytics Backend — Allocation nâng cao

**Task S13-03**: Allocation theo sector/industry
- `GET /api/portfolio/portfolios/{id}/allocation/?by=sector` — join với `StockProfile`
- `GET /api/portfolio/portfolios/{id}/allocation/?by=symbol` (existing, giữ nguyên)
- Tính HHI (Herfindahl-Hirschman Index) cho concentration risk score

### Day 4-5: Frontend — Analytics Panel

**Task S13-04**: Component `PortfolioAnalyticsPanel.jsx`
- Grid 3 cột: Risk metrics | Return metrics | Allocation chart
- Risk: Max Drawdown (%), Sharpe, Sortino, Volatility (annualized)
- Return: TWR (%), Best day, Worst day, # trading days
- Allocation: Pie chart by sector thay cho by-symbol (có toggle)
- Màu sắc: Sharpe > 1 = xanh, < 0 = đỏ; Drawdown càng lớn càng đỏ
- Loading skeleton khi fetch

**Task S13-05**: Tích hợp vào Dashboard
- Thêm `PortfolioAnalyticsPanel` bên dưới summary cards
- Lazy load: chỉ fetch khi user scroll đến hoặc click tab "Phân tích"

### Day 6-7: Stock Detail Workspace

**Task S13-06**: `StockDetail.jsx` nâng cấp — Top panel
- Hiện tại đã có trang `/stocks/:symbol`
- Nâng cấp top panel:
  - Quote realtime (từ `useRealtimeFeed`)
  - Company profile: tên, sàn, ngành, vốn hóa
  - Session stats: giá mở/cao/thấp/đóng, khối lượng (từ DailyPrice)
  - Badge: whale alert gần nhất nếu có, price alert đang active

**Task S13-07**: Stock Detail — Signal summary panel
- `StockSignalPanel.jsx`: tổng hợp tín hiệu theo symbol
  - Price alert rules của user cho symbol này
  - Whale alerts gần nhất (từ `useRealtimeFeed.alerts`)
  - Screener hits (nếu có rule khớp — đơn giản: MA cross, volume breakout)
  - Trạng thái: Theo dõi / Trong danh mục / Cả hai

### Day 8: Admin Operations Dashboard

**Task S13-08**: View `AdminOpsDashboard`
- Route: `/admin-ops/` (chỉ superuser)
- Panels:
  - System health: `GET /api/health/realtime/` (channel layer, redis_ok)
  - User stats: total users, portfolios, tracked symbols, watchlist items
  - Last sync: StockProfile sync log, market group sync log
  - Task shortcuts: Seed demo data, sync prices, sync watch assets
  - Worker note: link đến Celery Flower nếu chạy

**Task S13-09**: Backend API endpoint
- `GET /api/admin-ops/stats/` (permission: IsAdminUser)
  ```json
  {
    "total_users": 5,
    "total_portfolios": 8,
    "total_tracked_symbols": 42,
    "total_watchlist_items": 156,
    "last_stockprofile_sync": "2026-04-01T20:00:00Z",
    "last_market_group_sync": "2026-04-01T18:30:00Z",
    "realtime_enabled": true,
    "channel_layer_type": "redis"
  }
  ```

### Day 9: QA + Bug fix

**Task S13-10**: Backend tests
- `test_analytics_advanced.py`: Sharpe, Sortino, Drawdown với fixture data
- `test_admin_ops.py`: stats endpoint permission check

**Task S13-11**: Frontend smoke
- Build pass, không có console error trên Dashboard + Stock Detail + Admin Ops
- Kiểm tra Watchlist và Dashboard realtime vẫn hoạt động sau khi thêm code mới

### Day 10: Sign-off

**Task S13-12**: Cập nhật acceptance checklist, execution log, taskboard

---

## Definition of Done (DoD)

- [ ] API `/analytics/` trả đủ 7 chỉ số, test pass.
- [ ] API `/allocation/?by=sector` hoạt động với StockProfile join.
- [ ] `PortfolioAnalyticsPanel` hiển thị đúng màu sắc và giá trị tính toán.
- [ ] Stock Detail top panel có realtime quote + company profile + session stats.
- [ ] Signal summary panel hiển thị price alerts và whale alerts theo symbol.
- [ ] Admin ops dashboard accessible với superuser, hiển thị stats chính xác.
- [ ] Backend tests mới: >= 8 tests pass.
- [ ] Frontend build pass, không có regression trên Sprint 12 features.

---

## Rủi ro

| Rủi ro | Mức | Biện pháp |
|--------|-----|-----------|
| `AccountSnapshot` có ít bản ghi → không đủ data cho Sharpe/TWR | Cao | Dùng DailyPrice fallback; hiện thông báo "Cần >= 30 ngày dữ liệu" |
| StockProfile thiếu sector cho nhiều mã | Trung bình | Allocation by sector hiển thị "Chưa phân loại" thay vì crash |
| Stock Detail page hiện đã có code, refactor có thể break | Trung bình | Đọc kỹ file trước khi sửa, không xóa logic hiện có |
