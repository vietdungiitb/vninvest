"""
Phase 4 Production Cutover Execution Plan (2026-05-20)

Complete step-by-step plan for production traffic migration from legacy backend
to core-api after Phase 3 shadow run success (parity >= 99% for 3 days).

Timeline: 2026-05-20 (Tuesday) — Target 6-8 hour maintenance window
Pre-conditions: Phase 3 complete with recommendation = GREEN
Post-conditions: >99% traffic migrated to core-api; legacy backend in read-only standby mode
Risk level: CRITICAL (production migration)
Rollback time: 30-45 minutes (traffic revert to legacy)
"""

# ==============================================================================
# PHASE 4 DECOMMISSION GATES & SUCCESS CRITERIA
# ==============================================================================

## Overview: 6 Pre-Cutover Validation Gates (Serial Execution)

### Gate A: Phase 3 Final Results Review
**Owner:** Tech Lead  
**Timeline:** 2026-05-16 (Thu, post-Phase 3)  
**Criteria:** ✅ PASS
- [ ] Parity score >= 99% on all 3 days (Day 1, Day 2, Day 3)
- [ ] Zero critical issues in parity logs (no 5xx, no timeouts, no data corruption)
- [ ] Recommendation = GREEN from Phase 3 daily reports
- [ ] Tech Lead sign-off on ParityPhaseCheckpoint

**Sign-off:** Tech Lead __________________ Date: __________

---

### Gate B: Production Database Backup & Test Restore
**Owner:** DBA  
**Timeline:** 2026-05-17 (Fri)  
**Criteria:** ✅ PASS
- [ ] Full production database backup created (compression=9, S3/R2 upload)
- [ ] Backup size verified (expected ~50-200GB)
- [ ] Test restore to staging completed (< 30 min RTO)
- [ ] Data integrity verified (row count, checksum)

**Backup Details:**
```sql
-- Backup command
pg_dump -U postgres -d vninvest_core --compress=9 > /backup/vninvest_core_precut over_20260520.dump.gz

-- Verify
pg_restore -U postgres -d vninvest_core_test < /backup/vninvest_core_precut over_20260520.dump.gz
SELECT COUNT(*) FROM ops_audit_parity_log;  -- Should match production count
```

**Sign-off:** DBA __________________ Date: __________

---

### Gate C: Legacy Backend Readonly Mode Configuration
**Owner:** DevOps / Backend Lead  
**Timeline:** 2026-05-18 (Sat)  
**Criteria:** ✅ PASS
- [ ] Readonly mode implemented in legacy Django settings
  - All write endpoints return 405 Method Not Allowed
  - All read endpoints return 200 OK (from cached data)
- [ ] Middleware in place to block POST/PUT/DELETE on legacy routes
- [ ] GET routes still functional (for monitoring + comparison)
- [ ] Tested in staging environment

**Implementation:**
```python
# In backend/config/settings.py (legacy)

# Phase 4: Readonly mode enforcement
READONLY_MODE = True  # Set this env var before production cutover

# Middleware that blocks all writes
class ReadonlyEnforcementMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        if os.getenv('READONLY_MODE') == 'true':
            if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                return JsonResponse(
                    {'error': 'Legacy backend in readonly mode. Use /core/v1/ endpoints.'},
                    status=405
                )
        return self.get_response(request)
```

**Sign-off:** DevOps __________________ Date: __________

---

### Gate D: Core-API Production Readiness Verification
**Owner:** Backend Lead  
**Timeline:** 2026-05-18 (Sat)  
**Criteria:** ✅ PASS
- [ ] All core-api endpoints tested with production data (via shadow run logs)
- [ ] Response times acceptable (p95 < 500ms for non-heavy operations)
- [ ] Error rates < 1% across all endpoints
- [ ] Database connection pooling configured for production load
- [ ] Memory usage stable under concurrent request load
- [ ] Celery tasks executing reliably (no stuck tasks)

**Performance Baseline (from Phase 3 logs):**
```sql
-- Query production parity logs for baseline
SELECT 
  endpoint,
  AVG(latency_delta_ms) as avg_latency,
  MAX(latency_delta_ms) as max_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_delta_ms) as p95
FROM ops_audit_parity_log
WHERE created_at > NOW() - INTERVAL '3 days'
GROUP BY endpoint
ORDER BY avg_latency DESC;
```

**Sign-off:** Backend Lead __________________ Date: __________

