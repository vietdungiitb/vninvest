# Đánh giá mô hình raw/adjusted và sự phụ thuộc CafeF (2026-11-27)

## Nhận định cần đánh giá

> (a) raw_price giống nhau ở mọi nguồn, chỉ adjusted_price khác theo provider.
> (b) Giá hiển thị nên là giá đã hiệu chỉnh; raw chỉ để tham chiếu.
> (c) Có sự kiện chia cổ tức ⇒ phải hiệu chỉnh lại toàn bộ adjusted lịch sử đã lưu.
> (d) Phụ thuộc CafeF không ổn định ⇒ thiếu lịch sử ⇒ dữ liệu thiếu chính xác.

## Kết luận ngắn

- (a) **Sai về nguyên tắc, đúng về thực tế stack hiện tại** — và chính thực tế đó là gốc lỗi.
- (b) **Đúng là mục tiêu, nhưng chưa là thực tế** — DB đang lưu giá adjusted vào cột raw.
- (c) **Đúng về tài chính**, hạ tầng có sẵn nhưng đường tính bị tắt.
- (d) **Đúng**, đã có số liệu.

## (a) Raw có "giống mọi nguồn" không?

| Bằng chứng | Kết quả |
|---|---|
| `vnbroker/explorer/vci/quote.py:578-585`, `kbs/quote.py:438-445` | `adjusted=False` **đều gọi `_cafef_raw_records`** — VCI/KBS không có raw riêng trong stack này |
| Probe local 2026-01-05 TPB | CafeF raw `16600`, VCI `adjusted=False` `16600` — **giống nhau vì cùng một upstream CafeF**, không phải vì các provider có chung raw |
| Probe VCI vs KBS `adjusted=True` cùng ngày | VCI `13934.04`, KBS `13949` — **adjusted khác nhau thật theo provider** |

⇒ "raw giống nhau" ở đây là hệ quả của **độc quyền nguồn raw**, không phải tính chất tự nhiên. Khi CafeF chết, **không còn raw nào khác** — đây là điểm gãy. Với nguồn độc lập thật (DNSE/SSI/TCBS), raw có thể khác nhau do làm tròn/ngày giao dịch.

## (b) Giá hiển thị đang là adjusted chưa?

**Chưa.** `market_data/pricing.py:41-49`: flag off ⇒ trả `close`; flag on + `cafef` ⇒ trả `adj_close`. Staging `PRICE_ADJUSTED_DISPLAY=0` (probe `os.getenv`). DB TPB 2026-01-05: `close=13934.04` — **bằng đúng giá VCI adjusted**, `adj_close=NULL`, `price_source='vnbroker_legacy'`. Nghĩa là cột raw đang chứa giá đã hiệu chỉnh; consumer gọi nó là raw ⇒ **không trung thực về basis** (chart nhìn đầy đủ nhưng sai nhãn).

Đây chính là lý do `apply_adjustments` bị tắt (`corporate_actions/adjustment.py:3-5`): nguồn VCI/KBS đã trả adjusted ở cột `close`, tự nhân factor sẽ **double-adjust**.

## (c) Sự kiện công ty: hạ tầng có, nhưng đường ghi đang tắt

- Có sẵn: `DailyPrice.adj_as_of`, `adj_version`, `PriceRebaseRun`, `rebase_symbol_from_cafef`, beat rebase 19:00 / drift 20:00 (`models.py:90-97,610-646`, `settings.py:796-810`).
- `CORPORATE_ACTIONS_ENABLED=true` trên staging, nhưng `PRICE_ADJUSTMENT_WRITES_ENABLED` **unset** ⇒ `apply_adjustments()` trả **0 UPDATE** ngay đầu hàm (`adjustment.py:93-94`).
- `compute_adj_factors` lấy `_prev_close` từ `DailyPrice.close` (`adjustment.py:22-29`) — mà `close` hiện là adjusted ⇒ factoring từ cột này là sai nếu bật writes.

⇒ Nguyên tắc "recompute toàn chuỗi khi có ex-date" là đúng; đang dùng CafeF full-history rebase thay vì tự nhân factor. Muốn tự tính từ sự kiện phải **có raw thật** trước.

## (d) Phụ thuộc CafeF — số liệu thật

- `cafef_2026 = 0`; 1834 mã có dòng 2026: 963 mã toàn `unmapped_cafef`, 990 `vnbroker_legacy`, 1 `vnbroker_fallback` (AAH sau E2E).
- TPB: `cafef` dừng 2025-12-31; 223 dòng 2026 bị FE cắt nếu bật flag (`chartAdapter.js:80-92`).
- Probe VPS: đơn lẻ 503, bulk `failed after 3 attempts`, có lúc 200 nhưng rỗng.

## Hướng đi (cần owner chốt 1 trong 2)

**Phương án A — "provider-adjusted làm canonical" (đang đi theo fallback):**
Chấp nhận không có raw thật; `adj_close` = adjusted của KBS/VCI, `adj_factor=1`, nhãn `vnbroker_fallback`. Bỏ ý tưởng tự nhân factor. Rebase toàn chuỗi khi provider đổi adjusted. Ưu: chạy ngay. Nhược: không kiểm soát được logic điều chỉnh của provider; adjusted khác nhau giữa KBS/VCI.

**Phương án B — "raw thật làm SSOT, tự tính adjusted":**
Cần nguồn raw **độc lập CafeF** (DNSE/SSI/TCBS — hiện TCBS `ProviderAuthError`, DNSE/SSI thiếu credentials). Sau đó migrate `close` về raw thật, bật `PRICE_ADJUSTMENT_WRITES_ENABLED`, sửa `_prev_close` để không đọc adjusted, recompute `adj_close`/`adj_factor` cho toàn lịch sử. Ưu: kiểm soát được phép điều chỉnh. Nhược: blocker credentials + migration lớn.

**Không nên**: trộn hai basis trong cùng một symbol (đang bị gate chặn đúng) hay bật `PRICE_ADJUSTED_DISPLAY=1` trước khi parity — sẽ cắt đuôi chuỗi như đã chứng minh.

## Reservation

- Hành vi nối/fill nến trong package widget **CHƯA XÁC MINH** (dist minified).
- Không đổi source/flag trong slice này — chỉ đánh giá.
