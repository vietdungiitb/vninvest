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
| fields_changed | close 262.258 · adj_close 360.329 · **open/high/low/volume/value 360.329 (ARTIFACT — KHÔNG phải kết quả đo)** |

⚠ **R1 (audit)**: pass 1 của command chỉ lưu `close` + `adj_close` (`price_migration_diff.py:45-48`), pass 2 set 5 field kia `=None` (`:71-72`) ⇒ `diff_row` luôn flag "changed" cho 100% matched. Số 360.329 của 5 field sau là artifact so sánh với `None`, **không được hiểu là "mọi field đều đổi"**. Muốn đo thật 7 field phải mở rộng pass 1 lưu đủ 7 field (việc của slice sau). AC M1 chỉ cần matched/halt/nhóm — không bị ảnh hưởng.
| fingerprint | `96f4ba51309dd038` |

## Phân loại DB-only — CẦN OWNER
⚠ **R2 (audit)**: `classify_db_only` (`diff.py:62-69`) thực tế **tự gán cả 3 nhóm** bằng heuristic (`len>10 → delisted_or_etf`, catch-all `→ legacy_garbage`). Kết quả `5.128 legacy_garbage + 2 delisted_or_etf` là **heuristic, không phải xác minh** — sample 20 cặp vẫn được giữ để owner duyệt. Test `test:57` assert `ABC → legacy_garbage` phản ánh đúng heuristic này (comment "KHÔNG đoán" trong test là stale). Không tự khẳng định đã phân loại đúng thực tế. ⚠ Phát hiện: `VNINDEX` không nằm trong 5.130 DB-only 2022 ⇒ `_benchmark_returns` đọc từ bảng khác hoặc CafeF có trả chỉ số — **CHƯA XÁC MINH**, phải kiểm trước M4.

## Nợ chuyển sang M4
- `change_pct` vẫn NULL (frame vnbroker không có cột) — retry local XLSX chưa làm; M4 diff field này vô nghĩa nếu không retry.
- `halt=True` do spike: chưa phân loại từng spike theo `CorporateAction` ex-date — phải rút gọn thành REBASE_SHIFT (warn) trước khi apply (tiêu chí đã chốt §0.5).
- Sample `close_ratio` cực đại cần liệt kê để xác nhận không phải lỗi unit.

- **R3 (audit)**: plan M1.2 yêu cầu `migration-diff.json` trong repo — đã copy report thật từ VPS về `docs/evidence/widget-news-events/migration-diff-2022.json` (fingerprint `96f4ba51309dd038`, copy từ `/tmp/m1_full.json` trên VPS).

Chưa đụng `DailyPrice`; chưa chạy S3–S7.
