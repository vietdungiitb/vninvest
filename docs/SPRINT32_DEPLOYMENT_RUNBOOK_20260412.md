# SPRINT 32: Deployment Runbook

**Auto-Generated:** 2026-04-12  
**Deployment Type:** Zero-downtime (rolling update)  
**Environments:** Staging → Production

---

## Pre-Deployment Checklist

- [ ] All UAT scenarios passed (S1-S4)
- [ ] Code review approved by tech lead
- [ ] No P1/P2 blockers
- [ ] Database migrations tested on staging
- [ ] API endpoints verified on staging
- [ ] Frontend UI tested on all browsers
- [ ] Performance benchmarks meet targets
- [ ] Rollback procedure documented
- [ ] Team notified of deployment window
- [ ] Database backup created

---

## Phase 1: Staging Deployment (Friday May 2)

### 1.1 Pre-deploy Verification

```bash
# Clear staging data (optional, for clean test)
cd /path/to/staging/backend
python manage.py flush --no-input

# Verify migrations work in isolation
python manage.py migrate portfolio --fake-initial
python manage.py migrate portfolio zero

# Run full test suite
pytest portfolio/tests/test_runtime_vnstock_config.py \
        portfolio/tests/test_views_vnstock_config.py \
        -v --tb=short
# Expected: ALL PASS ✓
```

### 1.2 Deploy Code

```bash
# On staging server
cd /path/to/staging

# Switch to sprint32 branch (or create release branch)
git checkout sprint32-vnstock-config
git pull origin sprint32-vnstock-config

# Update requirements (if any new packages)
pip install -r backend/requirements.txt

# For Docker deployment (recommended)
docker-compose -f docker-compose.staging.yml \
  --env-file staging.env \
  up -d --build backend frontend
```

### 1.3 Run Migrations

```bash
# From backend container
docker-compose -f docker-compose.staging.yml exec backend bash

# Run migrations
python manage.py makemigrations portfolio
python manage.py migrate portfolio

# Create singleton config
python manage.py shell
>>> from portfolio.models import RuntimeVnstockConfig
>>> RuntimeVnstockConfig.get_or_create_singleton()
>>> config = RuntimeVnstockConfig.objects.get(pk=1)
>>> print(config.to_dict())
# Should output default values

# Exit shell
exit()
```

### 1.4 Smoke Test

```bash
# Test API endpoints
curl -X GET "http://staging.vninvest.local/api/admin-ops/vnstock-config/current/" \
  -H "Authorization: Bearer <staging-token>" \
  -H "Content-Type: application/json"

# Expected response: 200 OK with max_concurrency: 12

# Test admin UI
curl -X GET "http://staging.vninvest.local/admin/portfolio/runtimevnstockconfig/" \
  -b "sessionid=<session_id>"

# Should show one record
```

### 1.5 Staging UAT (2 hours)

```bash
# Run full UAT scenarios
# See SPRINT32_TESTING_GUIDE_20260412.md - UAT Scenarios section

# Collect evidence for sign-off:
# - Screenshots (before/after)
# - API responses
# - Logs
# - Metrics
```

### 1.6 Staging Sign-off

- [ ] QA Lead: ✓ All tests pass
- [ ] Tech Lead: ✓ Code quality OK
- [ ] PM: ✓ Feature meets requirements

---

## Phase 2: Production Deployment (Monday May 5)

### 2.1 Production Pre-checks

```bash
# Verify production health before deployment
curl https://vninvest-prod.api.local/api/health/
# Expected: {"status": "ok"}

# Verify no ongoing issues
# - Check production metrics dashboard
# - Verify recent vnstock queries successful
# - Confirm no 429 rate limit issues

# Notify stakeholders
echo "Production deployment begins at 14:00 UTC"
```

### 2.2 Database Backup

```bash
# Backup production database
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres vninvest > /backups/vninvest_20260505_pre-deploy.sql

# Verify backup
ls -lh /backups/vninvest_20260505_pre-deploy.sql
# Should be > 100MB
```

### 2.3 Code Deployment (Zero-downtime)

