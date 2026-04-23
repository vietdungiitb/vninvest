# Tech Spec - Symbol Engagement Warm-up (2026-04-23)

## 1. Proposed Components

### 1.1 Service Layer
File: backend/portfolio/services_symbol_engagement.py

Functions:
- activate_symbol_engagement(user_id: int, symbol: str, source: str, context: dict | None = None)
- is_intraday_fresh(symbol: str) -> tuple[bool, dict]
- enqueue_symbol_warmup(symbol: str, reason: str, metadata: dict | None = None)

### 1.2 Task Layer
File: backend/portfolio/tasks_symbol_engagement.py

Task:
- warmup_symbol_intraday(symbol: str, reason: str = "engagement")

Behavior:
- Acquire cache lock.
- Re-check freshness inside task.
- Skip if fresh.
- Execute one-shot collect pipeline.
- Record structured logs + metrics.

### 1.3 Metrics
- symbol_engagement_activated_total{source}
- symbol_warmup_enqueued_total{source}
- symbol_warmup_skipped_fresh_total
- symbol_warmup_skipped_lock_total
- symbol_warmup_success_total
- symbol_warmup_failed_total{reason}
- symbol_warmup_latency_ms

Metrics integration policy:
- Phase 1 writes counters through existing backend observability module.
- Prometheus export (if needed) is a bridge layer and must not bypass existing runtime counters.

## 2. Freshness Contract
Input: symbol
Output:
- fresh: bool
- details: {
  has_today_data,
  latest_tick_age_sec,
  tick_count_today,
  market_phase,
  decision,
}

Decision logic:
- fresh = true only when:
  - has_today_data = true
  - tick_count_today >= 20
  - and if market_phase is open/in-session then latest_tick_age_sec <= 180

Config:
- threshold value is configurable by settings (default 180 seconds).
- no hardcoded market session parser in this feature.

## 3. Lock Contract
Key format:
- warmup:intraday:{symbol}:{yyyymmdd}

Acquire:
- cache.add(key, token, timeout=600)

On lock miss:
- skip and metric increment

Lock source of truth:
- primary lock mechanism is Django cache backend to align with existing task locking style.
- optional raw Redis lock path is disabled by default.

## 4. Integration Contract
Call site rule:
- All sources call activate_symbol_engagement() inside transaction.on_commit.

Sources:
- tracked_symbol_create
- watchlist_item_create
- holding_open/create

Transaction path coverage:
- Apply hook for both legacy transaction create view and refactored transaction create view behind runtime toggle.
- Preferred implementation point is shared trading service layer to guarantee single behavior.

## 5. Non-Functional Targets
- Average warm-up runtime <= 5s for one symbol under normal provider response.
- Zero duplicate warm-up execution for same symbol/day while lock active.
- No blocking of user request path (async enqueue only).

## 6. Failure Modes
- Provider timeout: task fails, retry up to 2.
- Redis/cache unavailable: continue without lock only if explicitly allowed by feature flag (default: do not run to avoid duplication).
- Partial data after warm-up: scheduler fills later.

## 7. Compatibility
- Works with current scheduler; does not change scheduler cadence.
- Works with existing IntradayTick shared data model.
- Works for multi-user same-symbol engagement.

Consumer-visibility compatibility:
- Warm-up execution must update at least one consumer-visible path used by Whale Analytics runtime.
- If only internal task status is updated without visible data freshness improvement, behavior is non-compliant.
