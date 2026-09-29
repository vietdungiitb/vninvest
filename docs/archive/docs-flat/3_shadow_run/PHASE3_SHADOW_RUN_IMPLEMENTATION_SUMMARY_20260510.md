"""
Phase 3 Shadow Run Implementation Summary

Completed artifacts for Phase 3 Shadow Run execution (2026-05-10).
Ready for deployment and execution starting 2026-05-13.

This document provides a complete overview of all code, models, views,
tasks, and configuration required to run Phase 3 parity verification.
"""

# ==============================================================================
# IMPLEMENTATION SUMMARY
# ==============================================================================

## 1. DATABASE MODELS (ops_audit/models_parity.py)

Created 3 new Django models to track Phase 3 shadow run:

### ParityLog
- Single request-pair entry (every request during shadow run)
- Captures: legacy response, core response, comparison details
- Stores: status codes, payloads, hashes, latency delta, parity_score
- Used for: Detailed forensics, request-level debugging
- Table: ops_audit_parity_log
- Indexes: created_at, parity_status, x_request_id

### ParityReport
- Daily aggregated report per endpoint
- Stores: total requests, match/warning/mismatch/error counts
- Computes: avg_parity_score, min_parity_score, median latency
- Recommendation: green/yellow/red (go/no-go)
- Table: ops_audit_parity_report
- Unique constraint: (endpoint, report_date)

### ParityPhaseCheckpoint
- Tracks Phase 3 overall progress across 3 days
- Records: day1/2/3 dates and parity_scores
- Flags: all_days_complete, all_days_pass
- Sign-off: tech_lead_sign_off, sign_off_date, sign_off_by
- Table: ops_audit_parity_phase_checkpoint

---

## 2. MIDDLEWARE (ops_audit/middleware_shadow_run.py)

### ShadowRunDualReadMiddleware
- Intercepts every API request during Phase 3
- Forwards shadow request to core-api asynchronously (non-blocking)
- Compares responses (status, structure, payload)
- Logs parity result to ParityLog async
- Features:
  - Only active if PHASE3_SHADOW_RUN_ENABLED=true
  - Monitored endpoints configurable (PHASE3_MONITORED_ENDPOINTS env var)
  - Timeout: 5s default (configurable)
  - Never blocks or affects primary request flow

Helper functions:
- compute_payload_hash(payload): SHA256 hash
- compare_json_structure(legacy_json, core_json): Structure comparison
- _compare_structure_recursive(): Deep structure traversal

---

## 3. CELERY TASKS (signal_intelligence/tasks_parity.py)

### shadow_run_parity_check_task
- Shared task (queued by middleware)
- Makes shadow request to core-api
- Compares: status codes, JSON structure, row counts, latency
- Scores: 0.0-1.0 based on 4 components (25% each)
- Logs to ParityLog table
- Retry: max 2 retries on transient errors
- Time limit: 30 seconds (soft 25s)

Scoring logic:
- Status match: 25%
- Structure match: 25%
- Payload match: 25%
- Latency < 500ms: 25%
- Final score: average of 4 components

### shadow_run_daily_parity_report
- Scheduled task (Celery beat)
- Runs at 2:30 AM UTC daily (after market close)
- Aggregates all ParityLog entries for the day
- Groups by endpoint
- Creates ParityReport for each endpoint
- Recommends go/no-go:
  - GREEN: avg_parity >= 0.99
  - YELLOW: avg_parity in [0.95, 0.99)
  - RED: avg_parity < 0.95
- Identifies critical failures (status mismatch, etc)
- Time limit: 60 seconds

---

## 4. API VIEWS (ops_audit/views_parity.py)

### ParityStatusView (GET /core/v1/phase3/parity-status/)
- Returns current Phase 3 status and 3-day progress
- Data: phase_status, day1/2/3 results, monitored endpoints
- Response includes: all_days_complete, all_days_pass, final_decision

### ParityReportListView (GET /core/v1/phase3/parity-report/)
- List daily reports for an endpoint
- Query params: endpoint, date_from, date_to
- Returns: aggregated metrics per day
- Used by: Operations dashboard

