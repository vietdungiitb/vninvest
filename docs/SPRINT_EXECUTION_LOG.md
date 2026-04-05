# Sprint Execution Log

## Sprint 19 - Mobile i18n + density optimization update (2026-04-05)

Trang thai: IMPLEMENTED

Da thuc hien:
- Hoan tat i18n cho mobile app (VI/EN) voi translator typed + locale store persist AsyncStorage.
- Migrate toan bo string tren cac man hinh chinh:
	- Auth
	- Dashboard
	- Transactions
	- Watchlist
	- BottomTabBar
- Them language toggle va menu goc phai tren Dashboard gom:
	- Profile
	- Settings
	- Language
	- Logout
- Chuyen nut menu sang dang icon de gon va de nhan biet hon tren mobile.
- Tinh chinh UI compact de tang mat do hien thi thong tin:
	- Dashboard: tang so item hien thi, giam khoang trang, gom thong tin theo dong.
	- Transactions: gom input theo hang ngang, giam chieu cao form/list.
	- Watchlist: rut gon card/feed, gioi han so dong advisory de tranh keo dai.
- Bo sung package icon cho mobile: `@expo/vector-icons`.

Van hanh va test:
- Kiem tra TypeScript: `npx tsc --noEmit` PASS.
- Expo dev server da khoi dong thanh cong, emulator Pixel_7_Pro da ket noi.
- Backend local xac nhan song tren port 8000 (admin endpoint 200).

Gia tri dat duoc:
- Nguoi dung co the doi ngon ngu ngay tren app ma khong can reload.
- UI hien thi duoc nhieu du lieu hon trong cung mot viewport, giam thao tac cuon.
- Muc do san sang test truc quan tang len nho stack local on dinh (backend + expo + emulator).

Cap nhat hardening runtime web (2026-04-05 toi):
- Da giam noise 401 tren frontend web bang cach serialize auth bootstrap flow trong `PortfolioContext`.
- Da tach throttle scope theo endpoint realtime (ticker/intraday/price-board/breadth/whale/rvol/chart) thay vi dung chung 1 bucket.
- Da them cool-down/backoff nhe phia client cho Price Board de tranh hammer endpoint khi server can gioi han.

Ket qua smoke test nhanh:
- Frontend web `http://127.0.0.1:3000/` -> HTTP 200.
- Backend admin `http://127.0.0.1:8000/admin/login/` -> HTTP 200.
- API protected sau login (`/api/auth/me/`, `/api/portfolio/portfolios/`, `/api/portfolio/userconfig/`) -> HTTP 200.
- Loop 20 lan endpoint `/api/realtime/price-board/MBB/`: `ok=19`, `rate429=0`, `otherErr=1` (khong ghi nhan 429).

## Sprint 19 - UX/Architecture alignment update (2026-04-05)

Trang thai: PLANNING REFINED

Da chot bo toi uu theo review:
- Navigation model Auth Stack / Main Tabs duoc giu nguyen.
- Bat buoc token refresh flow tren 401 de tranh da user ve login khong can thiet.
- Dashboard uu tien mau ngu canh lai/lo + skeleton loading.
- Watchlist bo sung flash effect khi gia doi mau + fallback polling 5-10s.
- Chot huong data layer: Zustand + bo sung React Query cho caching/fetch UX.
- Transactions form se co auto-complete symbol va validate tai cho.

Phan dua vao hardening backlog (khong block MVP):
- Haptic feedback.
- Sparkline mini chart tren watchlist.
- Sinh trac hoc cho re-auth.

Tiep theo:
- Trien khai Transactions vertical slice tren mobile (list/create/update/delete + symbol suggest).

Cap nhat them:
- Da tao tai lieu tong hop huong dan implementation va troubleshooting cho Sprint 19:
	- `docs/SPRINT19_MOBILE_IMPLEMENTATION_GUIDE.md`
	- Su dung lam tai lieu chinh cho cac phien lap trinh tiep theo.

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

## Sprint 18 - Google OAuth2 Mail Admin foundation (2026-04-04)

Trang thai: IN PROGRESS

Da thuc hien:
- Mo rong `SystemEmailAccount` de ho tro song song:
	- `auth_type=smtp_password`
	- `auth_type=google_oauth2`