```bash
# On production server
cd /path/to/production

# 1. Pull latest code
git fetch origin
git checkout sprint32-vnstock-config
git pull origin sprint32-vnstock-config

# 2. Update requirements
pip install -r backend/requirements.txt

# 3. For Kubernetes (blue-green deployment)
# This assumes you're using Kubernetes

# Create new revision
kubectl set image deployment/vninvest-backend \
  backend=vninvest-backend:sprint32-v1 \
  --record

# Or for Docker Compose (rolling restart)
docker-compose -f docker-compose.prod.yml \
  pull backend frontend
docker-compose -f docker-compose.prod.yml \
  up -d --no-deps backend frontend

# Wait for services to become healthy
sleep 30
docker-compose -f docker-compose.prod.yml \
  ps backend frontend
# Should show "healthy" status
```

### 2.4 Run Migrations (Active Services)

```bash
# Run migrations while backend is running (Django handles this gracefully)
docker-compose -f docker-compose.prod.yml exec backend bash

python manage.py migrate portfolio

# Verify migration
python manage.py showmigrations portfolio | tail -5
# Should show ✓ for all including new migration

# Create singleton config (safe to run multiple times)
python manage.py shell
>>> from portfolio.models import RuntimeVnstockConfig
>>> config = RuntimeVnstockConfig.get_or_create_singleton()
>>> assert config.pk == 1
>>> exit()
```

### 2.5 Post-Deployment Verification

```bash
# Verify API working
curl -s https://vninvest-prod.api.local/api/admin-ops/vnstock-config/current/ \
  -H "Authorization: Bearer <prod-token>" | python -m json.tool

# Check 200 OK response?
# Does max_concurrency = 12?

# Verify health endpoints
curl -s https://vninvest-prod.api.local/api/health/

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=50 backend | grep -i error
# Should be empty or only INFO/WARNING

# Verify vnstock adapter loaded config
docker-compose -f docker-compose.prod.yml logs --tail=20 backend | grep -i "config"
# Should show "Vnstock config loaded" or similar
```

### 2.6 Monitoring & Verification (30 minutes)

| Check | Command | Expected |
|-------|---------|----------|
| API latency | `curl -w "%{time_total}\n"` | < 100ms |
| Cache hit rate | Dashboard metrics | > 90% |
| Error rate | APM dashboard | < 0.1% |
| Database connections | `SELECT count(*) FROM pg_stat_activity` | < 50 |
| Vnstock concurrency | Logs + metrics | Actually limiting to 12 |
| Changelog working | `GET /api/admin-ops/vnstock-config/changelog/` | Returns data |

### 2.7 Smoke Test Suite (10 minutes)

```bash
#!/bin/bash
# scripts/deploy_smoke_tests.sh

set -e

TOKEN="<production-token>"
BASE_URL="https://vninvest-prod.api.local"

echo "🔍 Running smoke tests..."

# Test 1: Get current config
echo -n "Test 1: GET /current/ ... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin-ops/vnstock-config/current/" \
  -H "Authorization: Bearer $TOKEN")
status=$(echo "$response" | tail -1)
[[ "$status" == "200" ]] && echo "✅ PASS" || echo "❌ FAIL (status: $status)"

# Test 2: Update config (dry run - don't actually change)
echo -n "Test 2: PATCH /update_config/ ... "
response=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/admin-ops/vnstock-config/update_config/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_concurrency": 12}')
status=$(echo "$response" | tail -1)
[[ "$status" == "200" ]] && echo "✅ PASS" || echo "❌ FAIL (status: $status)"

# Test 3: Get changelog
echo -n "Test 3: GET /changelog/ ... "
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin-ops/vnstock-config/changelog/" \
  -H "Authorization: Bearer $TOKEN")
status=$(echo "$response" | tail -1)
[[ "$status" == "200" ]] && echo "✅ PASS" || echo "❌ FAIL (status: $status)"

# Test 4: Verify vnstock queries still working
echo -n "Test 4: Vnstock adapter working ... "
# Check if price_board queries succeeded in last 5 minutes
if grep -q "price_board.*200" <(tail -100 prod-logs.txt); then
  echo "✅ PASS"
else
  echo "❌ FAIL (no successful price_board queries)"
fi

echo ""
echo "🎉 Smoke tests complete!"
```

