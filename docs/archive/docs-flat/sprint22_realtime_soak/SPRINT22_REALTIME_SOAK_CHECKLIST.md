# Sprint 22 realtime soak and regression checklist (S22-06)

Trang thai: READY FOR EXECUTION

Muc tieu: xac nhan connection manager realtime FE/BE on dinh, khong leak socket, fallback polling van hoat dong.

## 1) Scope va precondition

- Scope:
  - frontend realtime manager: RealtimeProvider + useRealtimeFeed wrapper
  - backend realtime API: ticker, whale-feed, whale-feed aggregate
- Precondition:
  - Feature flag frontend manager bat: REACT_APP_ENABLE_REALTIME_CONNECTION_MANAGER=true
  - Backend API + websocket gateway online
  - User test co quyen truy cap cac endpoint realtime

## 2) Regression quick pass (30-45 phut)

1. Build frontend:
- npm run build: PASS / FAIL

2. Backend focused tests:
- market route toggle tests: PASS / FAIL
- trading boundary tests: PASS / FAIL

3. Functional flow:
- Dashboard nhan feed: PASS / FAIL
- Watchlist nhan feed: PASS / FAIL
- StockDetail nhan feed: PASS / FAIL

## 3) Soak test protocol (4-8 gio)

### Phase A: navigation churn (60 phut)

- Chuyen trang vong lap:
  - Dashboard -> Watchlist -> StockDetail -> WhaleAlerts -> Dashboard
- Lap 30-50 vong.

Checklist:
- [ ] Khong phat sinh blank screen
- [ ] Khong crash JS runtime
- [ ] Khong ton dong socket duplicate sau moi vong

### Phase B: idle + live updates (120 phut)

- Giu Dashboard/Watchlist mo lien tuc.
- Theo doi event counts, reconnect attempts, latency.

Checklist:
- [ ] Event tiep tuc tang deu
- [ ] reconnect_attempts khong tang bat thuong
- [ ] circuit breaker khong bi trip lien tuc

### Phase C: network disturbance drills (30-60 phut)

- Mat mang 10-20 giay, bat lai.
- Lap 5-10 lan.

Checklist:
- [ ] UI fallback polling khi mat WS
- [ ] Tu phuc hoi WS sau khi mang on
- [ ] Khong spam reconnect theo cap so nhan vo han

## 4) Metrics can thu thap

- Reconnect rate (attempt/hour)
- WS close code distribution
- Polling fallback activation count
- Mean/median/p95 event latency
- Socket count theo session (dedup effectiveness)

## 5) Pass/Fail criteria

PASS neu:
1. Khong leak socket theo thoi gian (socket count on dinh).
2. Khong spam reconnect (attempt/hour trong nguong cho phep cua team).
3. Fallback polling hoat dong khi WS down.
4. Khong crash/blank screen trong soak window.

FAIL neu:
1. Socket count tang dan theo navigation loop.
2. reconnect_attempts tang dot bien khong phuc hoi.
3. Fallback polling khong kich hoat hoac du lieu dung cap nhat.
4. Phat sinh P0/P1 runtime issue.

## 6) Evidence capture

- Build log: ____
- Test log: ____
- Browser performance snapshot: ____
- WS/network capture: ____
- Incident notes (neu co): ____

## 7) Decision output

- S22-06: DONE / BLOCKED
- Owner: ____
- Date/Time: ____
- Notes: ____
