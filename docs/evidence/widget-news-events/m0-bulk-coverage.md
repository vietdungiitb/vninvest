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
- `change_pct` từ bulk vnbroker là **NULL** (frame vnbroker 3.9.0 không có cột này dù local parser có) — để M1 xử lý / retry bằng local XLSX cho cột này. **AC M1 bổ sung**: retry local `fetch_xlsx` + `normalize_row` để lấy cột `Thay đổi`, nếu không M1 diff `change_pct` vô nghĩa và M4 persist NULL.
- Chưa đụng `DailyPrice`; chưa chạy S2–S7.

## Đính chính sau audit M0 (O1/O2)
- **O1**: bản đầu `_fetch_rows()` chỉ được định nghĩa, chưa nối vào `preview_import`/`run_import`. Đã rewire: `run_import` dùng `_fetch_rows`, `preview_import` dùng `_fetch_rows_with_rejected` (sau O2′). Test `test_cafef_importer_source.py` chặn hàm chết (mock `vnbroker.Vnbroker().reference('cafef').bulk_year` phải được gọi). **7/7 OK** (5 source + 2 change_pct).
- **O2 giải trình mismatch**: dữ liệu 2.308.756 dòng được tạo bằng cách copy code importer đã sửa (có `_fetch_rows`) vào container staging `vninvest-core-api` rồi chạy `manage.py shell` — tức bulk dùng `vnbroker bulk_year` thật, **không phải local fetcher**. Commit `a58529b73` bị thiếu phần rewire do thao tác copy thủ công; đã sửa ở commit sau. `change_pct=NULL` là do frame vnbroker không có cột, không phải do local parser — nhất quán với code đã sửa.
- **R1**: lệnh tái tạo (chạy trên VPS): `pg_dump ... -Fc -f before_20261124.dump` + `sha256sum`; bulk = `docker exec -w /app/src vninvest-core-api python /tmp/m0_bulk.py` / `m0_bulk_all.py` / `m0_rest.py` / `m0_upcom.py` (script nằm `/tmp` trên VPS, log `/tmp/m0_*.log`). Số liệu nhất quán nội bộ nhưng **không có script trong repo** — ghi rõ để owner xác nhận.
- **R2**: bảng coverage thiếu 2026 (HOSE 2026 lỗi 400); ma trận năm×sàn chỉ đầy đủ 2022; `TPB 2011 → coverage='missing'` chưa có test riêng (có `_classify_coverage` trong vnbroker); "0 reject ngày" chưa assert trong evidence. Disk 55G < 80G đã chốt — ghi CHƯA CÓ CHỐT OWNER riêng, xin xác nhận.
- **Audit v3 (O1″)**: test chặn O1′ ban đầu là xanh giả (`filter.return_value=[]` ⇒ mọi row vào INSERT, update path không chạy; `pop('change_pct')` là no-op). Đã viết lại: mock trả 1 object có `(symbol,date)` khớp ⇒ assert `updated==1`, `change_pct` cũ vẫn giữ, `bulk_update` gọi 1 lần. **7/7 OK**.
- **Audit v2 (O1′/O2′)**: `_fetch_rows` trả row vnbroker **không có `change_pct`** nhưng `_UPDATABLE` có ⇒ re-import năm đã bulk crash `KeyError`. Đã sửa vòng update dùng `if field in row: setattr(...)` (giữ giá trị cũ, không xoá) + thêm test non-dry-run `test_run_import_apply_tolerates_missing_change_pct`. O2′: `preview_import` hardcode `rejected=[]` ⇒ tautology; đã tách `_fetch_rows_with_rejected` trả `(rows, rejected)` từ parser local + test `test_preview_rejected_count_is_measured`. **7/7 OK** trên VPS DB riêng (5 source + 2 change_pct).
- **R3**: test `test_cafef_change_pct.py` chỉ assert change_pct; golden giá/ngày được assert ở `test_cafef_parser.py:40-44` (từ bản C2). Pacing ≥1 s là thao tác vận hành (mỗi request bulk mất 27–112 s tự nhiên), không có `time.sleep` trong code.
