# VNInvest — Trạng Thái Dự Án & Roadmap

> **Cập nhật lần cuối**: 2026-04-02  
> **Phiên bản codebase**: Sprint 13 COMPLETE  
> **Tác giả**: Tự động tổng hợp từ toàn bộ quá trình phát triển Sprint 7–13

## Chuẩn hóa thuật ngữ

- Tên gọi chính thức: `User Management Core` được quy chiếu về `Sprint 12`.
- `Sprint 1-2` chỉ là bucket kế hoạch nội bộ cho plan/tier/CASL/auth design, không phải mốc sprint chính thức của chức năng đã deliver.
- `Sprint 13` là phần mở rộng `Admin Operations` và thống kê người dùng, không phải mốc `User Management Core`.
- Chức năng `Đăng ký người dùng` da duoc implement trong `Sprint 12 extension`; browser QA va sign-off van con mo.

---

## 1. Tổng Quan Dự Án

**VNInvest** là ứng dụng theo dõi danh mục đầu tư chứng khoán Việt Nam (HOSE/HNX/UPCOM) kết hợp robo-advisor. Mục tiêu cung cấp công cụ theo dõi realtime, phân tích hiệu suất, cảnh báo whale, và tư vấn giao dịch tự động cho nhà đầu tư cá nhân người Việt.

### Stack Công Nghệ

| Lớp | Công nghệ | Phiên bản |
|-----|-----------|-----------|
| Backend framework | Django + Django REST Framework | 6.0.3 |
| ASGI server | Daphne | 4.2.1 |
| WebSocket | Django Channels | — |
| Task queue | Celery | — |
| Message broker | Redis | — |
| Market data | vnstock (nguồn VCI) | — |
| ORM | Django ORM | SQLite local / PostgreSQL prod |
| Frontend | React | — |
| Styling | Tailwind CSS | — |
| HTTP client | Axios + proxy dev | — |
| Runtime | Python 3.13 / Node 20 | — |

### Môi Trường

```
Backend : http://127.0.0.1:8000/
Frontend: http://localhost:3000/
Health  : http://127.0.0.1:8000/health/
Admin   : http://127.0.0.1:8000/admin/
venv    : backend/.venv/
```

---

## 2. Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend (3000)              │
│  Dashboard │ Watchlist │ StockDetail │ WhaleAlerts  │
│  AdminOps  │ Portfolio  │ Login/Auth                │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/REST + WebSocket (WS)
┌──────────────────▼──────────────────────────────────┐
│               Django + Daphne ASGI (8000)           │
│                                                     │
│  /api/portfolio/     → Portfolio CRUD, analytics    │
│  /api/stock-management/ → Mã CK, nhóm, StockProfile │
│  /api/admin-sync/    → Sync operations              │
│  /api/realtime/      → Ticker fallback, whale-feed  │
│  /api/admin-ops/     → System ops dashboard        │
│  /ws/realtime/       → WebSocket gateway           │
│  /health/            → Health check                 │
└─────────┬───────────────────┬───────────────────────┘
          │                   │
┌─────────▼──────┐   ┌────────▼──────────────────────┐
│  SQLite/PgSQL  │   │  Redis (Pub/Sub + Channels)   │
│  Dữ liệu app  │   │  channel_layer + cache        │
└────────────────┘   └─────────┬─────────────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │  Celery Worker           │
                  │  collect_and_publish     │
                  │  (vnstock → compute →   │
                  │   Redis publish)        │
                  └──────────────────────────┘
```

### Realtime Event Flow

```
vnstock VCI API
  → Celery: collect_and_publish_realtime (mỗi 5s)
    → portfolio/realtime/collector.py  → raw quotes
    → portfolio/realtime/compute.py    → VWAP, whale detection
    → portfolio/realtime/publisher.py  → Redis pub/sub
      → Django Channels consumer
        → WebSocket → useRealtimeFeed.js (frontend)
          → Watchlist.jsx, DashboardRealtimePanel.jsx
