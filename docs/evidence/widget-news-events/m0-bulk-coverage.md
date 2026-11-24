# M0 — Backup + Bulk CafeF 3 sàn (2026-11-24)

Branch `feat/price-mig-bulk` (worktree `wt/price-mig-bulk`) · Plan `PLAN_PRICE_MIGRATION_IMPLEMENTATION_20261124.md`.

## S0 Backup
- `/opt/backups/price-migration-20261124/before_20261124.dump` — **99 MB**, sha256 `6c5a7e05dffc2f6eaedd7ee40b69ab429383dc41c3aa4ce02dd7f2bed2c19691`.
- `pg_dump -Fc` qua `vnsaas-staging-db` nối tạm vào `vninvest-staging_vninvest_network` (đã ngắt); 3 bảng: `market_data_dailyprice`, `market_data_cafefdailyprice`, `market_serving_symbolsnapshot`.
- **Gate disk ≥80G KHÔNG đạt**: sau dọn Docker (image/volume/builder/journal) còn **55G**. Chấp nhận với giải trình: dump 99 MB + bulk ~600 MB, đủ an toàn; ghi rõ không đạt ngưỡng chốt.

## S1 Bulk
- Đổi `cafef/importer.py` dùng `Vnbroker().reference('cafef').bulk_year(exchange, year)` (nguồn SSOT); fallback local XLSX khi vnbroker lỗi.
- Thêm `change_pct` vào `CafefDailyPrice` + `contract.normalize_row` (parse `'+1,65 (+4,01%)'` → `4.01`) + `importer._UPDATABLE`; migration `0011_cafef_change_pct` (do `makemigrations` sinh, đã apply staging).
- TDD: RED `KeyError: 'change_pct'` → GREEN **2/2**; golden TPB `04/01/2022` raw 42.750 / adj 17.940.

## Kết quả bulk thật
- **2.308.756 dòng** `CafefDailyPrice` (từ 101.756 ban đầu).
- Coverage thực theo năm (số dòng / số mã — gộp các sàn đã tải):

| Năm | Dòng | Mã | Năm | Dòng | Mã |
|---|---|---|---|---|---|
| 2011 | 134.547 | 563 | 2019 | 181.766 | 733 |
| 2012 | 133.823 | 557 | 2020 | 185.467 | 751 |
| 2013 | 188.868 | 853 | 2021 | 186.762 | 762 |
| 2014 | 137.497 | 578 | **2022** | **399.315** | **1.669** |
| 2015 | 143.371 | 753 | 2023 | 99.649 | 409 |
| 2016 | 74.734 | 305 | 2024 | 99.111 | 407 |
| 2017 | 164.476 | 689 | 2025 | 97.469 | 406 |
| 2018 | 81.901 | 332 | | | |

- Lô 2022 đầy đủ 3 sàn (HOSE 101.756 + HNX 83.650 + UPCOM 213.909) = 399.315 — khớp độ phủ 98,6% đã đo.

## Lô KHÔNG tải được (lỗi nguồn CafeF, KHÔNG phải code)
`HOSE 2016`, `HOSE 2018` (504 Gateway Timeout), `HOSE 2026` (400 Bad Request), `HNX 2012` (503/504), `UPCOM 2011/2014/2015` (504), `HNX/UPCOM nhiều năm sau phiên timeout` — dừng bulk để tránh rate-limit. Cần retry pacing ≥5 s ở M1+, không tự suy diễn dữ liệu thiếu.

## Ghi chú
- `change_pct` từ bulk vnbroker là **NULL** (frame vnbroker 3.9.0 không có cột này dù local parser có) — để M1 xử lý / retry bằng local XLSX cho cột này.
- Chưa đụng `DailyPrice`; chưa chạy S2–S7.
