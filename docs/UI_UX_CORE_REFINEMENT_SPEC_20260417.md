# Technical Specification: UI/UX Core Refinement (V2)

This document provides a detailed technical roadmap for upgrading the VNInvest Dashboard UI/UX, focusing on data density, visual hierarchy, and an optimized dark theme.

## 1. Global Design System (Slate Dark)

The "Pure Black" theme is deprecated in favor of a "Slate Dark" palette to reduce eye strain and improve depth perception.

### Color Tokens (Tailwind/CSS Variables)
Update `:root` in `index.css`:
- `--terminal-bg`: `#0f172a` (Slate 900)
- `--terminal-panel`: `#1e293b` (Slate 800)
- `--terminal-panel-alt`: `#334155` (Slate 700)
- `--v2-shell-bg`: `rgba(15, 23, 42, 0.72)`
- `--v2-shell-bg-strong`: `rgba(15, 23, 42, 0.9)`

### Button Standardization
Standardize all primary navigation buttons to a **rounded-full (pill-shaped)** style with subtle border transitions.
- Border radius: `9999px`
- Hover state: Scale `1.02`, increase border brightness or add subtle shadow.

---

## 2. Portfolio Heatmap (Treemap) Overhaul

### Color Encoding (VisualMap)
Configure `visualMap` in ECharts to use three main anchors:
- **Negative (-3%)**: `#f43f5e` (Rose 500)
- **Neutral (0%)**: `#1e293b` (Slate 800)
- **Positive (+3%)**: `#10b981` (Emerald 500)

Use `lerp` or `inRange` to map saturation to magnitude. Tiles near 0% should blend into the UI, while tiles >= 3% should glow.

### Content & Labels
- **Small Tiles**: Symbol only.
- **Medium Tiles**: Symbol + % Change.
- **Large Tiles**: Symbol + % Change + Price (VND).
Label formatting: `rich` text blocks with Symbol in Bold 14px and % Change in 11px.

### Enhanced Tooltip
HTML Structure for `formatter`:
```html
<div class="tooltip-container">
  <div class="row-header"><b>[Ticker]</b> - [Company Name]</div>
  <hr/>
  <div class="row-data">Giá: [Price] VND ([Change]%)</div>
  <div class="row-data">Vốn hóa: [Market Cap] Tỷ</div>
  <div class="row-data">Khối lượng: [Volume]</div>
  <div class="mini-chart">[Sparkline placeholder]</div>
</div>
```

### View Mode Toggle
Add a state `sizeMetric`:
- `cap`: Use `live_market_cap` for tile sizes.
- `weight`: Use `live_market_value` (investment amount) for tile sizes.

---

## 3. Sidebar & Watchlist Optimization

### Information Density
- Reduce vertical padding of watchlist items by 20%.
- Ensure the Stock Symbol is high-contrast (Slate 100).
- Price and % Change should be aligned to the right, using fixed-width containers to prevent shifting.

### Sticky Header
The title "DANH SÁCH THEO DÕI" and the Industry Filter Tabs must be `sticky` at the top of the sidebar scroll area.
```css
.sidebar-sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--terminal-bg);
  backdrop-filter: blur(8px);
}
```

### Integrated Profile Section
Relocate "Admin" and "Logout" into a unified card at the very bottom of the sidebar, mimicking a "Profile" widget with a small avatar or initials.

---

## 4. KPI Cards & StatCards

### Sparklines
Implement a lightweight SVG component inside `StatCard.jsx`.
- Use a 10-20 point sample of 24h price data.
- Stroke color: `#10b981` if positive, `#f43f5e` if negative.
- Fill: Subtle gradient area under the line.

### Icons & Labels
Add icons to the left of the label:
- **Market Value**: 💰 (or Lucide `Wallet`)
- **Unrealized P/L**: 📈 (or Lucide `TrendingUp`)
- **Realized P/L**: 📑 (or Lucide `FileText`)
- **Dividends**: 🌿 (or Lucide `Sprout`)

---

## 5. Live Interaction Refinements (TopNav)

### Real-Time Sync Button
Add a "Pulsing" green dot to the "Đồng bộ giá trực tiếp" button.
```css
@keyframes pulse-green {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}
```

### Language Switcher
Replace the current dropdown text with a simple Globe icon (🌐) and the current locale code (VI/EN) to save space.

---
*Reference Implementation: [PortfolioHeatmap.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/PortfolioHeatmap.jsx)*
