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
- RED: 1 fail (`[<DailyPrice: TPB 2022-01-04 close=1.5>] != []`) → GREEN **5/5**.
- Lưu ý: container staging có `tasks.py` cũ (chưa deploy M3) — phải copy code worktree vào container trước khi chạy, nếu không cả test `'cafef'` cũ cũng fail (đã kiểm chứng).
- Regression `data_ingest`: **52 test OK** (exit 1 chỉ do teardown `test_vninvest_core is being accessed by other users`, pre-existing).

## 3. Phạm vi
Chưa resume beat, chưa bật `PRICE_ADJUSTED_DISPLAY`, chưa apply M4 cho sàn/năm khác. Guard chỉ là điều kiện cần trước ops window.
