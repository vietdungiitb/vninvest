#!/bin/bash
# PHASE3_DEPLOYMENT_VALIDATION_SCRIPT_20260510.sh
# 
# Complete validation script for Phase 3 deployment
# Run this AFTER deployment but BEFORE Phase 3 execution
# 
# Usage: bash PHASE3_DEPLOYMENT_VALIDATION_SCRIPT_20260510.sh
# 
# Exit codes:
#   0 = All validation passed
#   1 = Critical validation failed (abort deployment)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VALIDATION_PASS=0
VALIDATION_FAIL=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((VALIDATION_PASS++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((VALIDATION_FAIL++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "======================================================================"
echo "PHASE 3 DEPLOYMENT VALIDATION"
echo "======================================================================"
echo ""

# ==============================================================================
# 1. DATABASE VALIDATION
# ==============================================================================
echo ""
echo "1. DATABASE VALIDATION"
echo "----------------------------------------------------------------------"

# Check ParityLog table exists
TABLE_COUNT=$(docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -t -c "
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_name IN ('ops_audit_parity_log', 'ops_audit_parity_report', 'ops_audit_parity_phase_checkpoint');
" | xargs)

if [ "$TABLE_COUNT" = "3" ]; then
    pass "All 3 parity tables exist (ParityLog, ParityReport, ParityPhaseCheckpoint)"
else
    fail "Expected 3 parity tables, found $TABLE_COUNT"
fi

# Check indexes
INDEX_COUNT=$(docker compose -f docker-compose.prod.yml exec db psql -U postgres -d vninvest_core -t -c "
  SELECT COUNT(*) FROM pg_indexes 
  WHERE tablename LIKE 'ops_audit_parity%';
" | xargs)

if [ "$INDEX_COUNT" -ge "5" ]; then
    pass "Parity indexes created ($INDEX_COUNT found)"
else
    fail "Expected >= 5 indexes, found $INDEX_COUNT"
fi

# Check migration applied
MIGRATION_APPLIED=$(docker compose -f docker-compose.prod.yml exec core-api python manage.py showmigrations ops_audit 2>/dev/null | grep "0002_phase3_parity_models" | grep -c "X" || echo "0")

if [ "$MIGRATION_APPLIED" = "1" ]; then
    pass "Migration 0002_phase3_parity_models applied"
else
    fail "Migration 0002_phase3_parity_models not applied"
fi

# ==============================================================================
# 2. DJANGO CONFIGURATION VALIDATION
# ==============================================================================
echo ""
echo "2. DJANGO CONFIGURATION VALIDATION"
echo "----------------------------------------------------------------------"

# Check middleware registered
MIDDLEWARE_CHECK=$(docker compose -f docker-compose.prod.yml exec core-api python -c "
from django.conf import settings
print('ShadowRunDualReadMiddleware' in str(settings.MIDDLEWARE))
" 2>/dev/null)

if [ "$MIDDLEWARE_CHECK" = "True" ]; then
    pass "ShadowRunDualReadMiddleware registered in MIDDLEWARE"
else
    fail "ShadowRunDualReadMiddleware not found in MIDDLEWARE"
fi

# Check Django system check
DJANGO_CHECK=$(docker compose -f docker-compose.prod.yml exec core-api python manage.py check 2>&1 | grep -c "error" || echo "0")

if [ "$DJANGO_CHECK" = "0" ]; then
    pass "Django system check passed (zero errors)"
else
    fail "Django system check reported errors"
fi

# Check environment variables set
ENV_VAR_CHECK=$(docker compose -f docker-compose.prod.yml exec core-api python -c "
import os
vars_to_check = ['PHASE3_SHADOW_RUN_ENABLED', 'CORE_API_SHADOW_RUN_ENDPOINT', 'PHASE3_SHADOW_RUN_TIMEOUT']
missing = [v for v in vars_to_check if not os.getenv(v)]
print(len(missing) == 0)
" 2>/dev/null)

if [ "$ENV_VAR_CHECK" = "True" ]; then
    pass "All Phase 3 environment variables set"
else
    fail "Some Phase 3 environment variables missing"
fi

# ==============================================================================
# 3. CELERY CONFIGURATION VALIDATION
# ==============================================================================
echo ""
echo "3. CELERY CONFIGURATION VALIDATION"
echo "----------------------------------------------------------------------"

# Check tasks registered
TASK_CHECK=$(docker compose -f docker-compose.prod.yml exec core-worker celery -A vninvest_core inspect registered --timeout=5 2>/dev/null | grep -c "shadow_run" || echo "0")

if [ "$TASK_CHECK" = "2" ]; then
    pass "Both shadow run tasks registered (shadow_run_parity_check, shadow_run_daily_parity_report)"
else
    warn "Expected 2 shadow run tasks, found $TASK_CHECK"
fi

# Check beat schedule
BEAT_SCHEDULE=$(docker compose -f docker-compose.prod.yml exec core-beat python -c "
from vninvest_core.celery_config import CELERY_BEAT_SCHEDULE
print('shadow-run-daily-parity-report' in CELERY_BEAT_SCHEDULE)
" 2>/dev/null)

if [ "$BEAT_SCHEDULE" = "True" ]; then
    pass "Celery beat schedule includes shadow-run-daily-parity-report"
else
    fail "shadow-run-daily-parity-report not in Celery beat schedule"
fi

# ==============================================================================
# 4. API ENDPOINT VALIDATION
# ==============================================================================
echo ""
echo "4. API ENDPOINT VALIDATION"
echo "----------------------------------------------------------------------"

# Check core-api is responding
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://core-api:8000/core/v1/phase3/parity-status/ || echo "000")

if [ "$API_HEALTH" = "200" ] || [ "$API_HEALTH" = "401" ]; then
    pass "API endpoint /core/v1/phase3/parity-status/ responding ($API_HEALTH)"
else
    fail "API endpoint /core/v1/phase3/parity-status/ not responding (HTTP $API_HEALTH)"
fi

# Check URL routing
URL_ROUTING=$(docker compose -f docker-compose.prod.yml exec core-api python manage.py show_urls 2>/dev/null | grep -c "phase3" || echo "0")

if [ "$URL_ROUTING" -ge "1" ]; then
    pass "Phase 3 URL routes registered ($URL_ROUTING found)"
else
    fail "Phase 3 URL routes not found"
fi

# ==============================================================================
# 5. SERVICE HEALTH VALIDATION
# ==============================================================================
echo ""
echo "5. SERVICE HEALTH VALIDATION"
echo "----------------------------------------------------------------------"

# Check core-api service
CORE_API_STATUS=$(docker compose -f docker-compose.prod.yml ps core-api | grep "Up" -c || echo "0")

if [ "$CORE_API_STATUS" = "1" ]; then
    pass "core-api service is Up"
else
    fail "core-api service is not running"
fi

# Check core-worker service
CORE_WORKER_STATUS=$(docker compose -f docker-compose.prod.yml ps core-worker | grep "Up" -c || echo "0")

if [ "$CORE_WORKER_STATUS" = "1" ]; then
    pass "core-worker service is Up"
else
    fail "core-worker service is not running"
fi

# Check core-beat service
CORE_BEAT_STATUS=$(docker compose -f docker-compose.prod.yml ps core-beat | grep "Up" -c || echo "0")

if [ "$CORE_BEAT_STATUS" = "1" ]; then
    pass "core-beat service is Up"
else
    fail "core-beat service is not running"
fi

# ==============================================================================
# 6. LOG VALIDATION (No Critical Errors)
# ==============================================================================
echo ""
echo "6. LOG VALIDATION"
echo "----------------------------------------------------------------------"

# Check core-api logs for errors
CORE_API_ERRORS=$(docker compose -f docker-compose.prod.yml logs core-api --tail 100 2>/dev/null | grep -i "error\|traceback\|exception" -c || echo "0")

if [ "$CORE_API_ERRORS" = "0" ]; then
    pass "core-api logs: zero critical errors"
else
    warn "core-api logs: $CORE_API_ERRORS error lines found (may be non-critical)"
fi

# Check core-worker logs
CORE_WORKER_ERRORS=$(docker compose -f docker-compose.prod.yml logs core-worker --tail 100 2>/dev/null | grep -i "error\|traceback\|exception" -c || echo "0")

if [ "$CORE_WORKER_ERRORS" = "0" ]; then
    pass "core-worker logs: zero critical errors"
else
    warn "core-worker logs: $CORE_WORKER_ERRORS error lines found (may be non-critical)"
fi

# ==============================================================================
# 7. DRY-RUN TEST (Optional)
# ==============================================================================
echo ""
echo "7. DRY-RUN TEST (Shadow Run Disabled)"
echo "----------------------------------------------------------------------"

# Check that requests work when PHASE3_SHADOW_RUN_ENABLED=false
SHADOW_RUN_DISABLED=$(docker compose -f docker-compose.prod.yml exec core-api python -c "
import os
print(os.getenv('PHASE3_SHADOW_RUN_ENABLED', 'false') == 'false')
" 2>/dev/null)

if [ "$SHADOW_RUN_DISABLED" = "True" ]; then
    warn "Running in DRY-RUN mode (PHASE3_SHADOW_RUN_ENABLED=false)"
    warn "Ensure PHASE3_SHADOW_RUN_ENABLED=true before 2026-05-13 execution"
else
    pass "Shadow run is ENABLED and ready for execution"
fi

# ==============================================================================
# SUMMARY
# ==============================================================================
echo ""
echo "======================================================================"
echo "VALIDATION SUMMARY"
echo "======================================================================"
echo -e "✅ PASS: $VALIDATION_PASS"
echo -e "❌ FAIL: $VALIDATION_FAIL"
echo ""

if [ "$VALIDATION_FAIL" = "0" ]; then
    echo -e "${GREEN}🎉 ALL VALIDATIONS PASSED${NC}"
    echo "Phase 3 deployment is READY for execution on 2026-05-13"
    exit 0
else
    echo -e "${RED}⚠️  CRITICAL VALIDATIONS FAILED${NC}"
    echo "Fix the above failures before proceeding with Phase 3 execution"
    exit 1
fi
