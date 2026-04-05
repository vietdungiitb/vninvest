# Mobile Runtime Smoke Checklist (10-15 phut)

Muc tieu:
- Xac nhan nhanh mobile app on dinh sau cac thay doi Sprint 19.
- Bat som loi auth, i18n, transactions, watchlist realtime va network fallback.

Pham vi:
- Nen tang: Android emulator va/hoac iOS simulator
- Build mode: Expo dev
- API backend: http://127.0.0.1:8000

---

## 0) Dieu kien truoc khi test

- Backend dang online (port 8000).
- Expo app dang mo tren emulator/simulator.
- Co tai khoan test hop le (vi du: mobiletest).
- Neu can test session restore: da login truoc va tat/mo lai app.

---

## 1) Kich ban Auth va Session

### TC-MA1: Login thanh cong
Buoc:
1. Mo app tai Auth screen.
2. Dang nhap bang tai khoan test.

Ket qua mong doi:
- Vao Dashboard thanh cong.
- Khong bi vong lap login.

### TC-MA2: Session restore
Buoc:
1. Sau login, dong app.
2. Mo lai app.

Ket qua mong doi:
- Session duoc restore.
- Khong yeu cau login lai ngay lap tuc (neu token con han).

### TC-MA3: Logout sach
Buoc:
1. Tu Dashboard, mo menu va bam Logout.

Ket qua mong doi:
- Ve Auth screen.
- State dang nhap duoc xoa.

---

## 2) Kich ban i18n (VI/EN)

### TC-MI1: Toggle ngon ngu ngay lap tuc
Buoc:
1. O Dashboard, doi ngon ngu VI <-> EN.

Ket qua mong doi:
- Labels tren tab va man hinh doi ngay, khong reload app.

### TC-MI2: Persist ngon ngu
Buoc:
1. Chon EN.
2. Dong app va mo lai.

Ket qua mong doi:
- App giu EN nhu da chon truoc do.

### TC-MI3: Pham vi migrate strings
Buoc:
1. Mo lan luot Auth, Dashboard, Transactions, Watchlist.

Ket qua mong doi:
- Khong con chuoi hard-code trai ngon ngu.

---

## 3) Kich ban Dashboard

### TC-MD1: Summary cards va holdings
Buoc:
1. Vao Dashboard sau login.

Ket qua mong doi:
- Summary card hien thi du lieu.
- Holdings/Allocation render dung.

### TC-MD2: Mau P/L
Buoc:
1. Kiem tra cac gia tri lai/lo.

Ket qua mong doi:
- Lai mau xanh, lo mau do, bang 0 mau xam.

### TC-MD3: Dieu huong Transactions
Buoc:
1. Bam nut mo Transactions tu Dashboard.

Ket qua mong doi:
- Dieu huong dung va quay lai duoc Dashboard.

---

## 4) Kich ban Transactions

### TC-MT1: Liet ke giao dich theo subaccount
Buoc:
1. Vao Transactions.
2. Chon qua lai cac tieu khoan.

Ket qua mong doi:
- Danh sach giao dich cap nhat dung theo tieu khoan.

### TC-MT2: Tao moi/Sua/Xoa
Buoc:
1. Tao giao dich moi.
2. Sua giao dich vua tao.
3. Xoa giao dich vua tao.

Ket qua mong doi:
- CRUD thanh cong, danh sach cap nhat dung.

### TC-MT3: Validation symbol va field
Buoc:
1. Thu submit symbol rong/sai.
2. Thu gia/so luong <= 0.

Ket qua mong doi:
- Bao loi ro rang, khong crash app.

---

## 5) Kich ban Watchlist + Realtime

### TC-MW1: Add/Remove symbol
Buoc:
1. Them 1 symbol moi vao watchlist.
2. Xoa symbol vua them.

Ket qua mong doi:
- Add/remove thanh cong, message thong bao dung.

### TC-MW2: Whale alerts hub
Buoc:
1. Kiem tra sort theo time/value.
2. Kiem tra advisory list theo symbol.

Ket qua mong doi:
- Du lieu hien thi dung, khong treo UI.

### TC-MW3: Connection status + fallback
Buoc:
1. Theo doi connection status.
2. Tam tat mang 10-15 giay roi bat lai.

Ket qua mong doi:
- Status thay doi hop ly (connected/polling/disconnected).
- Co polling fallback, app phuc hoi du lieu sau khi mang on.

---

## 6) Kich ban hieu nang cam nhan

### TC-MP1: Do muot chung
Buoc:
1. Chuyen tab lien tuc Dashboard <-> Transactions <-> Watchlist 2 vong.

Ket qua mong doi:
- Khong crash P0/P1.
- Khong giat lag nghiem trong.

### TC-MP2: Mat do hien thi compact
Buoc:
1. Kiem tra Dashboard/Transactions/Watchlist sau compact pass.

Ket qua mong doi:
- Nhin duoc nhieu thong tin hon trong cung viewport.
- Van doc duoc thong tin chinh.

---

## 7) Tieu chi Pass/Fail nhanh

PASS neu:
1. Login/session/logout on dinh.
2. Toggle i18n va persist hoat dong dung.
3. Transactions CRUD + validation dung.
4. Watchlist realtime/fallback hoat dong.
5. Khong co crash P0/P1 trong 10-15 phut smoke.

FAIL neu:
1. App loop auth hoac vo session bat thuong.
2. i18n khong doi dong bo giua man hinh/tab.
3. Transactions CRUD sai state.
4. Watchlist mat du lieu/realtime khong phuc hoi.
5. Crash/freezing khi dieu huong lien tuc.

---

## 8) Mau ghi nhan ket qua

Ngay gio:
Nguoi test:
Commit hash:
Thiet bi/emulator:

TC-MA1:
TC-MA2:
TC-MA3:
TC-MI1:
TC-MI2:
TC-MI3:
TC-MD1:
TC-MD2:
TC-MD3:
TC-MT1:
TC-MT2:
TC-MT3:
TC-MW1:
TC-MW2:
TC-MW3:
TC-MP1:
TC-MP2:

Tong ket: PASS / FAIL
Loi P0/P1:
Huong xu ly tiep:
