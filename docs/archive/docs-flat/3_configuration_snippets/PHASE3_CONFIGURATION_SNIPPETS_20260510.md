# PHASE3_CONFIGURATION_SNIPPETS_20260510.md

## Phase 3 Configuration Snippets (Copy-Paste Ready)

**Purpose:** Complete configuration templates for Phase 3 deployment on 2026-05-12.  
**Format:** YAML (docker-compose), Python (Django/Celery), BASH (scripts)

---

## SECTION 1: docker-compose.prod.yml Environment Variables

Copy this ENTIRE block into each service section:

### A. core-api Service

**Location in docker-compose.prod.yml:** Under `services: -> core-api: -> environment:`

```yaml
services:
  core-api:
    image: vninvest-core-api:latest
    container_name: core-api
    ports:
      - "8000:8000"
    environment:
      # ... (existing environment variables) ...
      
      # Phase 3 Shadow Run Configuration (NEW)
      PHASE3_SHADOW_RUN_ENABLED: "true"
      CORE_API_SHADOW_RUN_ENDPOINT: "http://core-api:8000"
      PHASE3_SHADOW_RUN_TIMEOUT: "5.0"
      PHASE3_MONITORED_ENDPOINTS: "/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/"
      PHASE3_PARITY_CHECK_LOG_LEVEL: "INFO"
      PHASE3_PARITY_REPORT_TIME: "02:30"  # UTC (2:30 AM = after market close)
      
    # ... (rest of core-api config) ...
```

### B. core-worker Service

**Location in docker-compose.prod.yml:** Under `services: -> core-worker: -> environment:`

```yaml
services:
  core-worker:
    image: vninvest-core-api:latest
    container_name: core-worker
    command: celery -A vninvest_core worker --loglevel=info --concurrency=4
    environment:
      # ... (existing environment variables) ...
      
      # Phase 3 Shadow Run Configuration (NEW)
      PHASE3_SHADOW_RUN_ENABLED: "true"
      CORE_API_SHADOW_RUN_ENDPOINT: "http://core-api:8000"
      PHASE3_SHADOW_RUN_TIMEOUT: "5.0"
      PHASE3_MONITORED_ENDPOINTS: "/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/"
      PHASE3_PARITY_CHECK_LOG_LEVEL: "INFO"
      PHASE3_PARITY_REPORT_TIME: "02:30"  # UTC
      
    # ... (rest of core-worker config) ...
    depends_on:
      - redis
      - db
```

### C. core-beat Service

**Location in docker-compose.prod.yml:** Under `services: -> core-beat: -> environment:`

```yaml
services:
  core-beat:
    image: vninvest-core-api:latest
    container_name: core-beat
    command: celery -A vninvest_core beat --loglevel=info --scheduler=django_celery_beat.schedulers:DatabaseScheduler
    environment:
      # ... (existing environment variables) ...
      
      # Phase 3 Shadow Run Configuration (NEW)
      PHASE3_SHADOW_RUN_ENABLED: "true"
      CORE_API_SHADOW_RUN_ENDPOINT: "http://core-api:8000"
      PHASE3_SHADOW_RUN_TIMEOUT: "5.0"
      PHASE3_MONITORED_ENDPOINTS: "/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/"
      PHASE3_PARITY_CHECK_LOG_LEVEL: "INFO"
      PHASE3_PARITY_REPORT_TIME: "02:30"  # UTC
      
    # ... (rest of core-beat config) ...
    depends_on:
      - redis
      - db
```

---

## SECTION 2: vninvest_core/settings.py Middleware Registration

**File:** `packages/core/backend/src/vninvest_core/settings.py`  
**Location:** Find the `MIDDLEWARE = [` line (around line 50-100)

### Current MIDDLEWARE List (Example)

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

### Updated MIDDLEWARE List (Add this line)

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
    # Phase 3 Shadow Run Middleware (NEW) - Add at end before closing bracket
    'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware',
]
```

**Important:** Add the middleware AFTER authentication middleware but BEFORE any custom middleware.

---

## SECTION 3: vninvest_core/celery_config.py Beat Schedule

**File:** `packages/core/backend/src/vninvest_core/celery_config.py`  
**Location:** Find the `CELERY_BEAT_SCHEDULE = {` line

### Current CELERY_BEAT_SCHEDULE (Example)

```python
CELERY_BEAT_SCHEDULE = {
    'materialize-symbol-snapshots-every-minute': {
        'task': 'market_serving.tasks.materialize_symbol_snapshots',
        'schedule': crontab(minute='*'),
        'options': {'queue': 'celery', 'priority': 5},
    },
    'materialize-session-facts-every-5-minutes': {
        'task': 'signal_intelligence.tasks.materialize_session_facts',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'celery', 'priority': 5},
    },
}
```

### Updated CELERY_BEAT_SCHEDULE (Add this task)

```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'materialize-symbol-snapshots-every-minute': {
        'task': 'market_serving.tasks.materialize_symbol_snapshots',
        'schedule': crontab(minute='*'),
        'options': {'queue': 'celery', 'priority': 5},
    },
    'materialize-session-facts-every-5-minutes': {
        'task': 'signal_intelligence.tasks.materialize_session_facts',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'celery', 'priority': 5},
    },
    
    # Phase 3 Shadow Run Tasks (NEW)
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

---

## SECTION 4: vninvest_core/urls.py URL Routing

**File:** `packages/core/backend/src/vninvest_core/urls.py`  
**Location:** Find the `urlpatterns = [` line

### Current urlpatterns (Example)

```python
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('rest_framework.urls')),
    path('core/v1/', include('identity_access.urls')),
    path('core/v1/', include('market_serving.urls')),
    path('core/v1/', include('signal_intelligence.urls')),
]
```

### Updated urlpatterns (Add this include)

```python
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('rest_framework.urls')),
    path('core/v1/', include('identity_access.urls')),
    path('core/v1/', include('market_serving.urls')),
    path('core/v1/', include('signal_intelligence.urls')),
    path('core/v1/', include('commercial.urls')),
    path('core/v1/', include('ops_audit.urls')),
    path('core/v1/', include('data_ingest.urls')),
    path('core/v1/', include('advisory.urls')),
    path('core/v1/', include('user_workspace.urls')),
    path('core/v1/', include('market_data.urls')),
    
    # Phase 3 Shadow Run API Routes (NEW)
    path('core/v1/', include('ops_audit.urls_parity')),
]
```

---

## SECTION 5: Environment Variables Template (.env.prod)