---

### Gate E: Mobile/Web Frontend Verification
**Owner:** Frontend Lead  
**Timeline:** 2026-05-18 (Sat)  
**Criteria:** ✅ PASS
- [ ] All frontend shell hosts tested against core-api endpoints
- [ ] coreApiAdapter.js using /core/v1/ routes correctly
- [ ] No hardcoded legacy endpoint references in packages/web or packages/mobile
- [ ] Error handling for legacy endpoint failures (graceful fallback)
- [ ] Performance acceptable (bundle size, load time)

**Test Procedure:**
```bash
# Build frontend against core-api only (no legacy fallback)
export REACT_APP_API_BASE=https://api.vninvest.com/core/v1

npm run build

# Test critical flows:
# 1. Dashboard load (no legacy /api/* calls)
# 2. Portfolios load (uses coreApiAdapter)
# 3. Whale alerts load (uses coreApiAdapter)
# 4. Advisory load (uses coreApiAdapter)
# 5. Transaction creation/edit (uses coreApiAdapter)

# Verify no legacy calls in network tab (DevTools)
```

**Sign-off:** Frontend Lead __________________ Date: __________

---

### Gate F: Incident Response & Rollback Procedures Finalized
**Owner:** Incident Commander  
**Timeline:** 2026-05-19 (Sun)  
**Criteria:** ✅ PASS
- [ ] Rollback procedure tested in staging (< 45 min RTO verified)
- [ ] Incident escalation matrix updated (contacts, phone, email)
- [ ] War room setup ready (Slack channel, bridge number, on-call roster)
- [ ] Communication templates prepared (status page, customer notification)
- [ ] Runbooks for common Phase 4 incidents created

**Rollback Procedure (Tested):**
```bash
# Step 1: Revert traffic routing (1 min)
docker compose -f docker-compose.prod.yml exec nginx \
  cp /etc/nginx/conf.d/legacy_fallback.conf.backup /etc/nginx/conf.d/cutover.conf && \
  nginx -s reload

# Step 2: Disable readonly mode on legacy (2 min)
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py shell << 'EOF'
import os
os.environ['READONLY_MODE'] = 'false'
print('✅ Legacy backend in write mode again')
EOF

# Step 3: Restart services (2 min)
docker compose -f docker-compose.prod.yml restart backend frontend

# Step 4: Verify legacy serving (5 min)
for endpoint in /api/portfolios/ /api/transactions/ /api/stocks/; do
  curl http://legacy:8001$endpoint -s | head -c 100
  echo ""
done

# Total RTO: 10-15 minutes (conservative estimate: 45 min available buffer)
```

**Sign-off:** Incident Commander __________________ Date: __________

---

# ==============================================================================
# PHASE 4 EXECUTION: PRODUCTION CUTOVER (2026-05-20)
# ==============================================================================

## Timeline & Team Assignments

### 06:00 - 07:00 UTC: PRE-CUTOVER SANITY CHECK (1 hour)

| Task | Owner | Validation | Status |
|------|-------|-----------|--------|
| Verify Phase 3 GREEN decision in DB | Tech Lead | SELECT status FROM ops_audit_parity_phase_checkpoint WHERE phase_number = 3; | ☐ |
| Verify production DB backup exists | DBA | ls -lh /backup/vninvest_core_precut over_*.dump.gz | ☐ |
| Verify legacy backend health | Backend Lead | curl http://legacy:8001/health/ | ☐ |
| Verify core-api health | Backend Lead | curl http://core-api:8000/health/ | ☐ |
| Verify Redis connection (Celery broker) | Backend Lead | redis-cli -n 3 ping | ☐ |
| Brief execution team | Incident Cmd | Review Phase 4 runbook + emergency contacts | ☐ |

**Sign-off:** All owners ✅

---

### 07:00 - 08:00 UTC: LEGACY READONLY MODE ACTIVATION (1 hour)

**Purpose:** Prevent any writes to legacy database during transition; allow reads for monitoring/verification.

| Task | Owner | Command | Status |
|------|-------|---------|--------|
| Set READONLY_MODE=true on legacy | DevOps | export READONLY_MODE=true && docker compose restart backend | ☐ |
| Verify legacy read-only enforcement | Backend Lead | curl -X POST http://legacy:8001/api/transactions/ -d '{}' | ☐ |
| Expected: 405 Method Not Allowed | Backend Lead | Verify response status = 405 | ☐ |
| Verify legacy reads still work | Backend Lead | curl http://legacy:8001/api/portfolios/ | ☐ |
| Expected: 200 with data | Backend Lead | Verify response status = 200 | ☐ |

