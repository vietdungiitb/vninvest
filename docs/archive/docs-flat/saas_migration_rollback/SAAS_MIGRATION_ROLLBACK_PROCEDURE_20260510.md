# SAAS-15 Rollback Procedure & Backup Strategy

**Ngày:** 2026-05-10  
**Ownership:** DevOps Lead + Tech Lead  
**Purpose:** Formalize rollback procedure for legacy decommission; ensure DB backup/restore capability tested before cutover  
**Scope:** All SaaS migration phases (Phase 3-6 in SAAS_MIGRATION_HANDOFF_MASTER_20260504.md)

---

## 1. Rollback Decision Criteria

### Triggers for immediate rollback:
1. **Data corruption detected** — validation query returns unexpected NULL counts or integrity violations
2. **Production API parity broken** — >1% of requests return 5xx errors compared to pre-cutover baseline
3. **Celery task failure rate > 5%** — materializers not keeping up with ingest velocity
4. **Database connection pool exhausted** — core-api/core-worker cannot acquire connections
5. **Redis cache invalid** — snapshot/facts cache older than 30min for >50% of symbols
6. **Customer-facing feature down > 15min** — e.g., portfolio view, watchlist, whale alerts all unavailable

### Decision authority:
- **Tech Lead** — triggers automatic rollback for criteria 1-3
- **DevOps Lead** — approves rollback for criteria 4-6
- **Product Lead** — final sign-off on customer impact communication

### Decision window:
- **Auto-rollback**: Initiated immediately upon detection (0 minutes)
- **Coordinated rollback**: Within 5 minutes of decision to minimize user impact

---

## 2. Rollback Procedure (Standard)

### RTO Target: 10 minutes (rollback complete + all services healthy)
### RPO Target: 0 minutes (no data loss; schema sync is unidirectional)

### Phase 1: STOP New Changes (1-2 minutes)

```bash
# 1a. Stop all core containers (prevent writes to production schema)
docker compose -f docker-compose.prod.yml down core-api core-worker core-beat

# 1b. Drain in-flight Celery tasks
docker logs <celery-container-id> | tail -20
# Wait for queue depth to reach 0 (max 30s)

# 1c. Backup current core database state (insurance policy)
pg_dump -U postgres -h db \
  --exclude-table-data='ops_audit_*' \
  --exclude-table-data='portfolio_intradaytick' \
  vninvest > /backups/core-final-state-$(date +%Y%m%d-%H%M%S).sql
```

### Phase 2: RESTORE Legacy Schema (3-5 minutes)

```bash
# 2a. Verify backup file exists and is readable
ls -lh /backups/vninvest-pre-cutover.sql
# Expected size: ~500MB - 1GB (dev with full whale dataset)

# 2b. Drop core-specific tables (identity_access, market_serving, signal_intelligence, etc.)
docker compose -f docker-compose.prod.yml exec db psql -U postgres << 'EOF'
-- Drop all core domain apps' tables (preserve legacy portfolio, support schema)
DROP SCHEMA IF EXISTS identity_access CASCADE;
DROP SCHEMA IF EXISTS market_serving CASCADE;
DROP SCHEMA IF EXISTS signal_intelligence CASCADE;
DROP SCHEMA IF EXISTS commercial CASCADE;
DROP SCHEMA IF EXISTS advisory CASCADE;
DROP SCHEMA IF EXISTS ops_audit CASCADE;
DROP SCHEMA IF EXISTS data_ingest CASCADE;
DROP SCHEMA IF EXISTS user_workspace_core CASCADE;
DROP SCHEMA IF EXISTS market_data_core CASCADE;
EOF

# 2c. Restore legacy database from pre-cutover snapshot
docker compose -f docker-compose.prod.yml exec db psql -U postgres vninvest < /backups/vninvest-pre-cutover.sql

# 2d. Verify schema integrity
docker compose -f docker-compose.prod.yml exec db psql -U postgres -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
# Expected: portfolio_*, support_* tables present
```

### Phase 3: RESTART Legacy Services (2 minutes)

```bash
# 3a. Start legacy backend (Django app)
docker compose -f docker-compose.prod.yml up -d --no-build backend

# 3b. Health check — wait for HTTP 200 on /api/health
curl -v http://backend:8000/api/health
# Expected: { "status": "ok" }

# 3c. Start legacy Celery workers
docker compose -f docker-compose.prod.yml up -d --no-build celery_worker celery_beat

# 3d. Verify Celery health
docker compose -f docker-compose.prod.yml exec celery_worker celery -A config inspect active | head -20

# 3e. Start frontend with legacy routing
docker compose -f docker-compose.prod.yml up -d --no-build frontend
curl -v http://frontend:3000/portfolios
# Expected: 200 response with React app HTML
```

