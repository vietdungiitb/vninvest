# Đính chính: giá tham chiếu/trần/sàn dùng GIÁ ĐÃ ĐIỀU CHỈNH (2026-11-27)

## Bằng chứng thật — FPT, ex-date 2026-11-27

| Nguồn | Giá 2026-11-26 (phiên trước ex-date) |
|---|---|
| VCI `adjusted=False` | **44500** (raw) |
| VCI `adjusted=True` | **43498.75** (adjusted) |
| `CorporateAction` FPT 2026-11-27 | `DIV`, `cash_amount_per_share=1000 VND` |
| `DailyPrice.close` staging | **43500** ≈ adjusted (legacy writer đã ghi adjusted vào cột close) |

`SymbolSnapshot` ngày 2026-11-27: `reference_price=43500`, `ceiling=46500`, `floor=40500`, `price=44600`.

⇒ 44500 − 1000 = 43500. **Giá tham chiếu ngày ex-date là giá đã điều chỉnh**, không phải giá thô. Kết luận này **đính chính** đoạn "trần/sàn nên dùng raw" trong `RAW_USAGE_SCAN_20261127.md` (Entry 672) — đoạn đó SAI.

## Hệ quả cho hệ thống

- Nguyên tắc đúng: **mọi consumer hiển thị/tham chiếu dùng `DailyPrice.adj_close`** (giá đã điều chỉnh); `close` chỉ là dữ liệu tham khảo nguồn.
- `market_serving/vnbroker_materializer.py:101-109` hiện dùng `yesterday_price.close`, đang **may mà đúng** vì cột `close` đã bị ô nhiễm bởi giá adjusted legacy. Nếu migrate `close` về raw thật mà không đổi consumer này ⇒ **sai trần/sàn ngay**.
- `pricing.py:41-49` flag off trả `close` — cũng đang may mà đúng vì lý do trên.
- Đây là rủi ro tiềm ẩn lớn hơn cả lỗi CafeF: hệ thống **đúng nhờ dữ liệu sai**.

## Blockers trước khi chuyển sang `adj_close`

- `adj_close` staging: 1.904.709 dòng non-null (chủ yếu cũ), nhưng **2026 chỉ có 222 dòng** (AAH fallback). Chuyển consumer sang `adj_close` ngay ⇒ 2026 gần như trống.
- Cần một trong hai:
  1. Fill `adj_close` cho toàn bộ dòng 2026 từ giá adjusted của provider (`adj_close = close`, `adj_factor=1`, gắn nhãn `vnbroker_fallback`/legacy), kèm backup + batch + gate — **thao tác dữ liệu lớn trên staging dùng chung, cần owner chốt**.
  2. Hoặc backfill CafeF 2011–2026 rồi rebase chuẩn (hiện CafeF vẫn 503/rỗng từ IP VPS).

## Khuyến nghị

1. Sửa `effective_close`/`effective_ohlc`: ưu tiên `adj_close` cho mọi nguồn, fallback có nhãn khi NULL.
2. Sửa materializer: `reference_price = effective_close(yesterday)`.
3. Chỉ fill dữ liệu sau khi có backup + xác nhận owner; không bật flag trước khi parity.

## Không làm trong slice này

Chỉ đính chính tài liệu — chưa đổi code/data.
