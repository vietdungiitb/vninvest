# Phase 3 Item 5: E2E Manual Walkthrough Guide
## AI Advisory Canonical prompt_config Runtime Configuration Testing
**Date:** April 18, 2026  
**Objective:** Verify end-to-end integration in dev environment

---

## Prerequisites

- Dev compose stack running (`docker-compose.dev.yml`)
- Backend accessible at `http://localhost:8000`
- Frontend accessible at `http://localhost:3000`
- Browser DevTools with Storage/Application tab open
- Test account with portfolio created

---

## Setup Steps

### 1. Start Dev Compose Stack
```bash
# Terminal 1: Backend
cd backend
python manage.py runserver 0.0.0.0:8000

# Terminal 2: Frontend
cd frontend
npm start
```

### 2. Create Test Account
```bash
# Create superuser or use existing account
python manage.py createsuperuser

# Or via browser at http://localhost:8000/admin
```

### 3. Create Test Portfolio
- Log in to admin: http://localhost:8000/admin
- Create portfolio for test account
- Or use existing portfolio if available

---

## Manual Walkthrough: 5 Steps

### Step 1: Load Stock Detail Page
**Time: 2 min**

1. Navigate to `http://localhost:3000`
2. Log in with test account
3. Search for a stock (e.g., "MWG")
4. Click to open Stock Detail page
5. Verify you see:
   - Stock name and price chart
   - "AI Advisory Summary" section below
   - **⚙️ Settings button** (NEW) next to "Regenerate" button

**Expected Result:** Settings button visible; no errors in console

---

### Step 2: Verify Default Configuration
**Time: 2 min**

1. In Stock Detail page, locate the "✓ Enabled Sources" section (below summary title)
2. You should see badges for **5 enabled sources by default**:
   - ✓ whale
   - ✓ dark_flow
   - ✓ technical
   - ✓ news
   - ✓ market

3. You should **NOT** see badges for:
   - fundamental
   - ownership
   - sector

**Expected Result:** Exactly 5 enabled source badges visible

---

### Step 3: Open Settings Drawer & Toggle Sources
**Time: 3 min**

1. Click **⚙️ Settings** button
2. Settings drawer should open with:
   - Source toggles (8 total): whale, dark_flow, technical, news, market, fundamental, ownership, sector
   - Technical indicators toggles (when technical source enabled): rsi, bollinger, vols, prices, ma20, ma50, snapshot, cdms
   - Close button in drawer footer

3. **Toggle Tests:**
   - Toggle "fundamental" **ON** (currently OFF)
   - Verify checkbox becomes checked
   - Verify "fundamental" count appears in drawer header
   - Toggle "whale" **OFF** (currently ON)
   - Verify checkbox becomes unchecked
   - Verify enabled source count decreases in header

4. For technical indicators:
   - Ensure "technical" source is ON
   - Toggle "ma20" indicator OFF (if it was on)
   - Verify checkbox state changes

**Expected Result:** All toggles respond immediately; drawer header counts update

---

### Step 4: Persist Settings Across Page Reload
**Time: 3 min**

1. **Before reloading**, verify current enabled sources:
   - fundamental should be ON
   - whale should be OFF
   - technical should be ON

2. Open **Browser DevTools** → **Application** tab → **LocalStorage**
3. Look for key: `ai_advisory_prompt_config:MWG` (or your symbol)
4. Verify the value contains:
   ```json
   {
     "version": 2,
     "sources": {
       "fundamental": {"enabled": true, ...},
       "whale": {"enabled": false, ...},
       ...
     }
   }
   ```

5. **Reload the page** (F5 or Ctrl+R)
6. Wait for Stock Detail to load
7. Verify settings were **persisted**:
   - fundamental badge should still be visible
   - whale badge should NOT be visible
   - Settings drawer should close on reload

**Expected Result:** localStorage contains correct config; settings persist after reload

---

### Step 5: Click Regenerate & Verify API Call
**Time: 3 min**

