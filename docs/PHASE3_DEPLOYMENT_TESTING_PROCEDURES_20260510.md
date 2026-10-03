# PHASE3_DEPLOYMENT_TESTING_PROCEDURES_20260510.md

## Phase 3 Deployment Testing & Validation Procedures

**Date:** 2026-05-12 (Deployment Preparation Day)  
**Execution Window:** 2026-05-13 to 2026-05-15 (Phase 3 Shadow Run)  
**Testing Lead:** ___________________________  
**Approval Signature:** ___________________________

---

## SECTION 1: PRE-DEPLOYMENT TESTING (2026-05-12, Afternoon)

### 1.1 Unit Test Suite: Phase 3 Models

**Objective:** Verify Django ORM models are syntactically correct and migrations valid.

```bash
# Run model validation
cd packages/core/backend/src

# Test 1: Import models
python -c "from ops_audit.models import ParityLog, ParityReport, ParityPhaseCheckpoint; print('✅ Models import successfully')"

# Expected: ✅ Models import successfully

# Test 2: Verify fields
python -c "
from ops_audit.models import ParityLog
fields = [f.name for f in ParityLog._meta.fields]
required_fields = ['endpoint', 'core_status', 'legacy_status', 'parity_score']
missing = [f for f in required_fields if f not in fields]
assert not missing, f'Missing fields: {missing}'
print('✅ ParityLog has all required fields')
"

# Expected: ✅ ParityLog has all required fields

# Test 3: Verify indexes
python -c "
from ops_audit.models import ParityLog
indexes = [idx.name for idx in ParityLog._meta.indexes]
print(f'✅ ParityLog indexes: {indexes}')
"

# Expected: ✅ ParityLog indexes: [list of indexes]

# Test 4: Django validation
python manage.py validate --deploy

# Expected: System check identified no issues (0 silenced)
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 1.2 Unit Test Suite: Phase 3 Middleware

**Objective:** Verify middleware can be imported and initialized without errors.

```bash
cd packages/core/backend/src

# Test 1: Import middleware
python -c "from ops_audit.middleware_shadow_run import ShadowRunDualReadMiddleware; print('✅ Middleware imports successfully')"

# Expected: ✅ Middleware imports successfully

# Test 2: Test middleware initialization
python -c "
from ops_audit.middleware_shadow_run import ShadowRunDualReadMiddleware
from unittest.mock import Mock

# Create mock request
request = Mock()
request.method = 'GET'
request.path = '/api/portfolios/'

# Create mock get_response
get_response = Mock(return_value=Mock(status_code=200))

# Initialize middleware
middleware = ShadowRunDualReadMiddleware(get_response)
print('✅ Middleware initializes successfully')
"

# Expected: ✅ Middleware initializes successfully

# Test 3: Check middleware function signature
python -c "
from ops_audit.middleware_shadow_run import ShadowRunDualReadMiddleware
import inspect
signature = inspect.signature(ShadowRunDualReadMiddleware.__call__)
print(f'✅ Middleware __call__ signature: {signature}')
"

# Expected: ✅ Middleware __call__ signature: (self, request)
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 1.3 Unit Test Suite: Phase 3 Celery Tasks

**Objective:** Verify Celery tasks are properly decorated and callable.

