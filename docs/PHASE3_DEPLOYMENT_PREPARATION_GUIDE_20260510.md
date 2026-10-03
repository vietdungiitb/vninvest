"""
Phase 3 Deployment Preparation Guide (2026-05-12)

Complete step-by-step instructions for deploying Phase 3 Shadow Run infrastructure
to production environment before execution window (2026-05-13).

Estimated time: 2-3 hours (including validation + dry-run)
Risk level: MEDIUM (requires environment changes + code reload)
Rollback time: 15 minutes (disable PHASE3_SHADOW_RUN_ENABLED, restart services)
"""

# ==============================================================================
# PART 1: PRE-DEPLOYMENT VALIDATION (30 minutes)
# ==============================================================================

## Step 1.1: Verify Code Syntax (All Phase 3 files)

Command to validate Python syntax across all new Phase 3 files:

```bash
cd /path/to/vninvest/packages/core/backend/src

# Test imports
python -m py_compile ops_audit/models_parity.py
python -m py_compile ops_audit/middleware_shadow_run.py
python -m py_compile ops_audit/views_parity.py
python -m py_compile ops_audit/serializers_parity.py
python -m py_compile ops_audit/urls_parity.py
python -m py_compile signal_intelligence/tasks_parity.py

# Expected: No output (success)
```

Expected output: Silent (no errors)

---

## Step 1.2: Verify Django Migration Files

```bash
cd /path/to/vninvest/packages/core/backend/src

# Check migration syntax
python manage.py validate --deploy
python manage.py migrate --plan

# Expected: No errors, shows migration 0002_phase3_parity_models
```

Key validation points:
- ✅ 3 CreateModel operations (ParityLog, ParityReport, ParityPhaseCheckpoint)
- ✅ 5 AddIndex operations (proper field ordering)
- ✅ No validation errors from Django
- ✅ Can rollback (no irreversible operations)

---

## Step 1.3: Verify Task Registration

```bash
# In production environment, check Celery can discover tasks:

docker compose -f docker-compose.prod.yml exec core-worker \
  celery -A vninvest_core inspect registered --timeout=5 \
  | grep -E "shadow_run_parity_check|shadow_run_daily_parity"

# Expected output: Both tasks listed
```

Expected output:
```
'signal_intelligence.tasks_parity.shadow_run_parity_check_task'
'signal_intelligence.tasks_parity.shadow_run_daily_parity_report'
```

---

## Step 1.4: Verify API Endpoints Discoverable

```bash
# In staging/dev environment:

curl http://core-api:8000/api/phase3/parity-status/ -v
# Expected: 404 (not found) — normal until PHASE3_SHADOW_RUN_ENABLED=true

# After deployment, should return 200 with phase status JSON
```

---

# ==============================================================================
# PART 2: ENVIRONMENT CONFIGURATION (45 minutes)
# ==============================================================================

## Step 2.1: Update docker-compose.prod.yml

Add these environment variables to ALL 3 services that need them:
- `core-api` (primary request handler)
- `core-worker` (task processor)
- `core-beat` (scheduler)

**Location in docker-compose.prod.yml:**

```yaml
services:
  core-api:
    image: vninvest-core-api:latest
    environment:
      # ... existing vars ...
      
      # Phase 3 Shadow Run Configuration
      PHASE3_SHADOW_RUN_ENABLED: 'true'
      CORE_API_SHADOW_RUN_ENDPOINT: 'http://core-api:8000'
      PHASE3_SHADOW_RUN_TIMEOUT: '5.0'
      PHASE3_MONITORED_ENDPOINTS: '/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/'
  
  core-worker:
    image: vninvest-core-api:latest
    command: celery -A vninvest_core worker --loglevel=info
    environment:
      # ... existing vars ...
      
      # Phase 3 Shadow Run (same as core-api)
      PHASE3_SHADOW_RUN_ENABLED: 'true'
      CORE_API_SHADOW_RUN_ENDPOINT: 'http://core-api:8000'
      PHASE3_SHADOW_RUN_TIMEOUT: '5.0'
      PHASE3_MONITORED_ENDPOINTS: '/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/'
  
  core-beat:
    image: vninvest-core-api:latest
    command: celery -A vninvest_core beat --loglevel=info --scheduler=django_celery_beat.schedulers:DatabaseScheduler
    environment:
      # ... existing vars ...
      
      # Phase 3 Shadow Run (same as core-api)
      PHASE3_SHADOW_RUN_ENABLED: 'true'
      CORE_API_SHADOW_RUN_ENDPOINT: 'http://core-api:8000'
      PHASE3_SHADOW_RUN_TIMEOUT: '5.0'
      PHASE3_MONITORED_ENDPOINTS: '/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/'
```

**Validation command:**
```bash
docker compose -f docker-compose.prod.yml config | grep -A 5 "PHASE3_SHADOW_RUN_ENABLED"
# Should show 3 occurrences (core-api, core-worker, core-beat)
```

---

## Step 2.2: Update vninvest_core/settings.py (Middleware Registration)

**File:** `packages/core/backend/src/vninvest_core/settings.py`

**Location:** Find the MIDDLEWARE list (around line 50-100)

**Add this line** (position: near end of MIDDLEWARE list, after auth middleware):

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'rest_framework.authentication.TokenAuthentication',
    'identity_access.middleware.X_Request_ID_Middleware',
    
    # Phase 3 Shadow Run middleware (non-blocking)
    'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware',
]
```

**Validation command:**
```bash
docker compose -f docker-compose.prod.yml exec core-api \
  python -c "from django.conf import settings; print([m for m in settings.MIDDLEWARE if 'shadow_run' in m])"
  
# Expected: ['ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware']
```

---

## Step 2.3: Update vninvest_core/celery_config.py (Beat Schedule)

**File:** `packages/core/backend/src/vninvest_core/celery_config.py`

**Location:** Find CELERY_BEAT_SCHEDULE dict

**Add this task definition:**

```python
CELERY_BEAT_SCHEDULE = {
    # ... existing tasks ...
    
    # Phase 3: Daily parity report (EOD)
    'shadow-run-daily-parity-report': {
        'task': 'signal_intelligence.tasks_parity.shadow_run_daily_parity_report',
        'schedule': crontab(hour=2, minute=30),  # 2:30 AM UTC (after market close)
        'options': {
            'queue': 'celery',
            'priority': 10,
            'time_limit': 60,
            'soft_time_limit': 55,
        },
    },
}
```

**Validation command:**
```bash
docker compose -f docker-compose.prod.yml exec core-beat \
  python manage.py shell -c "from vninvest_core.celery_config import CELERY_BEAT_SCHEDULE; print([k for k in CELERY_BEAT_SCHEDULE.keys() if 'shadow' in k])"
  
# Expected: ['shadow-run-daily-parity-report']
```

---

## Step 2.4: Update vninvest_core/urls.py (API Routing)

**File:** `packages/core/backend/src/vninvest_core/urls.py`

**Location:** Find urlpatterns = [...]

**Add this include statement:**

```python
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('rest_framework.urls')),
    
    # Core API routes
    path('core/v1/', include('identity_access.urls')),
    path('core/v1/', include('market_serving.urls')),
    path('core/v1/', include('signal_intelligence.urls')),
    path('core/v1/', include('commercial.urls')),
    path('core/v1/', include('ops_audit.urls')),
    path('core/v1/', include('data_ingest.urls')),
    path('core/v1/', include('advisory.urls')),
    path('core/v1/', include('user_workspace.urls')),
    path('core/v1/', include('market_data.urls')),
    
    # Phase 3: Parity monitoring API routes
    path('core/v1/', include('ops_audit.urls_parity')),
]
```

**Validation command:**
```bash
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py show_urls 2>/dev/null | grep "phase3"
  
