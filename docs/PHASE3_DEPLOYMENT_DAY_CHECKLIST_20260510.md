# PHASE3_DEPLOYMENT_DAY_CHECKLIST_20260510.md

## Phase 3 Deployment Day Checklist (2026-05-12)

**Deployment Window:** 2026-05-12, 8:00 AM UTC to 6:00 PM UTC  
**Phase 3 Execution Start:** 2026-05-13, 2:00 AM UTC (Day 1)  
**Contact:** Tech Lead + Platform Engineering  

---

## TIMELINE & TEAM ASSIGNMENTS

### 08:00 - 09:00 UTC: PRE-DEPLOYMENT VALIDATION (1 hour)

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Verify git code pulled to production | DevOps | ☐ | git pull origin dev |
| Backup production database | DBA | ☐ | pg_dump with compression |
| Test backup restore capability | DBA | ☐ | Verify rollback snapshot works |
| Verify legacy backend health | Backend Lead | ☐ | Health checks passing |
| Verify core-api staging health | Backend Lead | ☐ | No error logs |
| Review Phase 3 docs (30 min) | Tech Lead | ☐ | Execution checklist + procedures |

**Sign-off:** DBA __________ | Backend Lead __________ | Tech Lead __________

---

### 09:00 - 10:30 UTC: CONFIGURATION PATCHING (1.5 hours)

| Task | Owner | Status | Command |
|------|-------|--------|---------|
| 1. Backup docker-compose.prod.yml | DevOps | ☐ | cp docker-compose.prod.yml{,.backup} |
| 2. Patch docker-compose env vars | DevOps | ☐ | Run config patcher script |
| 3. Backup vninvest_core/settings.py | DevOps | ☐ | cp settings.py{,.backup} |
| 4. Patch MIDDLEWARE list | DevOps | ☐ | Add ShadowRunDualReadMiddleware |
| 5. Verify docker-compose syntax | DevOps | ☐ | docker compose -f ... config |
| 6. Verify Django settings syntax | DevOps | ☐ | python manage.py check |

**Validation Commands:**
```bash
# Docker syntax
docker compose -f docker-compose.prod.yml config > /dev/null && echo "✅ Syntax valid"

# Django settings
docker compose -f docker-compose.prod.yml exec core-api python manage.py check
```

**Sign-off:** DevOps __________

---

### 10:30 - 11:15 UTC: DATABASE MIGRATION (45 minutes)

| Task | Owner | Status | Command |
|------|-------|--------|---------|
| 1. Dry-run migration | DBA | ☐ | python manage.py migrate ops_audit --plan |
| 2. Create migration backup | DBA | ☐ | pg_dump pre-migration.dump.gz |
| 3. Apply migration | DBA | ☐ | python manage.py migrate ops_audit |
| 4. Verify tables created | DBA | ☐ | SELECT COUNT(*) FROM ops_audit_parity* |
| 5. Verify indexes | DBA | ☐ | SELECT COUNT(*) FROM pg_indexes |
| 6. Test migration rollback | DBA | ☐ | migrate to 0001, then re-apply |

**Validation Results:**
```
Tables created: 3 (ParityLog, ParityReport, ParityPhaseCheckpoint)
Indexes created: 5+ (verified)
Rollback capability: ✅ Confirmed
```

**Sign-off:** DBA __________

---

### 11:15 - 12:30 UTC: DOCKER BUILD & DEPLOYMENT (1.25 hours)

| Task | Owner | Status | Command |
|------|-------|--------|---------|
| 1. Build core-api image | DevOps | ☐ | docker compose -f ... build core-api --no-cache |
| 2. Build core-worker image | DevOps | ☐ | docker compose -f ... build core-worker --no-cache |
| 3. Build core-beat image | DevOps | ☐ | docker compose -f ... build core-beat --no-cache |
| 4. Stop existing services | DevOps | ☐ | docker compose -f ... stop |
| 5. Wait 10 seconds | DevOps | ☐ | sleep 10 |
| 6. Start fresh services | DevOps | ☐ | docker compose -f ... up -d |
| 7. Wait for initialization | DevOps | ☐ | sleep 30 |
| 8. Check service status | DevOps | ☐ | docker compose -f ... ps |

**Validation Results:**
```
core-api:      Up (verify with docker ps)
core-worker:   Up (verify with docker ps)
core-beat:     Up (verify with docker ps)
```

**Sign-off:** DevOps __________

---

### 12:30 - 13:45 UTC: SERVICE VALIDATION (1.25 hours)

| Task | Owner | Status | Validation |
|------|-------|--------|------------|
| 1. Check core-api logs | Backend Lead | ☐ | No ERROR, Traceback, or Exception |
| 2. Check core-worker logs | Backend Lead | ☐ | No ERROR, Traceback, or Exception |
| 3. Check core-beat logs | Backend Lead | ☐ | No ERROR, Traceback, or Exception |
| 4. Test parity status endpoint | QA | ☐ | HTTP 200, valid JSON response |
| 5. Test parity reports endpoint | QA | ☐ | HTTP 200, empty list (normal) |
| 6. Test parity logs endpoint | QA | ☐ | HTTP 200, paginated results |
| 7. Verify middleware registered | Backend Lead | ☐ | In settings.MIDDLEWARE list |
| 8. Verify tasks registered | Backend Lead | ☐ | celery inspect registered shows tasks |

