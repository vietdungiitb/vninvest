# UI/UX Research: Commercial Portfolio Management Platforms

## Date: 2026-09-27
## Purpose: Design patterns reference for SOC DataOps / portfolio dashboard parity

---

## 1. BLOOMBERG TERMINAL — PORT (Portfolio & Risk Analytics)

### Layout Structure
- **Multi-pane workspace** with 4–9 panels visible simultaneously
- **Control Area** (top): toolbar + tab navigation + workspace selector
- **Navigational sidebar** (left): portfolios, groups, benchmarks, strategies
- **Main View** (center): real-time holdings table with configurable columns
- **Chart expander** (right): collapsible chart panel (scatter plots, distribution, heat maps)
- **Portfolio Display** sub-screen: Control Area + positions list + 3 analysis sections (Current Values / Cost-As-Of / Change Values) + zoom tool

### Color Scheme
- **Background**: `#0A0E1A` (deep navy-black), `#0E1017` (chart area)
- **Surface**: `#11172A`, `#1A2138` (slightly lighter panels)
- **Amber primary**: `#FFA02F` / `#FFA028` (signature accent — most important data)
- **Positive (up)**: `#00B96B` (green), also `#338736` per Bloomberg Design System
- **Negative (down)**: `#F23645` (red), also `#e51503`
- **Muted labels**: `#5E6680`, `#767676`
- **High-importance text**: `#E8ECF4`, white `#FFFFFF`
- **Grid lines**: `#1E2128` (subtle)
- **CVD (Color Vision Deficiency) modes**: blue/red alternative scheme accessible via `PDFU COLORS`

### Typography
- **Primary**: BWHaasGroteskWeb at 14–16px, weights 400/500/700
- **Display**: BWHaasHead at 28–32px with 0.42–0.48px positive tracking
- **Kicker**: AvenirNextPForBBG at 12px weight 600 (uppercase footer)
- **Data tables**: monospaced digits, `tabular-nums`
- **Font size zoom**: adjustable via Zoom bar (52 levels)

### Key Metrics
- Total portfolio value, daily P&L, unrealized gain/loss, total gain, annualized yield (XIRR)
- Sector/country/custom grouping weights vs benchmark
- Factor risk exposures, tracking error, VaR, Sharpe/Sortino ratios
- Intraday monitor chart with portfolio return trace
- Top/bottom contributors, attribution analysis
- Cash flows, liquidity risk, key rates

### Interaction Patterns
- **Keyboard shortcuts**: `F9: TRADE`, `Alt+W`: new layout, `PDFU COLORS` for accessibility
- **Hover states**: toolbar buttons change background + text color
- **Filtering/sorting**: column headers, dropdown menus, search bars
- **Chart expander**: click to show/hide charts
- **News heat icons**: far-left of table rows, click for relevant news
- **Drill-down**: click any holding → deeper analysis sub-tabs
- **Cross-panel linking**: "Link This" button color syncs instrument changes across panels

### Navigation
- **Tab bar** at top: Intraday / Positions / Aggregate / Trend / VaR / Performance / Attribution / Scenarios / Optimization
- **Sub-tabs** within each main tab
- **Sidebar** for portfolio/group/benchmark/strategy navigation
- **Workspace**: saved layouts, multiple sheets per portfolio

### Data Visualization
- **Chart types**: scatter plots, distribution histograms, heat maps, trend lines, waterfall charts
- **Intraday monitor chart**: real-time portfolio return line
- **Allocation charts**: 4 visualization modes for sector allocation
- **Treemap**: position sizing by weight
- **Sparklines**: in KPI cards

---

## 2. TRADINGVIEW — PORTFOLIOS

### Layout Structure
- **Top bar**: Portfolio value, Unrealized gain, Total gain, Annualized yield (4 KPI tiles)
- **Main content area** with 4+ tabs:
  1. **Overview**: portfolio summary + performance chart + distribution + daily gainers/losers
  2. **Holdings**: 6 modes (Position / Price / Financials / Performance / Risk / Technicals)
  3. **Transactions**: chronological trade history
  4. **Performance**: time-period returns + risk metrics (beta, Sharpe, Sortino)
  5. **Allocation**: visual asset distribution