### ParityLogListView (GET /core/v1/phase3/parity-logs/)
- List raw parity logs for forensics
- Query params: endpoint, parity_status, x_request_id
- Returns: all ParityLog entries matching filters
- Used by: Detailed investigation, root cause analysis

### ParityPhaseCheckpointSignOffView (POST /core/v1/phase3/phase-checkpoint/sign-off/)
- Tech Lead sign-off for Phase 3 completion
- Body: { approved, tech_lead_name, notes }
- Only admin users (Tech Lead)
- Validation: all 3 days must be complete + pass
- Result: Updates checkpoint.tech_lead_sign_off + phase_status

---

## 5. SERIALIZERS (ops_audit/serializers_parity.py)

### ParityLogSerializer
- All ParityLog fields
- Read-only: id, created_at
- Used by: ParityLogListView

### ParityReportSerializer
- All ParityReport fields
- Read-only: id, created_at, updated_at
- Used by: ParityReportListView

### ParityPhaseCheckpointSerializer
- All ParityPhaseCheckpoint fields
- Read-only: id, created_at, updated_at
- Used by: ParityPhaseCheckpointSignOffView

---

## 6. URL ROUTING (ops_audit/urls_parity.py)

Parity monitoring endpoints:
```
/core/v1/phase3/parity-status/              GET   ParityStatusView
/core/v1/phase3/parity-report/              GET   ParityReportListView (with filters)
/core/v1/phase3/parity-logs/                GET   ParityLogListView (with filters)
/core/v1/phase3/phase-checkpoint/sign-off/  POST  ParityPhaseCheckpointSignOffView
```

---

## 7. DATABASE MIGRATION (ops_audit/migrations/0002_phase3_parity_models.py)

Creates 3 new tables + 5 indexes:
- ops_audit_parity_log (500K+ entries expected during 3 days)
- ops_audit_parity_report (3 endpoints × 3 days = ~9 entries)
- ops_audit_parity_phase_checkpoint (1 entry)

Indexes optimized for:
- Time-series queries (created_at, report_date)
- Status filtering (parity_status)
- Request tracking (x_request_id)

---

## 8. DEPLOYMENT CHECKLIST (PHASE3_SHADOW_RUN_EXECUTION_CHECKLIST_20260510.md)

Comprehensive pre-execution + execution checklist including:

**Pre-execution (Before 2026-05-13):**
- Database migration
- Environment variables setup
- Middleware registration
- Celery beat schedule
- URL routing
- Task registration
- Docker build + restart
- Sanity checks
- Monitoring dashboard setup
- Escalation contacts

**Execution (3-day trading window):**
- Hourly check-ins per day
- Success criteria per day
- Decision logic (GREEN/YELLOW/RED)
- Incident response scenarios
- Rollback procedure
- Tech Lead sign-off requirements

---

## 9. ENVIRONMENT VARIABLES (Required)

Add to docker-compose.prod.yml for all core services:

```yaml
PHASE3_SHADOW_RUN_ENABLED=true                           # Enable middleware
CORE_API_SHADOW_RUN_ENDPOINT=http://core-api:8000       # Target for shadow reads
PHASE3_SHADOW_RUN_TIMEOUT=5.0                            # Timeout in seconds
PHASE3_MONITORED_ENDPOINTS=/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/
```

---

## 10. MIDDLEWARE REGISTRATION (vninvest_core/settings.py)

Add to MIDDLEWARE list (near end):
```python
'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware'
```

---

## 11. CELERY BEAT SCHEDULE (vninvest_core/celery_config.py)

Add to CELERY_BEAT_SCHEDULE:
```python
'shadow-run-daily-parity-report': {
    'task': 'signal_intelligence.tasks_parity.shadow_run_daily_parity_report',
    'schedule': crontab(hour=2, minute=30),  # 2:30 AM UTC
    'options': {'queue': 'celery', 'priority': 10, 'time_limit': 60},
},
```

---

## 12. URL INCLUSION (vninvest_core/urls.py)

