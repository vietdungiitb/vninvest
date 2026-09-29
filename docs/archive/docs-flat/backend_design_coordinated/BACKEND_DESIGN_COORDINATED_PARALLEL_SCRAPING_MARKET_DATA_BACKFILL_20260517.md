# Backend Design - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

## 1. Muc tieu backend

1. Duy tri planner-first coordination.
2. Toi uu throughput bang parallel buckets co quota.
3. Bao toan data integrity trong upsert pipelines.

---

## 2. Kien truc backend

### 2.1 Coordinator
- market_data/global_symbol_coverage.py
- market_data/global_symbol_planner.py
- service_ops/tasks.py (queue-tier scheduler)

### 2.2 Executors
- data_ingest/tasks.py
- daily history backfill workers
- intraday hydration workers

### 2.3 Persistence
- DailyPrice
- IntradayBar
- IntradayTick
- GlobalSymbolCoverage
- ServiceRunLog

---

## 3. CPS execution flow

1. Build preview from coverage gaps.
2. Partition by tier.
3. Apply quota and lock.
4. Dispatch plan items to queue.
5. Execute provider-bucket parallel scraping.
6. Persist with conflict-safe upsert.
7. Emit metrics and run summary.

---

## 4. Reliability patterns

1. bounded retries + exponential backoff.
2. stale run recovery gate.
3. terminal-state guard before execution.
4. partial success status with symbol-level failures.

---

## 5. API and ops requirements

1. DataOps endpoints expose run summaries and backlog states.
2. Operator actions write through audited services only.
3. No direct DB mutate from frontend.

---

## 6. Test requirements

1. planner preview semantics tests.
2. scheduler quota and inflight recovery tests.
3. ingest task bucket parallelism tests.
4. API contract tests for DataOps CPS fields.