1. **Make a different stock choice** (e.g., switch from MWG to VNM)
2. Wait for Stock Detail to load
3. Verify enabled sources for **VNM are defaults** (whale, dark_flow, technical, news, market)
   - This proves **per-symbol isolation** (VNM has different localStorage than MWG)

4. Go back to MWG stock
5. Verify enabled sources for MWG still show your **previous settings** (fundamental ON, whale OFF)

6. Open **Browser DevTools** → **Network** tab
7. Click **Regenerate** button
8. In Network tab, find the request to `/api/v1/stock/MWG/ai-advisory/summary/regenerate`
9. Click the request → **Request** tab
10. Verify request body includes:
    ```json
    {
      "component_ids": [...],
      "synthesis_preference": "balanced",
      "prompt_config": {
        "version": 2,
        "sources": {
          "whale": {"enabled": false, ...},
          "fundamental": {"enabled": true, ...},
          ...
        }
      }
    }
    ```

11. Check **Response** tab
12. Verify response includes `"prompt_config_version": 2`

**Expected Result:** API payload contains prompt_config; response includes metadata

---

## Full Flow Summary (All Steps)

```
✓ Step 1: Load Stock Detail → See settings button
✓ Step 2: Verify 5 default enabled sources → Badges visible
✓ Step 3: Toggle sources → Drawer responds immediately
✓ Step 4: Reload page → Settings persist from localStorage
✓ Step 5: Switch symbols → Verify isolation; regenerate → Verify API payload
```

---

## Success Criteria

✅ **All 5 steps complete without errors**
✅ **localStorage contains correct per-symbol config**
✅ **API payload includes prompt_config**
✅ **Enabled sources badges display correctly**
✅ **Settings persist across page reloads**
✅ **Different symbols have isolated settings**

---

## Troubleshooting

### Problem: Settings button not visible
- **Check:** Browser console for errors (F12 → Console tab)
- **Check:** StockDetail.jsx has been deployed
- **Fix:** Restart frontend dev server

### Problem: Settings drawer doesn't open
- **Check:** Drawer component mounted correctly
- **Check:** No click handler errors in console
- **Fix:** Check React DevTools for state management

### Problem: localStorage not persisting
- **Check:** Browser has localStorage enabled
- **Check:** Key format: `ai_advisory_prompt_config:{symbol}`
- **Fix:** Clear localStorage and try again (`localStorage.clear()` in console)

### Problem: API payload missing prompt_config
- **Check:** Network request body in DevTools
- **Check:** Frontend is sending correct payload structure
- **Fix:** Check `handleRegenerateExecutiveSummary()` in StockDetail.jsx

### Problem: Badge counts wrong
- **Check:** Verify which sources are marked `enabled: true`
- **Check:** Filter logic in enabled sources display
- **Fix:** Manually verify localStorage config

---

## Quick Verification Commands (Console)

```javascript
// Check current config for MWG
const config = localStorage.getItem('ai_advisory_prompt_config:MWG');
console.log(JSON.parse(config));

// Clear all prompt_config localStorage
Object.keys(localStorage).forEach(key => {
  if (key.includes('ai_advisory_prompt_config')) {
    localStorage.removeItem(key);
  }
});

// Check all localStorage keys
Object.keys(localStorage).forEach(key => console.log(key));
```

---

## E2E Testing Record

**Tester:** ____________  
**Date:** ____________  
**Stock Symbol:** ____________  
**Browser:** ____________  

| Step | Result | Notes |
|------|--------|-------|
| 1. Load page + settings button | ✓/✗ | |
| 2. Default sources (5) | ✓/✗ | |
| 3. Toggle sources + drawer | ✓/✗ | |
| 4. localStorage persist | ✓/✗ | |
| 5. API payload + isolation | ✓/✗ | |

**Overall Result:** ✓ PASS / ✗ FAIL

---

## Next Steps After Manual Testing

1. ✅ All steps pass → Feature ready for UAT
2. ❌ Step fails → Review troubleshooting section & file bug
3. 🔄 Performance concerns → Profile API calls & optimization
4. 📋 i18n → Add Vietnamese translations for drawer labels
