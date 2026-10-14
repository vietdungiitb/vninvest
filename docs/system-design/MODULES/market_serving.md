# MODULES/market_serving — Market Serving

> Tin cậy tổng: ⚠. Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Phục vụ đọc realtime: breadth, depth-chart, intraday, price-board, rvol,
symbol-investigation + `session-facts` cho pipeline AI. Không ghi dữ liệu gốc.

## 2. Models (3 — chi tiết ở `06.02`)

`SessionFacts`, `SessionFactsBucket`, `SymbolSnapshot` (không tenant FK trực tiếp
— snapshot dùng chung theo mã, hợp lý nếu key theo symbol+phiên).

## 3. API (16 route — chi tiết ở `07.02`)

Đều `IsAuthenticated`.

## 4. Job/signal

Có `market_serving/tasks.py` (prefetch). Không có file signal riêng.

## 5. Finding mở

- F-MS-01 (❓): ranh giới cache prefetch với `data_ingest` warmup.

## 6. Test khóa + trạng thái

4 test file (tồn tại đo được).
