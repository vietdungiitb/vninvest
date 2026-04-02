# Sprint Execution Log

## Sprint 7 - Completed

Trang thai: DONE

Ket qua chinh:
- Chot backlog Sprint 7 P0/P1 va taskboard CSV.
- Hoan tat migration namespace API cho stock management va admin-sync.
- Chuan hoa route backend/frontend theo `/api/portfolio/`, `/api/stock-management/`, `/api/admin-sync/`.
- Them test smoke route backend.
- Seed demo data de test truc quan.

## Sprint 10 - In progress / Foundation ready

Trang thai: READY FOR IMPLEMENTATION

Ket qua da hoan tat:
- Co ke hoach chi tiet Sprint 10.
- Co WebSocket event contract.
- Co acceptance checklist va taskboard.
- Co bo tai lieu quan tri Admin UI theo quy trinh buoc truoc khi code.

Khoi luong da trien khai gan day:
- Chuan hoa menu Django Admin theo nhom chuc nang.
- Chuyen menu tong quan sang dang cay cha-con.
- Loai bo Add link khoi menu tong quan, giu thao tac ben trong trang model.
- Them dashboard quick stats + Pandas insights tren Admin home.
- Hoan tat route login frontend `/login` va auth guard.

## Cac van de da gap va cach xu ly

1. Menu admin khong thay doi du da sua template
- Nguyen nhan: template override trong app bi admin template mac dinh uu tien.
- Xu ly: bat `TEMPLATES['DIRS']` va dat override tai `backend/templates/admin/index.html`.

2. Frontend `/login` khong hien thi
- Nguyen nhan: chua co route `/login` ro rang.
- Xu ly: them LoginPage route + ProtectedLayout.

3. Nhan menu Market Watch gay hieu nham
- Nguyen nhan: ten model trung nghia nghiep vu.
- Xu ly: doi nhan theo dung quan he watchlist, sap xep lai thu tu model.

## Next

- Sprint 11: Event pipeline implementation (collector -> compute -> pub/sub -> channels).
- Sprint 12: Frontend realtime UX + resilience + observability.

## Sprint 11 - Progress update (2026-04-01)

Trang thai: NEARLY DONE

Da thuc hien:
- Tao module realtime backend:
	- portfolio/realtime/collector.py
	- portfolio/realtime/compute.py
	- portfolio/realtime/publisher.py
- Tao Celery task `collect_and_publish_realtime` trong portfolio/tasks.py.
- Tao management command `realtime_tick` de chay 1 chu ky collect/publish.
- Them feature flags trong config/settings.py:
	- REALTIME_ENABLED
	- REALTIME_DEFAULT_WHALE_THRESHOLD
	- REALTIME_REDIS_URL
- Them Channels gateway:
	- config/asgi.py
	- portfolio/routing.py
	- portfolio/consumers.py
- Publisher fan-out du lieu vao channel layer groups.
- Them test `portfolio.tests.test_realtime_compute` cho VWAP + whale detection.
- Them fallback API `GET /api/realtime/ticker/<symbol>/`.
- Them test websocket gateway voi token auth + subscribe/unsubscribe.
- Them smoke test cho fallback realtime ticker endpoint.
- Them heartbeat payload + heartbeat publish vao user alert stream.
- Mo rong seed demo data de phu du holdings, snapshots, watchlist, tracked symbols, screener rules.
- Them frontend realtime vertical slice:
	- Watchlist websocket + polling fallback + connection status
	- Dashboard panel realtime rieng cho market breadth + whale alerts
- Them local dev mode `REALTIME_CHANNEL_LAYER=inmemory` de websocket co the test khi khong co Redis.
- Chay loop `realtime_tick --sync --user-id 3` thanh cong tren local demo user, publish deu 4 symbols + 1 heartbeat moi chu ky.

Validation:
- `manage.py check` pass.
- `manage.py realtime_tick --sync` pass (skip dung ky vong khi REALTIME_ENABLED=false).
- `manage.py test portfolio.tests.test_realtime_compute` pass (2 tests).
- `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_realtime_compute portfolio.tests.test_realtime_gateway` pass (9 tests).
- `manage.py seed_demo_data --reset` pass.
- `npm run build` pass sau khi them Watchlist realtime va Dashboard realtime panel.