- Them cac truong OAuth2:
	- google_client_id/client_secret(refresh token encrypted)
	- google_account_email, token_last_refreshed_at, token_last_error, oauth_connected_at
- Tao migration `0014_systememailaccount_google_oauth2` va da apply local.
- Them service moi:
	- `portfolio/google_oauth_service.py` (authorize URL, exchange code, refresh token, userinfo)
	- `portfolio/gmail_service.py` (MIME + Gmail API send)
- Noi `mail_service.py` theo branch auth_type:
	- Google OAuth2 -> refresh token -> Gmail API send
	- SMTP legacy -> giu nguyen luong cu
- Mo rong Django Admin cho `SystemEmailAccount`:
	- fields OAuth2 masked
	- status token fields
	- actions: Connect Google / Revoke Token / callback flow
- Bo sung tests `test_admin_mail_accounts.py`:
	- callback success/state mismatch
	- Gmail OAuth2 send branch

Validation:
- `python manage.py check` PASS
- `python manage.py test portfolio.tests.test_admin_mail_accounts` PASS (9 tests)
- `python manage.py migrate` PASS cho migration 0014

Cap nhat hardening tiep theo (cuoi ngay 2026-04-04):
- Tang cuong bao mat OAuth callback:
	- state token co TTL (`max_age=600s`)
	- verify state signature (`signing.loads`)
	- rang buoc payload `account_id` + `user_id` phai khop session/request user
- Bo sung test bao mat callback:
	- state mismatch
	- state expired
	- user/account payload mismatch
- Bo sung migration index rename pending (`0015`) va apply local de schema sach.

Validation bo sung:
- `python manage.py test portfolio.tests.test_admin_mail_accounts` PASS (11 tests)
- `python manage.py makemigrations --check` PASS (No changes detected)

Con mo:
- Hoan tat canary rollout tren staging voi OAuth app credentials that.
- Theo doi metric loi token refresh trong 24-48h sau rollout.

Cap nhat canary prep (2026-04-04 toi):
- Da co Google OAuth Client ID cho staging.
- Da cap nhat checklist canary: precondition OAuth client = done, Step A tach rieng `google_client_id` (done) va `google_client_secret` (pending).
- Buoc tiep theo can lam ngay: dien `google_client_secret` -> Connect Google -> xac nhan refresh token -> gui smoke test mail.

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

## Sprint 12 - Realtime contract hardening update (2026-04-03)

Trang thai: IN PROGRESS - CODE COMPLETE, TARGETED VALIDATION COMPLETE, BROWSER QA PENDING

Noi dung da thuc hien:
- Chuan hoa contract `whale_alert` xuyen suot giua backend WebSocket, REST va frontend hook/UI.
- Backend WS phat them `severity`, `event_score`, `display_score`, `weights_version` thay vi de frontend tu suy luan.
- Bo sung lifecycle fields `event_id`, `config_version`, `source` vao payload `whale_alert`.
- Frontend `useRealtimeFeed` giu nguyen toan bo field contract moi va dedup uu tien theo `event_id`.
- Cac realtime panels chuyen sang dung `severity`/`size_class` do backend cap, khong doan tu `matched_value`.
- Loai bo fallback `severity=low` va fallback `size_class` o cac panel whale realtime chinh.
- Tang observability runtime cho hook:
	- explicit `unsubscribe` khi cleanup/unmount
	- counters `subscribed`, `unsubscribed`, `polling_successes`, `polling_failures`
	- `connectionState` gom `transport`, `lastSubscribedAt`, `lastUnsubscribedAt`, `lastReconnectAt`, `lastErrorAt`, `lastCloseCode`, `lastCloseReason`, `subscribedSymbols`
- Mo rong `RealtimeDebugPanel` de hien lifecycle fields (`event_id`, `config_version`, `source`) va score contract (`severity`, `display_score`, `event_score`, `weights_version`).
- Cap nhat docs contract WebSocket va dashboard tien do cho trang thai moi nhat.

Validation da chay:
- `manage.py test portfolio.tests.test_whale_scoring` pass.
- `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_realtime_compute` pass (6 tests).
- `manage.py test portfolio.tests.test_api_routes` pass (28 tests).
- `npm run build` pass sau moi dot sua frontend trong phase nay.

Tai lieu da cap nhat:
- `docs/WEBSOCKET_EVENT_CONTRACT.md`
- `PROGRESS_DASHBOARD.md`
- `ROADMAP_STATUS.md`

