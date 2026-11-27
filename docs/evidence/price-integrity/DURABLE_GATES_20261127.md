# Durable data-integrity gates — 2026-11-27 (slice `price-integrity`)

## Phạm vi & mục tiêu

Làm triệt để các lỗi dữ liệu đã lặp lại trong chuỗi price-rebase: basis trộn
(433.373 dòng `adj_close` tàn dư), crash import do frame vnbroker 3.10, 503 do
burst CafeF, và rebase ghi dữ liệu hỏng. Mục tiêu: **mọi bất biến được mã hoá
một chỗ, chạy lại được ở write-path, ops/CI và beat**.

## Nguyên nhân gốc & cách khoá

| Lỗi đã gặp | Điểm khoá (file:line) | Cơ chế |
|---|---|---|
| `adj_close` tàn dư trên dòng legacy / unmapped | `market_data/cafef/integrity.py:21` (`residual_adjusted_legacy`, `unmapped_with_adjustment`) | audit trả violation; `assert_integrity` chặn write |
| Hệ số ngoài `[0.01, 1.05]`, lệch tỉ lệ `adj_close/close` | `integrity.py:21` (`factor_out_of_bounds`, `factor_close_mismatch`, `orphan_adjustment`) | cùng gate, dùng chung cho rebase |
| Rebase trộn basis `cafef` + legacy trong cùng mã | `integrity.py:21` (`mixed_basis_symbol`) | phát hiện theo symbol |
| Import crash `CafefDailyPrice(**row)` do field widget-only | `market_data/cafef/importer.py` `normalize_row()` | lọc 11 field model, bỏ `time/open/.../fetched_at` |
| CafeF 503 theo IP burst (cả cửa sổ 1 tháng vẫn 503) | `importer.py` `fetch_year_paced()` | backoff `min(base × 2^n, 120)`, 4 lần; `use_cache=False`, clamp `end_date` |
| Fallback XLSX gửi `EndDate=12/31` cho năm hiện tại → 503 thật (đã đo) | `market_data/cafef/fetcher.py` `resolve_end()` | clamp về `date.today()`; TDD 3/3 |
| 16 năm ALL-export gọi liên tục trong rebase | `data_ingest/tasks.py::rebase_symbol_from_cafef` | dùng `fetch_year_paced` + nhịp 3s giữa các năm |
| Sleep dài chạy ở request path | `data_ingest/tasks.py::import_cafef_year_paced` | task Celery queue offhours; `CAFEF_BACKOFF_BASE=0` chỉ trong test (`backend/conftest.py`) |
| Không phát hiện sớm violations | `settings.py` `audit-price-integrity-2100` + `tasks.py::audit_price_integrity_nightly` | beat 21:00 sau drift 20:00, log warning, không sửa dữ liệu |
| Ops/CI không có gate chạy lại | `market_data/management/commands/check_price_integrity.py` | `python manage.py check_price_integrity --since 2026-01-01`; exit 1 nếu có violation |

## SSOT

`market_data/cafef/integrity.py` là nguồn duy nhất của 7 violation code. Ba caller
cùng gọi một hàm `audit_rows`:

1. `assert_integrity()` — fail-closed trong `rebase_symbol_from_cafef` trước `bulk_update`;
2. `check_price_integrity` command — con người/CI chạy lại bất cứ lúc nào;
3. `audit_price_integrity_nightly` — beat phát hiện sớm.

`collect_rows()` là adapter DB mỏng, tách riêng để phần kiểm tra là hàm thuần
(test được không cần DB/network).

## TDD fail-before

- Đỏ: 3 file test mới import `fetch_year_paced` / `normalize_row` / integrity
  → `ImportError` (3 collection errors).
- Sau khi implement: **35 passed** (8 file: 14 integrity + 1 normalize + 4 paced +
  3 fetcher-end-date + 3 command + 3 task + 1 S4 bulk-fetch + 6 S4 safety), `manage.py check` →
  `System check identified no issues (0 silenced)`.
- Bẫy đã sửa trong lúc chạy: thay `bulk_year` bằng reference-method làm mất patch
  target của test S4 (`vnbroker.reference.client.bulk_year`) và backoff 70s chạy
  thật → test treo. Đổi sang gọi hàm module-level (`cafef_client.bulk_year`) và
  tắt delay bằng env trong `backend/conftest.py`; S4 test lại xanh trong 1.8s.

## Verification trạng thái

| Hạng mục | Kết quả |
|---|---|
| Unit gate 8 file | **35 passed** |
| `manage.py check` | **0 issues** |
| Deploy staging + chạy `check_price_integrity` thật | **ĐÃ CHẠY 2026-11-27**: `dev@7d91adf0a`, `{"ok":true,"violations":[],"rows":281221,"cafef_rows":0}`, exit 0. `cafef_rows=0` phản ánh backfill 2026 chưa xong; flag vẫn `0`. Chi tiết `CURSOR_FIX_20261127.md` |
| Backfill 2011–2026 | **CHƯA XONG** — CafeF bulk vẫn 503 từ IP VPS (xem `../price-rebase-s5/CAFEF_BLOCK_WATCH_20261127.md`) |
| Fallback VCI/KBS có nhãn | **CHƯA IMPLEMENT** (thiết kế tại `CAFEF_FALLBACK_ANALYSIS_20261127.md`) |

## Next steps / owner

1. PR nhánh này vào `dev`, deploy staging.
2. Chạy `python manage.py check_price_integrity --since 2026-01-01` trên staging,
   ghi violation code thật vào file này.
3. Chạy `import_cafef_year_paced` từ Celery (không request path) khi CafeF hết 503;
   sau đó backfill 2011–2026.
4. Fallback VCI/KBS có nhãn `vnbroker_fallback` là slice riêng; không trộn basis.
