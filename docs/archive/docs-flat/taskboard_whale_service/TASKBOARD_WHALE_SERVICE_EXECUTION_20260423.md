# Taskboard - Whale Service Execution

Ngay cap nhat: 2026-04-23

## Lane A - Migration va Data Hardening

1. A1 Tao migration fill null threshold tu UserConfig/system default.
2. A2 Them is_stale vao TrackedSymbol.
3. A3 Tao model WhaleServiceJob + indexes.
4. A4 Enforce null=False cho TrackedSymbol threshold.
5. A5 Viet script verify sau migration.

## Lane B - Orchestration

1. B1 Implement WhaleJobManager tao job va status transitions.
2. B2 Implement idempotency key generator.
3. B3 Implement Redis lock + heartbeat.
4. B4 Implement transactional DB conflict handling + Redis create-gate.
5. B5 Implement duplicate queue guard trong worker.

## Lane C - Compute services

1. C1 Implement recompute_whale_stats_task scope user/global.
2. C2 Implement whale_backfill_service chunked.
3. C3 Implement checkpoint persistence.
4. C4 Implement no_data vs zero_count.

## Lane D - API

1. D1 Trigger API.
2. D2 Job status API.
3. D3 Job list API.
4. D4 Nang cap stats API payload raw counts + stale + warning.
5. D5 Permission + throttling middleware integration.

## Lane E - Frontend

1. E1 Manual Refresh button.
2. E2 Polling/tracking job progress.
3. E3 Tooltip payload mapping raw counts.
4. E4 Warning threshold mismatch.

## Lane F - QA and rollout

1. F1 Unit tests service/job/task.
2. F2 Integration tests API + permission + rate limit.
3. F3 Manual spam refresh scenario.
4. F4 Staging soak + canary release.

## Dependency order

1. A -> B -> C -> D -> E -> F
2. D4 co the song song E3 neu contract da dong.

## Hotfix slice 2026-04-23ak (da hoan tat)

1. B6: Bo sung Redis create-gate de chan race create job khi lock_key khong unique.
2. B7: Worker lock conflict mark `SKIPPED_DUPLICATE`, khong de `PENDING` orphan.
3. F5: Tang cuong test permission runtime + state transition duplicate skip.
4. E5: Polling backoff doi sang exponential.
