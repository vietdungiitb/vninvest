# DASHBOARD DATA SYNC AUDIT — Executive Summary
**Date:** 2026-05-16 16:00 UTC+7  
**Status:** 🔴 CRITICAL — All data indicators = 0  

---

## 🎯 Key Findings

### Frontend Display Issues
| Component | Current | Expected | Status |
|-----------|---------|----------|--------|
| Whale Alerts Count | 0 | > 0 | ❌ FAIL |
| Heatmap Indicators | 0% | 0-100% | ❌ FAIL |
| Watchlist Prices | "--" | Real prices | ❌ FAIL |
| CVD Normalized | 0% | Real value | ❌ FAIL |
| Buy Strength | 0% | Real value | ❌ FAIL |
| Institutional Strength | 0% | Real value | ❌ FAIL |

---

## 🔍 Root Cause Analysis

### Issue #1: Whale Alert Detection Not Running
**Evidence:**
- Database: `portfolio_whalealertevent` = 0 rows
- Celery Beat Logs: NO `detect-global-whale-alerts` task scheduled
- Settings: Task only added if `WHALE_ALERT_DETECTION_ENABLED=True`

**Root Cause:**
```
1. WHALE_ALERT_DETECTION_ENABLED added to backend/.env.dev ✅
2. ./start_dev.ps1 executed (docker-compose up -d) ⚠️  
3. Problem: UP without rebuild ≠ env vars loaded from .env.dev
4. Container env still has old values (undefined WHALE_ALERT_DETECTION_ENABLED)
5. config/settings.py: if WHALE_ALERT_DETECTION_ENABLED: → FALSE (not set)
6. Task never added to CELERY_BEAT_SCHEDULE
7. Celery beat never executes task
8. WhaleAlertEvent table = 0 rows forever ❌
```

**Solution Chain:**
```
Full rebuild required:
1. docker-compose down -v (remove containers + volumes)
2. docker-compose up -d --build (recreate with fresh env)
3. Container starts, reads .env.dev
4. WHALE_ALERT_DETECTION_ENABLED = True loaded
5. config/settings.py: if statement now TRUE
6. Task registered in CELERY_BEAT_SCHEDULE
7. After ~120s: Task runs → WhaleAlertEvent populated
8. Frontend receives data → alerts & heatmap show real values
```

---

### Issue #2: Watchlist Prices = "--"
**Evidence:** All 9 symbols show `--` for current price
**Root Cause:** Likely price board data not ingested OR frontend fetch failing
**Secondary Issue:** May be unrelated to whale alert problem

---

## 📊 Affected Data Pipeline

### Whale Alert Pipeline (BROKEN)
```
Backend:
  .env.dev (WHALE_ALERT_DETECTION_ENABLED) 
     ↓ [NOT LOADED INTO CONTAINER]
  config/settings.py (conditional task registration)
     ↓ [CONDITION FALSE]
  CELERY_BEAT_SCHEDULE (task missing)
     ↓ [EMPTY]
  Celery Beat Scheduler (no task to run)
     ↓ [SKIPPED]
  portfolio.tasks.detect_and_store_global_whale_alerts (NEVER RUNS)
     ↓ [SKIPPED]
  portfolio_whalealertevent table (0 rows)

Frontend API:
  /api/realtime/whale-feed/aggregate/
     ↓ [queries empty table]
  Returns: { results: [] }
     ↓ [no data]
  Frontend whale alert center (0 alerts)
  Frontend heatmap (0% all indicators)
```

### Expected Pipeline (After Fix)
```
1. Container recreated with fresh env
2. WHALE_ALERT_DETECTION_ENABLED = True loaded
3. config/settings.py: task registered ✅
4. Celery beat scheduler runs every 120s
5. detect_and_store_global_whale_alerts() executes
6. Whale events detected and stored in portfolio_whalealertevent
7. API returns whale event data
8. Frontend displays alerts & heatmap with real values
```

---

## 🔧 Remediation Steps

