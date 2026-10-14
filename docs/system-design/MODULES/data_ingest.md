# MODULES/data_ingest — Data Ingest

> Tin cậy tổng: ⚠ (lịch trình đã verify ở `05.01` WF-04). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Ingest/backfill dữ liệu thị trường theo lịch: price-board 60s, warm intraday,
backfill daily 17:00, DNSE intraday 90 ngày, pre-5y, ingest shadow, outbox.
Ranh giới với `market_data` (lưu trữ) và `market_serving` (phục vụ đọc).

## 2. Models (2 — chi tiết ở `06.02`)

`IngestJob`, `IngestRun` (không tenant FK trực tiếp — job vận hành dùng chung,
hợp lý).

## 3. API (9 route — chi tiết ở `07.02`)

`data-ingest/*` (backfill, jobs, runs, trigger, task-status).

## 4. Job/signal

Có `data_ingest/tasks.py` + **8 beat** (nhiều nhất repo). Không có file signal riêng.

## 5. Finding mở

- F-DI-01 (⚠): luồng dữ liệu trong từng task (fetch → upsert → cache) chưa trace.

## 6. Test khóa + trạng thái

5 test file (tồn tại đo được).