```

---

## 3. Cấu Trúc Thư Mục Quan Trọng

```
backend/
  config/
    settings.py       — Feature flags: REALTIME_ENABLED, REALTIME_DEFAULT_WHALE_THRESHOLD
    urls.py           — Route aggregator (portfolio + stock-management + admin-sync + realtime + admin-ops)
    celery.py         — Celery app config
    asgi.py           — ASGI + Channels routing
  portfolio/
    models.py         — Domain models
    views.py          — API views
    analytics.py      — Portfolio analytics (Sharpe, Sortino, MDD, TWR)
    services.py       — Business logic (StockProfile sync, exchange lookup)
    serializers.py    — DRF serializers
    consumers.py      — WebSocket consumer (JWT auth + subscribe/unsubscribe)
    tasks.py          — Celery tasks (collect_and_publish_realtime)
    realtime/
      collector.py    — vnstock polling
      compute.py      — VWAP, whale detection
      publisher.py    — Redis fan-out
    urls.py           — Portfolio CRUD routes
    urls_stock.py     — Stock management routes
    urls_admin_sync.py — Admin sync routes
    urls_realtime.py  — Realtime fallback + whale-feed routes
    tests/
      test_api_routes.py
      test_realtime_compute.py
      test_realtime_gateway.py
      test_analytics_advanced.py
      test_admin_ops.py
  management/commands/
    seed_user.py
    seed_demo_data.py
    seed_securities_groups.py
    seed_watchlist.py
    sync_stockprofile.py
    realtime_tick.py

frontend/src/
  hooks/
    useRealtimeFeed.js    — WebSocket + polling fallback hook (SINGLE SOURCE OF TRUTH)
  components/
    DashboardRealtimePanel.jsx  — Realtime radar: quotes + whale alerts
    RealtimeDebugPanel.jsx      — Dev observability panel (?debug=realtime)
  pages/
    Dashboard.jsx
    Watchlist.jsx
    StockDetail.jsx
    WhaleAlertsDashboard.jsx
    AdminOps.jsx
    Login.jsx
  api/
    client.js             — Axios instance + API functions
```

---

## 4. Domain Models

| Model | Mô tả |
|-------|-------|
| `Portfolio` | Danh mục đầu tư của user |
| `SubAccount` | Tiểu khoản (normal / margin) |
| `Transaction` | Giao dịch mua/bán |
| `Holding` | Vị thế đang nắm giữ |
| `AccountSnapshot` | Snapshot NAV theo ngày |
| `Watchlist` | Danh sách theo dõi user |
| `WatchlistItem` | Mã CK trong watchlist |
| `PriceAlert` | Cảnh báo giá của user |
| `TrackedSymbol` | Mã CK đang track realtime |
| `StockProfile` | Hồ sơ mã CK (tên, sàn, ngành) |
| `DailyPrice` | Giá lịch sử EOD |
| `MarketGroup` | Nhóm thị trường (VN30, HOSE, ...) |
| `MarketGroupMember` | Thành viên nhóm |
| `ScreenerRule` | Quy tắc lọc cổ phiếu JSON |
| `UserConfig` | Cấu hình user (ngưỡng whale, ...) |

---

## 5. API Contract (v1.1)

### Portfolio
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST | `/api/portfolio/portfolios/` | Danh mục |
| GET/PUT | `/api/portfolio/portfolios/{id}/` | Chi tiết |
| GET | `/api/portfolio/portfolios/{id}/summary/` | NAV + P/L |
| GET | `/api/portfolio/portfolios/{id}/allocation/` | Phân bổ (`?by=sector\|symbol`) |
| GET | `/api/portfolio/portfolios/{id}/chart/` | Equity curve |
| GET | `/api/portfolio/portfolios/{id}/analytics/` | Sharpe, Sortino, MDD, TWR |
| CRUD | `/api/portfolio/transactions/` | Giao dịch |
| GET | `/api/portfolio/holdings/` | Vị thế |
| CRUD | `/api/portfolio/price-alerts/` | Cảnh báo giá |
| CRUD | `/api/portfolio/tracked-symbols/` | Tracked symbols |

### Stock Management
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/stock-management/market-groups/` | Nhóm thị trường |
| GET | `/api/stock-management/market-groups/{id}/members/` | Thành viên nhóm |
| GET | `/api/stock-management/stock-profiles/` | Hồ sơ CK |
| GET | `/api/stock-management/daily-prices/` | Giá lịch sử |
| CRUD | `/api/stock-management/watchlist/` | Watchlist |
| CRUD | `/api/stock-management/watchlist/{id}/items/` | Watchlist items |
| CRUD | `/api/stock-management/screener-rules/` | Screener rules |

