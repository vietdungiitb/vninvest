# Sprint 19 Internal Release Notes

Ngay cap nhat: 2026-04-05
Trang thai: READY FOR INTERNAL TEST

## 1. Pham vi ban phat hanh noi bo

- Auth flow: login, register, session restore, logout.
- Dashboard mobile: summary, holdings, allocation, pull-to-refresh.
- Transactions: list, create, update, delete, symbol validation, autocomplete.
- Watchlist: tracked symbols add/remove.
- Whale: tab rieng cho feed aggregate, filter theo symbol, sort theo time/value, advisory refresh.
- i18n mobile: VI/EN toggle, persist preference.
- Profile tab: thong tin tai khoan, doi ngon ngu, logout.

## 2. Build/readiness

- TypeScript validation: PASS (`npm run typecheck`).
- EAS config: da commit `mobile-app/eas.json`.
- Android internal build profile: `preview`.
- iOS simulator build profile: `simulator`.

## 2.1 Smoke verification da chay trong local workspace

- Auth/API smoke PASS voi user `mobiletest`:
	- login token
	- `GET /api/auth/me/`
	- `GET /api/portfolio/portfolios/`
- Transactions smoke PASS:
	- create
	- update
	- delete
- Watchlist smoke PASS:
	- add tracked symbol
	- get groups
	- whale aggregate query
	- remove tracked symbol
- Whale advisory refresh endpoint tra message gate theo plan Pro, duoc xem la dung nghiep vu.
- Expo Metro dev server da len thanh cong, port runtime hien tai: `8003`.

## 3. Huong dan build nhanh

Tu thu muc `mobile-app/`:

1. `npm run typecheck`
2. `npm run build:android:preview`
3. `npm run build:ios:simulator`

Luu y:
- Can dang nhap EAS CLI va gan `expo.extra.eas.projectId` that trong `mobile-app/app.json` truoc cloud build dau tien.
- iOS TestFlight van phu thuoc Apple account/signing readiness.

## 4. Known issues / constraints

1. Chua co xac nhan smoke test 30 phut lien tuc tren thiet bi that.
2. Chua co ket qua iOS simulator/TestFlight trong workspace hien tai.
3. Android package id hien van la `com.anonymous.mobileapp`; can doi truoc khi release cong khai.
4. App chua bo sung push notification, biometrics, haptic va sparkline.

## 5. Kich ban test uu tien cao

1. Login -> Dashboard -> Transactions CRUD -> quay lai Dashboard.
2. Watchlist add/remove symbol -> sang Whale -> doi sort/filter.
3. Chuyen app sang background roi mo lai -> Whale reconnect va refresh du lieu.
4. Toggle VI/EN trong Profile -> quay cac tab de kiem tra strings.

## 6. Ket luan

Sprint 19 mobile MVP da dat muc tieu code-complete cho internal testing trong scope Auth, Dashboard, Transactions, Watchlist va Whale.