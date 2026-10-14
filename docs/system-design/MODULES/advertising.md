# MODULES/advertising — Advertising

> Tin cậy tổng: ❓ (sơ khởi từ dữ liệu máy + tên route; chưa trace view).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Quảng cáo vận hành nội bộ (operator) + vùng hiển thị widget + đo lường click/view.
Không chạm tiền, không chạm tenant чужой — ranh giới với `commercial` (thanh toán).

## 2. Models (5 — chi tiết ở `06.02`)

`AdCampaign`, `AdClickLog`, `AdDailySummary`, `AdImpressionLog` (có tenant FK),
`TrademarkConfig` (không tenant FK — ❓ config dùng chung hay thiếu scope?).

## 3. API (9 route — chi tiết ở `07.02`)

`operator/ads/*` (4), `widget/ad` + `widget/config`, `metrics/log/*`,
`content/display`. 5 route AllowAny (nội dung công khai — xem `07.03` §2).

## 4. Job/signal

Có `advertising/tasks.py` + `advertising/signals.py` (tồn tại đo được; nội dung chưa rà).

## 5. Finding mở

- F-ADV-01 (⚠ GAP): **0 test file** (đo được ở `04.01`).
- F-ADV-02 (❓): `TrademarkConfig` không tenant FK — xác minh dùng chung hay sót.

## 6. Test khóa + trạng thái

Không có. Dossier v1 skeleton — nâng tin cậy khi trace view + viết test đầu tiên.
