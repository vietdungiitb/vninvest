# Sprint 12 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 12.

## A. Frontend Realtime Architecture

- [x] Co service/hook realtime dung chung cho Dashboard va Watchlist.
- [x] Subscription management khong lap logic giua cac page.
- [ ] Reconnect/backoff co gioi han va khong tao socket leak.

## B. UX and State

- [ ] Dashboard panel realtime hien thi dung market breadth, stale count va event timestamp.
- [ ] Watchlist va Dashboard deu dung cung mot contract realtime.
- [ ] Whale alert co history ngan, severity ro rang va co co che chong duplicate.
- [ ] Fallback polling hoat dong khi socket disconnect.
- [x] Watchlist phan tach ro `Nhóm thị trường` va `Danh sách theo dõi cá nhân` bang nhan va mo ta nhat quan.
- [x] Watchlist ho tro thao tac hai chieu ngay tai bang `Nhóm thị trường`: them tung ma, them ca nhom, bo tung ma, bo cac ma da theo doi cua nhom.
- [x] Bo loc `Tat ca / Chua theo doi / Da theo doi` hien thi bo dem va cap nhat dung theo shortlist hien tai.

## C. Reliability and Observability

- [ ] Co event counters hoac logging hook cho connect, disconnect, fallback, stale.
- [ ] Co cach phan biet local `inmemory` va env Redis-backed.
- [ ] Runbook Redis-backed duoc cap nhat va test lai.

## D. QA

- [x] Frontend build pass.
- [ ] Backend targeted realtime tests pass.
- [ ] QA matrix cho Dashboard + Watchlist realtime da chay.

## E. Release Sign-off

- [ ] PM/BA xac nhan du du lieu demo de review nghiep vu.
- [ ] Dev xac nhan khong con blocker P0/P1 cho frontend realtime.
- [ ] Co danh sach cong viec chuyen tiep cho Sprint 13 neu can.