# Web Runtime Smoke Checklist (10-15 phut)

Muc tieu:
- Xac nhan nhanh web app chay on sau cac thay doi hardening runtime.
- Bat som 3 nhom loi: auth (401), throttle (429), realtime disconnect/reconnect.

Pham vi:
- Frontend web: http://127.0.0.1:3000
- Backend API: http://127.0.0.1:8000
- Browser khuyen nghi: Chrome/Edge (1 profile sach)

---

## 0) Dieu kien truoc khi test

- Backend dang online (port 8000).
- Frontend dang online (port 3000).
- Co tai khoan test hop le (vi du: mobiletest).
- LocalStorage khong giu token cu sai.

Thao tac nhanh:
1. Mo DevTools -> Application -> Local Storage -> xoa `access_token`, `refresh_token`.
2. Hard reload tab.

---

## 1) Kich ban Auth (401)

### TC-A1: Login thanh cong
Buoc:
1. Vao /login.
2. Dang nhap bang tai khoan test hop le.

Ket qua mong doi:
- Chuyen vao dashboard.
- Khong co loop redirect /login <-> /dashboard.

### TC-A2: Bootstrap auth khong spam 401
Buoc:
1. Sau login, mo Network tab.
2. Filter theo `/api/auth/me/`, `/api/portfolio/portfolios/`, `/api/portfolio/userconfig/`.

Ket qua mong doi:
- 3 endpoint tren tra 200.
- Khong co pattern spam 401 lap lai lien tuc.

### TC-A3: Token sai -> logout sach
Buoc:
1. Sua `access_token` localStorage thanh chuoi rac.
2. Refresh trang.

Ket qua mong doi:
- App ve /login.
- Token cu bi xoa.
- Khong spam request protected endpoint.

---

## 2) Kich ban Realtime/Throttle (429)

### TC-R1: Stock Detail load du lieu co ban
Buoc:
1. Vao trang stock detail (vd: MBB).
2. Theo doi panel Price Depth, Breadth, Whale.

Ket qua mong doi:
- Du lieu hien thi binh thuong.
- Neu co loi tam thoi thi message de hieu, khong crash trang.

### TC-R2: Price Board loop khong bi 429 day chuyen
Buoc:
1. O Stock Detail giu trang 2-3 phut.
2. Theo doi Console + Network cho endpoint `/api/realtime/price-board/<symbol>/`.

Ket qua mong doi:
- Khong co 429 lap lai lien tuc.
- Neu co 429 don le, client tu cooldown va tu phuc hoi.

### TC-R3: Reconnect hanh vi on dinh
Buoc:
1. Tam tat mang 10-15 giay (hoac disable wifi).
2. Bat mang lai.

Ket qua mong doi:
- Trang khong treo.
- Realtime du lieu tiep tuc cap nhat sau khi mang on lai.

---

## 3) Kich ban Navigation + Coherence

### TC-N1: Chuyen trang lien tuc
Buoc:
1. Dashboard -> Watchlist -> Stock Detail -> Transactions -> Dashboard.
2. Lap lai 2 vong.

Ket qua mong doi:
- Khong blank page.
- Khong warning nghiem trong trong console.

### TC-N2: Hieu nang cam nhan
Buoc:
1. Tu login vao dashboard.
2. Chuyen sang stock detail.

Ket qua mong doi:
- TTFD cam nhan hop ly (< 2.5s tren wifi tot).
- Khong lag bat thuong khi mo panel realtime.

---

## 4) Tieu chi Pass/Fail nhanh

PASS neu:
1. Khong co spam 401 sau login.
2. Khong co 429 lap lai lien tuc o price-board.
3. Realtime phuc hoi duoc sau mat mang tam thoi.
4. Khong co crash P0/P1 trong 10-15 phut smoke.

FAIL neu:
1. Loop 401/redirect xay ra.
2. 429 xuat hien lien tuc lam panel khong dung duoc.
3. Mat realtime hoan toan sau reconnect.
4. Crash trang hoac block thao tac chinh.

---

## 5) Mau ghi nhan ket qua

Ngay gio:
Nguoi test:
Commit hash:
Moi truong:

TC-A1:
TC-A2:
TC-A3:
TC-R1:
TC-R2:
TC-R3:
TC-N1:
TC-N2:

Tong ket: PASS / FAIL
Loi P0/P1:
Huong xu ly tiep:
