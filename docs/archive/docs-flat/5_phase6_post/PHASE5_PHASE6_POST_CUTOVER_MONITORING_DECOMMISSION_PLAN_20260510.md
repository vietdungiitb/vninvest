# PHASE5_PHASE6_POST_CUTOVER_MONITORING_DECOMMISSION_PLAN_20260510.md

## Phase 5 & 6: Post-Cutover Monitoring + Legacy Decommission (2026-05-20 to 2026-06-03)

**Timeline:**
- **Phase 5:** Post-cutover monitoring (2 weeks) — 2026-05-20 to 2026-06-03
- **Phase 6:** Legacy decommission cleanup (1 week) — 2026-06-03 to 2026-06-10

**Goals:**
- Phase 5: Verify production stability; catch any legacy dependencies not discovered in Phase 3
- Phase 6: Remove legacy backend from production; archive code; update documentation

---

## PHASE 5: POST-CUTOVER MONITORING (2026-05-20 to 2026-06-03)

### 5.1 Daily Monitoring Checklist (2-Week Period)

**Each day at 02:00 UTC (morning summary) and 14:00 UTC (midday check):**

```bash
# Script: scripts/PHASE5_DAILY_HEALTH_CHECK_20260510.sh

#!/bin/bash

echo "=== PHASE 5 Daily Health Check ===" >> /var/log/phase5_health.log
date >> /var/log/phase5_health.log

# 1. Error rate across core-api
echo "Core-API Error Rate:" >> /var/log/phase5_health.log
docker compose exec db psql -U postgres -d vninvest_core -t -c "
  SELECT COUNT(*) FILTER (WHERE core_status >= 400) * 100.0 / COUNT(*) as error_rate
  FROM ops_audit_parity_log
  WHERE created_at > NOW() - INTERVAL '24 hours';
" >> /var/log/phase5_health.log

# 2. Latency p95 (all endpoints)
echo "Latency P95:" >> /var/log/phase5_health.log
docker compose exec db psql -U postgres -d vninvest_core -t -c "
  SELECT 
    endpoint,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_delta_ms) as p95_ms
  FROM ops_audit_parity_log
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY endpoint
  ORDER BY p95_ms DESC
  LIMIT 5;
" >> /var/log/phase5_health.log

# 3. Database replication lag (if applicable)
echo "DB Replication Lag:" >> /var/log/phase5_health.log
docker compose exec db psql -U postgres -t -c "
  SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::int as lag_seconds;
" >> /var/log/phase5_health.log

# 4. Celery queue depth
echo "Celery Queue Depth:" >> /var/log/phase5_health.log
docker compose exec core-worker celery -A vninvest_core inspect active_queues --timeout=5 \
  | grep -c "active_queues" >> /var/log/phase5_health.log

# 5. Core-API memory usage
echo "Core-API Memory:" >> /var/log/phase5_health.log
docker stats core-api --no-stream | tail -1 >> /var/log/phase5_health.log

# Alert thresholds
if grep -q "error_rate.*[5-9]\.[0-9]\|error_rate.*[1-9][0-9]" /var/log/phase5_health.log; then
  echo "⚠️  ERROR RATE HIGH - INVESTIGATE" | mail -s "Phase 5 Alert" ops@vninvest.com
fi

if grep -q "p95_ms.*[6-9][0-9]{2}\|p95_ms.*[1-9][0-9]{3}" /var/log/phase5_health.log; then
  echo "⚠️  LATENCY HIGH - INVESTIGATE" | mail -s "Phase 5 Alert" ops@vninvest.com
fi
```

---

### 5.2 Weekly Summary Report (Every Friday)

**Template: PHASE5_WEEKLY_SUMMARY_20260520.md**

```markdown
# Phase 5 Weekly Summary — Week of [DATE]

## Stability Metrics (Target: < 1% error rate, P95 < 500ms)

| Metric | Week 1 | Week 2 | Target | Status |
|--------|--------|--------|--------|--------|
| Error Rate | __% | __% | < 1% | ☐ PASS ☐ FAIL |
| P95 Latency | __ms | __ms | < 500ms | ☐ PASS ☐ FAIL |
| Uptime | __%  | __% | > 99.9% | ☐ PASS ☐ FAIL |
| Incidents | __  | __ | 0 | ☐ PASS ☐ FAIL |
| Unplanned Restarts | __ | __ | 0 | ☐ PASS ☐ FAIL |

## Incidents This Week

| Date | Time | Service | Issue | Duration | Resolution |
|------|------|---------|-------|----------|------------|
| __ | __ | __ | __ | __ | __ |

## Legacy Backend Status (Standby Verification)

- [ ] Legacy backend container verified bootable (tested restart)
- [ ] Database backup size OK (expected ~100GB)
- [ ] Replication lag verified (if replica enabled)
- [ ] No unexpected access attempts to legacy system

## Next Week Action Items

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Sign-Off

**Operations Lead:** __________________ Date: __________
**Tech Lead:** __________________ Date: __________
```

