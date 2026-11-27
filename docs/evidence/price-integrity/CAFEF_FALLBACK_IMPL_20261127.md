# Fallback CafeF — implement 2026-11-27

## B1 — bằng chứng (không đoán)

- VPS: `SINGLE ALL/TPB 503`, `bulk_year HOSE 2026 failed after 3 attempts`, `cafef_2026=0`.
- KBS/VCI `adjusted=False` vẫn gọi CafeF (`kbs/quote.py:438-445`, `vci/quote.py:578-585`) ⇒ **không có raw** khi CafeF chết.
- `KBS history(adjusted=True)` trả `['time','open','high','low','close','volume']`; TPB 2026-01-05 `close=13949` (đơn vị ×1000). DB staging `DailyPrice.close=13934.04` (VCI adjusted) ⇒ **không đổi đơn vị**.
- FE đã có nhãn `provider_adjusted_fallback` (`chartAdapter.js:90`) ⇒ **không sửa FE**.

## Thiết kế đã implement

| File | Nội dung |
|---|---|
| `market_data/cafef/fallback.py` (mới) | `fetch_provider_series()` (KBS mặc định, `adjusted=True`), `validate_fallback()` (fail-closed: `cafef_rows_present` / `insufficient_coverage` / `unsorted_series` / `nonpositive_price`), `apply_provider_fallback()` ghi `adj_close=provider_close`, `adj_factor=1`, `is_adjusted=True`, `price_source='vnbroker_fallback'`, `adj_as_of=now`, `adj_version=F+1` |
| `data_ingest/tasks.py` | `rebase_symbol_from_cafef` bắt `fetch_error` → gọi fallback; thành công trả `status='applied_fallback'` + audit `PriceRebaseRun.Status.APPLIED_FALLBACK`; thất bại vẫn `fetch_error` với `reason` gốc (chứa `503`) + `fallback_status`/`fallback_reason` |
| `market_data/models.py` | thêm `Status.APPLIED_FALLBACK` |
| `market_data/migrations/0014_alter_pricerebaserun_status.py` | do `makemigrations` sinh (không tự đặt số) |

**Nguyên tắc chống trộn basis:** `apply_provider_fallback` trả `halted_data_error:cafef_rows_present` nếu symbol còn bất kỳ dòng `price_source='cafef'`. Fallback chỉ ghi vào tập `exclude(price_source='cafef')`.

**Hạn chế trung thực:** đây là **provider-adjusted basis**, không phải CafeF SSOT. `close` giữ nguyên giá legacy (vốn đã là adjusted) — fallback không có raw để khôi phục. Khi CafeF hết block, job rebase chuẩn ghi đè lại toàn chuỗi.

## TDD

- Đỏ: `ModuleNotFoundError: market_data.cafef.fallback` + 3 task test fail.
- Xanh: **32 passed** (5 fallback + 2 task + 1 S4 bulk + 6 S4 safety + 14 integrity + 4 paced); `manage.py check` 0 issues.
- Sửa fixture hợp lệ (không ép test xanh): test S4 cũ mock thêm `apply_provider_fallback` vì hành vi `fetch_error` giờ gọi fallback; `reason` vẫn giữ `503` (root cause), fallback reason sang field riêng.

## Verification

| Hạng mục | Kết quả |
|---|---|
| Unit 6 file | **32 passed** |
| `manage.py check` / `makemigrations` | 0 issues / sinh 0014 |
| Deploy + E2E fallback thật 1 mã trên staging | **CHƯA CHẠY** (chờ PR merge) |
| Trạng thái flag | `PRICE_ADJUSTED_DISPLAY=0` — không đổi trong slice này |

## Next steps

1. Merge → deploy → chạy `rebase_symbol_from_cafef('TPB', from_year=2026)` trên staging (CafeF 503 ⇒ fallback KBS).
2. Verify `adj_close>0`, `price_source='vnbroker_fallback'`, audit `applied_fallback`, `check_price_integrity` vẫn ok.
3. Chỉ bật `PRICE_ADJUSTED_DISPLAY=1` sau khi FE hiển thị nhãn fallback đúng.
