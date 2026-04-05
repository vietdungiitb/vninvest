# Sprint 19 Mobile Implementation Guide

Ngay cap nhat: 2026-04-05
Pham vi: Android/iOS MVP voi Expo (React Native + TypeScript)
Muc dich: chot huong trien khai, tranh lap lai loi da gap, lam tai lieu tham chieu cho cac phien code tiep theo.

---

## 1. Muc tieu va pham vi thuc thi

### 1.1 Muc tieu
1. Co app mobile chay duoc tren Android emulator va iOS simulator.
2. Auth flow on dinh, giu session, refresh token tu dong.
3. Dashboard doc du lieu that tu backend portfolio APIs.
4. Trien khai tiep Transactions, Watchlist, Whale Alerts theo Sprint 19.

### 1.2 Out-of-scope hien tai
1. Native Android dev build on dinh cho moi may (dang uu tien Expo Go workflow).
2. Sparkline chart, haptic feedback, biometric auth (dua vao hardening backlog).

---

## 2. Kien truc da chot

### 2.1 Navigation
1. Auth Stack khi chua dang nhap.
2. Main Tabs sau dang nhap (Dashboard, Transactions, Watchlist, Whale, Profile).
3. Deep link Whale Detail duoc dat san hook (phase sau).

### 2.2 State va data layer
1. Auth state: Zustand.
2. Token storage: secure storage (expo-secure-store), khong plain AsyncStorage.
3. API client: Axios + interceptor refresh token khi gap 401.
4. Data caching ke hoach: bo sung React Query cho Dashboard/Transactions/Watchlist.

### 2.3 Realtime strategy
1. Uu tien websocket khi foreground.
2. Polling fallback 5-10s khi socket fail.
3. Hien thi trang thai ket noi ro rang cho user.

---

## 3. Quy uoc UX da chot

### 3.1 Dashboard
1. KPI cards mau theo ngu canh: lai xanh, lo do.
2. Skeleton loading thay cho spinner don le.
3. Pull-to-refresh la co che cap nhat chinh.

### 3.2 Watchlist
1. Flash effect 200-300ms khi gia thay doi.
2. Mau xanh khi tang, do khi giam.
3. Co fallback polling va connection status badge.

### 3.3 Transactions
1. Form co validate tai cho.
2. Autocomplete/goi y symbol khi nhap ma.
3. Sau CRUD cap nhat list ngay va dong bo dashboard summary.

---

## 4. Cac van de da gap va cach xu ly chuan

### 4.1 Android native build gap nhieu loi C++/NDK
Hien tuong:
1. Loi linker voi expo-modules-core, async-storage, rn codegen.
2. Build `expo run:android` khong on dinh tren may hien tai.

Quyet dinh:
1. Uu tien workflow Expo Go de dev nhanh: `npx expo start --android --go`.
2. Native dev build dua vao hardening phase khi can tinh nang native bat buoc.

### 4.2 Login fail du dung tai khoan
Nguyen nhan da xac nhan:
1. Backend yeu cau `email_verified=True` moi duoc dang nhap.
2. User nhap email thay vi username.
3. `DisallowedHost` vi host emulator `10.0.2.2` chua co trong `DJANGO_ALLOWED_HOSTS`.

Xu ly da chot:
1. Danh dau verified cho tai khoan test trong local DB.
2. UI login hien ro "username, khong dung email".
3. Them nut dien nhanh tai khoan test.
4. Them `10.0.2.2` vao `backend/.env` trong `DJANGO_ALLOWED_HOSTS`.

### 4.3 Backend start script truoc do loi
Nguyen nhan:
1. Script cu dung bien PowerShell trung ten reserved variable.

Trang thai:
1. Da co script start backend chay duoc.
2. Neu can fallback: chay truc tiep `python manage.py runserver 0.0.0.0:8000`.

---

## 5. Cau hinh moi truong da xac nhan

### 5.1 Mobile env
File: `mobile-app/.env`
1. `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000`
2. `EXPO_PUBLIC_WS_BASE_URL=ws://10.0.2.2:8000`

### 5.2 Backend env
File: `backend/.env`
1. `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,10.0.2.2`

### 5.3 Java/JDK
1. JAVA_HOME: `C:\Program Files\Android\Android Studio\jbr`

---

## 6. Tai khoan test local

Username: `mobiletest`
Password: `Mobile@12345`
Luu y:
1. Login endpoint hien tai nhan payload username/password.
2. Neu test fail, verify lai `email_verified=True` trong `UserConfig`.

---

## 7. Runbook chay local nhanh

### 7.1 Backend
1. `cd backend`
2. `./start_backend.ps1`

### 7.2 Mobile (Expo Go)
1. `cd mobile-app`
2. `npx expo start --android --go`
3. Trong terminal Metro, bam `r` de reload app khi da sua code.

### 7.3 Khi login fail
1. Kiem tra log backend co `DisallowedHost` khong.
2. Kiem tra payload login co dung username khong.
3. Kiem tra endpoint token local:
   - `POST /api/auth/token/`

---

## 8. Ke hoach tiep theo (implementation order)

1. Transactions vertical slice:
   - Transactions list theo subaccount
   - Transaction form create/update/delete
   - Symbol validation + autocomplete
2. Watchlist realtime UX:
   - Flash effect + polling fallback status
3. Whale hub/detail:
   - Filter/sort co ban
4. Refactor data layer:
   - Bo sung React Query
5. Hardening:
   - Haptic, sparkline, biometric

---

## 9. Definition of Done cho moi phien code tiep theo

1. Co cap nhat docs (execution log + ghi chu quan trong).
2. Co type-check pass (`npx tsc --noEmit`).
3. Co xac nhan API path khop backend contract.
4. Co huong dan test manual ngan gon tren emulator.
