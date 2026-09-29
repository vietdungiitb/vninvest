# Backend Design — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## 1. Mục tiêu backend

1. Chuyển backfill từ full-universe schedule semantics sang planner-first execution.
2. Bổ sung run/progress truth cho scheduler jobs và manual runs.
3. Đảm bảo executor đủ nhanh, idempotent, quota-aware và audit-friendly.

---

## 2. Kiến trúc backend

### 2.1 Coordinator
- `service_ops/views/scheduler.py`
- `service_ops/scheduler_catalog.py`
- `service_ops/dataops_market_data.py`
- `market_data/global_symbol_planner.py`

### 2.2 Executors
- `data_ingest/tasks.py`
- future targeted repair executors / repair-missing dispatchers

### 2.3 Persistence
- `ServiceRunLog`
- `BackfillExecutionRun`
- `BackfillExecutionBatch`
- `GlobalSymbolRegistry`
- `GlobalSymbolCoverage`
- `DailyPrice`

---

## 3. Execution flow

1. Build coverage-gap inventory.
2. Rank symbols theo tier/gap/demand/promotion recency.
3. Preview plan cho operator nếu manual.
4. Create run record (`queued`).
5. Dispatch provider buckets theo queue/quota/concurrency policy.
6. Update batch progress trong lúc chạy.
7. Persist terminal state + summary.
8. Expose progress/history/anomaly summaries qua DataOps API.

---

## 4. Reliability patterns

1. bounded retries + exponential backoff.
2. terminal-state guard clear inflight marker.
3. idempotent upsert cho `DailyPrice`.
4. partial success allowed with explicit failed symbols summary.
5. lock/cooldown/quota để tránh queue flood.

---

## 5. API and ops requirements

1. Không mutate DB trực tiếp từ frontend.
2. Operator actions phải qua audited scheduler/dataops services.
3. Jobs backfill phải có history mapping chuẩn và progress API.
4. Error responses theo envelope chuẩn OpenAPI policy.

---

## 6. Test requirements

1. scheduler truth tests.
2. run progress persistence tests.
3. planner ranking tests.
4. executor mode tests.
5. DataOps API contract tests.
