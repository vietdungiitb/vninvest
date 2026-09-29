# User Acceptance Test Cases - Realtime Table Unification
**Date**: 2026-04-16  
**Scope**: Verify Phase 1-4 improvements are working as expected  
**Execution**: After Docker rebuild completes

---

## Prerequisite Setup

- ✅ Docker dev stack rebuilt and healthy
- ✅ Browser cache cleared (Ctrl+Shift+Delete)
- ✅ Chrome DevTools Performance/Network tabs available
- ✅ Trading hours (9:15-14:45 or late session) or use demo data if offhours
- ✅ RealtimeDebugPanel visible for status checks

---

## Test Case A: Pre-open/Offhours - No "—" in Market Status

**Objective**: Verify market status table shows fallback prices during offhours, not empty dashes

**Setup**:
- Time: Before 9:15 AM or after 3:00 PM (offhours)
- Navigate: Dashboard → "Trạng thái thị trường theo mã" tab
- Symbols visible: VNI, BID, HPG, etc.

**Test Steps**:

| # | Action | Expected Result | Status |
|---|--------|-----------------|--------|
| 1 | Open Dashboard page (hard refresh: Ctrl+Shift+R) | Page loads, tables show | ⬜ |
| 2 | Observe "Trạng thái thị trường theo mã" table | Rows visible with symbols | ⬜ |
| 3 | Check "Giá" (Price) column | Shows numbers (not "—") | ⬜ |
| 4 | Check "% Thay đổi" column | Shows % values (not "—") | ⬜ |
| 5 | Check "Mới nhất" (Freshness) column | Shows "Đóng cửa" (session close) or timestamp | ⬜ |
| 6 | Wait 30 seconds | Prices remain stable, no flashing | ⬜ |

**Success Criteria**:
- ✅ No "—" dashes in price column
- ✅ All symbols show fallback price (prev_price or holding price)
- ✅ Semantic label shows "Đóng cửa" (last_session_close)
- ✅ No rapid color changes (green ↔ red)

**Pass/Fail**: ___________

---

## Test Case B: Open Trading Hours - Smooth Realtime Updates

**Objective**: Verify realtime updates flow smoothly without flashing

**Setup**:
- Time: 9:15-14:45 (normal trading hours)
- Navigate: Dashboard → "Trạng thái thị trường theo mã" tab
- Realtime status badge: Should show "Live" (green)

**Test Steps**:

| # | Action | Expected Result | Status |
|---|--------|-----------------|--------|
| 1 | Open Dashboard during market hours | Realtime status = "Live" | ⬜ |
| 2 | Watch table for 2 minutes | Prices update, "Mới nhất" (freshness) increments (0s, 1s, 2s...) | ⬜ |
| 3 | Observe price column changes | Price color: flash GREEN (+) or RED (-) once per update, not rapid blinking | ⬜ |
| 4 | Count visual "jumps" per minute | Count row re-positioning, should be ≤2-3/min (not 5-10/min) | ⬜ |
| 5 | Open DevTools → Network tab | See API calls to `/api/realtime/ticker/...` batches | ⬜ |
| 6 | Verify batch sizes | Bootstrap: multiple calls, Recovery: ~8-16 symbols per call | ⬜ |
| 7 | Watch for 1 minute | No excessive flickering, smooth price transitions | ⬜ |

**Success Criteria**:
- ✅ Realtime status = "Live"
- ✅ Price updates visible every 5-30 seconds (batch dependent)
- ✅ Color flash (green/red) happens once per meaningful change
- ✅ No rows "jump" around (memoization working)
- ✅ Row order stays stable

**Pass/Fail**: ___________

---

## Test Case C: Page Reload (F5) - Fresh Data, No Stale Fallback

**Objective**: Verify F5 refresh hydrates data cleanly, not showing stale cached fallback

**Setup**:
- Time: Market open or late session
- Dashboard with visible realtime data
- Open DevTools → Network tab
- Monitor Bootstrap API calls

**Test Steps**:

| # | Action | Expected Result | Status |
|---|--------|-----------------|--------|
| 1 | Dashboard showing live realtime data | Prices are current, status = "Live" | ⬜ |
| 2 | Press F5 (page refresh) | Page reloads, realtime status shows "Connecting..." briefly | ⬜ |
| 3 | Watch Network tab | See multiple `/api/realtime/ticker/{symbol}` calls in parallel batches | ⬜ |
| 4 | Verify batch size | Bootstrap batch size ~20 symbols per request (not 10) | ⬜ |
| 5 | After ~2-3 seconds | Table shows fresh prices with "Mới nhất" = "0s" (fresh) | ⬜ |
| 6 | Check semantic labels | Should show "realtime" or "last_session_close", not "stale_fallback" | ⬜ |
| 7 | Prices match market data | Compare with external source (VietstockFinance, HSX app) - should match | ⬜ |

**Success Criteria**:
- ✅ No duplicate API calls after F5
- ✅ Bootstrap completes in <3 seconds
- ✅ Fresh data displayed (freshness_seconds ~0-5s)
- ✅ No stale fallback message visible
- ✅ Prices accurate vs market data

**Pass/Fail**: ___________

