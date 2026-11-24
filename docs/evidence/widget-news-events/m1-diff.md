# M1 — Dry-run diff 2022 (2026-11-24)

Branch `feat/price-mig-diff` · Plan `PLAN_PRICE_MIGRATION_IMPLEMENTATION_20261124.md` · KHÔNG ghi DB.

## Code
- `market_data/cafef/diff.py`: `diff_row` (7 field + ratio + unit_suspected), `classify_db_only`, `ratio_stats` (REBASE_SHIFT vs DATA_ERROR). Test **7/7 OK**.
- `management/commands/price_migration_diff.py`: 2 pass keyset-pagination (O(batch) RAM) vì `iterator()` lỗi pgbouncer `InvalidCursorName`, `list()` OOM (exit 137).

## Kết quả thật 2022 (lệnh `manage.py price_migration_diff --year 2022 --out /tmp/m1_full.json`)
| Chỉ số | Giá trị |
|---|---|
| legacy_rows | 365.459 |
| cafef_rows | 399.315 |
| **matched** | **360.329** (khớp 98,6% đã đo) |
| DB-only | 5.130 (1,4%) — phân loại: legacy_garbage 5.128, delisted_or_etf 2 |
| CafeF-only | 38.986 (sẽ INSERT ở M4, lưu `inserted_keys`) |
| adj_close_missing | 0 |
| halt | **True** — `ratio mean 1,83 / std 15,45` do spike lẻ ⇒ DATA_ERROR theo tiêu chí, phải phân loại trước khi apply |
| fields_changed | close 262.258 · adj_close/open/high/low/volume/value 360.329 (mọi field đều đổi) |
| fingerprint | `96f4ba51309dd038` |

## Phân loại DB-only — CẦN OWNER
`classify_db_only` chỉ tự nhận diện được benchmark (VNINDEX/VN30/HNXINDEX...) theo tên; 2 nhóm còn lại (huỷ niêm yết/ETF vs rác) **không tự đoán** — báo cáo sample 20 cặp để owner duyệt. ⚠ Phát hiện: `VNINDEX` không nằm trong 5.130 DB-only 2022 ⇒ `_benchmark_returns` đọc từ bảng khác hoặc CafeF có trả chỉ số — **CHƯA XÁC MINH**, phải kiểm trước M4.

## Nợ chuyển sang M4
- `change_pct` vẫn NULL (frame vnbroker không có cột) — retry local XLSX chưa làm; M4 diff field này vô nghĩa nếu không retry.
- `halt=True` do spike: chưa phân loại từng spike theo `CorporateAction` ex-date — phải rút gọn thành REBASE_SHIFT (warn) trước khi apply (tiêu chí đã chốt §0.5).
- Sample `close_ratio` cực đại cần liệt kê để xác nhận không phải lỗi unit.

Chưa đụng `DailyPrice`; chưa chạy S3–S7.
