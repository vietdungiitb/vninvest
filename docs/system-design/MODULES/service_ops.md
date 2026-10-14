# MODULES/service_ops — Service Operations Center

> Tin cậy tổng: ⚠ (quy mô đã đo; nội bộ control plane chưa trace sâu).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Control plane vận hành (SOC): runtime-config, backfill scraping, prefetch, quy tắc
screener, sức khỏe service, ma trận chu kỳ. Toàn bộ staff-only.

## 2. Models (15 — chi tiết ở `06.02`)

`ServiceDefinition`, `ServiceConfig`, `ServiceHealth`, `BackfillExecution*`,
`ScrapeMatrix*`, `CachedSymbolGroup*`, `ConfigChangeAudit`… — **0/15 có tenant FK
trực tiếp** (cấu hình/vận hành dùng chung là hợp lý; ❓ nếu có dữ liệu theo tenant
lọt vào đây thì là finding).

## 3. API (297 route, staff-only — chi tiết ở `07.02`)

`operator/soc/*` (135) + `operator/scraping` (27) + `/api/soc/*` (overview,
services, matrix, dataops, prefetch, screener). Phân quyền
IsAuthenticated+IsAdminUser ✅ toàn bộ.

## 4. Job/signal

Có `service_ops/tasks.py`. Không có file signal riêng.

## 5. Finding mở

- F-SO-01 (❓): ma trận chu kỳ + runtime-config vận hành thế nào — dossier sâu.

## 6. Test khóa + trạng thái

40 test file (nhiều nhất repo — tồn tại đo được).