**Validation Commands:**
```bash
# Logs (no errors)
docker compose -f docker-compose.prod.yml logs core-api | grep -i "error" || echo "✅ No errors"

# Endpoints
curl http://core-api:8000/core/v1/phase3/parity-status/ -w "\n%{http_code}\n"

# Middleware
docker compose -f docker-compose.prod.yml exec core-api python -c \
  "from django.conf import settings; print('✅ OK' if 'ShadowRunDualReadMiddleware' in str(settings.MIDDLEWARE) else '❌ FAIL')"

# Tasks
docker compose -f docker-compose.prod.yml exec core-worker celery -A vninvest_core inspect registered
```

**Sign-off:** Backend Lead __________ | QA __________

---

### 13:45 - 14:30 UTC: DRY-RUN TESTING (45 minutes)

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| 1. Make test request to endpoint | QA | ☐ | GET /api/portfolios/ (or any monitored endpoint) |
| 2. Wait 5 seconds for async task | QA | ☐ | Allow shadow run task to complete |
| 3. Check ParityLog table for entry | QA | ☐ | SELECT COUNT(*) should increase |
| 4. Verify parity score calculated | QA | ☐ | 0.0 - 1.0 range, non-null |
| 5. Verify middleware latency < 500ms | QA | ☐ | Request response time acceptable |
| 6. Test 5+ requests to different endpoints | QA | ☐ | Verify multiple endpoints tracked |

**Validation SQL:**
```sql
-- Before test
SELECT COUNT(*) as before_count FROM ops_audit_parity_log WHERE created_at > NOW() - INTERVAL '10 minutes';

-- Send test requests...

-- After test
SELECT COUNT(*) as after_count FROM ops_audit_parity_log WHERE created_at > NOW() - INTERVAL '10 minutes';

-- Inspect logs
SELECT endpoint, core_status, legacy_status, parity_score, latency_delta_ms 
FROM ops_audit_parity_log 
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

**Expected Results:**
- ✅ Parity logs increasing
- ✅ Scores between 0.0 and 1.0
- ✅ Latency delta < 500ms

**Sign-off:** QA __________

---

### 14:30 - 15:15 UTC: INTEGRATION TESTING (45 minutes)

Run full test suite from `PHASE3_DEPLOYMENT_TESTING_PROCEDURES_20260510.md`:

| Test Category | Owner | Status | Result |
|---------------|-------|--------|--------|
| Unit Tests (Models) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |
| Unit Tests (Middleware) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |
| Unit Tests (Tasks) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |
| Unit Tests (Serializers) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |
| Integration Tests (Migration) | DBA | ☐ | ☐ PASS ☐ FAIL |
| Integration Tests (Settings) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |
| Integration Tests (Celery) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |
| Integration Tests (API) | QA | ☐ | ☐ PASS ☐ FAIL |
| E2E Test (Request Flow) | QA | ☐ | ☐ PASS ☐ FAIL |
| E2E Test (Daily Report) | Backend Lead | ☐ | ☐ PASS ☐ FAIL |

**Total Tests:** 10  
**Passed:** ___  
**Failed:** ___

**Failure Handling:**
- If ANY test fails: Stop deployment, investigate root cause, update Phase 3 code, re-test
- If ALL tests pass: Continue to final approval

**Sign-off:** Testing Lead __________

---

### 15:15 - 16:00 UTC: VALIDATION SCRIPT EXECUTION (45 minutes)

Run automated validation script:

```bash
bash PHASE3_DEPLOYMENT_VALIDATION_SCRIPT_20260510.sh
```

**Script Checklist:**
- [ ] Database validation: 3 tables created, 5+ indexes
- [ ] Django configuration: Middleware registered, no errors
- [ ] Celery configuration: Both tasks registered, beat schedule includes parity task
- [ ] API endpoints: /core/v1/phase3/* routes responding
- [ ] Service health: All 3 services Up
- [ ] Log validation: Zero critical errors
- [ ] Dry-run test: Requests working with shadow run

**Script Output:** 
```
✅ PASS: X
❌ FAIL: 0
```

**Sign-off:** DevOps __________

---

### 16:00 - 16:30 UTC: FINAL APPROVAL & SIGN-OFF (30 minutes)

### PRE-FLIGHT CHECKLIST (All items must be ✅ before proceeding)

#### Technical Readiness
- [ ] ✅ All 7 setup tasks completed
- [ ] ✅ All configuration files patched & syntax valid
- [ ] ✅ Database migration applied & tested
- [ ] ✅ All 10 test suites PASSED
- [ ] ✅ Validation script PASSED (0 failures)
- [ ] ✅ No errors in service logs
- [ ] ✅ All endpoints responding correctly
- [ ] ✅ DRY-RUN test successful (parity logs created)

#### Risk Mitigation
- [ ] ✅ Pre-deployment database backup created & verified
- [ ] ✅ Rollback procedure documented & tested
- [ ] ✅ Rollback RTO < 15 minutes confirmed
- [ ] ✅ On-call contacts updated
- [ ] ✅ Incident response plan reviewed
- [ ] ✅ Monitoring dashboards prepared

#### Compliance & Documentation
- [ ] ✅ All code reviewed (Phase 3 infrastructure)
- [ ] ✅ All configuration changes documented
- [ ] ✅ Test results recorded
- [ ] ✅ Deployment logs will be captured
- [ ] ✅ Change ticket created & linked

#### Team Confirmation
- [ ] ✅ DevOps Lead: Deployment infrastructure ready
- [ ] ✅ Backend Lead: Code changes validated
- [ ] ✅ DBA: Database migration tested
- [ ] ✅ QA Lead: All tests passing
- [ ] ✅ Tech Lead: Deployment approved

---

### FINAL APPROVAL FORM

**Phase 3 Deployment Preparation: APPROVED FOR EXECUTION**

```
Technology Lead:           ___________________________
Date/Time:                 2026-05-12 at ___:___ UTC
Contact (24/7):            [PHONE]

