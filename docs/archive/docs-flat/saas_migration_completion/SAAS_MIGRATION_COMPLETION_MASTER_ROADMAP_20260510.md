# SAAS_MIGRATION_COMPLETION_MASTER_ROADMAP_20260510.md

## VNInvest SaaS Migration: Complete Execution Roadmap (Phases 3-6)

**Project:** VNInvest Platform Migration to Core-API (SAAS Decommission Sequence)  
**Period:** May 10, 2026 - June 10, 2026 (32-day execution window)  
**Overall Goal:** Migrate 100% production traffic from legacy monolith to core-api; archive & decommission legacy backend  
**Success Criteria:** Parity >= 99% across 3 days + stable production for 2 weeks + clean decommission  

---

## EXECUTIVE SUMMARY

| Phase | Objective | Duration | Start Date | End Date | Success Metric | Owner |
|-------|-----------|----------|-----------|----------|---|-------|
| 3 | Shadow run parity verification | 3 days | 2026-05-13 | 2026-05-15 | Parity >= 99% | Tech Lead |
| 4 | Production traffic cutover | 1 day | 2026-05-20 | 2026-05-20 | 100% traffic on core-api | DevOps |
| 5 | Post-cutover stability monitoring | 14 days | 2026-05-20 | 2026-06-03 | No incidents, < 1% errors | Ops Lead |
| 6 | Legacy decommission & cleanup | 7 days | 2026-06-03 | 2026-06-10 | Complete removal + archival | DevOps |

**Total Timeline:** 32 days  
**Deployment Locations:** Production (vninvest_core PostgreSQL + core-api containers)  
**Rollback Points:**
- After Phase 3 Day 1: If parity < 95%, extend 1-2 days
- Before Phase 4: If Phase 3 RED, abort cutover (execute Phase 3 again)
- During Phase 4: Revert to legacy (45-min RTO)
- After Phase 5: If issues found, extend Phase 5 (max +14 days), then retry Phase 4

---

## DETAILED PHASE BREAKDOWN

### PHASE 3: SHADOW RUN PARITY VERIFICATION (2026-05-13 to 2026-05-15)

**Objective:** Verify core-api can handle 100% production workload without data/performance issues.

**Architecture:**
```
Traffic Flow (Phase 3):
  Client Request → core-api (primary, serves response to client)
                → ShadowRunDualReadMiddleware (async)
                → Queue: shadow_run_parity_check_task (Celery)
                → Calls: legacy backend (shadow request, no response to client)
                → Compare: core response vs legacy response
                → Logs: ParityLog table (per-request scores)
                → Reports: ParityReport table (daily aggregates)
```

**Key Components:**
- ✅ **ShadowRunDualReadMiddleware**: Captures requests, queues shadow checks
- ✅ **shadow_run_parity_check_task**: Celery task for per-request comparison
- ✅ **shadow_run_daily_parity_report_task**: Daily report generation & decision
- ✅ **ParityLog/ParityReport/ParityPhaseCheckpoint**: Audit tables for tracking
- ✅ **4 API endpoints**: /parity-status/, /parity-reports/, /parity-logs/, /parity-signoff/

**Metrics Tracked:**
```python
parity_score = average([
    status_match (25%),           # HTTP status codes match
    structure_match (25%),        # JSON structure match
    payload_match (25%),          # Payload content match (with tolerance)
    latency_delta (25%)           # Latency within 500ms
])

Decision Rule:
  Day >= 99%   → ✅ GREEN (proceed to Phase 4)
  95-98%       → 🟡 YELLOW (extend shadow run 1-2 days)
  < 95%        → 🔴 RED (abort, fix issues, restart Phase 3)

Final Recommendation:
  All 3 days = GREEN → Phase 3 PASS (Tech Lead sign-off) → Proceed to Phase 4
  Any day = RED  → Phase 3 FAIL (abort) → Fix + Restart Phase 3
```