- **Right rail**: settings, grouping options, summary toggle

### Color Scheme
- **Dark mode**: `--dark-canvas: #000000`, `--dark-surface: #0F0F0F`, `--dark-surface-elevated: #2E2E2E`
- **Light mode**: `#FFFFFF` canvas, `#F2F2F2` surface, `#EBEBEB` elevated
- **Action blue**: `#5B9CF6` (links, active states, primary buttons)
- **Negative/loss**: `#F23645` (loss indicators, delete actions, alert badges)
- **Positive/gain**: green tones (profit)
- **Chart palette**: `--chart-1` through `--chart-5` in OKLCH
- **Custom financial tokens**: `--profit: oklch(0.75 0.18 180)`, `--loss: oklch(0.65 0.22 25)`, `--interactive: oklch(0.78 0.15 75)` (amber)

### Typography
- **Primary**: Apple system at 14px/16px, weights 400/500/600
- **Monospace**: JetBrains Mono for numbers (`font-mono tabular-nums`)
- **Color tokens**: `ink (#0F0F0F)`, `ink-secondary (#2E2E2E)`, `ink-tertiary (#4A4A4A)`, `muted-ink (#707070)`

### Key Metrics
- Portfolio value, unrealized gain, total gain, annualized yield (XIRR)
- Allocation by currency, symbol type, sector, or exchange
- Daily gainers/losers
- Per-position: Qty, Avg price, Last price, Invested, Value, Unrealized gain/loss %, Daily gain, Total gain, Annualized yield
- Risk metrics: Beta 1Y, Sharpe ratio, Sortino ratio
- Financials: Revenue, EPS, P/E Ratio, Dividend, Yield
- Technicals per position

### Interaction Patterns
- **6 table modes** switchable via tab bar (Position, Price, Financials, Performance, Risk, Technicals)
- **Display sold** toggle (include closed positions)
- **Summary row** toggle (TOTAL row)
- **Grouping** by currency, symbol type, sector, or exchange
- **Custom views**: add/remove/reorder columns, save multiple views
- **Column drag-and-drop** reordering
- **Expandable holdings**: show transaction history under each row
- **Position-level editing**: update quantity → auto-calculates difference

### Navigation
- **Main tabs**: Overview / Holdings / Transactions / Performance / Allocation
- **Holdings sub-modes**: 6 data views
- **Settings gear**: grouping principle, summary toggle
- **Sidebar-like right panel**: configuration

### Data Visualization
- **Performance chart**: line chart (value or performance vs benchmark)
- **Distribution**: visual asset allocation by category
- **Treemap**: position sizing (community indicators)
- **Daily gainers/losers**: ranked list
- **Equity curve**: with regime background coloring (Bull=green, Bear=red, Accumulation=blue, Distribution=amber)

### CSS Custom Properties (Dark Theme)
```css
.theme-dark:root {
  --tv-color-platform-background: #070317;
  --tv-color-pane-background: #0F0F0F;
  --tv-color-toolbar-button-text: #B2B5BE;
  --tv-color-item-active-text: #FFFFFF;
}
```
Positive: `#D1D4DC` (50% opacity), Negative: `#673AB7`

---

## 3. REFINITIV EIKON / LSEG WORKSPACE — PORTFOLIO ANALYTICS

### Layout Structure
- **Single-window display** with draggable panels
- **Layout system**: multiple sheets (like Excel tabs), each sheet = one portfolio
- **Panel-based**: Monitor + Chart + News + Screener + Portfolio apps
- **Linking**: "Link This" button color syncs instrument across panels
- **Tiles**: floating app windows anywhere on desktop (desktop app only)
- **App Menu**: New Layout (`Alt+W`), Save Layout As, add sheets

### Color Scheme
- **Professional dark** theme with dark nav (`#1c1c1c`)
- **Default**: light surface with dark text (classic terminal look)
- **Semantic colors**: up/down indicators, status indicators
- **Monospace data**: fixed-width font throughout
- **Hairline dividers** between panels

