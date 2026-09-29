# QA Test Matrix - Whale Service

Ngay cap nhat: 2026-04-23

## 1. Functional tests

1. F-01: Trigger USER_REFRESH cho symbol hop le -> accepted.
2. F-02: Trigger USER_REFRESH cho symbol khong track -> 400.
3. F-03: User trigger GLOBAL_RECOMPUTE -> 403.
4. F-04: Admin trigger BACKFILL 3 thang -> completed.
5. F-05: Stats API tra buy_count_raw/sell_count_raw.

## 2. Threshold tests

1. T-01: user threshold > system -> tooltip theo user, advisory theo system.
2. T-02: user threshold < system -> co warning, tooltip van theo user.
3. T-03: threshold update -> is_stale=true va recompute clear stale.

## 3. Anti-spam and concurrency tests

1. C-01: 20 requests USER_REFRESH cung user+symbol trong 30s.
- Expected: 1 accepted, con lai in_progress/duplicate/throttled.
2. C-02: 2 workers nhan cung 1 scope.
- Expected: chi 1 worker execute, worker con lai SKIPPED_DUPLICATE.
3. C-03: Redis lock ton tai nhung job done.
- Expected: stale lock recovery theo runbook.

## 4. Backfill tests

1. B-01: Backfill with no ticks -> data_state=no_data.
2. B-02: Backfill with ticks but no qualifying orders -> zero_count.
3. B-03: Interrupt run and resume checkpoint.
4. B-04: Batch size 20/50 cho ket qua nhat quan.

## 5. Performance tests

1. P-01: USER_REFRESH p95 latency.
2. P-02: BACKFILL throughput per hour.
3. P-03: API trigger under 100 concurrent requests.

## 6. Regression tests

1. R-01: Existing whale alerts page khong crash.
2. R-02: Existing advisory generation khong doi hanh vi ngoai contract da chot.
3. R-03: Tooltip render dung khi khong co data.

## 7. Re-audit results 2026-04-23ak

1. PASSED: `python manage.py test portfolio.tests.test_whale_service_orchestration -v 2` -> 6/6.
2. PASSED: Permission matrix runtime tests (khong monkeypatch).
3. PASSED: Concurrency probe 16 concurrent requests -> statuses {'accepted': 1, 'in_progress': 15}, active_jobs=1, total_jobs=1.
4. PASSED: `python manage.py check` -> no issues.
5. PASSED: `docker compose --env-file .env.production -f docker-compose.prod.yml config` render thanh cong.
