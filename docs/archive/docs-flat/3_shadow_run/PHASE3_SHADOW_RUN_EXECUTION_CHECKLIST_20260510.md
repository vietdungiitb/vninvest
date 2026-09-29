"""
Phase 3 Shadow Run Implementation Checklist & Deployment Guide

This file documents all required setup steps to enable Phase 3 shadow run
during production cutover. Execute in order, validating each step before proceeding.

Date: 2026-05-10
Status: READY FOR EXECUTION (2026-05-13)
"""

# ==============================================================================
# PHASE 3 SETUP CHECKLIST
# ==============================================================================

## PRE-EXECUTION CHECKLIST (Before 2026-05-13 00:00 UTC)

- [ ] 1. DATABASE MIGRATION (Production-like environment)
  - [ ] Create shadow database (or use separate schema in postgres)
  - [ ] Run: `python manage.py migrate ops_audit`
  - [ ] Verify ParityLog, ParityReport, ParityPhaseCheckpoint tables exist
  - [ ] Confirm indexes created (use: `\d ops_audit_parity_log`)
  - Command: `docker compose exec core-api python manage.py migrate ops_audit`

- [ ] 2. ENVIRONMENT VARIABLES (docker-compose.prod.yml)
  - [ ] Add PHASE3_SHADOW_RUN_ENABLED=true
  - [ ] Add CORE_API_SHADOW_RUN_ENDPOINT=http://core-api:8000
  - [ ] Add PHASE3_SHADOW_RUN_TIMEOUT=5.0 (seconds)
  - [ ] Add PHASE3_MONITORED_ENDPOINTS (comma-separated paths)
  - [ ] Verify vars propagated to: core-api, core-worker, core-beat services
  - Command: `docker-compose config | grep PHASE3`

- [ ] 3. MIDDLEWARE REGISTRATION (vninvest_core/settings.py)
  - [ ] Add to MIDDLEWARE list:
    `'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware'`
  - [ ] Position: Near end of list, after all auth/permission middleware
  - [ ] Verify no syntax errors
  - Command: `docker compose exec core-api python manage.py check`

- [ ] 4. CELERY BEAT SCHEDULE (vninvest_core/celery_config.py)
  - [ ] Add task: shadow_run_daily_parity_report
  - [ ] Schedule: crontab(hour=2, minute=30)  # 2:30 AM UTC (after market close)
  - [ ] Priority: 10 (normal)
  - [ ] Time limit: 60 seconds
  - Verify: `docker compose logs core-beat | grep "shadow_run_daily"`

- [ ] 5. URL ROUTING (vninvest_core/urls.py)
  - [ ] Include parity monitoring URLs:
    ```python
    path('core/v1/', include('ops_audit.urls_parity')),
    ```
  - [ ] Verify endpoints accessible: http://localhost:8000/core/v1/phase3/parity-status/

- [ ] 6. CELERY TASK REGISTRATION
  - [ ] Verify tasks discoverable:
    ```bash
    docker compose exec core-worker celery -A vninvest_core inspect registered
    ```
  - [ ] Confirm these tasks listed:
    - signal_intelligence.tasks.shadow_run_parity_check_task
    - signal_intelligence.tasks.shadow_run_daily_parity_report

- [ ] 7. DOCKER BUILD & RESTART
  - [ ] Rebuild core-api, core-worker, core-beat:
    `docker compose -f docker-compose.prod.yml up -d --build core-api core-worker core-beat`
  - [ ] Wait 30 seconds for services to initialize
  - [ ] Verify health: `docker compose ps | grep core-`
  - [ ] Check logs for errors: `docker compose logs --tail 50 core-api`

- [ ] 8. SANITY CHECKS
  - [ ] Test API access:
    `curl http://core-api:8000/core/v1/phase3/parity-status/`
  - [ ] Verify middleware not throwing errors (check app logs)
  - [ ] Confirm first requests captured in ParityLog table
  - [ ] Check no 500 errors in core-api logs

- [ ] 9. PREPARE MONITORING DASHBOARD
  - [ ] Open real-time log monitoring:
    `docker compose logs -f core-worker | grep "parity"`
  - [ ] Open logs for Celery beat:
    `docker compose logs -f core-beat | grep "shadow_run"`
  - [ ] Prepare daily report queries (SQL snapshots)