### Typography
- **Monospaced digits** for all financial data
- **System font** for labels and headers
- **Zoom tool**: adjustable font sizes for data readability

### Key Metrics
- Portfolio positions with values, weights, allocations
- Sector/country/custom grouping breakdown
- Performance attribution (contribution vs benchmark)
- Multi-level top-down/bottom-up analysis
- Risk models, factor exposures, scenario analysis
- Screener integration for security selection

### Interaction Patterns
- **Drag-and-drop panels**: rearrange freely
- **Panel linking**: synchronized instrument changes across panels
- **Layout save/load**: `Alt+W` for new layout, `Save Layout As`
- **App Menu**: add panels, add tabs, add sheets
- **Search bar**: universal search for companies, securities, indices, apps
- **Context-sensitive help**: `?` icon on any screen

### Navigation
- **WS icon** (top-left): layout menu, new layout
- **App Menu** (right side of each panel): add panel/tab/sheet
- **My Layouts**: recently used layouts always available
- **Start Page** (`+(Plus)` tab): new layout creation
- **Browser/Tiles**: switch between tabbed and tiled views

### Data Visualization
- **Chart panels**: line, bar, candlestick
- **Allocation charts**: sector weights
- **Screener reports**: sortable/filterable tables
- **Performance attribution**: waterfall, treemap
- **Monitor lists**: real-time price updates

---

## 4. YAHOO FINANCE — PORTFOLIO

### Layout Structure
- **Left sidebar**: My Portfolio → list selection
- **Main area**: Holdings table + Performance chart + News feed
- **Views**: Basic / Details / Holdings (switchable)
- **Custom views**: user-created column configurations
- **Bottom section**: related news

### Color Scheme
- **Light mode**: white canvas, near-black text (`#0F0F0F`), gray intermediates
- **Dark mode**: pure black `#000000` canvas, white text on dark surfaces
- **Semantic**: green for positive, red for negative
- **Card surfaces**: white with subtle borders

### Typography
- **Body**: ~14px system font
- **Headings**: larger sizes for section titles
- **Data**: tabular-nums for alignment
- **Old classic view**: dense table with compact rows (praised for density)
- **New redesign**: larger fonts, more whitespace (criticized for density loss)

### Key Metrics
- Holdings list with price, change %, value
- Portfolio total value, daily change
- Performance over time (chart)
- Transaction history
- News feed per holding
- Diversification metrics (360-degree view)
- Cash, dividends tracking
- 401K/IRA/savings account aggregation

### Interaction Patterns
- **Custom views**: create multiple column configurations, drag-and-drop reorder
- **Tab switching**: Basic / Details / Holdings
- **Expand rows**: show transactions, notes
- **Add/remove tickers**: search + add
- **CSV import/export**
- **FIFO lot management** for transactions

### Navigation
- **Left nav**: My Portfolio → list selection
- **Tabs**: Holdings / Transactions / News
- **View selector**: Basic / Details / Holdings
- **Custom view management**: Plus icon → Create/Edit views

### Data Visualization
- **Performance chart**: line chart showing portfolio value over time
- **Allocation**: visual breakdown by asset class
- **Tables**: dense holdings data
- **News**: related articles per holding

### Design Philosophy Note
The 2016–2018 redesign shifted from **dense table + data-rich** to **card-based + mobile-first**. The classic view allowed seeing 20+ stocks with 10–15 data points on one screen. The new design prioritizes aesthetics and mobile-friendliness over raw data density. Community consensus: classic was superior for desktop power users.

---

## 5. VIETNAM SECURITIES PLATFORMS (VNĐỰC, SSI, SHS, Kafi, Finavi)

### Layout Structure (Common Patterns)
- **Dashboard overview**: total assets, daily P&L, portfolio performance chart
- **Watchlist**: ticker list with real-time price updates
- **Order entry panel**: prominent, always visible, 1–3 step flow
- **Position list**: holdings with cost basis, current value, P&L
- **Market data**: depth chart, order book, time & sales

