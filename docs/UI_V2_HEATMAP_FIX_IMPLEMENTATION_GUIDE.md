# TECHNICAL GUIDE: Fixing Empty Portfolio Heatmap Component

**Date**: 2026-04-17  
**Status**: Ready to Code  
**Target File**: `frontend/src/components/PortfolioHeatmap.jsx`

## 1. Problem Description
The Portfolio Performance Heatmap on the dashboard current renders as an empty dark container. While the header displays, the visualization (SVG) is missing from the DOM.

### Root Causes
1.  **Layout/Dimension Conflict**: The `ResponsiveContainer` uses `height="100%"` inside a flex-1/grid container that lacks a defined height basis, resulting in a computed height of 0px.
2.  **Size Fallback Weakness**: The `??` (nullish coalescing) logic in the `size` calculation fails to fall back to `market_value` if `live_market_value` is explicitly `0`.
3.  **Data Structure Complexity**: The nested tree structure used for `Treemap` data adds overhead and recursion depth checks that are prone to breakage if the rendering environment slightly changes.

---

## 2. Implementation Steps

### A. Fix Container Dimensions
Update the `ResponsiveContainer` to have a guaranteed height to ensure Recharts can initialize the SVG.

```jsx
// BEFORE:
<ResponsiveContainer width="100%" height="100%">

// AFTER:
<ResponsiveContainer width="100%" height={360}>
```

### B. Simplify Data Mapping (Flattening)
Flatten the data structure and ensure robust `size` calculation. Recharts Treemap works reliably with a flat array.

```javascript
// Step 1: Improve data filtering and size selection
const data = (holdings || [])
  .map(h => {
    const liveVal = Number(h.live_market_value ?? 0);
    const snapVal = Number(h.market_value ?? 0);
    // Use live value if > 0, otherwise fallback to snapshot
    const size = liveVal > 0 ? liveVal : snapVal;
    
    return {
      name: h.symbol,
      size: size,
      original: h,
    };
  })
  .filter(item => item.name && item.size > 0);

// Step 2: In Treemap props, use 'data' directly instead of 'treemapData' wrapper
// <Treemap data={data} ... />
```

### C. Update CustomizedContent logic
Since the data is now flat, the symbols will be at `depth: 0`.

```javascript
// Inside CustomizedContent:
const CustomizedContent = (props) => {
  const { depth, x, y, width, height, payload, name } = props || {};
  // Now rendering at level 0 for flat data
  if (!payload || depth !== 0) return null;
  
  // ... proceed with rendering logic ...
}
```

### D. Add Debugging Guards
Add a console warning to facilitate troubleshooting if data exists but filtering produces an empty set.

```javascript
if (holdings.length > 0 && data.length === 0) {
  console.warn('[Heatmap] Holdings present but filtered data is empty. Check live_market_value/market_value units.');
}
```

---

## 3. Reference Snippets

### Color logic hardening
Ensure `changePct` is always a number before doing comparisons.

```javascript
const rawChange = original.live_change_pct ?? original.change_pct ?? 0;
const changePct = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;
```

---

## 4. Verification Checklist
- [ ] **DOM Check**: Verify `<svg ... class="recharts-surface">` exists inside the container.
- [ ] **Visibility**: Squares (rects) for symbols like FPT, VCB, VNM must be visible.
- [ ] **Interactivity**: Hovering squares must show the Tooltip with correct price change %.
- [ ] **Resilience**: The heatmap must show snapshot data even if the WebSocket is disconnected (realtimeStatus !== 'live').