- [ ] 10. ESTABLISH ESCALATION CONTACTS
  - [ ] Tech Lead: [NAME, PHONE, EMAIL]
  - [ ] DevOps On-Call: [NAME, PHONE, EMAIL]
  - [ ] Backend Lead: [NAME, PHONE, EMAIL]
  - [ ] Confirm availability for 3-day window

---

## EXECUTION TIMELINE (2026-05-13 to 2026-05-15)

### DAY 1 (Monday 2026-05-13)

**Start Time:** 09:00 UTC (market open)

- [ ] 09:00 - Enable PHASE3_SHADOW_RUN_ENABLED=true in production
- [ ] 09:05 - Verify first shadow requests reaching core-api
- [ ] 09:15 - Check ParityLog table receiving entries (query sample: SELECT COUNT(*) FROM ops_audit_parity_log)
- [ ] 10:00 - First hourly check-in (all endpoints flowing?)
- [ ] 12:00 - Mid-day check: latency stable? parity_score > 0.95?
- [ ] 16:00 - End of trading day check
- [ ] 18:00 - Run daily parity report (automated at 02:30 UTC next day)
  - Command: `docker compose exec core-beat python -c "from signal_intelligence.tasks_parity import shadow_run_daily_parity_report; shadow_run_daily_parity_report.apply()"`
- [ ] 18:30 - Manually verify ParityReport entry created
  - Command: `SELECT * FROM ops_audit_parity_report WHERE report_date = current_date ORDER BY created_at DESC LIMIT 10`

**Success Criteria for Day 1:**
- [ ] No 500 errors in core-api logs
- [ ] ParityLog entries continuously recorded (>100 entries)
- [ ] All monitored endpoints reporting parity >= 0.95
- [ ] Daily report shows avg_parity_score >= 0.99
- [ ] Latency delta < 500ms for 95%+ of requests

### DAY 2 (Tuesday 2026-05-14)

- [ ] 09:00 - Same checks as Day 1
- [ ] 10:00 - Verify Day 1 report stored
- [ ] 12:00 - Mid-day check
- [ ] 18:00 - Run/verify Day 2 report

**Cumulative Success Criteria:**
- [ ] Day 1 parity_score >= 0.99 ✓
- [ ] Day 2 parity_score >= 0.99 (in progress)

### DAY 3 (Wednesday 2026-05-15)

- [ ] 09:00 - Same checks as Days 1-2
- [ ] 10:00 - Verify Day 2 report stored
- [ ] 12:00 - Mid-day check
- [ ] 16:00 - Final checks (Day 3 confidence high)
- [ ] 18:00 - Run/verify Day 3 report
- [ ] 20:00 - PHASE 3 DECISION POINT

---

## DECISION LOGIC (EOD Day 3)

### GREEN (Proceed to Phase 4)
```
If:  day1_parity >= 0.99 AND
     day2_parity >= 0.99 AND
     day3_parity >= 0.99 AND
     critical_failures == 0 AND
     tech_lead_sign_off == true

Then: Phase 4 production cutover approved
      Schedule: 2026-05-20 (next Monday) or ASAP if urgent
```

### YELLOW (Extend shadow run 1-2 days)
```
If:  (day1 OR day2 OR day3) in range [0.95, 0.99) AND
     no critical failures

Then: Extend shadow run 1-2 trading days
      Re-evaluate parity trend
      Investigate any warnings
```

### RED (Abort and investigate)
```
If:  any day parity < 0.95 OR
     critical_failures > 0 OR
     latency_delta > 1000ms for >5% of requests

Then: Abort shadow run
      Full incident investigation required
      Reschedule after root cause fixed
      Timeline: +1-2 weeks
```

---

## MONITORING QUERIES (Use in production DB)

### Real-time parity flow
```sql
SELECT 
    DATE(created_at) as date,
    endpoint,
    COUNT(*) as total_requests,
    AVG(parity_score) as avg_parity,
    COUNT(CASE WHEN parity_status='match' THEN 1 END) as match_count,
    COUNT(CASE WHEN parity_status='error' THEN 1 END) as error_count
FROM ops_audit_parity_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at), endpoint
ORDER BY date DESC, endpoint;
```

### Daily report summary
```sql
SELECT 
    report_date,
    endpoint,
    total_requests,
    avg_parity_score,
    recommendation,
    parity_pass
FROM ops_audit_parity_report
WHERE report_date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY report_date DESC, endpoint;
```

