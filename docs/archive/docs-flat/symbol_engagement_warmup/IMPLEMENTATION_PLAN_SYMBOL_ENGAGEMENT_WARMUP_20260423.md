# Implementation Plan - Symbol Engagement Warm-up (2026-04-23)

## 1. Objective
Create one shared backend behavior when a symbol is newly engaged from any source (tracked symbols, watchlist, holdings).

Warm-up is only a bridge until scheduler runs again. It must avoid duplicate work and system overload.

## 2. Scope
In scope:
- Shared engagement trigger flow.
- One warm-up task with freshness check.
- Idempotency lock by symbol.
- Hook integration from tracked/watchlist/holdings.
- Metrics and audit trace.

Out of scope:
- Replacing scheduler logic.
- Building a new long-running service.

## 3. Shared Domain Behavior
Domain event: SymbolEngaged

Trigger when:
- New tracked symbol is created.
- New watchlist item is created.
- First holding is created for a symbol not yet engaged.

Rules:
- Emit on transaction commit only.
- Emit once per create action.
- If data is already fresh, warm-up must skip.

## 4. Warm-up Strategy
Execution order:
1. Check IntradayTick freshness for symbol.
2. If fresh: skip and record metric.
3. If missing/stale: run one intraday collect.
4. Push stream/update immediate pipeline.
5. Let scheduler take over on next cycle.

Freshness baseline:
- Has current session ticks.
- Latest tick age <= 180 seconds in market hours.
- Minimum usable ticks >= 20 rows.

Market-phase alignment:
- Do not re-implement custom market-hour parser in this feature.
- Reuse existing market phase resolver/time policy from market data runtime.
- Apply 180-second threshold only when market phase is in-session/open.
- Outside market hours, degrade to looser freshness rule to avoid unnecessary warm-up storms.

## 5. Idempotency and Load Control
- Lock key: warmup:intraday:{symbol}:{yyyymmdd}
- Lock TTL: 600 seconds
- Queue concurrency: 2
- Retry: 2 attempts with short backoff
- New requests during active lock: skip

Lock implementation policy:
- Prefer cache.add(...) lock pattern for consistency with current task runtime.
- Keep fail-soft behavior and skip when lock exists.
- Avoid raw Redis token-safe lock unless a proven release hazard appears in production.

## 6. Integration Points
- Tracked symbols create endpoint/service.
- Watchlist item create endpoint/service.
- Holdings create flow (transaction/position open flow).

All three must call one shared engagement service.

Runtime toggle requirement:
- Transaction create path currently supports legacy and refactored views under toggle.
- Hook must be applied in both paths (or at shared service/serializer layer) to avoid behavior drift when toggle changes.
- Engagement dispatch must run in transaction.on_commit only.

## 7. Rollout Plan
Phase 1:
- Build service + warm-up task + lock + freshness check.

Phase 2:
- Wire hooks for tracked/watchlist/holdings with on_commit.

Phase 3:
- Add metrics + logs + admin debug status endpoint.

Phase 4:
- Run integration tests and tune thresholds.

## 8. Acceptance Criteria
- Same behavior regardless of where symbol is added.
- No duplicate warm-up storms when many users add same symbol.
- Warm-up skips when data already fresh.
- Scheduler remains primary background source.
- Audit logs and metrics are visible.

Data visibility criterion:
- Warm-up must target the data path actually consumed by Whale Analytics (cache and/or IntradayTick persistence).
- A completed warm-up task without consumer-visible data update is considered failed acceptance.

## 9. Risk and Mitigation
Risk: duplicate tasks under concurrent add events.
Mitigation: lock + idempotent service + on_commit.

Risk: too many warm-up tasks in peak time.
Mitigation: freshness skip + bounded concurrency + retry cap.

Risk: stale data still shown.
Mitigation: fallback rendering remains active, plus freshness metrics.
