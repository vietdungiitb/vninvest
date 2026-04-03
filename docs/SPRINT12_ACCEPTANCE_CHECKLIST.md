# Sprint 12 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 12.

## A. Frontend Realtime Architecture

- [x] Co service/hook realtime dung chung cho Dashboard va Watchlist.
- [x] Subscription management khong lap logic giua cac page.
- [x] Reconnect/backoff co gioi han va khong tao socket leak (1000 = no reconnect, stale ref guard, destroyed flag).

## B. UX and State

- [x] Dashboard panel realtime hien thi dung market breadth (up/down/flat), stale count, event timestamp, observability bar (ticker/whale/hb/reconnect/latency/channel layer).
- [x] Watchlist va Dashboard deu dung cung mot contract realtime (useRealtimeFeed, quotesBySymbol, realtimeStatus, lastEventAt, alerts, metrics).
- [x] Whale alert co history ngan (maxAlerts=5), co co che chong duplicate (key = symbol+ts+side).
- [x] Fallback polling hoat dong khi socket disconnect (realtimeStatusRef.current !== 'live').
- [x] Watchlist phan tach ro `Nhóm thị trường` va `Danh sách theo dõi cá nhân` bang nhan va mo ta nhat quan.
- [x] Watchlist ho tro thao tac hai chieu ngay tai bang `Nhóm thị trường`: them tung ma, them ca nhom, bo tung ma, bo cac ma da theo doi cua nhom.
- [x] Bo loc `Tat ca / Chua theo doi / Da theo doi` hien thi bo dem va cap nhat dung theo shortlist hien tai.

## C. Reliability and Observability

- [x] Co event counters hoac logging hook cho connect, disconnect, fallback, stale (eventCounts: ticker_update/whale_alert/heartbeat/reconnect + lastLatencyMs).
- [x] Co cach phan biet local `inmemory` va env Redis-backed (badge tren DashboardRealtimePanel lay tu GET /api/health/realtime/).
- [x] Runbook Redis-backed duoc cap nhat va test lai (GET /api/health/realtime/ tra {channel_layer_type:redis, redis_ok:true}, realtime_tick --sync pass 4 symbols + heartbeat).

## D. QA

- [x] Frontend build pass (Compiled successfully, no ERR_INSUFFICIENT_RESOURCES).
- [x] Backend targeted realtime tests pass (12/12 tests OK, Ran in 9.844s).
- [x] QA matrix cho Dashboard + Watchlist realtime da chay (12 backend tests pass, health endpoint verified, latency ~1750ms/cycle local Redis).

## E. Release Sign-off

- [x] PM/BA xac nhan du du lieu demo de review nghiep vu (seed_demo_data --reset da mo rong phu holdings, snapshots, watchlist, tracked symbols).
- [x] Dev xac nhan khong con blocker P0/P1 cho frontend realtime (ERR_INSUFFICIENT_RESOURCES, infinite loop, 400 watchlist item, WS close before established — tat ca da fix).
- [x] Co danh sach cong viec chuyen tiep cho Sprint 13 (docs/SPRINT13_DETAILED_PLAN.md).

## F. User Registration Extension

- [x] Co tai lieu ke hoach implementation cho registration flow: `docs/SPRINT12_USER_REGISTRATION_PLAN.md`.
- [x] Chot nghiep vu: email required, auto-login sau dang ky.
- [x] Frontend co mode `Dang ky` canh `Dang nhap` tai auth entrypoint.
- [x] API helper frontend cho `POST /api/auth/register/` duoc them va dung dung contract.
- [x] Dang ky thanh cong tao duoc `User` + `UserConfig(plan=free)`.
- [x] Hien thi dung loi cho duplicate username, invalid email, password mismatch, password qua ngan.
- [x] Backend targeted tests cho register flow pass.
- [ ] Frontend smoke test: dang ky moi -> auto-login -> vao duoc dashboard.
- [x] Docs va taskboard Sprint 12 duoc cap nhat sau implementation.
- [ ] QA regression mo rong cho login/register flow duoc chay tren browser that.