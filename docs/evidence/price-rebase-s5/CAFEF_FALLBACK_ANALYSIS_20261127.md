# Phân tích — CafeF bị block có tự chuyển KBS/VCI? (2026-11-27)

## Câu hỏi
1. Có cơ chế tự động chuyển sang KBS/VCI khi CafeF bị chặn không?
2. Có bị ngắt quãng `adj_close` → không hiển thị được chart không?

## 1. Auto-fallback: KHÔNG có

| Bằng chứng | Hành vi |
|---|---|
| `vnbroker/reference/cafef.py:23-28` | `CafefReference` **cố tình KHÔNG** đăng ký `ProviderRegistry`, **không vào AUTO failover pool**. |
| `data_ingest/tasks.py:3550-3558` (`rebase_symbol_from_cafef`) | `bulk_year` lỗi → trả `{'status':'fetch_error'}`; **không thử provider khác**, không ghi DB. |
| `data_ingest/tasks.py:724-728` (`backfill_daily_prices`) | Guard skip dòng `price_source in ('cafef','unmapped_cafef')` — writer VCI/KBS **không bao giờ** tự sửa dòng CafeF. |
| `vnbroker/explorer/vci/quote.py:548-550` · `kbs/quote.py:317-323` | VCI/KBS public API **chỉ phục vụ giá đã điều chỉnh**; muốn raw phải route sang CafeF. |

⇒ KBS/VCI không thể thay CafeF "nguyên xi": chúng không có cột raw, nên không tạo được cặp `close` (raw) + `adj_close` theo contract hiện tại. Muốn fallback phải đổi **basis cả chuỗi** sang `provider_adjusted` và gắn nhãn, không được trộn từng ngày.

## 2. Ngắt quãng adj_close / chart

- Giá điều chỉnh nằm **trong DB** (`DailyPrice.adj_close`), chart đọc qua `market_data/pricing.py:29-74`. Provider bị block **không xóa** giá đã lưu ⇒ chart không tắt ngay vì lý do này.
- Rủi ro thật: (a) sự kiện ex-date mới không rebase được ⇒ chuỗi cũ bị stale; (b) dòng 2026 hiện `price_source='unmapped_cafef'`/legacy (0 dòng `cafef`); nếu bật `PRICE_ADJUSTED_DISPLAY=1`, consumer loại `unmapped_cafef` (`chartAdapter.js` filter) ⇒ **blank chart cho mã đó**.
- Staging hiện `PRICE_ADJUSTED_DISPLAY=0` (probe 2026-11-27) ⇒ consumer đọc raw close, chart không blank.
- Khi fallback chưa có, trạng thái an toàn là giữ flag `0` cho đến khi backfill/rebase xong.

## 3. Thiết kế fallback đề xuất (chưa implement)

1. Trong `rebase_symbol_from_cafef`, bắt `fetch_error` → thử `Vnbroker().stock(symbol, 'VCI').quote.history(..., adjusted=True)` (hoặc KBS), lấy chuỗi adjusted của provider.
2. Ghi **toàn bộ** ngày của symbol với `price_source='vnbroker_fallback'`, `adj_as_of=now`, `adj_version += 1`; **KHÔNG trộn** với dòng `cafef` còn sót.
3. Gắn `price_basis='provider_adjusted_fallback'` trong payload/FE để UI hiện nhãn trung thực.
4. Khi CafeF hết block, job rebase chuẩn ghi đè lại toàn chuỗi về basis CafeF (và tăng `adj_version`).
5. Test fail-before: mock `bulk_year` raise → assert fallback được gọi, `status='applied_fallback'`, 0 dòng mixed; E2E: chart vẫn render với nhãn fallback.

**Lưu ý**: VCI/KBS cũng có rate-limit (đã ghi nhận 418 ở `docs/evidence/corporate-actions/ALL_SYMBOLS_SYNC_20261121.md:102-108`) ⇒ fallback chỉ là cầu nối, không thay SSOT.
