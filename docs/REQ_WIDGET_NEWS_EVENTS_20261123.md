# Báo cáo gửi đội code `vninvestcharts-widget` — Nâng cấp tính năng News & Events (đợt 2026-11-23)

> Người gửi: team vninvest (slice `widget-news-events`, branch `feat/widget-news-events`, PR #518)
> Phiên bản widget đang tích hợp: `@vninvestcharts/widget@0.4.7-ent` (file: `packages/web/vendor/vninvestcharts-widget-0.4.7-ent.tgz`)
> Căn cứ probe: `docs/evidence/widget-news-events/call-path.md` — đọc source bundle thật (`dist/index.js`, 1.279.153 bytes), không đoán từ tên hàm.

## 1. Hiện trạng vninvest (đã sẵn sàng phía backend)

- `vninvest` đã cung cấp endpoint corporate actions thật cho widget:
  - `GET /core/v1/stock-management/stocks/{symbol}/corporate-actions/?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N` (Task 1, PR #518).
  - Nguồn: bảng `CorporateAction` (VCI ingest nightly, `is_latest=true`), dữ liệu thật (DIV/ISS), số là số, ngày ISO, không bịa.
  - Adapter vninvest đã implement `fetchCorporateEvents(symbol, fromMs, toMs)` → `CorporateEvent[]` (mode `live`).
- `fetchSymbolNews(symbol, limit?) → NewsItem[]|null` đã wire trên enterprise adapter (chỉ bật presence), vì bundle widget hiện **không có consumer UI** nào gọi nó.

## 2. Gap phía widget (cần đội widget nâng cấp)

### RQ-1 (P1) — Consumer UI cho `fetchSymbolNews`

- **Hiện trạng (đã verify trong bundle):** contract có `EnterpriseDataAdapter.fetchSymbolNews?(symbol, limit?)` (`dist/dts/lib/types/adapter.d.ts:46-77`); presence `kind:"host"` nhận diện được (`dist/index.js@153976`, checklist `DF`); `MultiSourceDataAdapter` route per-symbol (`vvia iife.js@2505803`). Nhưng grep toàn bundle ESM `fetchSymbolNews(` kèm ngoặc gọi = **0 hit** — không dock/panel nào gọi nó. Reference duy nhất là `CryptoCompareDataAdapter` (crypto demo).
- **Tác động:** vninvest cung cấp xong thì capability bật nhưng user không thấy tin tức ở đâu — tính năng "có mà như không".
- **Yêu cầu (chọn 1 trong 2, trả lời bằng văn bản):**
  - (a) Nếu consumer đã tồn tại ở bản mới hơn/kênh khác: cho tên component + version xuất hiện + prop bật nó.
  - (b) Nếu chưa có: thêm news panel/dock đọc `EnterpriseDataAdapter.fetchSymbolNews(symbol, limit)` (tôn trọng `limit`, `publishedAt` ms epoch, `null` = empty state trung thực, không fallback mock ở `live`).
- **AC phía vninvest (kiểm được sau khi widget nâng cấp):** Given adapter có `fetchSymbolNews` trả N items, When mở panel tin tức của mã, Then thấy đúng N item (title/url/source khớp), limit được tôn trọng; Given adapter thiếu method, Then panel empty state, không crash, không dữ liệu bịa.

### RQ-2 (P2, docs-only, không đổi code) — Tài liệu hóa 2 hành vi ngầm của corporate events

- **Hiện trạng:** `pK` (`dist/index.js@824141`) tự điền `timeIndex` bằng nến gần nhất theo `|bar.date − timestamp|` — host dev không biết nếu không đọc bundle minify; effect `@855651` bỏ qua events khi `plotData.length < 50` mà host không phân biệt được "không có event" vs "bị gate".
- **Yêu cầu:** bổ sung vào `CorporateEventsOverlay.d.ts` / `corporateEvents.d.ts` (hoặc docs driven): (1) `timeIndex` do widget tự tính từ `timestamp`/`date`, host không cần/không nên tự gán; (2) ngưỡng 50 bars có chủ ý gì, host-driven `corporateEvents` prop có bypass ngưỡng này không (source cho thấy có — xác nhận lại).
- **AC:** đọc `.d.ts` bản mới là đủ hiểu để implement host đúng, không cần mở bundle minify.

## 3. Ngoài phạm vi (vninvest không yêu cầu)

- Đổi ngưỡng 50 bars, đổi type `D|E|N|S`, thêm field `CorporateEvent` — giữ nguyên để tương thích.
- Mock/demo (`F_`, `allowMockEvents`) giữ nguyên cho môi trường demo; production vninvest dùng `live`.

## 4. Kết luận

vninvest đã sẵn sàng phía backend và adapter. Tính năng News & Events sẽ "đồng bộ, hiệu quả" khi widget bổ sung consumer UI cho `fetchSymbolNews` (RQ-1) và tài liệu hóa 2 hành vi ngầm của corporate events (RQ-2). Phản hồi về RQ-1/RQ-2 vui lòng gửi lại để vninvest cập nhật wiring tương ứng.
