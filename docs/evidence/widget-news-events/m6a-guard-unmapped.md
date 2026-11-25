# M6a — Guard ingest chặn ghi đè `unmapped_cafef` (2026-11-25)

> Branch `feat/price-mig-guard-unmapped` · Entry 636 · Claim `price-mig-guard-unmapped`.
> Lý do: 298 dòng HOSE 2022 có `price_source='unmapped_cafef'` (CafeF thiếu, `adj_close` hỏng đã dọn NULL). Guard M3 cũ chỉ chặn `'cafef'` ⇒ nếu resume beat, provider sẽ ghi đè trả lại giá đã điều chỉnh (double-adjust).

## 1. Thay đổi
`data_ingest/tasks.py` `_classify_daily_price_rows`:
```python
if existing.get('price_source') in ('cafef', 'unmapped_cafef'):
    skipped_existing += 1
    continue
```
Test mới `data_ingest/tests/test_price_source_guard.py::test_unmapped_cafef_row_is_also_skipped`.

## 2. Gate
Lệnh tái tạo (trên VPS, sau `docker cp` code worktree vào container):
```
docker exec -e CORPORATE_ACTIONS_ENABLED=false -w /app/src vninvest-core-api \
  python manage.py test data_ingest.tests.test_price_source_guard -v 1
docker exec -e CORPORATE_ACTIONS_ENABLED=false \
  -e DATABASE_URL='postgresql://vninvest:***@172.19.0.7:5432/vninvest_core' \
  -w /app/src vninvest-core-api python manage.py test data_ingest -v 1 --noinput
```
- RED: 1 fail (`[<DailyPrice: TPB 2022-01-04 close=1.5>] != []`) → GREEN **5/5** (`Ran 5 tests … OK`).
- Lưu ý: container staging có `tasks.py` cũ (chưa deploy M3) — phải copy code worktree vào container trước khi chạy, nếu không cả test `'cafef'` cũ cũng fail (đã kiểm chứng).
- Regression `data_ingest`: `Ran 52 tests in 7.130s` / **OK** (exit 1 chỉ do teardown `test_vninvest_core is being accessed by other users`, pre-existing — đối chiếu `m3-guard.md:15`).

## 3. Phạm vi
Chưa resume beat, chưa bật `PRICE_ADJUSTED_DISPLAY`, chưa apply M4 cho sàn/năm khác. Guard chỉ là điều kiện cần trước ops window.
