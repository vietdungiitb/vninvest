# Sprint 12 Detailed Plan - Frontend Realtime Consolidation and Observability

Muc tieu Sprint 12:
- Chuan hoa layer realtime frontend thanh mot service/hook dung chung.
- Nang cap UX alert, stale state va observability de san sang hardening.
- Chot duong day Redis-backed staging sau khi local vertical slice da xong.

Scope:
1. Tach logic websocket/polling thanh service/hook dung chung cho Dashboard + Watchlist.
2. Chuan hoa subscription theo holdings, tracked symbols, active view.
3. Whale alert UX day du: history, dismiss, severity, anti-duplicate.
4. Stale indicator, reconnect/backoff, fallback polling on dinh.
5. Observability metrics va checklist test Redis-backed.

Sprint 12 extension duoc them sau khi chot realtime scope:
6. User registration flow planning truoc khi code, theo tai lieu `SPRINT12_USER_REGISTRATION_PLAN.md`.

Out-of-scope:
1. Production scale load test > 1k concurrent.
2. Backtest strategy tuning.
3. Tinh nang giao dich tu dong.

## Trang thai dau Sprint 12

Da co san tu Sprint 11:
- Watchlist da nhan duoc realtime qua websocket va polling fallback.
- Dashboard da co panel realtime rieng cho market breadth + whale alerts.
- Backend da co collector, compute, publisher, consumer, fallback API va feature flags.
- Local demo co the chay khong can Redis bang `REALTIME_CHANNEL_LAYER=inmemory`.

Van de can don dep truoc khi mo rong them:
- Logic realtime dang lap lai giua Watchlist va Dashboard.
- Chua co history/state management thong nhat cho whale alerts.
- Chua co checklist staging khi bat Redis channel layer that.

## Timeline (10 ngay)

Day 1:
- Tao `useRealtimeFeed` hoac service layer dung chung.

Day 2-3:
- Refactor Watchlist sang service dung chung + giam logic lap.

Day 4:
- Refactor Dashboard panel sang service dung chung + bo sung anti-duplicate whale alerts.

Day 5:
- Fallback polling mode + stale indicator.

Day 6:
- Whale alert UX + dismiss/history + severity buckets.

Day 7:
- Metrics panel + client logging hooks + event counters.

Day 8:
- Test Redis-backed env checklist + QA matrix execution.

Day 9:
- Bugfix P0/P1.

Day 10:
- RC signoff and release checklist.

## DoD

- Dashboard va Watchlist dung chung mot layer realtime frontend.
- Frontend tu dong reconnect websocket voi backoff va khong spam reconnect vo han.
- Khi mat socket, fallback polling hoat dong on dinh va co stale indicator ro rang.
- Whale alert hien thi dung payload contract, co history ngan va co co che chong duplicate.
- Co runbook staging/local Redis-backed va QA matrix pass.

## Nhiem vu uu tien ngay tiep theo

1. Gom logic websocket/polling thanh hook `useRealtimeFeed`.
2. Chuyen Watchlist va Dashboard sang dung chung hook do.
3. Tao widget lich su whale alerts co dismiss va gioi han history.
4. Bo sung observability nhe: event count, stale count, reconnect count.
5. Chot test Redis-backed env va cap nhat acceptance checklist.
6. Chot ke hoach implementation cho user registration truoc khi bat dau code.

## Scope extension - User Registration

- Ly do bo sung: Sprint 12 da duoc chot la moc `User Management Core`, nhung hien trang moi co `/api/auth/me/`, plan/CASL va backend register API co ban; user-facing registration flow chua duoc trien khai hoan chinh.
- Trang thai hien tai: Planning only, chua bat dau implementation.
- Tai lieu tham chieu chinh: `docs/SPRINT12_USER_REGISTRATION_PLAN.md`.
- Nguyen tac: khong danh dau completed cho den khi co frontend flow, backend tests, QA matrix va docs sign-off.
