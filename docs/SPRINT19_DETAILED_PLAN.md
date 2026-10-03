# Sprint 19 Detailed Plan — Mobile App MVP (Android + iOS)

**Ngay lap ke hoach**: 2026-04-04  
**Trang thai**: PLANNED  
**Muc tieu sprint**: Khoi dong Sprint mobile dau tien va ship MVP app Android/iOS trong 4 tuan voi cac luong cot loi: Auth, Dashboard, Transactions, Watchlist, Whale Alerts.

---

## 1) Muc tieu kinh doanh va ky thuat

### Muc tieu kinh doanh
1. Mo rong kenh su dung tu web sang mobile de tang tan suat su dung hang ngay.
2. Cho phep user theo doi danh muc va xu ly giao dich nhanh tren thiet bi di dong.
3. Dat duoc ban phat hanh noi bo de test that nghiem voi nhom nguoi dung dau tien.

### Muc tieu ky thuat
1. 1 codebase React Native (Expo) chay duoc tren Android va iOS.
2. Tai su dung API contract backend hien co, han che phat sinh endpoint moi.
3. Dam bao on dinh auth token lifecycle, realtime fallback, va basic observability.

---

## 2) Scope Sprint 19

### In-scope
1. Khoi tao workspace mobile (`mobile-app/`) voi Expo + TypeScript.
2. Auth flow day du (register/login/refresh/logout + secure token storage).
3. Dashboard mobile (summary, holdings, allocation + pull-to-refresh).
4. Transactions CRUD tren subaccount + validation ma CK.
5. Watchlist/tracked symbols + Whale alerts hub/detail.
6. Ban internal test: Android Internal Testing va iOS TestFlight (neu du dieu kien tai khoan).

### Out-of-scope
1. Kline chart tools nang cao nhu web.
2. Offline mode day du va sync queue phuc tap.
3. SSO OAuth cho mobile user.
4. Generic push engine voi rule builder day du.

---

## 3) Kien truc de xuat

## 3.1 App architecture
1. Framework: React Native + Expo + TypeScript.
2. Navigation: Stack + Bottom Tabs.
3. State: Zustand (MVP), co kha nang nang cap Redux Toolkit sau.

## 3.2 Thu muc de xuat
- `mobile-app/src/app/` (navigation root)
- `mobile-app/src/screens/`
- `mobile-app/src/components/`
- `mobile-app/src/services/` (api/ws)
- `mobile-app/src/store/`
- `mobile-app/src/hooks/`
- `mobile-app/src/utils/`
- `mobile-app/src/theme/`

## 3.3 Bao mat va token lifecycle
1. Luu access/refresh token trong secure storage (khong dung plain AsyncStorage).
2. Axios interceptor auto-refresh khi access token het han.
3. Logout xoa toan bo token + session state.

## 3.4 Realtime strategy
1. Uu tien WebSocket khi app foreground.
2. Fallback polling 5-10s khi socket fail hoac timeout.
3. Tiet kiem pin: dung stream khi app vao background.

---

## 4) Work Breakdown theo giai doan

## Phase 0 — Bootstrap & Contract Freeze (0.5-1 ngay)
**Muc tieu**: Co skeleton app va chot API contract can dung cho 2 tuan dau.

Tasks:
1. Tao workspace `mobile-app/` voi Expo + TypeScript + lint + env template.
2. Chot base URL strategy cho dev/staging va token auth convention.
3. Freeze API contract cho auth/dashboard/transactions (khong breaking changes).

Acceptance phase:
1. App chay duoc tren Android/iOS simulator.
2. Team backend-mobile thong nhat endpoint list va error schema MVP.

## Phase 1 — Auth Foundation (1-1.5 ngay)
**Muc tieu**: Login/register/session restore on dinh.

Tasks:
1. Implement Login/Register/Forgot UI flow co ban.
2. Tich hop endpoints:
   - `POST /api/auth/register/`
   - `POST /api/auth/token/`
   - `POST /api/auth/token/refresh/`
   - `GET /api/auth/me/`
3. Secure storage + interceptor + session restore.

Acceptance phase:
1. Login thanh cong, dong/mo app van giu session hop le.
2. Logout quay ve login va khong con token trong secure storage.

## Phase 2 — Dashboard Core (1-1.5 ngay)
**Muc tieu**: Hien thi du lieu danh muc that va xu ly state day du.

Tasks:
1. Dashboard cards + holdings list + allocation view.
2. Tich hop endpoints:
   - `GET /api/portfolio/portfolios/`
   - `GET /api/portfolio/portfolios/{id}/summary/`
   - `GET /api/portfolio/portfolios/{id}/holdings/`
   - `GET /api/portfolio/portfolios/{id}/allocation/`
3. Pull-to-refresh + loading/empty/error states + list performance.

Acceptance phase:
1. Dashboard hien dung du lieu backend.
2. Khong crash khi API tra rong/latency cao.

## Phase 3 — Transactions + Watchlist (1.5-2 ngay)
**Muc tieu**: Hoan tat nghiep vu thao tac danh muc tren mobile.

