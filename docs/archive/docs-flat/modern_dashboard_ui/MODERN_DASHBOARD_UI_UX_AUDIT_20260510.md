# Modern Dashboard UI/UX Audit & Improvement Plan (2026-05-10)

## Audit Report

### 1. Functional Redundancies
- **Portfolio Selector**: Duplicated in Sidebar and SmartStatsHeader. Causes mental friction and takes up valuable vertical/horizontal space in the high-density header.
- **UserConfig Button**: Present in TopNav as a top-level button AND reachable via System menu. This compresses the TopNav items unnecessarily.
- **User Identity**: Duplicated in TopNav and Sidebar footer.

### 2. Layout & Spacing Fragmentation
- **Sidebar Integration**: The 260px sidebar creates a "visual wall". The gap between this wall and the dashboard panels is currently inconsistent with other grid gaps (gap-6 vs Sidebar margin).
- **Alignment "Breaks"**: 
  - The metrics in SmartStatsHeader do not align with the starting edge of the Heatmap panel.
  - The TopNav items are not visually centered relative to the content area when the sidebar is open.
- **Grid Stability**: Toggling the sidebar causes the 1600px container to shift, but because it uses `mx-auto`, the distance from the sidebar changes inconsistently compared to the screen edge.

### 3. Visual Density
- **TopNav Compression**: Labels like "WORKSTATION", "Tín hiệu & Whale" are large, causing the TopNav to feel crowded on standard resolution screens.

## Improvement Strategy

### Phase 1: Redundancy Purge
- Remove `select` from `SmartStatsHeader.jsx`.
- Remove `UserConfig` link from `TopNav.jsx`.
- Hide redundant User Info in TopNav if Sidebar is active.

### Phase 2: Symmetry & Grid Discipline
- **Constraint Sync**: Apply a uniform CSS class for horizontal containment across `TopNav`, `Header`, and `Main`.
- **Vertical Alignment**: Shift Header metrics to align with Grid Column 1.
- **Grid Gap Normalization**: Ensure `gap-6` (24px) is the absolute standard between ALL adjacent panels (including Sidebar-to-Content).

### Phase 3: Visual Polish
- Reduce `TopNav` font sizes to `text-[11px]` or `text-xs`.
- Refine `Sidebar` border and background to blend more naturally with the main workspace.

---
*Documented by AI Assistant (Modernization Slice)*
