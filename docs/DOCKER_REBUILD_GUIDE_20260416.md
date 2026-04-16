# Docker Dev Stack Rebuild Guide - Phase 5
**Date**: 2026-04-16  
**Purpose**: Rebuild frontend with Phase 2 (Watchlist RealtimeQuoteTable) + Phase 3-4 (Polling Optimization)

---

## Quick Rebuild (Recommended)

```bash
# In project root directory
cd c:\Mujoco Projects\vninvest

# Stop current stack
docker-compose -f docker-compose.dev.yml down

# Rebuild with new frontend
docker-compose -f docker-compose.dev.yml up -d --build

# Monitor logs
docker-compose -f docker-compose.dev.yml logs -f frontend
```

**Expected**: ~3-5 minutes for frontend rebuild

---

## Full Clean Rebuild (If Needed)

```bash
# Complete reset
docker-compose -f docker-compose.dev.yml down -v

# Remove old images
docker image prune -f

# Full rebuild
docker-compose -f docker-compose.dev.yml up -d --build

# Monitor
docker-compose -f docker-compose.dev.yml logs -f
```

---

## What's Being Rebuilt

### Changes in Docker Image
1. **Frontend** (NEW):
   - ✅ RealtimeQuoteTable component added
   - ✅ Watchlist integrated with RealtimeQuoteTable
   - ✅ Dashboard using ViewModel + RealtimeQuoteTable
   - Build: `npm run build` (462.66 kB gzipped)

2. **Backend** (NO CHANGES):
   - No backend changes in this phase
   - Existing realtime API endpoints used as-is
   - Polling configuration auto-picked up via hook

---

## Verification Checklist

After rebuild completes, verify:

```bash
# Check container status
docker-compose -f docker-compose.dev.yml ps

# Expected: All containers "Up" with health "healthy"

# Check frontend logs for errors
docker-compose -f docker-compose.dev.yml logs frontend | grep -i error

# Expected: No errors about RealtimeQuoteTable or Watchlist imports
```

---

## Browser Testing After Rebuild

1. **Clear browser cache**
   ```
   Chrome: Ctrl+Shift+Delete → Clear data → Cached images and files
   ```

2. **Hard refresh Dashboard**
   ```
   Ctrl+Shift+R (forces cache bust)
   ```

3. **Monitor Network tab**
   ```
   Chrome DevTools → Network tab
   - Watch realtime API calls to /api/realtime/ticker/...
   - Should see batches of 20 (bootstrap) then periodic 16 (recovery)
   ```

---

## Performance Monitoring During Rebuild

### Real-time Monitoring Commands

```bash
# Watch CPU/Memory usage
docker stats

# Watch specific container
docker stats frontend

# Stream logs with timestamps
docker-compose -f docker-compose.dev.yml logs -f --timestamps
```

### Expected Performance After Rebuild
- **Frontend startup**: <5 seconds
- **Dashboard load**: <2 seconds
- **Watchlist load**: <2 seconds
- **First data visible**: <1 second
- **Realtime updates**: Smooth, no flashing

---

## Troubleshooting

### Issue: "RealtimeQuoteTable is not a named export"

**Cause**: Frontend not rebuilt properly

**Fix**:
```bash
docker-compose -f docker-compose.dev.yml down
docker image rm vninvest-frontend:latest
docker-compose -f docker-compose.dev.yml up -d --build
```

### Issue: Dashboard still has flashing

**Cause**: Old frontend cache or WS not connecting

**Fix**:
```bash
# 1. Hard refresh browser (Ctrl+Shift+R)
# 2. Check WS connection in DevTools Console:
#    > See "WS connected" message
# 3. Check Realtime status badge (should be "Live" green)
```

### Issue: Watchlist tracked table not showing

**Cause**: Data sync issue or render error

**Fix**:
```bash
# 1. Check browser console for errors (F12 → Console)
# 2. Refresh page
# 3. Check API response: Network tab → filter "tracked" → inspect response
# 4. Verify realtime feed status in DevTools
```

---

## Rollback Plan

If rebuild causes issues:

```bash
# Revert to previous code
git checkout HEAD~1 frontend/

# Rebuild with old code
docker-compose -f docker-compose.dev.yml down
docker image rm vninvest-frontend:latest
docker-compose -f docker-compose.dev.yml up -d --build

# Wait 5 minutes and test
```

---

## After Rebuild: Run Test Cases

Once rebuild completes, proceed to Cases A-D in `USER_ACCEPTANCE_TEST_CASES.md`

