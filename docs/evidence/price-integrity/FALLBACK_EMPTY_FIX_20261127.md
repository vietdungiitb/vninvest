# Fix fallback khi CafeF trả rỗng — 2026-11-27

## Fail-before

E2E AAH sau PR #575: CafeF trả 200 nhưng rỗng ⇒ `rebase_symbol_from_cafef` trả `no_data`, **fallback không được gọi** (chỉ xử lý exception). Unit test mới `test_fallback_empty.py` đỏ: `no_data != applied_fallback`.

## Fix

`data_ingest/tasks.py`: nhánh `if not new_rows` cũng gọi `apply_provider_fallback`; thành công ⇒ `status='applied_fallback'` + audit, thất bại ⇒ `no_data` kèm `fallback_status`/`fallback_reason`.

TDD: **9 passed** (1 empty + 2 task + 6 fallback).

## Verification

| Hạng mục | Kết quả |
|---|---|
| Unit 3 file | **9 passed** |
| E2E AAH sau fix | **CHƯA CHẠY** (chờ PR merge + deploy) |
