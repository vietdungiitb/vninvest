# Implementation Plan - Whale Service Execution

Ngay cap nhat: 2026-04-23

## 1. Muc tieu

1. Hardening threshold per symbol (khong null).
2. Chot 2 lop xu ly:
- Tooltip/statistics theo threshold user.
- Realtime advisory he thong theo threshold he thong.
3. Trien khai service orchestration co anti-spam, anti-duplicate, progress tracking.
4. Trien khai backfill co checkpoint (default 3 thang).

## 2. Scope implementation

### Backend

1. Model updates:
- TrackedSymbol: whale_alert_threshold_million null=False (sau migration), them is_stale.
- WhaleServiceJob: model quan ly lifecycle job.

2. Services:
- WhaleSignalEngine: resolve threshold theo TrackedSymbol uu tien.
- WhaleJobManager: idempotency key, lock Redis, status update, progress.
- WhaleBackfillService: chunking, batching, checkpoint, no_data vs zero_count.

3. Tasks:
- recompute_whale_stats_task (USER_REFRESH/GLOBAL_RECOMPUTE).
- backfill_whale_stats_task (BACKFILL date range).

4. APIs:
- POST /api/portfolio/whale-service/trigger/
- GET /api/portfolio/whale-service/jobs/{job_id}/
- GET /api/portfolio/whale-service/jobs/
- GET /api/portfolio/whale-advisory-symbol-stats/ (enhanced payload)

### Frontend

1. Tooltip hien thi buy_count_raw/sell_count_raw.
2. Nút Manual Refresh tren WhaleBubbleChart.
3. Warning khi user_threshold < system_threshold.
4. Hien thi trang thai job dang chay.

### Admin UI

1. Trigger GLOBAL_RECOMPUTE/BACKFILL.
2. Form cau hinh backfill window (default 3 thang).
3. Job registry + filter + retry.

## 3. Pha trien khai

### Phase 0 - Freeze decisions

1. Chot decision log.
2. Chot API contract.
3. Chot permission matrix.

### Phase 1 - Data model + migration

1. Tao migration du lieu fill null threshold.
2. Tao WhaleServiceJob.
3. Them is_stale.
4. Enforce null=False.

Gate: Khong con ban ghi threshold null.

### Phase 2 - Service orchestration

1. Implement WhaleJobManager.
2. Lock strategy + idempotency + cooldown.
3. Integrate heartbeat gia han lock TTL.

Gate: Spam refresh khong tao nhieu job cung scope.

### Phase 3 - Backfill/recompute engine

1. Implement recompute scoped task.
2. Implement backfill chunked service.
3. Persist processed_dates.

Gate: Resume tu checkpoint thanh cong.

### Phase 4 - API layer

1. Trigger API + status/list APIs.
2. Response standard: accepted/in_progress/duplicate/throttled.
3. Permission + rate limit.

Gate: Permission matrix pass test.

### Phase 5 - Frontend/Admin UI

1. Manual refresh UX.
2. Progress state binding.
3. Warning threshold mismatch.

Gate: Manual verification pass.

### Phase 6 - Test + rollout

1. Unit + integration tests.
2. Staging soak.
3. Canary + full rollout.

Gate: khong co high severity regression.

## 4. KPI thanh cong

1. Duplicate job rate < 1% khi spam test.
2. USER_REFRESH p95 < 8s cho 1 symbol, 1 ngay.
3. BACKFILL 3 thang (VN30) hoan tat trong SLA da chot.
4. Error rate task < 2% (co retry).

## 5. Rollback

1. Tat trigger API qua feature flag.
2. Disable celery routes moi.
3. Retain read-only stats API fallback to existing path.
4. Keep migration irreversible note + fallback runtime check.