Ket luan tam dung:
- Contract whale realtime da du on dinh de lam nen cho phase aggregate/replay/advisory tiep theo.
- Phan con mo chu yeu la browser runtime QA: subscribe/unsubscribe khi mount/unmount that, reconnect/fallback va do p95 publish -> push trong runtime that.

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

## Sprint 12 - User registration extension (2026-04-03)

Trang thai: IMPLEMENTED, QA browser pending

Da thuc hien:
- Backend `POST /api/auth/register/` bat buoc `email`, giu username regex hien tai, va van tao `UserConfig` mac dinh `plan=free`.
- Register response duoc mo rong tra `access` + `refresh` JWT de frontend auto-login ngay sau khi tao tai khoan.
- Frontend auth context them `register()` va dong bo lai `userPlan`, `ability`, `userConfig` sau khi luu token.
- `LoginModal.jsx` duoc nang cap thanh 2 mode `Dang nhap` / `Dang ky`, co field `email`, `password_confirm`, hien field error va submit error ro rang.
- Sau dang ky thanh cong, user vao app ngay qua cung token flow voi login thong thuong.

Validation da chay:
- `manage.py test portfolio.tests.test_api_routes` -> 15/15 PASS.
- `npm run build` -> Compiled successfully.

Con lai truoc khi dong han muc:
- Browser smoke test cho flow `dang ky -> auto-login -> vao dashboard`.
- Regression QA cho login cu va cac loi field tren browser that.
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

---

## Sprint 14 — Mission Control Foundation (2026-04-03)

Trang thai: COMPLETED

Noi dung da hoan tat (5 phases):

**Phase 1 — Mission Control Foundation:**
- Tao 6 models: `WhaleConfigVersion`, `WhaleConfigDraft`, `WhaleConfigApproval`, `WhaleConfigRollout`, `WhaleConfigWorkerAck`, `WhaleConfigAuditLog`.
- Them migration `0010_whaleconfigdraft_whaleconfigapproval_and_more.py`.
- Admin workflow phan quyen 2 vai tro: Analyst tao draft, Supervisor approve va apply.
- Maker-checker: nguoi tao khong duoc tu approve.
- `WhaleConfigAuditLog` ghi lai moi hanh dong: who/when/why/before/after.

**Phase 2 — Warm-up & Safety Guardrails:**
- Diff preview so sanh config truoc/sau khi apply.
- Guardrail validator: kiem tra truoc khi allow rollout (threshold range, symbol coverage, field validity).
- Dependency gate: block apply neu co worker dang dung config cu ma chua ACK phien ban truoc.
- Admin blocker flow: admin redirect den preview truoc khi cho apply.

**Phase 3 — Worker ACK va Propagation Visibility:**
- Rollout initialization + worker discovery helpers trong `services.py`.
- Worker ACK recording + propagation snapshot/status helpers.
- Celery tasks `refresh_rollout_status`, `ack_worker_config` trong `tasks.py`.
- Propagation visibility badges/progress trong admin Mission Control.
- Admin-ops stats API tich hop propagation summary.

**Phase 4 — Scheduled Activation va Canary Rollout:**
- Runtime config resolver: lay active/canary rollout tu cache + DB fallback.
- Canary scope matching: symbol/exchange/group/percentage.
- Scheduled rollout activation (Celery beat `activate_scheduled_rollouts`).
- Runtime auto-ACK: worker tu ACK khi load rollout config trong realtime path.
- Whale realtime payloads dinh kem `config_version` va scoring config that.

**Phase 5 — Auto-Revert va Anomaly Detection:**
- Anomaly snapshot detector tren `IntradayTick` + `WhaleAdvisory`.
- Auto-revert helper: fallback ve version stable truoc + gui notification.
- Celery task/beat monitor cho anomaly scan va auto-revert.
- Admin Mission Control hien thi anomaly visibility.

Validation:
- `manage.py test portfolio.tests.test_admin_whale_mission_control` PASS.
- `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_whale_scoring portfolio.tests.test_api_routes` PASS.
- `manage.py check` 0 issues.
- `npm run build` Compiled successfully.

---

## Sprint 15 — Order Flow & Dark Money Detection (2026-04-04)

Trang thai: COMPLETED