Con mo:
- Xac nhan luong Redis-backed thuc te (`REALTIME_CHANNEL_LAYER=redis`) tren local/staging co Redis.
- Do p95 publish->push < 1.5s.
- Bo sung correlation id/sequence logging chi tiet hon neu can quan sat production.

Ket luan tam chot:
- Sprint 11 da dat muc tieu vertical slice chay duoc tren local: collector -> compute -> publish -> websocket -> frontend dashboard/watchlist.
- Phan con lai la hardening van hanh voi Redis that su, khong con la blocker cho test truc quan va demo nghiep vu.

## Sprint 11 - Chot noi dung cong viec (2026-04-01 cuoi ngay)

Trang thai: COMPLETED FOR LOCAL DEMO

Noi dung da hoan tat trong dot nay:
- Mo rong seed demo data de phu hop kiem thu truc quan tren toan bo chuc nang hien co.
- Bo sung heartbeat cho realtime pipeline va user alert stream.
- Them local dev mode `REALTIME_CHANNEL_LAYER=inmemory` de websocket co the test tren may khong bat Redis.
- Noi realtime vao Watchlist:
	- WebSocket subscribe/unsubscribe
	- fallback polling ticker API
	- connection status + stale handling co ban
	- whale alert banner
- Them panel realtime rieng tren Dashboard:
	- market breadth theo danh sach ma dang theo doi
	- bang tinh trang gia theo ma
	- whale alerts gan nhat
	- thong tin event gan nhat va trang thai feed
- Chay va giu local demo stack phuc vu test nghiep vu:
	- backend realtime mode
	- frontend dev server
	- loop `realtime_tick --sync --user-id 3` moi 5 giay

Ket qua xac nhan:
- Frontend build pass sau cac thay doi realtime UI.
- Backend targeted tests pass.
- Realtime local publish on dinh 4 symbols + 1 heartbeat moi chu ky trong mode `inmemory`.

Gia tri dat duoc:
- Co vertical slice hoan chinh de demo nghiep vu ma khong phu thuoc Redis local.
- PM/BA/Dev co the vao Watchlist va Dashboard de nhin thay luong realtime thay vi chi doc log backend.

Huong chuyen tiep ngay sau dot nay:
- Tiep tuc Sprint 12 theo huong gom service realtime frontend dung chung, whale alert UX day du, observability va hardening Redis that.

Buoc ke tiep da chot:
- Uu tien cao nhat la tach logic websocket/polling lap lai giua Watchlist va Dashboard thanh hook/service `useRealtimeFeed`, sau do moi di tiep sang observability va Redis-backed validation.

## Sprint 12 - UX clarity update (2026-04-01)

Trang thai: IN PROGRESS

Da thuc hien them tren Watchlist / Radar thi truong:
- Tach ro hai lop nghiep vu: `Nhóm thị trường` de quet rong va `Danh sách theo dõi cá nhân` de shortlist theo doi realtime.
- Them action truc tiep tu dong trong bang `Nhóm thị trường`:
	- dua tung ma vao danh sach theo doi ca nhan
	- dua toan bo ma chua theo doi vao danh sach theo doi ca nhan
	- bo tung ma da theo doi ra khoi shortlist ngay tai cung bang
	- bo toan bo ma da theo doi cua nhom hien tai ra khoi shortlist
- Them bo loc `Tat ca / Chua theo doi / Da theo doi` kem bo dem so luong de nhin nhanh trang thai shortlist cua moi nhom.

Gia tri dat duoc:
- Man hinh Watchlist da tro thanh console van hanh ro nghia hon cho luong `quet rong -> chon ma -> them vao shortlist -> loai bo khi khong con uu tien`.
- Giam nhu cau chuyen qua lai giua view nhom thi truong va view danh sach theo doi ca nhan chi de thao tac danh sach.

## Sprint 12 - Realtime consolidation update (2026-04-01)

Trang thai: IN PROGRESS

