# Watchlist Redesign Proposal

**Date:** 2026-07-15
**Status:** Proposal — pending approval before implementation

---

## Problem Statement

Current 3-column layout (280px sidebar + 1fr main + 340px detail panel) has three UX issues:

1. **Right detail panel is empty ~90% of the time** — user has to click a symbol to populate it, but there's no visual affordance suggesting this. 340px permanently reserved for a mostly-empty panel.
2. **No inline action buttons** — user must click a row to navigate to `/stocks/{symbol}` for charts, or leave the page to set alerts. No quick actions from the table itself.
3. **Sidebar lacks density** — 280px for ~8 line items (Holdings, Tracked, 5 market groups, custom watchlists). Lots of padding, low information density.

---

## Proposed Solution

### Layout Change: 3-column → 2-column + slide-over

```
Current (3-column):                    Proposed (2-column + slide-over):
┌─────────┬──────────┬────────┐       ┌────────┬─────────────────────────┐
│ Sidebar │  Table   │ Detail │       │ Sidebar│  Table                  │
│  280px  │  1fr     │ 340px  │       │ 240px  │  1fr                    │
│         │          │ (empty)│       │        │  [action btns per row]  │
│         │          │        │       │        │                         │
└─────────┴──────────┴────────┘       └────────┴─────────────────────────┘
                                                     ↕ click row
                                       ┌─────────────────────────────────┐
                                       │  Slide-over panel (420px)       │
                                       │  Chart + AI + Alerts + News     │
                                       │  [× close]                      │
                                       └─────────────────────────────────┘
```

### Changes by Component

| File | Change | Rationale |
|------|--------|-----------|
| `WatchlistPage.tsx` | Grid: `240px 1fr` → remove 3rd column | Detail panel no longer permanent |
| `WatchlistPage.css` | Add `.watchlistPage__slideOver` + overlay | Slide-over panel styling |
| `WatchlistSidebar.tsx` | Compact: 240px, tighter padding, collapsible sections | Better density |
| `WatchlistTable.tsx` | Add action button column (4 icons per row) | Inline quick actions |
| `WatchlistDetailPanel.tsx` | Convert to slide-over overlay with close button | On-demand detail view |
| `WatchlistContext.tsx` | Add `selectedSymbol` + `setSelectedSymbol` state | Drive slide-over visibility |

### Inline Action Buttons (per row)

Each table row gets a compact action bar on hover/focus:

```
[Symbol] [Name] [Price] [Change] [Sparkline]  [📊 ⚠️ 📈 ✕]
```

| Icon | Action | Target |
|------|--------|--------|
| 📊 Chart | Opens slide-over with VNInvestCharts for that symbol | Slide-over panel |
| ⚠️ Alert | Opens price alert creation dialog (pre-filled symbol) | Modal/dialog |
| 📈 Trade | Links to `/stocks/{symbol}` (full page view) | Navigation |
| ✕ Remove | Removes symbol from current watchlist (with confirm) | Inline action |

On mobile: actions collapse into a `⋯` overflow menu.

### Slide-Over Panel

- Width: 420px (fixed, not resizable)
- Overlay: semi-transparent backdrop, click-to-close
- Content: VNInvestCharts widget (already exists) + AI Advisor placeholder + Whale Flow placeholder + News Feed placeholder
- Keyboard: `Escape` closes panel
- Animation: slide-in from right, 200ms ease-out

### Sidebar Compaction

- Reduce width from 280px → 240px
- Reduce padding from 1.5rem → 1rem
- Collapse market groups into a single "Market Groups" section with expandable list
- Make Holdings/Tracked sections collapsible (remember state in localStorage)

---

## What NOT to Change

- `WatchlistContext.tsx` API contract (data fetching, state shape) — stays the same
- `WatchlistTable.tsx` row renderers (4 types: holds, watchlist, tracked, group) — stays the same
- Sparkline SVG rendering — stays the same
- Price flash animations — stays the same
- BEM CSS naming convention — stays the same
- `WatchlistPage.css` custom property tokens (`--wl-*`) — stays the same

---

## Implementation Steps

### Step 1: Add selectedSymbol state to WatchlistContext
- Add `selectedSymbol: string | null` and `setSelectedSymbol: (s: string | null) => void`
- Export from context

### Step 2: Convert WatchlistDetailPanel to slide-over
- Change from permanent column to overlay position
- Add close button (×)
- Add Escape key handler
- Add backdrop click-to-close

### Step 3: Update WatchlistPage.tsx layout
- Remove 3rd column from grid
- Render WatchlistDetailPanel as overlay (not grid child)
- Conditionally render based on `selectedSymbol`

### Step 4: Add action buttons to WatchlistTable
- Add `onAction` callback prop: `(action: string, symbol: string) => void`
- Render action button group on row hover
- Handle: chart (setSelectedSymbol), alert (future modal), trade (navigate), remove (existing handler)

### Step 5: Compact WatchlistSidebar
- Reduce width, padding
- Add collapsible sections

### Step 6: CSS updates
- Add slide-over styles to WatchlistPage.css
- Update grid template
- Add hover-to-reveal action button styles
- Add mobile responsive breakpoints

### Step 7: Verify
- `npx tsc --noEmit`
- `npm run build`
- Manual test: click symbol → slide-over opens → press Escape → closes
- Manual test: click chart icon → slide-over opens with chart

---

## Open Questions

1. **Alert modal** — should we create a new `PriceAlertDialog` component, or reuse the legacy `PriceAlertModule` pattern?
2. **Remove confirmation** — inline toast with undo, or confirm dialog?
3. **Mobile layout** — sidebar as bottom sheet, or hamburger menu?
4. **Column reorder** — should action buttons be first column (left) or last column (right)?

---

## Estimated Scope

~400-500 lines changed across 6 files. No new files except potentially a small `WatchlistSlideOver.tsx` wrapper if we want to keep `WatchlistDetailPanel.tsx` untouched.
