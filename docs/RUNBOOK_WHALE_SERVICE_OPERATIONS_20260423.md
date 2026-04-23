# Runbook - Whale Service Operations

Ngay cap nhat: 2026-04-23

## 1. Van hanh hang ngay

1. Kiem tra so job FAILED/PARTIAL.
2. Kiem tra lock conflict rate.
3. Kiem tra queue depth.
4. Kiem tra stale symbols count.

## 2. SLO tham chieu

1. USER_REFRESH p95 < 8s.
2. Trigger API error rate < 1%.
3. Duplicate job creation = 0 tren cung scope.

## 3. Xu ly su co

### Tinh huong A - User bao bam refresh nhieu lan khong cap nhat

1. Check job status API theo job_id.
2. Neu status RUNNING lau bat thuong, kiem tra heartbeat_at.
3. Neu heartbeat stale, mark FAILED va release lock.
4. Trigger lai 1 lan theo force policy.

### Tinh huong B - Lock bi ket

1. Verify lock key trong Redis.
2. Kiem tra job tuong ung con RUNNING khong.
3. Neu lock conflict khi worker start, job conflict phai o trang thai `SKIPPED_DUPLICATE` (khong de `PENDING`).
4. Neu job da ket thuc nhung lock con ton tai, purge lock an toan.
5. Ghi incident log.

## 7. Re-audit note 2026-04-23ak

1. Da bo race dependency vao DB unique(lock_key).
2. Duong tao job duoc serialise bang Redis create gate + DB transaction check.
3. Lock conflict duoc close lifecycle bang `SKIPPED_DUPLICATE`.

### Tinh huong C - Backfill load cao

1. Giam batch_size.
2. Giam concurrency worker lane backfill.
3. Chay off-peak window.

## 4. Retry policy

1. USER_REFRESH: retry toi da 2 lan.
2. GLOBAL_RECOMPUTE: retry 1 lan theo batch fail.
3. BACKFILL: retry theo checkpoint, khong rerun toan bo.

## 5. Rollback nhanh

1. Tat trigger API bang feature flag.
2. Drain celery queue cho whale service.
3. Keep read-only stats endpoint fallback.

## 6. Bao cao van hanh

1. Bao cao ngay:
- total jobs
- completed/failed/partial
- avg duration
- throttled requests
2. Bao cao tuan:
- trend lock conflict
- trend stale symbols
