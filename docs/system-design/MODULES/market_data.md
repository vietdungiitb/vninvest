# MODULES/market_data — Market Data

> Tin cậy tổng: ⚠ (nhóm route + test đã đo; nội bộ chưa trace). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Lưu trữ dữ liệu thị trường: mã, giá daily/intraday, registry mã toàn cục, cấu hình
runtime. Ranh giới với `data_ingest` (ghi) và `market_serving` (đọc).

## 2. Models (8 — chi tiết ở `06.02`)

`DailyPrice`, `IntradayBar`, `IntradayTick`, `GlobalSymbolRegistry`,
`GlobalSymbolCoverage`, `StockProfile`, `VnbrokerRuntimeConfig` (không tenant FK
trực tiếp — dữ liệu dùng chung, hợp lý), `GlobalSymbolDemandSource` (có).

## 3. API (43 route — chi tiết ở `07.02`)

`stock-management/*` (stocks, groups, price-alerts, tracked-symbols,
ai-advisory-components), `market-data/*` (symbols, daily-prices, admin-groups).

## 4. Job/signal

Không có file task/signal riêng (thuần lưu trữ + đọc).

## 5. Finding mở

- F-MD-01 (❓): ai-advisory-components trong stock-management là gì.

## 6. Test khóa + trạng thái

15 test file (tồn tại đo được).