### Realtime
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/realtime/ticker/{symbol}/` | Fallback HTTP ticker |
| GET | `/api/realtime/whale-feed/{symbol}/` | Whale orders history |
| WS | `/ws/realtime/?token={access_token}` | WebSocket gateway |

### Admin
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/admin-sync/sync-stockprofile/` | Sync StockProfile |
| GET | `/api/admin-ops/stats/` | System stats |
| GET | `/health/` | Health check |
| GET | `/health/realtime/` | Realtime / Redis health |

---

## 6. WebSocket Event Contract (v1.0)

**Channel naming**: `ticker:{SYMBOL}`, `whale:{SYMBOL}`, `user:{id}:alerts`

**Envelope**:
```json
{
  "contract_version": "1.0",
  "event_type": "ticker_update | whale_alert | heartbeat",
  "symbol": "SSI",
  "ts": "2026-04-01T09:30:05.123+07:00",
  "seq": 102934,
  "source": "collector-vnstock-vci",
  "data": {}
}
```

**`ticker_update`.data**: `price, volume, vwap, change_value, change_pct, session`  
**`whale_alert`.data**: `matched_value, threshold, side (buy|sell), volume, price, size_class (whale|shark)`  
**`heartbeat`.data**: `server_ts, uptime_seconds`

---

## 7. Feature Flags (settings.py)

| Flag | Default | Mô tả |
|------|---------|-------|
| `REALTIME_ENABLED` | `False` | Bật/tắt Celery realtime |
| `REALTIME_DEFAULT_WHALE_THRESHOLD` | `1_000_000_000` | Ngưỡng whale (1 tỷ VNĐ) |
| `REALTIME_REDIS_URL` | `redis://localhost:6379/0` | Redis URL |
| `REALTIME_CHANNEL_LAYER` | `inmemory` | `inmemory` cho dev / `redis` cho prod |

---

## 8. Lịch Sử Sprint

### Sprint 7 — Domain Alignment & API Contract ✅ DONE
- Chốt schema domain: Transaction, Holding, AccountSnapshot, Watchlist, StockProfile.
- Chuẩn hóa API route: `/api/portfolio/`, `/api/stock-management/`, `/api/admin-sync/`.
- Seed demo data.
- Smoke test tất cả route.

### Sprint 8 — Portfolio Engine v2 ✅ DONE
- Weighted average cost basis chuẩn.
- Margin sub-account: ratio, buying power.
- Snapshot NAV lúc 15:30.
- Unit test analytics core.

### Sprint 9 — Performance & Benchmark ✅ DONE
- TWR ngày/tuần/tháng.
- Benchmark so VN-Index.
- API report + equity curve chart.
- Export CSV.

### Sprint 10 — Realtime Event-Driven Foundation ✅ DONE
- Django Channels + ASGI stack.
- Redis Pub/Sub: `ticker:{symbol}`, `whale:{symbol}`, `user:{id}:alerts`.
- Celery collector → compute (VWAP/Whale) → publisher.
- WebSocket auth bằng JWT token qua query string.
- Fallback HTTP polling (`/api/realtime/ticker/{symbol}/`).