**Execution Schedule:**
- **Day 1 (2026-05-13, Mon):** Start 02:00 UTC (post-market-close)
  - Hourly checks: 02, 03, 04, 05, 09, 12, 15, 18, 21 UTC
  - Daily report: 02:30 UTC (May 14)
  - Decision: Continue vs extend vs abort
- **Day 2 (2026-05-14, Tue):** Same schedule
  - Daily report: 02:30 UTC (May 15)
  - Decision: Continue vs extend vs abort
- **Day 3 (2026-05-15, Wed):** Same schedule
  - Daily report: 02:30 UTC (May 16)
  - **Final Decision:** GREEN/YELLOW/RED

**Documentation:**
- ✅ [PHASE3_SHADOW_RUN_EXECUTION_CHECKLIST_20260510.md](../3_shadow_run/PHASE3_SHADOW_RUN_EXECUTION_CHECKLIST_20260510.md) (400 lines)
- ✅ [PHASE3_SHADOW_RUN_PLAN_20260510.md](../saas_migration_phase3/SAAS_MIGRATION_PHASE3_SHADOW_RUN_PLAN_20260510.md) (800 lines)
- ✅ [PHASE3_DEPLOYMENT_PREPARATION_GUIDE_20260510.md](../../../PHASE3_DEPLOYMENT_PREPARATION_GUIDE_20260510.md) (3,500 lines)
- ✅ [PHASE3_DEPLOYMENT_TESTING_PROCEDURES_20260510.md](../../../PHASE3_DEPLOYMENT_TESTING_PROCEDURES_20260510.md) (600 lines)
- ✅ [PHASE3_DEPLOYMENT_DAY_CHECKLIST_20260510.md](../../../PHASE3_DEPLOYMENT_DAY_CHECKLIST_20260510.md) (400 lines)

**Rollback Condition:**
```
IF Phase 3 Day 3 recommendation = GREEN:
  → Continue to Phase 4 (2026-05-20)

ELSE IF recommendation = YELLOW:
  → Extend shadow run (additional 2 days: 2026-05-16 & 2026-05-17)
  → Re-evaluate on 2026-05-18
  → If still GREEN → Phase 4
  → If still YELLOW/RED → Abort + Fix + Restart

ELSE IF recommendation = RED:
  → Abort Phase 3
  → Root cause analysis
  → Fix identified issues in core-api code
  → Re-run Phase 3 from beginning (add 3 more days to timeline)
```

---

### PHASE 4: PRODUCTION TRAFFIC CUTOVER (2026-05-20, Tuesday)

**Objective:** Migrate 100% of production traffic from legacy backend to core-api.

**Pre-Cutover Gates (Must All PASS):**
- ✅ Gate A: Phase 3 recommendation = GREEN
- ✅ Gate B: Production database backup created + test restore verified
- ✅ Gate C: Legacy backend in readonly mode (enforced by middleware)
- ✅ Gate D: Core-API performance verified (p95 < 500ms, < 1% errors)
- ✅ Gate E: Frontend/Mobile verified (no hardcoded legacy endpoints)
- ✅ Gate F: Incident response procedures finalized

**Timeline (Single Day: 2026-05-20):**

```
06:00-07:00 UTC: Pre-cutover sanity check (1 hour)
  - Verify Phase 3 GREEN in database
  - Verify production backups exist
  - Verify services health (legacy, core-api, Redis, DB)
  - Brief execution team

07:00-08:00 UTC: Legacy readonly mode activation (1 hour)
  - Set READONLY_MODE=true in legacy Django
  - Verify readonly enforcement (POST returns 405)
  - Verify reads still work (GET returns 200)

08:00-09:30 UTC: Gradual traffic migration (90 minutes)
  - Phase 4.1 (10-20 min): 0% → 10% core-api, 90% legacy
    Validation: Error rate < 0.5%, P95 < 500ms
  - Phase 4.2 (20-40 min): 10% → 50% core-api, 50% legacy
    Validation: Error rate < 1%, P95 < 500ms
  - Phase 4.3 (30-50 min): 50% → 100% core-api, 0% legacy
    Validation: Error rate < 1%, P95 < 600ms

09:30-10:00 UTC: Verification & stabilization (30 minutes)
  - Confirm 100% traffic on core-api
  - Monitor error rates, latency, database metrics
  - Verify no customer-facing issues

10:00-10:30 UTC: Legacy standby mode (30 minutes)
  - Stop legacy application (keep database running)
  - Verify emergency restart capability (< 5 min boot)
  - Document legacy standby snapshot

10:30-11:00 UTC: Final sign-off (30 minutes)
  - 5 stakeholder approvals
  - Update status page (maintenance → operational)
  - Notify customers of successful migration
```

