# Taskboard - Symbol Engagement Warm-up (2026-04-23)

## EPIC A - Shared engagement behavior
- [ ] A1. Create service file services_symbol_engagement.py
- [ ] A2. Implement activate_symbol_engagement()
- [ ] A3. Implement freshness checker is_intraday_fresh()

## EPIC B - Warm-up task and idempotency
- [ ] B1. Create tasks_symbol_engagement.py
- [ ] B2. Implement warmup_symbol_intraday task
- [ ] B3. Add cache lock guard (symbol/day)
- [ ] B4. Add retry/backoff policy
- [ ] B5. Re-check freshness inside task with market-phase aware threshold

## EPIC C - Hook all sources
- [ ] C1. Wire tracked symbol create -> service (on_commit)
- [ ] C2. Wire watchlist item create -> service (on_commit)
- [ ] C3. Wire holdings open/create (legacy transaction view) -> service (on_commit)
- [ ] C4. Wire holdings open/create (refactored transaction view) -> service (on_commit)
- [ ] C5. Ensure shared-layer hook prevents toggle drift (ENABLE_NEW_TRADING_VIEWS)

## EPIC D - Observability
- [ ] D1. Add counters into existing observability module (activation/enqueued/skip_fresh/skip_lock/success/fail)
- [ ] D2. Add structured logs (symbol/source/reason/result)
- [ ] D3. Add minimal admin debug endpoint for warm-up status
- [ ] D4. Optional Prometheus bridge (after observability counters stable)

## EPIC E - Tests
- [ ] E1. Unit test freshness decision matrix
- [ ] E2. Unit test lock/idempotent behavior
- [ ] E3. Integration test tracked -> warm-up enqueue
- [ ] E4. Integration test watchlist -> warm-up enqueue
- [ ] E5. Integration test holdings legacy view -> warm-up enqueue
- [ ] E6. Integration test holdings refactored view -> warm-up enqueue
- [ ] E7. Concurrency test same symbol multi-user
- [ ] E8. Consumer visibility test: warm-up result visible in Whale Analytics data path

## EPIC F - Rollout
- [ ] F1. Enable feature flag in dev
- [ ] F2. Verify metrics in dev runtime
- [ ] F3. Tune thresholds if needed
- [ ] F4. Enable in production

## Done Definition
- [ ] All C-sources invoke one shared flow
- [ ] Warm-up skips on fresh data
- [ ] Scheduler remains unchanged and primary
- [ ] Transaction toggle does not change engagement behavior
- [ ] Warm-up updates at least one consumer-visible data path
- [ ] Audit docs + ledger + dashboard updated