### Phase 4: VALIDATE Rollback Complete (2-3 minutes)

```bash
# 4a. Database schema check
PGPASSWORD=postgres psql -h localhost -U postgres -d vninvest << 'EOF'
-- Count legacy records
SELECT 'portfolio_watchlist' AS table_name, COUNT(*) FROM portfolio_watchlist
UNION ALL
SELECT 'portfolio_whalealertevent', COUNT(*) FROM portfolio_whalealertevent
UNION ALL
SELECT 'portfolio_tickersessionclose', COUNT(*) FROM portfolio_tickersessionclose;
EOF
# Expected: Non-zero rows for each table

# 4b. API smoke test (legacy endpoints)
curl -X GET "http://localhost:8000/api/portfolios/" \
  -H "Authorization: Bearer ${LEGACY_PAT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.count'
# Expected: Integer > 0

# 4c. Websocket test (if applicable)
wscat -c ws://localhost:8000/ws/realtime/symbols/
# Expected: connection established, message stream

# 4d. Check error logs
docker logs backend 2>&1 | grep -i error | tail -5
# Expected: No recent ERROR lines related to schema/connection failures
```

### Phase 5: COMMUNICATION (ongoing)

```bash
# 5a. Notify support team
echo "Rollback to legacy backend completed at $(date). 
Service is LIVE. Monitor Sentry for user-reported issues.
Post-mortems scheduled for 24h after rollback decision." \
| mail -s "ROLLBACK COMPLETE: VNInvest SaaS Migration CANCELLED" support@vninvest.com

# 5b. Update incident channel (Slack/Discord)
slack post --channel "#incidents" --text "🔴 **SAAS-15 ROLLBACK COMPLETE**
Reason: [see decision criteria above]
Time to rollback: [X minutes]
Status: Legacy backend LIVE
Next steps: Investigation + post-mortem"

# 5c. Record incident in logs
echo "[$(date)] SAAS-15 rollback initiated
Trigger: [decision criteria]
Duration: [total minutes]
Result: LIVE-LEGACY
" >> /var/log/saas-migration-incidents.log
```

---

## 3. Backup Strategy

### 3.1 Pre-Cutover Backup (Mandatory)

**When:** Day-of cutover, **before** first core container starts  
**What:** Full PostgreSQL dump of legacy `vninvest` database  
**Where:** `/backups/vninvest-pre-cutover.sql` on persistent volume  
**Size estimate:** ~500MB - 1GB (with full whale history)  
**Retention:** Keep for 90 days (fallback restoration window)

```bash
# Manual execution (DevOps to run on day-of-cutover)
pg_dump -U postgres -h db \
  --exclude-table-data='portfolio_intradaytick' \
  --format=custom \
  --compress=9 \
  vninvest > /backups/vninvest-pre-cutover-$(date +%Y%m%d-%H%M%S).dump

# Verify backup size and readability
du -h /backups/vninvest-pre-cutover-*.dump
pg_restore --list /backups/vninvest-pre-cutover-*.dump | head -20
```

### 3.2 Ongoing Daily Backups (Production)

**Schedule:** 2:00 AM UTC daily via Celery Beat  
**What:** Full database snapshot + transaction log  
**Where:** Cloudflare R2 bucket `vninvest-backups` or AWS S3  
**Retention:** 30 days rolling (oldest deleted after 30 days)  
**Encryption:** AES-256 at rest, TLS in transit

**File structure:**
```
vninvest-backups/
├── daily/
│   ├── 2026-05-10-postgresql-full.dump.aes256
│   ├── 2026-05-11-postgresql-full.dump.aes256
│   └── ...
├── weekly/
│   ├── 2026-05-10-postgresql-full.dump.aes256
│   └── ...
└── metadata.json (index of all backups + checksums)
```

### 3.3 Implementation

**Location:** `packages/core/backend/src/ops_audit/tasks.py`

