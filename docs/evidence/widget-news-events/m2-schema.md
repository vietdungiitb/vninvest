# M2 — Schema migration (2026-11-25)

Branch `feat/price-mig-schema` · base dev `140c82f6d` (sau merge PR #524/#526) · claim mở lại.

## Thay đổi
- `market_data/models.py`: `DailyPrice.adj_factor` (Decimal 20,10 null) + `price_source` (CharField 32 default `vnbroker_legacy`, **không db_index**).
- Migration `0012_dailyprice_price_source_adj_factor.py` (do `makemigrations` sinh từ head có `0011_cafef_change_pct` — **không tự đặt số**): AddField ×2 + `RunPython(atomic=False)` + class `atomic = False` ⇒ `CREATE INDEX CONCURRENTLY IF NOT EXISTS market_data_dailyprice_source_idx`.

## Bẫy đã sửa
1. **Trùng số 0011** — lúc đầu dev chưa merge PR #524/#526 ⇒ `makemigrations` sinh 0011 đụng M0. Đã merge 2 PR, reset từ dev mới, sinh **0012**.
2. **`CREATE INDEX CONCURRENTLY cannot run inside a transaction block`** — `RunSQL` và `RunPython(atomic=False)` đều bị Django wrap. Cần thêm **`Migration.atomic = False`** ở class level. Đã sửa, apply OK.
3. Test DB không apply được concurrent index ⇒ test dùng `SimpleTestCase` (assert field/default/source code), verify index **trực tiếp trên staging**.

## Kết quả verify staging
- `manage.py makemigrations --check --dry-run market_data` → `No changes detected` (model khớp migration).
- `manage.py test market_data.tests.test_migration_schema_m2` → **3/3 OK**.
- `manage.py migrate market_data 0012` → **OK**.
- `pg_indexes`: `market_data_dailyprice_source_idx` tồn tại ✓
- `price_source`: 4.585.148 dòng, 100% `vnbroker_legacy` ✓
- `adj_factor`: 0 dòng có giá trị ✓ (chưa persist — đúng scope M2 chỉ schema).

Chưa đụng consumer, chưa ghi dữ liệu giá, chưa chạy S3c–S7.
