# Fix coverage scope cho fallback — 2026-11-27

## Fail-before (E2E staging)

Sau PR #574 deploy, `rebase_symbol_from_cafef('AAH', from_year=2026)` trả:
`fallback_status='halted_data_error'`, `fallback_reason='insufficient_coverage'`, 0 UPDATE.
Trong khi probe provider trực tiếp: `fetch_provider_series('AAH', 2026-01-01, 2026-11-27)` = **223 dòng**, DB có **222 dòng 2026**.

Root cause: `apply_provider_fallback` lấy `old_rows` = **toàn bộ lịch sử** mã (hàng ngàn dòng từ 2011), rồi so coverage với 223 dòng chỉ của năm 2026 → luôn <95%.

## Fix

`market_data/cafef/fallback.py`: scope `old_qs` theo `date__gte=date(from_year,1,1)` trước khi đếm coverage. **Guard `cafef_rows_present` vẫn kiểm tra toàn chuỗi** — không nới lỏng chống trộn basis.

TDD: test mới `test_fallback_scope.py` đỏ (`halted_data_error`) → **9 passed** (1 scope + 6 fallback + 2 task).

## Verification

| Hạng mục | Kết quả |
|---|---|
| Unit 3 file | **9 passed** |
| E2E AAH sau fix | **CHƯA CHẠY** (chờ PR merge + deploy) |
| E2E TPB (có dòng cafef cũ) | Đã chạy: guard `cafef_rows_present` chặn đúng, 0 UPDATE |