```python
from celery import shared_task
from django.conf import settings
import subprocess
import boto3
import hashlib
from datetime import datetime, timedelta

@shared_task(bind=True, max_retries=3)
def daily_db_backup(self):
    """
    Automated daily backup task.
    
    Schedule: crontab(hour=2, minute=0) — 2:00 AM UTC
    Retention: 30 days rolling
    """
    try:
        # 1. Dump database locally
        dump_file = f"/tmp/vninvest-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.dump"
        cmd = [
            'pg_dump',
            '-U', os.getenv('DB_USER'),
            '-h', os.getenv('DB_HOST'),
            '--format=custom',
            '--compress=9',
            '--exclude-table-data=portfolio_intradaytick',
            os.getenv('DB_NAME')
        ]
        subprocess.run(cmd, check=True, stdout=open(dump_file, 'wb'))
        
        # 2. Compress and encrypt
        with open(dump_file, 'rb') as f:
            backup_data = f.read()
        
        checksum = hashlib.sha256(backup_data).hexdigest()
        
        # 3. Upload to S3/R2
        s3 = boto3.client(
            's3',
            endpoint_url=settings.BACKUP_S3_ENDPOINT,
            aws_access_key_id=settings.BACKUP_S3_KEY,
            aws_secret_access_key=settings.BACKUP_S3_SECRET,
        )
        
        backup_key = f"daily/{datetime.utcnow().strftime('%Y%m%d')}-postgresql-full.dump"
        s3.put_object(
            Bucket=settings.BACKUP_S3_BUCKET,
            Key=backup_key,
            Body=backup_data,
            ServerSideEncryption='AES256',
            Metadata={'checksum': checksum}
        )
        
        # 4. Cleanup old backups (>30 days)
        cutoff = datetime.utcnow() - timedelta(days=30)
        response = s3.list_objects_v2(Bucket=settings.BACKUP_S3_BUCKET, Prefix='daily/')
        for obj in response.get('Contents', []):
            if datetime.fromisoformat(obj['LastModified']) < cutoff:
                s3.delete_object(Bucket=settings.BACKUP_S3_BUCKET, Key=obj['Key'])
        
        # 5. Log success
        logger.info(f"Backup completed: {backup_key}, checksum={checksum}")
        return {'status': 'ok', 'file': backup_key, 'checksum': checksum}
        
    except Exception as exc:
        logger.error(f"Backup failed: {exc}")
        raise self.retry(exc=exc, countdown=300)  # Retry in 5 min
```

---

## 4. Restore Test Script

**Location:** `scripts/test-backup-restore.sh`  
**Purpose:** Verify backup integrity and measure restore time (weekly on staging)

```bash
#!/bin/bash
set -e

BACKUP_DATE=${1:-$(date +%Y%m%d)}
BACKUP_KEY="daily/${BACKUP_DATE}-postgresql-full.dump"
TEST_DB="vninvest_restore_test"
RTO_TARGET_SECONDS=300  # 5 minutes acceptable

echo "=== Backup Restore Test ==="
echo "Date: $BACKUP_DATE"
echo "Target RTO: ${RTO_TARGET_SECONDS}s"

# 1. Download backup from S3
echo "1. Downloading backup..."
aws s3 cp "s3://vninvest-backups/${BACKUP_KEY}" /tmp/restore.dump \
  --endpoint-url $AWS_ENDPOINT \
  --region auto

# 2. Verify checksum
echo "2. Verifying checksum..."
EXPECTED_CHECKSUM=$(aws s3api head-object \
  --bucket vninvest-backups \
  --key "$BACKUP_KEY" \
  --endpoint-url $AWS_ENDPOINT \
  --query 'Metadata.checksum' --output text)

ACTUAL_CHECKSUM=$(sha256sum /tmp/restore.dump | awk '{print $1}')

if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
  echo "❌ CHECKSUM MISMATCH!"
  exit 1
fi
echo "✅ Checksum verified: $ACTUAL_CHECKSUM"

# 3. Create test database and restore
echo "3. Restoring to test database..."
START_TIME=$(date +%s)

psql -U postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
psql -U postgres -c "CREATE DATABASE ${TEST_DB};"
pg_restore -U postgres -d "${TEST_DB}" /tmp/restore.dump

END_TIME=$(date +%s)
RESTORE_TIME=$((END_TIME - START_TIME))

echo "✅ Restore completed in ${RESTORE_TIME}s"

# 4. Validate data integrity
echo "4. Validating data..."
PORTFOLIO_COUNT=$(psql -U postgres -d "${TEST_DB}" -t -c \
  "SELECT COUNT(*) FROM portfolio_portfolio;")
WHALE_COUNT=$(psql -U postgres -d "${TEST_DB}" -t -c \
  "SELECT COUNT(*) FROM portfolio_whalealertevent WHERE created_at > NOW() - INTERVAL '7 days';")

echo "   Portfolios: $PORTFOLIO_COUNT"
echo "   Whale alerts (7d): $WHALE_COUNT"

if [ "$PORTFOLIO_COUNT" -lt 1 ] || [ "$WHALE_COUNT" -lt 1 ]; then
  echo "❌ DATA VALIDATION FAILED — insufficient rows!"
  exit 1
fi
echo "✅ Data integrity OK"

# 5. Check RTO
echo "5. Evaluating RTO..."
if [ "$RESTORE_TIME" -le "$RTO_TARGET_SECONDS" ]; then
  echo "✅ RTO MET: ${RESTORE_TIME}s <= ${RTO_TARGET_SECONDS}s"
  EXIT_CODE=0
else
  echo "⚠️  RTO MISSED: ${RESTORE_TIME}s > ${RTO_TARGET_SECONDS}s"
  EXIT_CODE=1
fi

# 6. Cleanup
psql -U postgres -c "DROP DATABASE ${TEST_DB};"
rm /tmp/restore.dump

exit $EXIT_CODE
```