---

### 5.3 Legacy Dependency Discovery Procedure

**If unexpected legacy endpoint is discovered still in use:**

```
1. IMMEDIATE (within 1 hour):
   - Identify which system is calling legacy endpoint
   - Capture request pattern (frequency, payload)
   - Document in LEGACY_DEPENDENCIES_DISCOVERED.md

2. DIAGNOSIS (within 4 hours):
   - Determine if this is a:
     a) Legitimate business flow not in Phase 3 scope
     b) Artifact/testing code
     c) Third-party integration using legacy endpoints
   
   - Check if core-api has equivalent endpoint
   - Review Phase 3 parity logs for this endpoint

3. REMEDIATION:
   
   If (a) business flow:
   - Implement equivalent in core-api if missing
   - Re-run Phase 3 shadow run for this endpoint (3-day minimum)
   - Then proceed with Phase 4 retry
   
   If (b) artifact:
   - Remove legacy code references
   - Update code, re-deploy frontend/mobile
   - No re-execution needed
   
   If (c) third-party:
   - Contact third party, request update to core-api endpoints
   - Provide temporary legacy fallback (if time-sensitive)
   - Plan Phase 3 extension for this endpoint

4. DOCUMENTATION:
   - Update LEGACY_DEPENDENCIES_DISCOVERED.md
   - Update Phase 3 Shadow Run Plan (lesson learned)
   - Update Phase 4 playbook for future reference
```

---

### 5.4 Go/No-Go Decision: Proceed to Phase 6 (2026-06-03)

**Tech Lead to evaluate on Friday 2026-06-03:**

#### Success Criteria (All Must Pass)

- ✅ Error rate consistently < 1% (all 14 days)
- ✅ P95 latency consistently < 500ms (all 14 days)  
- ✅ Uptime >= 99.9% (all 14 days)
- ✅ Zero unplanned incidents
- ✅ Zero legacy endpoint discovery
- ✅ Zero customer-reported migration issues
- ✅ Legacy backend healthy & verified bootable

#### Decision Point

```
IF all success criteria PASS:
  → Proceed to Phase 6 (2026-06-03)
     Action: Begin legacy code archival & decommission

ELSE IF any criteria FAIL:
  → Extended monitoring (+ 1-2 weeks)
     Action: Investigate root cause, implement fix, re-test
     
     Sub-decision after extended period:
     - If PASS after fix: Proceed to Phase 6
     - If still FAIL: Consider rollback (extreme case)
```

**Tech Lead Sign-Off:**
```
Phase 5 Completion Decision: ☐ GREEN (proceed to Phase 6) ☐ YELLOW (extend monitoring) ☐ RED (investigate)

Tech Lead: __________________ Date: 2026-06-03
```

---

## PHASE 6: LEGACY DECOMMISSION & CLEANUP (2026-06-03 to 2026-06-10)

### 6.1 Decommission Execution Checklist

**All items must be completed in sequence.**

#### Step 1: Code Archival (Day 1-2)

```bash
# Step 1.1: Create final archive tag
git tag -a "production-cutover-2026-05-20" -m "Final legacy backend commit before decommission"
git push origin "production-cutover-2026-05-20"

# Step 1.2: Create isolated legacy branch (for reference, never merged back)
git checkout -b archive/legacy-backend-final
# (stays on this branch, no changes going forward)

# Step 1.3: Archive legacy backend code to S3/cold storage
tar --exclude='.git' --exclude='*.pyc' --exclude='__pycache__' \
  -czf /backup/legacy-backend-archive-20260603.tar.gz backend/
aws s3 cp /backup/legacy-backend-archive-20260603.tar.gz \
  s3://vninvest-archives/legacy/
```

**Documentation:**
```
Legacy Backend Archive Record:
- Archive Date: 2026-06-03
- Archive Size: ~500MB (compressed)
- Storage: S3://vninvest-archives/legacy/legacy-backend-archive-20260603.tar.gz
- Retention: 7 years (per compliance)
- Retrieval: Available if needed for historical analysis
```

---

#### Step 2: Database Archival (Day 1-2)

