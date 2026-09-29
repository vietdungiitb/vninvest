## P3 (Celery Task Porting) Implementation Summary — 2026-05-13

### ✅ Completed Tasks

#### P3-T01: Port vnbroker_ingest_daily_prices → core-worker task
- **Implementation**: `packages/core/backend/src/data_ingest/tasks.py::ingest_daily_prices()`
- **Features**:
  - Wrapper around existing `backfill_daily_prices` task
  - Handles daily OHLCV data ingestion with multi-provider round-robin
  - Observability: Creates IngestRun record for monitoring
  - Retry policy: 3 retries with exponential backoff (60s, 120s, 240s)
  - Supports both full universe (all active StockProfile) and specific symbol lists
  
- **Code Quality**:
  - Full docstring with usage context
  - Exception handling with IngestRun state tracking
  - Timeout: 3600s (1 hour) for backfill completion
  - Provider threading: Uses ThreadPoolExecutor for parallelization

- **Integration Points**:
  - Called by: django-celery-beat scheduler (after market close ~17:00 VN time)
  - Called by: Admin manual trigger endpoint (P3-T02)

#### P3-T02: Create admin trigger REST endpoints
- **Implementation**: `packages/core/backend/src/data_ingest/views.py` + `urls.py`
  
- **Endpoints Created**:
  1. `POST /core/v1/data-ingest/trigger/daily-prices/` — Manually trigger daily price ingest
     - Request: `{ "days": 1, "symbols": ["VNM", "BCM"] }`
     - Response: 202 ACCEPTED with task_id
     - Rate limited: 10/hour (IsAdminUser only)
     
  2. `POST /core/v1/data-ingest/trigger/price-board/` — Refresh current price board
     - No parameters needed
     - Calls: `fetch_and_upsert_price_board` task
     
  3. `GET /core/v1/data-ingest/task-status/{task_id}/` — Check Celery task status
     - Returns: task status, result, error (if any)
     
  4. `GET /core/v1/data-ingest/jobs/` — List ingest job configs (admin only)
  5. `GET /core/v1/data-ingest/runs/` — List ingest execution history (paginated, admin only)

- **API Contracts**:
  - Serializers: TriggerIngestRequestSerializer, IngestTriggerResponseSerializer, IngestJobSerializer, IngestRunSerializer
  - Pagination: StandardPageNumberPagination for runs list
  - Error handling: 401 (unauthenticated), 403 (non-admin), 429 (rate limited), 500 (task queue error)
  - Response envelope: Standard {detail, code, timestamp, request_id} for errors

- **Security**:
  - Permission: IsAdminUser (blocks non-admin access)
  - Rate limiting: 10 trigger requests/hour per admin user
  - Audit logging: Each trigger logged with username and parameters

- **Verification**:
  - ✅ core-api container built and running (image: vninvest-dev-core-runtime)
  - ✅ URL routing registered at vninvest_core.urls
  - ✅ Endpoints return 401 auth error (expected behavior without token)
  - ✅ No import errors or syntax errors

### 📋 Remaining P3 Task

#### P3-T03: Shadow run + parity check
- **Objective**: Run ingest_daily_prices task daily for 3 trading days, verify data parity
- **Metrics to Track**:
  - Rows upserted per day (target: ~60 * 1 OHLCV record = 60 rows if all symbols have new price)
  - Failed symbols (target: 0)
  - Provider distribution (vci + kbs should be roughly equal)
  - Task execution time (target: < 5 minutes)
  
- **Parity Gates** (Requirement §8.5):
  - Daily upserted count matches expected universe size
  - No data loss (count(core_db.DailyPrice) >= count(vninvest.DailyPrice) for same date)
  - Error rate < 1% (failed symbols / total symbols)
  
- **Scheduling**:
  - Need to add django-celery-beat PeriodicTask entry: `ingest_daily_prices` daily at 17:00 VN time
  - OR: Trigger manually 3 days via endpoint for testing before schedule

### 🔧 Files Changed (P3-T01, P3-T02)

| File | Lines | Purpose |
|------|-------|---------|
| packages/core/backend/src/data_ingest/tasks.py | +80 | Added `ingest_daily_prices()` task with observability |
| packages/core/backend/src/data_ingest/serializers.py | +74 | 4 serializer classes for API contracts |
| packages/core/backend/src/data_ingest/views.py | +226 | 3 viewsets + 4 REST endpoints for admin triggers |
| packages/core/backend/src/data_ingest/urls.py | +11 | Router registration for viewsets |
| packages/core/backend/src/vninvest_core/urls.py | +1 | Include data_ingest.urls in core-api |

**Total**: 5 files, 392 lines of code (new)

### ✅ Build & Test Results

```
Docker build: SUCCESS (vninvest-dev-core-runtime built)
Core-api health: ✓ OK (status=ok, package=vninvest-core)
Endpoint tests:
  POST /core/v1/data-ingest/trigger/daily-prices/  → 401 (auth required) ✓
  GET  /core/v1/data-ingest/jobs/                 → 401 (auth required) ✓
  GET  /core/v1/data-ingest/task-status/{id}/     → Expected response ✓
```

### 🎯 Architecture Checkpoint

**Core-worker Topology (P3):**
- ✅ ingest_daily_prices task queued in core-worker (Celery)
- ✅ Admin REST endpoints for manual/scheduled triggering
- ✅ Observability: IngestRun records created for each execution
- ✅ Retry handling: Exponential backoff on transient errors
- ✅ Rate limiting: 10 triggers/hour per admin (prevents abuse)

**Next Step**: Execute P3-T03 shadow run for 3 days, verify parity gates before production scheduling.