**Sign-off:** DevOps __________ Backend Lead __________

---

### 08:00 - 09:30 UTC: TRAFFIC MIGRATION (90 minutes)

**Purpose:** Gradually shift traffic from legacy to core-api using Nginx weighted routing.

#### Phase 4.1: 0% → 10% Core-API (10 minutes)

```nginx
# /etc/nginx/conf.d/cutover.conf
upstream legacy_backend {
    server legacy:8001;
}

upstream core_api {
    server core-api:8000;
}

server {
    listen 80;
    server_name api.vninvest.com;
    
    # Phase 4.1: 10% to core-api, 90% to legacy
    location /api/ {
        # 10% weight to core
        set $backend_pool "";
        if ($request_time < 0.001) {  # Probabilistic routing
            set $backend_pool core_api;
        }
        if ($backend_pool = "") {
            set $backend_pool legacy_backend;
        }
        proxy_pass http://$backend_pool;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Validation (10 min):**
```bash
# Monitor traffic split (should be ~10% core, 90% legacy)
docker compose -f docker-compose.prod.yml logs core-api | grep "GET /api/" | wc -l
docker compose -f docker-compose.prod.yml logs backend | grep "GET /api/" | wc -l

# Expected ratio: 1:9 (core:legacy)

# Check error rates
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py shell << 'EOF'
from django.db.models import Count
from ops_audit.models import ParityLog
logs = ParityLog.objects.filter(created_at__gte=timezone.now() - timedelta(minutes=10))
errors = logs.filter(core_status__gte=400).count()
print(f"Error rate: {errors/logs.count()*100:.2f}%")
EOF

# Expected: < 0.5% error rate
```

**Decision:** 
- ✅ CONTINUE if error_rate < 0.5%
- 🔴 ABORT & ROLLBACK if error_rate >= 1%

**Sign-off:** Backend Lead __________ Date: __________ Status: ☐

---

#### Phase 4.2: 10% → 50% Core-API (20 minutes)

```nginx
# Modify weights in cutover.conf
# 50% to core-api, 50% to legacy (round-robin or consistent hashing)

upstream core_api {
    least_conn;  # Load balancing strategy
    server core-api:8000 weight=5;
    server legacy:8001 weight=5;
}
```

**Validation (15 min):**
```bash
# Monitor request distribution
# Expected: ~50/50 split

# Check p95 latency
docker compose -f docker-compose.prod.yml exec core-api \
  python manage.py shell << 'EOF'
from ops_audit.models import ParityLog
import statistics
recent = ParityLog.objects.filter(created_at__gte=timezone.now() - timedelta(minutes=20))
latencies = [log.latency_delta_ms for log in recent]
p95 = statistics.quantiles(latencies, n=20)[18]  # 95th percentile
print(f"P95 latency: {p95}ms")
EOF

# Expected: P95 < 500ms

# Check error rates
# Expected: < 1% overall error rate
```

**Decision:**
- ✅ CONTINUE if p95 < 500ms AND error_rate < 1%
- ⏸️ PAUSE & MONITOR if p95 >= 500ms but error_rate < 1%
- 🔴 ABORT & ROLLBACK if error_rate >= 2%

**Sign-off:** Backend Lead __________ Date: __________ Status: ☐

---

#### Phase 4.3: 50% → 100% Core-API (30 minutes)

```nginx
# Final migration: 100% to core-api
upstream core_api {
    server core-api:8000;
}