```bash
# Step 2.1: Final production database backup
docker compose -f docker-compose.prod.yml exec db pg_dump \
  -U postgres \
  -d vninvest_core \
  --compress=9 \
  --verbose \
  > /backup/vninvest_core_final_predecomm_20260603.dump.gz

# Expected: ~50-200GB (compressed to ~10-20GB)

# Step 2.2: Verify backup integrity
pg_restore --list /backup/vninvest_core_final_predecomm_20260603.dump.gz \
  | head -20

# Step 2.3: Archive to cold storage (Glacier)
aws s3 cp /backup/vninvest_core_final_predecomm_20260603.dump.gz \
  s3://vninvest-archives/database/ \
  --storage-class GLACIER

# Step 2.4: Delete local backup (keep only archived copy)
rm /backup/vninvest_core_final_predecomm_20260603.dump.gz
```

**Documentation:**
```
Database Archive Record:
- Archive Date: 2026-06-03
- Database: vninvest_core (PostgreSQL 13)
- Size: ~15GB (compressed)
- Storage: AWS S3 Glacier (vninvest-archives/database/)
- Checksum: [MD5 checksum]
- Retention: 7 years (per data governance policy)
```

---

#### Step 3: Legacy Infrastructure Removal (Day 2-3)

```bash
# Step 3.1: Stop legacy application containers
docker compose -f docker-compose.prod.yml stop backend

# Step 3.2: Stop legacy database (if running separate instance)
# Note: If database is shared with core, SKIP this step
# docker compose -f docker-compose.prod.yml stop legacy_db

# Step 3.3: Remove Docker images
docker image rm vninvest-legacy-backend:latest
docker image rm vninvest-legacy-worker:latest

# Step 3.4: Verify removal
docker images | grep legacy
# Expected: No results

# Step 3.5: Update docker-compose.prod.yml
# Remove entire 'backend', 'legacy_db', etc. sections (if separate)
# Keep only: core-api, core-worker, core-beat, db (shared), redis, nginx
```

---

#### Step 4: DNS & Routing Cleanup (Day 3-4)

```bash
# Step 4.1: Remove legacy API DNS records
# From DNS provider (Route53, Cloudflare, etc):
# - Remove: legacy-api.vninvest.com
# - Remove: api-legacy.vninvest.com
# (Document in ops runbook)

# Step 4.2: Remove legacy fallback routes from Nginx
# From /etc/nginx/conf.d/cutover.conf:
# - Remove legacy_fallback.conf.backup
# - Remove all legacy upstream definitions
# - Keep ONLY core-api upstream

# Step 4.3: Update API documentation
# Remove all legacy endpoint documentation
# Keep only /core/v1/* endpoints in public API docs
```

---

#### Step 5: Secrets & Credentials Cleanup (Day 4-5)

```bash
# Step 5.1: Rotate legacy database credentials (if separate)
# If legacy DB is shared with core:
# - No action needed (already rotated in Phase 4)

# Step 5.2: Revoke legacy API keys
# For any partner integrations using legacy endpoints:
# - Contact partners with migration notice (should be done pre-Phase 4)
# - Revoke legacy API keys after 30-day grace period

# Step 5.3: Remove legacy service account (if created)
docker compose -f docker-compose.prod.yml exec db psql -U postgres -c "
  DROP ROLE IF EXISTS legacy_app_user;
  DROP ROLE IF EXISTS legacy_backup_user;
"

# Step 5.4: Clean up environment variables
# Remove from .env.prod:
# - LEGACY_DATABASE_URL
# - LEGACY_BACKEND_PORT
# - LEGACY_READONLY_MODE
# (any other legacy-specific vars)
```

---

#### Step 6: Documentation & Knowledge Transfer (Day 5-7)

```bash
# Step 6.1: Create legacy decommission summary
cat > docs/LEGACY_BACKEND_DECOMMISSION_RECORD_20260603.md << 'EOF'
# Legacy Backend Decommission Record

## Timeline
- Phase 3 Shadow Run: 2026-05-13 to 2026-05-15
- Phase 4 Cutover: 2026-05-20
- Phase 5 Monitoring: 2026-05-20 to 2026-06-03
- Phase 6 Decommission: 2026-06-03 to 2026-06-10

## Code Archival
- Repository: https://github.com/vietdungiitb/vninvest
- Final Commit: [hash]
- Archive Tag: production-cutover-2026-05-20
- Backup Location: S3://vninvest-archives/legacy/

## Database Archival
- Final Snapshot Date: 2026-06-03
- Storage: AWS S3 Glacier
- Retention: 7 years
- Restore Procedure: [documented in runbook]

## Service Shutdown Record
- Last Traffic: 2026-05-20 11:00 UTC
- All Traffic Migrated To: core-api (100%)
- Legacy Standby Duration: 15 days
- Final Shutdown: 2026-06-03 14:00 UTC

## Lessons Learned
- [ ] Phase 3 shadow run was comprehensive
- [ ] Phase 4 traffic migration went smoothly
- [ ] No critical dependencies missed
- [ ] All monitoring/alerting worked as expected
- [ ] Future note: [add any relevant notes]

## Approval
- Tech Lead: __________________ Date: __________
- DevOps: __________________ Date: __________
- DBA: __________________ Date: __________
EOF

git add docs/LEGACY_BACKEND_DECOMMISSION_RECORD_20260603.md
git commit -m "legacy backend decommission record (2026-06-03)"
git push origin main

# Step 6.2: Update architecture documentation
# - Update project README: Mention legacy backend deprecated
# - Update API documentation: Remove legacy endpoint references
# - Update deployment guides: Remove legacy compose configs
# - Update monitoring dashboards: Remove legacy metrics

# Step 6.3: Create migration guide for future developers
cat > docs/MIGRATION_FROM_LEGACY_20260603.md << 'EOF'
# Migration Guide: Legacy Backend to Core-API

This document describes how the VNInvest backend migrated from
legacy monolith (backend/portfolio/) to core-api (packages/core/backend/)
during May 2026.

## High-Level Timeline
[Document key dates and decisions]

## Architecture Comparison
[Show legacy vs. core architecture]

## Key Implementation Changes
[Describe what changed, why it changed]

## Testing Strategy Recap
[Shadow run, parity verification, traffic migration]

## Lessons Learned
[Important insights for future migrations]
EOF

git add docs/MIGRATION_FROM_LEGACY_20260603.md
git commit -m "legacy migration guide (for historical reference)"
git push origin main
```