```bash
cd packages/core/backend/src

# Test 1: Import tasks
python -c "
from signal_intelligence.tasks_parity import (
    shadow_run_parity_check_task,
    shadow_run_daily_parity_report
)
print('✅ Both parity tasks import successfully')
"

# Expected: ✅ Both parity tasks import successfully

# Test 2: Verify task decorators
python -c "
from signal_intelligence.tasks_parity import shadow_run_parity_check_task
assert hasattr(shadow_run_parity_check_task, 'apply_async'), 'Task not properly decorated'
print('✅ Task has Celery decorators (@shared_task)')
"

# Expected: ✅ Task has Celery decorators (@shared_task)

# Test 3: Verify task signatures
python -c "
from signal_intelligence.tasks_parity import shadow_run_parity_check_task
import inspect
sig = inspect.signature(shadow_run_parity_check_task)
params = list(sig.parameters.keys())
print(f'✅ Task parameters: {params}')
"

# Expected: ✅ Task parameters: [list of expected params]

# Test 4: Verify task time limits
python -c "
from signal_intelligence.tasks_parity import shadow_run_parity_check_task
time_limit = getattr(shadow_run_parity_check_task, 'time_limit', None)
print(f'✅ Task time_limit configured: {time_limit}')
"

# Expected: ✅ Task time_limit configured: 30
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 1.4 Unit Test Suite: Phase 3 Serializers

**Objective:** Verify DRF serializers can serialize/deserialize parity models.

```bash
cd packages/core/backend/src

# Test 1: Import serializers
python -c "
from ops_audit.serializers import (
    ParityLogSerializer,
    ParityReportSerializer,
    ParityPhaseCheckpointSerializer
)
print('✅ All serializers import successfully')
"

# Expected: ✅ All serializers import successfully

# Test 2: Verify serializer fields
python -c "
from ops_audit.serializers import ParityLogSerializer
serializer = ParityLogSerializer()
fields = list(serializer.fields.keys())
print(f'✅ ParityLogSerializer fields: {fields}')
"

# Expected: ✅ ParityLogSerializer fields: [list of fields]

# Test 3: Test serialization (mock object)
python -c "
from ops_audit.serializers import ParityLogSerializer
from ops_audit.models import ParityLog
from django.utils import timezone

# Create mock object (not saved to DB)
log = ParityLog(
    endpoint='/api/portfolios/',
    core_status=200,
    legacy_status=200,
    parity_score=1.0,
)

serializer = ParityLogSerializer(log)
data = serializer.data
print(f'✅ Serialization works: {list(data.keys())}')
"

# Expected: ✅ Serialization works: [list of serialized fields]
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

## SECTION 2: INTEGRATION TESTING (2026-05-12, Evening)

### 2.1 Integration Test: Database Migration Execution

**Objective:** Verify migrations apply cleanly to production database.

```bash
# Test 1: Dry-run migration
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit --plan

# Expected: Shows 0002_phase3_parity_models migration

# Test 2: Apply migration
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit

# Expected: Applied ops_audit.0002_phase3_parity_models successfully

# Test 3: Verify tables created
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT 
    table_name,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
  FROM information_schema.tables t
  WHERE table_name LIKE 'ops_audit_parity%'
  ORDER BY table_name;
"

# Expected: 3 tables (ParityLog, ParityReport, ParityPhaseCheckpoint)

# Test 4: Verify rollback capability
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit 0001

# Expected: Rolled back successfully

# Test 5: Re-apply migration
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit

# Expected: Applied successfully again
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 2.2 Integration Test: Django Settings & Middleware Registration

**Objective:** Verify middleware is properly registered and doesn't break request flow.

```bash
# Test 1: Check middleware in settings
docker compose -f docker-compose.prod.yml exec core-api \
  python -c "
from django.conf import settings
middleware_list = settings.MIDDLEWARE
phase3_mw = [m for m in middleware_list if 'shadow_run' in m]
print(f'Phase 3 middleware registered: {phase3_mw}')
assert len(phase3_mw) == 1, 'Middleware not properly registered'
"

# Expected: Phase 3 middleware registered: ['ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware']

# Test 2: Django system check
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py check

# Expected: System check identified no issues (0 silenced)

# Test 3: Test request passes through middleware
curl -X GET http://core-api:8000/core/v1/phase3/parity-status/ \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Expected: 200 (or 401 if auth required, but NOT 500)

# Test 4: Verify middleware doesn't block requests
curl -X GET http://core-api:8000/api/portfolios/ \
  -H "Authorization: Bearer <valid-token>" \
  -w "\nStatus: %{http_code}\n"