**File:** `.env.prod` (create if doesn't exist)  
**Location:** Root of vninvest project

```bash
# Phase 3 Shadow Run Configuration
# Copy these variables to docker-compose.prod.yml environment section

# Global Flag (CRITICAL - controls all Phase 3 functionality)
PHASE3_SHADOW_RUN_ENABLED=true

# Core API Endpoint (where shadow requests are sent)
CORE_API_SHADOW_RUN_ENDPOINT=http://core-api:8000

# Request timeout for shadow parity checks (seconds)
PHASE3_SHADOW_RUN_TIMEOUT=5.0

# Comma-separated list of endpoints to monitor
# These must match actual request paths in your application
PHASE3_MONITORED_ENDPOINTS=/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/

# Log level for parity check operations
PHASE3_PARITY_CHECK_LOG_LEVEL=INFO

# Time of day for daily parity report generation (UTC)
PHASE3_PARITY_REPORT_TIME=02:30

# Optional: Parity score thresholds (for automation)
PHASE3_PARITY_THRESHOLD_GREEN=0.99
PHASE3_PARITY_THRESHOLD_YELLOW=0.95
PHASE3_PARITY_THRESHOLD_RED=0.90
```

---

## SECTION 6: Quick Deployment Commands

### Build Docker Images

```bash
# Build all 3 Phase 3 services (no cache)
cd c:/Mujoco\ Projects/vninvest

docker compose -f docker-compose.prod.yml build \
  --no-cache \
  core-api core-worker core-beat

# Expected: Build successful, all 3 images tagged
```

### Deploy Services

```bash
# Stop existing services
docker compose -f docker-compose.prod.yml stop core-api core-worker core-beat

# Wait 10 seconds for graceful shutdown
sleep 10

# Start fresh services
docker compose -f docker-compose.prod.yml up -d core-api core-worker core-beat

# Wait 30 seconds for initialization
sleep 30

# Verify all services are Up
docker compose -f docker-compose.prod.yml ps | grep core-
```

### Run Validation

```bash
# Apply database migration
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit

# Run validation script
bash scripts/PHASE3_DEPLOYMENT_VALIDATION_SCRIPT_20260510.sh

# Expected output: All 7 validation groups PASSED
```

---

## SECTION 7: Verification Commands (Post-Deployment)

### Verify Environment Variables

```bash
# Check all Phase 3 vars are set in core-api
docker compose -f docker-compose.prod.yml exec core-api python -c "
import os
vars_to_check = [
    'PHASE3_SHADOW_RUN_ENABLED',
    'CORE_API_SHADOW_RUN_ENDPOINT',
    'PHASE3_SHADOW_RUN_TIMEOUT',
    'PHASE3_MONITORED_ENDPOINTS'
]
for var in vars_to_check:
    value = os.getenv(var, 'NOT SET')
    print(f'{var}: {value}')
"

# Expected: All 4 variables set with correct values
```

### Verify Middleware

```bash
# Check middleware is registered
docker compose -f docker-compose.prod.yml exec core-api python -c "
from django.conf import settings
mw_list = settings.MIDDLEWARE
phase3_mw = [m for m in mw_list if 'shadow_run' in m]
if phase3_mw:
    print('✅ Phase 3 middleware registered:')
    for m in phase3_mw:
        print(f'  - {m}')
else:
    print('❌ Phase 3 middleware NOT found')
"

# Expected: ✅ Phase 3 middleware registered: ['ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware']
```

### Verify Celery Tasks

```bash
# Check tasks are registered
docker compose -f docker-compose.prod.yml exec core-worker \
  celery -A vninvest_core inspect registered --timeout=5 \
  | grep -E "shadow_run_parity_check|shadow_run_daily_parity_report"

# Expected: Both tasks listed
```

### Verify Database Tables

```bash
# Check tables created
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
SELECT table_name, column_count
FROM (
  SELECT table_name, COUNT(*) as column_count
  FROM information_schema.columns
  WHERE table_name LIKE 'ops_audit_parity%'
  GROUP BY table_name
) t
ORDER BY table_name;
"

# Expected: 3 tables (ParityLog, ParityReport, ParityPhaseCheckpoint)
```

### Verify API Endpoints

```bash
# Test parity status endpoint
curl -X GET http://core-api:8000/core/v1/phase3/parity-status/ \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Expected: 200 with JSON response like:
# {
#   "phase_status": "not_started",
#   "phase_number": 3,
#   "current_day": 0,
#   ...
# }
```

---

## SECTION 8: Emergency Disable Command

If you need to immediately disable Phase 3 shadow run (emergency rollback):

```bash
# Option A: Via environment variable (fastest)
docker compose -f docker-compose.prod.yml exec core-api \
  python -c "
import os
os.environ['PHASE3_SHADOW_RUN_ENABLED'] = 'false'
print('✅ Phase 3 disabled (requires restart to fully take effect)')
"

# Option B: Restart all services with PHASE3_SHADOW_RUN_ENABLED=false
# Edit docker-compose.prod.yml, change PHASE3_SHADOW_RUN_ENABLED to "false"
docker compose -f docker-compose.prod.yml up -d --no-deps core-api core-worker core-beat

# Option C: Complete rollback (restore from backup)
cp docker-compose.prod.yml.backup docker-compose.prod.yml
cp packages/core/backend/src/vninvest_core/settings.py.backup \
   packages/core/backend/src/vninvest_core/settings.py
docker compose -f docker-compose.prod.yml restart core-api core-worker core-beat
```

---

## Summary of Configuration Files

| File | Location | Change | Type |
|------|----------|--------|------|
| docker-compose.prod.yml | Root | Add 4 PHASE3_* env vars to 3 services | YAML |
| settings.py | packages/core/backend/src/vninvest_core/ | Add middleware to MIDDLEWARE list | Python |
| celery_config.py | packages/core/backend/src/vninvest_core/ | Add daily parity task to CELERY_BEAT_SCHEDULE | Python |
| urls.py | packages/core/backend/src/vninvest_core/ | Add ops_audit.urls_parity include | Python |
| .env.prod | Root (create if needed) | Phase 3 environment variable reference | BASH |

**All changes are idempotent and can be applied multiple times without errors.**

---

**Configuration Package Status:** READY FOR 2026-05-12 DEPLOYMENT  
**Last Updated:** 2026-05-10  
**Prepared by:** Platform Engineering
