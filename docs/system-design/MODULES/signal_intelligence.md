# MODULES/signal_intelligence — Signal Intelligence

> Tin cậy tổng: ⚠ (feed đã trace ở `05.01` WF-05). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Trung tâm cảnh báo: feed phân trang cursor, chi tiết + ngữ cảnh mã, acknowledge,
mute, stream SSE có throttle, whale/order-flow/anomaly. Ranh giới với
`market_serving` (dữ liệu đọc) và `advisory` (khuyến nghị).

## 2. Models (7 — chi tiết ở `06.02`)

`UnifiedAlert`, `WhaleAlertCanonical`, `UserAlertDelivery`, `UserAlertPreference`,
`AdvisorySignalEvent`, `MarketAnomalyEvent`, `OrderFlowEvent` — 0/7 có tenant FK
trực tiếp (❓ cách ly theo user hay thiếu scope? Cần đọc FK user + scope view).

## 3. API (13 route — chi tiết ở `07.02`)

`signals/alert-center` (8), `ai-alerts` (3), `order-flow`, `whale-feed`.
Luồng đầy đủ ở `05.01` WF-05 (`views.py:410-760`).

## 4. Job/signal

Có `signal_intelligence/tasks.py` + 2 beat. Không có file signal riêng.

## 5. Finding mở

- F-SI-01 (❓): cách ly tenant của `UnifiedAlert` (0 tenant FK trực tiếp).

## 6. Test khóa + trạng thái

11 test file (`test_alert_center_api.py:15`, `test_alert_center_stream.py:26`…).