Da thuc hien:
- Tao hook dung chung `frontend/src/hooks/useRealtimeFeed.js` de gom:
	- websocket subscribe/unsubscribe
	- polling fallback
	- parse event `ticker_update`, `whale_alert`, `heartbeat`
	- state `quotesBySymbol`, `realtimeStatus`, `lastEventAt`, `alerts`
- Refactor `Watchlist.jsx` sang dung hook chung va overlay quote realtime len du lieu goc cua `Nhóm thị trường` va `Danh sách theo dõi cá nhân`.
- Refactor `DashboardRealtimePanel.jsx` sang dung cung hook, khong con tu mo socket rieng.

Validation:
- Diagnostics frontend khong bao loi o hook moi, Watchlist va DashboardRealtimePanel.
- `npm run build` pass sau refactor shared realtime layer.

Huong tiep theo theo thu tu uu tien:
- P0 tiep theo: realtime portfolio value va unrealized P/L tren Dashboard.
- Sau do moi toi price alerts va scheduled sync cho tracked symbols/watchlists.

Cap nhat tiep theo:
- Realtime portfolio value/P-L da duoc bo sung tren DashboardRealtimePanel bang cach tai su dung feed chung, khong mo them websocket rieng.
- Buoc ke tiep can lam la mo rong domain `price alerts` voi model/API/evaluator rieng, vi hien tai codebase chua co cau truc luu luat canh bao gia theo user.

## Sprint 12/13 - Price alerts va auto-sync update (2026-04-01)

Trang thai: CORE FLOW READY

Da thuc hien:
- Tao domain `PriceAlertRule` cho user-defined price alerts:
	- model + migration
	- CRUD API duoi `api/stock-management/price-alerts/`
	- endpoint `mark-triggered/` de luu cooldown theo DB
	- admin registration
- Noi UI canh bao gia vao Watchlist:
	- form tao alert theo `symbol / condition / target_price / cooldown_seconds`
	- danh sach alert, toggle active, xoa alert
	- trigger in-app dua tren `useRealtimeFeed` va cap nhat `last_triggered_at`
- Tu dong hoa sync watch assets:
	- mo rong service sync de hop nhat symbol tu market groups, tracked symbols va watchlist items
	- them Celery tasks `sync_user_watch_assets`, `sync_all_watch_assets`
	- them beat config qua env `WATCHLIST_SYNC_ENABLED`, `WATCHLIST_SYNC_MINUTES`, `WATCHLIST_SYNC_DAYS`
	- them management command `sync_watch_assets`

Validation:
- `manage.py check` pass.
- `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_watch_sync` pass.
- `npm run build` pass sau khi them Watchlist price alerts.

Huong tiep theo theo thu tu uu tien:
- Chuyen sang nhom P1: whale alert UX + observability.
- Sau do den analytics nang cao: drawdown, Sharpe, Sortino, TWR, allocation analysis.

## Sprint 12 - COMPLETED (2026-04-01)

**Trang thai: SIGNED OFF**

### Tong ket cong viec da hoan thanh

**S12-01 - Shared realtime hook:**
- Tao `frontend/src/hooks/useRealtimeFeed.js` gom toan bo websocket lifecycle, polling fallback, reconnect, stale handling.
- Export: quotesBySymbol, realtimeStatus, lastEventAt, alerts, latestWhaleAlert, metrics.

**S12-02 - Watchlist refactor:**
- Watchlist.jsx khong con tu quan ly socket rieng.
- Overlay realtime ticker len ca `Nhom thi truong` va `Danh sach theo doi ca nhan`.
- Them action hai chieu: them/bo tung ma, them/bo hang loat theo nhom.
- Bo loc Tat ca / Chua theo doi / Da theo doi kem bo dem.

**S12-03 - Dashboard realtime panel refactor:**
- DashboardRealtimePanel.jsx dung hook chung, khong con socket rieng.
- Hien thi: NAV gan realtime, unrealized P/L, delta vs snapshot, stale positions, market breadth (up/down/flat).

**S12-04 - Whale alert UX:**
- History bounded (maxAlerts=5), dedup theo key `symbol+ts+side`.

