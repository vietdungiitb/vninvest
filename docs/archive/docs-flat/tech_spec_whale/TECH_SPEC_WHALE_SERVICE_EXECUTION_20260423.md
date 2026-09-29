# Technical Spec - Whale Service Execution

Ngay cap nhat: 2026-04-23

## 1. Data schema

### 1.1 TrackedSymbol (modify)

1. whale_alert_threshold_million:
- type: DecimalField(max_digits=10, decimal_places=2)
- null=False, blank=False (sau migration)
2. is_stale:
- type: BooleanField(default=False)
3. Index khuyen nghi:
- (user_id, symbol)
- (is_stale, updated_at)

### 1.2 WhaleServiceJob (new)

1. service_type: enum
- BACKFILL
- GLOBAL_RECOMPUTE
- USER_REFRESH
2. status: enum
- PENDING, RUNNING, COMPLETED, FAILED, PARTIAL, SKIPPED_DUPLICATE
3. fields:
- params (JSON)
- idempotency_key (Char, indexed)
- lock_key (Char, indexed)
- progress_pct (Float)
- total_items, processed_items, failed_items (Int)
- started_at, finished_at, heartbeat_at
- log (Text)
- created_by_id (nullable)

## 2. Lock and anti-spam design

1. API rate-limit:
- USER_REFRESH: key=user:{id}:symbol:{symbol}
- BACKFILL/GLOBAL: key=admin:{id}:service:{type}
2. Idempotency:
- hash(service_type + scope + date_range + threshold_version)
3. Redis lock:
- SETNX lock_key + TTL
- heartbeat gia han TTL moi 15s khi task RUNNING
4. Create gate guard:
- Redis create-gate key de serialise duong tao job theo scope (TTL ngan).
- Ket hop transaction + select_for_update de chot duplicate/in_progress truoc khi create row moi.
5. Worker dedupe:
- task check lock/job status truoc execute

## Re-audit delta 2026-04-23ak

1. Lock conflict trong worker khong de lai PENDING orphan:
- Neu start_job fail vi lock, job duoc mark SKIPPED_DUPLICATE + finished_at.

2. Permission test matrix da duoc verify bang runtime tests (khong monkeypatch permission):
- free USER_REFRESH -> 403
- pro USER_REFRESH -> 201
- staff free BACKFILL -> 403
- admin BACKFILL -> 201

## 3. Threshold resolution contract

1. Tooltip/stats path:
- threshold_vnd = tracked_symbol.threshold
2. Realtime advisory path:
- detect theo threshold he thong
3. Warning:
- neu threshold_user < threshold_system -> tra threshold_warning=true

## 4. No data vs zero count

1. no_data:
- Khong co tick records trong window
2. zero_count:
- Co tick records, nhung khong record nao vuot threshold

Persist trong stats payload:
- data_state: no_data | zero_count | has_signal

## 5. Task contracts

### 5.1 recompute_whale_stats_task

Input:
- job_id
- user_id
- symbols
- session_date(optional)

Output:
- processed_symbols
- updated_rows
- skipped_symbols
- errors

### 5.2 backfill_whale_stats_task

Input:
- job_id
- from_date
- to_date
- symbols
- batch_size(default 20)

Output:
- processed_days
- checkpoints
- no_data_days
- zero_count_days

## 6. Observability

1. Metrics:
- whale_job_total{service_type,status}
- whale_job_duration_seconds
- whale_lock_conflict_total
- whale_trigger_throttled_total
2. Logs:
- include job_id, service_type, user_id, symbol, idempotency_key
3. Alerts:
- FAILED rate > threshold
- lock TTL heartbeat stale

## 7. Backward compatibility

1. Khi migration dang rollout, resolve_threshold_vnd van fallback user_config neu record cu chua duoc fill.
2. Sau khi migration hoan tat, bo fallback branch trong refactor tiep theo.
