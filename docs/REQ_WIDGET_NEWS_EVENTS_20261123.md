# REQ gửi đội code `vninvestcharts-widget` — News & Corporate Events (đợt 2026-11-23)

> Người gửi: team vninvest (slice `widget-news-events`, `docs/PLAN_WIDGET_NEWS_EVENTS_API_20261123.md`)
> Căn cứ probe: `docs/evidence/widget-news-events/call-path.md` (đọc source bundle `widget@0.4.7-ent`).
> Phía vninvest làm trước (không chờ widget): `GET .../stocks/{symbol}/corporate-actions/` + `fetchCorporateEvents` trên adapter (overlay chạy ngay, `live`, không mock). Hai yêu cầu dưới đây là phần widget còn thiếu để tính năng "đồng bộ, hiệu quả".

## RQ-1 — Consumer UI cho `fetchSymbolNews` (thiếu thật, cần đội widget làm hoặc chỉ chỗ có sẵn)

- **Hiện trạng (đã verify source):** `EnterpriseDataAdapter.fetchSymbolNews?(symbol, limit?) → NewsItem[] | null` tồn tại trong contract (`dist/dts/lib/types/adapter.d.ts:46-77`); presence `kind:"host"` nhận diện được (`dist/index.js@153976`); `MultiSourceDataAdapter` đã route per-symbol (`vvia iife.js@2505803`). Nhưng grep toàn bundle ESM `fetchSymbolNews(` kèm ngoặc gọi = **0 hit** — không dock/panel nào gọi nó. Reference duy nhất là `CryptoCompareDataAdapter` (crypto demo).
- **Tác động:** vninvest cung cấp `fetchSymbolNews` xong thì capability bật nhưng user không thấy tin tức ở đâu — tính năng "có mà như không".
- **Yêu cầu (chọn 1 trong 2, trả lời bằng văn bản):**
  - (a) Nếu consumer đã tồn tại ở bản mới hơn/kênh khác: cho tên component + version xuất hiện + prop bật nó.
  - (b) Nếu chưa có: thêm news panel/dock đọc `EnterpriseDataAdapter.fetchSymbolNews(symbol, limit)` (tôn trọng `limit`, `publishedAt` ms epoch, `null` = empty state trung thực, không fallback mock ở `live`).
- **AC phía vninvest (kiểm được sau khi widget nâng cấp):** Given adapter có `fetchSymbolNews` trả N items, When mở panel tin tức của mã, Then thấy đúng N item (title/url/source khớp), limit được tôn trọng; Given adapter thiếu method, Then panel empty state, không crash, không dữ liệu bịa.

## RQ-2 — Tài liệu hóa 2 hành vi ngầm của corporate events (docs-only, không đổi code)

- **Hiện trạng:** `pK` (`dist/index.js@824141`) tự điền `timeIndex` bằng nến gần nhất theo `|bar.date − timestamp|` — host dev không biết nếu không đọc bundle minify; effect `@855651` bỏ qua events khi `plotData.length < 50` mà host không phân biệt được "không có event" vs "bị gate".
- **Yêu cầu:** bổ sung vào `CorporateEventsOverlay.d.ts` / `corporateEvents.d.ts` (hoặc docs driven): (1) `timeIndex` do widget tự tính từ `timestamp`/`date`, host không cần/không nên tự gán; (2) ngưỡng 50 bars có chủ ý gì, host-driven `corporateEvents` prop có bypass ngưỡng này không (source cho thấy có — xác nhận lại).
- **AC:** đọc `.d.ts` bản mới là đủ hiểu để implement host đúng, không cần mở bundle minify.

## Ngoài phạm vi (vninvest không yêu cầu)

- Đổi ngưỡng 50 bars, đổi type `D|E|N|S`, thêm field `CorporateEvent` — giữ nguyên để tương thích.
- Mock/demo (`F_`, `allowMockEvents`) giữ nguyên cho môi trường demo; production vninvest dùng `live`.