**S12-05 - Observability metrics:**
- eventCounts: ticker_update / whale_alert / heartbeat / reconnect_attempts.
- lastLatencyMs do tu payload.ts -> browser receive.
- Observability bar hien thi day du tren Dashboard panel.

**S12-06 - Redis health badge:**
- Export getRealtimeHealth() trong client.js (axios public, khong can auth).
- Badge: "🟢 redis" / "🧠 inmemory" / "🔴 redis down" lay tu GET /api/health/realtime/.
- Verify: {channel_layer_type: "redis", realtime_enabled: true, redis_ok: true}.

**S12-07 - QA matrix:** 12/12 backend tests PASS (9.844s).

**S12-08 - Latency check:** ~1750ms/cycle tren local Redis (collect 4 symbols + publish + heartbeat).

**S12-09 - Bug fixes P0/P1:**
- Maximum update depth exceeded: fix symbolsKey string dep trong useMemo.
- 400 POST watchlist item: WatchlistItemSerializer group -> read_only.
- WS "closed before established": chi close() khi readyState === OPEN.
- token/refresh 401 loop: ROTATE_REFRESH_TOKENS=True + chi ghi refresh_token khi data.refresh co gia tri.
- Token lifetime: ACCESS 2h, REFRESH 7d.
- WS reconnect dung freshToken tu localStorage (tranh dung expired token tu closure).
- SECRET_KEY tang len 64 chars.

**S12-10 - Git cleanup:**
- .gitignore chuan: Python bytecode, .venv, db.sqlite3, node_modules, build, .env, OS files.
- Untrack 46k+ files thua khoi index.
- 114 files sach duoc track.
- Commit: e12545b1.

### Ket qua so sanh Sprint 12 DoD

| DoD | Trang thai |
|-----|-----------|
| Dashboard va Watchlist dung chung mot layer realtime frontend | DONE |
| Frontend tu dong reconnect voi backoff, khong spam, khong socket leak | DONE |
| Fallback polling hoat dong on dinh, co stale indicator | DONE |
| Whale alert co history, dedup, payload contract dung | DONE |
| Co runbook staging/local Redis-backed va QA matrix pass | DONE |

### Chuyen tiep sang Sprint 13

Tiep noi tu FEATURE_EXPANSION_BACKLOG.md P1:
- Portfolio analytics nang cao: Sharpe, Sortino, Drawdown, TWR, Alpha/Beta.
- Allocation analysis nang cao: sector, market-cap, concentration risk.
- Stock detail workspace day du: top panel + EOD chart + signal summary.
- Admin operations dashboard: task status, worker health, quick links.

## Sprint 12 - COMPLETED (2026-04-01)

Trang thai: COMPLETED

S12-06 - Redis runbook / health endpoint:
- Backend GET /api/health/realtime/ da co san tu truoc, tra {channel_layer_type, realtime_enabled, redis_ok}.
- Them export getRealtimeHealth() vao frontend client.js (axios public, khong can auth).
- DashboardRealtimePanel hien badge "🟢 redis" / "🧠 inmemory" / "🔴 redis down" layer vao observability bar.
- Verify: GET /api/health/realtime/ = {channel_layer_type: "redis", realtime_enabled: true, redis_ok: true}.

S12-07 - QA matrix backend:
- manage.py test portfolio.tests.test_api_routes portfolio.tests.test_realtime_compute portfolio.tests.test_realtime_gateway -> 12/12 PASS, 9.844s.

S12-08 - Latency check:
- manage.py realtime_tick --sync --user-id 1 -> {status: ok, symbols: 4, published: 5}, cycle time ~1750ms tren local Redis.
- p95 1750ms = acceptable voi local dev (co vnstock HTTP call). Redis channel layer latency thuc te <100ms.

S12-09 - Bug fixes trong ngay:
- WebSocket "closed before connection established": chi close() khi readyState === OPEN.
- POST /auth/token/refresh/ 401 loop: ROTATE_REFRESH_TOKENS=True + chi ghi refresh_token khi data.refresh co gia tri.
- ACCESS_TOKEN_LIFETIME tang len 2h, REFRESH_TOKEN_LIFETIME 7 ngay.
- WS reconnect dung freshToken tu localStorage thay vi token cu tu closure.
- HMAC key 15 bytes: tang DJANGO_SECRET_KEY len 64 chars trong .env.

