# Sprint 19 Acceptance Checklist — Mobile App MVP (Android + iOS)

**Sprint**: 19  
**Ngay lap**: 2026-04-04  
**Trang thai**: IN_PROGRESS

---

## Update 2026-04-05 — Pass 1 (Code Delta)

- [x] Tab `watchlist` tren mobile khong con placeholder, da render man hinh thuc.
- [x] Da them tracked symbols list + add/remove symbol tren mobile.
- [x] Da them Whale Alerts hub voi sort co ban (`ts`, `matched_value`).
- [x] Da them Whale detail section + hanh dong refresh advisory theo symbol.
- [x] Da them websocket subscribe whale events + polling fallback 10s khi socket fail.
- [ ] Chua co ket qua smoke test runtime tren Android/iOS cho cac thay doi moi.

## Update 2026-04-05 — Pass 2 (Polish Delta)

- [x] Dashboard: P/L value mau xanh khi lai, mau do khi lo, xam khi bang 0.
- [x] Dashboard: Unrealized P/L % cung co mau theo gia tri.
- [x] Dashboard: Holdings rows hien them unrealized_pl_pct co mau.
- [x] Dashboard: Them nut "Xem Giao Dich" de di thang toi Transactions tab.
- [x] WatchlistScreen: Them `RefreshControl` pull-to-refresh (keo xuong tai lai data).
- [x] AuthScreen: Xoa subtitle debug "Auth foundation - Sprint 19", thay bang tagline chinh thuc.

## Update 2026-04-05 — Pass 3 (i18n Mobile)

**Quyet dinh**: Tich hop i18n (VI/EN toggle) vao Sprint 19 ngay tu dau thay vi de Sprint 20.
**Ly do**: Mobile app con dang code, migrate strings ngay luc nay tranh no ky thuat.
**Luu y**: Phan frontend React va backend (UserConfig.language field) van de Sprint 20.

### Files moi tao:
- `src/i18n/vi.ts` — dictionary tieng Viet (tabs, auth, dashboard, transactions, watchlist)
- `src/i18n/en.ts` — dictionary tieng Anh
- `src/i18n/index.ts` — `createTranslator(locale)` factory, typed `Locale`, `LOCALE_LABELS`
- `src/store/localeStore.ts` — Zustand store persist AsyncStorage key `vninvest_language`

### Files sua doi:
- `AppRoot.tsx` — bootstrap localeStore song song voi authStore
- `BottomTabBar.tsx` — TABS labels dung `t('tabs.*')`
- `AuthScreen.tsx` — toan bo strings migration + placeholder
- `DashboardScreen.tsx` — toan bo strings + them toggle VI/EN button
- `TransactionsScreen.tsx` — toan bo strings migration
- `WatchlistScreen.tsx` — toan bo strings migration (nhieu nhat ~25 strings)

### Acceptance criteria i18n Sprint 19:
- [x] Toggle ngon ngu trong DashboardScreen hoat dong instant (khong reload)
- [x] Preference persist qua lan tat/mo app (AsyncStorage key `vninvest_language`)
- [x] BottomTabBar labels doi theo locale
- [x] AuthScreen: toan bo labels co 2 ngon ngu
- [x] DashboardScreen: toan bo labels co 2 ngon ngu
- [x] TransactionsScreen: toan bo labels co 2 ngon ngu
- [x] WatchlistScreen: toan bo labels + connection status co 2 ngon ngu
- [x] Khong co TypeScript error sau khi migrate

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
