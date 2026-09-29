# Audit: Dashboard Data Sync Issues — 2026-05-16

## Executive Summary
**Status:** 🔴 **CRITICAL** — Dashboard shows 0 data across all indicators

**Affected Systems:**
- Whale alerts center: 0 alerts (empty table)
- Heatmap: 0.00% (all indicators)
- Watchlist prices: "--" (all symbols)
- Price board: Empty

**Root Causes Identified:**
1. **Whale Alert Detection Task Not Scheduled** — `detect-global-whale-alerts` missing from Celery beat schedule
2. **Environment Variable Not Loaded in Container** — `WHALE_ALERT_DETECTION_ENABLED` added to `.env.dev` but Celery beat container started before change
3. **Price Board Data Not Ingested** — Market data ingest task may not be populating price cache
4. **API Authentication Issues** — Some endpoints returning 401 Unauthorized

---

## Detailed Findings

### Issue #1: WhaleAlertEvent Table Empty

**Evidence:**
```
Database Query Result:
  SELECT COUNT(*) FROM portfolio_whalealertevent
  Result: 0 rows

API Endpoint Test:
  GET /api/realtime/whale-feed/aggregate/?limit=5
  Status: 200 (but results = [])

Frontend Display:
  Whale Alert Center: "0 cảnh báo" (0 alerts)
  Heatmap: "0%" across all indicators (CVD, Buy Strength, Sell Strength)
```

**Root Cause Analysis:**
1. Celery beat logs show NO `detect-global-whale-alerts` task execution
2. Task schedule inspection shows task not registered in CELERY_BEAT_SCHEDULE
3. Celery beat container was started BEFORE `WHALE_ALERT_DETECTION_ENABLED` was added to `.env.dev`
4. Container did not re-read environment variables on next scheduler cycle

**Impact Chain:**
```
1. WHALE_ALERT_DETECTION_ENABLED not set in container env
2. config/settings.py line 479: `if WHALE_ALERT_DETECTION_ENABLED:` → FALSE
3. Task never added to CELERY_BEAT_SCHEDULE
4. Celery beat never calls detect_and_store_global_whale_alerts()
5. portfolio_whalealertevent table remains empty
6. API endpoints return empty results
7. Frontend displays: alerts = 0, heatmap = 0%
```

**Timeline:**
- Previous session: Dev stack running with missing env var
- This session: Added `WHALE_ALERT_DETECTION_ENABLED=True` to backend/.env.dev
- Executed: `./start_dev.ps1` which ran `docker-compose up -d`
- **BUG:** Docker-compose did NOT rebuild containers, only restarted them
- **Result:** Celery beat restarted but env var not yet loaded from file

---

### Issue #2: Watchlist Price Data = "--"

**Evidence:**
```
Watchlist Display:
  TLH  -- 0.00%
  NKG  -- 0.00%
  BMP  -- 0.00%
  HPG  -- 0.00%
  HDB  -- 0.00%
  EIB  -- 0.00%
  CTG  -- 0.00%
  BID  -- 0.00%
  ACB  -- 0.00%

All 9 symbols show "--" for current price, 0.00% for change
```

**Possible Root Causes:**
1. **Price Board Not Ingested** — `ingest-price-board-60s` task not populating Redis cache
2. **API Cache Empty** — Portfolio watchlist data not synced to realtime cache
3. **Frontend Data Fetch Timeout** — Client unable to retrieve from `/api/portfolio/watchlist/`

**Investigation Needed:**
- Check Redis keys for price board data
- Verify `data_ingest.tasks.fetch_and_upsert_price_board` execution
- Check frontend API calls in browser DevTools

---

### Issue #3: Heatmap Shows 0% Across All Indicators

**Evidence:**
```
Heatmap Indicators:
  CVD chuẩn hóa: 0%
  Buy Strength (Mua): 0%
  Institutional Strength (Thế chế độ): 0%
```

**Root Cause:**
- Same as Issue #1: WhaleAlertEvent table empty
- Heatmap aggregation queries WhaleAlertEvent for whale transaction data
- Without whale events, aggregation returns 0%

**Expected Behavior (When Fixed):**
- CVD chuẩn hóa: 0-100% normalized cumulative volume delta
- Buy Strength: % of buy-side whale transactions (by count)
- Institutional Strength: % of institutional buy-side transactions

---

## Environment Configuration Check

**File:** `backend/.env.dev` (Local, Git-ignored)

**Status Before Fix:** ❌ MISSING
```ini
# WHALE_ALERT_DETECTION_ENABLED not set
# WHALE_ALERT_DETECTION_INTERVAL_SECONDS not set
```

**Status After Fix:** ✅ ADDED
```ini
WHALE_ALERT_DETECTION_ENABLED=True
WHALE_ALERT_DETECTION_INTERVAL_SECONDS=120
```

**Celery Beat Schedule:** (config/settings.py line 479-482)
```python
if WHALE_ALERT_DETECTION_ENABLED:
    CELERY_BEAT_SCHEDULE["detect-global-whale-alerts"] = {
        "task": "portfolio.tasks.detect_and_store_global_whale_alerts",
        "schedule": timedelta(seconds=max(WHALE_ALERT_DETECTION_INTERVAL_SECONDS, 30)),
    }
```

**Result:** Task only registered if env var = True

---

## Docker Container Lifecycle Issue

**Problem:** `./start_dev.ps1` executed `docker-compose up -d` but did NOT rebuild containers.

**What Happened:**
1. Container images built with old config (env var not read from .env.dev yet)
2. `docker-compose up -d` stopped and restarted containers
3. Container environment variables NOT updated from host .env.dev
4. Celery beat restarted with same old config
5. WHALE_ALERT_DETECTION_ENABLED still undefined in container