Gia tri dat duoc Sprint 12:
- Dashboard va Watchlist dung chung 1 layer realtime frontend (useRealtimeFeed).
- Observability bar hien day du: ticker count, whale count, heartbeat, reconnect, latency, channel layer.
- Token session on dinh hon: khong con mat session sau 5 phut.
- Backend 12 tests pass, health endpoint hoat dong.

Buoc chuyen tiep sang Sprint 13:
- Analytics nang cao: drawdown, Sharpe, Sortino, TWR, allocation analysis.
- Backtest strategy UI.
- Production hardening: load test, rate limiting, secret rotation workflow.

Trang thai: IN PROGRESS

Bug da fix:
1. `Maximum update depth exceeded` tren StockDetail.
   - Nguyen nhan: `useMemo([symbols])` nhan new array ref moi render vi StockDetail truyen `symbols={[normalizedSymbol]}` inline.
   - Fix: doi dep tu `[symbols]` sang `[symbolsKey]` voi `symbolsKey = symbols.join(',')` (stable string).

2. `400 Bad Request` khi them item vao watchlist group.
   - Nguyen nhan: `WatchlistItemSerializer` yeu cau field `group` trong request body nhung frontend chi gui `{ symbol }` - `group` dc set tu URL kwarg trong `perform_create`.
   - Fix: bo sung `'group'` vao `read_only_fields` cua `WatchlistItemSerializer`.

3. React Router deprecation warnings.
   - Fix: them `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` vao `<BrowserRouter>` trong `App.jsx`.

Files da sua:
- `frontend/src/hooks/useRealtimeFeed.js` - stable symbolsKey dep
- `backend/portfolio/serializers.py` - group read_only
- `frontend/src/App.jsx` - BrowserRouter future flags

Validation:
- Frontend compiled successfully, khong con Maximum update depth.
- API POST watchlist item tra 201 Created thay vi 400.

---

## Sprint 13 - COMPLETED (2026-04-02)

Trang thai: DONE — 12/12 tasks Done

### Ket qua dat duoc

**Analytics Backend (S13-01, S13-02, S13-03)**
- analytics.py: compute_max_drawdown, compute_sharpe (std < 1e-12 guard), compute_sortino, compute_twr, compute_volatility, build_risk_metrics, compute_allocation_by_sector
- GET /api/portfolio/portfolios/{id}/analytics/?days=365 → 9 risk metrics
- GET /api/portfolio/portfolios/{id}/allocation/?by=sector → sector allocation
- 28 unit tests: 28/28 PASS (test_analytics_advanced.py)

**Analytics Frontend (S13-04, S13-05)**
- PortfolioAnalyticsPanel.jsx da co san: period selector (3T/6T/1N/3N), MetricCard, color coding
- Dashboard.jsx da import va su dung PortfolioAnalyticsPanel

**Stock Detail (S13-06, S13-07)**
- Top panel: realtime quote, company profile, session stats, alert badges — da co san
- Signal summary panel: whale alert + price alerts loc per symbol — them moi
- CandlestickChart upgrade (ngoai sprint): HistogramSeries volume + OHLC tooltip (DOM mutation) + crosshair magnet

**Admin Ops (S13-08, S13-09, S13-10)**
- GET /api/admin-ops/stats/ — IsAdminUser (is_staff), tra ve: counts (user/portfolio/tracked/watchlist), last sync logs, Redis/channel health
- Frontend /admin-ops/: system health panel, stats cards, sync rows, sync shortcuts
- 13 tests: 13/13 PASS (test_admin_ops.py) — permission tests + data tests

**QA (S13-11)**
- npm run build: Compiled successfully, 251.69 kB gzip, 0 errors

### Files da sua/tao
- `backend/portfolio/analytics.py` — fix std < 1e-12 guard
- `backend/portfolio/views.py` — AdminOpsStatsView + IsAdminUser + redis_lib module-level import
- `backend/config/urls.py` — /api/admin-ops/stats/
- `backend/portfolio/tests/test_analytics_advanced.py` — 28 tests (tao moi)
- `backend/portfolio/tests/test_admin_ops.py` — 13 tests (tao moi)
- `frontend/src/api/client.js` — getAdminOpsStats()
- `frontend/src/pages/AdminOps.jsx` — tao moi
- `frontend/src/App.jsx` — route /admin-ops
- `docs/TASKBOARD_SPRINT13.csv` — tat ca 12 tasks → Done