Tasks:
1. Transactions list/create/update/delete theo subaccount.
2. Validation ma CK truoc submit qua `GET /api/stock-management/stocks/{symbol}/`.
3. Watchlist/tracked symbols list + add/remove.

Acceptance phase:
1. CRUD giao dich thanh cong tren mobile.
2. Input sai duoc chan va hien thong bao ro rang.

## Phase 4 — Whale Alerts + Realtime Hardening (1-1.5 ngay)
**Muc tieu**: Co trai nghiem canh bao dong tien lon va fallback on dinh.

Tasks:
1. Whale hub aggregate + filter/sort co ban.
2. Whale detail theo symbol.
3. WebSocket subscribe/unsubscribe + polling fallback.
4. Error boundary + retry policy + log points can thiet.

Acceptance phase:
1. Whale flow chay on dinh 30 phut khong crash.
2. Fallback hoat dong khi socket bi ngat.

## Phase 5 — QA Matrix + Internal Release (1 ngay)
**Muc tieu**: Co ban phat hanh noi bo va checklist release ro rang.

Tasks:
1. Smoke matrix Android 11-14, iOS 16-18 (neu co thiet bi/simulator).
2. Kich ban network xau: timeout, reconnect, offline tam thoi.
3. Build phat hanh noi bo Android + iOS.
4. Chot known issues + rollback notes.

Acceptance phase:
1. Android internal build cai duoc va test duoc luong chinh.
2. iOS TestFlight build tao duoc (neu account san sang).

---

## 5) Ke hoach thoi gian de xuat (10 ngay cong)

Day 1: Phase 0 + bat dau Phase 1  
Day 2: Hoan tat Phase 1  
Day 3-4: Phase 2  
Day 5-7: Phase 3  
Day 8-9: Phase 4  
Day 10: Phase 5 + sign-off noi bo

---

## 6) RACI de xuat

- Mobile Engineer: app architecture + implementation + release build
- Backend Engineer: contract freeze + endpoint support + bugfix nhanh
- QA: mobile test matrix + regression auth/transactions
- DevOps: env/staging support + artifact distribution
- PM/BA: acceptance sign-off theo phase

---

## 7) KPI va Success Metrics

1. Crash-free session >= 99.0% tren internal test.
2. Login success rate >= 98%.
3. Dashboard TTFD < 2.5s tren wifi tot.
4. API error rate < 2% (ngoai tru 4xx input validation).
5. Toi thieu 10 internal testers, pass >= 80% checklist.

---

## 8) Risk register & Mitigation

1. Realtime khong on dinh tren mang di dong:
- Mitigation: socket + polling fallback, reconnect policy, timeout ro rang.

2. API contract thay doi giua sprint:
- Mitigation: freeze contract 2 tuan dau, moi thay doi qua changelog.

3. Build iOS bi block boi signing/account:
- Mitigation: uu tien Android internal truoc, iOS theo readiness gate.

4. Hieu nang list/whale feed tren may yeu:
- Mitigation: toi uu FlatList, pagination, debounce update UI.

---

## 9) Deliverables cuoi Sprint 19

1. Mobile app MVP branch co cac luong: Auth, Dashboard, Transactions, Watchlist, Whale.
2. 2 artifact noi bo: Android build + (neu co) iOS TestFlight build.
3. Tai lieu setup/release env cho mobile app.
4. Acceptance checklist Sprint 19 cap nhat day du va co sign-off.

---

## 10) UX + Architecture toi uu (chot sau review)

### 10.1 Navigation va session retention
1. Auth Stack / Main Tabs giu nguyen nhu thiet ke goc.
2. Bat buoc co token refresh flow khi gap 401 (khong kick user ve login neu refresh thanh cong).
3. Chuan bi san hook cho deep-link Whale Detail (de mo rong push-notification phase sau).

### 10.2 Dashboard UX
1. KPI card hien mau theo ngu canh:
   - Lai: xanh
   - Lo: do
2. Uu tien skeleton loading thay vi spinner don le o dashboard blocks.
3. Pull-to-refresh giu la co che cap nhat chinh cho MVP.

### 10.3 Watchlist + Realtime UX
1. Them flash effect 200-300ms khi gia thay doi:
   - Tang: xanh
   - Giam: do
2. Fallback polling window: 5-10 giay khi websocket fail.
3. Hien connection status ro rang: Connected / Polling / Disconnected.

### 10.4 Data layer va state strategy
1. Auth token luu secure storage (Keychain/Keystore), khong plain storage.
2. State manager MVP: Zustand (giu nguyen).
3. Data fetching/caching: bo sung React Query cho dashboard + transactions + watchlist trong Sprint 19.
4. Realtime tiep tuc theo websocket hien tai, fallback polling da co.

### 10.5 Transactions UX (uu tien cao)
1. Form giao dich them auto-complete/goi y ma co phieu khi user nhap symbol.
2. Validation truoc submit va hien loi tai cho.
3. Sau create/update/delete thanh cong, cap nhat list va dashboard summary co kiem soat.

### 10.6 Hardening backlog (khong block MVP)
1. Haptic feedback cho su kien thanh cong/canh bao quan trong.
2. Sparkline mini chart trong watchlist rows.
3. Sinh trac hoc (FaceID/Van tay) cho re-auth khi mo app.