### Immediate Action (REQUIRED)
Execute full stack rebuild to force environment reload:

```bash
cd c:\Mujoco Projects\vninvest

# Option A: Automated fix script (recommended)
.\fix_whale_alerts_sync.ps1

# Option B: Manual steps
docker-compose down -v
docker-compose up -d --build

# Monitor whale detection task
docker logs vninvest-dev-core-beat --follow | findstr "detect-global-whale-alerts"

# Verify data population (after ~120-180s)
docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core \
  -c "SELECT COUNT(*) FROM portfolio_whalealertevent;"
```

### Timeline
- **T+0**: Rebuild starts
- **T+30-60s**: Containers start and stabilize
- **T+90s**: Celery beat initializes
- **T+120s**: First whale detection task scheduled (due to 120s interval)
- **T+150s**: Task executes, populates WhaleAlertEvent
- **T+180s**: Frontend should show data

### Success Criteria (After ~180 seconds)
- [ ] `WhaleAlertEvent.objects.count() > 0`
- [ ] Celery beat logs show: `Scheduler: Sending due task detect-global-whale-alerts`
- [ ] `/api/realtime/whale-feed/aggregate/?limit=5` returns results (not empty array)
- [ ] Frontend whale alert center shows: count > 0, list populated
- [ ] Frontend heatmap shows real percentages (not 0%)
- [ ] Watchlist prices show real values (not "--")

---

## 📝 Documentation

**Files Created/Modified:**
- `AUDIT_DASHBOARD_DATA_SYNC_20260516.md` — Detailed technical audit
- `fix_whale_alerts_sync.ps1` — Automated rebuild script
- `backend/.env.dev` — Added WHALE_ALERT_DETECTION_ENABLED=True

**Code References:**
- `backend/config/settings.py:479-482` — Task registration conditional
- `backend/portfolio/tasks.py` — detect_and_store_global_whale_alerts task
- `backend/portfolio/models.py` — WhaleAlertEvent model
- `backend/portfolio/services_global_whale_alerts.py` — Detection logic

---

## 🎓 Lessons Learned

### Docker Environment Variable Loading
**Pattern:** `.env.dev` is read by `docker-compose` during build, not during simple restart
- `docker-compose up -d` = restart (same container image, env unchanged)
- `docker-compose down -v && docker-compose up -d` = rebuild (new image, env reloaded)
- `docker-compose up -d --build` = rebuild specific changed services

**Lesson:** When modifying environment variables, always:
1. Update `.env.dev` 
2. Use `docker-compose down -v` or `--build` flag
3. Verify container env with `docker exec env`

### Celery Beat Configuration Loading
**Pattern:** Celery beat reads config at startup ONLY
- Config changes don't apply to running beat instance
- Must restart beat container to reload config
- Settings checked: `if WHALE_ALERT_DETECTION_ENABLED: add_task()`

**Lesson:** When adding Celery beat tasks:
1. Update `CELERY_BEAT_SCHEDULE` in settings.py
2. Restart beat container to register task
3. Verify in logs: `Scheduler: Sending due task <task_name>`

### Data Sync Audit Process
**Checklist (applies to all systems):**
1. Check database (source of truth)
2. Check message queue (Celery logs, Redis)
3. Check API endpoints (data availability)
4. Check frontend display (end-to-end)

---

## 📞 Next Steps

**For User:**
1. Run `.\fix_whale_alerts_sync.ps1` to rebuild stack
2. Wait 180 seconds for whale alerts to populate
3. Verify frontend: whale alerts & heatmap show real data
4. Report if issues persist

**For System:**
1. Monitor Celery beat logs for `detect-global-whale-alerts` execution
2. Query database every 120s to verify WhaleAlertEvent growth
3. Alert if task fails or data doesn't populate after 180s

---

**Status:** Ready for rebuild and validation  
**Critical Blocker:** None (fix is straightforward)  
**Expected Resolution Time:** ~3-5 minutes (rebuild) + 2-3 minutes (data population) = 5-8 minutes total