Muc tieu: Xay dung Order Flow Engine phat hien dong tien an (iceberg orders, TWAP bots, smart money absorption) — lop phan tich thu 2 ben tren Whale Alert, nham vao pattern nhieu lenh nho thay vi mot lenh lon.

**Phase 1 — Order Flow Compute Engine (`order_flow.py`):**
- `compute_cvd_series(symbol, window_minutes, bucket_seconds)`: CVD theo bucket 60s.
- `compute_tick_rate(symbol, window_seconds)`: tick rate/min va small_order_ratio.
- `compute_size_distribution(ticks)`: phan phoi kich thuoc lenh, histogram 5 buckets.
- `detect_absorption(cvd_buckets)`: phat hien gia "bi khoa" trong khi CVD tang manh.
- `detect_iceberg_clustering(ticks, window_seconds)`: phat hien nhieu lenh nho lap lai cung muc gia.
- `detect_dark_flow(symbol)`: diem vao tong hop, tra `signal_type`, `strength`, `confidence`.

**Phase 2 — OrderFlowSignal Model + Celery:**
- Model `OrderFlowSignal` trong `models.py` voi migration `0012_add_order_flow_signal.py`.
- `OrderFlowSignalAdmin` trong `admin.py`.
- Celery task `detect_and_store_order_flow`: cooldown 300s/symbol, toi da 30 symbols/run.
- Beat schedule `detect-order-flow` chay moi 30s, env flag `ORDER_FLOW_DETECTION_ENABLED`.
- Publish `dark_flow_alert` WS event khi `strength > 50`.

**Phase 3 — WebSocket + AI Context:**
- `dark_flow_alert` handler trong `consumers.py`.
- `build_symbol_ai_context()` mo rong: key `order_flow` voi `recent_signals`, `latest_signal_type`, `latest_strength`, `latest_confidence`.
- `render_context_for_prompt()` in them dong order flow cho AI advisory.
- `WEBSOCKET_EVENT_CONTRACT.md` cap nhat section 3.3 `dark_flow_alert`.
- Test gateway + AI context: 7/7 PASS.

**Phase 4 — REST API + Frontend Panel:**
- Endpoint `GET /api/stock-management/stocks/<symbol>/order-flow/` (authenticated).
- `OrderFlowPanel` component trong `StockDetail.jsx`: CVD AreaChart (recharts), strength meter, tick-rate, recent signals, realtime event block.
- `getStockOrderFlow` client function trong `client.js`.
- `darkFlowAlerts`, `latestDarkFlowAlert` export tu `useRealtimeFeed`.

**Sprint 15 Finalization (polish):**
- `RealtimeDebugPanel.jsx`: them `Dark Flow:` counter va `latestDarkFlowAlert` detail block.
- `DashboardRealtimePanel.jsx`: them badge `🌊 N dark flow` khi `dark_flow_alert > 0`.

Validation:
- `manage.py test portfolio.tests.test_order_flow` — 38/38 PASS.
- `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_ai_context` — 7/7 PASS.
- `manage.py check` 0 issues.
- `npm run build` Compiled successfully (293.13 kB gz).

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

---

## Session 2026-04-04 — vnstock Rate-Limit Mitigation + AI Advisory Session

Trang thai: COMPLETED — tất cả tests pass, live JWT verify xong

---

### 1. vnstock Rate-Limit Backoff (backend/portfolio/views.py)

Vấn đề: Các endpoint realtime gọi vnstock guest API theo cụm lớn → bị throttle liên tục.

Thêm helpers vào `views.py`:
- `_is_rate_limited_error(exc)` — nhận diện lỗi rate-limit từ vnstock
- `_vnstock_rate_limit_cache_key(channel)` / `_is_vnstock_rate_limited(channel)` / `_mark_vnstock_rate_limited(channel)` — cache-based cooldown per channel (`intraday`, `price_board`, `whale`, `rvol`)
- `_allow_vnstock_aggregate_fallback(symbols)` — chặn fan-out nếu danh sách symbol quá lớn (tránh storm yêu cầu)

Tích hợp cooldown vào:
- `IntradayMatchedView` — skip fallback nếu đang rate-limited, ghi cooldown khi bị lỗi
- `PriceBoardView` — tương tự
- `WhaleFeedView` — tương tự
- `RVOLView` — thêm short cache + backoff

