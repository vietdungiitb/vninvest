# Walkthrough - Whale Service Execution

Ngay cap nhat: 2026-04-23

## Buoc 1 - Chot contract

1. Freeze DECISION_LOG.
2. Freeze API_CONTRACT.
3. Freeze lock key convention.

## Buoc 2 - Lam migration

1. Tao migration data fill null.
2. Chay migration tren staging clone.
3. Verify khong con null.
4. Tao migration schema null=False + model moi.

## Buoc 3 - Build orchestration core

1. Code WhaleJobManager truoc.
2. Them helper:
- make_idempotency_key
- acquire_lock/release_lock
- heartbeat
3. Unit test conflict cases.

## Buoc 4 - Build tasks

1. Task USER_REFRESH trien khai truoc.
2. Task GLOBAL_RECOMPUTE tiep theo.
3. Backfill task sau cung.
4. Ensure tat ca task report progress.

## Buoc 5 - Build APIs

1. Trigger API.
2. Status API.
3. List API.
4. Enhance stats API.

## Buoc 6 - Build frontend

1. Manual Refresh button + disable state.
2. Poll status by job_id.
3. Show warning threshold mismatch.
4. Show no_data/zero_count state.

## Buoc 7 - Verification

1. Chay QA_TEST_MATRIX.
2. Chay spam test 20 requests/30s.
3. Xac nhan chi 1 job cung scope.
4. Xac nhan khong duplicate compute.

## Buoc 8 - Rollout

1. Canary 5% users.
2. Monitor metrics 24h.
3. Full rollout.