### Sprint 11 — Pro Watchlist & Realtime Pipeline ✅ DONE
- `portfolio/realtime/collector.py`, `compute.py`, `publisher.py`.
- Celery task `collect_and_publish_realtime`.
- Feature flags `REALTIME_ENABLED`, `REALTIME_DEFAULT_WHALE_THRESHOLD`.
- Frontend: Watchlist WS + Dashboard panel realtime slice.
- Heartbeat payload publish.
- Dev mode `REALTIME_CHANNEL_LAYER=inmemory`.
- 9 backend tests pass.

### Sprint 12 — User Management Core + Frontend Realtime UX + Resilience ✅ DONE  
*Chốt ngày 2026-04-02, 100% checklist pass*

**Backend**:
- Seed demo data mở rộng (holdings, snapshots, watchlist, tracked symbols).
- 12 backend tests pass (test_api_routes + test_realtime_compute + test_realtime_gateway).
- StockProfile sync: `sync_stockprofile --mode all` → 3249 profiles.
- SECRET_KEY 64 chars, JWT token 2h access / 7d refresh.
- Chuẩn hóa mốc `User Management Core`: `/api/auth/me/`, plan, CASL abilities, protected route flow quy chiếu về Sprint 12.
- Scope mo rong `Đăng ký người dùng` da duoc implement voi email required + auto-login (xem `docs/SPRINT12_USER_REGISTRATION_PLAN.md`).

**Frontend**:
- `useRealtimeFeed.js` là SINGLE SOURCE OF TRUTH cho toàn bộ WebSocket logic (243 lines).
- Watchlist.jsx + DashboardRealtimePanel.jsx dùng chung hook, 0 WebSocket logic trùng lặp.
- Watchlist: phân tách "Nhóm thị trường" vs "Danh sách theo dõi cá nhân".
- Thao tác 2 chiều trên Nhóm thị trường: thêm/xóa từng mã, thêm/xóa cả nhóm.
- `RealtimeDebugPanel.jsx`: observability panel với event counters, latency, channel layer badge.
- Dashboard panel: NAV realtime, P/L, market breadth (up/down/flat), whale alerts, stale count.
- `maxAlerts=5`, chống duplicate (key = symbol+ts+side), reconnect/backoff có giới hạn.
- Fallback polling khi socket disconnect.
- Build pass: `Compiled successfully! 251.69 kB`.

### Sprint 13 — Analytics Nâng Cao & Admin Dashboard ✅ DONE  
*Chốt ngày 2026-04-02, 100% checklist P0 pass*

**Portfolio Analytics**:
- `analytics.py`: `compute_max_drawdown`, `compute_sharpe`, `compute_sortino`, `compute_twr`, `compute_daily_returns`.
- API `GET /api/portfolio/portfolios/{id}/analytics/` → Sharpe, Sortino, MDD, TWR, Volatility, Best/Worst day.
- Allocation `?by=sector`: join với StockProfile, "Chưa phân loại" khi không có profile.
- 28 analytics tests pass.

**Stock Detail Workspace**:
- `/stocks/:symbol` nâng cấp: realtime quote từ `useRealtimeFeed`, company profile (tên/sàn/ngành/vốn hóa), session stats từ DailyPrice, active price alerts, whale alerts lọc theo symbol.

**Admin Operations Dashboard**:
- `/admin-ops`: chỉ `is_staff`, trả 403 nếu không.
- System health: `channel_layer_type`, `realtime_enabled`, `redis_ok`.
- User stats: tổng user, portfolio, tracked symbols, watchlist items.
- Last sync time từ `MarketGroupSyncLog`, `StockProfileSyncLog`.
- 13 tests pass (`test_admin_ops.py`).
- Tổng: 41 tests pass.
- `npm run build` pass: 0 errors.