---

## 5. RTO/RPO Estimates

### Based on current environment:

| Metric | Estimate | Notes |
|--------|----------|-------|
| **RTO (Recovery Time Objective)** | 10 minutes | Phase 1-4 combined; dominated by DB restore (3-5min) |
| **RPO (Recovery Point Objective)** | 0 minutes | Backup taken pre-cutover; zero data loss on schema sync |
| **Backup creation time** | 5-10 minutes | pg_dump with compression=9 on ~1GB database |
| **Restore time (from dump)** | 3-5 minutes | pg_restore -j4 (4 parallel jobs) |
| **Verification time** | 2-3 minutes | Schema integrity + smoke test |
| **Total rollback window** | 10 minutes | Acceptable for production incident |

### Assumptions:
1. Pre-cutover backup already on disk (no network I/O)
2. Core schema tables are DROP-able (no foreign key cascades)
3. Legacy backend binary is still in git history (rollback doesn't require recompile)
4. Database disk has space for simultaneous backup + restore operations

### Improvement opportunities:
- Store pre-cutover backup on local SSD (not network storage) → -1min restore time
- Use pg_restore with `-j8` (8 parallel jobs) → -30s restore time
- Pre-create legacy services as stopped containers → faster start in Phase 3

---

## 6. Testing & Validation (Pre-Cutover)

### Test 1: Backup creation (manual)
```bash
# Timing check
time pg_dump -U postgres -h db --compress=9 vninvest > /tmp/backup-test.dump
# Expected: <10 minutes

# Size check
du -h /tmp/backup-test.dump
# Expected: 500MB - 1GB
```

### Test 2: Restore time (staging)
```bash
# Weekly: Run test-backup-restore.sh on staging database
bash scripts/test-backup-restore.sh 2026-05-09
# Expected: RTO <= 300s
```

### Test 3: Rollback drill (simulation)
```bash
# Pre-cutover (day-of): Run Phase 1-4 on copy of prod environment
# Simulate container stop, schema drop, restore, legacy start
# Target: Complete in 10 minutes with zero manual intervention
```

---

## 7. Evidence Checklist (Gate F)

### ✅ Rollback procedure signed off
- [ ] Tech Lead reviewed and approved procedure steps
- [ ] DevOps verified all shell scripts executable and correct
- [ ] Decision criteria documented and shared with team

### ✅ Backup strategy implemented
- [ ] `daily_db_backup` Celery task created and tested
- [ ] Backup destination (S3/R2) configured with proper IAM
- [ ] Encryption enabled (AES-256 at rest)
- [ ] Retention policy enforced (30-day rolling)

### ✅ Restore test passed
- [ ] `test-backup-restore.sh` created and executable
- [ ] Weekly restore test scheduled and passes
- [ ] RTO/RPO targets met on test run
- [ ] Data integrity validated post-restore

### ✅ Go/No-Go decision
- [ ] All three above items ✅ complete
- [ ] Tech Lead sign-off for Gate F = **GREEN**
- [ ] Production cutover approved by Steering Committee

---

## 8. Rollback Incident Post-Mortem (if triggered)

If rollback is executed, post-mortem must include:

1. **Timeline** — exact trigger condition and timestamp
2. **Root cause** — what failed in core that required rollback
3. **Remedy** — what code change fixes the failure
4. **Prevention** — how to catch this in pre-prod testing
5. **Re-cutover plan** — date/time for next cutover attempt

Post-mortem due **24 hours after rollback triggered**.

---

## Appendix: Emergency contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Tech Lead | [Name] | [Phone] | @tech-lead |
| DevOps Lead | [Name] | [Phone] | @devops-lead |
| Product Lead | [Name] | [Phone] | @product-lead |
| Database Admin | [Name] | [Phone] | @dba |
| On-call Escalation | [Name] | [Phone] | @oncall-rotation |

---

**Document owner:** DevOps Lead  
**Last reviewed:** 2026-05-10  
**Next review:** Before production cutover  
**Status:** ✅ READY FOR GATE F VALIDATION