# Expected: 200 or 401 (middleware doesn't break flow)
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 2.3 Integration Test: Celery Task Execution

**Objective:** Verify Celery can execute Phase 3 tasks without errors.

```bash
# Test 1: Check tasks registered
docker compose -f docker-compose.prod.yml exec core-worker \
  celery -A vninvest_core inspect registered --timeout=5 \
  | grep "shadow_run"

# Expected: Both tasks listed

# Test 2: Test task queueing (mock test)
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py shell << 'EOF'
from signal_intelligence.tasks_parity import shadow_run_parity_check_task

# Queue a test task
task_id = shadow_run_parity_check_task.apply_async(
    args=('/api/portfolios/', 200, 200, 0.001, {'status': 'test'}),
    countdown=0
)
print(f"Task queued: {task_id}")
print("✅ Task queueing works")
EOF

# Expected: ✅ Task queueing works

# Test 3: Verify task execution (after a few seconds)
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT COUNT(*) as parity_logs FROM ops_audit_parity_log WHERE created_at > NOW() - INTERVAL '1 minute';
"

# Expected: >= 1 (at least 1 test log created)

# Test 4: Check Celery beat scheduler
docker compose -f docker-compose.prod.yml exec core-beat \
  celery -A vninvest_core inspect scheduled --timeout=5

# Expected: Shows scheduled parity tasks
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 2.4 Integration Test: API Endpoints & Parity Monitoring

**Objective:** Verify API endpoints return correct responses and data format.

```bash
# Test 1: Get parity status
curl -X GET http://core-api:8000/core/v1/phase3/parity-status/ \
  -H "Content-Type: application/json" | python -m json.tool

# Expected response format:
# {
#   "phase_status": "not_started|in_progress|completed",
#   "phase_number": 3,
#   "current_day": 0,
#   "days_remaining": 3,
#   "parity_progress": {
#     "day_1": {...},
#     "day_2": {...},
#     "day_3": {...}
#   },
#   "recommendation": "YELLOW|GREEN|RED"
# }

# Test 2: Get parity reports
curl -X GET "http://core-api:8000/core/v1/phase3/parity-reports/?day=1" \
  -H "Content-Type: application/json" | python -m json.tool

# Expected response format:
# {
#   "count": X,
#   "results": [
#     {
#       "day": 1,
#       "endpoint": "/api/portfolios/",
#       "avg_parity_score": 0.99,
#       "request_count": 100,
#       "recommendation": "GREEN"
#     }
#   ]
# }

# Test 3: Get parity logs (paginated)
curl -X GET "http://core-api:8000/core/v1/phase3/parity-logs/?page=1&page_size=10" \
  -H "Content-Type: application/json" | python -m json.tool

# Expected: Paginated list of parity logs

# Test 4: Test Tech Lead sign-off endpoint (should fail without proper auth)
curl -X POST http://core-api:8000/core/v1/phase3/parity-signoff/ \
  -H "Content-Type: application/json" \
  -d '{"day": 1, "approved": true}' \
  -w "\nStatus: %{http_code}\n"

# Expected: 401 or 403 (requires Tech Lead permission)
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

## SECTION 3: END-TO-END TESTING (2026-05-12, Late Evening)

### 3.1 E2E Test: Complete Request-to-Parity-Log Flow

**Objective:** Verify end-to-end flow from request to parity log entry.

