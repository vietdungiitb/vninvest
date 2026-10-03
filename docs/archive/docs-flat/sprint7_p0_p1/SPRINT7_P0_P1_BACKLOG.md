# Sprint 7 Backlog P0/P1 (Thuc thi truoc)

Muc tieu Sprint 7:
- Chuan hoa domain va API contract de loai bo loi mismatch, tao nen tang an toan cho Sprint 8+.

## A. Danh sach ticket uu tien

### P0 (bat buoc xong trong Sprint 7)

| ID | Ticket | Mo ta thuc thi | Owner | Estimate | Phu thuoc | DoD |
|---|---|---|---|---|---|---|
| S7-P0-01 | Schema mismatch audit | Audit model/migration/serializer/command va lap bang mismatch | BE | 0.5d | None | Co file mismatch report + quyet dinh xu ly |
| S7-P0-02 | Chot schema muc tieu | Chot cac field va constraint cho SubAccount, Transaction, Watchlist, Snapshot | BE | 0.5d | S7-P0-01 | ADR duoc review boi BE lead |
| S7-P0-03 | Fix model-command inconsistencies | Sua command/logic dang dung field sai de khong vo runtime | BE | 1d | S7-P0-02 | Chay command lien quan khong con exception |
| S7-P0-04 | Route consistency stock management | Chot route namespace /api/stock-management/* va mapping route cu | BE | 0.5d | S7-P0-02 | Co bang old->new + endpoint chay du |
| S7-P0-05 | Frontend API alignment | Cap nhat frontend goi dung route theo contract da chot | FE | 1d | S7-P0-04 | Khong con goi endpoint sai tren 3 man hinh chinh |
| S7-P0-06 | OpenAPI v1.1 draft | Mo ta request/response/error cho endpoint P0 | BE | 1d | S7-P0-04 | Co spec docs va example payload |
| S7-P0-07 | Contract smoke tests | Tao test cho auth, portfolio core, stock-management core | QA/BE | 1d | S7-P0-05,S7-P0-06 | Test pass local + pipeline |
| S7-P0-08 | Migration + rollback note | Lap ke hoach migration an toan va rollback checklist | BE/DevOps | 0.5d | S7-P0-02 | Document rollback du buoc, dry-run pass |

### P1 (lam ngay sau khi P0 on dinh)

| ID | Ticket | Mo ta thuc thi | Owner | Estimate | Phu thuoc | DoD |
|---|---|---|---|---|---|---|
| S7-P1-01 | Error format standard | Chuan hoa format loi API (code, message, detail) | BE | 0.5d | S7-P0-06 | 3 endpoint mau tra loi cung schema |
| S7-P1-02 | Deprecation warnings | Danh dau route cu se bo, them warning tai docs/changelog | BE | 0.5d | S7-P0-04 | Co deprecation section ro deadline |
| S7-P1-03 | Frontend fallback handling | Xu ly hien thi loi than thien khi route cu bi bo | FE | 0.5d | S7-P1-01 | UI khong vo trang khi API fail |
| S7-P1-04 | Data fix command (neu can) | Viet command sua du lieu cu theo schema moi | BE | 1d | S7-P0-03 | Chay thu tren DB clone thanh cong |

## B. Thu tu thuc thi de giam rui ro

1. S7-P0-01 -> S7-P0-02.
2. S7-P0-03 song song S7-P0-04.
3. S7-P0-05 sau khi route da chot.
4. S7-P0-06 va S7-P0-07.
5. S7-P0-08 ket thuc sprint de khoa quy trinh release.
6. P1 trien khai theo dung thu tu 01 -> 04.

## C. Checklist daily cho Scrum Master/Tech Lead

- Tat ca P0 da co owner ro rang chua?
- Co task nao Blocked > 1 ngay?
- Co ticket nao estimate > 1 ngay chua tach nho?
- Co thay doi contract nao chua update vao OpenAPI?
- FE da test voi payload moi chua?

## D. Tieu chi hoan thanh Sprint 7

- 100% P0 Done.
- It nhat 2 ticket P1 Done.
- Khong con loi 404 do lech route giua frontend/backend o flow chinh.
- Co tai lieu migration/rollback co the dung ngay.
