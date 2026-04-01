# Sprint 12 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 12.

## A. Frontend Realtime Architecture

- [x] Co service/hook realtime dung chung cho Dashboard va Watchlist.
- [x] Subscription management khong lap logic giua cac page.
- [x] Reconnect/backoff co gioi han va khong tao socket leak (1000 = no reconnect, stale ref guard, destroyed flag).

## B. UX and State

- [ ] Dashboard panel realtime hien thi dung market breadth, stale count va event timestamp.
- [ ] Watchlist va Dashboard deu dung cung mot contract realtime.
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

- [ ] PM/BA xac nhan du du lieu demo de review nghiep vu.
- [ ] Dev xac nhan khong con blocker P0/P1 cho frontend realtime.
- [ ] Co danh sach cong viec chuyen tiep cho Sprint 13 neu can.