### 2. vnstock Rate-Limit trong tasks.py

Thêm vào `backend/portfolio/tasks.py`:
- `VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY`
- `_mark_price_board_rate_limited()`
- Task `prefetch_ticker_price_board`: early-return nếu đang cooldown, ghi cooldown khi bắt lỗi rate-limit

---

### 3. AI Advisory Session — Stock Workspace (/stocks/:symbol)

**Backend:**

Endpoint `stock_ai_advisory_session_api` (`GET/POST`) trong `views.py`:
- `@api_view(['GET','POST'])` + `@permission_classes([IsAuthenticated])`
- GET: trả advisory mới nhất (200) hoặc auto-queue tạo nếu chưa có (202, với lock cache `stock_ai_advisory_autogen_lock:{user_id}:{symbol}`, cooldown = `STOCK_AI_ADVISORY_AUTOGEN_COOLDOWN_SECONDS`, mặc định 45s)
- POST: manual refresh với cooldown `stock_ai_advisory_refresh_lock:{user_id}:{symbol}` (= `WHALE_ADVISORY_COOLDOWN_SECONDS`)
- **Local debug sync fallback** (`_should_use_sync_fallback()` + `_queue_or_run()`): khi `DEBUG=True` và host != `testserver` và không có Celery worker nào alive → chạy `generate_whale_advisory_task.run(...)` đồng bộ ngay, trả 200 với advisory thực thay vì chờ async mãi
- `ai_detail` bị xóa cho user không phải premium/admin

Route: `backend/portfolio/urls_stock.py`
```
stocks/<symbol>/ai-advisory-session/  →  stock_ai_advisory_session_api
```

Tests thêm vào `backend/portfolio/tests/test_api_routes.py`:
- `test_vnstock_aggregate_fallback_suppressed_large_symbol_count`
- `test_stock_ai_advisory_session_get_queues_generation_when_missing`
- `test_stock_ai_advisory_session_get_returns_latest_advisory`
- `test_stock_ai_advisory_session_post_returns_429_when_refresh_cooldown_active`

**Frontend:**

`frontend/src/api/client.js`:
- `getStockAIAdvisorySession(symbol)` — GET
- `refreshStockAIAdvisorySession(symbol)` — POST

`frontend/src/pages/StockDetail.jsx`:
- State advisory session + `fetchAdvisory()` gọi lúc mount
- Polling mỗi 15s khi advisory == null (dừng khi có kết quả)
- Panel bên dưới KlineChart: hiển thị `ai_summary`, nút "Refresh" gọi POST
- Unmount cleanup: clear interval

`frontend/src/pages/WhaleAdvisory.jsx`:
- Đổi `line-clamp` → `max-h-48 overflow-y-auto` để advisory hiển thị đầy đủ và có scroll

---

### Validation 2026-04-04

- `manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_session_*` → 3/3 PASS
- `get_errors` trên `views.py` và `StockDetail.jsx` → 0 errors
- Live JWT call (GET BCM): status 200, `queued=false`, advisory tạo đồng bộ ngay trong local debug
- Live JWT call (POST BCM): status 200, `queued=false`, advisory refresh đồng bộ ngay

---

## Sprint 16 — Whale Volume Weighting & Order Flow Time Window (2026-04-04)

Trang thai: COMPLETED

Muc tieu: Bo sung field `volume` vao aggregate whale feed, tinh "Whale Avg Price" tren FE, va them `?window` param cho order flow API de trader chon khung thoi gian CVD.

### Phase 1 — BE: `volume` field trong aggregate feed

Files sua: `backend/portfolio/views.py`

Bo sung `'volume': int(...)` vao 4 ham builder:
- `_build_aggregate_event_payload(row, ...)` — `getattr(row, 'volume', 0) or 0`
- `_build_aggregate_event_payload_from_record(record, ...)` — `record.get('volume') or 0`
- `_build_stream_aggregate_records(symbols, ...)` — `tick.get('volume') or 0`
- `_build_vnstock_aggregate_records(symbols, ...)` — thu lan luot `volume / vol / matchVolume`

Graceful fallback: `or 0` tren moi key — khong crash khi vnstock khong tra volume.

### Phase 2 — FE: Whale Avg Price

Files sua: `frontend/src/pages/WhaleAlertsHub.jsx`, `frontend/src/pages/WhaleAdvisory.jsx`

