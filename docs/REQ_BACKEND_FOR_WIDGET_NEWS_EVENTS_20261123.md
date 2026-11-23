# Báo cáo yêu cầu backend (vninvest) cho widget News & Events

> Người gửi: đội widget (`vninvestcharts-widget`)
> Người nhận: đội backend vninvest
> Ngày: 2026-11-23
> Phiên bản widget: `@vninvestcharts/widget@0.4.7-ent` (staging HEAD `54563d13`)

## 1. Mục đích

Widget đã hoàn tất consumer UI cho News (`SymbolNewsPanel` + dock tab `"news"`) và overlay Corporate Events (SSOT positioning theo bar index). Để tính năng hoạt động end-to-end trên production, backend vninvest cần cung cấp/hoàn thiện 2 hàm API + wiring adapter như dưới.

## 2. Yêu cầu backend

### RQ-B1 (P1) — Corporate Actions endpoint
- `GET /core/v1/stock-management/stocks/{symbol}/corporate-actions/?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N`
- Nguồn: bảng `CorporateAction` (VCI ingest nightly, `is_latest=true`).
- Response: `{ symbol, from, to, count, actions: [{id, action_type: DIV|ISS, ex_date, record_date, payment_date, cash_amount_per_share, stock_ratio_pct, currency, source, source_event_id, raw_title, parse_status, ...}], note }`.
- Mặc định `to`=hôm nay, `from`=to-365d; `limit` mặc định 200, tối đa 1000; lọc `is_latest=true` + `ex_date` trong range; sắp xếp `ex_date ASC`.
- Symbol chuẩn hóa `upper().strip()`; mã không tồn tại → 404; `from>to` → 400; thiếu PAT → 401/403 (fail-closed).
- Thiếu/không fetch được → envelope rỗng + `note`, không 500.

### RQ-B2 (P1) — News endpoint tôn trọng `limit`
- `GET /core/v1/stock-management/stocks/{symbol}/news/?limit=N` (mặc định 20, tối đa 100).
- Cache key có hậu tố `limit` để không nhiễm chéo.
- Response giữ shape `{ symbol, news: [...], note }`; `published_at` parse được thành ms epoch ở FE; item lỗi parse bị bỏ, không crash.

### RQ-B3 (P1) — Wiring adapter VNInvest
- `VNInvestDataAdapter` implement:
  - `fetchCorporateEvents(symbol, fromMs, toMs) → CorporateEvent[]` (mode `live`), map BE shape → widget shape; `timeIndex` **không** tự gán (widget tự tính).
  - `fetchSymbolNews(symbol, limit?) → NewsItem[] | null`.
- Không fallback mock ở `live` (`allowMockEvents` chỉ demo).
- Thiếu method → `null`/`[]` + empty state trung thực, không crash.

## 3. Acceptance Criteria (phía widget kiểm được)

- Given adapter có `fetchCorporateEvents` trả N events, When mở chart mã có events, Then overlay hiển thị đúng N marker, vị trí bám bar khi pan/zoom.
- Given adapter trả `[]`/`null`, Then overlay/panel empty state, không dữ liệu bịa, không crash.
- Given adapter có `fetchSymbolNews` trả N items, When mở dock tab News, Then hiển thị đúng N item (title/url/source khớp), limit tôn trọng.
- Given adapter thiếu method, Then tab News ẩn / panel empty, không crash.

## 4. Ngoài phạm vi
- Không đổi ngưỡng 50 bars, type `D|E|N|S`, field `CorporateEvent`.
- Không bật `allowMockEvents` production.
- Không thay đổi ingest/adjustment hiện có.

## 5. Phản hồi
Vui lòng xác nhận endpoint + wiring + version adapter để widget cập nhật integration và chạy UAT staging.