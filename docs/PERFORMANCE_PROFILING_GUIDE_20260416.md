# Performance Profiling Guide - Realtime Table Unification
**Date**: 2026-04-16  
**Purpose**: Measure impact of RealtimeQuoteTable + Polling Optimization on Dashboard & Watchlist

---

## Setup

### Prerequisites
1. Chrome DevTools open (F12)
2. Dashboard page loaded
3. Watchlist page loaded (in separate tab)
4. Network throttling: No throttle (baseline)
5. CPU throttling: 1x (baseline, no slowdown)

### Metrics to Capture
- **Render Time**: Time from state update → DOM paint
- **Re-render Frequency**: Count of re-renders per minute
- **Frame Rate**: FPS during realtime updates
- **Memory**: Heap snapshot before/after
- **Task Duration**: Long task analysis (>50ms)

---

## Test Scenarios

### Scenario 1: Dashboard Market Status Table (Normal Trading Hours)

**Setup:**
1. Open Dashboard page
2. Open Chrome DevTools → Performance tab
3. Click "Record" button
4. Wait 2-3 minutes (capture multiple polling cycles)
5. Stop recording
6. Analyze results

**Metrics to Check:**
- ✅ **Rendering time per update**: Should be < 20ms per quote update (with memo)
- ✅ **Re-render frequency**: Should see ~1-2 re-renders per polling cycle (every 8-15s)
- ✅ **Frame rate**: Should maintain 60 FPS during realtime updates
- ✅ **Long tasks**: Count tasks > 50ms (should be minimal)
- ✅ **Memory growth**: Should be stable (no memory leak)

**Expected vs Actual Before/After:**
| Metric | Before (Old Hook) | After (Optimized) | Goal |
|--------|------------------|-------------------|------|
| Renders/min | ~5-10 | ~2-3 | ✅ 60% reduction |
| Render time/update | ~50-100ms | ~10-20ms | ✅ 75% faster |
| Frame drops | ~5-10/min | ~0-2/min | ✅ Smooth 60 FPS |
| Heap size growth/min | +2-5 MB | <+1 MB | ✅ No leak |

---

### Scenario 2: Watchlist Tracked Symbols (Dynamic Add/Remove)

**Setup:**
1. Open Watchlist page
2. Navigate to "Mã theo dõi" (Tracked Symbols) tab
3. DevTools → Performance → Record
4. Perform actions:
   - Scroll through table
   - Click on rows
   - Hover over prices
   - Wait for realtime updates
5. Stop recording after 2-3 minutes

**Metrics to Check:**
- ✅ **Row update latency**: Time to update single row price/% change
- ✅ **Pagination transition**: Time to switch pages
- ✅ **Sorting performance**: Time to re-sort table
- ✅ **Memoization effectiveness**: Count rows that didn't re-render unnecessarily

---

### Scenario 3: Watchlist Group Detail (Hover + Realtime)

**Setup:**
1. Open Watchlist → Group detail view
2. DevTools → Performance → Record
3. Hover over rows while updates come in
4. Scroll table
5. Stop recording after 2-3 minutes

**Expected:**
- ✅ Only hovered row + updating rows re-render
- ✅ Non-changing rows stay stable
- ✅ No full-table re-renders

---

### Scenario 4: Memory Leak Check (30-minute soak test)

**Setup:**
1. Open Dashboard
2. DevTools → Memory tab → Take heap snapshot (mark: "Initial")
3. Leave running for 30 minutes with realtime data flowing
4. Take heap snapshot again (mark: "After 30min")
5. Compare snapshots

**Analysis:**
- ✅ Detached DOM nodes count
- ✅ Event listeners not removed
- ✅ Timers/intervals still active
- ✅ Heap growth trend

---

## How to Measure in Chrome DevTools

### Step 1: Performance Recording

```
1. Open Chrome DevTools (F12)
2. Click "Performance" tab
3. Click red "Record" button (or Ctrl+Shift+E)
4. Perform test scenario (scroll, wait for updates, interact)
5. Click red "Record" button again to stop
6. Analyze flame chart
```

### Step 2: Find React Renders

In flame chart, look for:
- `⚛️ React` components highlighted
- `setState` operations
- Frequency of "Render" tasks

### Step 3: Measure Individual Row Render Time

In flame chart, zoom into a single row update:
- Look for `QuoteTableRow` render
- Check time duration (should be <5ms with memo)
- Compare vs non-memoized rows (>20ms)

### Step 4: Memory Profiling

```
1. Open "Memory" tab
2. Click "Take heap snapshot"
3. Search for "QuoteTableRow" instances
4. Check detached DOM nodes
5. Monitor growth over time
```

---

## Expected Improvements

### Dashboard Market Status Table
- **Before (Old polling)**: 5-10 flashes/min, 50-100ms per update
- **After (Optimized)**: 2-3 flashes/min, 10-20ms per update
- **Improvement**: ~70% reduction in visual flashing

### Watchlist Tables
- **Before (Manual rendering)**: Full table re-render on any quote update
- **After (RealtimeQuoteTable + memo)**: Only changed rows re-render
- **Improvement**: 80-90% fewer DOM operations

### Overall
- **CPU usage**: 30-40% reduction
- **Frame rate**: More stable 60 FPS
- **Memory**: No leaks, stable heap

---

## Baseline Captures to Save

Before rebuilding Docker, take these baseline measurements:
1. **Dashboard - Normal hours (2-3 min recording)**
   - File: `performance-baseline-dashboard-before.json`
2. **Watchlist - Group detail (2-3 min recording)**
   - File: `performance-baseline-watchlist-group-before.json`
3. **Watchlist - Tracked symbols (2-3 min recording)**
   - File: `performance-baseline-watchlist-tracked-before.json`

After rebuild, take "after" versions and compare:
```bash
# Save recordings manually or via:
# Chrome DevTools → Performance → ⋮ → Save profile
```

---

## Detailed Analysis Steps

### 1. Analyze Rendering Flame Chart

In Performance tab:
- Yellow boxes = JavaScript execution
- Purple boxes = Layout calculation
- Green boxes = Paint/composite
- Red = Long task (>50ms)

For RealtimeQuoteTable optimization:
- ✅ Should see fewer purple boxes (less layout recalc)
- ✅ Should see fewer paint events (row memo working)
- ✅ Should see green consistently (no frame drops)

### 2. Check React Profiler

Install React DevTools if not present:
1. Open Chrome DevTools → Components tab
2. Enable "Highlight updates when components render"
3. Watch Dashboard during realtime updates
4. With memo: Only price/change cells should highlight
5. Without memo: Entire rows highlight

### 3. Bottom-Up Task Analysis

In Performance tab, click "Bottom-Up" tab:
- Sort by "Self Time" (time spent in that function)
- Top items should be:
  - React render: ~5-10ms
  - DOM updates: ~5-10ms
  - Layout: <5ms
  - Paint: <5ms
- Total per update: <30ms (with optimization)

---

## Test Case Validation

After profiling, proceed to Cases A-D testing to confirm UX improvements match metrics.