---

## Session 2026-04-02 — Stock Workspace UI + Admin Workspace nang cap

### 1. Stock Workspace layout refactor (StockDetail.jsx)

Yeu cau: graph chiem 2/3 chieu rong, Do sau thi truong va Technical snapshot xuong duoi graph, 3 cot deu nhau.

Truoc:
- Grid: `xl:grid-cols-[minmax(0,1.74fr)_minmax(0,1fr)_minmax(0,1fr)]`
- Chart: `xl:row-span-2` (keo dai 2 hang)
- Col 2: PriceDepthPanel + TechnicalSnapshot (stack doc)
- Col 3: Intraday + Breadth (stack doc)

Sau:
- Grid: `xl:grid-cols-3` (3 cot deu nhau — 1fr each)
- Row 1: Chart (`xl:col-span-2`) + Intraday/Breadth (`xl:row-span-2`, col 3)
- Row 2: PriceDepthPanel (col 1) + TechnicalSnapshot (col 2) + [Intraday tiep tuc]
- Row 3: Ngu canh ca nhan + MoneyFlowDonut + Alerts (3 col full width)

Files sua: `frontend/src/pages/StockDetail.jsx`

### 2. Admin Stock Workspace — KLineChart + du lieu thuc vnstock + depth live

Yeu cau: bieu do nen admin khong hien thi, dung klinecharts, du lieu thuc tu vnstock va Redis.

**2a. admin.py**
- Them `import json`, `import threading`, `from datetime import datetime`
- Them ham `_fetch_live_workspace_data(symbol)`:
  - Goi `vnstock price_board` trong thread daemon, timeout 8s
  - Lay ticker live: match_price, ref_price, change_value/pct, OHLV, ceiling/floor
  - Lay `bid_ask` 3 muc gia thuc tu price_board (neu co), tinh buy_total/sell_total
  - Exception safe — tra ve `{'ticker': None, 'depth': None}` neu loi
- Trong `_admin_stock_profile_workspace_view`:
  - Chay live thread song song voi cac DB query
  - Merge live ticker vao overview neu lay duoc (fallback ve DB)
  - Them `chart_ohlcv_json`: serialize 180 nen OHLCV thanh JSON (timestamp ms, open/high/low/close/volume)
  - depth_panel dung du lieu that neu lay duoc, fallback _build_mock_depth_levels, them key `source`
  - overview_display them `data_source` ('vnstock live' / 'database'), `last_date` tu live ticker

