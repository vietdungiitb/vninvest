# Khi CafeF block: chart hiển thị lịch sử bị thiếu thế nào? (2026-11-27)

## Trace code (BE → FE → widget)

| Bước | file:line | Hành vi |
|---|---|---|
| BE `/chart/` daily | `market_data/stock_mgmt_native_views.py:2053-2056` | `DailyPrice.objects.filter(symbol, date__range=(start,end))` — **chỉ trả row có trong DB, KHÔNG fill ngày thiếu** |
| BE flag | `:2068` | `adjusted_display = pilot_adjusted_enabled()` — flag global `PRICE_ADJUSTED_DISPLAY` |
| FE lọc | `adapters/chartAdapter.js:67-69` | Khi `adjusted=true`: **bỏ toàn bộ row `price_source='unmapped_cafef'`** |
| FE basis | `:80-92` | Có ≥1 row `cafef` ⇒ `basis='adjusted'`, `visible = cafefRows` (bỏ mọi row nguồn khác, note `mixed_sources_dropped_legacy`); không có ⇒ `basis='provider_adjusted_fallback'` (note `no_cafef_source`) |
| FE scale | `:42-62` | Chỉ scale O/H/L/C khi `price_source==='cafef'` và có `adj_factor`/`adj_close`; fallback dùng nguyên `close` |
| Widget | `VNStockChartPanel.js` / package `vninvestcharts-widget` | Nhận số nến làm từ `parseBars` rồi truyền vào widget; **hành vi fill ngày trống bên trong package chưa xác minh** (dist minified — không suy diễn) |

## Số liệu thật trên staging `dev@0a0f71a7c`

- 1834 mã có dòng 2026. Trong đó: `cafef=0`, `unmapped_cafef=963`, `vnbroker_legacy=990`, `vnbroker_fallback=1` (AAH sau E2E).
- TPB: 1746 dòng `cafef`, ngày cuối **2025-12-31**; 223 dòng `vnbroker_legacy` trong 2026.
- TPB cửa sổ `2025-12-01..2026-11-27`: 23 dòng `cafef` + 223 dòng legacy. Với flag=1, FE chỉ giữ **23 dòng cafef** → chart **dừng ở 2025-12-31**, ~11 tháng cuối biến mất.
- A32 cùng cửa sổ: 187 dòng, 0 `cafef` → flag=1 vẫn hiển thị 187 dòng (basis `provider_adjusted_fallback`), không mất.
- 963 mã có 2026 toàn `unmapped_cafef` ⇒ khi bật flag=1, các dòng đó bị lọc; nếu mã không có row nguồn khác trong cửa sổ thì **trống chart** trong đoạn đó. (Diện rộng 2025+: 1014 mã, 0 mã trống hoàn toàn vì vẫn còn row legacy cũ — nhưng phần 2026 bị cắt.)

## Ba kịch bản người dùng thấy gì

1. **Flag `0` (hiện tại)**: BE trả mọi row có trong DB; FE không lọc; chart có nến ở những ngày có dữ liệu, **không có nến giả cho ngày thiếu**. Với mã chưa backfill, `close` là giá provider-adjusted cũ nhưng bị gắn nhãn raw — hiển thị "bình thường" nhưng **không trung thực về basis**, không phải ô trống.
2. **Flag `1`, mã đã có dòng `cafef` (1345 mã)**: FE giữ riêng dòng `cafef`; mọi dòng 2026 (`vnbroker_legacy`/`unmapped`) bị bỏ → **đứt gãy ở rìa phải**, ví dụ TPB dừng 2025-12-31. Đây là rủi ro "ngắt quãng adj_close" đã hỏi từ đầu.
3. **Flag `1`, mã không có dòng `cafef`**: nếu đã fallback (`vnbroker_fallback`, như AAH) → vẫn hiện đủ nến + nhãn `provider_adjusted_fallback`; nếu chưa fallback và row là `unmapped_cafef` → bị lọc, chart **trống đoạn đó**.

## Kết luận

- CafeF block **không làm mất dữ liệu đã lưu**, cũng không tự làm chart blank ở flag=0.
- Ngắt quãng xảy ra **khi bật flag=1 trong lúc dữ liệu chưa parity**: FE cố tình chỉ giữ một basis duy nhất nên cắt đuôi chuỗi 2026.
- Trạng thái an toàn hiện tại: giữ `PRICE_ADJUSTED_DISPLAY=0` cho tới khi backfill/rebase 2026 xong, hoặc fallback có nhãn cho toàn bộ mã.
- Lỗi browser E2E ("Đang tải biểu đồ…") là baseline widget riêng, **không phải** hệ quả của việc thiếu dữ liệu CafeF.

## Ghi chú probe

Lần đầu dùng `.iterator()` trong script probe này cũng trả `InvalidCursorName` — tái khẳng định lý do đã fix `collect_rows` sang keyset. Lần sau dùng client-side iteration thì chạy bình thường.
