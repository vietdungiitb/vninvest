# Sprint 19 Rollback Notes

Ngay cap nhat: 2026-04-05
Pham vi: mobile-app MVP internal release

## 1. Khi nao can rollback

Rollback neu gap mot trong cac dau hieu sau:

1. Login loop / session restore vo han sau khi cap nhat build.
2. Transactions CRUD ghi sai state hoac dashboard summary khong dong bo co he thong.
3. Whale tab crash hoac giu socket/polling bat thuong khi app vao background.
4. Ban internal build khong the ket noi backend do sai env/base URL.

## 2. Cach rollback nhanh

### Muc A: rollback code mobile

1. Quay ve commit truoc Sprint 19 mobile release neu can test lai ban on dinh hon.
2. Build lai profile `preview` tu commit on dinh do.

### Muc B: rollback contract/env

1. Kiem tra lai `EXPO_PUBLIC_API_BASE_URL` va `EXPO_PUBLIC_WS_BASE_URL` trong build profile.
2. Neu loi do realtime, tam thoi khoa Whale tab trong ban noi bo tiep theo va giu Watchlist/Transactions/Dashboard.
3. Neu loi auth refresh, tam thoi tat auto-restore bang cach dua user ve login sau khi mo app de tranh session loop.

## 3. Diem kiem tra sau rollback

1. Dang nhap thanh cong.
2. Dashboard render duoc summary.
3. Transactions list mo duoc.
4. Watchlist add/remove van chay.
5. App khong crash trong 10 phut smoke co ban.

## 4. Thong tin ky thuat lien quan

- Whale realtime hien su dung websocket uu tien va polling fallback 10s.
- Khi app vao background, Whale tab se dong stream va tai lai khi foreground tro lai.
- Token lifecycle duoc xu ly qua secure storage + interceptor refresh.

## 5. Muc tieu rollback

Khoi phuc nhanh mot ban noi bo co the test duoc cac luong cot loi ma khong block nhom QA/PM.