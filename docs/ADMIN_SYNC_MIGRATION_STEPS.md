# Admin Sync Migration Steps

Muc tieu:
- Chuyen han sync endpoint tu /api/sync-stockprofile/ sang namespace /api/admin-sync/.
- Dam bao frontend/backend dong bo, khong con call-site legacy.

## Pham vi thay doi

Backend:
1. Bo route `/api/sync-stockprofile/` khoi config url root.
2. Tao namespace moi `/api/admin-sync/*`.
3. Dua endpoint sync stock profile vao namespace moi.
4. Chuan hoa ten route cho de mo rong them EOD sync, snapshot trigger sau nay.

Frontend:
1. Doi API client tu `/sync-stockprofile/` sang `/admin-sync/stockprofile/`.
2. Giu hanh vi UI hien tai o trang Watchlist, chi doi endpoint.

Tai lieu:
1. Cap nhat diagram/index neu route current state thay doi.
2. Cap nhat TODO/link truy cap nhanh neu can.

## Cac buoc thuc hien cu the

### Buoc 1 - Tao namespace admin-sync
- Tao file router rieng cho admin sync.
- Khai bao endpoint:
  - `POST /api/admin-sync/stockprofile/`

Ket qua mong doi:
- Sync endpoint co namespace ro rang, de mo rong ve sau.

### Buoc 2 - Refactor config urls
- Xoa route root cu:
  - `/api/sync-stockprofile/`
- Them include moi:
  - `/api/admin-sync/`

Ket qua mong doi:
- Khong con sync endpoint nam roi rac o root `/api/`.

### Buoc 3 - Chon implementation cho endpoint
- Uu tien tai su dung API function da co trong `portfolio.views` thay vi tiep tuc dat subprocess view trong `config.urls`.
- Ly do:
  - Giam logic trong file routing.
  - De test va bao tri hon.
  - Giu routing va business logic tach biet.

Ket qua mong doi:
- `config.urls` chi con lam nhiem vu route composition.

### Buoc 4 - Cap nhat frontend API client
- Doi `syncStockProfile()` sang endpoint moi:
  - tu `/sync-stockprofile/`
  - thanh `/admin-sync/stockprofile/`

Ket qua mong doi:
- Watchlist van hoat dong nhu cu, nhung goi namespace moi.

### Buoc 5 - Cap nhat tai lieu ky thuat current state
- Dieu chinh cac tai lieu co nhac den `/api/sync-stockprofile/` neu chung duoc dung nhu current-state docs.
- Uu tien cap nhat:
  - diagram current state
  - docs index

Ket qua mong doi:
- Tai lieu khong lech so voi code da deploy.

### Buoc 6 - Validation truoc khi merge
- Kiem tra grep khong con call-site legacy trong source code chinh.
- Smoke check:
  1. `POST /api/admin-sync/stockprofile/` tra JSON hop le.
  2. Frontend button tren Watchlist van goi dung endpoint.
  3. Khong phat sinh 404 do route change.

## File du kien thay doi

- backend/config/urls.py
- backend/portfolio/urls.py
- backend/portfolio/urls_admin_sync.py
- backend/portfolio/urls_stock.py
- frontend/src/api/client.js
- docs/BACKEND_TECHNICAL_DIAGRAM_L2_1.md
- docs/TECHNICAL_DIAGRAMS_INDEX.md (neu can)
- TODO.md (neu can)

## Tieu chi hoan thanh

1. Endpoint cu khong con duoc expose.
2. Endpoint moi hoat dong tai `/api/admin-sync/stockprofile/`.
3. Frontend Watchlist sync hoat dong binh thuong.
4. Tai lieu current state khong con tro toi route cu.