# Expected: List of /core/v1/phase3/* routes
```

---

# ==============================================================================
# PART 3: DATABASE MIGRATION (30 minutes)
# ==============================================================================

## Step 3.1: Apply Migration to Production DB

```bash
# In production environment:

docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit --plan

# Review the plan (should show 0002_phase3_parity_models migration)

# Then apply:
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit

# Expected: Applied successfully
```

**Validation command:**
```bash
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT COUNT(*) as tables FROM information_schema.tables 
  WHERE table_name LIKE 'ops_audit_parity%';
"

# Expected: 3 (ParityLog, ParityReport, ParityPhaseCheckpoint)
```

---

## Step 3.2: Verify Table Schemas

```bash
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  \d ops_audit_parity_log;
  \d ops_audit_parity_report;
  \d ops_audit_parity_phase_checkpoint;
"

# Should show all columns + indexes
```

---

## Step 3.3: Verify Indexes Created

```bash
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT indexname FROM pg_indexes 
  WHERE tablename LIKE 'ops_audit_parity%' 
  ORDER BY tablename, indexname;
"

# Expected: 5 indexes (created_at, parity_status, x_request_id for ParityLog; report_date, parity_pass for ParityReport)
```

---

# ==============================================================================
# PART 4: DOCKER BUILD & DEPLOYMENT (30 minutes)
# ==============================================================================

## Step 4.1: Rebuild Docker Images

```bash
# Build with all Phase 3 code:
docker compose -f docker-compose.prod.yml build \
  --no-cache \
  core-api core-worker core-beat

# Expected: Build successful, no compilation errors
```

---

## Step 4.2: Restart Services

```bash
# Stop existing services
docker compose -f docker-compose.prod.yml stop core-api core-worker core-beat

# Wait 5 seconds
sleep 5

# Start fresh
docker compose -f docker-compose.prod.yml up -d core-api core-worker core-beat

# Wait 30 seconds for initialization
sleep 30

# Check health
docker compose -f docker-compose.prod.yml ps | grep core-
```

**Expected output:** All 3 services showing "Up" status

---

## Step 4.3: Verify Service Logs (No Errors)

```bash
# Check core-api logs for import errors
docker compose -f docker-compose.prod.yml logs core-api --tail 50 | grep -E "ERROR|Traceback|Exception" || echo "✅ No errors in core-api"

# Check core-worker logs
docker compose -f docker-compose.prod.yml logs core-worker --tail 50 | grep -E "ERROR|Traceback|Exception" || echo "✅ No errors in core-worker"

# Check core-beat logs
docker compose -f docker-compose.prod.yml logs core-beat --tail 50 | grep -E "ERROR|Traceback|Exception" || echo "✅ No errors in core-beat"
```

---

# ==============================================================================
# PART 5: DRY-RUN VALIDATION (45 minutes)
# ==============================================================================

## Step 5.1: Dry-Run Mode (PHASE3_SHADOW_RUN_ENABLED=false)

**Purpose:** Verify all infrastructure is working WITHOUT actually running shadow checks.

**Step A: Disable shadow run for dry-run**

```bash
# In docker-compose.prod.yml, change:
PHASE3_SHADOW_RUN_ENABLED: 'false'  # Temporarily disabled for validation

docker compose -f docker-compose.prod.yml up -d core-api
sleep 15
```

**Step B: Verify API endpoints return 200**

```bash
# Test parity status endpoint (should return JSON, no errors)
curl -X GET http://core-api:8000/core/v1/phase3/parity-status/ \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Expected: 200 (with "phase_status": "not_started" in response)
```

**Step C: Verify Celery tasks are registered**

```bash
docker compose -f docker-compose.prod.yml exec core-worker \
  celery -A vninvest_core inspect registered --timeout=5 \
  | grep "shadow_run"

# Expected: Both tasks listed
```

**Step D: Verify middleware loads without errors**

```bash
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py check