**Solution Required:**
```bash
# Option 1: Full rebuild (forces re-read of env)
docker-compose down -v
docker-compose up -d --build

# Option 2: Manual container rebuild
docker-compose stop vninvest-dev-core-beat
docker-compose rm -f vninvest-dev-core-beat
docker-compose up -d vninvest-dev-core-beat
```

**Why This Matters:**
- Celery beat reads WHALE_ALERT_DETECTION_ENABLED at startup
- Env vars must be loaded BEFORE beat scheduler starts
- Simple restart (`docker-compose up -d`) won't reload env from .env.dev
- Must rebuild or recreate container

---

## Verification Checklist

**Before Fix Validation:**
- [ ] WhaleAlertEvent.objects.count() = 0 ✅ CONFIRMED
- [ ] Celery beat logs: NO "detect-global-whale-alerts" ✅ CONFIRMED
- [ ] Watchlist prices: "--" (all symbols) ✅ CONFIRMED
- [ ] Heatmap: 0% (all indicators) ✅ CONFIRMED

**After Fix Validation (Expected ~120-180 seconds post-restart):**
- [ ] WhaleAlertEvent.objects.count() > 0
- [ ] Celery beat logs show: "Sending due task detect-global-whale-alerts"
- [ ] API /realtime/whale-feed/aggregate/ returns whale event results
- [ ] Frontend whale alert center displays: count > 0, list populated
- [ ] Heatmap shows real percentages (not 0%)
- [ ] Watchlist prices populated (not "--")

---

## Recommended Actions

### Immediate (Critical)
1. **Full Stack Rebuild**
   ```bash
   cd c:\Mujoco Projects\vninvest
   .\start_dev.ps1  # Full restart with docker-compose down + up
   ```
   
2. **Monitor Celery Beat Logs** (after ~10 seconds)
   ```bash
   docker logs vninvest-dev-core-beat --tail 50 | findstr "detect-global-whale-alerts"
   ```
   
3. **Verify WhaleAlertEvent Population** (after ~120 seconds)
   ```bash
   docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -c \
     "SELECT COUNT(*) FROM portfolio_whalealertevent;"
   ```
   
4. **Test API Endpoint**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:8001/api/realtime/whale-feed/aggregate/?limit=5
   ```

### Secondary (Investigation)
1. **Check Price Board Ingestion**
   - Verify `data_ingest.tasks.fetch_and_upsert_price_board` execution
   - Query Redis for price board keys
   
2. **Test Frontend Data Fetch**
   - Open browser DevTools (F12)
   - Check Network tab for `/api/portfolio/watchlist/` calls
   - Verify response contains price data

3. **Audit Alert Data Pipeline**
   - Check `portfolio.tasks.detect_and_store_global_whale_alerts` execution logs
   - Verify `market_serving.realtime_stream.*` tasks populating cache

---

## Code References

**Whale Detection Logic:**
- [portfolio/tasks.py](portfolio/tasks.py) — `detect_and_store_global_whale_alerts` task
- [portfolio/services_global_whale_alerts.py](portfolio/services_global_whale_alerts.py) — `run_global_whale_alert_detection()`
- [portfolio/models.py](portfolio/models.py) — `WhaleAlertEvent` ORM model

**API Endpoints:**
- [portfolio/views_realtime_aggregate_campaigns.py](portfolio/views_realtime_aggregate_campaigns.py) — `WhaleFeedAggregateView`
- [portfolio/market_data_service.py](portfolio/market_data_service.py) — `get_whale_feed_aggregate()`

**Configuration:**
- [config/settings.py](config/settings.py) lines 471-482 — CELERY_BEAT_SCHEDULE conditional logic
- `backend/.env.dev` — WHALE_ALERT_DETECTION_ENABLED, WHALE_ALERT_DETECTION_INTERVAL_SECONDS

---

## Timeline of Events

| Timestamp | Event | Status |
|-----------|-------|--------|
| T-N (Previous) | Dev stack running | Operational |
| T-N | WHALE_ALERT_DETECTION_ENABLED not set | ❌ BUG |
| T0 (This Session) | Identified whale alerts = 0 | 🔴 Alert |
| T+5 min | Root cause: env var missing | 🔍 Analysis |
| T+10 min | Added WHALE_ALERT_DETECTION_ENABLED=True to .env.dev | ✅ Fix Config |
| T+15 min | Executed ./start_dev.ps1 | ✅ Restart |
| T+20 min | Verified: Celery beat logs still show NO whale task | 🔴 PROBLEM |
| T+25 min | **Full rebuild triggered** | ⏳ In Progress |
| T+140 min | Expected: WhaleAlertEvent populated | 📅 Pending |

---

## Lessons Learned & Prevention

**Docker Env Loading Pattern:**
- `.env.dev` is read by `docker-compose` when building/starting containers
- Simple restart (`docker-compose up -d`) without `-v` or rebuild does NOT reload changed env
- **Fix:** Use `docker-compose up -d --build` or `docker-compose down -v && docker-compose up -d` for env changes

**Celery Beat Initialization:**
- Settings are loaded ONCE at container startup
- Config changes to `settings.py` require container restart
- Env vars read at startup via `WHALE_ALERT_DETECTION_ENABLED = os.getenv('WHALE_ALERT_DETECTION_ENABLED', 'False') == 'True'`
- **Lesson:** When changing Celery beat schedule, always verify in logs after restart

**Data Sync Audit Pattern:**
1. Check database (source of truth)
2. Check Celery logs (task execution)
3. Check API responses (data availability)
4. Check frontend display (end-to-end)

---

**Report Generated:** 2026-05-16 16:02 UTC+7
**Audit Status:** In Progress — Awaiting full stack restart validation