**Hotfixes trong Sprint 13 (2026-04-02)**:
- `services.py`: `_fetch_exchange_lookup()` — chạy vnstock trong daemon thread 20s timeout, bắt `BaseException` (vnstock có thể gọi `sys.exit()` khi bị rate-limit VCI). Sau đó `build_stock_profile_payload()` merge `company_name` + `exchange` vào tất cả symbol → 3249 profiles đầy đủ.
- `AdminOps.jsx`: xử lý status 429 với UI riêng + retry button.
- `DashboardRealtimePanel.jsx`: sửa JSX `/div` bị thiếu.
- `Watchlist.jsx`: bọc fragment `<>...</>` để tránh adjacent JSX error.
- `DashboardRealtimePanel.jsx`: nâng cấp whale alerts panel — rich cards có border màu emerald/rose, emoji 🦈🐋, label "▲ MUA LỚN"/"▼ BÁN LỚN", `fmtBil()`, link tới `/whale-alerts/{symbol}`, animate alert mới nhất.

---

## 9. Sprint 14 — Kế Hoạch Tiếp Theo (PLANNING)

**Mục tiêu dự kiến**:
- Backtest UI: chạy backtest strategy SMA/RSI trên DailyPrice 3-5 năm qua.
- HHI concentration score trong allocation API.
- Allocation by sector toggle trên pie chart.
- Telegram Bot push notification cho whale alerts.
- Production hardening: PostgreSQL migration guide, Redis sentinel config.
- Load test: p95 WS latency < 1.5s với 50+ symbols.

---

## 10. Hướng Dẫn Môi Trường Dev

### Khởi động backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py seed_user          # testuser / Test@123456
python manage.py seed_demo_data --reset
python manage.py seed_securities_groups --mode all
python manage.py sync_stockprofile --mode all
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Khởi động Celery worker
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A config worker -l info --pool=solo
```

### Khởi động frontend
```powershell
cd frontend
npm start
```

### Build production frontend
```powershell
cd frontend
npm run build
```

### Chạy tests
```powershell
cd backend
python manage.py test portfolio.tests.test_api_routes portfolio.tests.test_realtime_compute portfolio.tests.test_realtime_gateway portfolio.tests.test_analytics_advanced portfolio.tests.test_admin_ops
```

### Realtime tick thủ công (1 chu kỳ)
```powershell
python manage.py realtime_tick --sync --user-id 3
```

---

## 11. Quy Tắc Phát Triển

1. **WebSocket logic chỉ ở một chỗ**: `frontend/src/hooks/useRealtimeFeed.js`. Page/component KHÔNG tự tạo WebSocket.
2. **API error boundary**: `AdminOps.jsx` xử lý 401, 403, 429, 5xx riêng biệt. Tương tự các trang quan trọng.
3. **vnstock calls**: luôn bọc trong `try/except BaseException` + thread timeout; vnstock có thể gọi `sys.exit()`.
4. **Feature flags**: mọi tính năng mới có thể bật/tắt qua `settings.py` trước khi commit.
5. **Test coverage**: mỗi endpoint mới có ít nhất 1 smoke test trong `test_api_routes.py`.
6. **StockProfile sync**: sau khi thêm nguồn dữ liệu mới, chạy `sync_stockprofile --mode all` để đồng bộ.
7. **Migrations**: không edit migration cũ. Thêm migration mới nếu thay đổi model.

---

## 12. Metrics Hiện Tại

| Metric | Giá trị |
|--------|---------|
| Backend tests pass | 41/41 |
| Frontend build | ✅ 0 errors |
| StockProfiles synced | 3249 |
| Web routes working | 100% |
| WebSocket duplication | 0 (single hook) |
| Sprint hoàn thành | 7, 8, 9, 10, 11, 12, 13 |
| Sprint tiếp theo | 14 (PLANNING) |
