# Mobile App MVP Plan (Android + iOS)

**Ngay lap**: 2026-04-03  
**Pham vi**: Ke hoach chi tiet de xay ung dung mobile cho du an VNInvest tren Android va iOS  
**Kien truc hien tai**: Frontend React (web), Backend Django REST + JWT + Realtime  
**Muc tieu**: Ra MVP mobile co the dang nhap, xem danh muc, giao dich, watchlist, whale alerts trong 4 tuan

---

## 1) Ket luan cong nghe de trien khai

### Lua chon de xuat: React Native (Expo)

Ly do:
1. Dong bo voi stack React hien tai, de tai su dung model du lieu va conventions.
2. Toc do ra MVP nhanh hon Flutter khi team da quen React.
3. Ho tro Android/iOS trong 1 codebase.
4. Tich hop push notification, deep link, secure storage tuong doi thuan loi.

### Lua chon khong uu tien cho MVP
1. PWA: nhanh nhung han che push/background va trai nghiem native.
2. Flutter: manh ve UI nhung phai hoc va viet moi nhieu hon.

---

## 2) Dinh nghia MVP mobile

### Tinh nang bat buoc (MVP must-have)
1. Auth:
- Dang ky
- Dang nhap JWT
- Luu token an toan
- Dang xuat

2. Dashboard:
- Tong gia tri danh muc
- Holdings chinh
- Phan bo theo ma/nganh

3. Transactions:
- Danh sach giao dich theo tieu khoan
- Tao giao dich moi
- Sua/xoa giao dich
- Validation ma CK theo danh muc he thong

4. Watchlist + Whale:
- Danh sach watchlist/tracked symbols
- Whale alerts hub
- Whale alerts detail theo ma

5. Co ban ky thuat:
- Pull-to-refresh
- Empty/loading/error states
- Pagination cho feed

### Tinh nang de sau MVP (MVP+)
1. Chart nang cao nhu web (kline drawing tools)
2. Push notifications theo alert rule
3. Offline mode day du
4. SSO OAuth

---

## 3) Kien truc mobile de xuat

## 3.1 Cac module
1. Mobile App (React Native + Expo)
2. Shared API client layer (tach tu frontend web)
3. Django API (giu nguyen contract, bo sung endpoint neu can)
4. Realtime channel (WebSocket + fallback polling)

## 3.2 Kien truc thu muc mobile (de xuat)

- mobile-app/
- src/
- app/ (navigation root)
- screens/
- components/
- services/ (api, websocket)
- store/ (zustand hoac redux toolkit)
- hooks/
- utils/
- theme/
- assets/

## 3.3 State management
1. De xuat: Zustand (gon, nhanh cho MVP)
2. Co the nang cap Redux Toolkit neu scale tang nhanh

## 3.4 Auth va bao mat
1. Access/refresh token luu trong secure storage:
- iOS: Keychain
- Android: Encrypted Shared Preferences
2. Khong luu token trong AsyncStorage thuong.
3. Interceptor auto-refresh nhu web.

## 3.5 Realtime strategy
1. Uu tien WebSocket khi online va app foreground.
2. Fallback polling 5-10s neu socket fail.
3. Khi app background: tam dung stream de tiet kiem pin.

---

## 4) Ke hoach thuc thi theo 4 tuan

## Tuan 1 - Foundation va Auth

### Muc tieu tuan
1. Khoi tao app mobile chay duoc tren Android + iOS simulator.
2. Hoan tat luong auth day du.
3. On dinh API client va env config.

### Task chi tiet
1. Khoi tao project Expo + TypeScript.
2. Set up navigation (stack + tabs).
3. Tao API client + JWT refresh interceptor.
4. Man hinh Login/Register/Forgot flow co ban.
5. Tich hop endpoint:
- POST /api/auth/register/
- POST /api/auth/token/
- POST /api/auth/token/refresh/
- GET /api/auth/me/
6. Luu token secure va restore session khi mo app.

### Acceptance criteria
1. Dang nhap thanh cong va vao app.
2. Dong app/mo lai van giu session hop le.
3. Logout xoa sach token va quay ve login.

---

## Tuan 2 - Dashboard + Holdings + Allocation

### Muc tieu tuan
1. Hien thi dashboard mobile co gia tri thuc te.
2. Co loading/error/empty state ro rang.

### Task chi tiet
1. Man hinh Dashboard:
- Summary cards
- Holdings list
- Allocation pie
2. Tich hop endpoint:
- GET /api/portfolio/portfolios/
- GET /api/portfolio/portfolios/{id}/summary/
- GET /api/portfolio/portfolios/{id}/holdings/
- GET /api/portfolio/portfolios/{id}/allocation/
3. Toi uu rendering list (FlatList + keyExtractor).
4. Them pull-to-refresh.

### Acceptance criteria
1. Dashboard hien dung du lieu backend.
2. Scroll muot, khong crash khi du lieu trong.

---