**WhaleAlertsHub.jsx**:
- `buildSymbolStatsFromFeed`: tich luy `totalVolume += Number(item.volume || 0)`
- `getFrequencyLabel(totalValue)`: chuyen tu count-based sang value-based (nguong 5B / 2B / 500M VND)
- `TrackedSymbolCard`: hien thi `whaleAvgPrice = totalValue / totalVolume`, an khi volume = 0

**WhaleAdvisory.jsx**:
- `buildSymbolStats`: tich luy `totalVolume`, sort theo `b.totalValue - a.totalValue`
- `SymbolCell`: hien thi "Avg gia: X VND/CP" conditional

### Phase 3 — Order flow `?window` param

Files sua: `backend/portfolio/views.py`, `frontend/src/api/client.js`, `frontend/src/pages/StockDetail.jsx`

**Backend** (`stock_order_flow_api`):
- `_window_map = {'5m': 5, '15m': 15, '30m': 30, '1h': 60}`
- Default `'30m'`, fallback 30 khi param khong hop le
- Response them `window`, `window_minutes`

**Client** (`client.js`):
- `getStockOrderFlow(symbol, window = '30m')` voi `{ params: { window } }`

**StockDetail** (`StockDetail.jsx`):
- State `orderFlowWindow` (default `'30m'`)
- `fetchOrderFlow` phu thuoc `orderFlowWindow`
- Window selector UI 4 nut: 5m / 15m / 30m / 1h

### Validation

- `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_order_flow` — **83/83 PASS** (49.2s)
- `npm run build` — **Compiled successfully** (293 kB gz)
- `manage.py check` — 0 issues

### Tai lieu da cap nhat

- `docs/SPRINT16_DETAILED_PLAN.md` — tao moi
- `docs/SPRINT16_ACCEPTANCE_CHECKLIST.md` — tao moi, tat ca [x]
- `docs/TASKBOARD_SPRINT16.csv` — tao moi, tat ca Done
- `docs/TASKBOARD_SPRINT15.csv` — cap nhat tat ca "Not Started" → "Done"
- `docs/SPRINT13_ACCEPTANCE_CHECKLIST.md` — danh dau HHI va toggle la [x] (da lam o Sprint 14)
- `docs/ROADMAP_STATUS.md` — cap nhat Sprint 15/16 DONE, metrics 83/83, Sprint 17 PLANNING
- `docs/FEATURE_EXPANSION_BACKLOG.md` — them D-06/D-07/D-08, gach ngang P1-4 va P1-8

---

## Sprint 17 — Planning lock truoc khi trien khai (2026-04-04)

Trang thai: PLANNED

Y tuong duoc dua vao Sprint 17:
- AI Advisory Session doi thanh khung da tab, moi tab la mot AI component record.
- Moi component co timestamp tao record, include/exclude, va nut xoa (soft delete).
- Phan duoi la Executive Summary tong hop theo trong so va co regenerate.

Tai lieu planning da tao:
- `docs/SPRINT17_DETAILED_PLAN.md`
- `docs/SPRINT17_ACCEPTANCE_CHECKLIST.md`
- `docs/TASKBOARD_SPRINT17.csv`

Tai lieu mapping da cap nhat:
- `docs/FEATURE_EXPANSION_BACKLOG.md` (them P1-9 va mapping Sprint 17)
- `docs/ROADMAP_STATUS.md` (them section Sprint 17 planning)

---

## Sprint 17 — AI Advisory Multi-Tab & Executive Summary (2026-04-04)

Trang thai: COMPLETED

Muc tieu: Chuyen AI Advisory session sang mo hinh component-first de user co the kiem soat tung thanh phan truoc khi tong hop, dong thoi nang cap chat luong phan "Thong tin tong hop" theo preference.

### 1) Backend implementation

- Them migration va model cho:
	- `AIAdvisoryComponentRecord`
	- `AIAdvisoryExecutiveSummary`
- Hoan tat APIs nghiep vu:
	- session detail
	- generate components
	- toggle include/exclude
	- soft delete / restore component
	- regenerate executive summary co versioning
- Them endpoint refresh theo component active:
	- `POST /api/stock-management/ai-advisory-components/<id>/refresh/`