### Color Scheme
- **Dark mode dominant**: deep backgrounds (#0F0F0F to #1A1A2E)
- **Brand accent colors**: each broker has signature colors
- **Green/red**: universal up/down indicators
- **High contrast**: designed for long screen sessions
- **Glassmorphism**: emerging trend (HSC, Kafi) — frosted glass panels with backdrop blur

### Vietnamese-Specific UX Patterns
- **Unified order screen** (SH Smart): all vital data on one screen, no tab switching
- **1-tap order**: select price directly on screen
- **Order presets**: save frequently-used configurations
- **Skip confirmation**: optional for repeat orders
- **Multi-display layout** (Finavi): MDI — multiple child windows in single main interface
- **Experience-based personalization** (Kafi): beginner/intermediate/expert modes
- **Educational integration**: context tooltips, tutorials for beginners

### Typography
- **Vietnamese text**: full diacritical marks support required
- **Monospace numbers**: for price tables
- **Brand fonts**: clean, modern sans-serif
- **Font size hierarchy**: clear distinction between data density levels

### Key Metrics
- Total portfolio value, daily P&L
- Position list: symbol, quantity, avg price, current price, P&L, %
- Market depth, order book
- Real-time quotes
- Account balance, buying power
- Margin ratio (for leveraged accounts)

### Interaction Patterns
- **Drag-and-drop order entry**: price selection on chart
- **One-click trading**: rapid order placement
- **Real-time updates**: WebSocket price feeds
- **Order management**: modify/cancel directly from order list
- **Customizable layouts**: widget arrangement (Finavi, SH Smart)

### Navigation
- **Bottom nav** (mobile): Home / Watchlist / Trade / Portfolio / More
- **Sidebar** (desktop): menu + account info
- **Tab bar**: different sections
- **Breadcrumb-free**: flat navigation structure common

---

## 6. BLOOMBERG TERMINAL DARK THEME COLOR PALETTE (DETAILED)

| Token | HEX | RGB | Usage |
|-------|-----|-----|-------|
| Background | `#0A0E1A` | `rgb(10,14,26)` | Deep navy-black ground |
| Surface 1 | `#11172A` | `rgb(17,23,42)` | Panel/card background |
| Surface 2 | `#1A2138` | `rgb(26,33,56)` | Elevated surfaces |
| Amber primary | `#FFA02F` | `rgb(255,160,47)` | Most important data, headers |
| Positive/up | `#00B96B` | `rgb(0,185,107)` | Price up, gain |
| Negative/down | `#F23645` | `rgb(242,54,69)` | Price down, loss |
| Muted label | `#5E6680` | `rgb(94,102,128)` | Secondary text, metadata |
| High-importance | `#E8ECF4` | `rgb(232,236,244)` | Primary text on dark |
| Grid lines | `#1E2128` | `rgb(30,33,40)` | Table/grid dividers |
| Chrome white | `#FFFFFF` | `rgb(255,255,255)` | Headlines, top-level text |

**Bloomberg Orange** `#FFA028`/`#F05143` — used as text-only highlight (22 of 81 color slots), NEVER as button fill or background wash. The "Live TV pulse dot" uses orange.

**Chromatic semantics**: red `#e51503` = ticker-down + live indicator, green `#338736` = ticker-up, blue `#0064fa` = Opinion column, yellow `#ffcd1e` = warnings. Each color pinned to specific function, not decoration.

---

## 7. TRADINGVIEW DARK THEME CSS VARIABLES (COMPLETE)

```css
.theme-dark:root {
  /* Core surfaces */
  --tv-color-platform-background: #070317;
  --tv-color-pane-background: #0F0F0F;
  --tv-color-pane-background-secondary: #1A1A2E;
  
  /* Text */
  --tv-color-toolbar-button-text: #B2B5BE;
  --tv-color-toolbar-button-text-hover: #FFFFFF;
  --tv-color-item-active-text: #FFFFFF;
  
  /* Chart colors */
  --tv-color-bar-mark-background-color: /* chart-specific */;
  --tv-color-crosshair: #9598A1;
  --tv-color-scale-text: #B2B5BE;
  
  /* Semantic */
  --tv-color-positive: #D1D4DC;    /* 50% opacity for candles */
  --tv-color-negative: #673AB7;    /* purple for down in some themes */
}

/* TradingView Widget CSS tokens (for embedded widgets) */
--tv-widget-accent-color: #111;
--tv-widget-text-color: #222;
--tv-widget-background-color: #eee;
--tv-widget-font-family: monospace;
--tv-widget-price-text-color: black;
--tv-widget-positive-color: rgb(0, 118, 221);    /* blue-green */
--tv-widget-negative-color: rgb(221, 66, 0);    /* orange-red */
--tv-widget-positive-area-top-color: rgba(0, 118, 221, 0.2);
--tv-widget-negative-area-top-color: rgba(221, 66, 0, 0.2);
```

**TradingView design system (Fudge analysis)**:
- Light: `ink #0F0F0F`, `canvas #FFFFFF`, `surface #F2F2F2`, `action #5B9CF6`, `negative #F23645`
- Dark: `dark-canvas #000000`, `dark-surface #0F0F0F`, `dark-surface-elevated #2E2E2E`, `dark-ink #FFFFFF`
- Action blue `#5B9CF6` consistent across both modes
- Negative red `#F23645` exclusively for financial loss/alert states

---

## 8. MODERN SaaS DASHBOARD DESIGN PATTERNS

### Grid Layout Patterns
| Pattern | CSS Grid Template | Use Case |
|---------|------------------|----------|
| **Bento grid** | `repeat(auto-fit, minmax(240px, 1fr))` | Overview dashboards (Vercel, Linear) |
| **Sidebar shell** | `250px 1fr` or `260px 1fr` | CRUD-heavy tools (Stripe, Retool) |
| **Split-pane master-detail** | `1fr 320px` | Trading, ticket queues |
| **Featured + grid** | `4fr 2fr` or `repeat(6, 1fr)` with spans | Financial overview |
| **Magazine grid** | `repeat(12, 1fr)` with `span` | Complex multi-widget |
| **KPI row** | `repeat(auto-fit, minmax(200px, 1fr))` | Metric cards across top |

### Financial Dashboard Specific Grid
```css
.financial-dashboard {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main-chart analytics"
    "sidebar data-table analytics"
    "footer footer footer";
  grid-template-columns: 250px 1fr 300px;
  grid-template-rows: auto 1fr auto auto;
  min-height: 100vh;
  gap: 15px;
}
```

### KPI Card Anatomy
```
┌─────────────────────────────┐
│  Label (uppercase, muted)   │
│  Value (large, bold, 48px)  │
│  ── Sparkline (mini chart) ─│
│  Δ +4.2% (green pill)       │
└─────────────────────────────┘
```
- `font-variant-numeric: tabular-nums` for digit alignment
- `container-type: inline-size` + `@container` for responsive card
- `clamp()` with `cqi` units for fluid typography
- Status via color + icon + text (never color alone)

### Glassmorphism Pattern
- `backdrop-filter: blur(12px)` + `bg-white/10`
- Subtle border: `border border-white/10`
- Shadow: `shadow-lg shadow-black/30`
- Surface: `bg-gradient-to-br from-white/5 to-white/10`
- Common in Vietnamese broker platforms (HSC, Kafi)

### Modern Dark Mode Token System (OKLCH)
```css
.dark {
  --background: oklch(0.08 0.005 250);    /* near-black with blue tint */
  --card: oklch(0.12 0.005 250);          /* slightly lighter */
  --muted: oklch(0.2 0.005 250);          /* surface elevated */
  --primary: oklch(0.78 0.15 75);         /* amber/interactive */
  --border: oklch(0.22 0.005 250);        /* subtle dividers */
  --profit: oklch(0.75 0.18 180);         /* green */
  --loss: oklch(0.65 0.22 25);            /* red */
}
```

---

## 9. FINANCIAL DATA TABLE DESIGN

### Column Layout
| Priority | Column | Width | Format |
|----------|--------|-------|--------|
| 1 | Symbol/Ticker | 120px | Font-medium, left |
| 2 | Quantity | 100px | `tabular-nums`, right |
| 3 | Price | 120px | Currency, right |
| 4 | Value | 140px | Currency, right |
| 5 | P&L | 140px | Color-coded, right |
| 6 | P&L % | 100px | Color-coded %, right |
| 7 | Daily Change | 120px | Color-coded, right |
| 8 | Allocation | 100px | %, right |

### Interaction Patterns
- **Sticky header**: `position: sticky; top: 0; z-index: 2`
- **Sticky first column**: `position: sticky; left: 0; z-index: 1`
- **Sticky corner cell**: `z-index: 3` (above both header and first column)
- `border-collapse: separate; border-spacing: 0` for sticky compatibility
- **Hover row**: subtle background change (`surface-elevated`)
- **Sort indicator**: arrow on column header
- **Expandable rows**: transaction detail below each holding
- **Pagination**: 20–50 rows per page, or virtual scroll for 500+

### Table Design (from CodeFronts 17 CSS Dashboards)
- 10-column portfolio table scrolls both ways
- Header row pinned to top
- Ticker column frozen to left
- Corner cell with `z-index: 3`
- `position: sticky` on `th/td` + three-layer z-index ladder

---

## 10. KEY DESIGN PRINCIPLES FOR PROFESSIONAL FINANCIAL UIs

### Information Density Hierarchy
1. **One question, one hero metric** — top-left, largest, highest contrast
2. **KPI row** — 3–5 key metrics across top
3. **Main chart** — primary visualization
4. **Data table** — detailed holdings
5. **Detail rail** — drill-down, 320px sidebar
6. **Footer** — data source, timestamps

### Professional Trust Signals
- **Monospace digits** — alignment, precision feel
- **Color-coded P&L** — green/red immediately readable
- **Real-time indicators** — live dots, pulse animations
- **Subtle glass effects** — depth without clutter
- **Consistent token system** — design coherence
- **No unnecessary whitespace** — density = professionalism
- **Keyboard shortcuts** — power user capability
- **Customizable layouts** — workspace personalization

### Common Anti-Patterns (Avoid)
- Pure white backgrounds (use off-white `#F8F9FA` or dark `#0A0E1A`)
- Rounded corners on data tables (use 0–4px max)
- Color alone for status (add icon + text)
- Overly large fonts for data (14–16px for body, 48px max for hero numbers)
- More than 5 visualizations per screen
- Dual-axis charts (read as two fighting charts)
- Pure decoration (every element must serve a function)

### Responsive Strategy
- **Desktop-first** for financial platforms (most users are professionals on desktop)
- **CSS Grid named areas**: `grid-template-areas` reads like ASCII diagram
- **Container queries** for widgets (`container-type: inline-size`)
- **`clamp()` + `cqi`** for fluid typography
- **Single media query** for major structural shift (sidebar → icon rail)
- **Mobile collapse**: stack vertically, hide sidebar, enlarge touch targets

### Accessibility (CVD-Friendly)
- Bloomberg CVD modes: blue/red instead of green/red
- Okabe-Ito palette for colorblind-safe charts
- Status conveyed by color + icon + text (never color alone)
- `aria-live` regions for real-time updates
- Keyboard navigation, visible focus states
- 4.5:1 minimum contrast ratio

---

## 11. DATA VISUALIZATION SPECIFICS

### Chart Types by Use Case
| Question | Chart Type | Platform Example |
|----------|-----------|-----------------|
| Trend over time | Line/area chart | TradingView performance, Bloomberg PORT trend |
| Part-to-whole | Donut/stacked bar | Yahoo allocation, TradingView distribution |
| Comparison across categories | Bar chart (sorted) | Bloomberg holdings table, Kafi dashboard |
| Position sizing | Treemap | TradingView Portfolio Treemap indicator |
| P&L build-up | Waterfall | Bloomberg PORT attribution |
| Risk distribution | Heat map | Bloomberg PORT VaR |
| Intraday performance | Real-time line | Bloomberg PORT Intraday monitor |
| Correlation | Scatter plot | Bloomberg PORT scatter |
| Factor exposure | Radar/bar | Bloomberg PORT factor risk |
| Mini trend in KPI | Sparkline (7-bar CSS) | Modern dashboard KPI cards |

### Sparkline Pattern (CSS-only)
```css
.spark i {
  height: var(--h);
  transform-origin: bottom;
  animation: rise .6s cubic-bezier(.2,.7,.2,1) backwards;
  animation-delay: calc(var(--i) * 60ms);
}
@keyframes rise { from { scale: 1 0; } }
```
7 flex bars, heights from `--h` custom property, staggered animation.

### Equity Curve with Regime Background
- TradingView `HistogramSeries` on separate `priceScaleId`
- Full-height colored background behind equity curve
- Bull = green, Bear = red, Accumulation = blue, Distribution = amber
- Regime histogram overlay with `scaleMargins top:0 bottom:0`

---

## 12. RECOMMENDATIONS FOR VNINVEST SOC DATAOPS DASHBOARD

### Adopted Patterns
1. **Bloomberg-style dark theme**: `#0A0E1A` ground, amber `#FFA02F` accent, monospace numbers
2. **TradingView CSS token system**: OKLCH dark mode with `--profit`/`--loss` semantic tokens
3. **Grid layout**: `grid-template-areas` named areas, sidebar + main + analytics rail
4. **KPI card row**: `repeat(auto-fit, minmax(200px, 1fr))` with sparklines
5. **Glassmorphism panels**: `backdrop-filter: blur` + semi-transparent backgrounds
6. **Financial table**: sticky header + sticky first column, color-coded P&L
7. **Container queries**: widget adaptation based on own container width
8. **Vietnamese UX patterns**: unified order screen, 1-tap actions, experience-based personalization

### Color Tokens for SOC DataOps
```css
:root {
  --bg-primary: #0A0E1A;
  --bg-surface: #11172A;
  --bg-elevated: #1A2138;
  --accent-amber: #FFA02F;
  --positive: #00B96B;
  --negative: #F23645;
  --text-primary: #E8ECF4;
  --text-muted: #5E6680;
  --border-subtle: #1E2128;
}
```

### Layout Template
```
┌──────────────────────────────────────────────────┐
│ Header: Logo | Search | Notifications | Profile   │
├──────┬────────────────────────────┬──────────────┤
│      │                            │              │
│ KPI  │   Main Chart Area          │  Analytics   │
│ Row  │   (line/bar/area chart)    │  Rail        │
│      │                            │  (allocation,│
│      │                            │   risk,      │
│      │                            │   metrics)   │
├──────┼────────────────────────────┼──────────────┤
│      │                            │              │
│ Data │    Holdings Table          │   Detail     │
│ Table│    (sticky header + col)   │   Panel      │
│      │                            │              │
├──────┴────────────────────────────┴──────────────┤
│ Footer: Data source | Last updated | Help         │
└──────────────────────────────────────────────────┘
```

---

## SOURCES
- Bloomberg PORT documentation (somfin.gmu.edu, eTUTOR-CEK)
- Bloomberg Design System (shadcn.io/design/bloomberg, design.withfudge.com)
- Bloomberg UX accessibility article (bloomberg.com/ux, 2021-10-14)
- TradingView support docs (support.solutions)
- TradingView CSS Color Themes (GitHub wiki, charting-library-docs)
- TradingView Fudge design analysis (design.withfudge.com/share/tradingview.com-design)
- LSEG Workspace quick-start guide (lseg.com)
- Yahoo Finance help docs (help.yahoo.com)
- Yahoo Finance redesign critique (eathealthy365.com, 2025-09)
- CSS Grid Dashboard layouts (codefronts.com, mox.one, dashboarddesignpatterns.github.io)
- Bloomberg Terminal style recipe (github.com/conardli/garden-skills)
- TradingView chart theme (github.com/serkor1/ta-lib-R)
- Vietnamese platform design cases (doodledesign.co, behance.net, memo.d.foundation, finlios.com, thiethao.com)
- Color palette references (colorcodeguide.com, mobbin.com, tradingviewthemes.com)
