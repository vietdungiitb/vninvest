# Audit & Layout Proposal: VNInvest Dashboard (v2.0)

**Date**: 2026-04-20
**Status**: Draft for Discussion
**Objective**: Transform the current scrolling dashboard into a high-density, professional "command center" layout following international fintech standards (Bloomberg, Reuters Eikon style).

---

## 1. Current State Audit (Dashboard.jsx)

### 📈 Strengths
- **Real-time Feed Integration**: Successfully hooks into `useRealtimeFeed` for live pricing and alerts.
- **Color Semantics**: Good use of HSL colors for gains/losses and severity levels.
- **Feature Rich**: Contains all necessary components (Heatmap, Allocation, Alerts, Analytics, Holdings).

### ⚠️ Current Issues (Low Efficiency)
1. **The "Scrolling Fatigue" problem**: 
   - The user must scroll past 4 layers (Stats -> Heatmap -> Alert Bar -> Alert Center/Analytics) to reach the **Holdings Table**. 
   - In professional trading, the **Holdings/Live Positions** is the "Source of Truth" and should be ATF (Above The Fold).
2. **Space Underutilization**: 
   - Many panels take up full-width (Heatmap, Alert Bar) when they could be side-by-side.
   - Vertical height of `UnifiedAlertCenter` (min-h 580px) pushes important analytics and tables out of view.
3. **Visual Hierarchy**: 
   - `StatCard` row takes significant vertical space.
   - `UnifiedAlertBar` and `UnifiedAlertCenter` have overlapping functions (showing alert counts/filters).

---

## 2. Professional Layout Strategy (The "Command Center" Model)

To achieve **maximum density** with **minimal scrolling**, we recommend moving from a "Feed-based" layout to a "Multi-Pane Workspace".

### 🔳 Phase A: The "Golden Grid" (ATF)
| Section | Description | Rationale |
| :--- | :--- | :--- |
| **Top Bar** | Compact Stats (Portfolio Name, Equity, P/L Total, Breadth) | High visibility, zero scroll. |
| **Main Center (Left)** | **Holdings Table (Compact Mode)** | Most used component. Should be the first thing seen. |
| **Side Panel (Right)** | **Live Alert Feed (Mini)** + **AI Digest** | Real-time events occurring *while* you monitor positions. |

### 🔳 Phase B: The Tabbed Interface
Instead of stacking everything vertically, use a **Main Workspace Hub** with 4 tabs:
1. **🏠 Overview**: Positions + Mini-Heatmap + Key Alerts.
2. **📊 Analytics**: Allocation Pie + Equity Curves + Advanced Ratios.
3. **🔔 Alert Center**: Full-screen filtered alert logs.
4. **⚙️ Ops/Admin**: Manual syncs, settings, export data.

---

## 3. Detailed Component Improvements

### 1. Header Summary Bar (Compact Stats)
- **Current**: 4 large cards.
- **Proposed**: A single horizontal bar with split metrics:
  - `[ Name ] [ Equity: 1.2B ] [ P/L: +12M (1%) ] [ Breadth: 10/2/5 ] [ Sync Status ]`
  - *Reduces height from 180px to 60px.*

### 2. Holdings Table (Density++ )
- Use **Sticky Headers** so the table is scrollable within a fixed-height container (e.g., 400px).
- Add **Mini-Sparklines** (24h) directly into the table rows.
- Compact padding (py-1.5 vs py-3).

### 3. Smart Sidebar (Market Pulse)
- Keep the **Market Breadth** and **Last Event** in a sticky right sidebar.
- Move the **AI Portfolio Digest** here for quick reading.

### 4. Heatmap & Charts
- Place the **Treemap (Heatmap)** in a separate tab or allow it to be Collapsible.
- Use a **Floating Action Button (FAB)** or a "Zen Mode" toggle to hide/show charts.

---

## 4. Proposed File Structure Changes

| Action | File | Description |
| :--- | :--- | :--- |
| [MODIFY] | `Dashboard.jsx` | Implement the Tab system and Grid-split (70:30 ratio). |
| [NEW] | `DashboardToolbar.jsx` | A dedicated compact header for global stats. |
| [MODIFY] | `HoldingsTable.jsx` | Add "Dense Mode" support. |
| [MODIFY] | `UnifiedAlertCenter.jsx` | Allow "Side-feed" mode (vertical, scrollable, no pagination controls). |

---

## 5. UI Mockup Concept (Mermaid Diagram)

```mermaid
graph TD
    subgraph "DASHBOARD (Screen Height 100vh)"
        Header[Compact Global Header: P/L, Equity, Breadth, Sync]
        subgraph "Workspace (75% width)"
            Tabs[Overview | Analytics | Alerts | Ops]
            TabContent[Selected Tab Content - e.g. Holdings Table with Sticky Header]
        end
        subgraph "Sidebar (25% width)"
            Realtime[Live Event Feed - Scrollable]
            AIDigest[AI Insights Card]
            Breadth[Market Health Status]
        end
    end
```

---

## 6. Verification Plan

### Manual Verification
1. **Viewport Check**: Ensure `HoldingsTable` is clearly visible on a 1080p screen without any scrolling.
2. **Interactivity**: Verify tab switching doesn't cause unnecessary API re-fetches (use memoization).
3. **Density**: Compare "Old" vs "New" - Target is +40% more data rows visible on screen.

---

> [!TIP]
> To implement this efficiently, we should use a **CSS Grid Layout** with `grid-template-areas` and `sticky` positioning for the sidebar.