- Nang cap regenerate summary nhan `synthesis_preference`:
	- `short_term_action`
	- `risk_management`
	- `balanced`
- Prompt tong hop AI duoc nang cap theo huong chi tiet hon (muc tieu ~20 dong), co fallback deterministic neu AI khong tra noi dung hop le.

### 2) Frontend implementation

- `StockDetail.jsx`:
	- Advisory panel da tab voi metadata day du: status, confidence, timeframe, timestamp.
	- Nut refresh chi tac dong tab active, dat canh nut xoa tab.
	- Section "Thong tin tong hop" doi ten tu "Tom tat dieu hanh".
	- Them combobox preference ben canh nut "Tong hop lai".
	- Hien "Che do hien tai" ngay trong summary panel.
	- Chuan hoa nhan advisory sang tieng Viet co dau.
- `client.js`:
	- Them wrapper API refresh theo component (`refreshStockAIAdvisoryComponent`).

### 3) UX / copy / consistency

- Chuan hoa dieu huong hanh vi refresh:
	- Khong con refresh theo session o vi tri cu.
	- Refresh theo tab active de tranh anh huong component khac.
- Chuan hoa title va labels theo thong nhat nghiep vu:
	- "Thong tin tong hop"
	- "Che do hien tai"
	- Cac nhan advisory da co dau, de doc va de doi soat.

### 4) Validation da thuc hien

- Backend tests:
	- test refresh theo component active.
	- test summary regenerate su dung AI synthesis va truyen dung preference.
- Frontend:
	- `npm run build` pass sau cac dot thay doi UI/UX.
- Khong ghi nhan regression blocker cho flow `StockDetail` (chart/order-flow/advisory panel).

### 5) Release hygiene cho GitHub

- Loai bo token nhay cam khoi `backend/requirements.txt` (doi ve URL git khong kem token).
- Cap nhat `.gitignore` bo sung file runtime:
	- `backend/celerybeat-schedule*`
	- `*.code-workspace`

Tai lieu dong bo:
- `docs/SPRINT17_DETAILED_PLAN.md`
- `docs/SPRINT17_ACCEPTANCE_CHECKLIST.md`
- `docs/ROADMAP_STATUS.md`
- `docs/TASKBOARD_SPRINT17.csv`


---

## Sprint 18 — Google Mail OAuth2 Admin (2026-04-04) — CODE COMPLETE

Trang thai: CODE COMPLETE — 19/19 tests PASS, `manage.py check` 0 issues

### Tong ket toan bo cong viec da thuc hien (5 phases)

**Phase 1 — Data Model & Migration**
- Mo rong `SystemEmailAccount` them inner class `AuthTypeChoices` (`smtp_password` | `google_oauth2`).
- Them 10 truong moi: `auth_type`, `oauth_provider`, `google_client_id`, `google_client_secret_ciphertext`, `google_refresh_token_ciphertext`, `google_token_scope`, `google_account_email`, `oauth_connected_at`, `token_last_refreshed_at`, `token_last_error`.
- Methods: `set_google_client_secret()`, `get_google_client_secret()`, `set_google_refresh_token()`, `clear_google_refresh_token()`, `get_google_refresh_token()`, `has_google_refresh_token` (property).
- Migration `0014_systememailaccount_google_oauth2` tao moi va da apply local.
- Migration `0015_rename_*` (pending index drift) da apply them.
- `manage.py makemigrations --check` PASS (No changes detected).

**Phase 2 — Google OAuth2 Services**
- Tao moi `portfolio/google_oauth_service.py`:
  - `build_google_oauth_authorize_url()` — tra ve URL xac thuc Google voi param `offline/consent`.
  - `exchange_google_oauth_code()` — doi code lay access + refresh token.
  - `refresh_google_access_token()` — fresh access token tu refresh token.
  - `fetch_google_user_email()` — lay email tu OpenID userinfo endpoint.
- Tao moi `portfolio/gmail_service.py`:
  - `_build_raw_message()` — tao RFC822 MIME message, base64url encode.
  - `send_gmail_api_message()` — POST toi Gmail API `/users/me/messages/send`.
- Toan bo HTTP qua `httpx`, timeout co the cau hinh, `raise_for_status()` truoc khi decode.