Add to main urlpatterns:
```python
path('core/v1/', include('ops_audit.urls_parity')),
```

---

## 13. MONITORING QUERIES (SQL)

Ready-to-use queries for operations dashboard:

1. Real-time parity flow (5-min rolling window)
2. Daily report summary (3-day view)
3. Critical failures (alerts)
4. Phase 3 checkpoint status (current state)

---

# ARTIFACTS CREATED (2026-05-10)

## Code Files (8 new files)

1. ✅ packages/core/backend/src/ops_audit/models_parity.py (330 lines)
2. ✅ packages/core/backend/src/ops_audit/middleware_shadow_run.py (250 lines)
3. ✅ packages/core/backend/src/signal_intelligence/tasks_parity.py (450 lines)
4. ✅ packages/core/backend/src/ops_audit/views_parity.py (280 lines)
5. ✅ packages/core/backend/src/ops_audit/serializers_parity.py (80 lines)
6. ✅ packages/core/backend/src/ops_audit/urls_parity.py (50 lines)
7. ✅ packages/core/backend/src/ops_audit/migrations/0002_phase3_parity_models.py (180 lines)

## Documentation Files (1 new file)

8. ✅ docs/PHASE3_SHADOW_RUN_EXECUTION_CHECKLIST_20260510.md (400+ lines)

**Total new code:** ~1,600 lines of production-ready Python

---

# DEPLOYMENT STEPS (Quick reference)

## Step 1: Apply migration
```bash
docker compose -f docker-compose.prod.yml exec core-api python manage.py migrate ops_audit
```

## Step 2: Add environment variables
```bash
# In docker-compose.prod.yml under services.core-api, core-worker, core-beat:
- PHASE3_SHADOW_RUN_ENABLED=true
- CORE_API_SHADOW_RUN_ENDPOINT=http://core-api:8000
- PHASE3_SHADOW_RUN_TIMEOUT=5.0
- PHASE3_MONITORED_ENDPOINTS=...
```

## Step 3: Register middleware
```python
# In vninvest_core/settings.py MIDDLEWARE list:
'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware'
```

## Step 4: Register Celery task
```python
# In vninvest_core/celery_config.py CELERY_BEAT_SCHEDULE:
'shadow-run-daily-parity-report': { ... }
```

## Step 5: Register URLs
```python
# In vninvest_core/urls.py:
path('core/v1/', include('ops_audit.urls_parity')),
```

## Step 6: Rebuild and restart
```bash
docker compose -f docker-compose.prod.yml up -d --build core-api core-worker core-beat
```

## Step 7: Verify
```bash
curl http://core-api:8000/core/v1/phase3/parity-status/
```

---

# EXECUTION TIMELINE

- **2026-05-10:** Implementation complete ✅
- **2026-05-12:** Pre-deployment review + sign-off
- **2026-05-13 09:00 UTC:** Phase 3 Day 1 START
- **2026-05-14 09:00 UTC:** Phase 3 Day 2
- **2026-05-15 09:00 UTC:** Phase 3 Day 3
- **2026-05-15 20:00 UTC:** Decision point (GREEN/YELLOW/RED)
- **2026-05-20:** Phase 4 production cutover (if GREEN)

---

# SUCCESS CRITERIA

Phase 3 is **COMPLETE and APPROVED** when:

- ✅ Day 1 avg_parity_score >= 0.99
- ✅ Day 2 avg_parity_score >= 0.99
- ✅ Day 3 avg_parity_score >= 0.99
- ✅ All monitored endpoints recommendation='green'
- ✅ Zero critical failures (status code mismatches, etc)
- ✅ Latency delta < 500ms for 95%+ of requests
- ✅ Tech Lead sign-off received

**Result: APPROVED FOR PHASE 4 PRODUCTION CUTOVER** 🚀

---

**Document Status:** READY FOR PRODUCTION DEPLOYMENT  
**Date:** 2026-05-10  
**Prepared by:** Platform Engineering  
**Review:** Tech Lead + DevOps Lead
"""