# Expected: System check identified no issues (0 silenced)
```

---

## Step 5.2: Test Request Flow (Without Parity Checks)

**Purpose:** Verify requests still work normally when shadow run disabled.

```bash
# Make a test request to a monitored endpoint
curl -X GET http://core-api:8000/api/portfolios/ \
  -H "Authorization: Bearer <valid-token>" \
  -w "\nStatus: %{http_code}\n"

# Expected: Normal response (200 or 401 if auth required, but NOT 500)
```

---

## Step 5.3: Enable Shadow Run & Validate First Request

**Step A: Enable shadow run**

```bash
# In docker-compose.prod.yml, change:
PHASE3_SHADOW_RUN_ENABLED: 'true'

docker compose -f docker-compose.prod.yml up -d core-api core-worker
sleep 15
```

**Step B: Make test request**

```bash
# Trigger a request to monitored endpoint
curl -X GET http://core-api:8000/api/portfolios/ \
  -H "Authorization: Bearer <valid-token>" \
  -w "\nStatus: %{http_code}\n"

# Expected: 200 (request succeeds)
```

**Step C: Check ParityLog table for first entry**

```bash
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT COUNT(*) as parity_logs FROM ops_audit_parity_log;
"

# Expected: >= 1 (at least 1 shadow request captured)
```

**Step D: Check that latency is acceptable**

```bash
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT 
    endpoint,
    AVG(latency_delta_ms) as avg_latency_delta,
    MAX(latency_delta_ms) as max_latency_delta
  FROM ops_audit_parity_log
  WHERE created_at > NOW() - INTERVAL '5 minutes'
  GROUP BY endpoint;
"

# Expected: Latency delta < 500ms for 95% of requests
```

---

# ==============================================================================
# PART 6: PRE-FLIGHT CHECKLIST (15 minutes)
# ==============================================================================

Copy & print this checklist. Tech Lead must sign off on ALL items before Phase 3 start.

---

### PRE-FLIGHT CHECKLIST FOR PHASE 3 (2026-05-12)

**Tech Lead Name:** ___________________________  
**Date:** ___________________________  
**Approval Signature:** ___________________________

**All items must be ✅ PASS before proceeding.**

---

#### DATABASE & MIGRATION

- [ ] ✅ Migration 0002_phase3_parity_models applied successfully
- [ ] ✅ 3 parity tables created (ParityLog, ParityReport, ParityPhaseCheckpoint)
- [ ] ✅ 5 indexes created (verified via information_schema)
- [ ] ✅ Zero validation errors from Django check
- [ ] ✅ Can rollback (no irreversible operations)

**Sign-off:** _______________

---

#### CODE & IMPORTS

- [ ] ✅ All 8 Phase 3 Python files syntax valid (py_compile)
- [ ] ✅ Middleware imports correctly in settings.py
- [ ] ✅ Celery tasks registered (inspect registered shows both)
- [ ] ✅ URL routing includes ops_audit.urls_parity
- [ ] ✅ Zero import errors in core-api logs

**Sign-off:** _______________

---

#### ENVIRONMENT CONFIGURATION

- [ ] ✅ docker-compose.prod.yml includes all 4 PHASE3_* env vars
- [ ] ✅ Vars set in ALL 3 services (core-api, core-worker, core-beat)
- [ ] ✅ Vars verified via docker compose config
- [ ] ✅ PHASE3_SHADOW_RUN_ENABLED = 'true' (ready to run)

**Sign-off:** _______________

---

#### DOCKER SERVICES

- [ ] ✅ All 3 services (core-api, core-worker, core-beat) Up
- [ ] ✅ Zero error lines in logs for all 3 services
- [ ] ✅ core-api health check passing (GET /health 200)
- [ ] ✅ core-worker celery ready (inspect registered works)
- [ ] ✅ core-beat scheduler ready (tasks listed)

**Sign-off:** _______________

---

#### API & ENDPOINTS

- [ ] ✅ GET /core/v1/phase3/parity-status/ returns 200
- [ ] ✅ ParityLog table receives entries (first test request logged)
- [ ] ✅ Latency delta < 500ms for test requests (acceptable)
- [ ] ✅ Middleware NOT blocking request flow
- [ ] ✅ Monitored endpoints still serving correctly

**Sign-off:** _______________

---

#### CELERY & TASKS

- [ ] ✅ Both parity tasks discoverable (shadow_run_parity_check, shadow_run_daily_parity_report)
- [ ] ✅ Celery beat schedule includes shadow_run_daily_parity_report
- [ ] ✅ Schedule crontab(hour=2, minute=30) correct (2:30 AM UTC)
- [ ] ✅ Task time limits reasonable (30s task, 60s report)
- [ ] ✅ No task registration errors in logs

**Sign-off:** _______________

---

#### BACKUP & ROLLBACK

- [ ] ✅ Database backed up (pre-deployment backup taken)
- [ ] ✅ Rollback procedure documented (PHASE3_SHADOW_RUN_ENABLED=false)
- [ ] ✅ Rollback RTO < 15 minutes confirmed
- [ ] ✅ Contact list updated (Tech Lead, DevOps, Backend Lead)

**Sign-off:** _______________

---

#### MONITORING & ALERTING

- [ ] ✅ Real-time log monitoring commands prepared
- [ ] ✅ SQL monitoring queries ready (parity flow, daily reports, failures)
- [ ] ✅ Dashboard endpoints accessible (parity-status, parity-report, parity-logs)
- [ ] ✅ On-call rotation updated for 3-day window

**Sign-off:** _______________

---

#### FINAL APPROVAL

**Phase 3 deployment preparation is COMPLETE and APPROVED for execution on 2026-05-13.**

**Tech Lead confirms:**
- [ ] All 8 checkpoints signed off
- [ ] Zero blockers identified
- [ ] Ready to start Phase 3 shadow run
- [ ] Have reviewed Phase 3 execution checklist (docs/PHASE3_SHADOW_RUN_EXECUTION_CHECKLIST_20260510.md)

**Tech Lead Signature:** ___________________________  
**Date/Time:** ___________________________

---

# ==============================================================================
# PART 7: DEPLOYMENT DAY QUICK REFERENCE (2026-05-12)
# ==============================================================================

## Final Deployment Command (all-in-one)

```bash
# 1. Apply migration
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit

