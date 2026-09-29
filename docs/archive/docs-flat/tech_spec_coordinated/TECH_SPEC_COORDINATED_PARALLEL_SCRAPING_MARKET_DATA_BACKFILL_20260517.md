# Technical Spec - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17
**Version**: 1.0

---

## 1. Scope ky thuat

Spec nay mo ta:
1. Planner requested_window semantics cho daily va intraday.
2. Queue-tier scheduler quota model.
3. Coordinated parallel worker strategy.
4. Metrics, observability, failover, rollback.

---

## 2. CPS model

### 2.1 Coordinator plane

- Service: global planner + queue-tier scheduler.
- Input: GlobalSymbolRegistry + GlobalSymbolCoverage.
- Output: plan_items co requested_window, reason, dataset, provider_chain.

### 2.2 Execution plane

- Worker nhan plan_items theo queue tiers.
- Daily scraping: provider buckets + thread pool.
- Intraday hydration: tier-aware depth policy.

### 2.3 Control plane

- Runtime config qua ServiceConfig/DataOps.
- Quota, cooldown, lock, retry budget, fallback strategy.

---

## 3. requested_window semantics

### 3.1 Daily prices

1. coverage missing -> requested_window = { days: bootstrap_days }.
2. coverage stale with gap -> requested_window = { start_date, end_date }.
3. force_refresh -> requested_window = { trade_date }.

### 3.2 Intraday bars/ticks

1. hot tier -> deeper window and larger page_size.
2. warm tier -> medium depth.
3. cold tier -> shallow maintenance window.
4. recovery tier -> explicit gap range only.

---

## 4. Queue-tier scheduler

### 4.1 Required tiers

1. hot_user_demand
2. warm_liquid_market
3. cold_full_market
4. recovery_backlog

### 4.2 Required controls

1. max_dispatch_per_cycle per tier.
2. stale-run recovery with terminal-state enforcement.
3. scheduler lock and shard cooldown.
4. no duplicate inflight runs for same tier gate.

---

## 5. Daily parallel scraping strategy

1. Normalize symbol plan.
2. Partition by provider bucket round-robin.
3. Execute with bounded thread pool.
4. Upsert with unique conflict strategy.
5. Emit counters and per-provider stats.

Required counters:
- planned_items
- inserted
- updated
- skipped_existing
- failed_count
- repaired_conflicts
- provider_latency_p50/p95

---

## 6. Failure semantics

1. Provider failure:
- mark failed symbol
- exponential backoff within retry budget
- move unresolved symbols to recovery tier

2. Data integrity failure:
- reject malformed rows
- keep detailed error sample
- do not overwrite valid existing rows blindly

3. Runtime overload:
- reduce dispatch quota
- keep scheduler alive and degrade gracefully

---

## 7. Frontend and API contract notes

1. Frontend DataOps is operator visibility only, no client-side crawl orchestration logic.
2. API responses should expose tier, backlog, fail-rate, and run summary clearly.
3. New UI text must use i18n keys (vi with full diacritics).

---

## 8. Security and compliance

1. No direct vnbroker class import outside market_data/vnbroker_adapter.py.
2. No per-user crawl silo.
3. No except-pass in critical scheduler/planner paths.
4. All overrides must have audit trail.

---

## 9. Acceptance criteria

1. Missing daily coverage significantly reduced in hot tier.
2. No queue starvation for > N cycles (configurable gate).
3. Planner and scheduler test suites pass.
4. Runtime smoke checks pass after each slice.