```bash
# Run smoke tests
./scripts/deploy_smoke_tests.sh
# Expected: All 4 tests PASS ✅
```

### 2.8 Production Sign-off

- [ ] Ops Lead: ✓ Services healthy
- [ ] Product Owner: ✓ Feature live
- [ ] On-call Engineer: ✓ Ready to monitor

---

## Phase 3: Rollback Procedure (If needed)

### Emergency Rollback (< 5 minutes)

```bash
# If something goes critically wrong

# 1. Stop new version
docker-compose -f docker-compose.prod.yml down backend frontend

# 2. Restore previous code
git checkout main  # previous stable branch
git pull

# 3. Restart with old code
docker-compose -f docker-compose.prod.yml up -d backend frontend

# 4. Verify old version working
curl https://vninvest-prod.api.local/api/health/

# 5. Notify team
echo "Rolled back to previous version. Migration data preserved."
```

### Database Rollback (If migration fails)

```bash
# Restore from backup
docker-compose -f docker-compose.prod.yml down

pg_restore -U postgres -d postgres < /backups/vninvest_20260505_pre-deploy.sql

docker-compose -f docker-compose.prod.yml up -d

# Migrate to previous version if needed
docker-compose -f docker-compose.prod.yml exec backend bash
python manage.py migrate portfolio zero  # Undo migration
```

---

## Deployment Tracking

### Deployment Log Template

```markdown
## Deployment: Sprint 32 Vnstock Runtime Config
**Date:** 2026-05-05  
**Time:** 14:00-14:30 UTC  
**Deployed By:** DevOps  
**Status:** ✅ SUCCESS

### Timeline
- 14:00: Deployment started
- 14:05: Code pulled, migrations ran
- 14:08: Services restarted (0 downtime)
- 14:10: Smoke tests passed (4/4)
- 14:15: Monitoring stable (0 errors)
- 14:30: Sign-off complete

### Verification Checks
- [x] API health: 200 OK
- [x] Admin UI accessible
- [x] Vnstock queries working
- [x] Changelog recording changes
- [x] Performance < 100ms latency
- [x] Cache hitting 95%

### Issues Encountered
None

### Rollback Policy
Monitor for 24 hours. Rollback if:
- Error rate > 1%
- Latency > 500ms
- Any P1 incidents
```

---

## Post-Deployment (5 days monitoring)

### Day 1: Intensive Monitoring

```bash
# Check every hour
for i in {1..24}; do
  curl -s https://vninvest-prod.api.local/api/health/
  echo "Hour $i: OK"
  sleep 3600
done
```

### Day 2-5: Regular Checks

```bash
# Daily morning health check
- [ ] API status 200 OK
- [ ] Vnstock queries successful
- [ ] Error rate normal (< 0.1%)
- [ ] Latency normal (< 100ms)
- [ ] Admin UI accessible
- [ ] No user complaints
```

### Weekly Report

```markdown
## Sprint 32 Deployment - Week 1 Review

### Metrics
- ✅ Zero downtime achieved
- ✅ 100% API uptime
- ✅ Avg latency: 45ms (target: 100ms)
- ✅ Cache hit rate: 97% (target: 95%)
- ✅ Zero errors on new endpoints

### User Feedback
- 0 complaints reported
- 5 successful config updates by ops team
- 2 rate limit issues resolved faster using new config

### Recommendations
- Keep deployment as-is
- Plan Phase 4 (metrics dashboard) for next sprint
```

---

## Deployment Checklist - Final

- [ ] Code reviewed and approved
- [ ] All tests passing (100%)
- [ ] Database backup created
- [ ] Staging deployment successful
- [ ] UAT sign-off received
- [ ] Production pre-checks passed
- [ ] Migrations tested
- [ ] Smoke tests created + passing
- [ ] Team notified
- [ ] Rollback procedure documented
- [ ] Monitoring configured
- [ ] 24h monitoring schedule confirmed
- [ ] Post-deployment report template ready

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12  
**Owner:** DevOps Team