# 2. Rebuild images
docker compose -f docker-compose.prod.yml build --no-cache core-api core-worker core-beat

# 3. Restart services
docker compose -f docker-compose.prod.yml up -d core-api core-worker core-beat

# 4. Wait for initialization
sleep 30

# 5. Verify health
docker compose -f docker-compose.prod.yml ps | grep core-

# 6. Run system checks
docker compose -f docker-compose.prod.yml exec core-api python manage.py check

# 7. Test endpoint
curl http://core-api:8000/core/v1/phase3/parity-status/
```

---

## Rollback Command (if needed)

```bash
# Disable shadow run immediately
docker compose -f docker-compose.prod.yml exec core-api \
  echo "PHASE3_SHADOW_RUN_ENABLED=false" >> /etc/environment

# Restart services
docker compose -f docker-compose.prod.yml restart core-api core-worker core-beat

# Verify disabled
curl http://core-api:8000/core/v1/phase3/parity-status/
# Should return: {"phase_status": "not_started", ...}
```

---

## Emergency Contact Escalation (2026-05-13 to 2026-05-15)

- **Tech Lead (Final decision):** [NAME, PHONE, EMAIL]
- **DevOps On-Call (Service ops):** [NAME, PHONE, EMAIL]
- **Backend Lead (Code issues):** [NAME, PHONE, EMAIL]
- **Incident Commander:** [NAME, PHONE, EMAIL]

Escalation: Warning → Alert → Critical (within 5 minutes)

---

**Document Status:** READY FOR DEPLOYMENT PREPARATION  
**Date:** 2026-05-10  
**Prepared by:** Platform Engineering  
**Tech Lead Review Required:** YES
"""