### Critical failures
```sql
SELECT 
    report_date,
    endpoint,
    critical_failures,
    notes
FROM ops_audit_parity_report
WHERE critical_failures != '{}' OR recommendation = 'red'
ORDER BY report_date DESC;
```

### Phase 3 checkpoint status
```sql
SELECT 
    phase_status,
    day1_date,
    day1_parity_score,
    day2_date,
    day2_parity_score,
    day3_date,
    day3_parity_score,
    all_days_complete,
    all_days_pass,
    final_decision,
    tech_lead_sign_off
FROM ops_audit_parity_phase_checkpoint
WHERE phase_name = 'Phase 3'
ORDER BY created_at DESC
LIMIT 1;
```

---

## INCIDENT RESPONSE PROCEDURES

### Scenario: Parity drops below 0.95

**Response:**
1. [ ] Do NOT shut down shadow run yet
2. [ ] Alert Tech Lead + Backend Lead immediately
3. [ ] Check core-api and legacy backend logs for errors
4. [ ] Identify which endpoint is failing
5. [ ] Query ParityLog for specific failures:
   ```sql
   SELECT * FROM ops_audit_parity_log
   WHERE parity_score < 0.95 AND created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC LIMIT 20;
   ```
6. [ ] If data discrepancy: Check legacy vs core database consistency
7. [ ] If latency issue: Increase PHASE3_SHADOW_RUN_TIMEOUT
8. [ ] If request format issue: Check headers/params in middleware

### Scenario: Middleware throws errors

**Response:**
1. [ ] Check logs: `docker compose logs core-api | grep "middleware\|parity"`
2. [ ] Disable middleware temporarily: PHASE3_SHADOW_RUN_ENABLED=false
3. [ ] Investigate root cause
4. [ ] Fix code (only if >30 min to fix)
5. [ ] Re-enable and resume shadow run

### Scenario: Celery task failure

**Response:**
1. [ ] Check task queue: `docker compose exec redis redis-cli LLEN celery`
2. [ ] Check worker logs: `docker compose logs core-worker | grep "ERROR\|exception"`
3. [ ] Restart worker: `docker compose restart core-worker`
4. [ ] Re-queue failed tasks manually if needed

---

## ROLLBACK PLAN (If Phase 3 aborted)

If Phase 3 is aborted (RED decision), execute:

1. [ ] PHASE3_SHADOW_RUN_ENABLED=false (disable immediately)
2. [ ] docker compose restart core-api core-worker
3. [ ] Archive ParityLog/ParityReport data for analysis
4. [ ] Update ParityPhaseCheckpoint: phase_status='review', final_decision='red'
5. [ ] Notify stakeholders + incident team
6. [ ] Schedule post-mortem within 24 hours
7. [ ] Fix root cause issue + re-test in dev/staging
8. [ ] Reschedule Phase 3 for +1 week

---

## SIGN-OFF REQUIREMENTS (Before Phase 4)

Tech Lead must confirm ALL of:

- [ ] Day 1 parity >= 0.99 (confirmed in DB)
- [ ] Day 2 parity >= 0.99 (confirmed in DB)
- [ ] Day 3 parity >= 0.99 (confirmed in DB)
- [ ] All critical endpoints GREEN (recommendation='green')
- [ ] No unresolved incidents or warnings
- [ ] Middleware performance acceptable (latency delta <500ms)
- [ ] Backup/restore verified (Gate F)
- [ ] Production deployment checklist complete (Phase 4 ready)

**Sign-off Form:**
```
Tech Lead Name: ________________
Approval Date/Time: ________________
Signature: ________________

Approved for Phase 4 Production Cutover: [YES / NO]
Scheduled cutover time: ________________
```

---

## PHASE 4 NEXT STEPS (Post-Phase 3 approval)

Once Phase 3 GREEN + Tech Lead sign-off:

1. Schedule Phase 4 cutover (production traffic switchover)
2. Prepare Phase 4 deployment manifest
3. Execute pre-cutover checklist
4. Switch production traffic: legacy → core-api
5. Monitor cutover (first 2 hours critical)
6. Proceed to Phase 5 (legacy monitoring 1-2 weeks)
7. Proceed to Phase 6 (full decommission cleanup)

---

**Last Updated:** 2026-05-10  
**Prepared by:** Platform Engineering  
**Status:** READY FOR EXECUTION ✅
"""