DevOps Lead:               ___________________________
Contact (24/7):            [PHONE]

Backend Lead:              ___________________________
Contact (24/7):            [PHONE]

DBA/Infrastructure:        ___________________________
Contact (24/7):            [PHONE]

QA Lead:                   ___________________________
Contact (24/7):            [PHONE]
```

**Deployment Approval:** ✅ APPROVED  
**Expected Execution Start:** 2026-05-13, 02:00 UTC (Day 1)  
**Emergency Rollback Available:** YES (< 15 minutes)

---

### 16:30 - 17:00 UTC: FINAL PREPARATION & BRIEFING (30 minutes)

| Task | Owner | Status |
|------|-------|--------|
| 1. Brief execution team on Phase 3 timeline | Tech Lead | ☐ |
| 2. Review incident response procedures | Incident Cmd | ☐ |
| 3. Distribute contact list & escalation paths | Admin | ☐ |
| 4. Confirm 24/7 on-call rotation active | HR | ☐ |
| 5. Deploy monitoring dashboards | DevOps | ☐ |
| 6. Set up war room (Slack/Teams channel) | Admin | ☐ |
| 7. Schedule post-execution review (2026-05-16) | Admin | ☐ |

**Briefing Complete:** ✅ YES

---

### 17:00 - 18:00 UTC: STAND-BY & FINAL CHECKS (1 hour)

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| 1. Monitor service logs (final hour) | Backend Lead | ☐ | No new errors |
| 2. Verify all env vars still set correctly | DevOps | ☐ | No drift |
| 3. Confirm database connectivity | DBA | ☐ | Test connection pool |
| 4. Verify Redis connection (Celery broker) | Backend Lead | ☐ | Connectivity check |
| 5. Final parity log volume check | QA | ☐ | Logs still being created |
| 6. Confirm on-call team ready | Incident Cmd | ☐ | Ready for Day 1 |

**All Systems Green:** ✅ YES, Ready for Phase 3 execution

---

## ROLLBACK PROCEDURE (If Deployment Fails)

**Condition:** Any critical failure detected during deployment that blocks execution.

**Rollback Steps (RTO < 15 minutes):**

```bash
# 1. Stop shadow run immediately
docker compose -f docker-compose.prod.yml exec core-api \
  python -c "import os; os.environ['PHASE3_SHADOW_RUN_ENABLED'] = 'false'"

# 2. Restore docker-compose backup
cp docker-compose.prod.yml.backup docker-compose.prod.yml

# 3. Restore settings.py backup
cp packages/core/backend/src/vninvest_core/settings.py.backup \
   packages/core/backend/src/vninvest_core/settings.py

# 4. Rollback database migration
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py migrate ops_audit 0001

# 5. Restart services
docker compose -f docker-compose.prod.yml restart core-api core-worker core-beat

# 6. Verify legacy system still functional
curl http://core-api:8000/api/portfolios/ -H "Authorization: Bearer ..."
```

**Rollback Approval:** Tech Lead __________ (Signature required)

---

## DEPLOYMENT SUMMARY

**Deployment Date:** 2026-05-12  
**Deployment Time:** 08:00 UTC - 18:00 UTC (10 hours)  
**Phase 3 Execution Starts:** 2026-05-13, 02:00 UTC  
**Expected Completion:** 2026-05-15, 23:59 UTC (3 days)  
**Success Criteria:** Parity Score ≥ 99% for ≥ 3 consecutive days  

**Phase 3 Approval Authority:** Tech Lead  
**Final Sign-Off:** ___________________________

---

**Document Status:** READY FOR DEPLOYMENT  
**Last Updated:** 2026-05-10  
**Prepared by:** Platform Engineering