**Phase 3 — Mail Service & Django Admin**
- Cap nhat `mail_service.py`:
  - Branch theo `auth_type == GOOGLE_OAUTH2`: refresh token -> Gmail API send.
  - Them `_humanize_gmail_error()`: map HTTP 401/403/429/5xx sang message tieng Viet co nghia van hanh.
  - Luu `token_last_error` va `token_last_refreshed_at` sau moi lan gui.
- Mo rong `admin.py`:
  - `MAIL_GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 600`.
  - `SystemEmailAccountAdminForm` them `google_client_secret` + `google_refresh_token` PasswordInput (masked).
  - Custom routes: `<pk>/google/connect/`, `google/callback/`, `<pk>/google/revoke/`.
  - `google_connect_view`: tao signed state -> luu session -> redirect Google.
  - `google_callback_view`: validate state match + TTL `signing.loads(max_age=600)` + payload binding `account_id/user_id` -> exchange code -> luu token.
  - `google_revoke_view`: xoa token + metadata.
  - Display methods: `google_client_secret_status()`, `google_refresh_token_status()`, `oauth_actions()`.

**Phase 4 — Security Hardening (callback)**
- State token co TTL 600 giay (`signing.loads(max_age=600)`).
- Verify cryptographic signature (`SignatureExpired` / `BadSignature` duoc xu ly).
- Payload binding: `account_id` + `user_id` phai khop voi session va `request.user.pk`.
- Guard: neu Google khong tra `refresh_token` VA account chua co token stored → raise `ValueError` voi huong dan ro rang.

**Phase 5 — Error Mapping + Testing + Docs**
- `_humanize_gmail_error()`: 401/403/429/5xx/fallback sang message tieng Viet.
- Tests phung phu 5 class, 19 tests tong, tat ca PASS:
  - `SystemEmailAccountModelTests` (6): model methods, SMTP branch, OAuth2 branch, 401 mapping, 429 mapping.
  - `SystemEmailAccountAdminTests` (7): changelist, action, connect/callback/revoke + security hardening.
  - `GoogleOAuthServiceTests` (4): refresh success, missing creds, no access_token response, HTTP 401 raise.
  - `EmailVerificationRegressionTests` (2): OAuth2 as default -> `send_verification_email()` pass, error propagation.
- Tai lieu da tao/cap nhat:
  - `docs/SPRINT18_DETAILED_PLAN.md`
  - `docs/SPRINT18_ACCEPTANCE_CHECKLIST.md` — tat ca section A/B/C/D/E ✅
  - `docs/SPRINT18_GOOGLE_OAUTH_RUNBOOK.md` — 10 sections day du
  - `docs/SPRINT18_STAGING_CANARY_CHECKLIST.md` — step A-D + exit criteria + rollback

### Validation cuoi cung

```
python manage.py test portfolio.tests.test_admin_mail_accounts -v 2
Found 19 test(s).
Ran 19 tests in 2.713s
OK

python manage.py check
System check identified no issues (0 silenced).
```

### Con lai truoc sign-off chinh thuc

- [ ] Canary rollout tren staging voi Google OAuth credentials thuc te (theo `SPRINT18_STAGING_CANARY_CHECKLIST.md`).
- [ ] Monitoring 24-48h sau deployment staging (0 P0/P1 incident).
- [ ] Sign-off BE Lead / QA / DevOps / PM.

### Session handoff (2026-04-04 cuoi buoi)

- OAuth2 canary dang tam dung vi moi truong dev chua co host staging/public domain on dinh.
- Da them env `GOOGLE_OAUTH_REDIRECT_URI` + backend fallback de giam loi `redirect_uri_mismatch` khi di qua proxy.
- Neu test local OAuth, can dong nhat tuyet doi callback URI (`localhost` hoac `127.0.0.1`, khong tron lan).
- UI StockDetail da chot theo yeu cau user:
	- Panel `Cảnh báo dòng tiền lớn` dat tren `Tỷ trọng dòng tiền phiên`.
	- Chieu cao panel set co dinh: `h-[8cm]`.
	- `Recent signals` co scrollbar + hien thi full records.

Buoc tiep theo khuyen nghi cho session moi:
1. Co host staging/tunnel -> set `GOOGLE_OAUTH_REDIRECT_URI` dung callback canonical.
2. Re-connect Google account trong Django Admin va chay smoke test mail.
3. Cap nhat lai checklist canary va acceptance sign-off sau khi pass.