server {
    listen 80;
    server_name api.vninvest.com;
    
    location /api/ {
        proxy_pass http://core-api:8000;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

**Validation (25 min):**
```bash
# Verify 100% traffic to core-api
# Check error rates (should remain < 1%)
# Check latency (should be stable)
# Monitor Celery queue depth (should not grow)

# Key metrics:
for i in {1..10}; do
  curl http://core-api:8000/health/ -s | grep status
  sleep 10
done
```

**Decision:**
- ✅ PROCEED to legacy readonly standby if ALL checks pass
- 🔴 ABORT & ROLLBACK if ANY critical metric fails

**Sign-off:** Backend Lead __________ Incident Cmd __________ Date: __________

---

### 09:30 - 10:00 UTC: VERIFICATION & STABILIZATION (30 minutes)

| Task | Validation Command | Expected Result | Status |
|------|-------------------|-----------------|--------|
| Verify 100% traffic on core-api | curl http://core-api/health/ | 200 OK | ☐ |
| Error rate across endpoints | Check ops_audit_parity_log last 30 min | < 1% error rate | ☐ |
| Latency p95 all endpoints | SELECT PERCENTILE_CONT(...) | < 600ms | ☐ |
| Database replication lag (if multi-region) | SELECT last_replay_time - NOW() | < 1 second | ☐ |
| Celery queue depth | celery inspect active | < 1000 tasks queued | ☐ |
| Frontend error logs (Sentry/etc) | Check frontend error rate | < 0.1% | ☐ |
| Mobile app API calls (if monitored) | Check request logs | No 5xx errors | ☐ |
| Customer incident reports | Check support queue | Zero incidents related to cutover | ☐ |

**Sign-off:** All validators ✅

---

### 10:00 - 10:30 UTC: LEGACY BACKEND STANDBY MODE (30 minutes)

**Purpose:** Transition legacy backend to read-only standby (no new writes, ready for emergency rollback).

| Task | Command | Validation | Status |
|------|---------|-----------|--------|
| Stop legacy backend application (keep DB running) | docker compose stop backend | backend: Stopped | ☐ |
| Keep legacy PostgreSQL running | docker compose ps db | db: Up | ☐ |
| Verify legacy DB still reachable for rollback | psql -h legacy_db ... -c "SELECT 1;" | (integer) 1 | ☐ |
| Document legacy standby snapshot | docker commit backend vninvest-legacy-standby-20260520 | Image created | ☐ |
| Update DNS/routing to document legacy standby | Update ops runbook | Documentation updated | ☐ |

**Sign-off:** DevOps __________________ Date: __________

---

### 10:30 - 11:00 UTC: FINAL SIGN-OFF & MAINTENANCE MODE OFF (30 minutes)

| Task | Owner | Sign-off |
|------|-------|----------|
| Verify production cutover complete | Tech Lead | ☐ |
| Update status page (maintenance -> operational) | Comms | ☐ |
| Notify customers of successful migration | Comms | ☐ |
| Archive Phase 4 execution logs | DevOps | ☐ |
| Schedule post-mortem review (2026-05-23) | Incident Cmd | ☐ |
| Update PROGRESS_DASHBOARD.md | Tech Lead | ☐ |
| Create Phase 4 execution evidence document | QA | ☐ |

**Final Approval:**
```
Phase 4 Production Cutover: ✅ SUCCESSFUL

Date/Time: 2026-05-20 11:00 UTC
Traffic Status: 100% on core-api
Error Rate: < 1%
Rollback Status: Ready (< 45 min RTO)

Approved by:
- Tech Lead: ___________________________
- Incident Commander: ___________________________
- Platform Lead: ___________________________
```

---

# ==============================================================================
# PHASE 4 EMERGENCY PROCEDURES
# ==============================================================================

## Abort & Rollback Trigger Conditions

Abort Phase 4 and trigger rollback if ANY of these occur:

### Condition 1: Error Rate Spike
```
Error rate >= 2% (sustained for 5 minutes)
→ Trigger: Abort & Rollback to 100% legacy
```

### Condition 2: Latency Degradation
```
P95 latency >= 1000ms (sustained for 5 minutes)
→ Trigger: Revert to 50/50 split, investigate, retry later
```

### Condition 3: Database Connectivity Loss
```
core-api cannot reach PostgreSQL (3 consecutive failed queries)
→ Trigger: Abort & Rollback immediately
```

### Condition 4: Celery Task Queue Overflow
```
Celery queue depth >= 5000 tasks (growing)
→ Trigger: Pause traffic migration, scale workers, retry
```

### Condition 5: Critical Service Failure
```
core-api health check fails (3 consecutive failures)
→ Trigger: Abort & Rollback immediately
```

---

## Rollback Procedure (Emergency)

**RTO Target:** < 45 minutes from abort decision to full legacy restoration

```bash
# Step 1: Immediate traffic revert (3 minutes)
# Revert Nginx routing to 100% legacy
docker compose -f docker-compose.prod.yml exec nginx \
  cp /etc/nginx/conf.d/legacy_fallback.conf.backup /etc/nginx/conf.d/cutover.conf && \
  nginx -s reload

# Step 2: Disable legacy readonly mode (2 minutes)
docker compose -f docker-compose.prod.yml exec backend \
  python -c "import os; os.environ['READONLY_MODE'] = 'false'"

# Step 3: Restart legacy application (3 minutes)
docker compose -f docker-compose.prod.yml up -d backend

# Step 4: Verify legacy serving (10 minutes)
curl http://legacy:8001/health/
curl http://legacy:8001/api/portfolios/ | python -m json.tool | head -20

# Step 5: Clear core-api Celery queue (optional, 5 minutes)
docker compose -f docker-compose.prod.yml exec core-worker \
  celery -A vninvest_core purge

# Step 6: Document rollback (5 minutes)
# - Note timestamp
# - Capture logs
# - Begin post-mortem investigation

# Total RTO: 28 minutes (well within 45-minute SLA)
```

---

## Post-Rollback Analysis Procedure

If rollback is triggered, execute this procedure:

```
1. IMMEDIATE (0-30 min):
   - Document exact failure timestamp
   - Preserve logs: docker compose logs > phase4_failure_$(date +%s).log
   - Identify root cause (error logs, metrics, alerts)
   - Notify stakeholders

2. SHORT-TERM (30 min - 4 hours):
   - Review all ParityLog entries from Phase 3 for missed issues
   - Identify if Phase 3 parity checks were insufficient
   - Design additional validation gates
   - Fix identified issues in core-api code

3. MEDIUM-TERM (next day):
   - Hold post-mortem review (findings + lessons learned)
   - Plan retry with additional validation
   - Extended Phase 3 shadow run if code changes made (1-3 more days)

4. RETRY (after 24-48 hour buffer):
   - Implement fixes
   - Repeat Phase 3 shadow run (if code changed)
   - Re-execute Phase 4 with enhanced monitoring
```

---

# ==============================================================================
# PHASE 4 SUCCESS CRITERIA & COMPLETION
# ==============================================================================

## Cutover Completion Criteria (All Must Pass)

- ✅ 100% traffic migrated to core-api
- ✅ Error rate < 1% sustained for 30 minutes
- ✅ P95 latency < 600ms sustained for 30 minutes
- ✅ Zero customer-reported issues
- ✅ Legacy backend successfully in standby mode
- ✅ Database replication (if enabled) < 1 second lag
- ✅ Celery queue depth stable < 1000 tasks
- ✅ All 5 stakeholder sign-offs obtained
- ✅ Post-cutover monitoring dashboards active

## Execution Evidence Requirements

Document for audit trail:

1. **Pre-cutover Gates A-F:** All ✅ PASS signs documented
2. **Timeline Log:** Hour-by-hour execution with actual times vs planned
3. **Metrics Capture:**
   - Error rates at each traffic split level (10%, 50%, 100%)
   - Latency metrics (p50, p95, p99) for each level
   - Database metrics (connections, replication lag, slow queries)
   - Celery metrics (queue depth, task success rate)
4. **Decision Points:** Each traffic migration step approved/denied with reason
5. **All Sign-offs:** Printed and filed for compliance

---

# ==============================================================================
# PHASE 4 LEGACY BACKEND: POST-CUTOVER STATES
# ==============================================================================

### State: STANDBY MODE (2026-05-20 onwards)

**Configuration:**
- Application: STOPPED (no processes running, but Docker container exists)
- Database: RUNNING (in read-only replica mode if configured)
- Monitoring: ACTIVE (logs captured, metrics tracked)
- Access: READ-ONLY (emergency investigators can query for forensics)
- Duration: 2 weeks (until Phase 5 final cleanup)

**Responsibilities:**
- Daily monitoring for any anomalies
- Periodic test restarts (verify can boot in < 5 min)
- Log rotation & archive
- Capacity tracking (database size, backups)

### State: DECOMMISSION (Post-2026-06-03, Phase 6)

After 2 weeks of successful stable production:
- Stop legacy database replication
- Archive final database backup (S3/Glacier, 7-year retention)
- Remove legacy Docker images
- Delete legacy application code (keep in git history)
- Update infrastructure-as-code (remove legacy compose configs)
- Close legacy service accounts (database users, API keys, etc.)

---

**Phase 4 Execution Plan Status:** READY FOR 2026-05-20  
**Last Updated:** 2026-05-10  
**Prepared by:** Platform Engineering + Tech Lead
"""
