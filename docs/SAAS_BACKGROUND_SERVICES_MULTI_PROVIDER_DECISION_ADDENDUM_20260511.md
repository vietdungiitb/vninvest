# DECISION ADDENDUM v1.1 — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11  
**Phiên bản**: 1.1  
**Trạng thái**: APPROVED FOR IMPLEMENTATION (GO WITH CONDITIONS)  
**Quyết định**: GO with conditions - timeline compressed 5-7 weeks

---

## 1. Technical Clarifications — 8 Points

### 1.1 P0: Queue Drift Checker Specification

**Solution**: Management command + cron job

```python
# Location: packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py
import sys
from django_celery_beat.models import PeriodicTask

def handle(self, *args, **options):
    # Expected queue map (hardcoded or JSON policy)
    EXPECTED_QUEUES = {
        'materialize-symbol-snapshot-60s': 'realtime_prefetch',
        'materialize-session-facts-5m': 'realtime_prefetch',
        'materialize-unified-alerts-2m': 'realtime_prefetch',
        'detect_and_store_global_whale_alerts': 'analytics_heavy',
        'detect_order_flow': 'analytics_heavy',
        'run_stream_consumer_batch': 'realtime_stream',
        # ... complete map
    }
    
    # Compare with actual PeriodicTask.queue
    actual = {t.name: t.queue for t in PeriodicTask.objects.all()}
    drift_count = sum(1 for name, queue in actual.items() 
                  if EXPECTED_QUEUES.get(name) != queue)
    
    if drift_count > 0:
        self.stderr.write(f"DRIFT DETECTED: {drift_count} tasks")
        sys.exit(1)  # Fail CI
```

**Execution points**:
1. Startup: worker/beat container init script
2. CI: pre-deploy pipeline check
3. Runtime: cron every 5 minutes

---

### 1.2 P1: Worker Topology and Concurrency

**Assumption**: 10,000 registered users, 1,500-2,500 concurrent peak

| Queue Domain | Workers | Concurrency | Notes |
|---|---|---|---|
| realtime_prefetch | 3 | 4 | Hot path prefetch |
| realtime_stream | 4 | 4 | Stream consumption |
| enrichment_offhours | 2 | 6 | Batch enrichment |
| analytics_heavy | 2 | 4 | Whale/order flow |
| manual_on_demand | 2 | 3 | User-triggered (rate limited) |

**Autoscale rule**:
- Scale up when queue lag > threshold for 3 consecutive checks
- Scale based on queue_depth + task_age, not CPU alone

---

### 1.3 P2: Provider Quality Scoring

**Formula per channel** (weighted):

```
quality_score = 
  freshness_40% + 
  completeness_30% + 
  success_rate_20% + 
  parse_quality_10%
```

**Implementation**:
- Rolling window: 15 minutes
- Best-source: highest score, with hysteresis to prevent flapping
- Score stored in Redis with TTL 1 hour

---

### 1.4 "10,000 Users" Definition

| Dimension | Definition |
|---|---|
| Business | 10,000 registered accounts |
| Technical sizing | 2,000 concurrent peak |
| **All SLOs apply to** | concurrent peak, not registered |

---

### 1.5 Event-Driven "Stale Spike" Trigger

**Definition**:
```
trigger_condition = 
  stale_ratio > 5% for 3 consecutive cycles OR 
  cache_miss_rate > 2%
```

**Action on trigger**:
1. Increase hot-tier prefetch frequency
2. Elevate fallback provider chain priority

---

### 1.6 Offhours Pipeline Priority

| Tier | Channels | Deadline |
|---|---|---|
| Tier 1 (mandatory) | history bars, session facts, symbol snapshot warmup | pre-open -20min |
| Tier 2 (important) | fundamentals, corporate actions | pre-open -10min |
| Tier 3 (optimization) | news/sentiment enrichment | pre-open + 10min |

---

### 1.7 Redis Topology

**Production minimum**:
- Redis A: Celery broker
- Redis B: Realtime cache
- Redis C: WebSocket/channel layer

**Note**: Cluster optional when throughput exceeds threshold, but role separation is mandatory.

---

### 1.8 Celery Result Backend + WebSocket Fanout

**Result backend**:
- Redis dedicated for short-term async results
- Or disabled for fire-and-forget tasks

**WebSocket fanout**:
- Domain `realtime_stream` pushes delta payloads only
- Backpressure: batching 100-200 messages/frame

---

## 1.9 Audit Findings Closure

The audit findings below are now binding implementation decisions, not open questions.

| Finding | Decision status | Implementation anchor |
|---|---|---|
| P0 drift checker implementation | Closed | Management command `check_scheduler_queue_drift`, companion `sync_scheduler_queues`, shared queue map, backend-beat healthcheck, and CI/pre-deploy gate |
| P1 worker topology concurrency | Closed | `CELERY_QUEUES` + `CELERY_CONCURRENCY` are declared per service and mirrored across dev/prod/core compose; `core-worker` is the low-concurrency fallback consumer for `celery`, `realtime_prefetch`, `realtime_stream`, `analytics_heavy`, and `manual_on_demand` |
| P2 provider scoring algorithm | Closed | Weighted normalized score over a 15-minute rolling window with hysteresis |
| “10,000 users” ambiguity | Closed | Sizing basis is 10,000 registered accounts and 2,000 concurrent peak; SLOs apply to concurrent peak |
| Event-driven stale spike definition | Closed | `stale_ratio > 5%` for 3 consecutive cycles OR `cache_miss_rate > 2%` |
| Redis topology | Closed | Three logical roles: Celery broker, realtime cache, WebSocket/channel layer; cluster is optional |
| WebSocket fanout architecture | Closed | Delta-only payloads from `realtime_stream`, symbol sanitization before channel key use, and batching of 100-200 messages/frame |
| Offhours pipeline / result backend policy | Closed | Tiered offhours deadlines are fixed, and Celery result backend is short-term Redis or disabled for fire-and-forget tasks |

These decisions close the clarifications requested by the review and are the source of truth for the implementation checklist and rollout gates.

---

## 2. Dependency Risk Mitigation

### 2.1 django-celery-beat Drift

| Risk | Mitigation |
|---|---|
| Scheduler DB drift | `check_scheduler_queue_drift` + `sync_scheduler_queues` auto-heal |

### 2.2 vnbroker Adapter Coverage

| Provider | price_board | intraday | history | fundamentals |
|---|---|---|---|---|
| KBS | ✅ | ✅ | ✅ | TBD |
| VCI | ✅ | ✅ | TBD | TBD |
| TCBS | ✅ | TBD | TBD | TBD |
| SSI | TBD | TBD | TBD | TBD |
| MSI | TBD | TBD | TBD | TBD |

**Action**: Fill fallback policy for TBD channels before cutover.

---

## 3. Compressed Timeline — 5-7 Weeks

| Week | Phase | Deliverables |
|---|---|---|
| 1 | P0 + P1 (partial) | queue map, drift checker, worker split v1 |
| 2-3 | P2 | provider scoring, best-source resolver, observability |
| 4 | P3 | manual trigger + quota/rate-limit API |
| 5 | P4 | offhours Tier 1 + Tier 2 |
| 6-7 | P5 | load test, soak 72h, tuning, sign-off |

---

## 4. Approval

**Decision**: ✅ GO WITH CONDITIONS

**Conditions met**:
- [x] 8 technical clarifications documented
- [x] Timeline compressed to 5-7 weeks
- [x] Risk mitigations specified
- [x] User scale definition clarified

**Next step**: Create technical implementation checklist per file and execution command for team to begin coding in the day.
