# Sprint 19 Acceptance Checklist — Mobile App MVP (Android + iOS)

**Sprint**: 19  
**Ngay lap**: 2026-04-04  
**Trang thai**: PLANNED

---

## A. Mobile Foundation

- [ ] Tao duoc workspace `mobile-app/` voi Expo + TypeScript.
- [ ] Chay duoc tren Android emulator.
- [ ] Chay duoc tren iOS simulator.
- [ ] Co env config ro rang cho dev/staging (`API_BASE_URL`, `WS_BASE_URL`).

## B. Auth & Security

- [ ] Register/Login flow chay on dinh.
- [ ] Token luu trong secure storage, khong dung plain AsyncStorage.
- [ ] Access token refresh tu dong qua interceptor.
- [ ] Session restore thanh cong sau khi tat/mo app.
- [ ] Logout xoa sach token va state lien quan.

## C. Dashboard

- [ ] Dashboard hien summary card dung so lieu.
- [ ] Holdings list render dung va muot voi du lieu lon.
- [ ] Allocation view hien du lieu chinh xac.
- [ ] Co loading/empty/error states day du.
- [ ] Pull-to-refresh hoat dong dung.

## D. Transactions & Validation

- [ ] Liet ke giao dich theo subaccount dung API contract.
- [ ] Tao giao dich moi thanh cong.
- [ ] Sua giao dich thanh cong.
- [ ] Xoa giao dich thanh cong.
- [ ] Validation ma CK truoc submit (chan ma khong hop le).

## E. Watchlist & Whale Alerts

- [ ] Watchlist/tracked symbols list hien thi dung.
- [ ] Add/remove symbol hoat dong dung.
- [ ] Whale alerts hub co filter/sort co ban.
- [ ] Whale detail theo symbol hien thi dung feed.
- [ ] Realtime socket + polling fallback da duoc test.

## F. Quality & Performance

- [ ] Khong co crash P0/P1 trong 30 phut smoke test lien tuc.
- [ ] Kich ban network xau (timeout/disconnect) khong lam app treo.
- [ ] Dashboard TTFD dat muc tieu < 2.5s tren wifi tot.
- [ ] API error handling hien message de hieu cho user.

## G. Release & Operations

- [ ] Tao duoc Android Internal Testing build.
- [ ] Tao duoc iOS TestFlight build (neu account san sang).
- [ ] Co release notes + known issues cho internal test.
- [ ] Co rollback notes ve backend contract va mobile build.

## H. Sign-off

- [ ] Mobile Engineer sign-off
- [ ] Backend Engineer sign-off
- [ ] QA sign-off
- [ ] PM/BA sign-off