**Traffic Migration Nginx Config:**
```nginx
# Phase 4.1: 10% core, 90% legacy (weighted routing)
upstream core_api {
    server core-api:8000 weight=1;  # 10%
}
upstream legacy {
    server legacy:8001 weight=9;    # 90%
}

# Phase 4.2: 50% core, 50% legacy
upstream core_api {
    server core-api:8000 weight=5;  # 50%
}
upstream legacy {
    server legacy:8001 weight=5;    # 50%
}

# Phase 4.3: 100% core, 0% legacy (final)
upstream core_api {
    server core-api:8000;           # 100%
}
```

**Abort & Rollback Triggers:**
```
Condition                          Action
─────────────────────────────────────────────
Error rate >= 2% (5 min)          ABORT & ROLLBACK
P95 latency >= 1000ms (5 min)     REVERT to 50/50, investigate
Database connection loss           ABORT & ROLLBACK immediately
Core-api health check fails (3x)   ABORT & ROLLBACK immediately
Celery queue overflow (5000+)      PAUSE migration, scale workers

Rollback Time: 10-15 minutes actual, 45-minute SLA
```

**Documentation:**
- ✅ [PHASE4_PRODUCTION_CUTOVER_EXECUTION_PLAN_20260510.md](../4_production_cutover/PHASE4_PRODUCTION_CUTOVER_EXECUTION_PLAN_20260510.md) (1,200+ lines)
  - 6 Pre-cutover gates (A-F) with validation procedures
  - Hour-by-hour execution timeline with team ownership
  - Abort/rollback procedures with specific triggers
  - Legacy standby mode procedures

---

### PHASE 5: POST-CUTOVER MONITORING (2026-05-20 to 2026-06-03, 14 days)

**Objective:** Verify production stability; catch any legacy dependencies not discovered in Phase 3.

**Daily Monitoring (2 check-ins per day):**
- **Morning (02:00 UTC):** Generate daily health summary
- **Midday (14:00 UTC):** Spot-check metrics

**Key Metrics Tracked:**
```sql
-- Error rate (target: < 1%)
SELECT COUNT(*) FILTER (WHERE status >= 400) * 100.0 / COUNT(*) as error_rate
FROM ops_audit_parity_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Latency p95 (target: < 500ms)
SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_delta_ms) as p95_ms
FROM ops_audit_parity_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Uptime (target: > 99.9%)
SELECT SUM(CASE WHEN status < 500 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as uptime_pct
FROM ops_audit_parity_log
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Weekly Reports (Every Friday):**
- Summary table (error rate, latency, uptime trends)
- Incident log (if any)
- Legacy endpoint discovery log (if any)
- Planned action items for next week

**Legacy Dependency Discovery Procedure (If needed):**
```
IF unexpected legacy endpoint still in use:
  a) Identify source system
  b) Determine if: legitimate flow | artifact | third-party
  c) If legitimate:
     - Implement in core-api (if missing)
     - Re-run Phase 3 shadow run for this endpoint (3 days)
     - Then retry Phase 4
  d) If artifact:
     - Remove code, re-deploy
     - No re-execution needed
  e) If third-party:
     - Contact vendor, request update
     - Temporary fallback (if needed)
     - Plan Phase 3 extension
