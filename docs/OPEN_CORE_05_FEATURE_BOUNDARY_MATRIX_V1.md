# OPEN CORE FEATURE BOUNDARY MATRIX V1 (OC-05)

Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-18
Trang thai: Baseline boundary matrix, can them canonical technical lock truoc khi public
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md

## 1. Muc tieu
Chot ranh gioi Free/Pro theo tieu chi do duoc de tranh tranh luan cam tinh.

Luu y 2026-04-18:
1. Tai lieu nay khoa boundary cap san pham/module, KHONG khoa numeric quota unit hay runtime plan names.
2. Runtime code hien tai dang dung plan names `free`, `pro`, `enterprise`; business package names van nen doc la Community / Pro Individual / Pro Team.
3. Neu can public/community repo, can bo sung bang map feature_key -> endpoint/module/package de boundary co the enforce duoc.

## 2. Quy tac cham diem
Moi module duoc cham theo 3 tieu chi (1-5):
1. User value (UV): gia tri cho so dong user.
2. Monetization leverage (ML): kha nang tao doanh thu annual.
3. Risk if free (RF): rui ro neu mo mien phi qua rong.

Tong diem = UV + ML + RF
- >= 11: uu tien Pro
- 8-10: Free co gioi han/quota
- <= 7: uu tien Community

## 3. Ma tran de xuat V1
| Module | UV | ML | RF | Tong | De xuat V1 | Ghi chu |
|---|---:|---:|---:|---:|---|---|
| Watchlist co ban | 5 | 2 | 1 | 8 | Free co gioi han | Gioi han so danh sach |
| Realtime quote co ban | 5 | 3 | 2 | 10 | Free co gioi han | Gioi han tan suat goi |
| Chart co ban | 4 | 2 | 1 | 7 | Free | Day activation |
| AI advisory tong hop nang cao | 4 | 5 | 4 | 13 | Pro | Value paid ro nhat |
| Whale alerts nang cao | 4 | 5 | 4 | 13 | Pro | Uu tien paid |
| Regenerate summary thong minh | 3 | 4 | 3 | 10 | Free gioi han / Pro full | Gioi han so lan |
| Team workspace + role | 3 | 5 | 4 | 12 | Pro Team | Team-only |
| Audit/export nang cao | 3 | 4 | 4 | 11 | Pro Team | Compliance value |
| API quota cao | 3 | 5 | 4 | 12 | Pro | Theo plan |
| Priority support/SLA | 2 | 5 | 4 | 11 | Pro Team | Service moat |

## 4. Danh sach chot nhanh cho V1
### Community (Free)
1. Watchlist + dashboard co ban
2. Realtime quote co ban (quota/co tan suat)
3. Chart co ban
4. Workspace ca nhan co ban

### Pro Individual (Annual)
1. AI advisory nang cao
2. Whale alerts nang cao
3. Quota cao hon + uu tien thong luong
4. Regenerate/advisory nang cao

### Pro Team (Annual)
1. Team workspace, role/permission
2. Audit/export nang cao
3. Support uu tien + SLA

## 5. Ghi chu technical mapping hien tai
1. Community -> runtime `free`
2. Pro Individual -> runtime `pro`
3. Pro Team -> runtime `enterprise` tam thoi o code hien tai
4. Mapping nay la runtime compromise, chua phai ten package public cuoi cung

## 6. Open questions chua duoc lock
1. Gioi han quota Free/Pro canonical theo ngay hay theo thang?
2. Trial canonical la 7 ngay hay cach khac, va feature/quota trong trial duoc mo toi muc nao?
3. Co mo API read-only cho Community khong?
4. Boundary cap endpoint/feature_key nao duoc xem la public-safe?

## 7. Next review checkpoint
- Governance refresh tiep theo: lock boundary o muc feature_key/package va giai quyet quota-unit drift.