## Tuan 3 - Transactions + Validation + Watchlist

### Muc tieu tuan
1. Hoan tat transaction CRUD tren mobile.
2. Validation nghiep vu ma CK nhu web.
3. Hoan tat watchlist/tracked symbols.

### Task chi tiet
1. Man hinh Transactions:
- List giao dich theo subaccount
- Form tao/sua/xoa
2. Validation ma CK truoc submit (kiem tra trong danh muc ma he thong).
3. Tich hop endpoint:
- GET /api/portfolio/subaccounts/
- GET /api/portfolio/subaccounts/{id}/transactions/
- POST /api/portfolio/subaccounts/{id}/transactions/
- PATCH /api/portfolio/transactions/{id}/
- DELETE /api/portfolio/transactions/{id}/
- GET /api/stock-management/stocks/{symbol}/
4. Watchlist/tracked:
- GET /api/stock-management/tracked-symbols/
- POST /api/stock-management/tracked-symbols/
- DELETE /api/stock-management/tracked-symbols/{id}/

### Acceptance criteria
1. Tao/sua/xoa giao dich thanh cong tren mobile.
2. Ma CK sai bi chan va bao loi ro rang.

---

## Tuan 4 - Whale Alerts + Hardening + Internal Release

### Muc tieu tuan
1. Hoan tat Whale Alerts hub/detail ban mobile.
2. Hoan tat test co ban va ban internal test.

### Task chi tiet
1. Whale Alerts Hub:
- Aggregate feed
- Scope filter (tracked/watchlist)
- Sort by time/value
2. Whale Alerts Detail theo ma:
- Feed panel
- Summary card
- Co ban do sau/RVOL (neu kip)
3. Realtime:
- WebSocket subscribe theo symbol
- Fallback polling khi disconnect
4. Hardening:
- Error boundary
- Retry policy
- Logging su co
5. Build noi bo:
- Android Internal Testing
- iOS TestFlight (neu co Apple account)

### Acceptance criteria
1. Whale flow chay on dinh 30 phut khong crash.
2. Ban internal phat hanh cho doi test.

---

## 5) Backlog chi tiet theo nhom

## 5.1 Mobile FE backlog
1. Auth screens + secure storage
2. Dashboard widgets + holdings list
3. Transactions form + fee calculator
4. Watchlist list + detail navigation
5. Whale hub + whale detail + filters
6. Settings + account info

## 5.2 Backend backlog can bo sung
1. Chuan hoa error schema cho mobile de parse de.
2. Them endpoint gop nhe cho dashboard mobile (neu can).
3. Rate limit theo mobile client profile.
4. Co che trace-id de debug API tu mobile.

## 5.3 QA backlog
1. Test matrix Android 11-14, iOS 16-18.
2. Kich ban network xau (3G/timeout/offline).
3. Regression auth/token refresh.
4. Smoke realtime + polling fallback.

---

## 6) Nhan su de xuat

1. 1 Mobile Engineer full-time
2. 1 Backend Engineer part-time (30-40%)
3. 1 QA part-time
4. 1 Product owner (review acceptance moi tuan)

---

## 7) Risk va giai phap

1. Risk: Dang ky that bai do SMTP/email verify
- Giai phap: Dev fallback mode nhu web da patch, production bat buoc mail

2. Risk: Realtime khong on dinh tren mang di dong
- Giai phap: Socket + polling fallback, auto reconnect, timeout ro rang

3. Risk: Chart nang tren mobile gay giat
- Giai phap: MVP chi giu chart can thiet, toi uu virtualization

4. Risk: API contract thay doi trong luc mobile dang lam
- Giai phap: Freeze contract theo sprint, moi thay doi phai co changelog

---

## 8) KPI MVP

1. Crash-free session >= 99.0%
2. Login success rate >= 98%
3. API error rate < 2% (tru 4xx do input sai)
4. TTFD dashboard (time to first data) < 2.5s o wifi tot
5. User test noi bo >= 10 nguoi, pass >= 80% checklist

---

## 9) Definition of Done (MVP)

1. Android app build duoc va cai qua Internal Testing.
2. iOS app build duoc va phat qua TestFlight.
3. Cac luong sau pass end-to-end:
- Register/Login/Logout
- Dashboard summary/holdings
- Transactions CRUD
- Watchlist/Tracked symbols
- Whale alerts hub/detail
4. Co tai lieu setup + release note + known issues.

---

## 10) Checklist handover

1. docs setup mobile env
2. docs env variables (API base URL, WS URL)
3. test account va script seed du lieu demo
4. release checklist Android/iOS
5. bug triage board cho post-MVP

---

## 11) De xuat next step ngay

1. Tao nhanh workspace mobile (Expo) trong nhanh rieng.
2. Freeze API contract 2 tuan dau cho auth/dashboard/transactions.
3. Bat dau Tuan 1 voi auth va secure token truoc.
4. Cuoi Tuan 1: demo dang nhap + restore session.