---

## Test Case D: Dashboard No Regression - Hot Symbols + Alerts

**Objective**: Verify Dashboard improvements didn't break hot symbols or alert center

**Setup**:
- Time: Any time (market open preferred)
- Dashboard visible
- "Mã nóng" (hot symbols) card visible
- "Trung tâm cảnh báo hợp nhất" (unified alert center) visible

**Test Steps**:

| # | Action | Expected Result | Status |
|---|--------|-----------------|--------|
| 1 | Observe "Mã nóng" section | Shows list of hot symbols (sorted by %change) | ⬜ |
| 2 | Watch for 1 minute | Symbol list order is stable, no jumping | ⬜ |
| 3 | Observe "Trung tâm cảnh báo" section | Shows alert list with severity colors | ⬜ |
| 4 | Wait for new alerts to arrive | New alerts appear at top, old alerts don't re-order unnecessarily | ⬜ |
| 5 | Check visual "pulse" animation | Alert rows don't flash/blink on every refresh | ⬜ |
| 6 | Scroll table | Scrolling smooth, no lag | ⬜ |
| 7 | Click on hot symbol | Opens stock detail page without lag | ⬜ |
| 8 | Return to Dashboard | Hot symbols section re-renders without excessive re-render | ⬜ |

**Success Criteria**:
- ✅ Hot symbols list is stable (no unnecessary re-ordering)
- ✅ Alert center shows new alerts immediately
- ✅ Old alerts stay in position (don't re-order)
- ✅ No visual "pulse" flashing animation
- ✅ Scrolling and clicking responsive

**Pass/Fail**: ___________

---

## Bonus: Watchlist Integration Tests

### Test E: Watchlist Tracked Symbols Table (Optional Bonus)

**Setup**:
- Navigate: Watchlist → "Mã theo dõi" (Tracked Symbols) tab
- Has at least 3-5 tracked symbols with realtime data

**Test Steps**:

| # | Action | Expected Result | Status |
|---|--------|-----------------|--------|
| 1 | Scroll tracked symbols table | Smooth scrolling, no lag | ⬜ |
| 2 | Watch for realtime updates | Price column updates smoothly (green/red colors) | ⬜ |
| 3 | Check memoization | Only rows with price changes should highlight in DevTools | ⬜ |
| 4 | Edit whale threshold | Click threshold field, enter new value, save → updates without lag | ⬜ |
| 5 | Delete tracked symbol | Click delete → symbol removes from table | ⬜ |

**Pass/Fail**: ___________

### Test F: Watchlist Group Detail Table (Optional Bonus)

**Setup**:
- Navigate: Watchlist → Group (e.g., Sector) → Detail view
- Table showing group symbols with realtime data

**Test Steps**:

| # | Action | Expected Result | Status |
|---|--------|-----------------|--------|
| 1 | Observe table structure | Columns: Mã, Giá, Thay đổi, % Thay đổi, Ngày | ⬜ |
| 2 | Watch realtime updates | Prices update smoothly, no row jumping | ⬜ |
| 3 | Click "Thêm vào theo dõi" (Add to Tracked) | Symbol adds to tracked list | ⬜ |
| 4 | Re-visit table | Previously added symbol now shows "Tracked" badge + "Xóa khỏi theo dõi" button | ⬜ |
| 5 | Pagination | Click next/prev page → table updates quickly | ⬜ |

**Pass/Fail**: ___________

---

## Summary Report

### Overall Status

| Case | Result | Severity | Notes |
|------|--------|----------|-------|
| A: Offhours Data | ⬜ PASS / ⬜ FAIL | - | |
| B: Realtime Smooth | ⬜ PASS / ⬜ FAIL | - | |
| C: F5 Fresh Data | ⬜ PASS / ⬜ FAIL | - | |
| D: No Regression | ⬜ PASS / ⬜ FAIL | - | |
| E: Watchlist Tracked | ⬜ PASS / ⬜ FAIL | Optional | |
| F: Watchlist Groups | ⬜ PASS / ⬜ FAIL | Optional | |

### Metrics Achieved

- **Flashing reduction**: From 5-10/min → ________/min (Expected: ≤2-3/min)
- **Bootstrap speed**: From 10 batches → ________ batches (Expected: ~5-7 x 20symbols)
- **Recovery interval**: From 5s → ________s (Actual: Should be 8s)
- **User satisfaction**: ⬜ Improved / ⬜ No change / ⬜ Worse

### Issues Found

1. Issue: ________________
   - Severity: ⬜ Critical / ⬜ High / ⬜ Medium / ⬜ Low
   - Action: ________________

2. Issue: ________________
   - Severity: ⬜ Critical / ⬜ High / ⬜ Medium / ⬜ Low
   - Action: ________________

### Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | __________ | __________ | __________ |
| Dev Lead | __________ | __________ | __________ |

---

## Next Steps

If ALL cases pass:
- ✅ Phase 1-4 complete and validated
- ✅ Ready for production deploy
- ✅ Document lessons learned

If ANY case fails:
- 🔧 Investigate root cause
- 🔧 Apply fixes
- 🔧 Re-test failed case
- 🔧 Update audit ledger with fixes