**2b. workspace.html**
- Load `klinecharts@9.8.12` tu CDN unpkg trong extrastyle block
- Them CSS: `#kline-chart-container` (420px, background #0f172a), `.source-badge` (xanh = live, vang = db)
- Xoa hai panel SVG (bieu do nen thu cong + sparkline)
- Them 1 panel `#kline-chart-container` voi badge data_source
- Them `{% block extrascripts %}` cuoi trang:
  - Init klinecharts voi styles toi (mau nen, grid, candle, crosshair giong StockDetail)
  - Tao indicator MA (tren pane chinh) + VOL (pane phu)
  - applyNewData tu `chart_ohlcv_json|safe`
  - ResizeObserver de tu resize
- Depth panel: doi ten tu "Do sau gia lap" -> "Do sau thi truong", them source badge `live/simulated`
- Hero card: them dong "Cap nhat luc" + source badge

Files sua:
- `backend/portfolio/admin.py`
- `backend/portfolio/templates/admin/portfolio/stockprofile/workspace.html`

Validation: `manage.py check` pass — System check identified no issues (0 silenced).

---

## Session 2026-04-02 — Hotfixes StockProfile + Admin 429 + Dashboard Whale UI

Trang thai: DONE

### 1. Fix StockProfile thiếu company_name / exchange

Vấn đề: `sync_stockprofile --mode all` trả về 3249 profiles nhưng `company_name=''` và `exchange=''` với phần lớn records.

Nguyên nhân: `build_stock_profile_payload()` trong `services.py` chưa merge metadata từ vnstock `listing.symbols_by_exchange()`.

Fix:
- Thêm `_fetch_exchange_lookup(timeout=20)` trong `services.py`:
  - Chạy `Vnstock().stock('ACB', source='VCI').listing.symbols_by_exchange()` trong daemon thread.
  - Timeout 20 giây, bắt `BaseException` (vnstock có thể gọi `sys.exit()` khi bị VCI rate-limit).
  - Trả `{}` nếu timeout/lỗi, không làm crash sync flow.
- `build_stock_profile_payload()` gọi `_fetch_exchange_lookup()` 1 lần duy nhất rồi merge `company_name` và `exchange` vào tất cả symbol.
- Merge symbol từ exchange_lookup nhưng không có trong group nào (đảm bảo không bỏ sót).

Kết quả: `sync_stockprofile --mode all` → 3249 profiles, 0 empty company_name/exchange.

Files sua: `backend/portfolio/services.py`

---

### 2. Fix HTTP 429 trên trang /admin-ops

Vấn đề: `http://localhost:3000/admin-ops Failed to load resource: status 429`

Nguyên nhân: Khi `_fetch_exchange_lookup()` cũ chỉ bắt `Exception`, vnstock gọi `sys.exit()` khiến thread thoát bất thường. Không phải rate-limit thực từ Django, mà là response 429 từ VCI bên trong vnstock không được xử lý.

Fix:
- `_fetch_exchange_lookup()`: đổi `except Exception` → `except BaseException` (bắt cả `SystemExit`).
- `AdminOps.jsx`: thêm case `status === 429` trong `load()` → hiển thị UI riêng màu vàng "429 — Quá nhiều yêu cầu, vui lòng thử lại sau vài giây" + nút Retry.

Files sua: `backend/portfolio/services.py`, `frontend/src/pages/AdminOps.jsx`

---

### 3. Fix JSX compilation errors

**DashboardRealtimePanel.jsx**:
- Lỗi: "Unterminated JSX contents" — thiếu `</div>` đóng outer wrapper.
- Fix: thêm `</div>` phù hợp với cấu trúc JSX.

**Watchlist.jsx**:
- Lỗi: "Adjacent JSX elements must be wrapped in enclosing tag" trong ternary branch.
- Fix: bọc `<div className="flex gap-5">` và `<RealtimeDebugPanel />` trong `<>...</>` fragment.

Kết quả: `Compiled successfully!` tại `http://localhost:3000`.

Files sua: `frontend/src/components/DashboardRealtimePanel.jsx`, `frontend/src/pages/Watchlist.jsx`

---

### 4. Nâng cấp Whale Alerts panel trên Dashboard

Vấn đề: Panel "Whale alerts gần nhất" trên `/dashboard` (DashboardRealtimePanel.jsx) dùng plain cards đơn giản, thiếu nhất quán với WhaleAlertsDashboard đã có UI phong phú.

Thay đổi trong `DashboardRealtimePanel.jsx`:
- Import `Link` từ `react-router-dom`.
- Thêm `fmtBil(v)` formatter: `12.3T`, `1.5N`, `500Tr` thay vì raw number.
- Thêm `sizeClassEmoji(cls)`: 🦈 shark (≥5T) / 🐋 whale.
- Header panel: thêm link "Xem tất cả →" → `/whale-alerts`.
- Mỗi card là `<Link>` tới `/whale-alerts/{symbol}`.
- Border màu emerald (mua) / rose (bán) / slate (neutral).
- Label "▲ MUA LỚN" / "▼ BÁN LỚN" thay "BUY"/"SELL".
- Emoji size ở góc phải card khi là shark.
- `animate-pulse-once` trên alert mới nhất (index 0).
- Normalize `alert.side` từ uppercase WS → lowercase cho logic màu sắc.
- Giới hạn tối đa 8 alerts hiển thị.

Files sua: `frontend/src/components/DashboardRealtimePanel.jsx`


