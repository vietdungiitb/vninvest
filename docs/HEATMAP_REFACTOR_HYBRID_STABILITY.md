# Heatmap Structural Hybrid Refactor & Stability Plan

## Metadata
- **Date**: 2026-04-18
- **Goal**: Resolve "innerHTML" crashes and "flashing" instabilities in the Portfolio Heatmap.
- **Strategy**: implement a hybrid data structure (Flat Treemap vs Grouped Sunburst) and force-remount on view transitions.

## Technical Requirements

### 1. Hybrid Data Processing
- **Treemap View (Stability Focused)**: Remove sector/industry grouping. Stocks compete in a single flat grid.
- **Sunburst View (Hierarchy Focused)**: Retain industry/sector grouping for rotational market breakdown.
- **Sorting**: Both views must be sorted by `Market Capitalization` (descending) to highlight dominant players.
- **Context Preservation**: Ensure the `Industry` name is always available in the tooltip, even in the flat Treemap view.

### 2. Frontend Implementation (`PortfolioHeatmap.jsx`)
- Refactor the `hierarchicalData` useMemo to return an object containing both `grouped` and `flat` datasets.
- Update `ReactECharts` configuration:
    - **Treemap**:
        - Use `flatData`.
        - Disable `levels` (sets border/gap to 0 for groups).
        - Set `leafDepth` to 0.
        - Simplified borders for stock tiles.
    - **Sunburst**:
        - Use `groupedData`.
        - Maintain multi-level rendering.
- **Tooltips**: Update the `formatter` to correctly extract the Industry from the leaf node data.

### 3. Stability Hardening
- **Force Remount**: Maintain the `key` prop on `ReactECharts` (`viewMode-dataID-lang`) to ensure ECharts instances are destroyed and recreated during mode switches, avoiding state corruption.
- **Defensive Rendering**: Maintain the patched ECharts core (via `patch-package`) to prevent `innerHTML` crashes if the chart is disposed while a tooltip is still active.

## Verification Plan

### Manual Verification
- [ ] **Treemap**: Verify stocks are in a single continuous area with NO sector labels on top.
- [ ] **Sunburst**: Verify stocks are still grouped into colored sector "wedges".
- [ ] **Sorting**: Verify that VCB/HPG (largest caps) appear first/largest.
- [ ] **Tooltips**: Verify "Banking" or "Ngân hàng" appears in the tooltip path for relevant stocks.
- [ ] **Transitions**: Rapidly switch between Treemap and Sunburst; ensure no "TypeError" or UI flickering occurs.
