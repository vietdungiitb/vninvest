# Fix E2E fallback — ORM object vào validate_fallback (2026-11-27)

## Fail-before (staging thật)

Sau PR #573 deploy `0840ef542`, chạy fallback AAH:

```
File "/app/src/market_data/cafef/fallback.py", line 48, in validate_fallback
    if any(str(r.get('price_source', '')).lower() == 'cafef' for r in old_rows):
AttributeError: 'DailyPrice' object has no attribute 'get'
```

Nguyên nhân: unit test dùng dict, nhưng `apply_provider_fallback` truyền **ORM model instance** (`DailyPrice`) cho `validate_fallback`. Đây là lỗi "test xanh nhưng E2E hỏng" — đúng L-V04/L-V01.

## Fix

- `fallback.py`: thêm `_field(row, name, default)` chấp nhận cả dict lẫn object; `validate_fallback` dùng `_field` cho `price_source`, `date`, `close`.
- TDD: test mới `test_validate_fallback_accepts_orm_like_rows` đỏ (`AttributeError`) trước, xanh sau. **8 passed** (6 fallback + 2 task).

## Kết quả E2E khác đã xác minh trong cùng lần chạy

- TPB: fallback trả `halted_data_error:cafef_rows_present` (**0 UPDATE**) — guard chống trộn basis chạy đúng; audit `failed`, detail ghi rõ.
- DB: 1834 mã có dòng 2026, 1345 mã có dòng `cafef`, **537 mã không có dòng cafef** (AAH/AAN/ABW/... ) — nhóm này là nơi fallback hoạt động an toàn.
- Hạn chế thiết kế: với mã **đã có** dòng `cafef` ở năm cũ, fallback mặc định **từ chối** để không trộn basis. Cần cơ chế "chuyển basis toàn chuỗi có kiểm soát" (force) nếu muốn fallback cho nhóm này — để lại slice riêng, không tự mở rộng.

## Verification

| Hạng mục | Kết quả |
|---|---|
| Unit 2 file | **8 passed** |
| Deploy + E2E AAH sau fix | **CHƯA CHẠY** (chờ PR merge) |