```bash
# Step 1: Enable shadow run
docker compose -f docker-compose.prod.yml exec core-api \
  python -c "import os; print(f'Shadow run enabled: {os.getenv(\"PHASE3_SHADOW_RUN_ENABLED\") == \"true\"}')"

# Expected: Shadow run enabled: True

# Step 2: Count parity logs before test
BEFORE=$(docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -t -c "
  SELECT COUNT(*) FROM ops_audit_parity_log WHERE created_at > NOW() - INTERVAL '5 minutes';
" | xargs)

echo "Parity logs before: $BEFORE"

# Step 3: Send test request to monitored endpoint
curl -X GET http://core-api:8000/api/portfolios/ \
  -H "Authorization: Bearer <valid-token>" \
  -w "\nStatus: %{http_code}\n"

# Expected: 200 or 401 (normal response)

# Step 4: Wait for async task
sleep 5

# Step 5: Count parity logs after test
AFTER=$(docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -t -c "
  SELECT COUNT(*) FROM ops_audit_parity_log WHERE created_at > NOW() - INTERVAL '5 minutes';
" | xargs)

echo "Parity logs after: $AFTER"

# Step 6: Verify log was created
if [ "$AFTER" -gt "$BEFORE" ]; then
    echo "✅ Parity log created successfully (E2E flow working)"
else
    echo "❌ No parity log created (E2E flow broken)"
fi

# Step 7: Inspect latest parity log
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT endpoint, core_status, legacy_status, parity_score, created_at 
  FROM ops_audit_parity_log 
  ORDER BY created_at DESC 
  LIMIT 5;
"

# Expected: Recent entries with valid scores
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

### 3.2 E2E Test: Daily Parity Report Generation

**Objective:** Verify daily parity report generation works correctly.

```bash
# Step 1: Manually trigger daily parity report task
docker compose -f docker-compose.prod.yml exec core-worker \
  python manage.py shell << 'EOF'
from signal_intelligence.tasks_parity import shadow_run_daily_parity_report

# Trigger task
task_id = shadow_run_daily_parity_report.apply_async()
print(f"Daily report task queued: {task_id}")
EOF

# Expected: Daily report task queued: [task_id]

# Step 2: Wait for task execution
sleep 10

# Step 3: Check if report was created
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT day_number, endpoint, avg_parity_score, recommendation, created_at 
  FROM ops_audit_parity_report 
  ORDER BY created_at DESC 
  LIMIT 1;
"

# Expected: Recent report entry with valid recommendation (YELLOW, GREEN, or RED)

# Step 4: Verify parity phase checkpoint updated
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -c "
  SELECT phase_number, status, tech_lead_signed, signed_at 
  FROM ops_audit_parity_phase_checkpoint 
  WHERE phase_number = 3;
"

# Expected: Phase 3 entry exists
```

**Test Result: ☐ PASS | ☐ FAIL**  
**Notes:** ___________________________

---

## SECTION 4: DEPLOYMENT SIGN-OFF FORM

**All tests must PASS before proceeding with Phase 3 execution.**

### Test Summary

| Test Suite | Result | Notes |
|-----------|--------|-------|
| 1.1 Models | ☐ PASS ☐ FAIL | _________________ |
| 1.2 Middleware | ☐ PASS ☐ FAIL | _________________ |
| 1.3 Tasks | ☐ PASS ☐ FAIL | _________________ |
| 1.4 Serializers | ☐ PASS ☐ FAIL | _________________ |
| 2.1 Migration | ☐ PASS ☐ FAIL | _________________ |
| 2.2 Settings | ☐ PASS ☐ FAIL | _________________ |
| 2.3 Celery | ☐ PASS ☐ FAIL | _________________ |
| 2.4 API | ☐ PASS ☐ FAIL | _________________ |
| 3.1 E2E Request Flow | ☐ PASS ☐ FAIL | _________________ |
| 3.2 Daily Report | ☐ PASS ☐ FAIL | _________________ |

**Total Tests:** 10  
**Passed:** _____  
**Failed:** _____  

### Approval Sign-Off

**Testing Lead:** ___________________________

**Testing Conclusion:**
- [ ] All 10 tests PASSED — Phase 3 deployment is APPROVED
- [ ] Some tests FAILED — Phase 3 deployment is BLOCKED (see notes above)

**Tech Lead Approval:** ___________________________  
**Date/Time:** ___________________________

**Remarks:**

___________________________________________________________________________

___________________________________________________________________________

**Phase 3 is ready for execution on 2026-05-13.**