---

#### Step 7: Final Verification (Day 7)

```bash
# Verification Checklist:
# [ ] Legacy Docker images removed
# [ ] Legacy Compose entries removed
# [ ] Legacy DNS entries cleaned
# [ ] Legacy credentials revoked
# [ ] Legacy database archive verified (restore test in staging)
# [ ] Documentation updated & committed
# [ ] All team members notified
# [ ] Post-mortem/retrospective scheduled (if needed)

# Final system state verification:
echo "=== PHASE 6 FINAL VERIFICATION ==="

echo "✅ Service Status:"
docker compose -f docker-compose.prod.yml ps \
  | grep -E "core-api|core-worker|core-beat|db|redis|nginx"

echo "✅ Database connections (core-api):"
docker compose exec db psql -U postgres -d vninvest_core -t -c \
  "SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;"

echo "✅ No legacy references in compose:"
grep -i "legacy\|backend:" docker-compose.prod.yml || echo "  (Clean - no legacy found)"

echo "✅ Core-API endpoints operational:"
for endpoint in /core/v1/phase3/parity-status/ /health/; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://core-api:8000$endpoint)
  echo "  $endpoint: HTTP $status"
done

echo ""
echo "=== PHASE 6 DECOMMISSION COMPLETE ==="
```

**Final Sign-Off:**
```
Phase 6 Decommission: ✅ COMPLETE

Date: 2026-06-10
Status: All legacy infrastructure removed
Core-API: 100% production traffic
Backups: Archived & verified

Signed:
- Tech Lead: __________________ 
- DevOps: __________________ 
- DBA: __________________ 
```

---

### 6.2 Post-Decommission Monitoring (Week of 2026-06-10)

**Continue daily health checks for 1 additional week to ensure system stability after decommission.**

```bash
# Daily check (automated, same script as Phase 5)
scripts/PHASE5_DAILY_HEALTH_CHECK_20260510.sh

# Alert if any issues arise (though unlikely post-decommission)
```

---

## OVERALL TIMELINE SUMMARY

```
2026-05-13 to 2026-05-15:  Phase 3 - Shadow Run (parity verification)
2026-05-20:                Phase 4 - Production Cutover
2026-05-20 to 2026-06-03:  Phase 5 - Post-Cutover Monitoring (14 days)
2026-06-03 to 2026-06-10:  Phase 6 - Legacy Decommission & Cleanup
2026-06-10:                ✅ COMPLETE - Full migration to core-api

Total Duration: ~4 weeks from shadow run start to full decommission
```

---

## DOCUMENTATION & EVIDENCE CHECKLIST

**Artifacts to create during Phase 5-6:**

- [ ] Weekly Phase 5 summaries (2 documents)
- [ ] Phase 5 → Phase 6 decision document (go/no-go)
- [ ] Phase 6 execution log (day-by-day checklist)
- [ ] Legacy Backend Archive Record (metadata)
- [ ] Database Archive Record (with restore procedures)
- [ ] Legacy Decommission Record (final documentation)
- [ ] Migration Guide (for future developers/auditors)
- [ ] Post-Mortem Report (lessons learned)
- [ ] Code commits: archive tag + decommission-complete tag

---

**Phase 5-6 Plan Status:** READY FOR POST-CUTOVER EXECUTION  
**Last Updated:** 2026-05-10  
**Prepared by:** Platform Engineering + Operations Team