```

**Go/No-Go Decision (2026-06-03):**
```
SUCCESS CRITERIA (All Must Pass):
- Error rate consistently < 1% (all 14 days)
- P95 latency consistently < 500ms (all 14 days)
- Uptime >= 99.9% (all 14 days)
- Zero unplanned incidents
- Zero legacy endpoint discovery
- Zero customer-reported issues
- Legacy backend healthy & bootable

DECISION:
  ✅ GREEN   → Proceed to Phase 6 (decommission)
  🟡 YELLOW  → Extend monitoring (+ 1-2 weeks)
  🔴 RED     → Critical issue found (investigate + fix, retry)
```

**Documentation:**
- ✅ Weekly summary reports (2 documents)
- ✅ Phase 5 → Phase 6 decision document
- ✅ Health check scripts & automation

---

### PHASE 6: LEGACY DECOMMISSION & CLEANUP (2026-06-03 to 2026-06-10, 7 days)

**Objective:** Remove legacy backend from production; archive code & database; clean up infrastructure.

**Execution Steps (Sequential):**

| Day | Task | Owner | Verification |
|-----|------|-------|--------------|
| 1-2 | Code archival (git tag + S3 archive) | DevOps | Archive size OK, metadata logged |
| 1-2 | Final DB backup (Glacier archive) | DBA | Restore test passed in staging |
| 2-3 | Remove Docker images & containers | DevOps | docker images \| grep legacy = empty |
| 3-4 | Clean DNS & routing (remove legacy entries) | DevOps | nslookup legacy-api = NXDOMAIN |
| 4-5 | Revoke credentials (legacy DB user, API keys) | Security | auth services updated |
| 5-7 | Documentation (archive records + migration guide) | Tech Lead | MD files committed to git |
| 7 | Final verification (no legacy references) | DevOps | Automated check script passes |

**Archive Records (Preserved for 7 years):**
- Code archive: S3://vninvest-archives/legacy/
- Database archive: S3 Glacier (with restore procedures)
- Metadata: Git tags + LEGACY_BACKEND_DECOMMISSION_RECORD.md
- Migration guide: docs/MIGRATION_FROM_LEGACY_20260603.md

**Final Verification Checklist:**
- [ ] Legacy Docker images removed
- [ ] Legacy Compose entries removed
- [ ] Legacy DNS entries cleaned
- [ ] Legacy credentials revoked
- [ ] All documentation updated
- [ ] Post-mortem scheduled (if needed)

---

## COMPLETE EXECUTION TIMELINE (Gantt View)

```
May 10 (Fri):   ✅ Phase 3 deployment prep complete (6 docs created)
May 12 (Sun):   Deployment preparation day (config patching, dry-run, testing)
May 13 (Mon):   [====Phase 3 Day 1====]  Shadow run starts (02:00 UTC)
May 14 (Tue):   [====Phase 3 Day 2====]  Monitoring continues
May 15 (Wed):   [====Phase 3 Day 3====]  Final decision + Tech Lead sign-off
May 16-19:      Phase 3 buffer (extend if YELLOW; abort if RED)
May 20 (Tue):   [Phase 4 Cutover]  6-8 hour maintenance window (06:00-14:00 UTC)
May 20-Jun 3:   [========Phase 5: Post-Cutover Monitoring (14 days)========]
May 23 (Fri):   Phase 5 Week 1 summary
May 30 (Fri):   Phase 5 Week 2 summary
Jun 3 (Tue):    Phase 5 → Phase 6 decision (go/no-go)
Jun 3-10:       [===Phase 6: Decommission (7 days)===]
Jun 10 (Tue):   ✅ COMPLETE - All legacy infrastructure decommissioned
```

---

## RISK ASSESSMENT & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Phase 3 parity < 99% | Medium | High | Extend 2-3 days, investigate issues |
| Phase 4 traffic spike error | Low | Critical | Gradual migration (10% → 50% → 100%) + abort threshold |
| Database performance drop | Low | High | Monitor p95 latency, revert if >= 1000ms |
| Legacy dependency missed | Low | Medium | Phase 5 discovery procedure + re-run Phase 3 |
| Rollback fails | Very Low | Critical | Tested rollback procedure, 45-min RTO SLA |
| Customer impact | Low | Very High | Gradual migration, monitoring, incident response team on standby |

---

## SUCCESS METRICS & KPIs

**Phase 3 Success:**
- ✅ Parity score >= 99% on all 3 days
- ✅ Zero critical issues in parity logs
- ✅ Tech Lead sign-off

**Phase 4 Success:**
- ✅ 100% traffic migrated (zero legacy serves primary requests)
- ✅ Error rate < 1% sustained for 30 minutes
- ✅ P95 latency < 600ms sustained for 30 minutes
- ✅ All 5 stakeholder sign-offs

**Phase 5 Success:**
- ✅ Error rate < 1% (all 14 days)
- ✅ P95 latency < 500ms (all 14 days)
- ✅ Uptime >= 99.9% (all 14 days)
- ✅ Zero unplanned incidents
- ✅ Zero legacy endpoint discovery
- ✅ Zero customer-reported issues

**Phase 6 Success:**
- ✅ Complete removal of legacy infrastructure
- ✅ Code archive verified (restore-able)
- ✅ Database archive verified (restore-able)
- ✅ All credentials revoked
- ✅ Documentation complete
- ✅ No legacy references in production config

---

## DELIVERABLES & EVIDENCE

### Documentation (Already Created)
- [x] Phase 3: 5 docs (deployment guide 3,500 lines, test procedures 600 lines, etc.)
- [x] Phase 4: 1 doc (cutover plan 1,200+ lines)
- [x] Phase 5-6: 1 doc (monitoring + decommission plan)
- [x] This master roadmap

### Documentation (To Create During Execution)
- [ ] Phase 3 execution log (daily reports)
- [ ] Phase 4 execution log (hour-by-hour timeline)
- [ ] Phase 5 weekly summaries (2 documents)
- [ ] Phase 6 decommission checklist + records
- [ ] Post-mortem report (if needed)

### Automation Scripts
- [x] `PHASE3_DEPLOYMENT_VALIDATION_SCRIPT_20260510.sh` (validation)
- [x] `PHASE3_DEPLOYMENT_CONFIG_PATCHER_20260510.py` (config automation)
- [ ] `PHASE5_DAILY_HEALTH_CHECK_20260510.sh` (automated daily checks)
- [ ] `PHASE6_VERIFICATION_CHECKLIST.sh` (final verification)

---

## APPROVAL & SIGN-OFF

**Phases 3-4 Execution Approval:**
```
Tech Lead:         __________________ Date: __________
Platform Lead:     __________________ Date: __________
Incident Cmd:      __________________ Date: __________
Backend Lead:      __________________ Date: __________
DevOps Lead:       __________________ Date: __________
```

**Phases 5-6 Execution Approval:**
```
Tech Lead:         __________________ Date: __________
Operations Lead:   __________________ Date: __________
DBA:               __________________ Date: __________
DevOps Lead:       __________________ Date: __________
Compliance/Audit:  __________________ Date: __________
```

---

## SCHEDULE ASSUMPTIONS

- **No major production incidents** during Phases 3-6
- **Team availability:** Core platform team available 24/7 support
- **Change windows:** Execution within defined time windows (UTC business hours + early morning)
- **Dependencies:** Phase N+1 cannot start until Phase N = GREEN

**Buffer Time Built In:**
- Phase 3: +2-3 days if YELLOW (extend shadow run)
- Phase 4: Can be rescheduled if issues found
- Phase 5: Can be extended +14 days if instability detected
- Total cushion: ~20 days (execution can slip into late June if needed)

---

**Overall SAAS Migration Completion Status:** ✅ READY FOR EXECUTION  
**Timeline:** May 10, 2026 - June 10, 2026 (32 days)  
**Next Step:** Execute Phase 3 deployment preparation (2026-05-12)  
**Final Step:** Phase 6 decommission complete (2026-06-10)

**Document prepared by:** Platform Engineering + Tech Lead  
**Last updated:** 2026-05-10  
**Version:** 1.0 (Final)
