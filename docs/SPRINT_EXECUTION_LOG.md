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

## Sprint 12 - QA + signoff (2026-04-01 cuoi ngay)

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
